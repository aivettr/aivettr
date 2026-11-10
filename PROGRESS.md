# 执行过程记录（PROGRESS）

> 按阶段/任务组织：任务描述 | 状态 | 完成日期 | 备注/阻塞点

## 阶段 0：项目初始化

| # | 任务描述 | 状态 | 完成日期 | 备注/阻塞点 |
|---|---|---|---|---|
| 0.1 | 阅读 OWASP GenAI/LLM Top 10 2026 PDF，提取与 MCP/Skill 检测、运行时安全相关的风险条目 | 已完成 | 2026-10-29 | 提取结论见 README 与 ARCHITECTURE |
| 0.2 | 建立项目文档体系（README / PROGRESS / FEATURES / ARCHITECTURE / PROBLEM-LOG / REPOSITORY） | 已完成 | 2026-10-29 | 骨架已建，内容随决策更新 |
| 0.3 | 初始化本地 Git 仓库并提交基线 | 已完成 | 2026-10-29 | ✅ remote 已配置并推送：`https://github.com/aivettr/aivettr.git`，见 REPOSITORY.md |
| 0.4 | 输出「初始化待确认信息」分析（产品范围/技术选型/开源策略/工程规范） | 已完成 | 2026-10-29 | 已在 Multica Issue AILAB-43 提出，逐项等待确认 |
| 0.5 | 确认：MVP 方向（静态检测 / 运行时防护 / 两者兼顾） | 已完成 | 2026-10-29 | ✅ 已确认：**扫描器先行 + 运行时架构预留**，且须保留随时转向「纯静态检测扫描器」的余地，运行时模块不得成为扫描器的阻塞依赖 |
| 0.6 | 确认：目标用户与产品形态 | 已完成 | 2026-10-29 | ✅ 目标用户：**开发者优先**（转商业后再面向企业/团队）；产品形态：**CLI + CI 集成**，且保留随时转向**仅 CLI** 的余地（CI 层必须是 CLI 的薄包装、独立可裁撤）。强约束：**严格管理开源范围，防止项目被窃取商业化** |
| 0.6b | 确认：扫描对象与规则范围（MCP / Skill / 通用工具描述，先覆盖哪个） | 已完成 | 2026-10-29 | ✅ 扫描对象：**MVP 仅覆盖 MCP Server**，后续经 adapter 逐步扩展至 Skill 与通用模式；✅ 规则范围：**四个能力域首版全做**（描述投毒 / 包供应链 / 过度权限 / 敏感信息与消耗） |
| 0.7 | 确认：技术栈与架构方案 | 部分完成 | 2026-10-29 | ✅ 主语言已确认：**TypeScript**（MVP 单语言 TS，Python 后续以 sidecar 分析器按需引入）；✅ Monorepo + pnpm workspaces；检测引擎方法（纯规则/LLM 辅助/混合）随首版规则设计再定 |
| 0.8 | 确认：开源许可证与 Open Core 边界 | 部分完成 | 2026-10-29 | ✅ 许可证已确认：**双许可（AGPL-3.0 + 商业许可）**，LICENSE / LICENSE-COMMERCIAL.md / legal/CLA-* 已落地；Open Core 闭源侧模块清单待功能范围明确后列出 |
| 0.9 | 确认：项目命名、托管平台、分支与 commit 规范 | 已完成 | 2026-10-29 | ✅ 全部确认：**AIVettr / aivettr / @aivettr**（商标清单见 legal/）；**GitHub** 托管、`main` 保护 + feature 分支 + PR 评审、Conventional Commits |
| 0.10 | 搭建代码工程骨架（目录结构 / CI / 测试框架） | 已完成 | 2026-10-29 | ✅ pnpm monorepo 六模块 + GitHub Actions CI（install→typecheck→test→build）+ lockfile；本地全流程验证通过。**阶段 0（初始化）完成；2026-10-29 已推送 GitHub（aivettr/aivettr，main 分支保护已配置）** |

