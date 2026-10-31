import { describe, expect, it } from "vitest";
import { GlobMatcher, matchGlob } from "./glob.js";

describe("glob 匹配", () => {
  it("basename 语义匹配任意层级", () => {
    expect(matchGlob("*.js", "a/b/c.js")).toBe(true);
    expect(matchGlob("*.js", "a/b/c.ts")).toBe(false);
    expect(matchGlob("secret.key", "x/secret.key")).toBe(true);
  });

  it("锚定根路径", () => {
    expect(matchGlob("src/**", "src/a/b.js")).toBe(true);
    expect(matchGlob("src/**", "src")).toBe(true);
    expect(matchGlob("src/**", "lib/src/a.js")).toBe(false);
  });

  it("**/ 前缀匹配零或多层目录", () => {
    expect(matchGlob("**/test.js", "test.js")).toBe(true);
    expect(matchGlob("**/test.js", "a/test.js")).toBe(true);
    expect(matchGlob("**/test.js", "a/b/test.js")).toBe(true);
  });

  it("中段 **", () => {
    expect(matchGlob("a/**/b.js", "a/b.js")).toBe(true);
    expect(matchGlob("a/**/b.js", "a/x/y/b.js")).toBe(true);
    expect(matchGlob("a/**/b.js", "c/x/b.js")).toBe(false);
  });

  it("? 仅匹配单层单字符", () => {
    expect(matchGlob("a?.js", "ab.js")).toBe(true);
    expect(matchGlob("a?.js", "a/b.js")).toBe(false);
  });

  it("目录忽略：命中目录即忽略其内容", () => {
    const m = new GlobMatcher(["dist"]);
    expect(m.ignores("dist/a.js")).toBe(true);
    expect(m.ignores("src/dist/b.js")).toBe(true);
  });

  it("dirOnly 尾部斜杠不忽略同名文件", () => {
    const m = new GlobMatcher(["dist/"]);
    expect(m.ignores("dist", true)).toBe(true);
    expect(m.ignores("dist/app.js")).toBe(true);
    expect(m.ignores("dist")).toBe(false);
  });

  it("多模式", () => {
    const m = new GlobMatcher(["*.log", "coverage/**"]);
    expect(m.ignores("a/b.log")).toBe(true);
    expect(m.ignores("coverage/x.json")).toBe(true);
    expect(m.ignores("src/x.js")).toBe(false);
  });
});
