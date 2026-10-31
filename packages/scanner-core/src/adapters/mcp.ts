/**
 * MCP Server 适配器（MVP 唯一适配器）。
 *
 * 职责（规格②/④）：识别本地目录是否为 MCP server 项目——
 * manifest（package.json）依赖 @modelcontextprotocol/sdk、代码内导入该 SDK、
 * 名称/关键词/bin 等项目结构信号。识别结果只用于标注 target.kind，不影响规则判定。
 * 远程包名 / 客户端配置盘点不进 MVP。
 */

import type { CollectedFile, PackageManifest } from "../types.js";

export interface McpTargetInfo {
  readonly detected: boolean;
  readonly kind: "mcp-server" | "directory";
  readonly name: string;
  readonly signals: readonly string[];
}

const MCP_SDK = "@modelcontextprotocol/sdk";

export function detectMcp(
  targetDirName: string,
  files: readonly CollectedFile[],
  manifest: PackageManifest | undefined,
  importedModules: ReadonlySet<string>,
): McpTargetInfo {
  const signals: string[] = [];
  let strong = false;

  if (manifest) {
    const depNames = [
      ...Object.keys(manifest.dependencies),
      ...Object.keys(manifest.peerDependencies),
      ...Object.keys(manifest.devDependencies),
      ...Object.keys(manifest.optionalDependencies),
    ];
    if (depNames.some((d) => d === MCP_SDK || d.startsWith(MCP_SDK + "/"))) {
      signals.push(`manifest 依赖 ${MCP_SDK}`);
      strong = true;
    }
    const text = [manifest.name, manifest.descriptionText, ...(manifest.keywords ?? [])]
      .filter((s): s is string => !!s)
      .join(" ");
    if (/\bmcp\b/i.test(text)) signals.push("manifest 名称/描述/关键词含 mcp");
    if (manifest.bin !== undefined) signals.push("package.json 声明 bin");
  }
  if (importedModules.has(MCP_SDK)) {
    signals.push(`代码导入 ${MCP_SDK}`);
    strong = true;
  }
  void files;

  const detected = strong;
  return {
    detected,
    kind: detected ? "mcp-server" : "directory",
    name: manifest?.name || targetDirName,
    signals,
  };
}
