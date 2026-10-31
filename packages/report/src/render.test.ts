import { describe, expect, it } from "vitest";
import { fixtureResult, fixtureRules, injectionResult } from "./fixture.js";
import {
  renderJson,
  renderMarkdown,
  renderSarif,
  renderText,
} from "./index.js";

describe("text 渲染", () => {
  it("快照", () => {
    expect(renderText(fixtureResult(), { rules: fixtureRules() })).toMatchSnapshot();
  });

  it("干净报告显示 No findings", () => {
    const r = fixtureResult();
    const clean = { ...r, findings: [], summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 } };
    expect(renderText(clean)).toContain("No findings.");
  });

  it("color 模式含 ANSI 转义", () => {
    const out = renderText(fixtureResult(), { color: true, rules: fixtureRules() });
    expect(out).toContain("\x1b[");
  });
});

describe("json 渲染", () => {
  it("快照与 schemaVersion", () => {
    const out = renderJson(fixtureResult());
    expect(out).toMatchSnapshot();
    expect(JSON.parse(out).schemaVersion).toBe("1.0");
  });
});

describe("sarif 渲染", () => {
  const out = renderSarif(fixtureResult(), { rules: fixtureRules() });
  const parsed = JSON.parse(out);

  it("快照", () => {
    expect(out).toMatchSnapshot();
  });

  it("SARIF 2.1.0 结构", () => {
    expect(parsed.version).toBe("2.1.0");
    expect(parsed.runs).toHaveLength(1);
    const run = parsed.runs[0];
    expect(run.tool.driver.name).toBe("AIVettr");
    expect(run.results).toHaveLength(2);
  });

  it("规则含 security-severity 与 owasp tag", () => {
    const rule = parsed.runs[0].tool.driver.rules.find(
      (r: { id: string }) => r.id === "description/injection-directives",
    );
    expect(rule.properties["security-severity"]).toBe("8.0");
    expect(rule.properties.tags).toContain("owasp:LLM01:2026");
  });

  it("结果定位精确行列且 level 正确", () => {
    const r0 = parsed.runs[0].results[0];
    expect(r0.locations[0].physicalLocation.region.startLine).toBe(4);
    expect(r0.locations[0].physicalLocation.region.startColumn).toBe(22);
    expect(r0.level).toBe("error");
  });
});

describe("markdown 渲染", () => {
  it("快照", () => {
    expect(renderMarkdown(fixtureResult(), { rules: fixtureRules() })).toMatchSnapshot();
  });

  it("干净报告保留元信息", () => {
    const r = fixtureResult();
    const clean = { ...r, findings: [], summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 } };
    const md = renderMarkdown(clean);
    expect(md).toContain("扫描通过");
    expect(md).toContain("扫描元信息");
  });

  it("五段式齐全", () => {
    const md = renderMarkdown(fixtureResult(), { rules: fixtureRules() });
    for (const h of ["扫描元信息", "严重级别汇总", "high（1）", "medium（1）"]) {
      expect(md).toContain(h);
    }
  });
});

/** 删除动态围栏代码块（块内原文不渲染，不参与注入面判定） */
function withoutFencedBlocks(md: string): string {
  return md.replace(/^`{3,}\n[\s\S]*?\n`{3,}$/gm, "");
}

describe("markdown 防注入", () => {
  const md = renderMarkdown(injectionResult());
  const prose = withoutFencedBlocks(md);

  it("无原始 HTML 标签（尖括号实体化）", () => {
    expect(prose).not.toMatch(/<img|\/script|<script>/);
    expect(prose).toContain("&lt;img");
    // evidence 中的 script 标签原文只允许出现在围栏代码块内
    expect(md).toContain("</script><script>");
    expect(prose).not.toContain("</script>");
  });

  it("链接/强调语法被转义", () => {
    expect(md).not.toContain("[click](javascript:alert(1))");
    expect(md).toContain("\\[click\\]");
    expect(md).not.toContain("**bold**");
  });

  it("代码片段用动态围栏（内容含 ``` 也不破坏结构）", () => {
    // 命中片段内含三反引号串，围栏必须 ≥4；全文围栏必须成对闭合
    const fences = md.match(/^`{4,}$/gm) ?? [];
    expect(fences.length).toBeGreaterThanOrEqual(2);
    expect(fences.every((f) => f.length >= 4)).toBe(true);
    // 围栏数成对
    expect(fences.length % 2).toBe(0);
  });

  it("不出现功能性 javascript: 协议链接（开括号已转义）", () => {
    expect(prose).not.toMatch(/\[click\]\(javascript:/);
    expect(prose).toContain("\\[click\\]");
  });

  it("命中 >20 条时生成目录", () => {
    const base = injectionResult();
    const findings = Array.from({ length: 21 }, (_, i) => ({
      ...base.findings[0],
      message: `finding ${i}`,
      location: {
        file: "a.js",
        startLine: i + 1,
        startColumn: 1,
      },
    }));
    const r = {
      ...base,
      summary: { total: 21, critical: 21, high: 0, medium: 0, low: 0 },
      findings,
    };
    const md = renderMarkdown(r);
    expect(md).toContain("## 目录");
    expect(md).toContain("](#critical-21)");
  });
});
