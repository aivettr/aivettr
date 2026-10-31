# 功能开发记录（FEATURES）

> 每个功能开发前先按下方格式写入记录，再按规格执行开发。

## MCP Server 静态检测扫描器（MVP）

- **立项日期**：2026-10-31（规格经 Issue AILAB-44 逐项确认，8 项决策全部锁定）
- **状态**：待开发（开发实现作为下一阶段另行开工）

### 需求细节

- **用户场景**：开发者在本地或 CI 中对一个 MCP Server 项目做静态安全审计，在安装/启用/发布前发现四类风险——描述投毒、包供应链、过度权限、敏感信息与消耗滥用。
- **目标**：提供确定性、可离线、结果可复现的 CLI 扫描器，并有可裁撤的 GitHub Action 薄包装。
- **扫描对象边界**：MVP 仅 MCP Server；Skill / 通用工具描述经 scanner-core adapter 后续扩展。
- **规则范围**：四个能力域首版全做——描述投毒（LLM01）/ 包供应链（LLM04）/ 过度权限（LLM03）/ 敏感信息暴露与消耗（LLM08/LLM06）。
- **贯穿性原则**：①可裁撤性——CI action 可独立删除、runtime 仅占位不被依赖，随时可退回「仅 CLI 的纯静态扫描器」；②诚实披露能力边界——README/报告页脚显式声明检测不到的维度（注册表信誉、动态行为、混淆变体、非 JS 语言深语义）。

### 功能规格

**① 扫描输入形态**

- MVP 仅支持**本地路径**：`aivettr scan <path>`，扫描项目源码与清单；不递归扫 `node_modules`/依赖树。
- 远程 npm 包名、MCP 客户端配置盘点作为后续 adapter 迭代（本地路径是远程包解包后的后半段，不返工）。

**② CLI 命令契约**

- 命令：`aivettr scan <path> [options]`，显式 `scan` 子命令（为后续 audit/inventory/update-rules 留位）。
- 选项：`--format <text|json|sarif|markdown>`、`--fail-on <low|medium|high|critical>`（CLI 默认 `low`，任何命中即非零，fail-closed）、`--config <path>`、`--enable-rule/--disable-rule <id...>`、`--ignore <glob...>`、`--output <file>`、`--quiet`、`--no-color`。
- 退出码：`0` 干净（或命中低于阈值）；`1` 命中达到阈值；`2` 扫描器自身错误（路径不存在/配置非法/规则加载失败，详情走 stderr）。
- 配置文件：自动发现 **`.aivettr.json`**（从目标路径向上查找），MVP 仅 JSON；字段 `failOn`/`format`/`ignore[]`/`rules{}`；优先级 CLI 选项 > 配置文件 > 内置默认。

**③ 规则机制**

- **混合制**：声明式 YAML 规则（匹配原语 MVP：正则、文件 glob、manifest 字段条件、工具描述文本条件）+ 代码规则（TS 实现统一 `Rule` 接口：`id` / `meta{title,description?,severity,owasp[]}` / `check(ctx): Finding[]`）。
- 规则 ID 按能力域前缀分组：`description/*`、`supplychain/*`、`permission/*`、`sensitive/*`；OWASP 编号不进 ID，经 meta 多对多映射。
- 严重级别四级：`low / medium / high / critical`，支持配置覆盖。
- 分发：MVP 内置 `@aivettr/rulepack` 随 CLI 发布；支持本地自定义声明式规则目录 `.aivettr/rules/*.yaml`；远程 rulepack 更新/签名信任链不进 MVP（pack 结构按可独立分发设计）。用户侧不支持自定义代码规则。

**④ 检测引擎**

- **确定性静态引擎**：文件采集 → 语言/类型 adapter → 信号提取（文本/正则、manifest 解析、JS/TS AST 经 typescript 编译器 API）→ 规则判定 → 报告。
- 纯静态零执行：不安装依赖、不运行被测代码。
- 深度有界：语法级 + 文件内简单语义（危险调用 `child_process/eval/Function/fetch`、字符串字面量、包内导入解析）；不做跨过程污点分析/调用图/符号执行。
- 非 JS/TS 语言 MVP 退化为文本/正则规则；Python sidecar 后续按需引入。
- **LLM 不进 MVP**：仅预留 analyzer 扩展接口；未来为用户显式 opt-in、advisory-only（不阻断 CI）、不默认外传代码，作为商业侧候选能力。

**⑤ 输出与报告**

- 四种格式，由 `@aivettr/report` 基于统一 ScanResult 模型渲染：
  - **text**（默认）：按严重级分组，含 file:line:col、代码片段，末尾汇总；非 TTY 自动关色。
  - **JSON**：顶层 `schemaVersion`（首版 1.0），1.x 只增字段不破坏，破坏性变更走 2.0。
  - **SARIF 2.1.0**：规则含 `security-severity` 与 `owasp:LLMxx` tag，定位精确行列。
  - **Markdown**（`--format markdown|md`，默认文件名 `aivettr-report.md`）：五段式——结论横幅 / 扫描元信息表 / 严重级别汇总 / 按 severity 分组详情 / 页脚；干净报告保留元信息作为合规证据；命中 >20 条自动生成目录；**防 Markdown 注入**（动态文本纯文本转义、动态围栏代码块、禁原始 HTML）。
