/** 代码规则公用工具 */

import type {
  CollectedFile,
  FindingInput,
  Location,
  ScanContext,
  Severity,
  StringLiteralHit,
} from "@aivettr/scanner-core";

/** 测试目录/测试文件路径（AILAB-50 调优：env-dump 豁免、api-key/hardcoded-secret 降权共用） */
export const TEST_PATH =
  /(?:^|\/)(?:tests?|__tests__|spec)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/i;

/**
 * 生成物/数据块文件判定（AILAB-50 M2 · B4 口径，2026-11-09 语料实测）：
 * - 任一非空行 ≥5000 字符（单行打包产物/内联数据）；
 * - 或非空行 ≥8 行且 ≥200 字符的行占比 ≥50%（字体 base64 数据 TS、逐行数据导出）。
 * 手写业务代码（官方生态实测：最长行 1136、平均行长 47–62）不会命中，
 * public/ 下的真实服务端逻辑不受影响——不得用「路径一刀切」替代本判定。
 */
export function isGeneratedFile(f: CollectedFile): boolean {
  const t = f.content;
  let maxLine = 0;
  let nonEmpty = 0;
  let long = 0;
  let start = 0;
  for (;;) {
    const nl = t.indexOf("\n", start);
    const end = nl === -1 ? t.length : nl;
    if (end > start) {
      nonEmpty++;
      const len = end - start;
      if (len >= 200) long++;
      if (len > maxLine) maxLine = len;
    }
    if (nl === -1) break;
    start = nl + 1;
  }
  return maxLine >= 5000 || (nonEmpty >= 8 && long / nonEmpty >= 0.5);
}

const generatedCache = new WeakMap<ScanContext, Set<string>>();

/** 当前扫描中生成物文件路径集合（按 ScanContext 缓存，规则间共享一次计算） */
export function generatedFilePaths(ctx: ScanContext): Set<string> {
  let set = generatedCache.get(ctx);
  if (!set) {
    set = new Set(ctx.files.filter(isGeneratedFile).map((f) => f.path));
    generatedCache.set(ctx, set);
  }
  return set;
}

const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

/** 按路径谓词降级命中 severity（只降不升；不改消息与定位；base 为规则 meta 级别） */
export function demoteFindings(
  findings: FindingInput[],
  test: (path: string) => boolean,
  base: Severity,
  severity: Severity = "low",
): FindingInput[] {
  return findings.map((f) => {
    if (!f.location || !test(f.location.file)) return f;
    const current = f.severity ?? base;
    return SEVERITY_RANK[current] > SEVERITY_RANK[severity] ? { ...f, severity } : f;
  });
}

/** 从调用信号定位 */
export function callLocation(
  ctx: ScanContext,
  file: string,
  line: number,
  column: number,
  endLine?: number,
  endColumn?: number,
): Location {
  const f = ctx.file(file);
  return {
    file,
    startLine: line,
    startColumn: column,
    ...(endLine ? { endLine } : {}),
    ...(endColumn ? { endColumn } : {}),
    ...(f ? { snippet: snippetLine(f.content, line) } : {}),
  };
}

/** 在 package.json 文本中定位字段值（取行列，失败回退 1:1）——声明式引擎与代码规则共用 */
export function locateJsonValue(content: string, key: string, value: string) {
  const keyLit = JSON.stringify(key);
  const valLit = JSON.stringify(value);
  const keyAt = content.indexOf(keyLit);
  let at = -1;
  if (keyAt !== -1) {
    const window = content.slice(keyAt, keyAt + 400);
    const valAt = window.indexOf(valLit);
    if (valAt !== -1) at = keyAt + valAt;
  }
  if (at === -1) at = content.indexOf(valLit);
  if (at === -1) return { file: "package.json", startLine: 1, startColumn: 1 };
  let line = 1;
  let col = 1;
  for (let i = 0; i < at; i++) {
    if (content.charCodeAt(i) === 10) {
      line++;
      col = 1;
    } else col++;
  }
  return { file: "package.json", startLine: line, startColumn: col };
}

export function snippetLine(content: string, line1: number): string {
  let start = 0;
  let line = 1;
  while (line < line1) {
    const nl = content.indexOf("\n", start);
    if (nl === -1) return "";
    start = nl + 1;
    line++;
  }
  let end = content.indexOf("\n", start);
  if (end === -1) end = content.length;
  return content.slice(start, end).trim().slice(0, 200);
}

export function literalLocation(ctx: ScanContext, l: StringLiteralHit): Location {
  return callLocation(
    ctx,
    l.file,
    l.startLine,
    l.startColumn,
    l.endLine,
    l.endColumn,
  );
}

export function finding(
  message: string,
  location: Location,
  evidence?: string,
): FindingInput {
  return {
    message,
    ...(evidence !== undefined ? { evidence } : {}),
    location,
  };
}
