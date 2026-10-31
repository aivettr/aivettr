# aivettr-action（GitHub Actions 集成）

GitHub Action 形态的 AIVettr 扫描。**定位：CLI 的薄包装** —— 仅做 inputs 映射、annotations、SARIF/artifact 上传等胶水，检测逻辑全部在 `@aivettr/scanner-core`；本目录可整体裁撤（退回仅 CLI 形态）而不影响扫描器。

- 运行时：node20，入口 `dist/index.js`（`@vercel/ncc` 单文件打包，**dist 随仓库提交**，无需在 CI 中安装依赖即可运行本 Action）。
- 随 monorepo tag 分发，不单独建仓。

## 基本用法

```yaml
name: Security
on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read
  security-events: write # 上传 SARIF 到 code scanning 所必需

jobs:
  aivettr:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./ci-action # 仓库内引用；发布 tag 后可替换为 org/repo@v0.1.0
        with:
          targets: servers/mcp-server
```

## 多目标 + Markdown 报告 artifact

```yaml
- uses: ./ci-action
  with:
    targets: |
      servers/mcp-a
      servers/mcp-b
    fail-on: high              # Action 默认 high（CLI 默认 low）
    format: markdown
    output-file: .aivettr-results/report.md
    upload-artifact: true
    # fork PR 拿不到 security-events 写权限时，SARIF 上传自动降级为警告，步骤不因此失败
```

## Inputs

| 名称 | 必填 | 默认 | 说明 |
|---|---|---|---|
| `targets` | 是 | — | 仅本地路径，空格/换行分隔多目标 |
| `fail-on` | 否 | `high` | 达到该级别及以上令 CI 失败（low/medium/high/critical）。与 CLI 默认 low 刻意区分 |
| `format` | 否 | `sarif` | `output-file` 报告格式（text/json/sarif/markdown）；SARIF 始终生成供上传 |
| `config` | 否 | 自动发现 | 显式 `.aivettr.json` 路径 |
| `ignore` | 否 | — | 附加忽略 glob（空格/逗号/换行分隔） |
| `enable-rules` / `disable-rules` | 否 | — | 规则 id 列表，最终裁决 |
| `output-file` | 否 | — | 报告写盘路径（SARIF 默认 `.aivettr-results/aivettr.sarif`） |
| `upload-sarif` | 否 | `true` | 上传到 code scanning；失败降级为警告 |
| `upload-artifact` | 否 | `false` | 将报告作为 workflow artifact 上传 |
| `annotation-level` | 否 | `low` | annotations 最低严重级 |
| `working-directory` | 否 | `GITHUB_WORKSPACE` | 相对目标与输出的基准目录 |
| `github-token` | 否 | `${{ github.token }}` | 上传 SARIF 用 token |

## 退出码语义（与 CLI 一致）

- `0`：扫描成功完成，无达到 `fail-on` 阈值的命中；
- `1`：**安全失败** —— 命中达到阈值，步骤失败信息明确标注"安全失败（exit 1）"；
- `2`：**工具错误** —— 路径不存在 / 配置非法 / 规则加载失败等，日志标注"工具错误（exit 2）"。两类失败在日志中明确区分。

## Annotations

由内部结构化结果（ScanResult JSON）直接生成，**不解析 text 报告**：

- critical / high → error 档 annotation；
- medium → warning；
- low → notice；
- 受 `annotation-level` 阈值过滤；文件路径自动换算为相对仓库根。

## SARIF 上传与降级

SARIF 通过 GitHub code-scanning REST API 上传（与 `github/codeql-action/upload-sarif@v3` 同一端点），需要 `security-events: write` 权限。上传失败（权限不足、fork PR、网络错误等）一律降级为 warning，不影响扫描结论与退出码；`sarif-id` output 在成功时填充。

> 说明：node20 Action 无法在运行中调用另一个 Action，因此未直接 `uses: github/codeql-action/upload-sarif@v3`，而是调用其底层端点，产物与权限要求相同。如需完全由 upload-sarif@v3 处理，可设 `upload-sarif: false` 并自行增加步骤：
>
> ```yaml
> - uses: actions/checkout@v4
> - uses: ./ci-action
>   with:
>     targets: servers/mcp-a
>     upload-sarif: false
> - uses: github/codeql-action/upload-sarif@v3
>   with:
>     sarif_file: .aivettr-results/aivettr.sarif
> ```

## Outputs

`total` / `critical` / `high` / `medium` / `low`：各级命中数；`sarif-id`：SARIF 上传 id；`report-path`：生成的报告路径。

## 重新打包

```bash
pnpm install
pnpm --filter @aivettr/scanner-core build
pnpm --filter @aivettr/report --filter @aivettr/rulepack build
pnpm --filter @aivettr/cli build
pnpm --filter @aivettr/ci-action build   # ncc → ci-action/dist
```

修改 Action 代码后须重新打包并提交 `ci-action/dist/`。
