# @aivettr/scanner-core

AIVettr 扫描器核心。架构约束：**零运行时依赖、可独立发布**；扫描对象经 `TargetAdapter` 插件化（MVP 仅 `mcp`，Skill/通用后续扩展）；规则来自 `@aivettr/rulepack`，引擎不硬编码规则。

接口见 `src/index.ts`。
