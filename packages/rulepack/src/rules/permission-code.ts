import type { Rule, ScanContext } from "@aivettr/scanner-core";
import { callLocation, finding } from "./helpers.js";

/** permission/process-execution：child_process 调用（AST）。披露型信号（AILAB-50 调优 2026-11-09：官方生态 86/86 命中为合法用途，降为 low） */
export const processExecution: Rule = {
  id: "permission/process-execution",
  meta: {
    title: "子进程执行能力（child_process）",
    description:
      "披露：代码可生成子进程执行外部命令，MCP 工具因此获得超出数据处理边界的系统能力。本信号为能力披露（官方生态实测绝大多数为测试基建与 OS 工具链合法用途），恶意判定应结合其他信号（如命令拼接工具输入、与凭据/网络汇聚点共现）。",
    severity: "low",
    owasp: ["LLM03:2026"],
  },
  check(ctx: ScanContext) {
    return ctx.calls
      .filter((c) => c.kind === "child-process")
      .map((c) =>
        finding(
          `子进程调用：${c.name}`,
          callLocation(ctx, c.file, c.startLine, c.startColumn, c.endLine, c.endColumn),
          c.snippet,
        ),
      );
  },
};

/** permission/network-egress：对外部主机的网络访问（字面量 URL 可判定时） */
export const networkEgress: Rule = {
  id: "permission/network-egress",
  meta: {
    title: "外部网络出站能力",
    description:
      "披露：代码向非本地主机发起 HTTP(S) 请求（字面量 URL 可判定时）；MCP 工具的外联面应最小化并明确披露。本信号为能力披露（官方生态实测均为第一方服务 API 调用），恶意判定应结合敏感数据流共现。动态拼接的 URL 不在本规则覆盖内。",
    severity: "low",
    owasp: ["LLM03:2026"],
  },
  check(ctx: ScanContext) {
    return ctx.calls
      .filter((c) => c.kind === "network-egress")
      .map((c) =>
        finding(
          `外部网络请求：${c.name} → ${c.target ?? ""}`,
          callLocation(ctx, c.file, c.startLine, c.startColumn, c.endLine, c.endColumn),
          c.snippet,
        ),
      );
  },
};

/** permission/tls-verification-disabled */
export const tlsVerificationDisabled: Rule = {
  id: "permission/tls-verification-disabled",
  meta: {
    title: "TLS 证书校验被关闭",
    description:
      "设置 NODE_TLS_REJECT_UNAUTHORIZED=0 或 rejectUnauthorized:false，关闭证书校验后流量可被中间人截获。",
    severity: "high",
    owasp: ["LLM03:2026"],
  },
  check(ctx: ScanContext) {
    return ctx.calls
      .filter((c) => c.kind === "tls-disabled")
      .map((c) =>
        finding(
          `TLS 校验关闭：${c.name}`,
          callLocation(ctx, c.file, c.startLine, c.startColumn, c.endLine, c.endColumn),
          c.snippet,
        ),
      );
  },
};

/** permission/shell-option：spawn/execFile 传 shell:true */
export const shellOption: Rule = {
  id: "permission/shell-option",
  meta: {
    title: "子进程启用 shell（命令注入面）",
    description:
      "披露：spawn/execFile 显式传 shell:true，参数经 shell 解释，若含工具输入则存在命令注入风险。本信号为能力披露（官方生态实测均为固定参数构建调用），含用户输入时才构成实际注入面。",
    severity: "low",
    owasp: ["LLM03:2026"],
  },
  check(ctx: ScanContext) {
    return ctx.calls
      .filter((c) => c.kind === "shell-option")
      .map((c) =>
        finding(
          `子进程启用 shell：${c.name}`,
          callLocation(ctx, c.file, c.startLine, c.startColumn, c.endLine, c.endColumn),
          c.snippet,
        ),
      );
  },
};

/** permission/fs-sensitive-path：fs 写/删家族调用命中敏感路径标记（AST） */
export const fsSensitivePath: Rule = {
  id: "permission/fs-sensitive-path",
  meta: {
    title: "写敏感路径（SSH/云凭据/MCP 客户端配置）",
    description:
      "fs 写/删调用涉及 SSH/云凭据目录、shell 配置或 MCP 客户端配置文件等敏感路径（完整标记清单见规则库 YAML 说明）——工具越权触碰凭据与客户端配置，是配置投毒持久化的代码侧直接信号。",
    severity: "high",
    owasp: ["LLM03:2026"],
  },
  check(ctx: ScanContext) {
    return ctx.calls
      .filter((c) => c.kind === "fs-sensitive-path")
      .map((c) =>
        finding(
          `写入/删除敏感路径：${c.name}`,
          callLocation(ctx, c.file, c.startLine, c.startColumn, c.endLine, c.endColumn),
          c.snippet,
        ),
      );
  },
};
