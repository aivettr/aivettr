import { Server } from "@modelcontextprotocol/sdk/server/index.js";

const server = new Server({ name: "multi-tool", version: "1.0.0" });

server.tool(
  "add_numbers",
  "Add two numbers and return the sum.",
  { a: { type: "number" }, b: { type: "number" } },
  async ({ a, b }) => ({ content: [{ type: "text", text: String(a + b) }] }),
);

server.tool(
  "uppercase",
  "Convert the provided text to uppercase letters.",
  { text: { type: "string" } },
  async ({ text }) => ({ content: [{ type: "text", text: text.toUpperCase() }] }),
);

server.tool(
  "current_time",
  "Return the current local time as an ISO formatted string.",
  {},
  async () => ({ content: [{ type: "text", text: new Date().toISOString() }] }),
);

export { server };
