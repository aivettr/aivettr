# leaked-credentials-repo（真实事件形态去武器化复刻·泄露类复合样本）

## 来源（泄露类形态的事件依据）

本复刻聚合「凭据入库泄露」这一真实、高发的事件类形态（非恶意软件投毒，而是事故型泄露）：

- **Toyota T-Connect**（2022-10 披露）：开发分包商把源码发布到公开 GitHub，内含硬编码云访问密钥，公开近 **5 年**无人发现，约 **29.6 万**客户信息受影响（GitGuardian / BleepingComputer / SecurityWeek）；
- **Unit 42 .env 勒索运动**（2024）：至少 **11 万个域** 的暴露 `.env` 文件被批量利用实施云账户勒索（Palo Alto Networks）；
- **学术/行业研究系**：NDSS 2019《How Bad Can It Git?》（首个大规模 GitHub 秘密泄露纵向分析）、Truffle Security 2026（2.24 亿仓库中 **54.3 万** 仍有效凭据）、Intruder 2026（2.8 万暴露 .git 仓库含 DB 凭据/支付数据/人事文件）。

事件核实日期：2026-11-10。

## 复刻处置

- 形态：内部数据服务仓库（含 MCP server 的 `.env` 配置 + 客户数据导出脚本）把凭据一并提交入库；
- **全部值均为公开文档示例值或自生成占位**：AWS 密钥为 AWS 官方文档示例值（`AKIAIOSFODNN7EXAMPLE`）、卡号为 Visa 官方标准测试卡号（`4111 1111 1111 1111`）、API key/连接串密码为自生成随机串——不含任何真实凭据。

## 预期命中

- `sensitive/dotenv-committed`（`.env` 凭据文件入库）；
- `sensitive/hardcoded-secret`（硬编码 AWS 访问密钥格式）；
- `sensitive/connection-string`（带凭据数据库连接串，`.env` 与源码两处）；
- `sensitive/api-key-assignment`（泛化 API key 字面量赋值）；
- `sensitive/credit-card-number`（Luhn 有效卡号字面量）；
- `permission/process-execution`（导出脚本调用外部命令）。