## 阶段 1：MVP 扫描器（已完成）

| # | 任务描述 | 状态 | 完成日期 | 备注/阻塞点 |
|---|---|---|---|---|
| 1.1 | FEATURES.md 扫描器规格逐项确认（共 8 项） | 已完成 | 2026-10-31 | ✅ 8 项决策全部锁定并写入 FEATURES.md 功能记录（需求/规格/验收）；ARCHITECTURE.md 已同步。规格立项 Issue AILAB-44 转 in_review 交用户验收 |
| 1.2 | 按 FEATURES.md 规格开发 MVP 扫描器（scanner-core/cli/rulepack/report/ci-action + samples） | 已完成 | 2026-11-01 | ✅ 7 个里程碑全部交付，100 个测试全绿，8 条验收标准逐项达成（见下行明细） |
| 1.3 | M1 scanner-core：扫描管道 + 核心类型 + collector + MCP adapter | 已完成 | 2026-11-01 | 31 测试（含 collector/glob/scan/性能） |
| 1.4 | M2 analyzers：text/manifest/JS·TS AST | 已完成 | 2026-11-01 | 危险调用识别、字面量提取、包内 import 解析；Python 文本抽取（docstring/关键字） |
| 1.5 | M3 rulepack：四能力域首版 17 条规则（7 YAML + 10 代码） | 已完成 | 2026-11-01 | OWASP 元映射；`.aivettr/rules/*.yaml` 本地自定义规则 |
| 1.6 | M4 samples：synthetic（含 synthetic-python）/ benign / real-world + expect.json | 已完成 | 2026-11-01 | 22 个样本全部与 expectRules 精确一致；真实事件去武器化复刻 |
| 1.7 | M5 cli：`aivettr scan` 全选项 + 0/1/2 退出码 + 配置发现与优先级 | 已完成 | 2026-11-01 | 27 测试含 dist 二进制 e2e |
| 1.8 | M6 report：text/json/sarif/markdown 四渲染器 | 已完成 | 2026-11-01 | 16 测试含四格式快照、SARIF 结构、Markdown 注入转义 |
| 1.9 | M7 ci-action：node20 + ncc 薄包装（annotations/SARIF 上传降级/outputs） | 已完成 | 2026-11-01 | 19 测试含 bundle 冒烟；dist 随仓库提交 |
| 1.10 | 验收补充：500 文件性能（68ms / 127MB）、dogfood 自扫出报告 | 已完成 | 2026-11-01 | `aivettr-selfscan.md`（源码口径 0 命中）；CI 顺序修正为 build→typecheck→test |
| 1.11 | 安全评审跟进：保留 node20+ncc 方案，补可复现构建校验（verify:bundle） | 已完成 | 2026-11-02 | ✅ 校验启用即抓到陈旧 ncc 产物（inspectLoop 修复后未重打包），已重建；CI 增加 verify 门禁；100 测试全绿 |
| 1.12 | 用户验收：FEATURES.md 8 条标准五步验证（测试/CLI/规则样本/CI 性能/自扫） | 已完成 | 2026-11-07 | ✅ 五步全部由用户实测通过；补充样本总数勘误：23 个（交付说明写 22 为笔误）；17 规则中 3 条经真实事件形态验证 |
| 1.13 | 收尾落档：`samples/RULES-GUIDE.md` 规则图解 + 覆盖缺口检验（候补 11 规则 + 2 结构性缺口）；阶段 2 验证专项 AILAB-47 建档（backlog，待 VM 条件允许后执行 A→C→B） | 已完成 | 2026-11-07 | AILAB-45 置 done；缺口清单与网络攻防能力评估见 AILAB-45 2026-11-07 评论 |
| 1.14 | 候补规则影响分析 + 低影响项补充：新增 7 规则（tool-shadowing / config-poisoning / connection-string / api-key-assignment / dotenv-committed / env-dump / fs-sensitive-path）+ 3 补丁（install-scripts+prepare、dynamic-code-exec+动态导入、hardcoded-secret+Bearer） | 已完成 | 2026-11-07 | ✅ 规则 17→24，样本 23→30，测试 103 全绿；暂缓 4 项（动态 URL / brand-mimicry / Python AST / 抗规避）待 AILAB-47 数据；dogfood 源码口径 1 条已核对命中（verify-build.mjs execFileSync，合法） |

