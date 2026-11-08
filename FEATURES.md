# 功能开发记录（FEATURES）

> 每个功能开发前先按下方格式写入记录，再按规格执行开发。

## MCP Server 静态检测扫描器（MVP）

- **立项日期**：2026-10-31（规格经 Issue AILAB-44 逐项确认，8 项决策全部锁定）
- **状态**：✅ 已完成（2026-11-01，Issue AILAB-45：7 个里程碑全部交付，100 个测试全绿，8 条验收标准逐项达成，详见交付评论）

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

## MCP Server 运行时防护（阶段 3 · Node.js 一期）

- **立项日期**：2026-11-08（规划骨架 Multica AILAB-48；7 项边界经 2026-11-07 用户逐项回复 → 2026-11-08 agent 逐项分析与推荐方案 → 用户同日确认全部锁定）
- **状态**：待开发（开发 Issue 另立、排期待用户批准启动）
- **定位**：防御纵深第二层——静态扫描=装前把关（已交付 MVP），运行时=装后行为兜底。只观测/拦截**被测工具在本机的行为**，不做攻击/渗透能力（AILAB-45 验收定调沿用）。

### 需求细节

- **用户场景**：开发者在启用一个 MCP server 后，需要知道它在运行期是否做了危险行为——意外外联、敏感文件写、意外子进程、环境变量整表外带；静态扫描命中的 findings 可作为运行时策略的输入。
- **目标**：提供 `aivettr guard` 观察式运行时防护：包裹启动被测 server、记录行为事件、落日志、出报告；拦截阻断留给商业闭源版。
- **边界**：一期仅覆盖 Node.js 实现的 MCP server；不做 OS 级观测、不做 enforce、不做远程聚合（均列入后续演进，见⑧）。

### 功能规格

**① 产品形态与集成**

- 主形态 = **CLI 子命令 `aivettr guard`**；实现代码放 `packages/runtime`（保持 `private: true`，不单独发布 npm 包），由 CLI 引入；用户唯一入口是 `aivettr`。未来若出现宿主进程内嵌需求，再考虑公开 `@aivettr/runtime`（包边界现成，仅发布时机问题）。
- 集成方式：`aivettr guard -- <MCP server 启动命令>` **包裹式启动**——guard 为父进程拉起 server，经 Node preload（`NODE_OPTIONS=-r` / `--import`）注入探针，可递归覆盖 Node 子进程树。
- 诚实披露：进程内探针只覆盖 Node 进程树，看不到系统级其他进程，也看不到非 Node server（README/报告声明）。
- 占位接口 `RuntimeHook.onToolCall`（网关形态预留）由本形态替换演进；铁律不变：**runtime 可整体裁撤、scanner-core 不得依赖 runtime**。

**② 监测面与实现顺序**

| 顺序 | 监测面 | 实现要点 |
|---|---|---|
| 1 | 网络外联 | hook `http`/`https`/`net`/`fetch`(undici)/`dns`；噪音低、独立检出价值最高（意外外联与 env 外带的终点） |
| 2 | 子进程 | hook `child_process.spawn/exec/execFile/fork` 单一入口；噪音极低；对应 RCE/持久化（ASI 域） |
| 3 | 环境变量（出口关联式） | **不做 env 读取 hook**（Proxy 追踪脆弱、读配置噪音大）：启动时快照 `process.env`，在外联出口做 payload 关联，命中记键名与数量、不记值；独立"env 整表读取"事件后置二期候选 |
| 4 | 文件写 | hook fs 写类 API + 敏感路径过滤（`~/.ssh`、`~/.aws`、shell rc、凭据文件）；噪音最高放最后，靠路径过滤+白名单收敛 |

**③ 平台范围与语言边界**

- 平台：macOS / Windows / Linux **一期全覆盖**（进程内纯 JS，零平台差异成本）。
- 语言：**本版本仅支持 Node.js** 实现的 MCP server（含 preload 递归覆盖的 Node 子进程）。
- **Python 及其他语言能力规划**（本期不实现，方向已定、立项另议）：候选方向为独立 sidecar 探针（进程隔离、经 adapter 接口调用，与 ARCHITECTURE 的 Python sidecar 先例一致）；CPython 3.8+ `sys.addaudithook`（覆盖 socket.connect / subprocess.Popen / open 等 audit 事件）为候选技术路径【技术判断，立项时核实】。

**④ 策略模型**

- 开源版：默认且仅 **observe**（观察记录落日志）；策略引擎只提供 observe 模式。
- 商业闭源版：**enforce**（拦截阻断），经 license gate 解锁；此为产品/策略层边界而非技术保密（进程内观测与拦截共用同一批 hook 点，已向用户说透）。
- 静态 findings → 运行时策略：一期以白名单/黑名单配置手工承接；自动转化（如静态命中端点生成监视清单）列为后续演进。

