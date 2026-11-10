/**
 * Python AST 分析器（AILAB-51 · 路径甲 sidecar）：
 * - 单进程批量协议：stdin 传入 {files: {path: content}}，stdout 返回逐文件调用/字面量信号；
 * - sidecar 用 python3 + stdlib ast（零第三方依赖），源码内嵌、运行时写入临时文件；
 * - 信号映射为与 JS/TS 相同的 DangerousCall / StringLiteralHit，现有代码规则直接消费；
 * - 降级路径：python3 缺失 / 执行失败 → 跳过 AST（保持文本级描述抽取）并通过 notices 提示。
 *
 * 四能力域最小映射（AILAB-51 issue 范围）：
 *   子进程 os.system / os.popen / subprocess.*            → child-process（process-execution）
 *   动态执行 eval / exec / __import__·importlib 变量导入  → eval / dynamic-import（dynamic-code-exec）
 *   网络出站 requests·httpx 谓词 / urllib urlopen /
 *            socket.create_connection（字面量 URL 记 target）→ network-egress
 *   env 整表 {**os.environ} / dict(os.environ) /
 *            os.environ.copy() / json.dumps(os.environ)    → env-dump
 * 额外：非 docstring 字符串常量 → StringLiteralHit（hardcoded-secret 等字面量规则复用）。
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { snippetByLine } from "../util/text.js";
import type {
  CollectedFile,
  DangerousCall,
  StringLiteralHit,
} from "../types.js";

/** sidecar Python 源码（内嵌保证 ncc bundle 自包含；注意不得含反引号与 ${ 序列） */
const SIDECAR_SOURCE = String.raw`
import ast, json, sys

SUBPROCESS_LEAVES = {"run", "call", "check_call", "check_output", "Popen", "getoutput", "getstatusoutput"}
NET_ROOTS = {"requests", "httpx"}
NET_METHODS = {"get", "post", "put", "delete", "head", "patch", "options", "request"}
NET_DOTTED = {"urllib.request.urlopen", "urllib.urlopen", "socket.create_connection"}


def dotted(node):
    parts = []
    while isinstance(node, ast.Attribute):
        parts.append(node.attr)
        node = node.value
    if isinstance(node, ast.Name):
        parts.append(node.id)
        return ".".join(reversed(parts))
    return None


def str_const(node):
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def first_str_arg(call):
    for a in call.args:
        s = str_const(a)
        if s is not None:
            return s
    return None


def make(kind, name, node, target=None):
    d = {
        "kind": kind,
        "name": name,
        "line": node.lineno,
        "col": node.col_offset + 1,
        "end_line": getattr(node, "end_lineno", None) or node.lineno,
        "end_col": (getattr(node, "end_col_offset", None) or node.col_offset) + 1,
    }
    if target is not None:
        d["target"] = target
    return d


def collect_docstring_ids(tree):
    ids = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            body = getattr(node, "body", [])
            if body and isinstance(body[0], ast.Expr):
                v = body[0].value
                if isinstance(v, ast.Constant) and isinstance(v.value, str):
                    ids.add(id(v))
    return ids


def analyze_source(src):
    result = {"calls": [], "literals": [], "parse_error": False}
    try:
        tree = ast.parse(src)
    except SyntaxError:
        result["parse_error"] = True
        return result
    doc_ids = collect_docstring_ids(tree)
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            if id(node) in doc_ids or len(node.value) < 4:
                continue
            result["literals"].append({
                "value": node.value,
                "line": node.lineno,
                "col": node.col_offset + 1,
                "end_line": getattr(node, "end_lineno", None) or node.lineno,
                "end_col": (getattr(node, "end_col_offset", None) or node.col_offset) + 1,
            })
            continue
        if not isinstance(node, ast.Call):
            # {**os.environ} 字典展开（非调用形态）
            if isinstance(node, ast.Dict):
                for k, v in zip(node.keys, node.values):
                    if k is None and dotted(v) == "os.environ":
                        result["calls"].append(make("env-dump", "{**os.environ}", node))
                        break
            continue
        base = dotted(node.func) or ""
        leaf = base.rsplit(".", 1)[-1]
        root = base.split(".")[0]
        args_environ = any(dotted(a) == "os.environ" for a in node.args)
        if base in ("os.system", "os.popen") or (root == "subprocess" and leaf in SUBPROCESS_LEAVES):
            result["calls"].append(make("child-process", base or "subprocess", node))
        elif base in ("eval", "exec", "compile"):
            result["calls"].append(make("eval", base, node))
        elif base in ("__import__", "importlib.import_module") and first_str_arg(node) is None:
            result["calls"].append(make("dynamic-import", base, node))
        elif (root in NET_ROOTS and leaf in NET_METHODS and node.args) or base in NET_DOTTED:
            result["calls"].append(make("network-egress", base, node, first_str_arg(node)))
        elif (base == "dict" and node.args and dotted(node.args[0]) == "os.environ") \
                or base == "os.environ.copy" \
                or (base == "copy.deepcopy" and args_environ) \
                or (base == "json.dumps" and args_environ):
            display = "dict(os.environ)" if base == "dict" else base
            result["calls"].append(make("env-dump", display, node))
    return result


def main():
    payload = json.load(sys.stdin)
    out = {}
    for path, src in payload.get("files", {}).items():
        out[path] = analyze_source(src)
    json.dump({"files": out}, sys.stdout)


if __name__ == "__main__":
    main()
`;

