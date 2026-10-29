/**
 * @aivettr/scanner-core — AIVettr 扫描器核心
 *
 * 架构约束（见 ARCHITECTURE.md）：
 * 1. 零依赖 runtime 模块，可独立发布、随时支撑「纯静态检测扫描器」形态；
 * 2. 扫描对象经 TargetAdapter 插件化：MVP 仅实现 mcp，Skill/通用后续新增适配器不改核心；
 * 3. 检测规则来自 @aivettr/rulepack（数据驱动），引擎不硬编码规则。
 */

export interface TargetArtifact {
  /** 对象类型标识，与适配器 id 一致（mcp / skill / generic…） */
  readonly kind: string;
  /** 人工可读的目标名称（包名 / 配置路径等） */
  readonly name: string;
  /** 待检测的内容集合：tool 描述、清单、脚本、README 等由适配器抽取 */
  readonly contents: ReadonlyArray<TargetContent>;
}

export interface TargetContent {
  /** 内容语义角色：tool-description / manifest / script / readme / … */
  readonly role: string;
  /** 内容本体 */
  readonly text: string;
}

export interface Finding {
  /** 命中的规则 id（@aivettr/rulepack 中定义） */
  readonly ruleId: string;
  /** OWASP 条目索引（LLM01:2026 / ASI04 等），报告可追溯 */
  readonly owaspRefs: readonly string[];
  readonly severity: "info" | "low" | "medium" | "high" | "critical";
  /** 证据片段与定位 */
  readonly evidence: string;
  readonly location?: string;
}

/**
 * 目标适配器：把某一类扫描对象（MCP server / Skill / 通用工具）解析为
 * TargetArtifact。新增对象类型 = 新增适配器，不改动扫描核心。
 */
export interface TargetAdapter {
  readonly id: string;
  /** 该适配器能处理的目标表达式（包名 / 路径 / 配置引用） */
  matches(target: string): boolean;
  resolve(target: string): Promise<TargetArtifact>;
}

/** 扫描引擎：对 TargetArtifact 执行规则集并产出 Finding */
export interface ScanEngine {
  scan(artifact: TargetArtifact, rules: readonly unknown[]): Promise<readonly Finding[]>;
}
