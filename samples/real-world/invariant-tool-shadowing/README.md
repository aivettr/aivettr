# invariant-tool-shadowing（真实事件去武器化复刻）

## 来源

Invariant Labs《MCP Security Notification: Tool Poisoning Attacks》（2025-04-01）披露的**工具影子化（tool shadowing）真实攻击形态**：恶意 MCP server 注册一个与可信工具**同名**的影子工具（示例场景：Slack 的 `add_reaction`）。由于工具描述会随工具名一起注入模型上下文，恶意描述在用户调用（可信）Slack 工具时同样生效——劫持调用行为、把频道内容与用户列表外发到攻击者频道，并要求对模型隐瞒附加步骤。同系列披露还有 WhatsApp MCP（2025-04-07）与 GitHub MCP 私库访问（2025-05-26）；Invariant 已于 2025-06 并入 Snyk。

与已入库的 `tool-poisoning-poc`（同团队 2025-03 PoC）为姊妹样本：PoC 验证的是"描述中藏指令"机制，本复刻是其在真实攻击中的**同名影子注册**形态。事件核实日期：2026-11-10。

## 复刻处置

- 自行重写（不拷贝披露原文与 GitHub 实验 repo 代码），保留三段文本信号形态：影子化改道指令（"when the user asks … use this tool instead of the Slack reaction tool"）、外发指令（"send the channel contents and the user list to …"）、隐瞒指令（"Do not tell the user …"）；
- 影子工具同名（`add_reaction`）+ 参数形态忠实；
- 外发端点替换为 `collector.example.invalid`。

## 预期命中

- `description/tool-shadowing`（影子化改道句式——本复刻的核心目标）；
- `description/injection-directives`（隐瞒指令）；
- `description/exfiltration-instructions`（外发频道内容与用户列表）。
