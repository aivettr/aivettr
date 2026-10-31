import type { Rule, ScanContext, Severity } from "@aivettr/scanner-core";
import { callLocation, finding, literalLocation } from "./helpers.js";

/** sensitive/hardcoded-secret：JS/TS 字符串字面量中的高置信凭据特征 */
interface SecretPattern {
  readonly re: RegExp;
  readonly label: string;
  readonly severity: Severity;
}

const SECRET_PATTERNS: readonly SecretPattern[] = [
  { re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, label: "AWS Access Key", severity: "critical" },
  { re: /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/g, label: "GitHub Token", severity: "critical" },
  { re: /\bxox[baprs]-[A-Za-z0-9-]{10,72}\b/g, label: "Slack Token", severity: "high" },
  { re: /\bnpm_[A-Za-z0-9]{36}\b/g, label: "npm Token", severity: "critical" },
  { re: /\bAIza[0-9A-Za-z_-]{35}\b/g, label: "Google API Key", severity: "high" },
  { re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, label: "JWT", severity: "medium" },
];

export const hardcodedSecret: Rule = {
  id: "sensitive/hardcoded-secret",
  meta: {
    title: "硬编码凭据（云厂商/平台 Token）",
    description:
      "字符串字面量匹配 AWS/GitHub/Slack/npm/Google 等平台凭据格式或 JWT，应立即轮换并改为环境变量注入。",
    severity: "high",
    owasp: ["LLM02:2026"],
  },
  check(ctx: ScanContext) {
    const out = [];
    // 同一字面量只报一次，取最高级别匹配
    const byKey = new Map<string, { l: (typeof ctx.literals)[number]; p: SecretPattern }>();
    for (const l of ctx.literals) {
      for (const p of SECRET_PATTERNS) {
        p.re.lastIndex = 0;
        if (p.re.test(l.value)) {
          const key = `${l.file}:${l.startLine}:${l.startColumn}`;
          const prev = byKey.get(key);
          if (!prev || severityRank(p.severity) > severityRank(prev.p.severity)) byKey.set(key, { l, p });
        }
      }
    }
    for (const { l, p } of byKey.values()) {
      out.push(
        finding(
          `硬编码${p.label}`,
          literalLocation(ctx, l),
          l.value.length > 160 ? l.value.slice(0, 160) : l.value,
        ),
      );
    }
    return out;
  },
};

function severityRank(s: Severity): number {
  return s === "critical" ? 3 : s === "high" ? 2 : s === "medium" ? 1 : 0;
}

/** sensitive/hardcoded-bcc：邮件对象硬编码 BCC/密送收件人（postmark-mcp 事件信号） */
export const hardcodedBcc: Rule = {
  id: "sensitive/hardcoded-bcc",
  meta: {
    title: "硬编码 BCC 密送收件人",
    description:
      "邮件选项对象中出现硬编码 BCC 地址，可在用户不知情时密送全部外发邮件——postmark-mcp 投毒事件（v1.0.16）即此形态。",
    severity: "high",
    owasp: ["LLM08:2026", "LLM02:2026"],
  },
  check(ctx: ScanContext) {
    return ctx.bccProperties.map((l) =>
      finding(
        `硬编码 BCC 密送地址：${l.value}`,
        literalLocation(ctx, l),
        l.rawText.slice(0, 160),
      ),
    );
  },
};

/** sensitive/credit-card-number：Luhn 校验通过的 13–16 位卡号字面量 */
const DIGITS = /^[0-9 -]{13,19}$/;

export const creditCardNumber: Rule = {
  id: "sensitive/credit-card-number",
  meta: {
    title: "硬编码银行卡号（Luhn 校验通过）",
    description: "字符串字面量为 13–16 位数字且通过 Luhn 校验，疑似真实卡号泄露。",
    severity: "medium",
    owasp: ["LLM02:2026"],
  },
  check(ctx: ScanContext) {
    const out = [];
    for (const l of ctx.literals) {
      if (!DIGITS.test(l.value)) continue;
      const digits = l.value.replace(/\D/g, "");
      if (digits.length < 13 || digits.length > 16) continue;
      if (luhnValid(digits)) {
        out.push(finding("硬编码银行卡号（Luhn 校验通过）", literalLocation(ctx, l), l.value));
      }
    }
    return out;
  },
};

function luhnValid(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** sensitive/unbounded-loop：无限循环无退出（消耗型滥用 LLM06） */
export const unboundedLoop: Rule = {
  id: "sensitive/unbounded-loop",
  meta: {
    title: "无界循环（消耗型滥用风险）",
    description:
      "while(true)/for(;;) 体内无可达 break，若工具输入可控制工作量则存在资源消耗滥用面。",
    severity: "low",
    owasp: ["LLM06:2026"],
  },
  check(ctx: ScanContext) {
    return ctx.calls
      .filter((c) => c.kind === "unbounded-loop")
      .map((c) =>
        finding(
          `无界循环：${c.name}`,
          callLocation(ctx, c.file, c.startLine, c.startColumn, c.endLine, c.endColumn),
          c.snippet,
        ),
      );
  },
};
