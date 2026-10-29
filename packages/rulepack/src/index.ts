/**
 * @aivettr/rulepack — AIVettr 风险规则库
 *
 * 设计约束：
 * 1. 数据驱动：规则为声明式定义（不是引擎内硬编码），引擎可换语言而规则资产平移；
 * 2. 标准可追溯：每条规则以 OWASP GenAI/LLM Top 10 2026 与 ASI 2026 条目为索引；
 * 3. 首版覆盖四个能力域（已确认）：描述投毒 / 包供应链 / 过度权限 / 敏感信息与消耗。
 */

/** 四个能力域（与 ARCHITECTURE.md 映射表一致） */
export type RuleDomain =
  | "prompt-injection" // 描述投毒/隐藏指令（LLM01 / ASI01）
  | "supply-chain" // 包供应链风险（LLM04 / ASI04）
  | "excessive-agency" // 过度权限（LLM03 / ASI02/03）
  | "info-and-consumption"; // 敏感信息暴露与消耗型滥用（LLM02/08/06）

export interface AivettrRule {
  readonly id: string;
  readonly domain: RuleDomain;
  /** OWASP 条目索引，如 ["LLM01:2026", "ASI01"] —— 报告按此映射标准 */
  readonly owaspRefs: readonly string[];
  readonly title: string;
  readonly description: string;
  readonly severity: "low" | "medium" | "high" | "critical";
  /** 声明式匹配定义（匹配器语法随检测引擎设计确定：特征/正则/AST 模式/LLM 提示） */
  readonly matcher: Record<string, unknown>;
}

/** 规则集占位：首版规则随 FEATURES.md 扫描器规格确认后逐条落库 */
export const RULES: readonly AivettrRule[] = [];
