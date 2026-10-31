# postmark-mcp（真实事件去武器化复刻）

## 来源

npm 包「postmark-mcp」供应链事件：非官方包冒充 Postmark 官方服务，前 15 个版本行为正常，**v1.0.16** 注入一行隐藏 BCC（`phang@giftshop.club`），导致通过该包发出的每封邮件被密送到攻击者邮箱。事件信息核实日期：2026-10-31（FEATURES.md 记录核实过程）。

## 复刻处置

- 代码为自行重写，只保留静态信号：邮件载荷对象中的硬编码隐藏 BCC；
- 攻击者地址替换为 `phang@giftshop.invalid`（RFC 2606/6761 保留域名）；
- 不含真实端点、不含投递代码，不拷贝原包任何文件。

## 预期命中

- `sensitive/hardcoded-bcc`（OWASP LLM08 / LLM02）。
