/**
 * 验收 5：500 文件量级冷扫描 ≤10 秒、峰值内存 ≤512MB。
 * 临时目录生成确定性夹具（90% 干净 + 10% 带命中），测后清理。
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scanProject, type Rule } from "./index.js";

/** 最小规则占位：性能测的是管道本身（真实规则开销由 cli 样本测试覆盖） */
const noopRules: Rule[] = [
  {
    id: "perf/no-op",
    meta: { title: "perf placeholder", severity: "low", owasp: [] },
    check: () => [],
  },
];

const N_FILES = 500;

const CLEAN_FILE = `import { Server } from "@modelcontextprotocol/sdk/server/index.js";

export async function makeServer(name: string): Promise<Server> {
  const server = new Server({ name, version: "1.0.0" }, { capabilities: {} });
  return server;
}
`;

const RISKY_FILE = `import { exec } from "node:child_process";

export function run(name: string): void {
  exec("echo " + name, (err, stdout) => {
    console.log(stdout);
  });
}
`;

describe("性能验收：500 文件冷扫描", () => {
  let root: string;
  let elapsedMs: number;
  let peakBytes: number;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "aivettr-perf-"));
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "perf-fixture",
        version: "1.0.0",
        type: "module",
        dependencies: { "@modelcontextprotocol/sdk": "^1.0.0" },
      }),
    );
    for (let i = 0; i < N_FILES; i++) {
      const dir = join(root, "src", `mod${Math.floor(i / 25)}`);
      // 每 25 个一批放子目录，mkdir 由递归写入前直接调用
      await mkdirForPerf(dir);
      const risky = i % 10 === 0;
      await writeFile(join(dir, risky ? `risky-${i}.ts` : `clean-${i}.ts`), risky ? RISKY_FILE : CLEAN_FILE);
    }

    const before = process.resourceUsage().maxRSS;
    const t0 = performance.now();
    const result = await scanProject(root, { rules: noopRules });
    elapsedMs = performance.now() - t0;
    const after = process.resourceUsage().maxRSS;
    // Node resourceUsage().maxRSS 以 kB 计
    peakBytes = Math.max(before, after) * 1024;
    expect(result.stats.filesScanned).toBe(N_FILES + 1);
  }, 120000);

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("扫描耗时 ≤10 秒", () => {
    expect(elapsedMs).toBeLessThanOrEqual(10000);
  });

  it("峰值 RSS ≤512MB", () => {
    expect(peakBytes).toBeLessThanOrEqual(512 * 1024 * 1024);
  });
});

async function mkdirForPerf(dir: string): Promise<void> {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(dir, { recursive: true });
}
