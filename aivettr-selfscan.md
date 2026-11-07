> ⚠️ **发现 1 条命中：** 1 high

## 扫描元信息

| 项 | 值 |
|---|---|
| 工具 | AIVettr 0.1.0 |
| 扫描时间 | 2026-11-07T15:24:35.710Z |
| 目标路径 | /Users/mac/HarmonyOS\_APP/AISecurity-OpenSource |
| 目标类型 | directory |
| 识别名称 | aivettr-monorepo |
| 文件数 | 121（跳过 9） |
| 执行规则数 | 24 |

## 严重级别汇总

| Severity | 数量 |
|---|---|
| critical | 0 |
| high | 1 |
| medium | 0 |
| low | 0 |
| **合计** | **1** |

## high（1） {#high-1}

### 子进程执行能力（child\_process）

| 项 | 值 |
|---|---|
| 规则 | permission/process-execution |
| Severity | high |
| OWASP | LLM03:2026 |
| 位置 | ci-action/scripts/verify-build.mjs:38:3 |

子进程调用：child\_process.execFileSync

```
execFileSync(
```

---

本报告由 AIVettr 确定性静态引擎生成：不安装依赖、不运行被测代码，结果可离线复现。

以下维度不在本版本检测范围内：注册表信誉（版本史 / 下载量 / 维护者 / SLSA / 签名）、运行时动态行为、混淆变体、JS/TS 之外语言的深度语义、跨过程污点分析。

检出结论仅对本次扫描的代码快照与内置规则集负责，不构成全口径安全保证。
