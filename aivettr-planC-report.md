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

## 4. 调优建议（数据反哺，暂不实现——与暂缓 4 项一起按 AILAB-47 数据统一排序）

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

- **0xArtex/Palmyr**（147 条，单仓占比 53%）：算力/钱包/社交账号池/SMS 综合 agent 平台，能力广度罕见（ssh + 密钥生成 UI + x402 支付中间件 + TikTok/X 账号池 + Telnyx SMS）。逐条核对全部为合法实现（含读源码确认的 system-health 固定命令、浏览器端密钥生成），**仓库级留观**：此类"高能力广度"服务器是未来组合信号规则（能力×数据流）的理想真实用例；
- **官方生态并不干净**：51 个仓库中 1 个含 `.env.example` 默认凭据入库、1 个 postinstall 执行任意 node -e、若干仓库把 API key 处理逻辑直接暴露在浏览器 dashboard——扫描器的披露价值仍然存在，只是 severity 与呈现方式需要分层；
- **registry 陈旧率**：80 条抽样中 8 条（10%）指向已删除/私有仓库——对 registry 生态本身是个数据点；
- 本批 4 个仓库的扫描输出曾因 shell 转义损坏，已直接写文件重扫修正——扫描器本身输出正常。

## 附录 A：51 仓库清单与命中数

| # | 仓库 | 命中数 |
|---|---|---|
| 1 | 0000F8/salt-mcp | 15 |
| 2 | 0ics-srls/lsai-xmp4.public | 0 |
| 3 | 0xArtex/Palmyr | 147 |
| 4 | AAAIStudio/mangii-mcp | 0 |
| 5 | AIStoryHub/etincel | 5 |
| 6 | AITOPIAai/skills | 0 |
| 7 | AInoAKARI/AInoAKARI | 1 |
| 8 | AIvikings/aivikings-mcp | 0 |
| 9 | ANLTD/memocore-mcp | 0 |
| 10 | Adgrowofficial/getlead-mcp | 0 |
| 11 | Agent-Operating-System/emailwarmup-mcp | 0 |
| 12 | Agentic-Private-Office/fo-kg-door | 8 |
| 13 | AndreyAzimov/searchconsole-ai | 1 |
| 14 | Antcolombo/beliefstate-agent-integrations | 4 |
| 15 | ApexAI-Academy/sample-agents | 0 |
| 16 | ApogeeGIT/apogee-mcp | 0 |
| 17 | Ask-Your-Audience/askyouraudience | 0 |
| 18 | Auctalis/nocturnusai | 19 |
| 19 | AugmentEVzero/fabric-verify-mcp | 0 |
| 20 | AutoRFP/mcp | 0 |
| 21 | Autonomad1/computeback-mcp | 0 |
| 22 | BackEngine-ai/backengine-mcp | 0 |
| 23 | Boolsai-ai/mcp | 0 |
| 24 | Bramwell-Inc/machinerelations-plugins | 42 |
| 25 | BuildsbyMatt/mentionagent-claude-skill | 0 |
| 26 | BumbleBox/bumblebox-mcp | 0 |
| 27 | Bynor-S-R-L/bynor-mcp | 0 |
| 28 | ByteAsk/ByteAsk-Embedded-MCP | 0 |
| 29 | CUSTOM-DOMAIN-APP/customdomain-mcp | 0 |
| 30 | CallMCP/callmcp | 13 |
| 31 | CanaryUsers-ai/canaryusers-mcp | 0 |
| 32 | Capxule/capxule-ai | 0 |
| 33 | CerebriumAI/cerebrium-skills | 0 |
| 34 | Chronary/chronary-mcp | 3 |
| 35 | ClintUK/litescribe-mcp | 0 |
| 36 | Compellerai/compeller-mcp | 0 |
| 37 | David-Porto-Baraldes/Viveka_Web | 0 |
| 38 | DeepLedger/deepledger-plugin | 0 |
| 39 | Downshift/rivalize-mcp | 13 |
| 40 | Easy-Peasy-AI/easy-peasy-mcp | 0 |
| 41 | EasyDeploy-AI/easydeploy-ai-mcp | 5 |
| 42 | Ed-Relight/memestack-mcp | 0 |
| 43 | Edison-Watch/sealgate-mcp | 1 |
| 44 | EmpirioLabs-AI/mcp | 0 |
| 45 | Evolink-AI/mcp-plugin | 0 |
| 46 | EximAgent/cursor-plugin | 0 |
| 47 | FINGU-GRINDA/tradegraph | 0 |
| 48 | FairMind-Gen-AI-Studio/fairmind-mcp | 0 |
| 49 | Frankhoubre/imaginode-mcp | 0 |
| 50 | Full-Vibe/calendarmcp-public | 0 |
| 51 | Gauraviitkgp/news-mcp | 0 |

