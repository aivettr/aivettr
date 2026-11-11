import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scanProject } from "@aivettr/scanner-core";
import { builtinRules } from "@aivettr/rulepack";

const samplesRoot = new URL("../../../samples/", import.meta.url).pathname;
const FIXED_NOW = new Date("2026-11-01T00:00:00.000Z");

interface ExpectJson {
  expectRules: string[];
}

/** 递归找全部含 expect.json 的样本目录 */
async function findSamples(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(d: string): Promise<void> {
    const entries = await readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.name === "expect.json") out.push(d);
    }
  }
  await walk(dir);
  return out.sort();
}

describe("样本集 expect.json 校验", () => {
  const sampleDirsP = findSamples(samplesRoot);

  it("样本数量 ≥46（synthetic 32 + benign 3 + realworld 11）", async () => {
    const dirs = await sampleDirsP;
    expect(dirs.length).toBeGreaterThanOrEqual(46);
  });

  it("每个样本命中规则集合与 expectRules 精确一致", async () => {
    const rules = builtinRules();
    const dirs = await sampleDirsP;
    for (const dir of dirs) {
      const spec = JSON.parse(await readFile(join(dir, "expect.json"), "utf8")) as ExpectJson;
      const result = await scanProject(dir, { rules, now: FIXED_NOW });
      const actual = [...new Set(result.findings.map((f) => f.ruleId))].sort();
      const wanted = [...spec.expectRules].sort();
      if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
        throw new Error(
          `样本 ${dir.replace(samplesRoot, "")} 命中不一致\n  实际: ${JSON.stringify(actual)}\n  预期: ${JSON.stringify(wanted)}`,
        );
      }
    }
  });
});

describe("验收 3：真实事件复刻", () => {
  const rules = builtinRules();

  it("postmark-mcp 命中 LLM08 规则", async () => {
    const dir = join(samplesRoot, "real-world/postmark-mcp");
    const result = await scanProject(dir, { rules, now: FIXED_NOW });
    expect(result.findings.some((f) => f.owasp.includes("LLM08:2026"))).toBe(true);
  });

  it("tool-poisoning-poc 命中 LLM01 规则", async () => {
    const dir = join(samplesRoot, "real-world/tool-poisoning-poc");
    const result = await scanProject(dir, { rules, now: FIXED_NOW });
    expect(result.findings.some((f) => f.owasp.includes("LLM01:2026"))).toBe(true);
  });

  it("synthetic-python 命中至少 1 条文本规则", async () => {
    const dir = join(samplesRoot, "synthetic/synthetic-python/echo-poisoned");
    const result = await scanProject(dir, { rules, now: FIXED_NOW });
    expect(result.findings.length).toBeGreaterThan(0);
  });
});

describe("验收 4：确定性", () => {
  it("同输入两次扫描（固定时钟）JSON 逐字节一致", async () => {
    const dir = join(samplesRoot, "benign/multi-tool");
    const rules = builtinRules();
    const r1 = await scanProject(dir, { rules, now: FIXED_NOW });
    const r2 = await scanProject(dir, { rules, now: FIXED_NOW });
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("除 scannedAt 外结构与字段全部一致", async () => {
    const dir = join(samplesRoot, "benign/minimal-tool");
    const rules = builtinRules();
    const a = await scanProject(dir, { rules, now: new Date("2026-11-01T00:00:00Z") });
    const b = await scanProject(dir, { rules, now: new Date("2026-11-01T01:00:00Z") });
    expect(a.scannedAt).not.toBe(b.scannedAt);
    const { scannedAt: _s1, ...restA } = a;
    const { scannedAt: _s2, ...restB } = b;
    expect(restA).toEqual(restB);
  });
});
