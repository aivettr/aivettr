# mini-shai-hulud-pcp（真实事件去武器化复刻）

## 来源

npm/PyPI 自复制蠕虫 **Mini Shai-Hulud**（TeamPCP 组织，Shai-Hulud 后继），2026-04-29 首波（SAP CAP/mbt 包）→ 2026-05-10 二波（TanStack 42 包 84 产物、Mistral AI 等 170+，后增至 314）→ 2026-06-01 三波。与本扫描器最相关的披露形态：

1. **AI 编码助手配置收割**：窃取 `.claude.json`、`claude/mcp.json`、`.kiro/settings/mcp.json`、IDE 工作区设置中的 MCP server 配置与 AI 供应商 API key；
2. **AI 助手持久化**：篡改 `.claude/settings.json` 注入恶意 hooks；「蠕虫进入 MCP」——把自身注入客户端 MCP 配置；
3. **Bun 运行时走私**：安装期脚本下载混淆 Bun 运行时并在其中执行载荷，绕过 Node 侧分析；
4. 自复制 + CI/CD 劫持（GitHub Actions 注入、OIDC 滥用、缓存投毒）。

披露来源：StepSecurity（两篇）、Upwind（SAP 波 + 多向量拆解）、Akamai、Semgrep（Children of Shai-Hulud）、CSA Labs、Expel、Snyk、Tanium、Mend、OX Security。事件核实日期：2026-11-10。

## 复刻处置

- 自行重写，只保留静态信号：postinstall 安装期执行任意脚本、Bun 投放的下载管道执行、四路 AI 配置文件读取、`mcp.json` 注入写入、`.claude/settings.json` hooks 写入、webhook 外传；
- 端点替换为 `*.invalid`；不含自复制、CI 注入与真实载荷。

## 预期命中

- `supplychain/install-scripts`（postinstall 执行任意脚本，非自构建形态不豁免）；
- `permission/process-execution`（Bun 投放的 curl 管道执行）；
- `permission/fs-sensitive-path`（`mcp.json` 注入写入）；
- `permission/network-egress`（字面量 webhook POST）。

## 覆盖缺口记录（真实事件附带，候选增补交后续批次评估）

`.claude/settings.json` 持久化写入与 `.claude.json` 读取是本事件的核心手法，但现行 `fs-sensitive-path` 标记表**不含 `.claude` 目录**（含 `.cursor`、`mcp.json` 等）——两条路径本复刻未触发该规则，属真实事件支撑的标记表增补候选，不提前实现。
