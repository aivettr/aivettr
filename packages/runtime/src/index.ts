/**
 * @aivettr/runtime — 运行时防护（预留）
 *
 * ⚠️ 架构约束：本模块仅做接口约定，不得被 scanner-core 依赖；
 * 砍掉本模块不影响扫描器任何功能（已确认的「保留转向纯静态余地」原则）。
 */

/** 运行时观测点：工具调用前后的拦截/审计/限流（形态：网关/代理/SDK Hook 待定） */
export interface RuntimeHook {
  readonly id: string;
  onToolCall(event: ToolCallEvent): Promise<HookVerdict>;
}

export interface ToolCallEvent {
  readonly serverId: string;
  readonly toolName: string;
  readonly args: unknown;
}

export interface HookVerdict {
  readonly action: "allow" | "deny" | "warn";
  readonly reason?: string;
  readonly owaspRefs?: readonly string[];
}
