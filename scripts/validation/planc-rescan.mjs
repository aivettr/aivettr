#!/usr/bin/env node
/** AILAB-50 语料回归重扫：node planc-rescan.mjs <语料根> <输出目录>（逐仓 aivettr scan --format json） */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CORPUS = process.argv[2] ?? "";
const OUT = process.argv[3] ?? "./scans-out";
const CLI = new URL("../../packages/cli/dist/index.js", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const repos = readdirSync(CORPUS).sort();
let done = 0;
for (const repo of repos) {
  const dir = join(CORPUS, repo);
  let json;
  try {
    json = execFileSync("node", [CLI, "scan", dir, "--format", "json"], {
      maxBuffer: 512 * 1024 * 1024,
      timeout: 120_000,
      encoding: "utf8",
    });
  } catch (err) {
    // 扫描命中时 CLI exit 1，stdout 仍是完整 JSON
    if (err.stdout) json = err.stdout;
    else {
      console.error("SCAN-FAIL", repo, err.message.slice(0, 120));
      continue;
    }
  }
  writeFileSync(join(OUT, `${repo}.json`), json);
  done++;
  if (done % 10 === 0) console.log(`${done}/${repos.length}`);
}
console.log("done", done);
