# @aivettr/cli

`aivettr` 命令行入口（`npx aivettr scan ...`）。组合 scanner-core + rulepack + report，产品形态为 **CLI + CI 集成**（CI 是 CLI 的薄包装，可裁撤）。

## severity 语义与 fail-on 选择指南（AILAB-50 调优后口径，2026-11-09）

### 信号分两类

| 类型 | 含义 | 当前规则 | 默认 severity |
|---|---|---|---|
| **内容判定型** | 声称"发现了敏感/危险内容"——命中即值得逐条核对 | hardcoded-secret、private-key-block、connection-string、api-key-assignment、dotenv-committed、credit-card-number、hardcoded-bcc、env-dump、install-scripts、shell-pipeline-in-scripts、remote-dependency、description/* 五条、obfuscated-code | critical / high / medium |
| **能力披露型** | 声明"该 MCP server 具备某能力"——命中属实，但绝大多数为合法用途，供人工审阅外联面 | process-execution、network-egress、dynamic-code-exec、shell-option、tls-verification-disabled、fs-sensitive-path、unbounded-loop | low |

> 能力披露型于 2026-11-09 依官方生态 51 仓库实测数据降级（此前为 medium/high）。恶意判定不应依赖单一能力信号，而应看组合形态（能力 × 敏感数据流），如"读取环境变量 + 外发 POST"。

### 影响范围（实测基线，2026-11-08）

官方 MCP Registry 抽样 51 个真实 MCP server 仓库的实测：

- **默认 `--fail-on low` 下约 27% 的仓库会有命中而 CI fail**——主要由内容判定型误报（已在本轮调优中压降）与能力披露型信号（保留为 low）构成；
- 对真实 MCP server（本职就是调 API、起子进程）出现能力披露命中是**预期行为**，不代表恶意。

### fail-on 选择建议

| 场景 | 建议 | 理由 |
|---|---|---|
| 新引入第三方 MCP server 的入库审查 | `--fail-on medium`（默认值之一） | 内容判定型从 medium 起步；能力披露型（low）不阻塞，报告仍会列出供审阅 |
| 自己的仓库 CI 门禁（熟悉代码） | `--fail-on high` 或 `critical` | 只对"确证的凭据泄露/恶意形态"阻断 |
| 安全审计 / 事件排查 | `--fail-on low`（全量） | 需要完整外联面披露，人工逐条核对 |
| 本地开发随扫 | `--fail-on medium` | 平衡噪声与覆盖 |

### 评定条件速查

- **critical**：私钥块、平台凭据格式（AWS/GitHub/npm Token）——轮换凭据并核查历史；
- **high**：BCC 密送、远程依赖来源、提示注入/外传指令、密集混淆痕迹——逐条人工核对；
- **medium**：泛化凭据赋值、带凭据连接串、.env 入库、卡号——核对是否真实凭据；
- **low**：能力披露（子进程/网络出站/动态加载/shell/TLS 关闭写路径/无界循环/敏感路径写）——审阅外联面，不构成恶意证据。
