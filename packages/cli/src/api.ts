/**
 * 程序化调用入口（CI action 等）：与命令行共用同一执行层，
 * 避免 import 带副作用的 bin 入口。
 */

export { runScan } from "./run.js";
export type { Io, RunDeps, ScanOutcome } from "./run.js";
