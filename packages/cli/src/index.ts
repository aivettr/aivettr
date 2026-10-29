#!/usr/bin/env node
/**
 * aivettr — AIVettr CLI 入口（骨架）
 *
 * 目标形态（规格确认中，见 FEATURES.md）：
 *   aivettr scan <target...>   # 扫描 MCP server（包名 / 本地路径 / 配置文件）
 *   aivettr report <file>      # 读取 JSON 报告输出人读摘要
 */

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case "scan":
    // TODO(feature-mvp): 适配器选择 → resolve → 规则集加载 → scan → 报告输出
    console.error("aivettr: `scan` 尚未实现（骨架阶段），规格见 FEATURES.md");
    process.exitCode = 2;
    break;
  case "version":
  case "--version":
    console.log("aivettr 0.0.1 (skeleton)");
    break;
  default:
    console.log("aivettr — AI Agent 工具链安全扫描器（骨架）");
    console.log("用法: aivettr scan <target...>");
    process.exitCode = command ? 2 : 0;
}
