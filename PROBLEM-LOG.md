# 问题修复记录（PROBLEM-LOG）

> 累积式问题日志。修复前先读历史记录判断是否复发；修复后按模板追加。

## [2026-10-29] 首次推送 GitHub 后 CI 失败：pnpm 版本两处声明冲突
- 问题内容：推送后 GitHub Actions 两次运行（b465b00、1ffe114）均在 `pnpm/action-setup@v4` 步骤失败：`Error: Multiple versions of pnpm specified - version 9 in the GitHub Action config / version pnpm@9.15.0 in package.json packageManager`。影响范围：CI 红灯，但仅阻断 CI，不影响仓库内容与本地构建。
- 定位结论：`.github/workflows/ci.yml` 显式传入 `version: 9`，与根 `package.json` 的 `"packageManager": "pnpm@9.15.0"` 同时存在；action-setup v4 检测到两处版本源直接退出。本地此前全绿是因为本机 pnpm 已安装、不经过 action-setup，故该问题只在 CI 干净环境暴露。证据：失败 run 日志（run 40837171610）。
- 修复方向：删除 workflow 中 `with: version: 9`，版本以 `package.json` packageManager 为唯一事实源（action-setup v4 无 version 时自动读取该字段）；本地 pnpm 9.15.0 重跑 frozen-install/typecheck/test/build 全绿。涉及文件：`.github/workflows/ci.yml`。
- 是否历史留存：否（PROBLEM-LOG 首条）。
- 状态：已验证（修复提交 9a449ea 推送后 CI run 40837373562 success）。

## [2026-10-29] Multica 服务端不支持 wakeup 接口（404），无法挂"评论即唤醒"
- 问题内容：AILAB-44 规格确认需等待用户逐项答复，拟用 `multica issue wakeup create --event comment.created --filter-actor-type member` 挂唤醒，create 与 list 均返回 `404 page not found`（POST `/api/issues/<id>/wakeups`）。影响范围：用户单纯回复评论不会开启新 run，规格确认流程无法自动续期。
- 定位结论：CLI 0.7.1（2026-10-27 构建）已为最新，404 来自服务端——该部署未提供 wakeups 路由；autopilot 仅支持 schedule/webhook 两类触发，无评论事件可替代。属环境能力缺失，非用法错误（user_id 与 membership id 两种 actor 写法均试过）。
- 修复方向：无代码修复。流程绕行：已在 AILAB-44 更正评论中告知用户——答复时提及 @豆包-Seed-pro 或重新指派 Issue 即可唤起后续轮次；后续所有"等待用户输入"的 Issue 均按此模式处理，直至服务端支持 wakeup。
- 是否历史留存：否。
- 状态：已验证（替代流程已告知用户；接口本身仍待服务端升级）。

## [2026-11-01] TS AST 遍历在首个子节点静默中止（forEachChild 回调真值）
- 问题内容：`analyzeJsTs` 全节点遍历改用 `node.forEachChild((c) => stack.push(c))` 后，分析只处理文件首个子节点即停；表现为深层语句（函数体内调用、对象属性）的危险调用/描述/Bcc 信号大面积缺失，且无任何报错。
- 定位结论：`forEachChild` 的回调若返回 truthy 值会中止遍历；`stack.push()` 返回数组新长度（number，truthy）。证据：回调改为块语句（返回 void）后，既有 11 个 AST 测试中多条此前侥幸通过的断言与真实样本（postmark Bcc）恢复命中。
- 修复方向：回调显式写成块函数体 `(c) => { stack.push(c); }`。涉及文件：`packages/scanner-core/src/analyzers/ast.ts`。
- 是否历史留存：否。
- 状态：已验证（31 个 scanner-core 测试 + 全量样本 expect.json 通过）。

## [2026-11-01] sensitive/unbounded-loop 对含 return/throw 的循环误报
- 问题内容：dogfood 自扫命中 CLI 自身代码 `cli/src/config.ts:38`：向上查找配置文件的 `while (true)` 循环体内有 `return`/`throw` 路径，规则只识别 `break` 为退出，误判为无界循环。
- 定位结论：inspectLoop 的静态退出集合不全 —— break/return/throw 同为循环退出语句；同时须排除嵌套函数边界（闭包内 return 不退出外层循环）。
- 修复方向：inspectLoop 剪枝新增三类函数节点，退出语句集合扩为 break/return/throw；正样本（体内仅有 await）仍稳定命中。涉及文件：`packages/scanner-core/src/analyzers/ast.ts`。
- 是否历史留存：否。
- 状态：已验证（误报消失；全量口径自扫仅剩 ncc 制品内 1 条，源码口径 0 命中）。

