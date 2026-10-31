/**
 * @aivettr/scanner-core 核心类型（唯一事实源）
 *
 * 管道：文件采集（collector）→ 目标 adapter（mcp）→ analyzer（text/manifest/AST）
 *      → 规则判定（Rule.check）→ ScanResult（@aivettr/report 渲染）。
 */

export type Severity = "low" | "medium" | "high" | "critical";

export const SEVERITY_ORDER: Readonly<Record<Severity, number>> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export const SEVERITIES: readonly Severity[] = ["low", "medium", "high", "critical"];

/** 规则元信息；OWASP 条目为多对多映射（不进规则 id） */
export interface RuleMeta {
  readonly title: string;
  readonly description?: string;
  readonly severity: Severity;
  /** 形如 "LLM01:2026" / "ASI02" */
  readonly owasp: readonly string[];
}

export interface Location {
  /** 相对于扫描根的 posix 路径 */
  readonly file: string;
  readonly startLine: number;
  readonly startColumn: number;
  readonly endLine?: number;
  readonly endColumn?: number;
  readonly snippet?: string;
}

/** 规则 check 产出的原始命中（severity/owasp 由引擎按 meta 补全） */
export interface FindingInput {
  readonly message: string;
  readonly evidence?: string;
  readonly location?: Location;
}

/** 统一 Rule 接口：声明式 YAML 与代码规则均实现它 */
export interface Rule {
  readonly id: string;
  readonly meta: RuleMeta;
  check(ctx: ScanContext): FindingInput[];
}

/** 最终报告中的命中 */
export interface Finding {
  readonly ruleId: string;
  readonly severity: Severity;
  readonly message: string;
  readonly evidence?: string;
  readonly location?: Location;
  readonly owasp: readonly string[];
}

export type LanguageId =
  | "typescript"
  | "javascript"
  | "json"
  | "python"
  | "yaml"
  | "markdown"
  | "text";

export interface CollectedFile {
  /** 相对于扫描根的 posix 路径 */
  readonly path: string;
  readonly absPath: string;
  readonly content: string;
  readonly size: number;
  readonly language: LanguageId;
}

export interface SkippedFile {
  readonly path: string;
  readonly reason: "ignored" | "binary" | "too-large" | "invalid-utf8";
}

export interface PackageManifest {
  readonly file: string;
  readonly name?: string;
  readonly version?: string;
  readonly scripts: Readonly<Record<string, string>>;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly peerDependencies: Readonly<Record<string, string>>;
  readonly optionalDependencies: Readonly<Record<string, string>>;
  readonly bin?: unknown;
  readonly main?: string;
  readonly keywords?: readonly string[];
  readonly descriptionText?: string;
  readonly raw: Readonly<Record<string, unknown>>;
}

/** adapter/analyzer 抽取的工具描述（描述投毒规则的判定对象） */
export interface ToolDescription {
  readonly file: string;
  /** 工具名（能识别时） */
  readonly name?: string;
  readonly text: string;
  readonly startLine: number;
  readonly startColumn: number;
  readonly endLine?: number;
  readonly endColumn?: number;
}

export interface ImportRecord {
  readonly file: string;
  readonly module: string;
  readonly kind: "import" | "require";
  readonly isRelative: boolean;
  /** 包内相对导入解析到的采集文件路径；无法解析为 null；外部包为 undefined */
  readonly resolved?: string | null;
}

export type DangerousCallKind =
  | "eval"
  | "function-constructor"
  | "child-process"
  | "network-egress"
  | "shell-option"
  | "tls-disabled"
  | "base64-decode"
  | "unbounded-loop";

export interface DangerousCall {
  readonly file: string;
  readonly kind: DangerousCallKind;
  /** 调用/赋值的可读名称，如 child_process.exec、fetch、rejectUnauthorized */
  readonly name: string;
  /** 字面量目标（URL 等，能识别时） */
  readonly target?: string;
  readonly startLine: number;
  readonly startColumn: number;
  readonly endLine: number;
  readonly endColumn: number;
  readonly snippet: string;
}

export interface StringLiteralHit {
  readonly file: string;
  /** 解码后的值 */
  readonly value: string;
  /** 源码原文（含引号/转义，用于识别 \\x 混淆） */
  readonly rawText: string;
  readonly startLine: number;
  readonly startColumn: number;
  readonly endLine: number;
  readonly endColumn: number;
}

/** 代码规则可直接消费的 AST/文本信号集合 */
export interface ScanContext {
  readonly root: string;
  readonly files: readonly CollectedFile[];
  readonly manifest?: PackageManifest;
  readonly isMcp: boolean;
  readonly mcpSignals: readonly string[];
  readonly targetName: string;
  readonly descriptions: readonly ToolDescription[];
  readonly imports: readonly ImportRecord[];
  readonly calls: readonly DangerousCall[];
  readonly literals: readonly StringLiteralHit[];
  readonly bccProperties: readonly StringLiteralHit[];
  /** 按相对路径取文件 */
  file(path: string): CollectedFile | undefined;
}

export interface ScanOptions {
  readonly ignore?: readonly string[];
  readonly rules: readonly Rule[];
  /** 注入时钟，保证确定性输出 */
  readonly now?: Date;
  /** 单文件大小上限（字节），默认 1 MiB */
  readonly maxFileBytes?: number;
}

export interface ScanCounts {
  readonly total: number;
  readonly critical: number;
  readonly high: number;
  readonly medium: number;
  readonly low: number;
}

export interface ScanResult {
  readonly schemaVersion: "1.0";
  readonly tool: { readonly name: "aivettr"; readonly version: string };
  /** 唯一允许逐次扫描变化的字段 */
  readonly scannedAt: string;
  readonly target: {
    readonly path: string;
    readonly kind: "mcp-server" | "directory";
    readonly name: string;
    readonly detected: boolean;
  };
  readonly summary: ScanCounts;
  readonly findings: readonly Finding[];
  readonly stats: {
    readonly filesScanned: number;
    readonly filesSkipped: number;
    readonly rulesRun: number;
  };
}

/** 扫描器自身错误（路径不存在/配置非法/规则失败），CLI 映射退出码 2 */
export class ScanError extends Error {
  constructor(
    message: string,
    readonly code: "not-found" | "not-directory" | "invalid-manifest" | "rule-failed" | string,
  ) {
    super(message);
    this.name = "ScanError";
  }
}