export interface PythonBatchResult {
  calls: DangerousCall[];
  literals: StringLiteralHit[];
  /** python3 不可用/失败时的降级提示（ScanResult.notices） */
  notice?: string;
}

const SPAWN_TIMEOUT_MS = 60_000;

let cachedScriptPath: string | null = null;

/** sidecar 源码写入临时文件（每进程一次；进程退出由 OS 清理临时目录） */
function ensureSidecarScript(): string {
  if (cachedScriptPath) return cachedScriptPath;
  const dir = mkdtempSync(join(tmpdir(), "aivettr-py-"));
  cachedScriptPath = join(dir, "sidecar.py");
  writeFileSync(cachedScriptPath, SIDECAR_SOURCE, "utf8");
  return cachedScriptPath;
}

/** (line, 1-based col) → 源码偏移（按 TS/JS analyzer 同款 1-based 列约定） */
function offsetAt(content: string, line: number, column: number): number {
  let offset = 0;
  let cur = 1;
  while (cur < line && offset < content.length) {
    const nl = content.indexOf("\n", offset);
    if (nl === -1) break;
    offset = nl + 1;
    cur++;
  }
  return Math.min(offset + column - 1, content.length);
}

/**
 * 批量分析 Python 文件（每 scan 一次 sidecar 进程）。
 * python3 缺失（ENOENT）或执行失败 → 返回 notice 并降级为无 AST 信号。
 */
export function analyzePythonBatch(files: readonly CollectedFile[]): PythonBatchResult {
  if (files.length === 0) return { calls: [], literals: [] };
  const byPath = new Map(files.map((f) => [f.path, f]));
  const payload = JSON.stringify({
    files: Object.fromEntries(files.map((f) => [f.path, f.content])),
  });
  const exe = process.env.AIVETTR_PYTHON3 ?? "python3";
  let stdout: string;
  try {
    stdout = execFileSync(exe, [ensureSidecarScript()], {
      input: payload,
      maxBuffer: 512 * 1024 * 1024,
      timeout: SPAWN_TIMEOUT_MS,
      encoding: "utf8",
    });
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    const notice =
      e.code === "ENOENT"
        ? `python3 不可用：已跳过 Python AST 分析（${files.length} 个 .py 文件仅做文本级描述抽取）；可用环境变量 AIVETTR_PYTHON3 指定解释器路径`
        : `Python AST 分析失败（${(err as Error).message.split("\n")[0].slice(0, 120)}）：已跳过，.py 文件仅做文本级描述抽取`;
    return { calls: [], literals: [], notice };
  }

  let parsed: {
    files: Record<string, {
      calls: { kind: string; name: string; target?: string; line: number; col: number; end_line: number; end_col: number }[];
      literals: { value: string; line: number; col: number; end_line: number; end_col: number }[];
    }>;
  };
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return { calls: [], literals: [], notice: "Python AST 分析输出无法解析：已跳过（sidecar 协议异常）" };
  }

  const calls: DangerousCall[] = [];
  const literals: StringLiteralHit[] = [];
  for (const [path, sig] of Object.entries(parsed.files)) {
    const f = byPath.get(path);
    if (!f) continue; // 防御：sidecar 返回未知路径
    for (const c of sig.calls ?? []) {
      calls.push({
        file: path,
        kind: c.kind as DangerousCall["kind"],
        name: c.name,
        ...(c.target !== undefined && c.target !== null ? { target: c.target } : {}),
        startLine: c.line,
        startColumn: c.col,
        endLine: c.end_line,
        endColumn: c.end_col,
        snippet: snippetByLine(f.content, c.line).trim(),
      });
    }
    for (const l of sig.literals ?? []) {
      const start = offsetAt(f.content, l.line, l.col);
      const end = offsetAt(f.content, l.end_line, l.end_col);
      const raw = start < end ? f.content.slice(start, end) : `"${l.value}"`;
      literals.push({
        file: path,
        value: l.value,
        rawText: raw,
        startLine: l.line,
        startColumn: l.col,
        endLine: l.end_line,
        endColumn: l.end_col,
      });
    }
  }
  return { calls, literals };
}
