import type { TargetAdapter } from "../index.js";

/**
 * MCP Server 适配器（MVP 唯一实现）。
 *
 * 解析对象（规格确认中，见 FEATURES.md）：
 * - npm/PyPI 上的 MCP server 包（清单 + install 脚本 + tool 描述）
 * - 本地 MCP 配置清单（如 claude_desktop_config.json / .mcp.json）引用的 server
 */
export const mcpAdapter: TargetAdapter = {
  id: "mcp",
  matches(target: string): boolean {
    // 规格：包名（含 @scope/name）、本地路径、配置文件路径 —— 待 FEATURES.md 立项后细化
    return /^[^/].*/.test(target);
  },
  async resolve(target: string) {
    // TODO(feature-mvp): 解析 MCP server 包/配置为 TargetArtifact
    throw new Error(`mcpAdapter.resolve not implemented yet (target: ${target})`);
  },
};
