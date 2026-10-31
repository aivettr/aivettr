# 样本集（Samples）

三层结构，每个样本目录附 `expect.json` 声明**应命中规则的精确集合**（预期外规则不得命中）：

| 层 | 目录 | 用途 |
|---|---|---|
| synthetic | `synthetic/<domain>/` | 每条 MVP 规则 ≥1 个正样本，按四能力域组织 |
| synthetic-python | `synthetic/synthetic-python/` | Python 侧文本/描述规则验证 |
| benign | `benign/` | 干净真实结构负样本（minimal-tool / files-mcp / multi-tool），须 0 命中 |
| real-world | `real-world/` | 真实安全事件的去武器化脱敏复刻 |

样本由 `@aivettr/cli` 的 e2e 测试逐个执行 `scanProject` 并与 `expect.json` 比对。

## 真实事件复刻来源与处置

- **real-world/postmark-mcp**：复刻 npm 包「postmark-mcp」事件——非官方包冒充 Postmark 官方服务，前 15 个版本行为正常，v1.0.16 注入一行隐藏 BCC（原事件地址 `phang@giftshop.club`），密送全部外发邮件。本复刻为自行重写，地址替换为 `*.invalid`，不含真实恶意端点。事件核实日期：2026-10-31（来源：安全社区披露与 npm 版本记录检索，详见 FEATURES.md）。
- **real-world/tool-poisoning-poc**：复刻 Invariant Labs《Tool Poisoning Attacks》研究 PoC（2025-03）——工具描述元数据中嵌入针对模型的隐藏指令。本复刻为自行重写的去武器化版本，外发端点使用 `example.invalid`，不包含可运行的投递代码。来源：Invariant Labs 公开研究（2025-03）。

> 复刻只保留可被静态检测的信号结构，不携带任何真实恶意代码；所有主机名遵循 RFC 2606/6761 使用 `*.invalid` / `example.invalid`。