## 附录 B：277 条逐条核对明细

### sensitive/api-key-assignment（95）

- 0000F8/salt-mcp `docs/CLIENTS.md:222` — 合法：文档/配置示例占位符
- 0000F8/salt-mcp `src/index.mjs:176` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0000F8/salt-mcp `tests/local-tools.test.mjs:22` — 合法：测试夹具占位值
- 0xArtex/Palmyr `.env.example:68` — 合法：文档/配置示例占位符
- 0xArtex/Palmyr `.env.example:76` — 合法：文档/配置示例占位符
- 0xArtex/Palmyr `.env.example:86` — 合法：文档/配置示例占位符
- 0xArtex/Palmyr `.env.example:103` — 合法：文档/配置示例占位符
- 0xArtex/Palmyr `.env.example:112` — 合法：文档/配置示例占位符
- 0xArtex/Palmyr `cli/cli.ts:6754` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `cli/cli.ts:7001` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `cli/cli.ts:8045` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `cli/cli.ts:8263` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `cli/sdk.ts:322` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `cli/sdk.ts:1085` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `cli/wallet-brief-llm.ts:29` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `cli/wallet-trading.ts:949` — 合法：文档/配置示例占位符
- 0xArtex/Palmyr `public/dashboard.html:737` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `public/dashboard.html:2456` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `public/dashboard.html:3276` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `public/templates.html:113` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `scripts/i402-preflight.ts:87` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `scripts/i402-preflight.ts:110` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `src/routes/domains.ts:91` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `src/routes/xaccounts.ts:65` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `src/services/i402-agentic-market.ts:496` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `src/services/i402-embeddings.ts:15` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `src/services/i402-llm.ts:35` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `src/services/namecheap.ts:94` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `src/services/phone.ts:15` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `src/services/registered-accounts.ts:149` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `src/services/registered-accounts.ts:559` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `src/services/social-pool.ts:120` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `src/services/wallet.ts:392` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `src/tests/dashboard-auth-protection.test.ts:21` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `src/tests/dashboard-auth-protection.test.ts:27` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `src/tests/dashboard-auth-scrypt.test.ts:25` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `src/tests/dashboard-auth-scrypt.test.ts:27` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `src/tests/edge-cases.test.ts:204` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `src/tests/edge-cases.test.ts:311` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `src/tests/edge-cases.test.ts:330` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `src/tests/i402-chat-route.test.ts:22` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `src/tests/i402-tier-b-dryrun.test.ts:26` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `src/tests/vault-crypto.test.ts:78` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `src/tests/vault-crypto.test.ts:108` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `src/tests/wallet-integration.test.ts:124` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- 0xArtex/Palmyr `src/tests/wallet-integration.test.ts:157` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- Antcolombo/beliefstate-agent-integrations `examples/research-changes.mjs:193` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- Antcolombo/beliefstate-agent-integrations `examples/research-changes.test.mjs:180` — 合法：测试夹具占位值
- Auctalis/nocturnusai `.claude/skills/nocturnusai-admin/SKILL.md:171` — 合法：文档/配置示例占位符
- Auctalis/nocturnusai `.claude/skills/nocturnusai-admin/SKILL.md:203` — 合法：文档/配置示例占位符
- Auctalis/nocturnusai `.claude/skills/nocturnusai-admin/SKILL.md:210` — 合法：文档/配置示例占位符
- Auctalis/nocturnusai `.claude/skills/nocturnusai-admin/SKILL.md:218` — 合法：文档/配置示例占位符
- Auctalis/nocturnusai `.claude/skills/nocturnusai-admin/SKILL.md:228` — 合法：文档/配置示例占位符
- Auctalis/nocturnusai `.claude/skills/nocturnusai-admin/SKILL.md:237` — 合法：文档/配置示例占位符
- Auctalis/nocturnusai `.claude/skills/nocturnusai-admin/SKILL.md:314` — 合法：文档/配置示例占位符
- Auctalis/nocturnusai `.claude/skills/nocturnusai-admin/SKILL.md:325` — 合法：文档/配置示例占位符
- Auctalis/nocturnusai `.claude/skills/nocturnusai-admin/SKILL.md:335` — 合法：文档/配置示例占位符
- Auctalis/nocturnusai `.claude/skills/nocturnusai-connect/SKILL.md:328` — 合法：文档/配置示例占位符
- Auctalis/nocturnusai `.claude/skills/nocturnusai-connect/SKILL.md:340` — 合法：文档/配置示例占位符
- Auctalis/nocturnusai `.claude/skills/nocturnusai-connect/SKILL.md:354` — 合法：文档/配置示例占位符
- Auctalis/nocturnusai `.claude/skills/nocturnusai-connect/SKILL.md:473` — 合法：文档/配置示例占位符
- Auctalis/nocturnusai `DEVELOPER_GUIDE.md:1132` — 合法：文档/配置示例占位符
- Auctalis/nocturnusai `DEVELOPER_GUIDE.md:1143` — 合法：文档/配置示例占位符
- Auctalis/nocturnusai `USERGUIDE.md:287` — 合法：文档/配置示例占位符
- Auctalis/nocturnusai `USERGUIDE.md:294` — 合法：文档/配置示例占位符
- Auctalis/nocturnusai `USERGUIDE.md:3147` — 合法：文档/配置示例占位符
- Auctalis/nocturnusai `sdks/mcp-server/src/index.ts:27` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- CallMCP/callmcp `examples/claude-desktop-local-dograh.json:9` — 合法：文档/配置示例占位符
- CallMCP/callmcp `packages/driver-byok/README.md:108` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- CallMCP/callmcp `packages/driver-byok/README.md:110` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- CallMCP/callmcp `packages/driver-byok/src/driver.ts:218` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- CallMCP/callmcp `packages/driver-byok/src/driver.ts:260` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- CallMCP/callmcp `packages/driver-kaicalls/README.md:60` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- CallMCP/callmcp `smithery.yaml:72` — 合法：文档/配置示例占位符
- CallMCP/callmcp `smithery.yaml:78` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- CallMCP/callmcp `smithery.yaml:82` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- CallMCP/callmcp `smithery.yaml:89` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- CallMCP/callmcp `smithery.yaml:91` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- Chronary/chronary-mcp `smithery.yaml:21` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- Chronary/chronary-mcp `smithery.yaml:24` — 合法：文档/配置示例占位符
- Chronary/chronary-mcp `src/index.ts:29` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- Downshift/rivalize-mcp `.github/workflows/ci.yml:36` — 合法：文档/配置示例占位符
- Downshift/rivalize-mcp `src/client.network.test.ts:16` — 合法：测试夹具占位值
- Downshift/rivalize-mcp `src/client.security.test.ts:12` — 合法：测试夹具占位值
- Downshift/rivalize-mcp `src/input-hardening.test.ts:29` — 合法：测试夹具占位值
- Downshift/rivalize-mcp `src/server.protocol.test.ts:23` — 合法：测试夹具占位值
- Downshift/rivalize-mcp `src/stdio.e2e.test.ts:28` — 合法：测试夹具占位值
- Downshift/rivalize-mcp `src/tools.errors.test.ts:15` — 合法：测试夹具占位值
- Downshift/rivalize-mcp `src/tools.responses.test.ts:549` — 合法：测试夹具占位值
- EasyDeploy-AI/easydeploy-ai-mcp `README.md:126` — 合法：文档/配置示例占位符
- EasyDeploy-AI/easydeploy-ai-mcp `docs/claude-getting-started.md:160` — 合法：文档/配置示例占位符
- EasyDeploy-AI/easydeploy-ai-mcp `docs/claude-getting-started.md:176` — 合法：文档/配置示例占位符
- EasyDeploy-AI/easydeploy-ai-mcp `src/easydeploy_ai_mcp/server.py:138` — 合法：值为 env 读取/标识符引用，非字面量（正则误判值形态）
- EasyDeploy-AI/easydeploy-ai-mcp `tests/test_http_main.py:797` — 合法：测试夹具占位值
- Edison-Watch/sealgate-mcp `src/config.ts:35` — 合法：文档/配置示例占位符

