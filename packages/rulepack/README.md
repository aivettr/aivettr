# @aivettr/rulepack

AIVettr 风险规则库。**数据驱动、与引擎解耦**：规则为声明式定义（`AivettrRule`），以 OWASP GenAI/LLM Top 10 2026 与 ASI 2026 条目为索引，报告可逐条追溯标准来源。

首版覆盖四个能力域：`prompt-injection` / `supply-chain` / `excessive-agency` / `info-and-consumption`。规则条目随扫描器 MVP 规格确认（FEATURES.md）后逐条落库。
