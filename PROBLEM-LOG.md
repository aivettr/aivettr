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

### 记录模板

```
## [YYYY-MM-DD] <问题简述>
- 问题内容：<现象、复现路径、影响范围>
- 定位结论：<根因、证据链>
- 修复方向：<本次修复方案、涉及文件>
- 是否历史留存：<是/否>（若是，注明关联的历史条目）
- 状态：<已修复待验证 / 已验证>
```
