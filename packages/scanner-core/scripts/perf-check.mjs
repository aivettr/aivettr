#!/usr/bin/env node
/**
 * 验收 5 证据脚本：生成 500 文件夹具 → 冷扫描 → 打印耗时与峰值 RSS。
 * 用法：node packages/scanner-core/scripts/perf-check.mjs
 */

import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanProject } from "../dist/index.js";

const N = 500;
const CLEAN = `import { Server } from "@modelcontextprotocol/sdk/server/index.js";
export function make(name) { return new Server({ name }, { capabilities: {} }); }
`;
const RISKY = `import { exec } from "node:child_process";
export function run(name) { exec("echo " + name); }
`;

const root = await mkdtemp(join(tmpdir(), "aivettr-perfcheck-"));
try {
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ name: "perf-fixture", dependencies: { "@modelcontextprotocol/sdk": "^1" } }),
  );
  for (let i = 0; i < N; i++) {
    const dir = join(root, "src", `mod${Math.floor(i / 25)}`);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${i % 10 === 0 ? "risky" : "clean"}-${i}.js`), i % 10 === 0 ? RISKY : CLEAN);
  }

  const t0 = performance.now();
  const result = await scanProject(root, {
    rules: [{ id: "perf/no-op", meta: { title: "x", severity: "low", owasp: [] }, check: () => [] }],
  });
  const elapsedMs = performance.now() - t0;
  const maxRssRaw = process.resourceUsage().maxRSS;
  const peakMB = maxRssRaw / 1024;

  console.log(JSON.stringify({
    filesScanned: result.stats.filesScanned,
    elapsedMs: Math.round(elapsedMs),
    peakRSS_MB: Number(peakMB.toFixed(1)),
    withinBudget: elapsedMs <= 10000 && peakMB <= 512,
  }, null, 2));
} finally {
  await rm(root, { recursive: true, force: true });
}