### permission/process-execution（86）

- 0000F8/salt-mcp `src/me-secrets.mjs:40` — 合法：OS 工具链/构建发布固定参数调用
- 0000F8/salt-mcp `tests/channel.test.mjs:254` — 合法：测试基建子进程
- 0000F8/salt-mcp `tests/channel.test.mjs:385` — 合法：测试基建子进程
- 0000F8/salt-mcp `tests/channel.test.mjs:397` — 合法：测试基建子进程
- 0000F8/salt-mcp `tests/me-secrets.test.mjs:105` — 合法：测试基建子进程
- 0000F8/salt-mcp `tests/me-secrets.test.mjs:121` — 合法：测试基建子进程
- 0xArtex/Palmyr `cli/compute-ssh.ts:39` — 合法：OS 工具链/构建发布固定参数调用
- 0xArtex/Palmyr `cli/compute-ssh.ts:87` — 合法：OS 工具链/构建发布固定参数调用
- 0xArtex/Palmyr `cli/compute-ssh.ts:184` — 合法：OS 工具链/构建发布固定参数调用
- 0xArtex/Palmyr `cli/compute-ssh.ts:281` — 合法：OS 工具链/构建发布固定参数调用
- 0xArtex/Palmyr `cli/compute-ssh.ts:350` — 合法：OS 工具链/构建发布固定参数调用
- 0xArtex/Palmyr `cli/credential-store.ts:58` — 合法：OS 工具链/构建发布固定参数调用
- 0xArtex/Palmyr `cli/credential-store.ts:79` — 合法：OS 工具链/构建发布固定参数调用
- 0xArtex/Palmyr `cli/credential-store.ts:94` — 合法：OS 工具链/构建发布固定参数调用
- 0xArtex/Palmyr `cli/credential-store.ts:96` — 合法：OS 工具链/构建发布固定参数调用
- 0xArtex/Palmyr `cli/credential-store.ts:101` — 合法：OS 工具链/构建发布固定参数调用
- 0xArtex/Palmyr `cli/credential-store.ts:109` — 合法：OS 工具链/构建发布固定参数调用
- 0xArtex/Palmyr `cli/credential-store.ts:116` — 合法：OS 工具链/构建发布固定参数调用
- 0xArtex/Palmyr `cli/credential-store.ts:128` — 合法：OS 工具链/构建发布固定参数调用
- 0xArtex/Palmyr `cli/credential-store.ts:136` — 合法：OS 工具链/构建发布固定参数调用
- 0xArtex/Palmyr `cli/credential-store.ts:214` — 合法：OS 工具链/构建发布固定参数调用
- 0xArtex/Palmyr `cli/credential-store.ts:218` — 合法：OS 工具链/构建发布固定参数调用
- 0xArtex/Palmyr `cli/credential-store.ts:221` — 合法：OS 工具链/构建发布固定参数调用
- 0xArtex/Palmyr `cli/credential-store.ts:323` — 合法：OS 工具链/构建发布固定参数调用
- 0xArtex/Palmyr `cli/social-monitor.ts:34` — 合法：OS 工具链/构建发布固定参数调用
- 0xArtex/Palmyr `cli/social-monitor.ts:64` — 合法：OS 工具链/构建发布固定参数调用
- 0xArtex/Palmyr `cli/tiktok-connect.ts:467` — 合法：OS 工具链/构建发布固定参数调用
- 0xArtex/Palmyr `cli/wallet-daemon.ts:688` — 合法：OS 工具链/构建发布固定参数调用
- 0xArtex/Palmyr `src/routes/system-health.ts:8` — 合法：OS 工具链/构建发布固定参数调用 **〔已读源码确认〕**
- 0xArtex/Palmyr `src/tests/agent-skills-wellknown.test.ts:80` — 合法：测试基建子进程
- 0xArtex/Palmyr `src/tests/agent-skills-wellknown.test.ts:116` — 合法：测试基建子进程
- 0xArtex/Palmyr `src/tests/bazaar-discovery-metadata.test.ts:117` — 合法：测试基建子进程
- 0xArtex/Palmyr `src/tests/bazaar-discovery-metadata.test.ts:121` — 合法：测试基建子进程
- 0xArtex/Palmyr `src/tests/cli-guards.test.ts:50` — 合法：测试基建子进程
- 0xArtex/Palmyr `src/tests/cli-guards.test.ts:69` — 合法：测试基建子进程
- 0xArtex/Palmyr `src/tests/concurrency.test.ts:140` — 合法：测试基建子进程
- 0xArtex/Palmyr `src/tests/credential-store.test.ts:42` — 合法：测试基建子进程
- 0xArtex/Palmyr `src/tests/credential-store.test.ts:55` — 合法：测试基建子进程
- 0xArtex/Palmyr `src/tests/i402-cli-smoke.test.ts:29` — 合法：测试基建子进程
- 0xArtex/Palmyr `src/tests/i402-cli-smoke.test.ts:48` — 合法：测试基建子进程
- 0xArtex/Palmyr `src/tests/i402-end-to-end.test.ts:184` — 合法：测试基建子进程
- 0xArtex/Palmyr `src/tests/i402-end-to-end.test.ts:208` — 合法：测试基建子进程
- 0xArtex/Palmyr `src/tests/i402-server-boot.test.ts:104` — 合法：测试基建子进程
- 0xArtex/Palmyr `src/tests/i402-server-boot.test.ts:112` — 合法：测试基建子进程
- 0xArtex/Palmyr `src/tests/mcp-server.test.ts:112` — 合法：测试基建子进程
- 0xArtex/Palmyr `src/tests/mcp-server.test.ts:154` — 合法：测试基建子进程
- 0xArtex/Palmyr `src/tests/tiktok-approve-cli.test.ts:56` — 合法：测试基建子进程
- AIStoryHub/etincel `scripts/check-efficacy-regression.mjs:46` — 合法：OS 工具链/构建发布固定参数调用
- AIStoryHub/etincel `scripts/check-efficacy-regression.mjs:47` — 合法：OS 工具链/构建发布固定参数调用
- AIStoryHub/etincel `scripts/check-efficacy-regression.mjs:60` — 合法：OS 工具链/构建发布固定参数调用
- AndreyAzimov/searchconsole-ai `scripts/security-check.js:34` — 合法：OS 工具链/构建发布固定参数调用
- Bramwell-Inc/machinerelations-plugins `actions/page-check/callers.test.mjs:52` — 合法：测试基建子进程
- Bramwell-Inc/machinerelations-plugins `actions/page-check/outcome.test.mjs:136` — 合法：测试基建子进程
- Bramwell-Inc/machinerelations-plugins `actions/page-check/outcome.test.mjs:141` — 合法：测试基建子进程
- Bramwell-Inc/machinerelations-plugins `actions/page-check/outcome.test.mjs:153` — 合法：测试基建子进程
- Bramwell-Inc/machinerelations-plugins `actions/page-check/outcome.test.mjs:164` — 合法：测试基建子进程
- Bramwell-Inc/machinerelations-plugins `actions/page-check/outcome.test.mjs:180` — 合法：测试基建子进程
- Bramwell-Inc/machinerelations-plugins `actions/page-check/outcome.test.mjs:184` — 合法：测试基建子进程
- Bramwell-Inc/machinerelations-plugins `actions/page-check/outcome.test.mjs:192` — 合法：测试基建子进程
- Bramwell-Inc/machinerelations-plugins `scripts/build-release.mjs:22` — 合法：OS 工具链/构建发布固定参数调用
- Bramwell-Inc/machinerelations-plugins `scripts/build-release.mjs:92` — 合法：OS 工具链/构建发布固定参数调用
- Bramwell-Inc/machinerelations-plugins `scripts/build-release.mjs:93` — 合法：OS 工具链/构建发布固定参数调用
- Bramwell-Inc/machinerelations-plugins `scripts/package-files.test.mjs:20` — 合法：测试基建子进程
- Bramwell-Inc/machinerelations-plugins `scripts/package-files.test.mjs:21` — 合法：测试基建子进程
- Bramwell-Inc/machinerelations-plugins `scripts/publish-release.mjs:214` — 合法：OS 工具链/构建发布固定参数调用
- Bramwell-Inc/machinerelations-plugins `scripts/release-trigger.mjs:19` — 合法：OS 工具链/构建发布固定参数调用
- Bramwell-Inc/machinerelations-plugins `scripts/release-trigger.test.mjs:14` — 合法：测试基建子进程
- Bramwell-Inc/machinerelations-plugins `scripts/release-trigger.test.mjs:24` — 合法：测试基建子进程
- Bramwell-Inc/machinerelations-plugins `scripts/release.test.mjs:176` — 合法：测试基建子进程
- Bramwell-Inc/machinerelations-plugins `scripts/release.test.mjs:181` — 合法：测试基建子进程
- Bramwell-Inc/machinerelations-plugins `scripts/release.test.mjs:234` — 合法：测试基建子进程
- Bramwell-Inc/machinerelations-plugins `scripts/release.test.mjs:239` — 合法：测试基建子进程
- Bramwell-Inc/machinerelations-plugins `scripts/release.test.mjs:310` — 合法：测试基建子进程
- Bramwell-Inc/machinerelations-plugins `scripts/release.test.mjs:313` — 合法：测试基建子进程
- Bramwell-Inc/machinerelations-plugins `scripts/release.test.mjs:346` — 合法：测试基建子进程
- Bramwell-Inc/machinerelations-plugins `scripts/release.test.mjs:351` — 合法：测试基建子进程
- Bramwell-Inc/machinerelations-plugins `scripts/release.test.mjs:352` — 合法：测试基建子进程
- Bramwell-Inc/machinerelations-plugins `scripts/release.test.mjs:356` — 合法：测试基建子进程
- Bramwell-Inc/machinerelations-plugins `scripts/resume-reviewed.mjs:417` — 合法：OS 工具链/构建发布固定参数调用
- Bramwell-Inc/machinerelations-plugins `scripts/resume-reviewed.mjs:423` — 合法：OS 工具链/构建发布固定参数调用
- Bramwell-Inc/machinerelations-plugins `scripts/validate-package.mjs:25` — 合法：OS 工具链/构建发布固定参数调用
- Bramwell-Inc/machinerelations-plugins `scripts/validate-package.mjs:27` — 合法：OS 工具链/构建发布固定参数调用
- Bramwell-Inc/machinerelations-plugins `scripts/validate-package.mjs:99` — 合法：OS 工具链/构建发布固定参数调用
- Bramwell-Inc/machinerelations-plugins `scripts/zenodo-draft.test.mjs:168` — 合法：测试基建子进程
- Downshift/rivalize-mcp `src/stdio.e2e.test.ts:48` — 合法：测试基建子进程
- Downshift/rivalize-mcp `src/stdio.e2e.test.ts:90` — 合法：测试基建子进程

