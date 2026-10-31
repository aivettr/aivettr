/** 文本/位置工具 */

/** 字符偏移 → 1-based 行/列（列按 UTF-16 code unit，与 TS AST 一致） */
export function lineColAt(
  content: string,
  offset: number,
): { line: number; column: number } {
  let line = 1;
  let column = 1;
  const end = Math.min(offset, content.length);
  for (let i = 0; i < end; i++) {
    if (content.charCodeAt(i) === 10) {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column };
}

/** 取某偏移所在行的整行内容（去行尾），用于证据片段 */
export function lineSnippet(content: string, offset: number): string {
  const lineStart = content.lastIndexOf("\n", offset - 1) + 1;
  let lineEnd = content.indexOf("\n", offset);
  if (lineEnd === -1) lineEnd = content.length;
  return content.slice(lineStart, lineEnd).trim();
}

/** 0-based 行号取整行（保留首尾空白由调用方处理） */
export function snippetByLine(content: string, line1: number): string {
  let start = 0;
  let line = 1;
  while (line < line1 && start < content.length) {
    const nl = content.indexOf("\n", start);
    if (nl === -1) return "";
    start = nl + 1;
    line++;
  }
  let end = content.indexOf("\n", start);
  if (end === -1) end = content.length;
  return content.slice(start, end);
}
