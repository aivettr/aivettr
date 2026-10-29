# Git 仓库信息（REPOSITORY）

| 项 | 值 |
|---|---|
| 仓库名 | **aivettr**（品牌 AIVettr，npm org `@aivettr`） |
| remote 地址 | **`https://github.com/aivettr/aivettr.git`**（org `aivettr` 下，public，2026-10-29 推送） |
| 托管平台 | **GitHub**（已确认，2026-10-29） |
| 默认分支 | `main`（已确认） |
| 分支策略 | `main` 保护 + feature 分支 + PR 评审；外部贡献走 PR 触发 CLA（已确认） |
| commit 规范 | Conventional Commits：`feat:` / `fix:` / `docs:` / `refactor:` / `test:` / `chore:`（已确认，初始化期间已实际执行） |
| 许可证 | **双许可**：AGPL-3.0（`LICENSE`）+ 商业许可（`LICENSE-COMMERCIAL.md`），已确认（2026-10-29）；CLA 草案见 `legal/` |
| CI | GitHub Actions：`.github/workflows/ci.yml`（install → typecheck → test → build） |

## 上传记录

- 2026-10-29：本地仓库初始化，基线提交（文档体系 + OWASP PDF）。**尚未推送到任何远程**，推送前需与用户确认内容与敏感信息检查。
- 2026-10-29：品牌定名 AIVettr 并完成全套落地；工程骨架（pnpm monorepo）建立。
- 2026-10-29：托管平台 GitHub 与 Git 规范确认；CI workflow 落地。**初始化完成**（待用户验收后按 6.6 流程推送）。
- 2026-10-29：GitHub org `aivettr` 由用户创建（Free 计划，用户角色 admin）；仓库 `aivettr/aivettr` 已建（public），全部 14 个初始化提交已推送到 `main`（推送前内容核查：无 .multica/.claude/CLAUDE.md 等平台内部文件，40 个入库文件均为开源内容）。`main` 分支保护已配置：PR 评审 + 禁止 force push/deletion + 管理员可绕过。