### supplychain/obfuscated-code（40）

- 0000F8/salt-mcp `src/keyless-tools.mjs:174` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0000F8/salt-mcp `src/me-crypto.mjs:34` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0000F8/salt-mcp `tests/me-tools.test.mjs:245` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `cli/solana/jupiter.ts:143` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `cli/tiktok-connect.ts:393` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `skills/palmyr/decrypt-email.mjs:30` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `src/middleware/auth.ts:72` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `src/middleware/x402-svm-verify.ts:66` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `src/middleware/x402-svm-verify.ts:69` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `src/middleware/x402-svm-verify.ts:241` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `src/middleware/x402-svm-verify.ts:348` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `src/middleware/x402.ts:691` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `src/routes/cards.ts:69` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `src/routes/phone.ts:175` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `src/routes/phone.ts:176` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `src/services/email.ts:80` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `src/services/mcp-tools.ts:134` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `src/services/social-operations.ts:119` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `src/services/social-operations.ts:121` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `src/services/social-operations.ts:178` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `src/services/social-operations.ts:180` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `src/services/tiktok-operations.ts:86` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `src/services/tiktok-operations.ts:116` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `src/services/tiktok-operations.ts:117` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `src/services/wallet-passkey.ts:242` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `src/services/wallet-vault.ts:761` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `src/services/x402-client.ts:73` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `src/services/x402-client.ts:281` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `src/tests/laso-service.test.ts:155` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `src/tests/x402-client.test.ts:138` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- 0xArtex/Palmyr `src/tests/x402-client.test.ts:186` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- Agentic-Private-Office/fo-kg-door `worker/oauth.js:11` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- Agentic-Private-Office/fo-kg-door `worker/seat.js:195` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- Agentic-Private-Office/fo-kg-door `worker/x402.js:29` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- Agentic-Private-Office/fo-kg-door `worker/x402.js:32` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- Agentic-Private-Office/fo-kg-door `worker/x402.js:82` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- Agentic-Private-Office/fo-kg-door `worker/x402.js:85` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- Antcolombo/beliefstate-agent-integrations `examples/wallet-thesis-audit.mjs:30` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- Antcolombo/beliefstate-agent-integrations `examples/wallet-thesis-audit.test.mjs:28` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）
- CallMCP/callmcp `packages/server/src/approval.ts:346` — 合法：base64 传输编码常规用法（支付头/游标/媒体/密钥格式转换）

