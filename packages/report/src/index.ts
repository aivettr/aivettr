/**
 * @aivettr/report — 基于统一 ScanResult 模型渲染四种格式：
 * text（默认）/ JSON（schemaVersion 1.0）/ SARIF 2.1.0 / Markdown。
 */

import type { Rule, ScanResult } from "@aivettr/scanner-core";
import { renderJson } from "./json.js";
import { renderMarkdown } from "./markdown.js";
import { renderSarif } from "./sarif.js";
import { renderText } from "./text.js";

export type ReportFormat = "text" | "json" | "sarif" | "markdown";

export interface RenderInput {
  readonly result: ScanResult;
  readonly format: ReportFormat;
  readonly rules?: readonly Rule[];
  readonly color?: boolean;
}

export const FORMATS: readonly ReportFormat[] = ["text", "json", "sarif", "markdown"];

/** markdown|md 别名由 CLI 层归一到 markdown */
export function render(input: RenderInput): string {
  switch (input.format) {
    case "text":
      return renderText(input.result, { color: input.color, rules: input.rules });
    case "json":
      return renderJson(input.result);
    case "sarif":
      return renderSarif(input.result, { rules: input.rules });
    case "markdown":
      return renderMarkdown(input.result, { rules: input.rules });
  }
}

export { renderText } from "./text.js";
export type { RenderOptions as TextRenderOptions } from "./text.js";
export { renderJson } from "./json.js";
export { renderSarif } from "./sarif.js";
export type { SarifOptions } from "./sarif.js";
export { renderMarkdown } from "./markdown.js";
export type { MarkdownOptions } from "./markdown.js";
