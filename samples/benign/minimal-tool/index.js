import { Server } from "@modelcontextprotocol/sdk/server/index.js";

const server = new Server({ name: "minimal-tool", version: "1.0.0" });

server.tool(
  "ping",
  "Reply with a fixed pong message.",
  {},
  async () => ({ content: [{ type: "text", text: "pong" }] }),
);

export { server };
