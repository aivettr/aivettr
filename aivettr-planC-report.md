# AIVettr 方案 C 报告：真实生态误报率测量（首批）

> AILAB-47 阶段 2 · 方案 C · 执行日期 2026-11-08 · 语料来源：官方 MCP Registry（registry.modelcontextprotocol.io）

## 1. 目的与口径

测「真实良性生态」上的分规则误报率——只测检出率会漏掉"狼来了"问题，本项与检出率（方案 B）同等重要。

- **语料**：官方 Registry 中 status=active 且 isLatest、带 GitHub 仓库的服务器条目，字母序确定性抽样 80 个，浅 clone 成功 **51 个**（其余 29 个：registry 陈旧条目指向已删除/转私有仓库 8 个、网络超时 21 个）；
- **方法**：对每个仓库本地静态文件执行 `aivettr scan --format json`（不安装依赖、不执行其代码），全部命中**逐条人工核对**（合法/可疑），可疑再下钻读源码确认；
- **判定口径**：命中内容在良性语料中是否构成真实的安全问题或恶意信号。能力披露类规则（声明存在某能力）与内容判定类规则（声称发现敏感/恶意内容）分开统计。

## 2. 总览

| 指标 | 数值 |
|---|---|
| 扫描仓库数 | 51 |
| 零命中仓库 | 37（72.5%） |
| 有命中仓库 | 14（27.5%，默认 fail-on 阈值下 CI 会 fail） |
| 命中总条数 | 277 |
| 触发规则数 | 13 / 24 |
| 逐条核对：可疑 | **0** |
| 逐条核对：合法（误报） | 277 |

**核心结论：官方生态良性语料上，扫描器当前全部 277 条命中经逐条核对均为合法用途，0 条可疑。**「能力披露」本身全部属实（命中的能力确实存在），但作为恶意信号全部为噪声。这不是扫描器失效——合成与真实事件样本（方案 A）证明恶意形态能响——而是**良性生态的基线噪声 profile**：多数规则的 severity/形态匹配需要按本数据调优，否则在真实用户仓库上约 27% 会直接 CI fail。

## 3. 分规则误报率与噪声密度

| 规则 | 类型 | 命中数 | 合法 | 可疑 | 命中密度（条/仓库） | 根因 |
|---|---|---|---|---|---|---|
| sensitive/api-key-assignment | 内容判定 | 95 | 95 | 0 | 1.86 | 正则把 `process.env.X`/`creds.auth_token` 等 16+ 字符标识符值当字面量；文档/配置/测试占位符占其余 |
| permission/process-execution | 能力披露 | 86 | 86 | 0 | 1.69 | 测试基建 48 + OS 工具链固定参数 38（ssh/keychain/git/gh/npm pack 等） |
| supplychain/obfuscated-code | 内容判定 | 40 | 40 | 0 | 0.78 | base64-decode 调用信号在 x402/支付/媒体解码时代是常规传输编码，非混淆 |
| sensitive/env-dump | 内容判定 | 16 | 16 | 0 | 0.31 | `{...process.env, 覆盖}` 子进程环境传递惯用法（16/16 在测试与脚本） |
| permission/network-egress | 能力披露 | 13 | 13 | 0 | 0.25 | 第一方服务 API 调用——MCP server 的本职工作 |
| supplychain/dynamic-code-exec | 能力披露 | 10 | 10 | 0 | 0.20 | 插件/驱动按名懒加载、测试动态 import |
| permission/shell-option | 能力披露 | 7 | 7 | 0 | 0.14 | 固定参数 npm run build（无注入面） |
| sensitive/hardcoded-secret | 内容判定 | 4 | 4 | 0 | 0.08 | 测试假 token（`eyJ…x.y`、`sat_not_a_real_token` 等占位通过了 JWT/Bearer 正则） |
| sensitive/private-key-block | 内容判定 | 2 | 2 | 0 | 0.04 | 文档格式说明 + 浏览器端运行时生成密钥（无真实私钥入库） |
| sensitive/connection-string | 内容判定 | 1 | 1 | 0 | 0.02 | .env.example 开发默认凭据（postgres:postgres@容器名） |
| sensitive/unbounded-loop | 内容判定 | 1 | 1 | 0 | 0.02 | 第三方前端 minified bundle |
| supplychain/install-scripts | 内容判定 | 1 | 1 | 0 | 0.02 | postinstall 自构建（存在 tsconfig 才 build） |
| description/exfiltration-instructions | 内容判定 | 1 | 1 | 0 | 0.02 | 「send…message…to」分支误中联系表单描述（critical 级误报，成本最高） |

## 4. 调优建议（数据反哺——已于 AILAB-50 批次全部实现，执行结果见 §6）

