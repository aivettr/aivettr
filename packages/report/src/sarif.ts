/**
 * SARIF 2.1.0 渲染器。
 *
 * - 规则对象含 properties["security-severity"]（CVSS 风格 0..10 字符串）
 *   与 tags（owasp:LLMxx）；
 * - result 定位精确行列（SARIF 行列均 1-based）；
 * - level：critical/high → error，medium → warning，low → note。
 */

import {
  SEVERITIES,
  type Rule,
  type ScanResult,
  type Severity,
} from "@aivettr/scanner-core";

export interface SarifOptions {
  readonly rules?: readonly Rule[];
}

const SARIF_SCHEMA =
  "https://json.schemastore.org/sarif-2.1.0.json";

/** severity → security-severity（CVSS 风格基线分） */
const SECURITY_SCORE: Readonly<Record<Severity, string>> = {
  critical: "9.5",
  high: "8.0",
  medium: "5.5",
  low: "3.0",
};

function levelOf(sev: Severity): "error" | "warning" | "note" {
  if (sev === "critical" || sev === "high") return "error";
  if (sev === "medium") return "warning";
  return "note";
}

/** 规则 id 前缀 → 能力域 tag */
function domainTag(ruleId: string): string {
  const prefix = ruleId.split("/")[0];
  return `aivettr:${prefix}`;
}

export function renderSarif(result: ScanResult, opts: SarifOptions = {}): string {
  const ruleById = new Map((opts.rules ?? []).map((r) => [r.id, r]));

  // driver.rules：命中过的规则 + 提供了完整规则表时的全部规则（去重）
  const usedIds: string[] = [];
  for (const f of result.findings) {
    if (!usedIds.includes(f.ruleId)) usedIds.push(f.ruleId);
  }
  for (const r of opts.rules ?? []) {
    if (!usedIds.includes(r.id)) usedIds.push(r.id);
  }
  usedIds.sort();

  const driverRules = usedIds.map((id) => {
    const r = ruleById.get(id);
    const severity: Severity = r?.meta.severity ?? minSeverityOf(id, result);
    const owaspTags = r?.meta.owasp.map((o) => `owasp:${o}`) ?? [];
    const findingOwasp = owaspTagsFromFindings(id, result);
    const tags = unique([...owaspTags, ...findingOwasp.map((o) => `owasp:${o}`), domainTag(id)]);
    return {
      id,
      ...(r ? { name: r.meta.title } : {}),
      ...(r?.meta.description ? { shortDescription: { text: r.meta.description } } : {}),
      defaultConfiguration: { level: levelOf(severity) },
      properties: {
        "security-severity": SECURITY_SCORE[severity],
        tags,
      },
    };
  });

  const results = result.findings.map((f) => {
    const loc = f.location;
    const region = loc
      ? {
          startLine: loc.startLine,
          startColumn: loc.startColumn,
          ...(loc.endLine ? { endLine: loc.endLine } : {}),
          ...(loc.endColumn ? { endColumn: loc.endColumn } : {}),
        }
      : undefined;
    // SARIF 结构：locations[].physicalLocation.{artifactLocation,region}
    const locationItem =
      loc && region
        ? { physicalLocation: { artifactLocation: { uri: loc.file }, region } }
        : undefined;
    return {
      ruleId: f.ruleId,
      level: levelOf(f.severity),
      message: { text: f.message },
      ...(locationItem ? { locations: [locationItem] } : {}),
    };
  });

  const sarif = {
    $schema: SARIF_SCHEMA,
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "AIVettr",
            fullName: "AIVettr MCP static security scanner",
            version: result.tool.version,
            informationUri: "https://github.com/aivettr/aivettr",
            rules: driverRules,
          },
        },
        results,
      },
    ],
  };

  return JSON.stringify(sarif, null, 2) + "\n";
}

function minSeverityOf(id: string, result: ScanResult): Severity {
  let best: Severity = "low";
  for (const f of result.findings) {
    if (f.ruleId === id && rank(f.severity) > rank(best)) best = f.severity;
  }
  return best;
}

function owaspTagsFromFindings(id: string, result: ScanResult): string[] {
  const out: string[] = [];
  for (const f of result.findings) {
    if (f.ruleId === id) for (const o of f.owasp) if (!out.includes(o)) out.push(o);
  }
  return out;
}

function rank(s: Severity): number {
  return SEVERITIES.indexOf(s);
}

function unique<T>(arr: readonly T[]): T[] {
  return [...new Set(arr)];
}
