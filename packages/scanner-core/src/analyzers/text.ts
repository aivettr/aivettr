/**
 * 文本/正则 analyzer（非 JS/TS 语言退化为此）。
 *
 * Python 工具描述抽取（FastMCP / 官方 Python SDK 常见形态）：
 * - `@…tool()` 装饰的函数 docstring；
 * - `Tool(name=..., description="...")` 的 description 关键字参数。
 * 另提供通用 regex 匹配 → 行列定位工具，供声明式规则与测试使用。
 */

import type { CollectedFile, ToolDescription } from "../types.js";
import { lineColAt, lineSnippet } from "../util/text.js";

export interface RegexMatchLocation {
  readonly index: number;
  readonly length: number;
  readonly line: number;
  readonly column: number;
  readonly endLine: number;
  readonly endColumn: number;
  readonly snippet: string;
  readonly matchText: string;
}

export function* matchRegex(
  content: string,
  regex: RegExp,
): Generator<RegexMatchLocation> {
  // 全局扫描需要 g 标志；调用方传入无 g 时临时构造
  const re = regex.global ? regex : new RegExp(regex.source, regex.flags + "g");
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const start = m.index;
    const length = m[0].length;
    if (length === 0) {
      re.lastIndex++;
      continue;
    }
    const s = lineColAt(content, start);
    const e = lineColAt(content, start + length);
    yield {
      index: start,
      length,
      line: s.line,
      column: s.column,
      endLine: e.line,
      endColumn: e.column,
      snippet: lineSnippet(content, start),
      matchText: m[0],
    };
  }
}

const STRING_FORMS = [
  /"""(?:[\s\S]*?)"""/,
  /'''(?:[\s\S]*?)'''/,
  /"(?:[^"\\]|\\.)*"/,
  /'(?:[^'\\]|\\.)*'/,
];

function unquote(v: string): string {
  let s = v.trim();
  for (const q of ['"""', "'''", '"', "'"]) {
    if (s.startsWith(q) && s.endsWith(q) && s.length >= 2 * q.length) {
      s = s.slice(q.length, s.length - q.length);
      break;
    }
  }
  // Python 常见转义做最小还原
  return s.replace(/\\(["'\\])/g, "$1");
}

function stringAt(src: string, index: number): { value: string; end: number } | undefined {
  for (const form of STRING_FORMS) {
    const re = new RegExp(form.source, "g");
    re.lastIndex = index;
    const m = re.exec(src);
    if (m && m.index === index) return { value: unquote(m[0]), end: index + m[0].length };
  }
  return undefined;
}

/** 抽取 Python 文件中的工具描述候选 */
export function extractPythonDescriptions(file: CollectedFile): ToolDescription[] {
  if (file.language !== "python") return [];
  const src = file.content;
  const out: ToolDescription[] = [];

  // ① @…tool() 装饰函数的 docstring
  const decoratorRe = /@[\w.]*\btool\s*\([^)]*\)\s*(?:async\s+)?def\s+(\w+)/g;
  let dm: RegExpExecArray | null;
  while ((dm = decoratorRe.exec(src)) !== null) {
    // 定位以冒号结尾的 def 头（函数名之后；参数注解里的冒号在行中，
    // 只有头结束的冒号紧跟可选注释与换行）
    const afterName = dm.index + dm[0].length;
    const headerEndRe = /:[ \t]*(?:#[^\n]*)?\n/;
    const hm = headerEndRe.exec(src.slice(afterName));
    if (!hm) continue;
    const bodyStart = afterName + hm.index + hm[0].length;
    const rest = src.slice(bodyStart);
    const docRe = /^[ \t]*(?:"""([\s\S]*?)"""|'''([\s\S]*?)''')/m;
    const m2 = docRe.exec(rest);
    // docstring 必须是函数体首条语句（前面只允许空白行与空白）
    if (m2 && /^[ \t]*(?:\r?\n[ \t]*)*$/.test(rest.slice(0, m2.index))) {
      const text = (m2[1] ?? m2[2] ?? "").trim();
      const abs = bodyStart + m2.index + m2[0].indexOf(text);
      const lc = lineColAt(src, abs);
      out.push({
        file: file.path,
        name: dm[1],
        text,
        startLine: lc.line,
        startColumn: lc.column,
      });
    }
  }

  // ② description = "..." / Tool(..., description = "...")
  const kwRe = /\bdescription\s*=\s*/g;
  let km: RegExpExecArray | null;
  while ((km = kwRe.exec(src)) !== null) {
    const at = src.indexOf(km[0], km.index) + km[0].length;
    const str = stringAt(src, at);
    if (str) {
      const lc = lineColAt(src, at);
      const ec = lineColAt(src, str.end);
      out.push({
        file: file.path,
        text: str.value.trim(),
        startLine: lc.line,
        startColumn: lc.column,
        endLine: ec.line,
        endColumn: ec.column,
      });
    }
  }

  return out;
}
