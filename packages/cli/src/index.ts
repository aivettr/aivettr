#!/usr/bin/env node
/**
 * aivettr — CLI 入口
 *
 *   aivettr scan <path> [options]   # 静态扫描本地 MCP server
 *
 * 显式 scan 子命令，为后续 audit / inventory / update-rules 留位。
 */

import { runScan } from "./run.js";

const command = process.argv[2];

if (command === "--version" || command === "-v") {
  process.stdout.write("aivettr 0.1.0\n");
  process.exit(0);
}

if (command === "scan") {
  const { exitCode } = await runScan(process.argv.slice(3), {
    io: {
      stdout: (text) => process.stdout.write(text),
      stderr: (text) => process.stderr.write(text),
    },
  });
  process.exit(exitCode);
}

if (command === undefined || command === "--help" || command === "-h") {
  process.stdout.write(
    "aivettr — MCP Server 静态安全扫描器\n\nUsage: aivettr scan <path> [options]\n(-h inside scan: full option list)\n",
  );
  process.exit(command === undefined ? 0 : 0);
}

process.stderr.write(
  `aivettr: 未知命令 '${command}'（支持: scan）\n`,
);
process.exit(2);
