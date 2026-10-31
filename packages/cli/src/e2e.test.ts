/**
 * 真正的端到端：spawn 已构建的 dist 二进制，验证退出码 0/1/2。
 * 依赖 build 产物；CI 中 build 先于 test 执行。
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileP = promisify(execFile);
const bin = new URL("../dist/index.js", import.meta.url).pathname;
const samplesRoot = new URL("../../../samples/", import.meta.url).pathname;

const hasBin = existsSync(bin);
const maybe = hasBin ? describe : describe.skip;

async function run(
  args: readonly string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileP(process.execPath, [bin, ...args]);
    return { code: 0, stdout, stderr };
  } catch (err) {
    const e = err as { code: number; stdout: string; stderr: string };
    return { code: e.code, stdout: e.stdout, stderr: e.stderr };
  }
}

maybe("CLI 二进制端到端", () => {
  it("exit 0：benign", async () => {
    const r = await run(["scan", join(samplesRoot, "benign/minimal-tool")]);
    expect(r.code).toBe(0);
  });

  it("exit 1：命中且默认阈值", async () => {
    const r = await run(["scan", join(samplesRoot, "synthetic/sensitive/hardcoded-bcc")]);
    expect(r.code).toBe(1);
  });

  it("exit 0：--fail-on critical 高于命中级别", async () => {
    const r = await run([
      "scan",
      join(samplesRoot, "synthetic/description/injection-directives"),
      "--fail-on", "critical",
    ]);
    expect(r.code).toBe(0);
  });

  it("exit 2：路径不存在", async () => {
    const r = await run(["scan", join(samplesRoot, "nope-xyz")]);
    expect(r.code).toBe(2);
    expect(r.stderr.length).toBeGreaterThan(0);
  });

  it("exit 2：非法配置文件", async () => {
    const r = await run([
      "scan",
      join(samplesRoot, "benign/minimal-tool"),
      "--config", join(samplesRoot, "no-such-config.json"),
    ]);
    expect(r.code).toBe(2);
  });

  it("--format sarif 输出到 stdout 可解析", async () => {
    const r = await run([
      "scan",
      join(samplesRoot, "synthetic/permission/process-execution"),
      "--format", "sarif",
    ]);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.version).toBe("2.1.0");
  });
});

(hasBin ? it : it.skip)("e2e 前置：dist 二进制存在", () => {
  expect(hasBin).toBe(true);
});
