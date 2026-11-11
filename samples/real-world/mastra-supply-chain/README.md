# mastra-supply-chain（真实事件去武器化复刻）

## 来源

**Mastra AI npm 供应链攻击**（2026-06，Microsoft 威胁情报，140+ 包协同投毒）：恶意版本 postinstall 载荷设置 **`NODE_TLS_REJECT_UNAUTHORIZED='0'` 关闭 TLS 证书校验**进行 C2 外传（Socket 确认 loader 与二级载荷均含 TLS bypass），窃取凭据、npm token、SSH key 与加密钱包。安装链与家族形态补充依据：

- **Axios npm 攻击**（2026-03，Socket/Huntress/Phoenix Security）：`npm install → sh → node setup.js → curl` 安装链投递 RAT——本复刻的 preinstall curl 管道形态出处；
- **Shai-Hulud 2.0「dead man's switch」**（2025-11，GitLab 披露）：看门狗常驻形态出处；
- **git 依赖滥用面**：JFrog《npm v12: From Implicit to Explicit Trust》（2026-06）披露 npm v12 默认封锁 git/URL 依赖与生命周期脚本（npm 11.10 起 `--allow-git`），TuxCare 研究实证 git/URL 依赖绕过私有 registry 完整性校验——本复刻的 git 依赖形态出处。

事件核实日期：2026-11-10。

## 复刻处置

- 自行重写，只保留静态信号：TLS 校验关闭、preinstall curl 管道、git 来源依赖、shell 模式载荷执行、看门狗常驻循环、C2 外传；
- 端点替换为 `*.invalid`；不含真实载荷、凭据与自复制逻辑。

## 预期命中

- `permission/tls-verification-disabled`（`NODE_TLS_REJECT_UNAUTHORIZED='0'`——披露原文同款形态）；
- `supplychain/shell-pipeline-in-scripts` + `supplychain/install-scripts`（preinstall curl 管道执行远程脚本）；
- `supplychain/remote-dependency`（git 来源依赖）；
- `permission/shell-option` + `permission/process-execution`（shell 模式载荷执行）；
- `sensitive/unbounded-loop`（看门狗常驻）；
- `permission/network-egress`（C2 外传）。