### sensitive/env-dump（16）

- 0xArtex/Palmyr `src/tests/agent-skills-wellknown.test.ts:83` — 合法：子进程继承环境 + 覆盖项的测试/脚本惯用法
- 0xArtex/Palmyr `src/tests/bazaar-discovery-metadata.test.ts:124` — 合法：子进程继承环境 + 覆盖项的测试/脚本惯用法
- 0xArtex/Palmyr `src/tests/cli-guards.test.ts:54` — 合法：子进程继承环境 + 覆盖项的测试/脚本惯用法
- 0xArtex/Palmyr `src/tests/i402-cli-smoke.test.ts:31` — 合法：子进程继承环境 + 覆盖项的测试/脚本惯用法
- 0xArtex/Palmyr `src/tests/i402-end-to-end.test.ts:186` — 合法：子进程继承环境 + 覆盖项的测试/脚本惯用法
- 0xArtex/Palmyr `src/tests/i402-server-boot.test.ts:115` — 合法：子进程继承环境 + 覆盖项的测试/脚本惯用法
- 0xArtex/Palmyr `src/tests/mcp-server.test.ts:115` — 合法：子进程继承环境 + 覆盖项的测试/脚本惯用法
- 0xArtex/Palmyr `src/tests/tiktok-approve-cli.test.ts:59` — 合法：子进程继承环境 + 覆盖项的测试/脚本惯用法
- AIStoryHub/etincel `scripts/check-efficacy-regression.mjs:62` — 合法：子进程继承环境 + 覆盖项的测试/脚本惯用法
- Bramwell-Inc/machinerelations-plugins `actions/page-check/outcome.test.mjs:135` — 合法：子进程继承环境 + 覆盖项的测试/脚本惯用法
- Bramwell-Inc/machinerelations-plugins `actions/page-check/outcome.test.mjs:149` — 合法：子进程继承环境 + 覆盖项的测试/脚本惯用法
- Bramwell-Inc/machinerelations-plugins `actions/page-check/outcome.test.mjs:177` — 合法：子进程继承环境 + 覆盖项的测试/脚本惯用法
- Bramwell-Inc/machinerelations-plugins `scripts/release-trigger.test.mjs:16` — 合法：子进程继承环境 + 覆盖项的测试/脚本惯用法
- Bramwell-Inc/machinerelations-plugins `scripts/release.test.mjs:217` — 合法：子进程继承环境 + 覆盖项的测试/脚本惯用法
- Bramwell-Inc/machinerelations-plugins `scripts/zenodo-draft.test.mjs:170` — 合法：子进程继承环境 + 覆盖项的测试/脚本惯用法
- Downshift/rivalize-mcp `src/stdio.e2e.test.ts:91` — 合法：子进程继承环境 + 覆盖项的测试/脚本惯用法

