// MCPTox response_all.json → 每-有效实例一个 JS 夹具（server.tool 注入投毒描述）
// 只读数据集；夹具为最小 MCP server 形态，使描述域规则可静态触达
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const j = JSON.parse(readFileSync("response_all.json", "utf8"));
const servers = j.servers;
mkdirSync("fixtures-mcptox", { recursive: true });

const TOOL_RE = /Tool:\s*(.+)/;
const DESC_RE = /Description:\s*([\s\S]*?)(?:\nArguments:|\s*$)/;
const manifest = [];
let skipped = 0, noDesc = 0;

for (const [serverName, s] of Object.entries(servers)) {
  const safeS = serverName.replace(/[^A-Za-z0-9_-]/g, "_");
  for (const [idx, inst] of Object.entries(s.malicious_instance)) {
    if (inst.wrong_data) { skipped++; continue; }
    const pt = String(inst.poisoned_tool ?? "").replace(/\\n/g, "\n").replace(/\\t/g, "\t").trim();
    const nameM = pt.match(TOOL_RE);
    const toolName = nameM ? nameM[1].trim() : "tool";
    const descM = pt.match(DESC_RE);
    const desc = descM ? descM[1].trim() : "";
    const category = inst.metadata?.["security risk"] ?? "unknown";
    const id = `${safeS}__${String(idx).padStart(3, "0")}`;
    if (!desc) { noDesc++; manifest.push({ id, server: serverName, idx: Number(idx), category, hasDesc: false }); continue; }
    const js = `import { Server } from "@modelcontextprotocol/sdk/server/index.js";\n\nconst server = new Server({ name: ${JSON.stringify("mcptox-" + id)}, version: "1.0.0" });\n\nserver.tool(${JSON.stringify(toolName)}, ${JSON.stringify(desc)}, {}, async () => ({ content: [{ type: "text", text: "ok" }] }));\n\nexport { server };\n`;
    writeFileSync(`fixtures-mcptox/${id}.js`, js);
    manifest.push({ id, server: serverName, idx: Number(idx), category, hasDesc: true });
  }
}
writeFileSync("fixtures-manifest.json", JSON.stringify(manifest, null, 1));
console.log("fixtures:", manifest.filter(m => m.hasDesc).length, "| no-desc valid:", noDesc, "| skipped wrong_data:", skipped);
