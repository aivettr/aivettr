import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveRelativeImport, scanProject, ScanError } from "./index.js";
import type { Rule } from "./types.js";

async function makeRoot(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "aivettr-scan-"));
  for (const [p, content] of Object.entries(files)) {
    await mkdir(join(root, ...p.split("/").slice(0, -1)), { recursive: true });
    await writeFile(join(root, ...p.split("/")), content);
  }
  return root;
}

const noopRule: Rule = {
  id: "test/noop",
  meta: { title: "noop", severity: "low", owasp: ["LLM01:2026"] },
  check: () => [],
};

describe("scanProject 管道", () => {
  it("路径不存在 → ScanError", async () => {
    await expect(
      scanProject(join(tmpdir(), "definitely-not-here-xyz"), { rules: [] }),
    ).rejects.toBeInstanceOf(ScanError);
  });

  it("识别 MCP server（SDK 依赖）", async () => {
    const root = await makeRoot({
      "package.json": JSON.stringify({
        name: "echo-mcp",
        dependencies: { "@modelcontextprotocol/sdk": "^1.0.0" },
      }),
      "index.js": `import { Server } from "@modelcontextprotocol/sdk";`,
    });
    const result = await scanProject(root, { rules: [noopRule] });
    expect(result.target.kind).toBe("mcp-server");
    expect(result.target.detected).toBe(true);
    expect(result.stats.filesScanned).toBe(2);
    expect(result.schemaVersion).toBe("1.0");
  });

  it("规则命中并入 finding，severity/owasp 从 meta 补全", async () => {
    const rule: Rule = {
      id: "test/hit",
      meta: { title: "hit", severity: "high", owasp: ["LLM04:2026"] },
      check: () => [{ message: "boom", location: {
        file: "index.js", startLine: 1, startColumn: 1,
      } }],
    };
    const root = await makeRoot({ "index.js": "x" });
    const result = await scanProject(root, { rules: [rule] });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe("high");
    expect(result.findings[0].owasp).toEqual(["LLM04:2026"]);
    expect(result.summary.high).toBe(1);
  });

  it("规则抛错 → ScanError(rule-failed)", async () => {
    const bad: Rule = {
      id: "test/bad",
      meta: { title: "bad", severity: "low", owasp: [] },
      check: () => { throw new Error("boom"); },
    };
    const root = await makeRoot({ "index.js": "" });
    await expect(scanProject(root, { rules: [bad] })).rejects.toBeInstanceOf(ScanError);
  });
});

describe("包内导入解析", () => {
  const paths = new Set(["src/a.ts", "src/b/index.js", "src/c.tsx"]);

  it("解析同级文件与扩展名补全", () => {
    expect(resolveRelativeImport("src/a.ts", "./c.tsx", paths)).toBe("src/c.tsx");
    expect(resolveRelativeImport("src/x/a.ts", "../a", paths)).toBe("src/a.ts");
  });

  it("解析目录 index", () => {
    expect(resolveRelativeImport("src/a.ts", "./b", paths)).toBe("src/b/index.js");
  });

  it("无法解析 → null", () => {
    expect(resolveRelativeImport("src/a.ts", "./missing", paths)).toBeNull();
  });
});
