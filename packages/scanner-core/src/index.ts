/**
 * @aivettr/scanner-core — AIVettr 扫描器核心
 *
 * 架构约束（见 ARCHITECTURE.md）：
 * 1. 零依赖 runtime 模块，可独立发布、随时支撑「纯静态检测扫描器」形态；
 * 2. 扫描对象经 adapter 插件化：MVP 仅实现 mcp，Skill/通用后续新增适配器不改核心；
 * 3. 规则由调用方（@aivettr/rulepack）提供，引擎不硬编码规则。
 */

export * from "./types.js";
export { scanProject, resolveRelativeImport, SCANNER_VERSION } from "./scan.js";
export { collectFiles } from "./collector.js";
export type { CollectResult } from "./collector.js";
export { parsePackageJson, getField } from "./manifest.js";
export { GlobMatcher, matchGlob } from "./util/glob.js";
export { lineColAt, lineSnippet, snippetByLine } from "./util/text.js";
export { analyzeJsTs } from "./analyzers/ast.js";
export type { AstSignals } from "./analyzers/ast.js";
export { extractPythonDescriptions, matchRegex } from "./analyzers/text.js";
export { detectMcp } from "./adapters/mcp.js";
export type { McpTargetInfo } from "./adapters/mcp.js";
