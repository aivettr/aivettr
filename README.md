# AIVettr

> **AI + vettr**（古诺斯语 *vættr*，守护精灵）—— 为 AI Agent 生态把关工具链安全的守护者。
> 面向 MCP / Skill 检测与运行时安全的 AI 安全开源项目。

```bash
npx aivettr scan          # （MVP 开发中）扫描 MCP Server：描述投毒 / 供应链风险 / 过度权限 / 敏感信息与消耗
```

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

## 产品形态

- **MVP**：CLI 扫描器（`aivettr`）+ CI 集成（GitHub Action 薄包装，可裁撤），仅覆盖 MCP Server；
- **后续**：经适配器扩展至 Skill 与通用工具描述；运行时防护模块（仅接口预留）；
- **目标用户**：开发者优先；转商业化后面向企业/团队（在线扫描服务留给商业 SaaS）。

## 许可证（双许可）

- 开源侧：**GNU AGPL-3.0**（见 `LICENSE`）—— 个人与社区免费使用、修改、分发；修改后对外提供网络服务须开源修改。
- 商业侧：**商业许可**（见 `LICENSE-COMMERCIAL.md`）—— 不受 AGPL 约束的企业商用授权，联系项目方购买。
- 贡献即需同意 CLA（`legal/CLA-INDIVIDUAL.md` / `legal/CLA-CORPORATE.md`），贡献者保留版权，项目方获得 AGPL 与商业双通道分发权。

## 工程结构（Monorepo，TypeScript + pnpm workspaces）

```
packages/
├── scanner-core/   # 扫描器核心：adapters 按对象类型插件化（MCP 先行，Skill/通用后续）
├── cli/            # aivettr 命令行入口
├── rulepack/       # 风险规则库（数据驱动，OWASP LLM/ASI 条目索引）
├── report/         # 报告格式定义
└── runtime/        # 运行时防护（仅接口预留，不阻塞 scanner-core）
ci-action/          # GitHub Action（CLI 薄包装，独立可裁撤）
legal/              # CLA 与商标清单
```

## 文档

- `PROGRESS.md` — 执行过程记录
- `FEATURES.md` — 功能开发记录
- `ARCHITECTURE.md` — 架构文档
- `PROBLEM-LOG.md` — 问题修复记录
- `REPOSITORY.md` — Git 仓库信息
