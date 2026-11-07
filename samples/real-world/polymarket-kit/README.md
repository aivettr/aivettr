# polymarket-kit（真实事件去武器化复刻）

## 来源

npm 包 `polymarket-kit`（所有版本均受影响）——冒充 Polymarket 预测市场的多阶段恶意包，披露形态：

1. **攻击者私钥明文遗留**：威胁行为者把自己的 GitLab OPENSSH 私钥与公钥明文留在包内（「malware-slop」——低质恶意软件自泄 C2）；
2. **多阶段 dropper**：联系伪装成图片站点的 `svganchordev[.]net`，下载混淆载荷并执行，同一服务器后续充当外传 C2；
3. **收割范围**：7 款浏览器钱包扩展（MetaMask / Phantom / TronLink / Coinbase Wallet / OKX Wallet / Trust Wallet / Rabby）的本地数据库、桌面钱包（Exodus / Guarda / Electrum / Atomic）、云厂商（Google Cloud / AWS / Azure）配置与 token；
4. **WebSocket RAT**：与 C2 保持常驻连接，远程下发任意命令执行（"exec"）。

披露：OX Security 研究团队《Malware-Slop: Crypto Stealer Impersonating Polymarket Exposes Its Own Credentials》（Moshe Siman Tov Bustan，2026-07-12）；同族 `polymarket-*` / `clob-*` / `kelly-*` 变体此前由 StepSecurity 与 Panther Labs 标记。事件核实日期：2026-11-07。

## 复刻处置

- 自行重写，只保留静态信号：dropper「下载即 eval」、WebSocket RAT 命令执行、私钥 PEM 块、收割目标路径形态；
- **私钥块为自行生成的无效占位**（内容为可读占位符文本的 base64，无法解析为任何密钥）——披露中包含攻击者真实私钥，复刻依合规总则不复制原文、不再分发；
- 端点替换为 `*.svganchordev.invalid`（RFC 2606/6761 保留域）；不复制原包任何文件。

## 预期命中

- `sensitive/private-key-block`（PEM 私钥块——本事件即"攻击者自泄"形态）；
- `permission/network-egress`（dropper 字面量端点下载）；
- `supplychain/dynamic-code-exec`（`eval` 执行下载内容）；
- `permission/process-execution`（RAT 远程命令执行入口）。

附注：包名冒充 Polymarket 的**品牌仿冒**信号（typosquat/impersonation）属暂缓候补规则 #6「brand-mimicry」，当前规则库不检测——本样本是该缺口的又一 real-world 实例（postmark-mcp 事件同一形态）。