1. **`sensitive/api-key-assignment`（最大噪声源，95 条 / 1.86 每仓库）**：负向排除值含 `process.env`/`config.`/`req.` 等标识符形态（规则本意是字面量赋值）；该规则在官方生态 PROD 代码的精确率为 0；
2. **`supplychain/obfuscated-code`（40 条）**：`base64-decode 调用`信号降级（low/info）或要求与其他信号共现；保留"超长 base64 字面量"信号（本批 0 条误报来自字面量分支）；
3. **`description/exfiltration-instructions`（critical 误报）**：排除工具自身载荷语义（message 即表单/IM 工具的字段名）；critical 级误报会直接狼来了；
4. **`sensitive/env-dump`（16 条）**：排除 `env:` 传参上下文（子进程环境继承）与测试目录；
5. **`sensitive/hardcoded-secret`**：JWT 分支增加 `.x.y` 结构占位识别；tests/ 路径降权；
6. **`sensitive/connection-string`**：排除 `.env.example`（与 dotenv-committed 同口径）与常见开发默认凭据；
7. **能力披露四规则（process-execution / network-egress / dynamic-code-exec / shell-option，116 条）**：severity 建议降为 low/info（定位=披露外联面供人工审阅），恶意判定交给组合信号（能力 × 敏感数据流）——与本报告同批的 gadgethumans-mcp 漏报记录正说明"秘密→网络汇聚点"的组合信号才是高置信方向；
8. **minified/vendor 产物**：`public/**/assets/*.js`、`*.min.js` 类前端构建产物建议默认跳过（unbounded-loop 等 AST 信号在 minified 代码上无意义）；
9. **install-scripts**：`postinstall` 自构建形态（`npm run build`/`node -e existsSync…`）白名单化，保留远程下载管道执行。

## 5. 定性观察

- **某高能力广度服务器**（147 条，单仓占比 53%）：算力/钱包/社交账号池/SMS 综合 agent 平台，能力广度罕见（ssh + 密钥生成 UI + x402 支付中间件 + 账号池 + 云通信 SMS）。逐条核对全部为合法实现（含读源码确认的系统健康固定命令、浏览器端密钥生成），**仓库级留观**：此类"高能力广度"服务器是未来组合信号规则（能力×数据流）的理想真实用例（仓库名等明细按数据分级策略仅本地保留）;
- **官方生态并不干净**：51 个仓库中 1 个含 `.env.example` 默认凭据入库、1 个 postinstall 执行任意 node -e、若干仓库把 API key 处理逻辑直接暴露在浏览器 dashboard——扫描器的披露价值仍然存在，只是 severity 与呈现方式需要分层；
- **registry 陈旧率**：80 条抽样中 8 条（10%）指向已删除/私有仓库——对 registry 生态本身是个数据点；
- 本批 4 个仓库的扫描输出曾因 shell 转义损坏，已直接写文件重扫修正——扫描器本身输出正常。

## 6. 调优执行结果（AILAB-50 · M1 2026-11-09 commit b250103 / M2 2026-11-09）

§4 全部 9 条建议已落地，并对 53 仓库（matched 40 + 新增 13，含 2 个提交构建产物/依赖树的巨仓库）完成两轮全量回归重扫（`scripts/validation/planc-rescan.mjs`）：

| 指标 | 首批基线 | M1 后 | M2 后（终版） |
|---|---|---|---|
| matched-40 内容判定类命中 | 161 | 25 | **4**（2 条为有意保留的真实格式内容，2 条为测试夹具降权 low） |
| 其中 medium 及以上 | ~12 | 9 | **2**（private-key-block ×2，真实格式展示，逐条核对为合法） |
| 53 仓 CI-fail（fail-on medium 口径） | — | 9/53 = 17% | **3/53 = 6%** |
| 53 仓 CI-fail（fail-on low 默认口径） | 14/51 = 27% | 12/53 = 23% | 10/53 = 19%* |
| 命中总条数（53 仓，含巨库；首批无巨库口径为 277/51 仓） | — | 5327 | 2310 |

\* fail-on low 残余为能力披露型 low 信号（按设计保留的如实披露，非误报）——这是默认阈值下 CI-fail 占比的结构性下限，CLI 产品默认值维持 low 不上调，CI 场景建议按 `packages/cli/README.md` 指南选用 `--fail-on medium`。

M2 手段：api-key-assignment 值形态精修（环境变量名/连字符选项名/纯数字/占位词段/`process.env.` 引用排除 + 同行取值修正）+ tests/ 声明式降权、hardcoded-secret tests/ 降权、生成物/数据块文件内容判定跳过（obfuscated-code / unbounded-loop——2988 条巨库噪声消除，手写业务代码实测零误伤）、install-scripts 迁移代码规则 + 自构建白名单（构建链递归洁净检查，`{shell:...}` 伪装仍命中）。逐条残余明细按数据分级策略存本地保留目录（`planC-round3-m2-2026-11-09.json`）。

## 附录：数据分级说明

依据 AILAB-47 决策（2026-11-09）：对外只发布聚合数据。本公开版保留：抽样方法口径（字母序 80 抽 51）、分规则聚合矩阵、根因分析与调优建议；**裁剪**：仓库级清单与命中数、277 条逐条核对明细、仓库名级案例（已移入本地保留目录，不入公开仓库）。历史说明：首批明细曾随 commit fb888d3 进入公开历史（内容为良性语料元数据与文件路径，无凭据、无恶意样本）；如需从历史彻底移除需重写公开历史（破坏性操作），默认不做，后续批次自本决策起直接本地保留。
