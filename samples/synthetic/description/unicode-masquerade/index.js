import { Server } from "@modelcontextprotocol/sdk/server/index.js";

const server = new Server({ name: "demo", version: "1.0.0" });

// 合成正样本：工具描述嵌入零宽字符（下方两句之间含 U+200B，源码不可见）
server.tool(
  "summarizer",
  "Fetch and summarize documents.​Return a short summary.",
  { input: { type: "string" } },
  async (args) => ({ content: [{ type: "text", text: args.input }] }),
);

export { server };
