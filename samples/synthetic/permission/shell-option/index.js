import { spawn } from "node:child_process";

// 合成正样本：spawn 显式启用 shell（命令注入面）
function runGit(args) {
  return spawn("git", args, { shell: true });
}

export { runGit };
