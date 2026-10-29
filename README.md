# AISecurity（项目名待定）

> 面向 MCP / Skill 检测与运行时安全的 AI 安全开源项目。

## 项目背景

随着 LLM 应用与 Agent 生态的普及，MCP（Model Context Protocol）服务器、Skill / 插件等工具生态成为新的攻击面。本项目以 [OWASP GenAI/LLM Top 10 (2026)](./OWASP-GenAI-LLM-Top-10-2026-v1.0.pdf) 为风险框架基础，聚焦其中与工具生态和 Agent 运行时直接相关的风险：

| OWASP 2026 风险条目 | 与本项目的关联 |
|---|---|
| LLM01 Prompt Injection（含跨模态注入） | 工具描述投毒、间接注入检测 |
| LLM03 Excessive Agency | 工具权限 / 功能 / 自治度审查 |
| LLM04 Supply Chain | MCP server 与 Skill 包的供应链检测（pin / sign / verify、tool description 审计） |
| LLM06 Unbounded Consumption | 资源与成本消耗监控 |
| LLM08 Hidden Context Exposure | 上下文与系统提示泄露检测 |
| LLM10 Improper Output Handling | 工具输出处理校验 |

同时参考 OWASP Top 10 for Agentic Applications（ASI）2026 中 ASI01~ASI09 对 Agent 运行时风险（工具滥用、身份与权限滥用、级联失败等）的定义。

## 项目阶段

**当前阶段：初始化** —— 产品范围、技术选型、开源策略等关键决策待确认，见 `PROGRESS.md`。

## 文档

- `PROGRESS.md` — 执行过程记录
- `FEATURES.md` — 功能开发记录
- `ARCHITECTURE.md` — 架构文档
- `PROBLEM-LOG.md` — 问题修复记录
- `REPOSITORY.md` — Git 仓库信息
