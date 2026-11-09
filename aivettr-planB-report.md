# AIVettr 方案 B 报告：公开数据集回放（检出率矩阵·首批）

> AILAB-47 阶段 2 · 方案 B · 执行日期 2026-11-08 · 执行环境：本机 Docker（node:20-bookworm，--network none）

## 1. 数据集核实与许可（执行前逐个核实）

| 数据集 | 内容 | 托管 | 许可 | 获取记录 |
|---|---|---|---|---|
| MCPTox | 1348 实例 / 45 真实 MCP server（过滤无效 36 → **1312 有效投毒用例**，11 类风险） | zhiqiangwang4/MCPTox-Benchmark @ f85189f（坐标由 MIT 评测实现 stefanoamorelli/inspect-evals-mcptox 固定） | **上游未声明许可（license: null）** → 处置：研究目的使用、标注来源、投毒原文不进本仓库（只发布聚合统计） | raw 文件 SHA256 校验通过（79a90049…，与评测仓库 pinned 哈希逐字节一致） |
| MCPSecBench | 系统性安全基准：17 类攻击脚本 + server/client + prompt 数据集 | github.com/AIS2Lab/MCPSecBench | **MIT**（AIS2Lab 2025） | git clone --depth 1（2026-11-08） |
| arXiv 2604.01905（114 恶意 MCP server PoC） | PoCs/（6 类攻击 PoC）+ Dataset/Malicious（20 个 Python 恶意 server）+ Connor 检测器 | github.com/yiheng98/Connor | 检测器与 PoCs：**Apache-2.0**（须保留"仅用于教育与防御性安全研究"声明）；Dataset/：沿用上游第三方许可 | git clone --depth 1（2026-11-08） |

## 2. 执行环境与红线合规记录

- 扫描全部在一次性容器内执行：`docker run --rm --network none --cpus 4 --memory 8g`，仓库与数据集**只读挂载**，容器内无任何凭据，退出即销毁；
- 联网阶段（数据集获取/镜像拉取）与断网阶段（扫描）分离；样本**只静态读取**，未 install / 未执行 / 未构建任何数据集内容；
- 扫描器经 ncc 自包含 bundle 在容器内 Node 20 运行（同时完成跨 Node 版本验证：宿主 Node 25 构建 → 容器 Node 20 执行）；
- **零外联实测（2026-11-09 补充）**：在联网容器（默认 bridge 网络）内扫描全部 33 个样本，内核套接字表（`/proc/net/tcp{,6}`、`udp{,6}`）扫描前后快照均为 0 条、无任何非本地远端连接条目——扫描器不发起任何网络请求，静态分析不依赖网络；断网（`--network none`）是纵深防御的第二道闸，而非运行前提。
- 报告完成后本地数据集副本与夹具全部销毁；本仓库仅收录聚合统计与脱敏案例 ID。

## 3. 结果：MCPTox 检出率矩阵（主力）

回放方法：1312 个有效投毒用例各自生成为最小 MCP server 夹具（`server.tool(名, 投毒描述, …)`），静态扫描后按文件映射回用例。

**用例级检出 155/1312 = 11.8%**，全部来自描述域 3 条规则：injection-directives 145 条 / exfiltration-instructions 9 / tool-shadowing 3（条目级 157）。

### 按风险类别

| 风险类别 | 检出用例 | 用例数 | 检出率 |
|---|---|---|---|
| Financial Loss | 15 | 55 | 27% |
| Other | 1 | 4 | 25% |
| Code Injection | 12 | 63 | 19% |
| Information Manipulation | 46 | 269 | 17% |
| Service Disruption | 31 | 196 | 16% |
| Credential Leakage | 15 | 115 | 13% |
| Message Hijacking | 5 | 41 | 12% |
| Infrastructure Damage | 13 | 122 | 11% |
| Data Tampering | 8 | 117 | 7% |
| Instruction Tampering | 2 | 57 | 4% |
| Privacy Leakage | 7 | 273 | 3% |

### 漏报根因（1157 例全量信号量化）

漏报用例的投毒描述使用**行为劫持句式族**，与现有正则的"忽略指令/对用户隐瞒"句式族正交：

- `Before using X, you MUST first call Y`——工具链式调用劫持；
- `This description's priority is higher than the user's query/request`——优先级覆盖声明；
- `<IMPORTANT>…</IMPORTANT>` 包裹——合法文档罕见使用的标记。

漏报 1157 例中 **87%（1006 例）至少含一个候选信号**：`<IMPORTANT>` 39%、you-MUST-first 链式 32%、ignore 26%、Before-using 23%、priority-claim 12%。候选规则族「描述域行为劫持句式」检出上限约 89%——当前检出率的最大单一杠杆；实现前须过方案 C 良性语料误报回归（`<IMPORTANT>` 与 MUST-first 在合法文档中的自然发生率需实测）。

## 4. 结果：MCPSecBench 与 Connor（适用性分析）

| 数据集 | 命中 | 结论 |
|---|---|---|
| MCPSecBench（17 类攻击脚本，Python 为主） | 仅 1 条（client.py api-key-assignment） | **Python 无 AST 缺口（暂缓 #12）的代价量化**：攻击脚本的 os.system / subprocess / 网络外联全部不可见。该数据集对"MCP server 代码检测"适用性有限（多为攻击工具而非 server 本体） |
| Connor（PoCs 6 类 + Dataset/Malicious 20 个 Python 恶意 server） | 8 条：injection-directives 1（Poisonattack3 投毒 docstring，真阳性）；api-key-assignment 7（抽查 6 真——challenge7 携带多服务凭据清单的窃取型 server；1 误报——env 引用，与方案 C 同根因） | 描述投毒形态在 Python docstring 路径同样可检；行为型恶意（reverse_shell / backdoor 等实现层）超出静态描述域覆盖，属暂缓 #12 / #13 范畴 |

## 5. 反哺结论（输入暂缓项排序）

1. **候选新规则族「描述域行为劫持句式」**：MCPTox 数据支撑 87% 漏报覆盖——是检出率 11.8% → ~89% 的最大单一杠杆；实现前须以方案 C 良性语料回归验证误报；
2. **Python AST 缺口（暂缓 #12）**：两个数据集的攻击载荷主体是 Python——缺口代价从"理论风险"升级为"实测主覆盖缺失"，排序证据加权；
3. **api-key-assignment 误报**再添 1 例（Connor 检测器自身的 env 引用），与方案 C 结论互证；
4. **检出/误报合并视图**：MCPTox 11.8% 检出 vs 官方生态 27% 仓库 CI-fail 噪声——"提高检出"与"压降误报"同等紧迫；组合信号（描述句式 × 代码能力）是双向共同依赖。

## 附录：复现

- 数据固定：MCPTox response_all.json @ f85189f9ad12504c197c7f920ab818a40657b1fa，SHA256 79a90049be931c59e71446d6180b1d7f0d196d123d08a59bc155d142b5041c03；
- 夹具生成与聚合脚本随执行记录存档（PROGRESS.md 2.4）；数据集本体按红线销毁，复现时按 pinned 坐标重新获取并校验哈希。
