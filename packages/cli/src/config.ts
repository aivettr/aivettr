/**
 * .aivettr.json 配置：自动发现（从目标路径向上查找，最近者生效）+
 * 校验。字段：failOn / format / ignore[] / rules{}。
 * 优先级：CLI 选项 > 配置文件 > 内置默认。
 */

import { readFile } from "node:fs/promises";
import { dirname, parse as parsePath, resolve } from "node:path";
import { SEVERITIES, type Severity } from "@aivettr/scanner-core";

export interface RuleConfig {
  readonly enabled?: boolean;
  readonly severity?: Severity;
}

export interface AivettrConfig {
  readonly failOn?: Severity;
  readonly format?: string;
  readonly ignore?: readonly string[];
  readonly rules?: Readonly<Record<string, RuleConfig>>;
  /** 发现路径（诊断用） */
  readonly source?: string;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const FORMATS = ["text", "json", "sarif", "markdown", "md"];

/** 从 startDir 向上查找 .aivettr.json，最近的文件生效 */
export async function discoverConfig(startDir: string): Promise<{ file: string; text: string } | undefined> {
  let dir = resolve(startDir);
  const { root } = parsePath(dir);
  while (true) {
    const file = `${dir}/.aivettr.json`;
    try {
      const text = await readFile(file, "utf8");
      return { file, text };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    if (dir === root) return undefined;
    dir = dirname(dir);
  }
}

export function parseConfig(text: string, source?: string): AivettrConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new ConfigError(`配置 JSON 解析失败: ${(err as Error).message}`);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ConfigError("配置顶层必须是对象");
  }
  const o = raw as Record<string, unknown>;

  const failOn = o.failOn;
  if (failOn !== undefined) {
    if (typeof failOn !== "string" || !SEVERITIES.includes(failOn as Severity)) {
      throw new ConfigError("failOn 非法（low/medium/high/critical）");
    }
  }
  const format = o.format;
  if (format !== undefined) {
    if (typeof format !== "string" || !FORMATS.includes(format)) {
      throw new ConfigError("format 非法（text/json/sarif/markdown）");
    }
  }
  let ignore: string[] | undefined;
  if (o.ignore !== undefined) {
    if (!Array.isArray(o.ignore) || o.ignore.some((g) => typeof g !== "string")) {
      throw new ConfigError("ignore 必须为字符串数组");
    }
    ignore = o.ignore;
  }
  let rules: Record<string, RuleConfig> | undefined;
  if (o.rules !== undefined) {
    if (!o.rules || typeof o.rules !== "object" || Array.isArray(o.rules)) {
      throw new ConfigError("rules 必须为对象");
    }
    rules = {};
    for (const [id, rc] of Object.entries(o.rules as Record<string, unknown>)) {
      if (!rc || typeof rc !== "object") throw new ConfigError(`rules.${id} 必须为对象`);
      const r = rc as Record<string, unknown>;
      if (r.enabled !== undefined && typeof r.enabled !== "boolean") {
        throw new ConfigError(`rules.${id}.enabled 必须为布尔`);
      }
      if (r.severity !== undefined) {
        if (typeof r.severity !== "string" || !SEVERITIES.includes(r.severity as Severity)) {
          throw new ConfigError(`rules.${id}.severity 非法`);
        }
      }
      rules[id] = {
        ...(r.enabled !== undefined ? { enabled: r.enabled } : {}),
        ...(r.severity !== undefined ? { severity: r.severity as Severity } : {}),
      };
    }
  }

  return {
    ...(failOn ? { failOn: failOn as Severity } : {}),
    ...(format ? { format: format as string } : {}),
    ...(ignore ? { ignore } : {}),
    ...(rules ? { rules } : {}),
    ...(source ? { source } : {}),
  };
}

export async function loadConfig(
  explicit: string | undefined,
  targetDir: string,
): Promise<AivettrConfig> {
  if (explicit) {
    const file = resolve(explicit);
    let text: string;
    try {
      text = await readFile(file, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new ConfigError(`配置文件不存在: ${explicit}`);
      }
      throw err;
    }
    return parseConfig(text, file);
  }
  const found = await discoverConfig(targetDir);
  return found ? parseConfig(found.text, found.file) : {};
}
