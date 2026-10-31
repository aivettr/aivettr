import { describe, expect, it } from "vitest";
import { runScan, type Io } from "./run.js";

const samplesRoot = new URL("../../../samples/", import.meta.url);
const benign = new URL("benign/minimal-tool/", samplesRoot).pathname;
const injection = new URL(
  "synthetic/description/injection-directives/",
  samplesRoot,
).pathname;
const missing = new URL("definitely-not-here/", samplesRoot).pathname;

class CaptureIo implements Io {
  out = "";
  err = "";
  stdout(text: string): void {
    this.out += text;
  }
  stderr(text: string): void {
    this.err += text;
  }
}

const FIXED_NOW = new Date("2026-11-01T00:00:00.000Z");

describe("runScan 退出码", () => {
  it("0：benign 样本", async () => {
    const io = new CaptureIo();
    const { exitCode } = await runScan([benign], { io, now: FIXED_NOW });
    expect(exitCode).toBe(0);
    expect(io.out).toContain("No findings.");
  });

  it("1：命中默认 low 阈值", async () => {
    const io = new CaptureIo();
    const { exitCode } = await runScan([injection], { io, now: FIXED_NOW });
    expect(exitCode).toBe(1);
  });

  it("0：fail-on critical 且命中仅 high", async () => {
    const io = new CaptureIo();
    const { exitCode } = await runScan(
      [injection, "--fail-on", "critical"],
      { io, now: FIXED_NOW },
    );
    expect(exitCode).toBe(0);
  });

  it("2：路径不存在", async () => {
    const io = new CaptureIo();
    const { exitCode } = await runScan([missing], { io, now: FIXED_NOW });
    expect(exitCode).toBe(2);
    expect(io.err).toContain("不存在");
  });

  it("2：缺少路径", async () => {
    const io = new CaptureIo();
    const { exitCode } = await runScan([], { io, now: FIXED_NOW });
    expect(exitCode).toBe(2);
  });

  it("2：非法 fail-on", async () => {
    const io = new CaptureIo();
    const { exitCode } = await runScan(
      [benign, "--fail-on", "urgent"],
      { io, now: FIXED_NOW },
    );
    expect(exitCode).toBe(2);
  });

  it("2：未知选项", async () => {
    const io = new CaptureIo();
    const { exitCode } = await runScan(
      [benign, "--explode"],
      { io, now: FIXED_NOW },
    );
    expect(exitCode).toBe(2);
  });

  it("-h → 0 且输出帮助", async () => {
    const io = new CaptureIo();
    const { exitCode } = await runScan(["--help"], { io, now: FIXED_NOW });
    expect(exitCode).toBe(0);
    expect(io.out).toContain("Usage: aivettr scan");
  });
});

describe("runScan 选项行为", () => {
  it("--format json 输出可解析 JSON", async () => {
    const io = new CaptureIo();
    await runScan([injection, "--format", "json"], { io, now: FIXED_NOW });
    const parsed = JSON.parse(io.out);
    expect(parsed.schemaVersion).toBe("1.0");
    expect(parsed.findings[0].ruleId).toBe("description/injection-directives");
  });

  it("--disable-rule 后无命中 → 0", async () => {
    const io = new CaptureIo();
    const { exitCode } = await runScan(
      [injection, "--disable-rule", "description/injection-directives"],
      { io, now: FIXED_NOW },
    );
    expect(exitCode).toBe(0);
    expect(io.out).toContain("No findings.");
  });

  it("list 选项支持多值与逗号分隔", async () => {
    const io = new CaptureIo();
    const { exitCode } = await runScan(
      [injection, "--disable-rule", "description/injection-directives,permission/network-egress"],
      { io, now: FIXED_NOW },
    );
    expect(exitCode).toBe(0);
  });

  it("--quiet：benign 时 stdout 为空", async () => {
    const io = new CaptureIo();
    const { exitCode } = await runScan(
      [benign, "--quiet"],
      { io, now: FIXED_NOW },
    );
    expect(exitCode).toBe(0);
    expect(io.out).toBe("");
  });

  it("--quiet：有命中时报告仍输出", async () => {
    const io = new CaptureIo();
    await runScan([injection, "--quiet"], { io, now: FIXED_NOW });
    expect(io.out).toContain("HIGH");
  });
});
