# 架构俯视文档（ARCHITECTURE）

> 状态：初始化阶段 —— 架构尚未定型，本文档先记录**已确定的约束**与**待定决策**，随确认进度实时更新。

## 1. 项目定位（已确认的部分）

- **领域**：AI 安全（AI Security）
- **方向**：MCP / Skill 检测 + 运行时安全（runtime security）
- **风险框架基础**：OWASP GenAI/LLM Top 10 2026（本仓库 PDF，CC BY-SA 4.0）+ OWASP Agentic Top 10（ASI）2026
- **商业模式**：先开源，未来转商业化（→ 架构需预留 Open Core 边界）
- **用户定位（已确认，2026-10-29）**：开源阶段**开发者优先**（CLI/CI 体验为核心），转商业后再面向企业/团队级
- **产品形态（已确认，2026-10-29）**：**CLI + CI 集成**；约束：CI（GitHub Action 等）只是 CLI 的**薄包装层**，独立成模块、可随时裁撤，转向「仅 CLI」不触碰核心代码；在线扫描服务不做，留给未来商业 SaaS
- **开源范围管理（已确认的强约束，2026-10-29）**：严格管理开源范围，防止项目被窃取商业化 → 四件套机制已落地其一：**许可证 = 双许可（AGPL-3.0 + 商业许可，已确认 2026-10-29）**，`LICENSE` / `LICENSE-COMMERCIAL.md` / `legal/CLA-*.md`（草案）已入库；CLA 电子签署流程与商标注册待项目命名（D1）确定后办理

## 2. MVP 方向（已确认，2026-10-29）

**扫描器先行 + 运行时架构预留**，并约束：

- **扫描对象（已确认，2026-10-29）**：MVP **仅覆盖 MCP Server**（npm/PyPI 包 + 本地 MCP 配置清单）；Skill 与通用工具描述经 `adapters/` 目标适配器在后续版本逐步扩展；
- **规则范围（已确认，2026-10-29）**：首版检测规则**四个能力域全做** —— ①描述投毒/隐藏指令（LLM01/ASI01）②包供应链风险（LLM04/ASI04）③过度权限（LLM03/ASI02/03）④敏感信息暴露与消耗型滥用（LLM02/LLM08/LLM06）；
- 必须保留随时**转向「纯静态检测扫描器」**的余地 —— 运行时模块不得阻塞扫描器的开发与交付；
- 为此确立模块解耦原则：
  1. **扫描器核心（scanner-core）独立成模块**，零依赖运行时组件，可单独发布、单独演进；
  2. 运行时防护作为**并列模块**（runtime）按接口预留，后续独立开发，接口变更不得要求 scanner-core 回改；
  3. 两模块共享的只有：风险规则库（rulepack，以 OWASP 条目为索引）与报告格式定义 —— 且由 scanner-core 主导版本。

## 3. 风险框架 → 能力域映射（依据 OWASP 2026 原文）

| 能力域（暂名） | 对应风险条目 | 检测/防护对象 |
|---|---|---|
| 供应链检测 | LLM04 Supply Chain、ASI04 | MCP server 包、Skill/插件包、tool description 隐藏指令、模型工件 |
| 注入检测 | LLM01 Prompt Injection、ASI01 | 工具描述投毒、间接注入（issue/ticket/RAG 等通道）、跨模态注入 |
| 权限与自治审查 | LLM03 Excessive Agency、ASI02/03 | 工具最小化、过度权限、过度自治、高敏操作确认 |
| 运行时监控与防护 | LLM06/LLM08/LLM10、ASI05/08/09 | 资源消耗、上下文泄露、输出处理、级联失败、RCE 防护 |

> 上述映射仅划定能力域；MVP 先做哪个能力域 **待确认**。

## 4. 技术选型

**主语言已确认（2026-10-29）：TypeScript**，MVP 单语言 TS 实现；Python 不进 MVP，后续如有 PyPI 深度 AST 分析需求，以独立分析器子模块（sidecar，进程隔离、经 adapter 接口调用）引入。

| 维度 | 决策 | 备注 |
|---|---|---|
| 主语言 | ✅ **TypeScript** | npm 系 MCP 包原生分析深度（package.json/install 脚本/AST 级混淆与隐藏指令检测）；`npx` 零安装分发；GitHub Action 原生；未来 runtime 网关复用官方 MCP SDK |
| 检测引擎 | 待定（规则/静态分析/LLM 辅助/混合） | 已定约束：**规则库数据驱动、与引擎解耦**（规则=声明式定义，引擎可换语言而规则资产平移）；LLM 辅助检测自身也受 LLM01/LLM07 约束 |
| 运行时形态 | 待定（预留） | 仅接口约定，不阻塞 scanner-core |
| 仓库结构 | ✅ **Monorepo**（pnpm workspaces） | 模块：scanner-core / ci-action / runtime（预留）/ shared(rulepack, report)；工具链轻量化，暂不引入 turbo，包数量多后再议 |

