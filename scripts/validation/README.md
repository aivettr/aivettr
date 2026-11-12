# 真实世界验证脚本（AILAB-47 阶段 2）

配合根目录 `aivettr-planB-report.md` / `aivettr-planC-report.md` 使用。数据集本体按合规红线**不入库、用后销毁**，复现时按报告附录的 pinned 坐标重新获取并校验哈希。

| 脚本 | 用途 |
|---|---|
| `acceptance-check.mjs` | **一键验收**（面向不需要阅读代码的验收人）：全量测试汇总 + 11 个真实事件复刻「实际命中 vs 预期声明」逐仓比对 + 人话结论与后续动作提示 |
| `mcptox-gen-fixtures.mjs` | MCPTox `response_all.json` → 1312 个最小 MCP server 夹具 + manifest（需先按 pinned 坐标下载数据并核对 SHA256） |
| `planb-aggregate.mjs` | MCPTox 回放扫描结果 → 检出率矩阵报告 |
| `planc-fetch-registry.mjs` | 官方 MCP Registry → active+isLatest+GitHub 仓库清单 |
| `planc-aggregate.mjs` | 方案 C 扫描结果 → 分规则误报率报告 |