### permission/network-egress（13）

- 0xArtex/Palmyr `cli/evm-trading.ts:534` — 合法：第一方服务 API 调用（本服务的核心功能）
- 0xArtex/Palmyr `cli/wallet-doctor.ts:141` — 合法：第一方服务 API 调用（本服务的核心功能）
- 0xArtex/Palmyr `cli/wallet-doctor.ts:153` — 合法：第一方服务 API 调用（本服务的核心功能）
- 0xArtex/Palmyr `scripts/i402-preflight.ts:84` — 合法：第一方服务 API 调用（本服务的核心功能）
- 0xArtex/Palmyr `scripts/i402-preflight.ts:108` — 合法：第一方服务 API 调用（本服务的核心功能）
- 0xArtex/Palmyr `scripts/i402-preflight.ts:120` — 合法：第一方服务 API 调用（本服务的核心功能）
- 0xArtex/Palmyr `scripts/i402-preflight.ts:133` — 合法：第一方服务 API 调用（本服务的核心功能）
- 0xArtex/Palmyr `scripts/i402-preflight.ts:157` — 合法：第一方服务 API 调用（本服务的核心功能）
- 0xArtex/Palmyr `scripts/i402-preflight.ts:169` — 合法：第一方服务 API 调用（本服务的核心功能）
- 0xArtex/Palmyr `scripts/i402-preflight.ts:179` — 合法：第一方服务 API 调用（本服务的核心功能）
- 0xArtex/Palmyr `src/services/telnyx-balance.ts:45` — 合法：第一方服务 API 调用（本服务的核心功能）
- Agentic-Private-Office/fo-kg-door `public/webmcp.js:19` — 合法：第一方服务 API 调用（本服务的核心功能）
- Bramwell-Inc/machinerelations-plugins `actions/page-check/taste.mjs:20` — 合法：第一方服务 API 调用（本服务的核心功能）

