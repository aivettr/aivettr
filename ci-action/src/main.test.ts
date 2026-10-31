import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runScan } from "@aivettr/cli/api";
import { render, renderSarif } from "@aivettr/report";
import {
  type ActionInputs,
  type AnnotationKind,
  type AnnotationProps,
  annotationKind,
  buildArgv,
  mergeSarif,
  parseActionInputs,
  runAction,
} from "./main.js";

function rawMap(map: Record<string, string>): (name: string) => string {
  return (name) => map[name] ?? "";
}

describe("parseActionInputs", () => {
  it("默认值：fail-on high / format sarif / annotation-level low / upload-sarif true", () => {
    const inputs = parseActionInputs(rawMap({ targets: "./src" }));
    expect(inputs.failOn).toBe("high");
    expect(inputs.format).toBe("sarif");
    expect(inputs.annotationLevel).toBe("low");
    expect(inputs.uploadSarif).toBe(true);
    expect(inputs.uploadArtifact).toBe(false);
    expect(inputs.workingDirectory).toBe(process.env.GITHUB_WORKSPACE ?? process.cwd());
  });

  it("targets 支持空格/换行/逗号分隔", () => {
    const inputs = parseActionInputs(rawMap({ targets: "a\nb,c d" }));
    expect([...inputs.targets]).toEqual(["a", "b", "c", "d"]);
  });

  it("列表类 inputs 正确拆分", () => {
    const inputs = parseActionInputs(
      rawMap({
        targets: "x",
        ignore: "dist/**,build/**\n.vscode/*",
        "enable-rules": "a b",
        "disable-rules": "c,d",
      }),
    );
    expect([...inputs.ignore]).toEqual(["dist/**", "build/**", ".vscode/*"]);
    expect([...inputs.enableRules]).toEqual(["a", "b"]);
    expect([...inputs.disableRules]).toEqual(["c", "d"]);
  });

  it("targets 为空抛错", () => {
    expect(() => parseActionInputs(rawMap({}))).toThrow(/targets/);
  });

  it("非法 fail-on / format / annotation-level 抛错", () => {
    expect(() => parseActionInputs(rawMap({ targets: "x", "fail-on": "urgent" }))).toThrow();
    expect(() => parseActionInputs(rawMap({ targets: "x", format: "pdf" }))).toThrow();
    expect(() =>
      parseActionInputs(rawMap({ targets: "x", "annotation-level": "all" })),
    ).toThrow();
  });

  it("布尔 input 非法值抛错", () => {
    expect(() =>
      parseActionInputs(rawMap({ targets: "x", "upload-sarif": "yes" })),
    ).toThrow(/upload-sarif/);
  });
});

describe("buildArgv", () => {
  it("按契约翻译为 scan argv", () => {
    const inputs = parseActionInputs(
      rawMap({
        targets: "pkg",
        "fail-on": "critical",
        ignore: "a, b",
        "disable-rules": "r1",
        config: "cfg.json",
      }),
    );
    const argv = buildArgv(inputs, "/abs/pkg");
    expect(argv).toEqual([
      "/abs/pkg",
      "--fail-on", "critical",
      "--quiet", "--no-color",
      "--config", "cfg.json",
      "--ignore", "a",
      "--ignore", "b",
      "--disable-rule", "r1",
    ]);
  });
});

describe("annotationKind", () => {
  it("critical/high → failure，medium → warning，low → notice", () => {
    expect(annotationKind("critical")).toBe("failure");
    expect(annotationKind("high")).toBe("failure");
    expect(annotationKind("medium")).toBe("warning");
    expect(annotationKind("low")).toBe("notice");
  });
});

describe("mergeSarif", () => {
  it("多目标 runs 拼接，版本字段保持", () => {
    const a = JSON.stringify({ version: "2.1.0", $schema: "x", runs: [{ a: 1 }] });
    const b = JSON.stringify({ version: "2.1.0", $schema: "x", runs: [{ b: 2 }] });
    const merged = JSON.parse(mergeSarif([a, b]));
    expect(merged.version).toBe("2.1.0");
    expect(merged.runs).toHaveLength(2);
  });
});

interface Captured {
  annotations: { kind: AnnotationKind; message: string; props: AnnotationProps }[];
  outputs: Record<string, string>;
}

function deps(captured: Captured) {
  return {
    runScan,
    renderSarif,
    renderFormat: (r: Parameters<typeof render>[0]["result"], f: Parameters<typeof render>[0]["format"]) =>
      render({ result: r, format: f }),
    log: { info: () => {}, warn: () => {} },
    emitAnnotation(kind: AnnotationKind, message: string, props: AnnotationProps) {
      captured.annotations.push({ kind, message, props });
    },
    setOutput(name: string, value: string) {
      captured.outputs[name] = value;
    },
  };
}

const samplesRoot = new URL("../../samples/", import.meta.url).pathname;

