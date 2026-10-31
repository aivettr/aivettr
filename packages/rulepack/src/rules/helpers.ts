/** 代码规则公用工具 */

import type {
  FindingInput,
  Location,
  ScanContext,
  StringLiteralHit,
} from "@aivettr/scanner-core";

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