## 阶段 2：真实世界验证专项（进行中，Multica AILAB-47）

| # | 任务描述 | 状态 | 完成日期 | 备注/阻塞点 |
|---|---|---|---|---|
| 2.0 | AILAB-47 建档（方案 A/B/C 资源清单与安全红线）；用户批准启动，无服务器条件先做不依赖资源项 | 已完成 | 2026-11-07 | 顺序 A→C→B；B 待一次性 VM/容器（≥4C8G、Node ≥20、无凭据、可丢弃） |
| 2.1 | 方案 A 首批：3 个真实事件去武器化复刻（gadgethumans-mcp / sha1-hulud-second-coming / polymarket-kit）+ 来源核实 + expect.json + 文档更新 | 已完成 | 2026-11-07 | ✅ 真实形态规则覆盖 3→9/24；样本 30→33，103 测试全绿；产出**首个漏报形态记录**（gadgethumans-mcp 0 命中：fetch 变量间接化 + env 秘密→网络汇聚点污点缺口），暂缓项 #3/#6 获 real-world 证据；方案 B 两个候选数据集已核实存在（MCPTox AAAI 2026 / arXiv 2604.01905），MCPSecBench 待核 |
| 2.2 | 方案 A 后续批次（**目标上调：全覆盖 24/24 条规则均有真实事件形态验证**，用户 2026-11-09 确认）：剩余 15 条规则待覆盖——按批次「事件研究 → 复刻 → 验证」推进，首批候选 Mini Shai-Hulud（AI 配置收割，覆盖 fs-sensitive-path）、Invariant 系列形态（tool-shadowing/config-poisoning/unicode-masquerade 补真实事件）、真实泄露类事件（dotenv-committed/connection-string/hardcoded-secret/credit-card/api-key-assignment）、对抗类事件（tls-disabled/obfuscated/unbounded-loop/remote-dependency/shell-pipeline/shell-option） | 进行中 | — | 每个事件仍走「核实 → 去武器化复刻 → expect → README 标注来源与核实日期」流程；部分规则（credit-card 等泄露类）真实事件为泄露/事故而非恶意软件，按同一规范复刻 |
| 2.3 | 方案 C：良性生态误报率测量（官方 MCP Registry 抽样 80 → clone 51，静态扫描 + 277 条命中逐条核对） | 已完成（首批） | 2026-11-08 | ✅ 报告 `aivettr-planC-report.md`：37/51 零命中，277 条命中 0 可疑（全部合法），噪声 Top3 = api-key-assignment(95) / process-execution(86) / obfuscated-code(40)；9 条调优建议已列入报告 §4 待排序；用户 2026-11-08 确认首批清单（官方 registry） |
| 2.4 | 方案 B：公开数据集回放（MCPTox / arXiv 2604.01905=Connor / MCPSecBench）→ 检出率矩阵 | 已完成（首批） | 2026-11-08 | ✅ 报告 `aivettr-planB-report.md`。用户批准本机 Docker 方案；断网容器（--network none + ro 挂载 + 无凭据 + 用后销毁）执行。**MCPTox 用例级检出 155/1312=11.8%**，漏报 87% 含行为劫持句式候选信号（检出上限 ~89%）；MCPSecBench/Connor 命中 1/8 条——量化 Python 无 AST 缺口（暂缓 #12）实测代价；许可核实：MCPSecBench=MIT、Connor PoCs=Apache-2.0、MCPTox 上游无许可（研究目的使用+原文不入库）；脚本归档 `scripts/validation/`；数据集已销毁；零外联实测补充（73e74cf） |
| 2.5 | **阶段 2 收尾清单**（用户 2026-11-09 决策落档）：① AILAB-50 调优批次（M1+M2+P2 完成 2026-11-09 commit b250103/511642e：内容类误报 161→**4**、CI-fail(medium) 17%→**6%**、MCPTox 检出 11.8%→**62.3%**、38 样本/128 测试全绿；**用户 2026-11-10 验收确认 OK**——第二目标以 6% 收口（Cotal/Palmyr/Ekwo 3 仓残余不再立专项），Issue 转 in_review 待用户关闭）② 方案 A 全覆盖批次（见 2.2，用户 2026-11-10 确认启动；在 AILAB-47 下推进）③ AILAB-51 Python AST 最小集（**开工条件评估完成 2026-11-10**：具备开工条件——python3 sidecar 路径原型实测 1312 文件 195ms+启动 28ms 在预算内、零新依赖（stdlib ast）、Python 信号映射现有 DangerousCall 后规则层零改动、工作量约 3 里程碑；推荐路径甲 sidecar；待用户批准转 todo 开工）④ 全部完成后 AILAB-47 转 in_review 结项；阶段 3（AILAB-49）待阶段 2 完成（用户 C3 决策） | 进行中 | 2026-11-10 | 数据分级策略已执行：对外仅聚合数据，明细/抽样/加权数据本地保留（仓库外 `aivettr-validation-local/`）；M1/M2 语料回归明细见本地 `planC-round2-m1-2026-11-09.md`、`planC-round3-m2-2026-11-09.json`、`planB-round2-m2-2026-11-09.json`；B1/重扫脚本已归档 `scripts/validation/`（b1-benign-incidence / planc-rescan） |

