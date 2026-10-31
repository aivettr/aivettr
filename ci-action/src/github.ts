/**
 * GitHub 侧胶水：
 * - SARIF 经 code-scanning REST API 上传（即 github/codeql-action/upload-sarif@v3
 *   底层所用端点，需要 security-events: write）；有界轮询处理状态。
 * - 可选 artifact 上传。
 * 调用方对两类失败统一做降级（warning），故此处不吞异常，直接抛出。
 */

import { DefaultArtifactClient } from "@actions/artifact";
import * as core from "@actions/core";
import * as github from "@actions/github";

export async function uploadSarif(sarifContent: string): Promise<string> {
  const token = core.getInput("github-token") || process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("缺少 github-token input 或 GITHUB_TOKEN 环境变量");
  }
  const octokit = github.getOctokit(token);
  const ctx = github.context;
  const { owner, repo } = ctx.repo;

  const res = await octokit.request("POST /repos/{owner}/{repo}/code-scanning/sarifs", {
    owner,
    repo,
    commit_sha: ctx.sha,
    ref: ctx.ref,
    sarif: Buffer.from(sarifContent, "utf8").toString("base64"),
    headers: { "X-GitHub-Api-Version": "2022-11-28" },
  });
  const sarifId = String((res.data as { id?: string }).id ?? "");

  // 有界轮询：最多约 30 秒；未完成不报错（upload-sarif@v3 亦为异步处理）
  for (let i = 0; i < 6; i++) {
    const status = await octokit.request(
      "GET /repos/{owner}/{repo}/code-scanning/sarifs/{sarif_id}",
      { owner, repo, sarif_id: sarifId },
    );
    const processing = String((status.data as { processing_status?: string }).processing_status ?? "");
    if (processing === "complete") return sarifId;
    await new Promise((r) => setTimeout(r, 5000));
  }
  core.info(`SARIF 处理仍在进行中（sarif-id：${sarifId}），不阻塞步骤`);
  return sarifId;
}

export async function uploadArtifact(
  files: readonly string[],
  rootDir: string,
): Promise<string> {
  const client = new DefaultArtifactClient();
  const response = await client.uploadArtifact(
    "aivettr-report",
    [...files],
    rootDir,
    { retentionDays: 30 },
  );
  return String(response.id ?? response.size ?? "aivettr-report");
}
