/**
 * text 渲染器（默认格式）：按严重级分组，file:line:col + 代码片段，末尾汇总。
 * 颜色：opts.color 显式传入；非 TTY 环境由 CLI 关色。
 */

import {
  SEVERITIES,
  type Finding,
  type Rule,
  type ScanResult,
  type Severity,
} from "@aivettr/scanner-core";

export interface RenderOptions {
  color?: boolean;
  rules?: readonly Rule[];
}

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
};

const SEV_COLOR: Record<Severity, string> = {
  critical: C.red,
  high: C.magenta,
  medium: C.yellow,
  low: C.cyan,
};

export function renderText(result: ScanResult, opts: RenderOptions = {}): string {
  const useColor = opts.color ?? false;
  const paint = (s: string, c: string): string => (useColor ? c + s + C.reset : s);
  const ruleById = new Map((opts.rules ?? []).map((r) => [r.id, r]));
  const out: string[] = [];

  out.push(paint(`AIVettr static scan — ${result.tool.version}`, C.bold));
  out.push(
    `Target: ${result.target.path} (${result.target.kind}${result.target.name ? `: ${result.target.name}` : ""})`,
  );
  out.push("");

  const bySeverity = groupBySeverity(result.findings);
  for (const sev of [...SEVERITIES].reverse()) {
    const list = bySeverity[sev];
    if (list.length === 0) continue;
    out.push(paint(`${sev.toUpperCase()} (${list.length})`, SEV_COLOR[sev] + C.bold));
    for (const f of list) {
      const title = ruleById.get(f.ruleId)?.meta.title;
      out.push(`  ${paint(f.ruleId, C.bold)}${title ? `  ${title}` : ""}`);
      out.push(`  ${f.message}`);
      if (f.location) {
        const loc = f.location;
        out.push(
          `  ${paint(`${loc.file}:${loc.startLine}:${loc.startColumn}`, C.dim)}`,
        );
        const snippet = loc.snippet;
        if (snippet) out.push(`    ${snippet.slice(0, 200)}`);
      }
      if (f.evidence && (!f.location?.snippet || f.evidence !== f.location.snippet)) {
        out.push(
          `${useColor ? C.dim : ""}  evidence: ${truncate(f.evidence, 160)}${useColor ? C.reset : ""}`,
        );
      }
      out.push("");
    }
  }

  if (result.findings.length === 0) {
    out.push(paint("No findings.", C.green));
    out.push("");
  }

  const s = result.summary;
  out.push(
    `Summary: ${s.total} finding(s) — ${s.critical} critical, ${s.high} high, ${s.medium} medium, ${s.low} low`,
  );
  out.push(
    `Files scanned: ${result.stats.filesScanned} (${result.stats.filesSkipped} skipped) · Rules run: ${result.stats.rulesRun}`,
  );
  for (const n of result.notices ?? []) {
    out.push(`Notice: ${n}`);
  }

  return out.join("\n") + "\n";
}

function groupBySeverity(findings: readonly Finding[]): Record<Severity, Finding[]> {
  const out: Record<Severity, Finding[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };
  for (const f of findings) out[f.severity].push(f);
  return out;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
