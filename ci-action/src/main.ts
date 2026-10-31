/**
 * Action 核心逻辑（与 @actions/core 解耦，便于单测）。
 *
 * 定位：aivettr CLI 的薄包装 —— 把 inputs 翻译成 scan argv，逐目标调用
 * 与命令行完全相同的 runScan；annotations 直接来自结构化 ScanResult
 * （内部 JSON），不解析 text 报告；SARIF 合并多目标 runs 后上传。
 */

import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import {
  SEVERITY_ORDER,
  type Finding,
  type ScanResult,
  type Severity,
} from "@aivettr/scanner-core";
import type { ReportFormat } from "@aivettr/report";
import type { Io, ScanOutcome } from "@aivettr/cli/api";

export type AnnotationKind = "notice" | "warning" | "failure";

export interface ActionInputs {
  readonly targets: readonly string[];
  readonly failOn: Severity;
  readonly format: ReportFormat;
  readonly config?: string;
  readonly ignore: readonly string[];
  readonly enableRules: readonly string[];
  readonly disableRules: readonly string[];
  readonly outputFile?: string;
  readonly uploadSarif: boolean;
  readonly uploadArtifact: boolean;
  readonly annotationLevel: Severity;
  readonly workingDirectory: string;
}

export class ActionInputError extends Error {}

/** raw input 访问器（@actions/core getInput 的最小抽象） */
export type RawInputs = (name: string) => string;

const SEVERITIES = ["low", "medium", "high", "critical"] as const;
const FORMATS = ["text", "json", "sarif", "markdown"] as const;

