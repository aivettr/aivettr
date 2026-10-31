import { describe, expect, it } from "vitest";
import type { CollectedFile } from "../types.js";
import { analyzeJsTs } from "./ast.js";

function file(path: string, content: string): CollectedFile {
  return {
    path,
    absPath: path,
    content,
    size: content.length,
    language: path.endsWith(".ts") ? "typescript" : "javascript",
  };
}

describe("AST analyzer", () => {
  it("识别 child_process 危险调用", () => {
    const sig = analyzeJsTs(
      file("index.js", `import { exec } from "node:child_process";\nexec("rm -rf /");`),
    );
    const cp = sig.calls.filter((c) => c.kind === "child-process");
    expect(cp).toHaveLength(1);
    expect(cp[0].name).toBe("child_process.exec");
    expect(cp[0].startLine).toBe(2);
  });

  it("识别 eval 与 new Function", () => {
    const sig = analyzeJsTs(file("a.js", `eval("x"); new Function("return 1")();`));
    expect(sig.calls.some((c) => c.kind === "eval")).toBe(true);
    expect(sig.calls.some((c) => c.kind === "function-constructor")).toBe(true);
  });

  it("外部 fetch 命中，localhost 不命中", () => {
    const sig = analyzeJsTs(
      file("a.js",
        `fetch("https://api.example.invalid/x"); fetch("http://localhost:3000");`),
    );
    const net = sig.calls.filter((c) => c.kind === "network-egress");
    expect(net).toHaveLength(1);
    expect(net[0].target).toBe("https://api.example.invalid/x");
  });

  it("shell:true 与 rejectUnauthorized:false", () => {
    const sig = analyzeJsTs(
      file("a.js",
        `import { spawn } from "node:child_process";\nspawn("x", [], {shell: true});\nconst a = {rejectUnauthorized: false};`),
    );
    expect(sig.calls.some((c) => c.kind === "shell-option")).toBe(true);
    expect(sig.calls.some((c) => c.kind === "tls-disabled")).toBe(true);
  });

  it("bcc 属性提取", () => {
    const sig = analyzeJsTs(
      file("a.js", `const mail = { to: "u@x.invalid", bcc: "h@evil.invalid" };`),
    );
    expect(sig.bccProperties).toHaveLength(1);
    expect(sig.bccProperties[0].value).toBe("h@evil.invalid");
  });

  it("提取 server.tool(name, desc) 描述", () => {
    const sig = analyzeJsTs(
      file("a.js", `server.tool("echo", "Echo text.", {}, async () => ({}));`),
    );
    expect(sig.descriptions).toHaveLength(1);
    expect(sig.descriptions[0].name).toBe("echo");
  });

  it("对象字面量含 name+description 时提取描述（去重不会发生在 analyzer 层）", () => {
    const sig = analyzeJsTs(
      file("a.js", `const tools = [{ name: "x", description: "does x" }];`),
    );
    expect(sig.descriptions[0].text).toBe("does x");
  });

  it("字符串字面量提取（不含 import 模块名）", () => {
    const sig = analyzeJsTs(
      file("a.js", `import x from "y"; const s = "hello";`),
    );
    expect(sig.literals.some((l) => l.value === "hello")).toBe(true);
    expect(sig.literals.some((l) => l.value === "y")).toBe(false);
  });

  it("while(true) 无 break 命中无限循环", () => {
    const sig = analyzeJsTs(file("a.js", `while (true) { doWork(); }`));
    expect(sig.calls.some((c) => c.kind === "unbounded-loop")).toBe(true);
  });

  it("嵌套循环内 break 不消除外层无限循环", () => {
    const sig = analyzeJsTs(
      file("a.js", `while (true) { for (const x of xs) { break; } }`),
    );
    expect(sig.calls.some((c) => c.kind === "unbounded-loop")).toBe(true);
  });

  it("require 内联链识别 child_process", () => {
    const sig = analyzeJsTs(file("a.js", `require("child_process").execSync("id");`));
    expect(sig.calls.some((c) => c.kind === "child-process")).toBe(true);
    expect(sig.imports.some((i) => i.module === "child_process")).toBe(true);
  });
});
