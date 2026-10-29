# Git 仓库信息（REPOSITORY）

| 项 | 值 |
|---|---|
| 仓库名 | **aivettr**（品牌 AIVettr，npm org `@aivettr`） |
| remote 地址 | （占位：`https://github.com/<org>/aivettr.git`，建仓后填写；建议同步注册 GitHub org `aivettr`） |
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
