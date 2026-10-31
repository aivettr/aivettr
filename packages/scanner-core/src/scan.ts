/**
 * 扫描管道（scanner-core 入口）：
 * 文件采集 → manifest 解析 → per-file analyzer（AST/文本）→ 包内导入解析
 * → MCP adapter 识别 → 规则判定 → ScanResult。
 *
 * 纯静态零执行；确定性：同输入同规则，除 scannedAt 外结果逐字节一致
 * （不写入耗时，文件按路径排序，finding 按固定序排序）。
 */

import { stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import * as posix from "node:path/posix";
import { analyzeJsTs } from "./analyzers/ast.js";
import { extractPythonDescriptions } from "./analyzers/text.js";
import { collectFiles } from "./collector.js";
import { parsePackageJson } from "./manifest.js";
import { detectMcp } from "./adapters/mcp.js";
import {
  SEVERITY_ORDER,
  ScanError,
  type CollectedFile,
  type DangerousCall,
  type Finding,
  type ImportRecord,
  type PackageManifest,
  type ScanContext,
  type ScanOptions,
  type ScanResult,
  type StringLiteralHit,
  type ToolDescription,
} from "./types.js";

export const SCANNER_VERSION = "0.1.0";

const RESOLVE_EXTS = ["", ".ts", ".js", ".mjs", ".cjs", ".tsx", ".jsx"];

function resolveRelativeImport(
  fromFile: string,
  spec: string,
  filePaths: ReadonlySet<string>,
): string | null {
  const dir = posix.dirname(fromFile);
  const base = posix.normalize(posix.join(dir, spec));
  for (const ext of RESOLVE_EXTS) {
    if (filePaths.has(base + ext)) return base + ext;
  }
  for (const ext of RESOLVE_EXTS.slice(1)) {
    if (filePaths.has(posix.join(base, "index" + ext))) return posix.join(base, "index" + ext);
  }
  return null;
}

/** 暴露给测试与规则：包内导入解析 */
export { resolveRelativeImport };

export async function scanProject(targetPath: string, options: ScanOptions): Promise<ScanResult> {
  const root = resolve(targetPath);
  let s;
  try {
    s = await stat(root);
  } catch {
    throw new ScanError(`路径不存在: ${targetPath}`, "not-found");
  }
  if (!s.isDirectory()) throw new ScanError(`目标不是目录: ${targetPath}`, "not-directory");

  const { files, skipped } = await collectFiles(root, {
    ignore: options.ignore,
    maxFileBytes: options.maxFileBytes,
  });

  // manifest（根 package.json；扫描的是项目自身而非依赖）
  let manifest: PackageManifest | undefined;
  const pkg = files.find((f) => f.path === "package.json");
  if (pkg) manifest = parsePackageJson(pkg.content);

  // analyzer
  const imports: ImportRecord[] = [];
  const literals: StringLiteralHit[] = [];
  const calls: DangerousCall[] = [];
  let descriptions: ToolDescription[] = [];
  const bccProperties: StringLiteralHit[] = [];
  const importedModules = new Set<string>();

  for (const file of files) {
    if (file.language === "javascript" || file.language === "typescript") {
      const sig = analyzeJsTs(file);
      for (const imp of sig.imports) {
        imports.push({
          file: file.path,
          module: imp.module,
          kind: imp.kind,
          isRelative: imp.module.startsWith(".") || imp.module.startsWith("/"),
        });
        importedModules.add(imp.module);
      }
      literals.push(...sig.literals);
      calls.push(...sig.calls);
      descriptions.push(...sig.descriptions);
      bccProperties.push(...sig.bccProperties);
    } else if (file.language === "python") {
      descriptions.push(...extractPythonDescriptions(file));
    }
  }

  // 包内导入解析
  const filePaths = new Set(files.map((f) => f.path));
  for (let i = 0; i < imports.length; i++) {
    const imp = imports[i];
    if (!imp.isRelative) continue;
    const resolved = resolveRelativeImport(imp.file, imp.module, filePaths);
    imports[i] = { ...imp, resolved };
  }

  // adapter
  const info = detectMcp(basename(root), files, manifest, importedModules);

  const byPath = new Map(files.map((f) => [f.path, f]));
  const ctx: ScanContext = {
    root,
    files,
    ...(manifest ? { manifest } : {}),
    isMcp: info.detected,
    mcpSignals: info.signals,
    targetName: info.name,
    descriptions,
    imports,
    calls,
    literals,
    bccProperties,
    file(path: string) {
      return byPath.get(path);
    },
  };

  // 规则判定（规则自身异常 = 工具错误，CLI 映射退出码 2）
  const rawFindings: Finding[] = [];
  for (const rule of options.rules) {
    let hits;
    try {
      hits = rule.check(ctx);
    } catch (err) {
      throw new ScanError(
        `规则 ${rule.id} 执行失败: ${(err as Error).message}`,
        "rule-failed",
      );
    }
    for (const h of hits) {
      rawFindings.push({
        ruleId: rule.id,
        severity: rule.meta.severity,
        message: h.message,
        ...(h.evidence !== undefined ? { evidence: h.evidence } : {}),
        ...(h.location ? { location: h.location } : {}),
        owasp: rule.meta.owasp,
      });
    }
  }

  // 确定性排序：severity 降序 → file → line → column → ruleId → message
  rawFindings.sort((a, b) => {
    const sv = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    if (sv !== 0) return sv;
    const af = a.location?.file ?? "";
    const bf = b.location?.file ?? "";
    if (af !== bf) return af < bf ? -1 : 1;
    const al = a.location?.startLine ?? 0;
    const bl = b.location?.startLine ?? 0;
    if (al !== bl) return al - bl;
    const ac = a.location?.startColumn ?? 0;
    const bc = b.location?.startColumn ?? 0;
    if (ac !== bc) return ac - bc;
    if (a.ruleId !== b.ruleId) return a.ruleId < b.ruleId ? -1 : 1;
    return a.message < b.message ? -1 : a.message > b.message ? 1 : 0;
  });

  const counts = {
    total: rawFindings.length,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const f of rawFindings) counts[f.severity]++;

  return {
    schemaVersion: "1.0",
    tool: { name: "aivettr", version: SCANNER_VERSION },
    scannedAt: (options.now ?? new Date()).toISOString(),
    target: {
      path: root,
      kind: info.kind,
      name: info.name,
      detected: info.detected,
    },
    summary: counts,
    findings: rawFindings,
    stats: {
      filesScanned: files.length,
      filesSkipped: skipped.length,
      rulesRun: options.rules.length,
    },
  };
}

export type { CollectedFile };