## 阶段 3：运行时防护（规划已完成 2026-11-08，开发待另立 Issue 排期）

| # | 任务描述 | 状态 | 完成日期 | 备注/阻塞点 |
|---|---|---|---|---|
| 3.1 | 规划骨架 AILAB-48 建档 + 7 项边界逐项确认（定位：防御纵深第二层——静态=装前把关、运行时=装后兜底；只规划不开工） | 已完成 | 2026-11-08 | 用户 2026-11-07 逐项回复；agent 2026-11-08 逐项分析并给推荐方案（第 2 项 env 实现方式修正为出口关联式；5/6/7 受权代拟）；用户同日确认全部锁定。第 1 项定案：**本版仅支持 Node.js，Python 及其他语言纳入规划**（方向落档，立项另议） |
| 3.2 | FEATURES.md 落档「MCP Server 运行时防护（阶段 3 · Node.js 一期）」功能记录；ARCHITECTURE.md 运行时形态定案 + 新增 §8 架构要点；packages/runtime/README 同步 | 已完成 | 2026-11-08 | 8 项规格（形态/监测面/平台语言/策略/性能误报/数据告警/Open Core/后续演进）+ 8 条验收标准草案；关键定案：`aivettr guard` 包裹式启动 + Node preload 探针；env 出口关联；开源 observe / 商业 enforce（license gate，商业侧独立私有仓库） |
| 3.3 | 另立开发 Issue 排期 | 已完成 | 2026-11-08 | 开发 Issue **AILAB-49**「阶段 3：运行时防护开发（aivettr guard · Node.js 一期）」建档（backlog，AILAB-48 子 Issue；待用户批准启动后转 todo 开工） |
| 3.4 | 一期里程碑 M1–M4：探针框架与 hook 点 → observe 管道+事件 schema+白名单 → guard CLI+报告渲染 → 样本+性能基准+dogfood | 未开始 | — | 在开发 Issue 内推进；AILAB-48 保持规划归档，误报校准依赖 AILAB-47 方案 C 数据回填 |
