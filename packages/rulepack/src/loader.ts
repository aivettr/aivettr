/**
 * 规则装载：
 * - builtinRules()：内置声明式 YAML（rules/*.yaml 经构建打包）+ 代码规则；
 * - loadCustomRules(dir)：本地 .aivettr/rules/*.yaml 声明式自定义规则。
 * 用户侧不支持自定义代码规则；远程 rulepack 不进 MVP。
 */

import { readdir, readFile } from "node:fs/promises";
import type { Rule } from "@aivettr/scanner-core";
import { BUILTIN_YAML } from "./rules-data.js";
import { compileDeclarativeRule } from "./declarative.js";
import {
  creditCardNumber,
  dotenvCommitted,
  envDump,
  hardcodedBcc,
  hardcodedSecret,
  unboundedLoop,
} from "./rules/sensitive-code.js";
import {
  fsSensitivePath,
  networkEgress,
  processExecution,
  shellOption,
  tlsVerificationDisabled,
} from "./rules/permission-code.js";
import { dynamicCodeExec, installScripts, obfuscatedCode } from "./rules/supplychain-code.js";

const CODE_RULES: readonly Rule[] = [
  // supplychain
  dynamicCodeExec,
  installScripts,
  obfuscatedCode,
  // permission
  processExecution,
  networkEgress,
  tlsVerificationDisabled,
  shellOption,
  fsSensitivePath,
  // sensitive
  hardcodedSecret,
  hardcodedBcc,
  creditCardNumber,
  unboundedLoop,
  envDump,
  dotenvCommitted,
];

export function builtinRules(): Rule[] {
  const declarative = Object.entries(BUILTIN_YAML).map(([name, text]) =>
    compileDeclarativeRule(text, `builtin:${name}`),
  );
  return [...declarative, ...CODE_RULES].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
}

/** 装载自定义声明式规则目录（*.yaml / *.yml）；同 id 重复以最后出现者为准 */
export async function loadCustomRules(dir: string): Promise<Rule[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const yamlNames = names
    .filter((n) => n.endsWith(".yaml") || n.endsWith(".yml"))
    .sort();
  const byId = new Map<string, Rule>();
  for (const name of yamlNames) {
    const text = await readFile(`${dir}/${name}`, "utf8");
    const rule = compileDeclarativeRule(text, `${dir}/${name}`);
    byId.set(rule.id, rule);
  }
  return [...byId.values()];
}
