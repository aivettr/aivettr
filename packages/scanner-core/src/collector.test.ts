import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectFiles } from "./collector.js";

async function makeRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "aivettr-collect-"));
}

describe("文件采集", () => {
  let root: string;

  afterEach(() => {
    // 临时目录随系统清理；测试不再显式删除
  });

  it("跳过 node_modules 与 .git", async () => {
    root = await makeRoot();
    await mkdir(join(root, "node_modules", "pkg"), { recursive: true });
    await mkdir(join(root, ".git"), { recursive: true });
    await writeFile(join(root, "node_modules/pkg/x.js"), "bad");
    await writeFile(join(root, ".git/config"), "x");
    await writeFile(join(root, "index.js"), "ok");
    const { files } = await collectFiles(root);
    expect(files.map((f) => f.path)).toEqual(["index.js"]);
  });

  it("应用 ignore glob", async () => {
    root = await makeRoot();
    await mkdir(join(root, "dist"), { recursive: true });
    await writeFile(join(root, "dist/a.js"), "x");
    await writeFile(join(root, "a.log"), "x");
    await writeFile(join(root, "keep.js"), "x");
    const { files, skipped } = await collectFiles(root, { ignore: ["dist/**", "*.log"] });
    expect(files.map((f) => f.path)).toEqual(["keep.js"]);
    expect(skipped.some((s) => s.path === "dist")).toBe(true);
  });

  it("识别语言并跳过二进制", async () => {
    root = await makeRoot();
    await writeFile(join(root, "a.ts"), "const x = 1;");
    await writeFile(join(root, "b.py"), "x = 1");
    await writeFile(join(root, "bin.dat"), Buffer.from([1, 0, 2, 3]));
    const { files, skipped } = await collectFiles(root);
    const ts = files.find((f) => f.path === "a.ts");
    const py = files.find((f) => f.path === "b.py");
    expect(ts?.language).toBe("typescript");
    expect(py?.language).toBe("python");
    expect(skipped.some((s) => s.path === "bin.dat" && s.reason === "binary")).toBe(true);
  });
});