## 5. 已识别的架构约束

1. **开源→商业路径**：许可证选择（Apache-2.0 / MIT / AGPL-3.0 / 双许可）与开源/商业模块边界必须**在编码开始前**确定，避免后期拆仓成本。
2. **标准对齐**：检测规则库应以 OWASP LLM Top 10 2026 / ASI 2026 条目为可追溯索引（报告可映射到标准条目）。
3. **不信任检测引擎自身**：若检测引擎使用 LLM，其本身即是 LLM 应用，需满足自身安全基线（自食其狗粮）。
4. **防窃取商业化**：开源边界即安全边界 —— 核心检测能力可开源，但需保证：商业护城河模块（企业集中管理、合规报告、规则库持续更新服务）留在闭源侧；外部贡献必须签 CLA 以保留商业化再许可权利；项目名注册商标防止品牌盗用。

## 6. 竞品与对标（初步观察，2026-10-29，命名调研时获取）

| 项目/厂商 | 方向 | 与本项目关系 |
|---|---|---|
| Invariant Labs `mcp-scan` | MCP server 静态扫描 | 同赛道最主要对标（PDF 亦引用其研究） |
| `Ramparts`（highflame，2025-07） | MCP 使用安全 / MCP scan | 同赛道直接竞品 |
| `Argus`（arestechub） | 统一 20+ 扫描工具的 CLI + MCP server 安全平台 | 相邻竞品（聚合器路线） |
| `AgentWard`（agentward-ai） | Agent 工具权限控制面（scan/enforce/audit） | 相邻竞品（含扫描 + 运行时执法） |
| `AgentSentinel`（开源 + 论文） | eBPF agent 运行时防御框架 | 未来 runtime 模块相邻项目；亦导致该名不可用 |
| `toolproof` MCP checker（lobehub 收录） | 检查 MCP server/API 隐藏指令 | 同赛道小项目（注：Pagefind toolproof 为测试框架，同名） |
| Microsoft `RAMPART`（2026-05） | pytest 原生的 agent 安全测试框架 | 相邻（红队测试路线） |
| Trail of Bits `mcp-context-protector` | 运行时防护（首连 pin） | 未来 runtime 模块的对标 |
| `toolwall`（npm，2026-08，MIT） | 本地 MCP guardrail 代理（每次调用前重验 tool 定义防 rug pull） | 未来 runtime 模块的对标 |
| Docker MCP Gateway | 容器化沙箱 | 互补（隔离层），非直接竞品 |
| `AI Cordon`（ai-cordon.com + PyPI `aicordon`，2026-10） | 文档级间接提示注入检测（AI 读取前筛查隐藏指令） | ⚠️ 高相邻竞品（与我们的注入检测域重叠）；亦导致 `aicordon` 名不可用 |
| `AISentinel`（GitHub，2026-07） | 开源 MCP server，运行时保护 AI agent | 未来 runtime 模块相邻竞品；`aisentinel` 名亦被其占用 |

**含义**：runtime/代理赛道已有活跃玩家，扫描赛道也有 mcp-scan、Ramparts 等先行者 —— 但「OWASP 标准映射规则库 + 扫描器 + CI」的组合仍有差异化空间（A4 差异化定位确认时进一步分析）。

npm 命名占用核查（2026-10-29，registry 间歇可达 + 搜索引擎核查）：`mcp-guard`、`toolwall`、`toolproof`、`agentward`、`argus`、`assay`、`rampart`、`agentsentinel`、`arx` 均**已被占用或撞名**（多数为同赛道项目）；`cordon` npm **已被死占位包占用**（0.0.0，2018，已核实）；自造词 `vettr` / `vigilo` / `scantinel` 搜索无撞名、npm 待复核。最终定名前须复核 npm 精确占用 + 商标检索。

## 7. 模块边界（初版，随工程骨架落地细化）

```
aisecurity/            # 仓库名待定（D1）
├── scanner-core/      # 扫描器核心：MCP/Skill 静态检测，独立发布，零运行时依赖
│   └── adapters/      # 扫描目标适配器（MCP server / Skill / ...，按对象类型插件化）
├── ci-action/         # CI 集成（GitHub Action 等）：CLI 的薄包装，独立可裁撤
├── runtime/           # 运行时防护（预留）：网关/代理/监控，仅接口约定，不阻塞 scanner-core
└── shared/
    ├── rulepack/      # 风险规则库，以 OWASP LLM/ASI 条目为索引
    └── report/        # 报告格式定义
```