**⑤ 性能与误报预算**（设计目标，需基准测试验证）

- 单事件 hook 同步路径 ≤1ms：热路径（fs 写）用预编译匹配器快路径过滤，重活全部异步。
- 事件异步批量 flush（每 1s 或 512 条）；环形缓冲有上限（1 万条 / 8MB 量级），溢出丢弃**计数并如实进汇总**，不静默。
- server 启动附加开销 ≤50ms；典型 MCP 负载 CPU 开销 ≤5%。
- **可用性红线**：探针任何异常不得影响被守护 server——全部 hook 包 try/catch，故障降级为停用+计数；观察模式绝不阻塞业务。
- 白名单两层：**内置基线白名单**（版本化随包：常见合法域名/临时缓存目录/良性命令模式）+ **用户白名单**（扩展 `.aivettr.json`，复用「CLI 选项 > 配置文件 > 内置默认」既有优先级机制）。
- 量化目标【草案、待校准】：AILAB-47 方案 C 良性样本集上，未经白名单即触发 high 及以上事件的服务器比例 <10%，数据出来后回填。

**⑥ 数据与告警**

- 事件使用**独立 `eventSchemaVersion`**（首版 1.0），与扫描报告 `schemaVersion`（现 1.0）并列为同族 schema，互不顶撞；报告格式版本主导权仍在 scanner-core。
- 事件字段：eventId / ts / pid / serverId / type(network、process、file、env) / severity / subject(域名·路径·命令行) / verdict(observe、block) / ruleId / owaspRefs。
- **隐私红线**：事件永不记录 env 值与 payload 正文，只记键名与命中数量——安全工具自己不能成为泄露源。
- 三种运行方式：**CI** = smoke 模式（`aivettr guard --smoke -- <cmd>` 短暂拉起观察启动期行为，观察模式默认永不 fail）；**本地** = 终端人读输出（复用扫描器 text 渲染风格）+ `--output` 落 JSON；**常驻** = JSONL 日志滚动 + 停机汇总。
- 统一报告：runtime 事件独立 section 进四格式渲染体系（先 text/json；SARIF / Markdown 后续）；远程聚合与告警推送属商业侧。

**⑦ Open Core 边界**

- **开源侧（AGPL-3.0，本公开仓库）**：探针层（net/http/fetch/child_process/fs hook + env 快照）；事件 schema + JSONL observe 管道；基础策略引擎（observe + 内置基线白名单 + 用户白名单）；`aivettr guard` 子命令；报告渲染；内置检测基线（随 rulepack 分发）。
- **商业闭源侧（独立私有仓库，经插件接口 + license gate 接入）**：enforce 拦截；OS 级观测/执法（eBPF / macOS Endpoint Security / Windows ETW，纵深第二层）；企业集中管理（远程策略、白名单集中管理、多机事件聚合告警）；合规报告增强；规则订阅服务；非 Node 运行时 sidecar（立项时定归属）。
- **结构性约束**：公开仓库内不出现闭源代码；商业模块放独立私有仓库，插件加载点与 license 校验位置在开发 Issue 首个结构决策中确定。

**⑧ 后续演进（一期不实现，方向已规划）**

1. Python 及其他语言运行时探针（sidecar + `sys.addaudithook` 候选路径，立项另议）。
2. OS 级观测/执法（商业纵深第二层）。
3. enforce 拦截模式（商业 license gate）。
4. 静态 findings 自动转运行时策略（端点/路径监视清单）。
5. 独立 env 整表读取事件；`--baseline` 学习模式（生成白名单草案）；SARIF / Markdown 的 runtime 渲染；远程聚合告警（商业）。

### 验收标准（草案，开发 Issue 立项时细化锁定）

1. `aivettr guard -- <cmd>` 可包裹启动 Node MCP server，四监测面事件按 eventSchemaVersion 1.0 记录（env 以出口关联形态呈现）。
2. 观察模式不影响 server 正常功能；含「探针异常降级」场景测试（不 crash、降级计数可见）。
3. 白名单两层生效；误报样本可复现、可经白名单消除。
4. CI smoke / 本地 / 常驻 JSONL 三形态可用；观察模式退出码不因命中而 fail。
5. 性能基准测试守护：启动附加 ≤50ms、单事件快路径 ≤1ms、缓冲溢出计数如实呈现（CPU ≤5% 为设计目标，出基准报告）。
6. eventSchemaVersion 1.0 快照测试；隐私红线测试（事件输出不含 env 值与 payload 正文）。
7. 可裁撤铁律：scanner-core 零依赖 runtime（架构测试守护）；裁撤 runtime 不影响扫描任何功能。
8. dogfood：guard 守护自身扫描器运行并出报告。

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
