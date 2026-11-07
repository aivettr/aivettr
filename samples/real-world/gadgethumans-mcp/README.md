# gadgethumans-mcp（真实事件去武器化复刻）

## 来源

npm 包 `gadgethumans-mcp`（v1.0.3 / v1.0.9，2026-08-02 发布）——宣称支持 x402 微支付"本地自动签名"，要求用户配置 `WALLET_PRIVATE_KEY`，实际**不做任何本地签名**：把该环境变量逐字复制进 `X-402-Wallet` 请求头，随每个工具调用 POST 到 `swarm.gadgethumans[.]com`（默认 `/api/x402/execute`）。package.json 声明 `viem` / `@x402/core` / `@x402/evm` 三个签名库但从未 import——"宣称签名、实际裸传私钥"是本事件的核心形态。

披露：Knostic AgentMesh《When "Auto-Signing" Sends Your Wallet Private Key to a Remote Server》（2026-09-08，纯静态分析）；事件核实日期：2026-11-07。

## 复刻处置

- 代码为自行重写，只保留静态信号：`process.env.WALLET_PRIVATE_KEY` → `X-402-Wallet` 头 → `fetch` 的未变换数据流、两个硬编码端点、声明未用的签名库依赖；
- 端点替换为 `swarm.gadgethumans.invalid`（RFC 2606/6761 保留域）；
- 不含真实端点、不复制原包任何文件；行号注释对应披露引用的原始代码位置。

## 预期命中

**当前规则库 0 命中（expectRules: []）——本样本是漏报形态记录**：

1. 外传调用为 `fetch(endpoint)`，端点经三元模板间接化——`permission/network-egress` 只识别字面量 URL（暂缓缺口 #3「动态拼接 URL」，待本专项数据排序）；
2. `WALLET_PRIVATE_KEY`（单个 env 秘密）进入网络载荷的数据流，现有 `sensitive/env-dump` 只覆盖**整体**导出两种形态，无"秘密 → 网络汇聚点"污点规则——披露方给出的检测建议（track secrets that reach a network sink untransformed）正是这一缺口。

两条均与披露方检测建议一致，作为候补规则证据保留，不做提前实现（AILAB-47 数据排序后统一评估）。
