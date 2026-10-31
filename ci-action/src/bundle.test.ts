/**
 * ncc 产物冒烟：直接以 Actions runner 注入 INPUT_* 的方式 spawn dist/index.js。
 * 产物不存在时跳过（CI 中 build 先于 test，故实际执行）。
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileP = promisify(execFile);
const bundle = new URL("../dist/index.js", import.meta.url).pathname;
const samplesRoot = new URL("../../samples/", import.meta.url).pathname;
const hasBundle = existsSync(bundle);
const maybe = hasBundle ? describe : describe.skip;

async function run(
  inputs: Record<string, string>,
  workspace: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileP(process.execPath, [bundle], {
      env: {
        ...process.env,
        GITHUB_WORKSPACE: workspace,
        ...Object.fromEntries(
          Object.entries(inputs).map(([k, v]) => [`INPUT_${k.toUpperCase()}`, v]),
        ),
      },
    });
    return { code: 0, stdout, stderr };
  } catch (err) {
    const e = err as { code: number; stdout: string; stderr: string };
    return { code: e.code, stdout: e.stdout, stderr: e.stderr };
  }
}

maybe("ncc bundle 端到端", () => {
  it("benign → exit 0，生成 SARIF（上传关闭）", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "aivettr-bundle-"));
    const r = await run(
      {
        targets: join(samplesRoot, "benign/minimal-tool"),
        "upload-sarif": "false",
      },
      workspace,
    );
    expect(r.code).toBe(0);
    const sarif = JSON.parse(
      await readFile(join(workspace, ".aivettr-results/aivettr.sarif"), "utf8"),
    );
    expect(sarif.version).toBe("2.1.0");
  });

  it("命中 high 且 fail-on high → exit 1，日志区分安全失败", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "aivettr-bundle-"));
    const r = await run(
      {
        targets: join(samplesRoot, "synthetic/description/injection-directives"),
        "fail-on": "high",
        "upload-sarif": "false",
      },
      workspace,
    );
    expect(r.code).toBe(1);
    // @actions/core 的 annotation/error 命令写入 stdout
    expect(r.stdout).toMatch(/安全失败/);
  });
});

(hasBundle ? it : it.skip)("前置：ncc bundle 存在", () => {
  expect(hasBundle).toBe(true);
});
