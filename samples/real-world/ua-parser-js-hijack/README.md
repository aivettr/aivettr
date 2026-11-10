# ua-parser-js-hijack（真实事件去武器化复刻）

## 来源

npm 包 **ua-parser-js** 供应链劫持事件（2021-10-22，CISA 通报，CVE-2021-4229 / GHSA-pjwm-rvh2-c87w）：维护者 npm 账号被劫持，约 4 小时内发布的 **0.7.29 / 0.8.0 / 1.0.0** 三个版本（周下载 700 万+）携带混淆载荷——**CoinImp 门罗币浏览器挖矿脚本** + 针对Windows/Linux 的**密码窃取二进制投放**。官方修复版本为 0.7.28 / 0.7.30 / 0.8.1 / 1.0.2。

披露来源：CISA 官方通报、FortiGuard 技术分析（挖矿与 infostealer 投放链）、Rapid7、Tenable、GHSA 安全公告。事件核实日期：2026-11-10。

## 复刻处置（MCP 形态映射说明）

原事件为普通 npm 库被劫持；本复刻把「发布账号被劫持 → 主文件携带混淆加载器」这一供应链劫持形态**映射为被劫持的 MCP server 包**（与本项目扫描对象一致，Sha1-Hulud 系列亦实证 MCP 包是此类劫持的现实目标）。只保留静态信号：

1. hex 转义聚集字符串（隐藏载荷端点，解码后为 `cdn.coinimp.example.invalid`）；
2. 超长 base64 字面量（内嵌挖矿配置块，**自生成随机占位**，非任何真实载荷）；
3. 远程载荷下载落地执行（二进制投放形态）。

端点替换为 `*.invalid`；不含真实载荷、矿池与凭据。

## 预期命中

- `supplychain/obfuscated-code`（hex 转义聚集 + 超长 base64 字面量——本复刻的核心目标）；
- `permission/network-egress`（字面量载荷端点下载）；
- `permission/process-execution`（下载产物落地执行）。
