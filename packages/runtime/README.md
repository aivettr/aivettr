# @aivettr/runtime（阶段 3 · 规划已确认）

运行时防护模块。架构铁律：`scanner-core` 不得依赖本包；本模块可整体裁撤（转向纯静态检测形态）而不影响扫描器任何功能。

**形态已确认（2026-11-08，AILAB-48）**：CLI 子命令 `aivettr guard` + `aivettr guard -- <cmd>` 包裹式启动，经 Node preload 注入探针；一期仅 observe（观察记录落日志）、仅覆盖 Node.js MCP server。enforce 拦截为商业闭源侧能力（license gate）。现有占位接口 `RuntimeHook` 将在开发时替换演进。规格详见根目录 FEATURES.md「MCP Server 运行时防护」。
