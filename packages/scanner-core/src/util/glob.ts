/**
 * 轻量 glob 匹配（gitignore-lite，零依赖）。
 *
 * 支持：`*`（单层任意字符，不含 `/`）、`?`（单层单字符）、`**`（任意层级）、
 * 目录形式（`dist/` 仅匹配目录及其内容）。
 * 不含 `/` 的模式按 gitignore basename 语义匹配任意层级；含 `/` 则锚定扫描根。
 */

interface CompiledGlob {
  readonly regex: RegExp;
  /** basename 模式（无 `/`）：对每段路径名匹配 */
  readonly basename: boolean;
  /** 尾部 `/`：仅当目录或目录内内容命中 */
  readonly dirOnly: boolean;
}

function escapeRe(s: string): string {
  return s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

function compile(pattern: string): CompiledGlob {
  let p = pattern.trim().replace(/\\/g, "/");
  const dirOnly = p.endsWith("/");
  if (dirOnly) p = p.slice(0, -1);
  const basename = !p.includes("/");

  // 先算每段的片段正则，** 用哨兵标记，再按位置决定分隔符
  const DSTAR = "**DSTAR**";
  const segments = p.split("/");
  const segRe = segments.map((seg) => {
    if (seg === "**") return DSTAR;
    let re = "";
    for (const c of seg) {
      if (c === "*") re += "[^/]*";
      else if (c === "?") re += "[^/]";
      else re += escapeRe(c);
    }
    return re;
  });
  let out = "";
  for (let i = 0; i < segRe.length; i++) {
    const r = segRe[i];
    if (r === DSTAR) {
      if (segRe.length === 1) out += ".*";
      else if (i === 0) out += "(?:.*/)?";
      else if (i === segRe.length - 1) out += "(?:/.*)?";
      else out += "/(?:.*/)?"; // 中段：a + /(?:.*/)? + b
    } else {
      if (i > 0 && segRe[i - 1] !== DSTAR) out += "/";
      out += r;
    }
  }
  return { regex: new RegExp("^" + out + "$"), basename, dirOnly };
}

export class GlobMatcher {
  private readonly compiled: CompiledGlob[];

  constructor(patterns: readonly string[]) {
    this.compiled = patterns
      .map((p) => p.trim())
      .filter((p) => p.length > 0 && !p.startsWith("#"))
      .map(compile);
  }

  ignores(relPath: string, isDirectory = false): boolean {
    const path = relPath.replace(/^\/+|\/+$/g, "");
    const segments = path.split("/");
    for (const g of this.compiled) {
      if (g.basename) {
        for (let i = 0; i < segments.length; i++) {
          const isLast = i === segments.length - 1;
          if (g.regex.test(segments[i])) {
            if (g.dirOnly && isLast && !isDirectory) continue;
            return true;
          }
        }
        continue;
      }
      // 完整路径命中
      if (g.regex.test(path)) {
        if (g.dirOnly && !isDirectory) continue;
        return true;
      }
      // 任一祖先目录命中 → 目录内内容被忽略
      let prefix = "";
      for (let i = 0; i < segments.length - 1; i++) {
        prefix = i === 0 ? segments[0] : prefix + "/" + segments[i];
        if (g.regex.test(prefix)) return true;
      }
    }
    return false;
  }
}

export function matchGlob(pattern: string, relPath: string): boolean {
  return new GlobMatcher([pattern]).ignores(relPath);
}
