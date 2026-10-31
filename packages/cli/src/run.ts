/**
 * scan 执行层：配置合并 → 规则装配 → 扫描 → 阈值判定 → 渲染/输出。
 * 不直接调用 process.exit，返回退出码，便于端到端测试。
 */

import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  SEVERITY_ORDER,
  scanProject,
  type Rule,
  type ScanResult,
  type Severity,
} from "@aivettr/scanner-core";
import { builtinRules, loadCustomRules } from "@aivettr/rulepack";
import { render, type ReportFormat } from "@aivettr/report";
import { HELP_TEXT, parseScanArgs, type ParsedArgs } from "./argv.js";
import { loadConfig, type AivettrConfig } from "./config.js";

export interface Io {
  stdout(text: string): void;
  stderr(text: string): void;
}

export interface RunDeps {
  io: Io;
  /** 注入时钟（测试用） */
  now?: Date;
}

function normalizeFormat(v: string | undefined): ReportFormat {
  if (v === undefined) return "text";
  if (v === "md") return "markdown";
  if (v === "text" || v === "json" || v === "sarif" || v === "markdown") return v;
  // argv 层已约束未知值；防御性回退
  return "text";
}

/** 同 id 自定义规则覆盖内置；severity 覆盖包装 */
function withSeverity(rule: Rule, severity: Severity): Rule {
  return {
    id: rule.id,
    meta: { ...rule.meta, severity },
    check: rule.check.bind(rule),
  };
}

async function assembleRules(
  args: ParsedArgs,
  config: AivettrConfig,
  targetDir: string,
  io: Io,
): Promise<Rule[]> {
  const byId = new Map<string, Rule>();
  for (const r of builtinRules()) byId.set(r.id, r);

  // 自定义声明式规则：目标目录与配置文件所在目录各找一次
  const customDirs = [
    join(targetDir, ".aivettr", "rules"),
    ...(config.source ? [join(dirname(config.source), "rules")] : []),
  ];
  for (const dir of [...new Set(customDirs)]) {
    for (const r of await loadCustomRules(dir)) byId.set(r.id, r);
  }

  // config rules{}：severity 覆盖与 enabled 开关
  const configDisabled = new Set<string>();
  for (const [id, rc] of Object.entries(config.rules ?? {})) {
    const rule = byId.get(id);
    if (!rule) {
      io.stderr(`warning: 配置引用了未知规则 ${id}，已忽略\n`);
      continue;
    }
    if (rc.severity) byId.set(id, withSeverity(rule, rc.severity));
    if (rc.enabled === false) configDisabled.add(id);
  }

  // CLI enable/disable 为最终裁决
  for (const id of args.disableRule) {
    if (!byId.has(id)) io.stderr(`warning: --disable-rule 引用了未知规则 ${id}\n`);
  }
  for (const id of args.enableRule) {
    if (!byId.has(id)) io.stderr(`warning: --enable-rule 引用了未知规则 ${id}\n`);
  }
  const disabled = new Set(configDisabled);
  for (const id of args.disableRule) disabled.add(id);
  for (const id of args.enableRule) disabled.delete(id);

  return [...byId.values()]
    .filter((r) => !disabled.has(r.id))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export interface ScanOutcome {
  readonly exitCode: 0 | 1 | 2;
  /** 成功完成扫描时附带结构化结果（供 CI action 等程序化调用方，避免反解析 text） */
  readonly result?: ScanResult;
  /** 本次实际生效的规则集合 */
  readonly rules?: readonly Rule[];
}

export async function runScan(argv: readonly string[], deps: RunDeps): Promise<ScanOutcome> {
  const { io } = deps;

  let args;
  try {
    args = parseScanArgs(argv);
  } catch (err) {
    io.stderr(`aivettr: ${(err as Error).message}\n`);
    return { exitCode: 2 };
  }

  if (args.help) {
    io.stdout(HELP_TEXT);
    return { exitCode: 0 };
  }

  if (!args.path) {
    io.stderr("aivettr: 缺少扫描路径\n用法: aivettr scan <path> [options]（-h 查看全部选项）\n");
    return { exitCode: 2 };
  }

  const failOn = args.failOn as Severity | undefined;
  if (failOn && !(failOn in SEVERITY_ORDER)) {
    io.stderr(`aivettr: --fail-on 非法（low/medium/high/critical）\n`);
    return { exitCode: 2 };
  }

  let config: AivettrConfig;
  try {
    config = await loadConfig(args.config, args.path);
  } catch (err) {
    io.stderr(`aivettr: ${(err as Error).message}\n`);
    return { exitCode: 2 };
  }

  const rules = await assembleRules(args, config, args.path, io);
  const ignore = [...(config.ignore ?? []), ...args.ignore];

  let result;
  try {
    result = await scanProject(args.path, {
      rules,
      ignore,
      ...(deps.now ? { now: deps.now } : {}),
    });
  } catch (err) {
    io.stderr(`aivettr: ${(err as Error).message}\n`);
    return { exitCode: 2 };
  }

  const threshold = failOn ?? config.failOn ?? "low";
  const reached = result.findings.some(
    (f) => SEVERITY_ORDER[f.severity] >= SEVERITY_ORDER[threshold],
  );

  const format = normalizeFormat(args.format ?? config.format);
  // 仅在输出到 TTY 且未关色时上色；写文件 / 管道 / --no-color 均为无色
  const useColor = !args.output && !args.noColor && (process.stdout.isTTY ?? false);
  const report = render({ result, format, rules, color: useColor });

  if (args.output) {
    await writeFile(args.output, report, "utf8");
    io.stderr(`报告已写入 ${args.output}\n`);
  } else if (!args.quiet || result.findings.length > 0) {
    io.stdout(report);
  }

  return { exitCode: reached ? 1 : 0, result, rules };
}
