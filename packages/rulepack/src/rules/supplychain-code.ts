import type { Rule, ScanContext } from "@aivettr/scanner-core";
import { callLocation, finding } from "./helpers.js";

/** supplychain/dynamic-code-exec：eval / new Function / 动态 import·require（AST）。披露型信号（AILAB-50 调优 2026-11-09：官方生态 10/10 命中为插件懒加载/测试基建，降为 low） */
export const dynamicCodeExec: Rule = {
  id: "supplychain/dynamic-code-exec",
  meta: {
    title: "动态代码执行（eval / Function 构造器 / 动态导入）",
    description:
      "披露：出现 eval()、new Function() 或 import(变量)/require(变量) 动态加载，被加载代码静态不可见。本信号为能力披露（官方生态实测多为插件/驱动按名懒加载），恶意判定应结合加载来源（远程内容、用户输入）。",
    severity: "low",
    owasp: ["LLM04:2026", "LLM03:2026"],
  },
  check(ctx: ScanContext) {
    const out = [];
    for (const c of ctx.calls) {
      if (c.kind !== "eval" && c.kind !== "function-constructor" && c.kind !== "dynamic-import")
        continue;
      out.push(
        finding(
          `动态代码执行：${c.name}`,
          callLocation(ctx, c.file, c.startLine, c.startColumn, c.endLine, c.endColumn),
          c.snippet,
        ),
      );
    }
    return out;
  },
};

/** supplychain/obfuscated-code：\\x 转义聚集 / 超长 base64 字面量（AST） */
const HEX_IN_SOURCE = /\\x[0-9a-fA-F]{2}/g;
const LONG_BASE64 = /^[A-Za-z0-9+/]{120,}={0,2}$/;

export const obfuscatedCode: Rule = {
  id: "supplychain/obfuscated-code",
  meta: {
    title: "疑似混淆代码（hex 转义聚集 / 超长 base64 字面量）",
    description:
      "字符串源码含 4 个以上 \\xHH 转义或 120+ 字符 base64 字面量，常用于隐藏恶意逻辑。AILAB-50 调优（2026-11-09）：移除 atob / Buffer.from(...,'base64') 解码调用信号——官方生态 51 仓实测该形态全部为传输编码常规用法（40/40 合法），误报成本高于信号价值。",
    severity: "high",
    owasp: ["LLM04:2026"],
  },
  check(ctx: ScanContext) {
    const out = [];
    const reported = new Set<string>();

    for (const l of ctx.literals) {
      const hexCount = l.rawText.match(HEX_IN_SOURCE)?.length ?? 0;
      const longB64 = LONG_BASE64.test(l.value);
      if ((hexCount >= 4 && l.value.length >= 8) || longB64) {
        const key = `${l.file}:${l.startLine}`;
        if (reported.has(key)) continue;
        reported.add(key);
        out.push(
          finding(
            longB64 ? "超长 base64 字面量，疑似隐藏载荷" : "字符串含密集 hex 转义，疑似混淆",
            callLocation(ctx, l.file, l.startLine, l.startColumn, l.endLine, l.endColumn),
            l.rawText.slice(0, 160),
          ),
        );
      }
    }

    return out;
  },
};