function splitList(v: string): string[] {
  return v
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function boolInput(v: string, name: string): boolean {
  if (v === "true") return true;
  if (v === "false") return false;
  throw new ActionInputError(`input ${name} 仅接受 true/false，收到：${v}`);
}

export function parseActionInputs(raw: RawInputs): ActionInputs {
  const targets = splitList(raw("targets"));
  if (targets.length === 0) {
    throw new ActionInputError("input targets 为必填（本地路径，空格或换行分隔）");
  }

  const failOn = (raw("fail-on") || "high") as Severity;
  if (!SEVERITIES.includes(failOn)) {
    throw new ActionInputError(`input fail-on 非法：${failOn}`);
  }

  const format = (raw("format") || "sarif") as ReportFormat;
  if (!FORMATS.includes(format)) {
    throw new ActionInputError(`input format 非法：${format}`);
  }

  const annotationLevel = (raw("annotation-level") || "low") as Severity;
  if (!SEVERITIES.includes(annotationLevel)) {
    throw new ActionInputError(`input annotation-level 非法：${annotationLevel}`);
  }

  const config = raw("config") || undefined;
  const outputFile = raw("output-file") || undefined;

  return {
    targets,
    failOn,
    format,
    ...(config ? { config } : {}),
    ignore: splitList(raw("ignore")),
    enableRules: splitList(raw("enable-rules")),
    disableRules: splitList(raw("disable-rules")),
    ...(outputFile ? { outputFile } : {}),
    uploadSarif: boolInput(raw("upload-sarif") || "true", "upload-sarif"),
    uploadArtifact: boolInput(raw("upload-artifact") || "false", "upload-artifact"),
    annotationLevel,
    workingDirectory: raw("working-directory") || process.env.GITHUB_WORKSPACE || process.cwd(),
  };
}

/** 把 action inputs + 单个绝对目标路径翻译成 scan argv（与命令行同契约） */
export function buildArgv(inputs: ActionInputs, absTarget: string): string[] {
  const argv = [absTarget, "--fail-on", inputs.failOn, "--quiet", "--no-color"];
  if (inputs.config) argv.push("--config", inputs.config);
  for (const g of inputs.ignore) argv.push("--ignore", g);
  for (const id of inputs.enableRules) argv.push("--enable-rule", id);
  for (const id of inputs.disableRules) argv.push("--disable-rule", id);
  return argv;
}

/**
 * severity → annotation 档位：
 * critical/high → failure，medium → warning，low → notice
 */
export function annotationKind(severity: Severity): AnnotationKind {
  if (severity === "critical" || severity === "high") return "failure";
  if (severity === "medium") return "warning";
  return "notice";
}

/** 合并多个 ScanResult 的 SARIF（同 schema，runs 拼接，符合 SARIF 2.1.0） */
export function mergeSarif(contents: readonly string[]): string {
  if (contents.length === 0) throw new ActionInputError("无 SARIF 可合并");
  const merged = JSON.parse(contents[0]) as { runs: unknown[] };
  for (const text of contents.slice(1)) {
    const s = JSON.parse(text) as { runs: unknown[] };
    merged.runs.push(...s.runs);
  }
  return JSON.stringify(merged);
}

export interface AnnotationProps {
  readonly file?: string;
  readonly startLine?: number;
  readonly endLine?: number;
}

export interface ActionDeps {
  readonly runScan: (
    argv: readonly string[],
    deps: { io: Io },
  ) => Promise<ScanOutcome>;
  readonly renderSarif: (result: ScanResult) => string;
  readonly renderFormat: (result: ScanResult, format: ReportFormat) => string;
  readonly log: {
    info(msg: string): void;
    warn(msg: string): void;
  };
  readonly emitAnnotation: (
    kind: AnnotationKind,
    message: string,
    props: AnnotationProps,
  ) => void;
  readonly setOutput: (name: string, value: string) => void;
  readonly uploadSarif?: (sarifContent: string) => Promise<string>;
  readonly uploadArtifact?: (files: readonly string[], rootDir: string) => Promise<string>;
}

export interface ActionResult {
  readonly exitCode: 0 | 1 | 2;
  readonly failure?: "security" | "tool";
  readonly counts: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  readonly reportPath?: string;
}

const DEFAULT_SARIF = join(".aivettr-results", "aivettr.sarif");

/**
 * 执行 action：chdir → 逐目标扫描 → 聚合 → annotations → 报告文件 → 上传 → outputs。
 * 失败分类：exit 1 为安全失败，exit 2 为工具错误（调用方日志须明确区分）。
 */
export async function runAction(
  inputs: ActionInputs,
  deps: ActionDeps,
): Promise<ActionResult> {
  process.chdir(inputs.workingDirectory);

  const io: Io = {
    stdout: () => {},
    stderr: (text) => deps.log.info(text.replace(/\n$/, "")),
  };

  const outcomes: { target: string; outcome: ScanOutcome }[] = [];
  for (const target of inputs.targets) {
    const absTarget = isAbsolute(target)
      ? resolve(target)
      : resolve(inputs.workingDirectory, target);
    const outcome = await deps.runScan(buildArgv(inputs, absTarget), { io });
    if (outcome.exitCode === 2) {
      return { exitCode: 2, failure: "tool", counts: emptyCounts() };
    }
    outcomes.push({ target: absTarget, outcome });
  }

  // 聚合
  const counts = emptyCounts();
  const allFindings: { target: string; finding: Finding }[] = [];
  for (const { target, outcome } of outcomes) {
    const result = outcome.result;
    if (!result) continue;
    counts.total += result.summary.total;
    counts.critical += result.summary.critical;
    counts.high += result.summary.high;
    counts.medium += result.summary.medium;
    counts.low += result.summary.low;
    for (const finding of result.findings) allFindings.push({ target, finding });
  }

  // annotations（受 annotation-level 阈值约束；文件路径换算为相对仓库根）
  const threshold = SEVERITY_ORDER[inputs.annotationLevel];
  for (const { target, finding } of allFindings) {
    if (SEVERITY_ORDER[finding.severity] < threshold) continue;
    const props: { file?: string; startLine?: number; endLine?: number } = {};
    if (finding.location) {
      const loc = finding.location;
      const relTarget = relative(process.cwd(), target);
      props.file = relTarget && !relTarget.startsWith("..")
        ? join(relTarget, loc.file)
        : loc.file;
      props.startLine = loc.startLine;
      props.endLine = loc.endLine ?? loc.startLine;
    }
    deps.emitAnnotation(
      annotationKind(finding.severity),
      `${finding.ruleId}: ${finding.message}`,
      props,
    );
  }

  // 报告文件：始终产出 SARIF（upload 需要）；format + output-file 另出一份
  const produced: string[] = [];
  const sarifPath = inputs.format === "sarif" && inputs.outputFile
    ? inputs.outputFile
    : DEFAULT_SARIF;
  const sarifContent = mergeSarif(
    outcomes.map(({ outcome }) => deps.renderSarif(outcome.result!)),
  );
  await mkdir(dirnameOf(sarifPath), { recursive: true });
  await writeFile(sarifPath, sarifContent, "utf8");
  produced.push(sarifPath);

  let reportPath = sarifPath;
  if (inputs.outputFile && inputs.format !== "sarif") {
    // 多目标时取首个结果渲染用户格式（SARIF 才是完整合并产物）
    const content = deps.renderFormat(outcomes[0].outcome.result!, inputs.format);
    await mkdir(dirnameOf(inputs.outputFile), { recursive: true });
    await writeFile(inputs.outputFile, content, "utf8");
    produced.push(inputs.outputFile);
    reportPath = inputs.outputFile;
  }
  deps.log.info(`报告已生成：${reportPath}`);

  // SARIF 上传：权限不足/API 失败一律降级为警告
  let sarifId = "";
  if (inputs.uploadSarif && deps.uploadSarif) {
    try {
      sarifId = await deps.uploadSarif(sarifContent);
      deps.log.info(`SARIF 已上传，sarif-id：${sarifId}`);
    } catch (err) {
      deps.log.warn(
        `SARIF 上传失败，已降级（不影响扫描结论）：${(err as Error).message}`,
      );
    }
  }

  if (inputs.uploadArtifact && deps.uploadArtifact) {
    try {
      const id = await deps.uploadArtifact(produced, process.cwd());
      deps.log.info(`报告已作为 artifact 上传：${id}`);
    } catch (err) {
      deps.log.warn(`artifact 上传失败，已降级：${(err as Error).message}`);
    }
  }

  // outputs（在可能的 setFailed 之前写入）
  deps.setOutput("total", String(counts.total));
  deps.setOutput("critical", String(counts.critical));
  deps.setOutput("high", String(counts.high));
  deps.setOutput("medium", String(counts.medium));
  deps.setOutput("low", String(counts.low));
  deps.setOutput("sarif-id", sarifId);
  deps.setOutput("report-path", reportPath);

  const securityFailed = outcomes.some(({ outcome }) => outcome.exitCode === 1);
  return {
    exitCode: securityFailed ? 1 : 0,
    ...(securityFailed ? { failure: "security" as const } : {}),
    counts,
    reportPath,
  };
}

function emptyCounts(): ActionResult["counts"] {
  return { total: 0, critical: 0, high: 0, medium: 0, low: 0 };
}

function dirnameOf(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i <= 0 ? "." : p.slice(0, i);
}
