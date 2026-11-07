/**
 * JS/TS AST analyzer（typescript 编译器 API）。
 *
 * 深度有界：语法级 + 文件内简单语义——
 * - 危险调用：child_process / eval / new Function / fetch / http(s) / atob / Buffer.from base64
 * - 字符串字面量提取（值 + 源码原文，供密钥/混淆规则使用）
 * - 工具描述提取：server.tool(name, desc) 与含 name|title + description 的对象字面量
 * - bcc 属性、shell:true、rejectUnauthorized:false、NODE_TLS_REJECT_UNAUTHORIZED=0
 * 不做跨过程污点分析 / 调用图 / 符号执行。
 */

import * as ts from "typescript";
import type {
  CollectedFile,
  DangerousCall,
  StringLiteralHit,
  ToolDescription,
} from "../types.js";
import { lineSnippet } from "../util/text.js";

interface ImportBinding {
  module: string;
  kind: "import" | "require";
}

export interface RawImport {
  module: string;
  kind: "import" | "require";
}

export interface AstSignals {
  imports: RawImport[];
  literals: StringLiteralHit[];
  calls: DangerousCall[];
  descriptions: ToolDescription[];
  bccProperties: StringLiteralHit[];
}

const CP_METHODS = new Set([
  "exec",
  "execSync",
  "spawn",
  "spawnSync",
  "execFile",
  "execFileSync",
]);
const CP_FREE_NAMES = new Set(["child_process", "childProcess"]);

/** fs 写/删家族方法（fs-sensitive-path 检测对象） */
const FS_WRITE_FAMILIES = new Set([
  "writeFile",
  "writeFileSync",
  "appendFile",
  "appendFileSync",
  "rm",
  "rmSync",
  "unlink",
  "unlinkSync",
  "createWriteStream",
  "mkdir",
  "mkdirSync",
]);

/**
 * 敏感路径标记：SSH/云凭据目录、shell 配置、MCP 客户端配置文件等。
 * 匹配调用全文（覆盖字面量、拼接、模板串），负向断言防止 .awsome 类误命中。
 */
const FS_SENSITIVE_MARKER =
  /\.(?:ssh|aws|gnupg|kube|netrc|npmrc|bashrc|zshrc|profile|cursor)(?![A-Za-z0-9_-])|mcp\.json|claude_desktop_config(?:\.json)?|authorized_keys|id_rsa(?:\.[A-Za-z0-9]+)?/;

function scriptKind(file: CollectedFile): ts.ScriptKind {
  switch (file.path.slice(file.path.lastIndexOf(".") + 1)) {
    case "ts":
    case "mts":
    case "cts":
      return ts.ScriptKind.TS;
    case "tsx":
      return ts.ScriptKind.TSX;
    case "jsx":
      return ts.ScriptKind.JSX;
    default:
      return ts.ScriptKind.JS;
  }
}

function externalHttpUrl(v: string): string | undefined {
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    const h = u.hostname;
    if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h.endsWith(".localhost")) {
      return undefined;
    }
    return v;
  } catch {
    return undefined;
  }
}