### supplychain/dynamic-code-exec（10）

- 0xArtex/Palmyr `src/tests/cli-guards.test.ts:40` — 合法：插件/驱动按名懒加载或测试动态 import
- 0xArtex/Palmyr `src/tests/dashboard-auth-frontend.test.ts:24` — 合法：插件/驱动按名懒加载或测试动态 import
- 0xArtex/Palmyr `src/tests/i402-operation-state.test.ts:34` — 合法：插件/驱动按名懒加载或测试动态 import
- 0xArtex/Palmyr `src/tests/i402-operation-state.test.ts:34` — 合法：插件/驱动按名懒加载或测试动态 import
- 0xArtex/Palmyr `src/tests/socials-deploy-modal.test.ts:35` — 合法：插件/驱动按名懒加载或测试动态 import
- AInoAKARI/AInoAKARI `evidence/openclaw-67136/openclaw-write-canary.mjs:18` — 合法：插件/驱动按名懒加载或测试动态 import
- Bramwell-Inc/machinerelations-plugins `actions/page-check/access.test.mjs:17` — 合法：插件/驱动按名懒加载或测试动态 import
- Bramwell-Inc/machinerelations-plugins `actions/page-check/runtime/page-check.mjs:31` — 合法：插件/驱动按名懒加载或测试动态 import
- CallMCP/callmcp `packages/server/src/driverRegistry.ts:142` — 合法：插件/驱动按名懒加载或测试动态 import
- Downshift/rivalize-mcp `src/proxy.ts:51` — 合法：插件/驱动按名懒加载或测试动态 import

