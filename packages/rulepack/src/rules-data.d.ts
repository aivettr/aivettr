/**
 * 构建期生成文件的类型声明。
 * 运行时实体 dist/rules-data.js 由 scripts/build-rules.mjs 从 rules/*.yaml 生成；
 * tsc 类型检查经本声明解析，运行时经 Node 解析 dist 实体。
 */
declare const BUILTIN_YAML: Readonly<Record<string, string>>;
export { BUILTIN_YAML };
