/**
 * Python sidecar analyzer 测试（AILAB-51）：
 * - 四域最小集信号映射（子进程/动态执行/网络出站/env 整表）+ 字面量与 docstring 排除；
 * - 降级路径（python3 缺失 → notice，无 AST 信号）；
 * - scanProject 端到端接线（.py 命中现有代码规则）。
 * 需要 python3（macOS CLT / CI ubuntu 自带）；缺失时相关用例跳过。
 */
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { analyzePythonBatch } from "./python.js";
import { scanProject } from "../index.js";
import type { CollectedFile, Rule } from "../types.js";

const hasPython3 = (() => {
  try {
    execFileSync("python3", ["-c", "pass"], { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
})();

function pyFile(path: string, content: string): CollectedFile {
  return { path, absPath: `/x/${path}`, content, size: content.length, language: "python" };
}

const tempDirs: string[] = [];
async function makeRoot(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "aivettr-pytest-"));
  tempDirs.push(root);
  for (const [p, content] of Object.entries(files)) {
    await mkdir(join(root, ...p.split("/").slice(0, -1)), { recursive: true });
    await writeFile(join(root, ...p.split("/")), content);
  }
  return root;
}
afterAll(async () => {
  for (const d of tempDirs) await rm(d, { recursive: true, force: true }).catch(() => {});
});

describe("analyzePythonBatch 四域信号映射", () => {
  it("子进程：os.system / os.popen / subprocess.* → child-process", () => {
    if (!hasPython3) return;
    const r = analyzePythonBatch([
      pyFile("a.py", [
        "import os, subprocess",
        "os.system('ls')",
        "os.popen(cmd)",
        "subprocess.run(['sh', q])",
        "subprocess.check_output(q, shell=True)",
        "subprocess.Popen(q)",
      ].join("\n")),
    ]);
    const names = r.calls.filter((c) => c.kind === "child-process").map((c) => c.name);
    expect(names).toEqual(["os.system", "os.popen", "subprocess.run", "subprocess.check_output", "subprocess.Popen"]);
    expect(r.calls[0].startLine).toBe(2);
    expect(r.calls[0].snippet).toContain("os.system");
  });

  it("动态执行：eval/exec 命中；importlib 变量导入命中、字面量导入不命中", () => {
    if (!hasPython3) return;
    const r = analyzePythonBatch([
      pyFile("b.py", [
        "import importlib",
        "eval(user_input)",
        "exec(code)",
        "importlib.import_module(plugin_name)",
        "importlib.import_module('os.path')",
        "__import__(name)",
      ].join("\n")),
    ]);
    const kinds = r.calls.filter((c) => c.kind === "eval" || c.kind === "dynamic-import");
    expect(kinds.map((c) => [c.kind, c.name])).toEqual([
      ["eval", "eval"],
      ["eval", "exec"],
      ["dynamic-import", "importlib.import_module"],
      ["dynamic-import", "__import__"],
    ]);
  });

  it("网络出站：requests/httpx 谓词、urllib urlopen、socket.create_connection；字面量 URL 记入 target", () => {
    if (!hasPython3) return;
    const r = analyzePythonBatch([
      pyFile("c.py", [
        "import requests, urllib.request, socket",
        "requests.post('http://svc.invalid/api', json=d)",
        "requests.get(url_var)",
        "httpx.Client()",
        "urllib.request.urlopen('http://x.invalid')",
        "socket.create_connection(('h', 80))",
      ].join("\n")),
    ]);
    const net = r.calls.filter((c) => c.kind === "network-egress");
    expect(net.map((c) => c.name)).toEqual([
      "requests.post",
      "requests.get",
      "urllib.request.urlopen",
      "socket.create_connection",
    ]);
    expect(net[0].target).toBe("http://svc.invalid/api");
    expect(net[1].target).toBeUndefined();
    expect(net[2].target).toBe("http://x.invalid");
  });

  it("env 整表：{**os.environ} / dict(os.environ) / os.environ.copy() / json.dumps(os.environ)", () => {
    if (!hasPython3) return;
    const r = analyzePythonBatch([
      pyFile("d.py", [
        "import os, json, copy, subprocess",
        "subprocess.run(cmd, env={**os.environ, 'X': '1'})",
        "payload = dict(os.environ)",
        "snapshot = os.environ.copy()",
        "blob = json.dumps(os.environ)",
        "dupe = copy.deepcopy(os.environ)",
        "os.environ['K'] = 'v'",
      ].join("\n")),
    ]);
    const dump = r.calls.filter((c) => c.kind === "env-dump").map((c) => c.name).sort();
    expect(dump).toEqual(["{**os.environ}", "copy.deepcopy", "dict(os.environ)", "json.dumps", "os.environ.copy"].sort());
    // 单变量读写不命中
    expect(dump).not.toContain("os.environ['K']");
  });

  it("字面量：非 docstring 字符串常量输出；docstring 排除；rawText 还原", () => {
    if (!hasPython3) return;
    const r = analyzePythonBatch([
      pyFile("e.py", [
        '"""Module docstring AKIAIOSFODNN7EXAMPLE should not appear."""',
        "def f():",
        '    """Function docstring."""',
        "    token = 'ghp_' + 'x' * 30",
        '    label = "literal-value-here"',
        "    return label",
      ].join("\n")),
    ]);
    const values = r.literals.map((l) => l.value);
    expect(values).toContain("literal-value-here");
    expect(values.join("\n")).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(values.join("\n")).not.toContain("Function docstring");
    const lit = r.literals.find((l) => l.value === "literal-value-here")!;
    expect(lit.rawText).toBe('"literal-value-here"');
    expect(lit.startLine).toBe(5);
  });

  it("语法错误文件记 parse_error 不中断；空文件列表直接返回", () => {
    if (!hasPython3) return;
    const r = analyzePythonBatch([pyFile("bad.py", "def broken(:\n")]);
    expect(r.calls).toEqual([]);
    expect(r.literals).toEqual([]);
    expect(analyzePythonBatch([])).toEqual({ calls: [], literals: [] });
  });
});

describe("降级路径", () => {
  it("python3 不可用 → notice + 无 AST 信号", () => {
    const r = analyzePythonBatch([pyFile("x.py", "os.system('ls')\n")]);
    if (!hasPython3) {
      expect(r.notice).toContain("python3 不可用");
      expect(r.calls).toEqual([]);
      return;
    }
    // 环境有 python3 时用不存在的解释器路径模拟缺失
    const prev = process.env.AIVETTR_PYTHON3;
    process.env.AIVETTR_PYTHON3 = "/nonexistent/aivettr-no-python";
    try {
      const r2 = analyzePythonBatch([pyFile("x.py", "os.system('ls')\n")]);
      expect(r2.notice).toContain("python3 不可用");
      expect(r2.calls).toEqual([]);
      expect(r2.notice).toContain("AIVETTR_PYTHON3");
    } finally {
      if (prev === undefined) delete process.env.AIVETTR_PYTHON3;
      else process.env.AIVETTR_PYTHON3 = prev;
    }
  });
});

describe("scanProject 端到端（sidecar 信号进入规则管道）", () => {
  /** 只消费指定 kind 的最小规则（避免反向依赖 rulepack；真实规则覆盖由 cli samples 测试承担） */
  function kindRule(id: string, kind: string, severity: "low" | "medium" | "high"): Rule {
    return {
      id,
      meta: { title: id, severity, owasp: ["LLM04:2026"] },
      check: (ctx) =>
        ctx.calls
          .filter((c) => c.kind === kind)
          .map((c) => ({
            message: `${kind}: ${c.name}`,
            location: { file: c.file, startLine: c.startLine, startColumn: c.startColumn },
          })),
    };
  }

  it("subprocess.run → child-process 信号命中；notices 缺省不出现", async () => {
    const root = await makeRoot({
      "package.json": JSON.stringify({ name: "py-mcp", dependencies: { mcp: "^1.0.0" } }),
      "server.py": [
        "import subprocess",
        "def run_tool(q):",
        "    return subprocess.run(q, shell=True)",
      ].join("\n"),
    });
    const result = await scanProject(root, {
      rules: [kindRule("test/py-proc", "child-process", "medium")],
    });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].location?.file).toBe("server.py");
    expect(result.findings[0].location?.startLine).toBe(3);
    expect(result.notices).toBeUndefined();
  });

  it("{**os.environ} → env-dump 信号命中", async () => {
    const root = await makeRoot({
      "server.py": [
        "import os, subprocess",
        "def spawn(cmd):",
        "    return subprocess.run(cmd, env={**os.environ, 'A': '1'})",
      ].join("\n"),
    });
    const result = await scanProject(root, {
      rules: [kindRule("test/py-env", "env-dump", "high")],
    });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].location?.startLine).toBe(3);
  });
});