### permission/shell-option（7）

- 0xArtex/Palmyr `src/tests/agent-skills-wellknown.test.ts:116` — 合法：固定参数 npm run build（无输入注入面）
- 0xArtex/Palmyr `src/tests/bazaar-discovery-metadata.test.ts:117` — 合法：固定参数 npm run build（无输入注入面）
- 0xArtex/Palmyr `src/tests/cli-guards.test.ts:69` — 合法：固定参数 npm run build（无输入注入面）
- 0xArtex/Palmyr `src/tests/i402-cli-smoke.test.ts:48` — 合法：固定参数 npm run build（无输入注入面）
- 0xArtex/Palmyr `src/tests/i402-end-to-end.test.ts:208` — 合法：固定参数 npm run build（无输入注入面）
- 0xArtex/Palmyr `src/tests/i402-server-boot.test.ts:104` — 合法：固定参数 npm run build（无输入注入面）
- 0xArtex/Palmyr `src/tests/mcp-server.test.ts:154` — 合法：固定参数 npm run build（无输入注入面）

### sensitive/hardcoded-secret（4）

- 0000F8/salt-mcp `tests/http-server.test.mjs:184` — 合法：测试假 token（结构占位，非真实凭据）
- 0000F8/salt-mcp `tests/http-server.test.mjs:207` — 合法：测试假 token（结构占位，非真实凭据）
- 0000F8/salt-mcp `tests/security-probe.test.mjs:85` — 合法：测试假 token（结构占位，非真实凭据）
- Downshift/rivalize-mcp `src/client.network.test.ts:117` — 合法：测试假 token（结构占位，非真实凭据）

### sensitive/private-key-block（2）

- 0xArtex/Palmyr `cli/compute-ssh.ts:34` — 合法：文档格式说明 / 浏览器端运行时生成密钥展示（无真实私钥入库）
- 0xArtex/Palmyr `public/dashboard.html:3357` — 合法：文档格式说明 / 浏览器端运行时生成密钥展示（无真实私钥入库） **〔已读源码确认〕**

### sensitive/connection-string（1）

- 0xArtex/Palmyr `tools/observability/plausible/.env.example:16` — 合法：.env.example 开发默认凭据（postgres:postgres@容器服务名）

### sensitive/unbounded-loop（1）

- 0xArtex/Palmyr `public/discovery/assets/index.js:90` — 合法：第三方前端 minified bundle（非 MCP 服务端逻辑）

### supplychain/install-scripts（1）

- AIStoryHub/etincel `package.json:29` — 合法：postinstall 自构建（tsconfig 存在才 npm run build） **〔已读源码确认〕**

### description/exfiltration-instructions（1）

- Agentic-Private-Office/fo-kg-door `public/webmcp.js:9` — 合法：联系表单工具描述，「send…message…to」正则分支误中（已读源码确认） **〔已读源码确认〕**
