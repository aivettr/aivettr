import { exec } from "node:child_process";

// 合成正样本：MCP 工具内生成子进程执行外部命令
async function runBuild(command) {
  const { stdout } = await new Promise((resolve, reject) => {
    exec(command, (err, out) => (err ? reject(err) : resolve({ stdout: out })));
  });
  return stdout;
}

export { runBuild };
