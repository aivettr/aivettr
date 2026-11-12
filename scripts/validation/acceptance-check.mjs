#!/usr/bin/env node
/**
 * AILAB-47 阶段 2 一键验收脚本（面向不需要阅读代码的验收人）。
 *
 * 做三件事，全部输出人话结论：
 *  1. 提示/执行全量测试（pnpm test），汇总 passed/failed；
 *  2. 逐个扫描 samples/real-world/ 下 11 个真实事件复刻，
 *     把「实际命中规则」与「expect.json 声明的预期」逐仓比对；
 *  3. 输出最终 PASS/FAIL 与后续动作提示（issue 关闭/验收）。
 *
 * 用法：node scripts/validation/acceptance-check.mjs
 * 前置：pnpm install && pnpm build（脚本检测到缺产物时会提示）
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const cli = join(root, "packages", "cli", "dist", "index.js");
const rwDir = join(root, "samples", "real-world");

let failures = 0;

console.log("== AILAB-47 阶段 2 一键验收 ==\n");

// ---------- 1/3 全量测试 ----------
console.log("[1/3] 全量测试（pnpm test，应全部 passed、无 failed）");
const t = spawnSync("pnpm", ["test"], { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
const testOut = (t.stdout ?? "") + (t.stderr ?? "");
const passed = [...testOut.matchAll(/Tests\s+(\d+) passed/g)].reduce((s, m) => s + Number(m[1]), 0);
const failed = [...testOut.matchAll(/(\d+) failed/g)].reduce((s, m) => s + Number(m[1]), 0);
if (!existsSync(cli)) {
  console.log("  ⚠ 未找到 CLI 构建产物，先执行：pnpm build（已自动执行）");
  spawnSync("pnpm", ["build"], { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
}
if (failed > 0 || Number.isNaN(passed) || passed === 0) {
  console.log(`  ✗ 测试未通过：passed=${passed} failed=${failed}`);
  failures++;
} else {
  console.log(`  ✓ 全部通过：${passed} 个测试 passed，0 failed`);
}

// ---------- 2/3 真实事件复刻逐仓比对 ----------
console.log("\n[2/3] 11 个真实事件复刻：实际命中 vs 预期声明（expect.json）");
const dirs = readdirSync(rwDir).filter((d) => existsSync(join(rwDir, d, "expect.json"))).sort();
for (const d of dirs) {
  const expect = JSON.parse(readFileSync(join(rwDir, d, "expect.json"), "utf8"));
  const want = [...expect.expectRules].sort();
  const r = spawnSync("node", [cli, "scan", join(rwDir, d), "--format", "json"], { encoding: "utf8" });
  let got = [];
  try {
    got = [...new Set(JSON.parse(r.stdout).findings.map((f) => f.ruleId))].sort();
  } catch {
    console.log(`  ✗ ${d}：扫描输出无法解析（CLI 异常）`);
    failures++;
    continue;
  }
  const same = JSON.stringify(got) === JSON.stringify(want);
  if (!same) failures++;
  console.log(`  ${same ? "✓" : "✗"} ${d}`);
  console.log(`      预期: ${want.join(", ") || "（无）"}`);
  console.log(`      实际: ${got.join(", ") || "（无）"}`);
  if (!same) console.log("      ↑ 不一致，需要处理");
}

// ---------- 3/3 结论与后续动作 ----------
console.log("\n[3/3] 结论");
if (failures === 0) {
  console.log("  ✓ 全部一致——机器可验证部分 PASS。");
  console.log("\n  剩余验收动作（在 Multica 上，无需本地执行）：");
  console.log("  - AILAB-50（调优批次）：已验收 OK，关闭该 issue；");
  console.log("  - AILAB-51（Python AST）：核对 AILAB-51 issue 内 M3 报告数字（Connor 8→121）后标记验收；");
  console.log("  - 完成后在本 issue 回复「验收通过」，agent 将发起 AILAB-47 结项。");
} else {
  console.log(`  ✗ 有 ${failures} 项不一致——请把本脚本完整输出贴回 AILAB-47 评论，agent 排查。`);
  process.exitCode = 1;
}
