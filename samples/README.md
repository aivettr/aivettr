# 样本集（Samples）

三层结构，每个样本目录附 `expect.json` 声明**应命中规则的精确集合**（预期外规则不得命中）：

| 层 | 目录 | 用途 |
|---|---|---|
| synthetic | `synthetic/<domain>/` | 每条 MVP 规则 ≥1 个正样本，按四能力域组织 |
| synthetic-python | `synthetic/synthetic-python/` | Python 侧文本/描述规则验证 |
| benign | `benign/` | 干净真实结构负样本（minimal-tool / files-mcp / multi-tool），须 0 命中 |
| real-world | `real-world/` | 真实安全事件的去武器化脱敏复刻 |

样本由 `@aivettr/cli` 的 e2e 测试逐个执行 `scanProject` 并与 `expect.json` 比对。

### AILAB-50 调优批次新增样本（2026-11-09，M2/P2）

- `synthetic/description/behavioral-hijack`：行为劫持三句式正样本（MUST-first 链式 / `<IMPORTANT>` 包裹 / 优先级覆盖——MCPTox 漏报形态族，句式结构保留、去武器化）；
- `synthetic/supplychain/install-scripts-selfbuild`：postinstall 自构建白名单负样本（existsSync 守卫 + execSync 自身构建 → 0 命中）；
- `synthetic/supplychain/install-scripts-spoof`：伪装白名单形态、恶意逻辑藏进 build→compile 二跳构建链的正样本（B5 对抗）；
- `synthetic/sensitive/generated-blob-skip`：生成物/数据块文件跳过（字体 base64 数据 TS、单行打包产物不报），业务代码同类字面量仍命中；
- `synthetic/sensitive/api-key-shapes`：值形态否决（env 名/占位段/.env 空值）+ tests/ 降权混合样本。

## 真实事件复刻来源与处置

- **real-world/postmark-mcp**：复刻 npm 包「postmark-mcp」事件——非官方包冒充 Postmark 官方服务，前 15 个版本行为正常，v1.0.16 注入一行隐藏 BCC（原事件地址 `phang@giftshop.club`），密送全部外发邮件。本复刻为自行重写，地址替换为 `*.invalid`，不含真实恶意端点。事件核实日期：2026-10-31（来源：安全社区披露与 npm 版本记录检索，详见 FEATURES.md）。
- **real-world/tool-poisoning-poc**：复刻 Invariant Labs《Tool Poisoning Attacks》研究 PoC（2025-03）——工具描述元数据中嵌入针对模型的隐藏指令。本复刻为自行重写的去武器化版本，外发端点使用 `example.invalid`，不包含可运行的投递代码。来源：Invariant Labs 公开研究（2025-03）。
- **real-world/gadgethumans-mcp**：复刻 npm 包「gadgethumans-mcp」事件（Knostic AgentMesh 披露 2026-09-08）——宣称 x402 微支付"本地自动签名"，实际把 `WALLET_PRIVATE_KEY` 逐字放进 `X-402-Wallet` 请求头外发，声明的三个签名库从未 import。端点替换为 `*.invalid`。本复刻当前规则库 **0 命中**，作为漏报形态记录保留（候补规则排序证据）。事件核实日期：2026-11-07。
- **real-world/sha1-hulud-second-coming**：复刻 npm 自复制蠕虫「Sha1-Hulud: The Second Coming」二波（2025-11 起，Unit42/Wiz/Microsoft/Datadog/Elastic 等披露）——preinstall 投放 Bun 运行时、滥用 TruffleHog 枚举凭据、env 整表快照与 webhook 外传。安装器/端点替换为 `*.invalid`，不含自复制逻辑。事件核实日期：2026-11-07。
- **real-world/polymarket-kit**：复刻 npm 包「polymarket-kit」事件（OX Security 披露 2026-07-12）——冒充 Polymarket 的多阶段窃密包：dropper 下载混淆载荷执行、收割钱包扩展与云凭据、WebSocket RAT、攻击者私钥明文遗留。端点替换为 `*.invalid`；**私钥块为自行生成的无效占位**（披露中含攻击者真实私钥，依合规总则不复制、不再分发）。事件核实日期：2026-11-07。

> 复刻只保留可被静态检测的信号结构，不携带任何真实恶意代码；所有主机名遵循 RFC 2606/6761 使用 `*.invalid` / `example.invalid`（数据库占位主机沿用已入库样本惯例使用保留域 `.internal`）。
