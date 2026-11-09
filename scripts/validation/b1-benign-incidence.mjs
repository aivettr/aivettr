#!/usr/bin/env node
/**
 * AILAB-50 M2-d · B1：行为劫持候选信号良性发生率实测
 * 三个候选信号（AILAB-47 方案 B 漏报分析定义）在 53 仓良性语料中的自然发生率：
 *   S1 <IMPORTANT>…</IMPORTANT> 包裹
 *   S2 you-MUST-first 链式（Before using X, you MUST first call Y / must first call）
 *   S3 priority-claim（description 优先级高于用户请求）
 * 另测 ignore-family（与现有 description/injection-directives 重叠度参考）。
 * 输出：逐信号计数 + 逐命中文件路径与上下文摘要（供人工分类：工具描述/文档叙述/无关）。
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const CORPUS = process.argv[2] ?? "";
if (!CORPUS) { console.error("用法: node b1-benign-incidence.mjs <良性语料根目录>（官方生态语料，浅克隆后传入）"); process.exit(2); }
const TEXT_EXT = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".json", ".yaml", ".yml", ".md", ".txt", ".py", ".toml"]);
const SKIP_DIR = new Set([".git", "node_modules"]);

const SIGNALS = [
  { id: "S1-important-wrap", re: /<IMPORTANT>([\s\S]{0,400}?)<\/IMPORTANT>/gi },
  { id: "S2-must-first-call", re: /(?:before\s+(?:using|calling)[^.\n]{0,80},?\s+)?(?:you\s+)?MUST\s+first\s+call\b[^.\n]{0,120}/gi },
  { id: "S3-priority-claim", re: /(?:this\s+description(?:'s)?\s+)?priority[^\n]{0,80}(?:higher|takes\s+precedence|overrides)[^\n]{0,80}(?:user|query|request|instruction)/gi },
  { id: "S4-ignore-family", re: /\bignore\s+(?:all\s+)?(?:previous|prior|other)\s+(?:instructions?|prompts?|rules?)/gi },
];

const hits = [];
function walk(dir, repo) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, repo);
    else {
      const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
      if (!TEXT_EXT.has(ext) || st.size > 1_500_000) continue;
      let text;
      try { text = readFileSync(p, "utf8"); } catch { continue; }
      for (const s of SIGNALS) {
        s.re.lastIndex = 0;
        let m;
        while ((m = s.re.exec(text)) !== null) {
          const lineNo = text.slice(0, m.index).split("\n").length;
          hits.push({
            signal: s.id,
            repo,
            file: p.slice(CORPUS.length + 1 + repo.length + 1),
            line: lineNo,
            excerpt: m[0].replace(/\s+/g, " ").slice(0, 140),
          });
          if (m[0].length === 0) s.re.lastIndex++;
        }
      }
    }
  }
}

const repos = readdirSync(CORPUS).sort();
for (const r of repos) walk(join(CORPUS, r), r);

const bySignal = {};
for (const h of hits) (bySignal[h.signal] ??= []).push(h);
for (const s of SIGNALS) {
  const list = bySignal[s.id] ?? [];
  const repoSet = new Set(list.map((h) => h.repo));
  console.log(`\n== ${s.id}: ${list.length} 处 / ${repoSet.size} 仓`);
  for (const h of list) {
    console.log(`  ${h.repo.slice(0, 26).padEnd(28)} ${h.file}:${h.line}  ${h.excerpt}`);
  }
}
console.log(`\n总命中 ${hits.length}`);
