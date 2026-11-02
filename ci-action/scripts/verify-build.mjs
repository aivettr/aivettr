#!/usr/bin/env node
/**
 * 可复现构建校验：从源码重新执行与 build 完全相同的 ncc 打包到临时目录，
 * 与随仓提交的 dist/ 逐文件逐字节比对。
 *
 * 目的：证明 ci-action/dist 可由仓库源码复现、无夹带或被篡改
 * （GitHub Action runner 直接执行该产物，不重新安装依赖）。
 * 任何差异（文件缺失、多余、字节不一致）均以非零码失败。
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const pkgRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const committedDir = join(pkgRoot, "dist");

const rebuildDir = mkdtempSync(join(tmpdir(), "aivettr-ncc-verify-"));

function listFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(dir, p));
    }
  };
  walk(dir);
  return out.sort();
}

try {
  // 与 package.json build 脚本严格一致的参数
  execFileSync(
    join(pkgRoot, "node_modules", ".bin", process.platform === "win32" ? "ncc.cmd" : "ncc"),
    ["build", "src/index.ts", "-o", rebuildDir, "--minify", "--no-source-map-register"],
    { cwd: pkgRoot, stdio: ["ignore", "ignore", "inherit"] },
  );

  const committed = listFiles(committedDir);
  const rebuilt = listFiles(rebuildDir);

  const errors = [];
  if (JSON.stringify(committed) !== JSON.stringify(rebuilt)) {
    errors.push(
      `文件清单不一致\n  提交产物: ${JSON.stringify(committed)}\n  重新构建: ${JSON.stringify(rebuilt)}`,
    );
  }

  for (const rel of committed.filter((f) => rebuilt.includes(f))) {
    const a = readFileSync(join(committedDir, rel));
    const b = readFileSync(join(rebuildDir, rel));
    if (!a.equals(b)) {
      errors.push(
        `${rel} 字节不一致（提交 ${a.length}B sha256 ${createHash("sha256").update(a).digest("hex").slice(0, 16)}` +
          ` vs 重建 ${b.length}B sha256 ${createHash("sha256").update(b).digest("hex").slice(0, 16)}）`,
      );
    }
  }

  if (errors.length > 0) {
    console.error("可复现构建校验失败：\n- " + errors.join("\n- "));
    console.error("请在当前环境重新执行 pnpm --filter @aivettr/ci-action build 并提交 dist/；" +
      "不得手工修改 dist 产物。");
    process.exit(1);
  }

  console.log(`✅ 可复现构建校验通过：${committed.length} 个文件逐字节一致（${committed.join(", ")}）`);
} finally {
  rmSync(rebuildDir, { recursive: true, force: true });
}
