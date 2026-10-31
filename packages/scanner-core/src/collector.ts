/**
 * 文件采集（管道第 1 段）。
 *
 * 规格：不递归 node_modules / .git（硬剪枝），应用调用方 ignore glob；
 * 纯静态读取，不执行任何被测代码；二进制 / 非法 UTF-8 / 超限文件跳过并计数。
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import type { CollectedFile, LanguageId, SkippedFile } from "./types.js";
import { GlobMatcher } from "./util/glob.js";

const ALWAYS_PRUNE = new Set(["node_modules", ".git"]);
const DEFAULT_MAX_FILE_BYTES = 1 << 20; // 1 MiB

const EXT_LANGUAGE: Readonly<Record<string, LanguageId>> = {
  ".ts": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".jsx": "javascript",
  ".json": "json",
  ".py": "python",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".md": "markdown",
  ".markdown": "markdown",
};

function languageOf(name: string): LanguageId {
  const dot = name.lastIndexOf(".");
  if (dot === -1) return "text";
  return EXT_LANGUAGE[name.slice(dot).toLowerCase()] ?? "text";
}

function toPosix(p: string): string {
  return sep === "/" ? p : p.split(sep).join("/");
}

export interface CollectResult {
  readonly files: CollectedFile[];
  readonly skipped: SkippedFile[];
}

export async function collectFiles(
  root: string,
  opts: { ignore?: readonly string[]; maxFileBytes?: number } = {},
): Promise<CollectResult> {
  const ignores = new GlobMatcher(opts.ignore ?? []);
  const maxBytes = opts.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const files: CollectedFile[] = [];
  const skipped: SkippedFile[] = [];

  // 迭代式 DFS，不跟随目录符号链接，避免环
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: import("node:fs").Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      const relPosix = toPosix(relative(root, abs));

      if (entry.isDirectory()) {
        if (ALWAYS_PRUNE.has(entry.name)) continue;
        if (ignores.ignores(relPosix, true)) {
          skipped.push({ path: relPosix, reason: "ignored" });
          continue;
        }
        stack.push(abs);
      } else if (entry.isFile()) {
        if (ignores.ignores(relPosix, false)) {
          skipped.push({ path: relPosix, reason: "ignored" });
          continue;
        }
        const s = await stat(abs);
        if (s.size > maxBytes) {
          skipped.push({ path: relPosix, reason: "too-large" });
          continue;
        }
        const buf = await readFile(abs);
        // 二进制嗅探：前 8 KiB 含 NUL
        if (buf.subarray(0, 8192).includes(0)) {
          skipped.push({ path: relPosix, reason: "binary" });
          continue;
        }
        let content: string;
        try {
          content = new TextDecoder("utf-8", { fatal: true }).decode(buf);
        } catch {
          skipped.push({ path: relPosix, reason: "invalid-utf8" });
          continue;
        }
        files.push({
          path: relPosix,
          absPath: abs,
          content,
          size: buf.length,
          language: languageOf(entry.name),
        });
      }
      // 符号链接等其他类型：不跟随、不采集
    }
  }

  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  skipped.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { files, skipped };
}
