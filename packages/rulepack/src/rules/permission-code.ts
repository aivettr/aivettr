import type { Rule, ScanContext } from "@aivettr/scanner-core";
import { callLocation, finding } from "./helpers.js";

/** permission/process-execution：child_process 调用（AST） */
export const processExecution: Rule = {
  id: "permission/process-execution",
  meta: {
    title: "子进程执行能力（child_process）",
    description:
      "代码可生成子进程执行外部命令，MCP 工具因此获得超出数据处理边界的系统能力；应核对是否存在命令注入面与最小化必要性。",
    severity: "high",
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
      "代码向非本地主机发起 HTTP(S) 请求；MCP 工具的外联面应最小化并明确披露。动态拼接的 URL 不在本规则覆盖内。",
    severity: "medium",
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
      "spawn/execFile 显式传 shell:true，参数经 shell 解释，若含工具输入则存在命令注入风险。",
    severity: "medium",
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
