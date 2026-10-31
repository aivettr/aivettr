/**
 * Markdown 渲染器（五段式）：
 * ① 结论横幅 ② 扫描元信息表 ③ 严重级别汇总 ④ 按 severity 分组详情
 * ⑤ 页脚（能力边界诚实披露）。
 *
 * 干净报告保留元信息作为合规证据；命中 >20 条自动生成目录。
 * 防 Markdown 注入：动态文本经转义；代码片段用动态长度围栏（比内容中最长
 * 反引号串更长）；不输出任何原始 HTML（HTML 元字符实体化）。
 */

import {
  SEVERITIES,
  type Finding,
  type Rule,
  type ScanResult,
  type Severity,
} from "@aivettr/scanner-core";

export interface MarkdownOptions {
  readonly rules?: readonly Rule[];
}

const FOOTER = [
  "本报告由 AIVettr 确定性静态引擎生成：不安装依赖、不运行被测代码，结果可离线复现。",
  "以下维度不在本版本检测范围内：注册表信誉（版本史 / 下载量 / 维护者 / SLSA / 签名）、运行时动态行为、混淆变体、JS/TS 之外语言的深度语义、跨过程污点分析。",
  "检出结论仅对本次扫描的代码快照与内置规则集负责，不构成全口径安全保证。",
];

/**
 * 动态文本 → Markdown 纯文本。
 * 先实体化 HTML 元字符（杜绝原始 HTML），再反斜杠转义行内 Markdown 结构符。
 */
function mdText(input: string): string {
  const s = input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return s.replace(/([\\`*_[\]#~|=])/g, "\\$1");
}

/** 表格单元格：转义 + 折叠换行 + 去首尾竖线风险 */
function mdCell(input: string): string {
  return mdText(input.replace(/\s*\n\s*/g, " / "));
}

/** 动态围栏代码块：围栏反引号数 > 内容中最长连续反引号 */
function fenced(content: string): string {
  let longest = 0;
  let run = 0;
  for (const ch of content) {
    if (ch === "`") {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }
  const fence = "`".repeat(Math.max(3, longest + 1));
  // 内容若以围栏可能的歧义开头（反引号起首行），前置空行已足够；
  // 结尾换行保证闭合围栏不与末行粘连
  return `${fence}\n${content.endsWith("\n") ? content : content + "\n"}${fence}`;
}

export function renderMarkdown(result: ScanResult, opts: MarkdownOptions = {}): string {
  const ruleById = new Map((opts.rules ?? []).map((r) => [r.id, r]));
  const s = result.summary;
  const out: string[] = [];

  // ① 结论横幅
  if (s.total === 0) {
    out.push("> ✅ **扫描通过：未发现命中。**");
  } else {
    const parts: string[] = [];
    for (const sev of [...SEVERITIES].reverse()) {
      if (s[sev] > 0) parts.push(`${s[sev]} ${sev}`);
    }
    out.push(`> ⚠️ **发现 ${s.total} 条命中：** ${mdText(parts.join(" · "))}`);
  }
  out.push("");

  // 目录（>20 条命中时）
  if (s.total > 20) {
    out.push("## 目录");
    out.push("");
    for (const sev of [...SEVERITIES].reverse()) {
      const n = s[sev];
      if (n > 0) out.push(`- [${sev}（${n}）](#${sev}-${n})`);
    }
    out.push("");
  }

  // ② 扫描元信息表
  out.push("## 扫描元信息");
  out.push("");
  out.push("| 项 | 值 |");
  out.push("|---|---|");
  out.push(`| 工具 | AIVettr ${mdText(result.tool.version)} |`);
  out.push(`| 扫描时间 | ${mdText(result.scannedAt)} |`);
  out.push(`| 目标路径 | ${mdCell(result.target.path)} |`);
  out.push(`| 目标类型 | ${mdText(result.target.kind)} |`);
  out.push(`| 识别名称 | ${mdCell(result.target.name)} |`);
  out.push(`| 文件数 | ${result.stats.filesScanned}（跳过 ${result.stats.filesSkipped}） |`);
  out.push(`| 执行规则数 | ${result.stats.rulesRun} |`);
  out.push("");

  // ③ 严重级别汇总
  out.push("## 严重级别汇总");
  out.push("");
  out.push("| Severity | 数量 |");
  out.push("|---|---|");
  for (const sev of [...SEVERITIES].reverse()) {
    out.push(`| ${sev} | ${s[sev]} |`);
  }
  out.push(`| **合计** | **${s.total}** |`);
  out.push("");

  // ④ 详情
  const bySeverity = groupBySeverity(result.findings);
  for (const sev of [...SEVERITIES].reverse()) {
    const list = bySeverity[sev];
    if (list.length === 0) continue;
    out.push(`## ${sev}（${list.length}） {#${sev}-${list.length}}`);
    out.push("");
    for (const f of list) {
      const rule = ruleById.get(f.ruleId);
      const title = rule?.meta.title ?? f.ruleId;
      out.push(`### ${mdText(title)}`);
      out.push("");
      out.push("| 项 | 值 |");
      out.push("|---|---|");
      out.push(`| 规则 | ${mdCell(f.ruleId)} |`);
      out.push(`| Severity | ${sev} |`);
      if (f.owasp.length > 0) out.push(`| OWASP | ${mdCell(f.owasp.join(", "))} |`);
      if (f.location) {
        out.push(
          `| 位置 | ${mdCell(`${f.location.file}:${f.location.startLine}:${f.location.startColumn}`)} |`,
        );
      }
      out.push("");
      out.push(mdText(f.message));
      out.push("");
      const snippet = f.location?.snippet;
      if (snippet) {
        out.push(fenced(snippet));
        out.push("");
      } else if (f.evidence) {
        out.push(fenced(f.evidence));
        out.push("");
      }
    }
  }

  // ⑤ 页脚
  out.push("---");
  out.push("");
  for (const line of FOOTER) out.push(mdText(line) + "\n");

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function groupBySeverity(findings: readonly Finding[]) {
  const out: Record<Severity, Finding[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };
  for (const f of findings) out[f.severity].push(f);
  return out;
}
