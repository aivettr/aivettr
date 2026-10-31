/**
 * argv 解析（零依赖）。
 *
 * 支持 --flag=value 与 --flag value；<id...>/<glob...> 选项消费到下一个
 * 选项前的全部参数（同时接受逗号分隔）；布尔开关 --quiet/--no-color。
 * 解析失败抛 ArgvError（CLI 映射退出码 2）。
 */

export interface ParsedArgs {
  readonly path?: string;
  readonly format?: string;
  readonly failOn?: string;
  readonly config?: string;
  readonly enableRule: readonly string[];
  readonly disableRule: readonly string[];
  readonly ignore: readonly string[];
  readonly output?: string;
  readonly quiet: boolean;
  readonly noColor: boolean;
  readonly help: boolean;
}

export class ArgvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArgvError";
  }
}

const VALUE_OPTIONS = new Set([
  "format",
  "fail-on",
  "config",
  "output",
]);
const LIST_OPTIONS = new Set(["enable-rule", "disable-rule", "ignore"]);
const BOOL_OPTIONS = new Set(["quiet", "no-color"]);

function splitValues(v: string): string[] {
  return v.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}

export function parseScanArgs(args: readonly string[]): ParsedArgs {
  const out = {
    enableRule: [] as string[],
    disableRule: [] as string[],
    ignore: [] as string[],
    quiet: false,
    noColor: false,
    help: false,
  };
  let path: string | undefined;
  let single: Record<string, string> = {};

  const assignList = (name: string, values: string[]): void => {
    if (name === "enable-rule") out.enableRule.push(...values);
    else if (name === "disable-rule") out.disableRule.push(...values);
    else out.ignore.push(...values);
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      out.help = true;
      continue;
    }

    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
      const inline = eq === -1 ? undefined : arg.slice(eq + 1);

      if (BOOL_OPTIONS.has(name)) {
        if (inline !== undefined && inline !== "true" && inline !== "false") {
          throw new ArgvError(`--${name} 是布尔开关，不接受值`);
        }
        if (name === "quiet") out.quiet = inline !== "false";
        if (name === "no-color") out.noColor = inline !== "false";
        continue;
      }

      if (VALUE_OPTIONS.has(name)) {
        const value = inline ?? args[++i];
        if (value === undefined || value.startsWith("--")) {
          throw new ArgvError(`--${name} 需要一个值`);
        }
        single = { ...single, [name]: value };
        continue;
      }

      if (LIST_OPTIONS.has(name)) {
        const values: string[] = [];
        if (inline !== undefined) {
          values.push(...splitValues(inline));
        } else {
          // 消费到下一个选项前
          while (i + 1 < args.length && !args[i + 1].startsWith("--")) {
            values.push(...splitValues(args[++i]));
          }
        }
        if (values.length === 0) throw new ArgvError(`--${name} 至少需要一个值`);
        assignList(name, values);
        continue;
      }

      throw new ArgvError(`未知选项 --${name}`);
    }

    if (arg.startsWith("-") && arg !== "-") {
      throw new ArgvError(`未知参数 ${arg}`);
    }

    if (path !== undefined) {
      throw new ArgvError(`意外的多余参数：${arg}（scan 仅接受一个路径）`);
    }
    path = arg;
  }

  return {
    ...(path !== undefined ? { path } : {}),
    ...(single.format ? { format: single.format } : {}),
    ...(single["fail-on"] ? { failOn: single["fail-on"] } : {}),
    ...(single.config ? { config: single.config } : {}),
    ...(single.output ? { output: single.output } : {}),
    enableRule: out.enableRule,
    disableRule: out.disableRule,
    ignore: out.ignore,
    quiet: out.quiet,
    noColor: out.noColor,
    help: out.help,
  };
}

export const HELP_TEXT = `Usage: aivettr scan <path> [options]

Statically scan a local MCP server project (no installation, no code execution).

Options:
  --format <text|json|sarif|markdown>   Report format (default: text; md = markdown)
  --fail-on <low|medium|high|critical>  Exit 1 at this severity or above (default: low)
  --config <path>                       Explicit .aivettr.json (default: auto-discover)
  --enable-rule <id...>                 Re-enable disabled rules
  --disable-rule <id...>                Disable rules
  --ignore <glob...>                    Additional ignore patterns
  --output <file>                       Write report to file instead of stdout
  --quiet                               Suppress report on stdout when there are no findings
  --no-color                            Disable ANSI colors
  -h, --help                            Show this help

Exit codes:
  0  clean (or findings below --fail-on threshold)
  1  findings at or above the threshold
  2  scanner error (missing path, invalid config, rule load failure)
`;
