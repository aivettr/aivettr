// 拉取官方 MCP registry 全量服务器条目，提取 active+isLatest 且带 GitHub 仓库的条目
let cursor = "";
const seen = new Map(); // serverName -> {repo, title, version}
for (let page = 0; page < 60; page++) {
  const url = `https://registry.modelcontextprotocol.io/v0/servers?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) { console.error("HTTP", res.status, "at page", page); break; }
  const j = await res.json();
  const list = j.servers ?? [];
  for (const item of list) {
    const s = item.server ?? {};
    const meta = item._meta?.["io.modelcontextprotocol.registry/official"] ?? {};
    if (meta.status !== "active" || meta.isLatest !== true) continue;
    const repo = s.repository?.url ?? s.repository?.source_url ?? "";
    if (!repo || !repo.includes("github.com")) continue;
    if (!seen.has(s.name)) seen.set(s.name, { name: s.name, title: s.title ?? "", repo, version: s.version ?? "" });
  }
  cursor = j.metadata?.nextCursor ?? j.nextCursor ?? "";
  if (!cursor) { console.error("done at page", page, "entries:", list.length); break; }
}
console.error("unique servers with github repo:", seen.size);
const repos = [...new Set([...seen.values()].map(v => v.repo.replace(/\.git$/, "").replace(/\/$/, "")))];
console.error("unique repos:", repos.length);
await (await import("node:fs/promises")).writeFile("repos.json", JSON.stringify({ servers: [...seen.values()], repos }, null, 2));
