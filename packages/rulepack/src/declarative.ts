/**
 * 声明式 YAML 规则 → Rule 编译器。
 *
 * YAML 结构：
 *   id, meta{title,description?,severity,owasp[]}, match{...}
 * scope=descriptions：regex 作用于 adapter/analyzer 抽取的工具描述；
 * scope=files：globs 过滤文件（不给则全部），regex 作用于文件内容；
 *   skipGenerated: true 跳过生成物/数据块文件；downgrade[{globs,severity}] 按路径降级（AILAB-50 M2）；
 * scope=manifest：fields[{path, exists?|regex?}]，path 支持尾部 .* 枚举对象值。
 */

import {
  GlobMatcher,
  matchRegex,
  SEVERITIES,
  type FindingInput,
  type Location,
  type PackageManifest,
  type Rule,
  type ScanContext,
  type ToolDescription,
} from "@aivettr/scanner-core";
import { parse as parseYaml } from "yaml";
import { RuleLoadError } from "./errors.js";
import { generatedFilePaths, locateJsonValue as helpersLocateJsonValue, TEST_PATH } from "./rules/helpers.js";

const ID_RE = /^(description|supplychain|permission|sensitive)\/[a-z0-9][a-z0-9-]*$/;

interface FieldSpec {
  path: string;
  exists?: boolean;
  regex?: string;
  flags?: string;
}

/** 按路径降级：命中的文件路径匹配任一 glob 时 severity 降为指定级别（只降不升） */
interface DowngradeSpec {
  globs: string[];
  severity: (typeof SEVERITIES)[number];
}

interface MatchDef {
  scope: "descriptions" | "files" | "manifest";
  regex?: string;
  flags?: string;
  globs?: string[];
  /** 命中内容位于生成物/数据块文件时跳过（判定口径见 helpers.isGeneratedFile） */
  skipGenerated?: boolean;
  /** 测试夹具等低危上下文降权（AILAB-50 M2） */
  downgrade?: DowngradeSpec[];
  fields?: FieldSpec[];
  /** 命中时的 finding 消息（静态文本） */
  message: string;
}

interface RuleYaml {
  id: string;
  meta: {
    title: string;
    description?: string;
    severity: (typeof SEVERITIES)[number];
    owasp?: string[];
  };
  match: MatchDef;
}

function buildRegex(source: string, flags: string | undefined, where: string): RegExp {
  try {
    return new RegExp(source, flags);
  } catch (err) {
    throw new RuleLoadError(`非法正则（${where}）: ${(err as Error).message}`);
  }
}

/** 描述内匹配偏移 → 行/列（描述位置是字面量起点；+1 跳过引号） */
function descLocation(d: ToolDescription, index: number, length: number): Location {
  let line = d.startLine;
  let col = d.startColumn + 1;
  const prefix = d.text.slice(0, index);
  const nl = prefix.lastIndexOf("\n");
  if (nl !== -1) {
    const extraLines = prefix.split("\n").length - 1;
    line += extraLines;
    col = 1 + prefix.slice(nl + 1).length;
  } else {
    col += index;
  }
  const endNl = d.text.slice(0, index + length).lastIndexOf("\n");
  const endLine = endNl === -1 ? line : line + d.text.slice(0, index + length).split("\n").length - 1 - (line - d.startLine);
  const endCol =
    endNl === -1 ? col + length : 1 + d.text.slice(endNl + 1, index + length).length;
  return {
    file: d.file,
    startLine: line,
    startColumn: col,
    endLine,
    endColumn: endCol,
  };
}