- stdout 仅出报告；进度与诊断走 stderr。

**⑥ CI action（`ci-action/`）**

- CLI 薄包装，node20 + `@vercel/ncc` 单文件打包；随 monorepo tag 分发，不单独建仓。
- inputs：`targets`（必填，本地路径，空格/换行分隔多目标）、`fail-on`（**Action 默认 high**，与 CLI 默认 low 区分）、`format`、`config`、`ignore`、`enable-rules`/`disable-rules`、`output-file`、`upload-sarif`（默认 true）、`upload-artifact`（默认 false）、`annotation-level`、`working-directory`。
- 退出码映射：0 成功 / 1 安全失败 / 2 工具错误（日志明确区分两类失败）。
- PR 经 `@actions/core` 输出三档 annotations（notice/warning/failure，由内部 JSON 生成，不解析 text）；SARIF 经 `github/codeql-action/upload-sarif@v3` 上传，需 `security-events: write`，权限不足降级为警告不崩溃。
- outputs：`total/critical/high/medium/low`、`sarif-id`、`report-path`。

**⑦ 样本集**

- 三层结构（每个样本目录附 `expect.json` 声明应命中规则集合）：
  - `samples/synthetic/`（含 `synthetic-python/`）：每条规则 ≥1 个正样本，按四能力域组织。
  - `samples/benign/`：干净真实结构负样本（minimal-tool / files-mcp / multi-tool）。
  - `samples/real-world/`：真实事件去武器化脱敏复刻（自己重写、不拷贝恶意代码，端点用 `example.invalid`）。
- 真实事件样本（已联网核实，2026-10-31）：
  - **postmark-mcp**（npm）：非官方冒充 Postmark，前 15 版本正常、v1.0.16 注入一行隐藏 BCC（`phang@giftshop.club`）密送全部外发邮件。复刻信号：邮件发送路径硬编码收件人/隐式 cc·bcc 注入（LLM04/LLM08）。
  - **Invariant Labs「Tool Poisoning Attacks」研究 PoC（2025-03）**：工具描述元数据嵌入对模型的隐藏指令。复刻信号：祈使注入句式/隐藏外发指令/伪装字符（LLM01）。
  - 已撤下：shrimple-lang/calc-mcp（多源检索无法证实）；Python 侧其他真实事件（instructor-mcp、Hades campaign）待一手来源核实后补。

**⑧ MVP 边界（不做什么，共 19 条）**

- 输入：远程 npm 包、MCP 配置盘点、Skill/通用模式、node_modules/依赖树递归。
- 引擎：执行代码/动态沙箱、LLM 辅助、跨过程污点分析/调用图、JS/TS 外语言 AST、注册表信誉维度（版本史/下载量/维护者/SLSA/签名）。
- 规则：远程 rulepack 更新/市场/签名链、用户自定义代码规则、可编程配置。
- 运行时：runtime 包实际功能（仅占位）。
- CI：GitHub 以外平台。
- 平台/输出：SaaS/dashboard/团队管理、HTML/PDF、IDE 插件、PR bot、autofix/自动修复。
- 合规/商业：携带真实恶意代码、开源仓库内实现闭源模块。

### 验收标准

**检测能力**

1. 每条 MVP 规则 synthetic 正样本 ≥1，`expect.json` 全部通过（预期外规则不得命中）。
2. benign 样本集 0 命中；争议误报须评审后写入显式白名单并注明理由。
3. real-world 复刻样本：postmark ≥1 条命中（LLM04/LLM08）；tool-poisoning PoC ≥1 条 LLM01；synthetic-python 文本规则 ≥1 条命中。

**工程质量**

4. 确定性：同输入连续两次扫描，除 `scannedAt` 外 JSON 逐字节一致。
5. 性能：500 文件量级冷扫描 ≤10 秒、峰值内存 ≤512MB；超标须出性能报告，不得悄悄放宽。
6. 四格式各有渲染快照测试；SARIF 结构校验；Markdown 注入样本验证转义。
7. CLI 退出码 0/1/2 端到端测试；`--fail-on` 各档验证。
8. 仓库 GitHub Actions CI 全绿；扫描器可扫描自身仓库出报告（dogfood）。

**不承诺**：不对外宣称全口径"检出率 xx%"，只对 curated 样本集负责；不以 LLM 评审作为命中正确性依据。

---

### 功能记录模板

```
## <功能名>
- 需求细节：<用户场景、目标、边界>
- 功能规格：<交互逻辑、状态流转、数据流、异常处理>
- 验收标准：<可验证的完成条件>
- 状态：<待开发 / 开发中 / 已完成>
- 日期：<YYYY-MM-DD>
```