export function analyzeJsTs(file: CollectedFile): AstSignals {
  const content = file.content;
  const sf = ts.createSourceFile(
    file.path,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(file),
  );

  const pos = (node: ts.Node) => {
    const start = ts.getLineAndCharacterOfPosition(sf, node.getStart(sf));
    const end = ts.getLineAndCharacterOfPosition(sf, node.end);
    return {
      startLine: start.line + 1,
      startColumn: start.character + 1,
      endLine: end.line + 1,
      endColumn: end.character + 1,
    };
  };

  const imports: RawImport[] = [];
  const literals: StringLiteralHit[] = [];
  const calls: DangerousCall[] = [];
  const descriptions: ToolDescription[] = [];
  const bccProperties: StringLiteralHit[] = [];

  // 局部名 → 来源模块（import / require）
  const bindings = new Map<string, ImportBinding>();

  const addCall = (
    node: ts.Node,
    kind: DangerousCall["kind"],
    name: string,
    target?: string,
  ): void => {
    const p = pos(node);
    calls.push({
      file: file.path,
      kind,
      name,
      ...(target ? { target } : {}),
      ...p,
      snippet: lineSnippet(content, node.getStart(sf)),
    });
  };

  const literalHit = (node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral): StringLiteralHit => ({
    file: file.path,
    value: node.text,
    rawText: node.getText(sf),
    ...pos(node),
  });

  /** 对象/链表达式最终指向的模块（require('x') / 绑定名） */
  const moduleOf = (expr: ts.Expression): { module: string } | undefined => {
    if (ts.isCallExpression(expr) && expr.expression.getText(sf) === "require") {
      const arg = expr.arguments[0];
      if (arg && ts.isStringLiteral(arg)) return { module: arg.text };
      return undefined;
    }
    if (ts.isIdentifier(expr)) {
      const b = bindings.get(expr.text);
      return b ? { module: b.module } : undefined;
    }
    return undefined;
  };

  const isChildProcessModule = (m: string): boolean =>
    m === "node:child_process" || m === "child_process";
  const isHttpModule = (m: string): boolean =>
    m === "node:http" || m === "http" || m === "node:https" || m === "https";

  /** 调用是否为 child_process spawn/execFile 家族（identifier 具名导入或 property access） */
  const cpSpawnFamily = (node: ts.CallExpression): string | undefined => {
    const callee = node.expression;
    if (ts.isIdentifier(callee)) {
      const b = bindings.get(callee.text);
      if (b && isChildProcessModule(b.module) && isSpawnMethod(callee.text)) return callee.text;
      return undefined;
    }
    if (ts.isPropertyAccessExpression(callee)) {
      const method = callee.name.text;
      if (!isSpawnMethod(method)) return undefined;
      const src = moduleOf(callee.expression);
      if (src && isChildProcessModule(src.module)) return method;
      if (ts.isIdentifier(callee.expression) && CP_FREE_NAMES.has(callee.expression.text)) {
        return method;
      }
    }
    return undefined;
  };

  function isSpawnMethod(m: string): boolean {
    return m === "spawn" || m === "spawnSync" || m === "execFile" || m === "execFileSync";
  }

  function checkShellOption(node: ts.CallExpression): void {
    const method = cpSpawnFamily(node);
    if (!method) return;
    for (const arg of node.arguments) {
      if (!ts.isObjectLiteralExpression(arg)) continue;
      for (const prop of arg.properties) {
        if (
          ts.isPropertyAssignment(prop) &&
          ts.isIdentifier(prop.name) &&
          prop.name.text === "shell" &&
          prop.initializer.kind === ts.SyntaxKind.TrueKeyword
        ) {
          addCall(prop, "shell-option", `${method}.shell`);
        }
      }
    }
  }

  const stringArg = (node: ts.CallExpression, i: number): string | undefined => {
    const a = node.arguments[i];
    if (a && ts.isStringLiteralLike(a)) return a.text;
    return undefined;
  };

  /**
   * fs 写/删家族调用且全文含敏感路径标记（~/.ssh、.aws、mcp.json 等）。
   * 窄口径：只看标记名，不标记普通绝对路径，控制误报。
   */
  function checkFsSensitivePath(node: ts.CallExpression): void {
    const callee = node.expression;
    const name = ts.isPropertyAccessExpression(callee)
      ? callee.name.text
      : ts.isIdentifier(callee)
        ? callee.text
        : undefined;
    if (!name || !FS_WRITE_FAMILIES.has(name)) return;
    if (FS_SENSITIVE_MARKER.test(node.getText(sf))) {
      addCall(node, "fs-sensitive-path", name);
    }
  }

  /** process.env 整体入载荷：对象展开 {...process.env} / JSON.stringify(process.env) */
  function checkEnvDump(node: ts.CallExpression): void {
    if (
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(sf) === "JSON" &&
      node.expression.name.text === "stringify"
    ) {
      const a = node.arguments[0];
      if (a && a.getText(sf) === "process.env") {
        addCall(node, "env-dump", "JSON.stringify(process.env)");
      }
    }
  }

  // 先收集 import/require 绑定
  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const mod = stmt.moduleSpecifier.text;
      imports.push({ module: mod, kind: "import" });
      const clause = stmt.importClause;
      if (clause) {
        if (clause.name) bindings.set(clause.name.text, { module: mod, kind: "import" });
        const named = clause.namedBindings;
        if (named && ts.isNamespaceImport(named)) {
          bindings.set(named.name.text, { module: mod, kind: "import" });
        } else if (named && ts.isNamedImports(named)) {
          for (const el of named.elements) {
            bindings.set(el.name.text, { module: mod, kind: "import" });
          }
        }
      }
    }
  }

  /** 检查对象字面量：shell:true / rejectUnauthorized:false / bcc / 工具描述 */
  const inspectObjectLiteral = (node: ts.ObjectLiteralExpression): void => {
    // {...process.env}：整体环境变量入对象（env-dump）
    for (const prop of node.properties) {
      if (ts.isSpreadAssignment(prop) && prop.expression.getText(sf) === "process.env") {
        addCall(prop, "env-dump", "process.env 展开");
        break;
      }
    }
    let hasNameLike = false;
    let nameText: string | undefined;
    let descNode: ts.StringLiteralLike | undefined;
    for (const prop of node.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      const pname = ts.isIdentifier(prop.name) ? prop.name.text : prop.name.getText(sf);
      const init = prop.initializer;

      // Bcc 字段大小写不敏感（邮件 API 常见 Bcc / bcc 两种写法）
      if (pname.toLowerCase() === "bcc" && ts.isStringLiteralLike(init) && init.text.length > 0) {
        bccProperties.push(literalHit(init));
      }
      if (pname === "rejectUnauthorized" && init.kind === ts.SyntaxKind.FalseKeyword) {
        addCall(prop, "tls-disabled", "rejectUnauthorized");
      }
      if (pname === "name" || pname === "title") {
        hasNameLike = true;
        if (ts.isStringLiteralLike(init)) nameText = init.text;
      }
      if (pname === "description" && ts.isStringLiteralLike(init)) descNode = init;
    }
    if (hasNameLike && descNode) {
      const p = pos(descNode);
      descriptions.push({
        file: file.path,
        ...(nameText ? { name: nameText } : {}),
        text: descNode.text,
        ...p,
      });
    }
  };

  /**
   * while(true)/for(;;) 且体内（跳过嵌套循环/switch/函数）无 break/return/throw。
   * return|throw 与 break 同样是静态可见的循环退出路径；嵌套函数内的退出
   * 不作用于外层循环，故函数边界整体剪枝。
   */
  const inspectLoop = (node: ts.WhileStatement | ts.ForStatement): void => {
    const forever =
      ts.isWhileStatement(node)
        ? node.expression.kind === ts.SyntaxKind.TrueKeyword
        : !node.condition;
    if (!forever) return;
    let hasExit = false;
    const walk = (n: ts.Node): void => {
      if (
        n !== node &&
        (ts.isWhileStatement(n) ||
          ts.isForStatement(n) ||
          ts.isForInStatement(n) ||
          ts.isForOfStatement(n) ||
          ts.isSwitchStatement(n) ||
          ts.isFunctionDeclaration(n) ||
          ts.isFunctionExpression(n) ||
          ts.isArrowFunction(n))
      ) {
        return; // 内层 break/return 不退出外层循环
      }
      if (
        n.kind === ts.SyntaxKind.BreakStatement ||
        n.kind === ts.SyntaxKind.ReturnStatement ||
        n.kind === ts.SyntaxKind.ThrowStatement
      ) {
        hasExit = true;
        return;
      }
      n.forEachChild(walk);
    };
    node.statement.forEachChild(walk);
    if (!hasExit) addCall(node, "unbounded-loop", ts.isWhileStatement(node) ? "while" : "for");
  };

  // 全节点遍历
  const stack: ts.Node[] = [sf];
  while (stack.length > 0) {
    const node = stack.pop()!;

    if (ts.isCallExpression(node)) {
      const callee = node.expression;

      // shell:true 检测先跑（对两类 callee 统一）
      checkShellOption(node);
      checkFsSensitivePath(node);
      checkEnvDump(node);

      // 动态 import(变量)：表达式是 ImportKeyword（非普通标识符）；字面量视为静态导入
      if (
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length >= 1 &&
        !ts.isStringLiteralLike(node.arguments[0])
      ) {
        addCall(node, "dynamic-import", "import(变量)");
      }

      if (ts.isIdentifier(callee)) {
        if (callee.text === "eval") addCall(node, "eval", "eval");
        if (callee.text === "fetch") {
          const url = stringArg(node, 0);
          if (url && externalHttpUrl(url)) addCall(node, "network-egress", "fetch", url);
        }
        if (callee.text === "atob") addCall(node, "base64-decode", "atob");
        if (callee.text === "require" && node.arguments.length >= 1) {
          const arg = node.arguments[0];
          if (ts.isStringLiteralLike(arg)) {
            imports.push({ module: arg.text, kind: "require" });
          } else {
            addCall(node, "dynamic-import", "require(变量)");
          }
        }
        if (callee.text === "setTimeout" && stringArg(node, 0) !== undefined) {
          addCall(node, "eval", "setTimeout(string)");
        }
        // import 具名引入的 child_process 方法：exec(...)
        const bound = bindings.get(callee.text);
        if (bound && isChildProcessModule(bound.module) && CP_METHODS.has(callee.text)) {
          addCall(node, "child-process", `child_process.${callee.text}`);
        }
      } else if (ts.isPropertyAccessExpression(callee)) {
        const method = callee.name.text;
        const src = moduleOf(callee.expression);

        if (src && isChildProcessModule(src.module) && CP_METHODS.has(method)) {
          addCall(node, "child-process", `child_process.${method}`);
        } else if (
          ts.isIdentifier(callee.expression) &&
          CP_FREE_NAMES.has(callee.expression.text) &&
          CP_METHODS.has(method)
        ) {
          addCall(node, "child-process", `${callee.expression.text}.${method}`);
        }

        if (src && isHttpModule(src.module) && (method === "request" || method === "get")) {
          let target = stringArg(node, 0);
          if (!target) {
            const opts = node.arguments[0];
            if (opts && ts.isObjectLiteralExpression(opts)) {
              for (const p of opts.properties) {
                if (
                  ts.isPropertyAssignment(p) &&
                  ts.isIdentifier(p.name) &&
                  (p.name.text === "hostname" || p.name.text === "host") &&
                  ts.isStringLiteralLike(p.initializer)
                ) {
                  target = p.initializer.text;
                }
              }
            }
          }
          if (target && externalHttpUrl(target)) {
            addCall(node, "network-egress", `https.${method}`, target);
          }
        }

        if (
          ts.isIdentifier(callee.expression) &&
          callee.expression.text === "Buffer" &&
          method === "from" &&
          (stringArg(node, 1) === "base64" || stringArg(node, 1) === "base64url")
        ) {
          addCall(node, "base64-decode", "Buffer.from(base64)");
        }

        // server.tool(name, description, …)
        if (method === "tool" && node.arguments.length >= 2) {
          const nameArg = node.arguments[0];
          const descArg = node.arguments[1];
          if (ts.isStringLiteralLike(descArg)) {
            const p = pos(descArg);
            descriptions.push({
              file: file.path,
              ...(nameArg && ts.isStringLiteralLike(nameArg) ? { name: nameArg.text } : {}),
              text: descArg.text,
              ...p,
            });
          }
        }
      }
    }

    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Function") {
      addCall(node, "function-constructor", "new Function");
    }

    // require 绑定（const cp = require(...)）
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === "require"
    ) {
      const arg = node.initializer.arguments[0];
      if (ts.isStringLiteral(arg) && ts.isIdentifier(node.name)) {
        bindings.set(node.name.text, { module: arg.text, kind: "require" });
      }
    }

    if (ts.isObjectLiteralExpression(node)) inspectObjectLiteral(node);

    // x.bcc = "..."（大小写不敏感）
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      node.left.name.text.toLowerCase() === "bcc" &&
      ts.isStringLiteralLike(node.right) &&
      node.right.text.length > 0
    ) {
      bccProperties.push(literalHit(node.right));
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      const leftText = node.left.getText(sf);
      if (
        leftText.endsWith("NODE_TLS_REJECT_UNAUTHORIZED") &&
        (node.right.kind === ts.SyntaxKind.StringLiteral
          ? (node.right as ts.StringLiteral).text === "0"
          : node.right.kind === ts.SyntaxKind.NumericLiteral &&
            (node.right as ts.NumericLiteral).text === "0")
      ) {
        addCall(node, "tls-disabled", "NODE_TLS_REJECT_UNAUTHORIZED");
      }
    }

    if (ts.isWhileStatement(node) || ts.isForStatement(node)) inspectLoop(node);

    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      !(
        node.parent &&
        (ts.isImportDeclaration(node.parent) ||
          (ts.isCallExpression(node.parent) &&
            ts.isIdentifier(node.parent.expression) &&
            node.parent.expression.text === "require"))
      )
    ) {
      literals.push(literalHit(node));
    }

    node.forEachChild((c) => {
      stack.push(c);
    });
  }

  return { imports, literals, calls, descriptions, bccProperties };
}
