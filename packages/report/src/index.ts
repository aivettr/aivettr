/**
 * @aivettr/report — 扫描报告格式定义
 *
 * 双形态输出（规格随 CLI 立项细化）：
 * - 终端人读摘要（开发者优先）
 * - 机读格式（JSON / SARIF，供 CI 集成与代码扫描平台消费）
 */

export interface ScanReport {
  readonly tool: "aivettr";
  readonly version: string;
  readonly generatedAt: string;
  /** 扫描目标（适配器 id + 目标表达式） */
  readonly target: { readonly kind: string; readonly name: string };
  readonly findings: readonly {
    readonly ruleId: string;
    readonly owaspRefs: readonly string[];
    readonly severity: string;
    readonly evidence: string;
    readonly location?: string;
  }[];
  /** 按能力域汇总统计 */
  readonly summary: Record<string, number>;
}