describe("runAction 端到端（真实 runScan + 真实渲染器）", () => {
  let workdir: string;

  beforeAll(async () => {
    workdir = await mkdtemp(join(tmpdir(), "aivettr-action-"));
  });
  afterAll(async () => {
    await rm(workdir, { recursive: true, force: true });
  });

  it("单目标命中：exit 1 安全失败 + annotations + outputs + SARIF 文件", async () => {
    const captured: Captured = { annotations: [], outputs: {} };
    const inputs = parseActionInputs(
      rawMap({
        targets: join(samplesRoot, "synthetic/description/injection-directives"),
        "fail-on": "high",
        "upload-sarif": "false",
      }),
    );
    const result = await runAction(inputs, deps(captured));
    expect(result.exitCode).toBe(1);
    expect(result.failure).toBe("security");
    expect(result.counts.high + result.counts.critical).toBeGreaterThan(0);
    expect(captured.annotations.length).toBeGreaterThan(0);
    expect(captured.annotations.some((a) => a.kind === "failure")).toBe(true);
    expect(captured.annotations[0].message).toMatch(/^description\//);
    expect(captured.outputs.total).toBe(String(result.counts.total));
    expect(captured.outputs["report-path"]).toMatch(/aivettr\.sarif$/);

    const { readFile } = await import("node:fs/promises");
    const sarif = JSON.parse(await readFile(captured.outputs["report-path"], "utf8"));
    expect(sarif.version).toBe("2.1.0");
  });

  it("benign：exit 0，零 annotations", async () => {
    const captured: Captured = { annotations: [], outputs: {} };
    const inputs = parseActionInputs(
      rawMap({
        targets: join(samplesRoot, "benign/minimal-tool"),
        "upload-sarif": "false",
      }),
    );
    const result = await runAction(inputs, deps(captured));
    expect(result.exitCode).toBe(0);
    expect(result.counts.total).toBe(0);
    expect(captured.annotations).toHaveLength(0);
  });

  it("annotation-level high 时 medium/low 不出 annotation", async () => {
    const captured: Captured = { annotations: [], outputs: {} };
    const inputs = parseActionInputs(
      rawMap({
        targets: join(samplesRoot, "synthetic/sensitive/unbounded-loop"),
        "fail-on": "critical",
        "annotation-level": "high",
        "upload-sarif": "false",
      }),
    );
    const result = await runAction(inputs, deps(captured));
    expect(result.exitCode).toBe(0);
    expect(captured.annotations).toHaveLength(0);
  });

  it("工具错误：不存在的目标 → exit 2", async () => {
    const captured: Captured = { annotations: [], outputs: {} };
    const inputs = parseActionInputs(
      rawMap({ targets: join(workdir, "nope"), "upload-sarif": "false" }),
    );
    const result = await runAction(inputs, deps(captured));
    expect(result.exitCode).toBe(2);
    expect(result.failure).toBe("tool");
  });

  it("多目标：counts 聚合，SARIF runs=2", async () => {
    const captured: Captured = { annotations: [], outputs: {} };
    const inputs: ActionInputs = parseActionInputs(
      rawMap({
        targets: [
          join(samplesRoot, "benign/minimal-tool"),
          join(samplesRoot, "synthetic/permission/process-execution"),
        ].join(" "),
        "fail-on": "high",
        "upload-sarif": "false",
      }),
    );
    const result = await runAction(inputs, deps(captured));
    expect(result.exitCode).toBe(1);
    expect(result.counts.total).toBeGreaterThan(0);
    const { readFile } = await import("node:fs/promises");
    const sarif = JSON.parse(await readFile(captured.outputs["report-path"], "utf8"));
    expect(sarif.runs).toHaveLength(2);
  });

  it("output-file + format markdown 另出一份报告", async () => {
    const captured: Captured = { annotations: [], outputs: {} };
    const out = join(workdir, "reports", "report.md");
    const inputs = parseActionInputs(
      rawMap({
        targets: join(samplesRoot, "synthetic/description/injection-directives"),
        format: "markdown",
        "output-file": out,
        "upload-sarif": "false",
      }),
    );
    await runAction(inputs, deps(captured));
    const { readFile } = await import("node:fs/promises");
    const md = await readFile(out, "utf8");
    expect(md).toContain("## 扫描元信息");
    const sarif = JSON.parse(await readFile(".aivettr-results/aivettr.sarif", "utf8"));
    expect(sarif.runs).toHaveLength(1);
  });

  it("uploadSarif 抛错时降级为警告，不影响 exit code", async () => {
    const warnings: string[] = [];
    const captured: Captured = { annotations: [], outputs: {} };
    const base = deps(captured);
    const result = await runAction(
      parseActionInputs(
        rawMap({
          targets: join(samplesRoot, "benign/minimal-tool"),
          "upload-sarif": "true",
        }),
      ),
      {
        ...base,
        log: { info: () => {}, warn: (m) => warnings.push(m) },
        uploadSarif: async () => {
          throw new Error("403 Resource not accessible");
        },
      },
    );
    expect(result.exitCode).toBe(0);
    expect(warnings.some((w) => w.includes("SARIF 上传失败"))).toBe(true);
    expect(captured.outputs["sarif-id"]).toBe("");
  });
});
