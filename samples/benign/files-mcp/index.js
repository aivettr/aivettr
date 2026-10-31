import { readFile } from "node:fs/promises";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

const server = new Server({ name: "files-mcp", version: "1.0.0" });

server.tool(
  "read_text_file",
  "Read a UTF-8 text file from the local workspace and return its contents.",
  { path: { type: "string", description: "Relative path inside the workspace." } },
  async ({ path }) => {
    const text = await readFile(path, "utf8");
    return { content: [{ type: "text", text }] };
  },
);

export { server };
