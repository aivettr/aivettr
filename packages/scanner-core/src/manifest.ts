/**
 * manifest 分析：解析 MCP server 项目根 package.json（管道第 3 段 analyzer 之一）。
 * 只接受普通字符串字段；非法 JSON → ScanError(invalid-manifest)。
 */

import type { PackageManifest } from "./types.js";
import { ScanError } from "./types.js";

function asStringRecord(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const [k, val] of Object.entries(v)) {
      if (typeof val === "string") out[k] = val;
    }
  }
  return out;
}

export function parsePackageJson(text: string, file = "package.json"): PackageManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new ScanError(
      `无法解析 ${file}: ${(err as Error).message}`,
      "invalid-manifest",
    );
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ScanError(`${file} 顶层必须是对象`, "invalid-manifest");
  }
  const obj = raw as Record<string, unknown>;
  return {
    file,
    name: typeof obj.name === "string" ? obj.name : undefined,
    version: typeof obj.version === "string" ? obj.version : undefined,
    scripts: asStringRecord(obj.scripts),
    dependencies: asStringRecord(obj.dependencies),
    devDependencies: asStringRecord(obj.devDependencies),
    peerDependencies: asStringRecord(obj.peerDependencies),
    optionalDependencies: asStringRecord(obj.optionalDependencies),
    bin: obj.bin,
    main: typeof obj.main === "string" ? obj.main : undefined,
    keywords: Array.isArray(obj.keywords)
      ? obj.keywords.filter((k): k is string => typeof k === "string")
      : undefined,
    descriptionText: typeof obj.description === "string" ? obj.description : undefined,
    raw: obj,
  };
}

/** 按点路径取字段（scripts.postinstall） */
export function getField(manifest: PackageManifest, path: string): unknown {
  let cur: unknown = manifest;
  for (const part of path.split(".")) {
    if (cur && typeof cur === "object") cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return cur;
}
