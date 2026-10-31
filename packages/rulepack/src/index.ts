/**
 * @aivettr/rulepack — AIVettr 内置风险规则库
 *
 * 设计约束：
 * 1. 数据驱动：声明式 YAML 为主 + 必要代码规则，引擎可换语言而规则资产平移；
 * 2. 标准可追溯：每条规则经 meta.owasp 映射 OWASP GenAI/LLM Top 10 2026 / ASI 2026；
 * 3. 首版覆盖四个能力域：描述投毒 / 包供应链 / 过度权限 / 敏感信息与消耗。
 */

export { builtinRules, loadCustomRules } from "./loader.js";
export { compileDeclarativeRule } from "./declarative.js";
export { RuleLoadError } from "./errors.js";
export type { Rule, RuleMeta, Severity, ScanContext, FindingInput } from "@aivettr/scanner-core";
