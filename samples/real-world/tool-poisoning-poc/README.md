# tool-poisoning-poc（真实研究 PoC 去武器化复刻）

## 来源

Invariant Labs 研究《Tool Poisoning Attacks》（2025-03）公开 PoC：攻击者在工具描述（tool metadata）中嵌入对模型的隐藏指令——祈使句式覆盖系统提示、对用户隐瞒步骤、指示外发对话内容。

## 复刻处置

- 文本为自行重写，只保留静态信号：注入句式 + 外发指令；
- 外发主机替换为 `collector.example.invalid`（RFC 2606 保留域名）；
- 不包含可运行的收集端或投递代码。

## 预期命中

- `description/injection-directives`（OWASP LLM01）；
- `description/exfiltration-instructions`（OWASP LLM01 / LLM08）。
