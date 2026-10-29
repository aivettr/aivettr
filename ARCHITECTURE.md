# 架构俯视文档（ARCHITECTURE）

> 状态：初始化阶段 —— 架构尚未定型，本文档先记录**已确定的约束**与**待定决策**，随确认进度实时更新。

## 1. 项目定位（已确认的部分）

- **领域**：AI 安全（AI Security）
- **方向**：MCP / Skill 检测 + 运行时安全（runtime security）
- **风险框架基础**：OWASP GenAI/LLM Top 10 2026（本仓库 PDF，CC BY-SA 4.0）+ OWASP Agentic Top 10（ASI）2026
- **商业模式**：先开源，未来转商业化（→ 架构需预留 Open Core 边界）

## 2. 风险框架 → 能力域映射（依据 OWASP 2026 原文）

| 能力域（暂名） | 对应风险条目 | 检测/防护对象 |
|---|---|---|
| 供应链检测 | LLM04 Supply Chain、ASI04 | MCP server 包、Skill/插件包、tool description 隐藏指令、模型工件 |
| 注入检测 | LLM01 Prompt Injection、ASI01 | 工具描述投毒、间接注入（issue/ticket/RAG 等通道）、跨模态注入 |
| 权限与自治审查 | LLM03 Excessive Agency、ASI02/03 | 工具最小化、过度权限、过度自治、高敏操作确认 |
| 运行时监控与防护 | LLM06/LLM08/LLM10、ASI05/08/09 | 资源消耗、上下文泄露、输出处理、级联失败、RCE 防护 |

> 上述映射仅划定能力域；MVP 先做哪个能力域 **待确认**。

## 3. 技术选型

**全部待定**（依赖 MVP 方向确认），候选维度：

| 维度 | 待定项 | 备注 |
|---|---|---|
| 主语言 | Python / TypeScript / Rust / Go | 检测工具类项目常见 Python/Rust；运行时代理类常见 TS/Go/Rust |
| 检测引擎 | 纯规则 / 静态分析 / LLM 辅助 / 混合 | LLM 辅助检测自身也受 LLM01/LLM07 约束 |
| 运行时形态 | MCP Gateway/Proxy / SDK Hook / eBPF 主机级 / 混合 | 决定部署侵入性 |
| 仓库结构 | Monorepo / 多仓 | 受 Open Core 边界影响 |

## 4. 已识别的架构约束

1. **开源→商业路径**：许可证选择（Apache-2.0 / MIT / AGPL-3.0 / 双许可）与开源/商业模块边界必须**在编码开始前**确定，避免后期拆仓成本。
2. **标准对齐**：检测规则库应以 OWASP LLM Top 10 2026 / ASI 2026 条目为可追溯索引（报告可映射到标准条目）。
3. **不信任检测引擎自身**：若检测引擎使用 LLM，其本身即是 LLM 应用，需满足自身安全基线（自食其狗粮）。

## 5. 模块边界

待 MVP 方向确认后绘制。
