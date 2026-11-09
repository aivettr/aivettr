import type { PackageManifest, Rule, ScanContext } from "@aivettr/scanner-core";
import { callLocation, finding, generatedFilePaths, locateJsonValue } from "./helpers.js";

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
      "字符串源码含 4 个以上 \\xHH 转义或 120+ 字符 base64 字面量，常用于隐藏恶意逻辑。AILAB-50 调优（2026-11-09）：移除 atob / Buffer.from(...,'base64') 解码调用信号——官方生态 51 仓实测该形态全部为传输编码常规用法（40/40 合法），误报成本高于信号价值；M2 起跳过生成物/数据块文件（字体 base64 数据 TS、打包产物——官方生态 2989 条 high 命中全部来自此类，见 generatedFiles 判定），手写业务代码不受影响。",
    severity: "high",
    owasp: ["LLM04:2026"],
  },
  check(ctx: ScanContext) {
    const out = [];
    const reported = new Set<string>();
    const generated = generatedFilePaths(ctx);

    for (const l of ctx.literals) {
      if (generated.has(l.file)) continue;
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

/**
 * supplychain/install-scripts（AILAB-50 M2 自 YAML 迁移，规则 ID 不变）：
 * 声明安装期脚本 + 自构建白名单。
 *
 * 白名单语义（B5 对抗口径，2026-11-09）：仅当安装期脚本值整体为
 * 「包管理器 run <脚本名>」或「node -e 存在性守卫 && execSync(包管理器 run)」形态，
 * 且被引用脚本沿 npm scripts 链递归检查（深度 ≤5、防环）均无网络下载 /
 * 子进程执行 / shell 管道 / eval / base64 解码等投毒常用面时豁免；
 * 引用的脚本名不存在、命令带附加语句、转义伪装（\\x 系列写法）均不豁免。
 * 任意一个环节不满足即维持命中——「把恶意逻辑藏进 build 脚本、postinstall 只写
 * npm run build」的绕过形态仍会命中。
 */
const RUN_CMD = /^(npm|pnpm|yarn|bun)\s+run\s+([A-Za-z0-9][\w:.-]*)\s*$/;
// execSync 第二参数仅接受不含 shell 键的常规选项对象（stdio/encoding/cwd 等）——
// { shell: ... } 可改写解释器，属绕过形态，不豁免
const GUARDED_RUN =
  /^node\s+(?:-e|--eval)\s+["']require\(['"]fs['"]\)\.existsSync\([^)]{1,120}\)\s*&&\s*require\(['"]child_process['"]\)\.execSync\(['"]([^'"]{1,80})['"]\s*(?:,\s*\{(?![^}]*\bshell\b)[^}]{0,80}\})?\)\s*["']$/;
/** 投毒常用面：网络下载、子进程、shell 管道/命令分隔、动态执行、解码、写系统路径（chmod +x 构建产物属良性惯用法，不计） */
const DANGEROUS_BUILD =
  /(?:curl|wget|fetch\(|https?:\/\/|child_process|execSync|spawnSync|\bexec\(|\beval\(|new\s+Function|base64|unzip|tar\s+(?:-?x|xf)|git\s+clone|\bssh\b|\bnc\s|npx\s+install|\|\s*(?:sh|bash|zsh)|>\s*\/(?:tmp|etc|usr)|\bpkill\b)/i;

function runScriptValue(manifest: PackageManifest, name: string): string | undefined {
  const v = manifest.scripts[name];
  return typeof v === "string" ? v : undefined;
}

/** 递归检查 run 脚本链（≤5 层、防环）是否全部干净 */
function buildChainClean(manifest: PackageManifest, name: string): boolean {
  const visited = new Set<string>();
  const queue = [name];
  while (queue.length > 0) {
    const cur = queue.pop()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    if (visited.size > 8) return false;
    const v = runScriptValue(manifest, cur);
    if (v === undefined) return false; // 引用不存在的脚本 → 不可豁免
    if (DANGEROUS_BUILD.test(v)) return false;
    for (const m of v.matchAll(/\b(?:npm|pnpm|yarn|bun)\s+run\s+([A-Za-z0-9][\w:.-]*)/g)) {
      queue.push(m[1]);
    }
  }
  return true;
}

/** 自构建白名单：值整体为守卫式自构建或直接 run 命令，且目标链干净 */
export function installScriptWhitelisted(manifest: PackageManifest, value: string): boolean {
  const direct = RUN_CMD.exec(value.trim());
  if (direct) return buildChainClean(manifest, direct[2]);
  const guarded = GUARDED_RUN.exec(value.trim());
  if (!guarded) return false; // 附加语句 / 其他命令 / 转义伪装 → 不豁免
  const inner = RUN_CMD.exec(guarded[1].trim());
  return inner ? buildChainClean(manifest, inner[2]) : false;
}

const INSTALL_FIELDS = ["preinstall", "install", "postinstall", "prepare"] as const;

export const installScripts: Rule = {
  id: "supplychain/install-scripts",
  meta: {
    title: "package.json 声明安装期脚本",
    description:
      "preinstall/install/postinstall/prepare 在 npm 安装阶段自动执行（prepare 在 git 依赖安装时同样触发），是投毒包最常用的持久化/投递入口；MCP server 包通常无需安装期脚本，出现时应人工核对。自构建白名单：postinstall/prepare 等值为「包管理器 run 自身构建脚本」（可带 tsconfig 存在性守卫）且构建脚本链无网络下载/子进程/shell 管道时不报——恶意逻辑藏进 build 脚本的伪装形态仍会命中。",
    severity: "medium",
    owasp: ["LLM04:2026"],
  },
  check(ctx: ScanContext) {
    if (!ctx.manifest) return [];
    const pkg = ctx.file("package.json");
    const content = pkg?.content ?? "";
    const out = [];
    const seen = new Set<string>();
    for (const field of INSTALL_FIELDS) {
      const value = runScriptValue(ctx.manifest, field);
      if (value === undefined || value.length === 0) continue;
      if (installScriptWhitelisted(ctx.manifest, value)) continue;
      const key = `${field}:${value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(
        finding(
          `package.json 声明安装期自动执行脚本（供应链高风险面）：scripts.${field}`,
          locateJsonValue(content, field, value),
          `scripts.${field} = ${value}`.slice(0, 160),
        ),
      );
    }
    return out;
  },
};
