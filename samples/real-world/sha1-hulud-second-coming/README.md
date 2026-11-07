# sha1-hulud-second-coming（真实事件去武器化复刻）

## 来源

npm 自复制蠕虫**「Sha1-Hulud: The Second Coming」**（Shai-Hulud 2.0，2025-11-24 起扩散，波及 Zapier / Postman / PostHog / ENS Domains / asyncapi 等维护者，700+ 包受影响、约 2.5 万 GitHub 仓库被建为外传仓库）。已披露形态：

1. 经 **`preinstall`** 钩子执行 `setup_bun.js`，下载 **Bun 运行时**并在其中跑载荷（绕过 Node 侧分析；源波为 postinstall，二波前移到 preinstall）；
2. **滥用 TruffleHog**（合法 secrets 扫描工具）枚举本机与 CI 凭据（GitHub/npm token、云密钥）；
3. 环境变量整表快照（`environment.json` / `data.json`，base64 编码）；
4. 一波经 webhook POST 外传；二波改为**用窃取凭据把数据推到攻击者可访问的公开 GitHub 仓库**，仓库描述统一为「Sha1-Hulud: The Second Coming」（成为战役签名 IOC），并用窃取 npm token 向受害者维护的所有包回注自身实现自复制。

披露来源：Unit 42（Palo Alto Networks）、Wiz、Microsoft（2025-12-09 检测指引）、Datadog Security Labs、Elastic、Zscaler ThreatLabz、Trend Micro、GitLab、StepSecurity。事件核实日期：2026-11-07。

## 复刻处置

- 自行重写，只保留四个静态信号步骤（投放 / 滥用扫描工具 / env 整表快照 / webhook POST + 落盘）；不含自复制、不含真实凭据；
- 安装器与 webhook 端点替换为 `*.invalid`；文件名沿用披露 IOC 名（`setup_bun.js` / `bun_environment.js`），仅为静态信号载体；
- 附注：针对 AI 助手配置文件（`~/.claude.json`、`claude/mcp.json`、`~/.kiro/settings/mcp.json`）的收割与 `.claude/settings.json` 持久化属于后续「Mini Shai-Hulud / TeamPCP」变体（2026-05 起），与本复刻分属不同战役，留待下批独立复刻。

## 预期命中

- `supplychain/install-scripts`（`preinstall` 安装期执行任意脚本——蠕虫的入口形态）；
- `permission/process-execution`（Bun 投放的 curl 下载执行、TruffleHog 滥用）；
- `sensitive/env-dump`（`JSON.stringify(process.env)` 整表进载荷）；
- `permission/network-egress`（字面量 webhook POST）。