## [2026-11-01] Python @tool docstring 抽取错位：装饰器起点当作函数体起点
- 问题内容：synthetic-python 样本（FastMCP `@mcp.tool()` + docstring 投毒文本）0 命中描述规则。
- 定位结论：抽取逻辑以装饰器匹配行末作为函数体起点，实际还需跳过 def 头（参数注解、冒号、可选行注释、换行）；且须校验 docstring 是函数体首条语句（仅允许空白行在前），否则会误抽嵌套字符串。
- 修复方向：装饰器匹配后二次定位 def 头终止冒号，再从函数体起匹配 docstring；另补 `description = "..."` 关键字形态。涉及文件：`packages/scanner-core/src/analyzers/text.ts`。
- 是否历史留存：否。
- 状态：已验证（synthetic-python 文本规则命中，列入验收 3）。

## [2026-11-01] SARIF location 缺少 physicalLocation 包装层
- 问题内容：report 单测取 `runs[0].results[0].locations[0].physicalLocation.region` 报 undefined。
- 定位结论：SARIF 2.1.0 的 location 对象结构为 `{physicalLocation: {artifactLocation, region}}`，实现直接把 artifactLocation/region 平铺在 location 上。
- 修复方向：补 `physicalLocation` 包装层。涉及文件：`packages/report/src/sarif.ts`。
- 是否历史留存：否。
- 状态：已验证（16 个 report 测试与快照全绿）。

## [2026-11-01] CI 干净环境失败：typecheck/test 先于 build，缺跨包 dist
- 问题内容：CI 顺序 install→typecheck→test→build：cli/rulepack/report 的类型解析与 e2e/action 冒烟依赖 scanner-core 等包的 dist 产物，干净环境中尚未构建即检查，必红灯。
- 定位结论：包间类型经 dist 的 .d.ts 消费，e2e 测试 spawn dist 二进制、bundle 测试 spawn ncc 产物；顺序依赖在本地增量开发时被旧产物掩盖。
- 修复方向：CI 调整为 install→**build**→typecheck→test；根 build 脚本改为显式有序链（scanner-core → report/rulepack → cli → ci-action），消除 pnpm -r 排序的不确定性。涉及文件：`.github/workflows/ci.yml`、根 `package.json`。
- 是否历史留存：否（与 2026-10-29 pnpm 版本冲突同属 CI 配置问题，但根因不同）。
- 状态：已验证（CI run 41458043927 全步骤 success，2026-11-02 推送后确认）。

## [2026-11-02] 提交的 ncc action 产物陈旧：源码修复后未重新打包
- 问题内容：安全评审确认保留 node20+ncc 方案并新增"可复现构建校验"，首次运行即失败：随仓提交的 `ci-action/dist/index.js`（7,743,469B）与从源码重建产物（7,743,623B）字节不一致，差异 154B。
- 定位结论：时间线核对——2026-11-01 打包 ncc 后，又修复了 scanner-core 的 inspectLoop（return/throw 退出识别），重建了 scanner-core 但**未重跑 ncc**，陈旧 bundle 被一并提交。根因是打包依赖人工触发，构建链无产物一致性门禁；本地 e2e 测试未覆盖"bundle 与源码同步"这一性质。
- 修复方向：①新增 `ci-action/scripts/verify-build.mjs`（同参重建 → 逐文件 sha256/字节比对，不一致即非零退出）与 `verify:bundle` 脚本，CI 在 build 后强制执行；②重新打包提交最新 dist，校验通过。涉及文件：ci-action/scripts/verify-build.mjs、ci-action/package.json、ci-action/dist/、.github/workflows/ci.yml。
- 是否历史留存：否。
- 状态：已验证（CI run 41458043927：ubuntu 环境重建产物与提交产物逐字节一致，Verify 步骤 success）。

### 记录模板

```
## [YYYY-MM-DD] <问题简述>
- 问题内容：<现象、复现路径、影响范围>
- 定位结论：<根因、证据链>
- 修复方向：<本次修复方案、涉及文件>
- 是否历史留存：<是/否>（若是，注明关联的历史条目）
- 状态：<已修复待验证 / 已验证>
```