function checkDescriptions(ctx: ScanContext, def: MatchDef): FindingInput[] {
  const message = def.message;
  const re = buildRegex(def.regex!, def.flags, "descriptions");
  const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
  const out: FindingInput[] = [];
  const seen = new Set<string>();
  for (const d of ctx.descriptions) {
    const local = new RegExp(re.source, flags);
    let m: RegExpExecArray | null;
    while ((m = local.exec(d.text)) !== null) {
      if (m[0].length === 0) {
        local.lastIndex++;
        continue;
      }
      const key = `${d.file}:${d.startLine}:${m.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        message,
        evidence: m[0].slice(0, 160),
        location: descLocation(d, m.index, m[0].length),
      });
    }
  }
  return out;
}

function checkFiles(ctx: ScanContext, def: MatchDef): FindingInput[] {
  const message = def.message;
  const re = buildRegex(def.regex!, def.flags, "files");
  const out: FindingInput[] = [];
  const generated = def.skipGenerated ? generatedFilePaths(ctx) : undefined;
  const downgradeRules = (def.downgrade ?? []).map((d) => ({
    test: (path: string) => d.globs.some((g) => positiveGlob(g, path)),
    severity: d.severity,
  }));
  const SEVERITY_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
  for (const f of ctx.files) {
    if (generated?.has(f.path)) continue;
    const matchesGlob = !def.globs || def.globs.some((g) => positiveGlob(g, f.path));
    if (!matchesGlob) continue;
    for (const m of matchRegex(f.content, re)) {
      const location = {
        file: f.path,
        startLine: m.line,
        startColumn: m.column,
        endLine: m.endLine,
        endColumn: m.endColumn,
        snippet: m.snippet.slice(0, 200),
      };
      const hit: FindingInput = { message, evidence: m.matchText.slice(0, 160), location };
      // 只降不升：取所有匹配降级规则中最低的级别
      let severity: DowngradeSpec["severity"] | undefined;
      for (const d of downgradeRules) {
        if (d.test(f.path) && (severity === undefined || SEVERITY_RANK[d.severity] < SEVERITY_RANK[severity]))
          severity = d.severity;
      }
      out.push(severity !== undefined ? { ...hit, severity } : hit);
    }
  }
  return out;
}

/** 正向 glob 匹配（复用 GlobMatcher：pattern 命中即认为匹配） */
function positiveGlob(pattern: string, relPath: string): boolean {
  return new GlobMatcher([pattern]).ignores(relPath);
}

function* enumerateField(
  manifest: PackageManifest,
  path: string,
): Generator<{ key: string; value: unknown }> {
  if (path.endsWith(".*")) {
    const parent = path.slice(0, -2);
    let cur: unknown = manifest;
    for (const part of parent.split(".")) {
      if (cur && typeof cur === "object") cur = (cur as Record<string, unknown>)[part];
      else return;
    }
    if (cur && typeof cur === "object" && !Array.isArray(cur)) {
      for (const [k, v] of Object.entries(cur)) yield { key: `${parent}.${k}`, value: v };
    }
    return;
  }
  let cur: unknown = manifest;
  for (const part of path.split(".")) {
    if (cur && typeof cur === "object") cur = (cur as Record<string, unknown>)[part];
    else cur = undefined;
  }
  yield { key: path, value: cur };
}

/** 在 package.json 文本中定位字段值（取行列，失败回退 1:1；实现移至 helpers 与代码规则共用） */
const locateJsonValue = helpersLocateJsonValue;

function checkManifest(ctx: ScanContext, def: MatchDef): FindingInput[] {
  const message = def.message;
  if (!ctx.manifest) return [];
  const pkg = ctx.file("package.json");
  const content = pkg?.content ?? "";
  const out: FindingInput[] = [];
  const seen = new Set<string>();

  for (const spec of def.fields ?? []) {
    const valueRe = spec.regex ? buildRegex(spec.regex, spec.flags, spec.path) : undefined;
    for (const entry of enumerateField(ctx.manifest, spec.path)) {
      const v = entry.value;
      if (typeof v !== "string" || v.length === 0) continue;
      let hit = false;
      if (spec.exists) hit = true;
      if (valueRe) {
        valueRe.lastIndex = 0;
        if (valueRe.test(v)) hit = true;
      }
      if (!hit) continue;
      const dedup = `${entry.key}:${v}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      out.push({
        message,
        evidence: `${entry.key} = ${v}`.slice(0, 160),
        location: locateJsonValue(content, entry.key, v),
      });
    }
  }
  return out;
}

function validate(obj: unknown, source?: string): RuleYaml {
  if (!obj || typeof obj !== "object") throw new RuleLoadError("顶层必须是对象", source);
  const o = obj as Record<string, unknown>;
  if (typeof o.id !== "string" || !ID_RE.test(o.id)) {
    throw new RuleLoadError(`非法规则 id（须 description|supplychain|permission|sensitive 前缀）`, source);
  }
  const meta = o.meta as Record<string, unknown> | undefined;
  if (!meta || typeof meta.title !== "string") {
    throw new RuleLoadError("meta.title 缺失", source);
  }
  if (typeof meta.severity !== "string" || !SEVERITIES.includes(meta.severity as never)) {
    throw new RuleLoadError(`meta.severity 非法（low/medium/high/critical）`, source);
  }
  if (meta.owasp !== undefined && !Array.isArray(meta.owasp)) {
    throw new RuleLoadError("meta.owasp 必须为数组", source);
  }
  const match = o.match as MatchDef | undefined;
  if (!match || !["descriptions", "files", "manifest"].includes(match.scope)) {
    throw new RuleLoadError("match.scope 非法（descriptions/files/manifest）", source);
  }
  if ((match.scope === "descriptions" || match.scope === "files") && typeof match.regex !== "string") {
    throw new RuleLoadError(`${match.scope} 作用域须提供 match.regex`, source);
  }
  if (match.skipGenerated !== undefined && typeof match.skipGenerated !== "boolean") {
    throw new RuleLoadError("match.skipGenerated 必须为布尔值", source);
  }
  if (match.downgrade !== undefined) {
    if (!Array.isArray(match.downgrade)) throw new RuleLoadError("match.downgrade 必须为数组", source);
    for (const spec of match.downgrade) {
      if (!Array.isArray(spec.globs) || spec.globs.length === 0 || !spec.globs.every((g) => typeof g === "string")) {
        throw new RuleLoadError("match.downgrade[].globs 必须为非空字符串数组", source);
      }
      if (!SEVERITIES.includes(spec.severity as never)) {
        throw new RuleLoadError("match.downgrade[].severity 非法（low/medium/high/critical）", source);
      }
    }
  }
  if (match.scope === "manifest" && (!Array.isArray(match.fields) || match.fields.length === 0)) {
    throw new RuleLoadError("manifest 作用域须提供 match.fields[]", source);
  }
  if (typeof match.message !== "string" || match.message.length === 0) {
    throw new RuleLoadError("match.message 缺失", source);
  }
  return o as unknown as RuleYaml;
}

export function compileDeclarativeRule(yamlText: string, source?: string): Rule {
  let obj: unknown;
  try {
    obj = parseYaml(yamlText);
  } catch (err) {
    throw new RuleLoadError(`YAML 解析失败: ${(err as Error).message}`, source);
  }
  const def = validate(obj, source);
  return {
    id: def.id,
    meta: {
      title: def.meta.title,
      ...(def.meta.description ? { description: def.meta.description } : {}),
      severity: def.meta.severity,
      owasp: def.meta.owasp ?? [],
    },
    check(ctx: ScanContext) {
      switch (def.match.scope) {
        case "descriptions":
          return checkDescriptions(ctx, def.match);
        case "files":
          return checkFiles(ctx, def.match);
        case "manifest":
          return checkManifest(ctx, def.match);
      }
    },
  };
}
