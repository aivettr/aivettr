/**
 * Action 入口（node20，ncc 打包为 dist/index.js）。
 * 只做胶水：读 inputs → runAction → 区分安全失败(1)/工具错误(2)。
 */

import * as core from "@actions/core";
import { runScan } from "@aivettr/cli/api";
import { render, renderSarif } from "@aivettr/report";
import { uploadArtifact, uploadSarif } from "./github.js";
import {
  type AnnotationKind,
  parseActionInputs,
  runAction,
  type ActionResult,
} from "./main.js";

function emit(kind: AnnotationKind, message: string, props: {
  file?: string;
  startLine?: number;
  endLine?: number;
}): void {
  const annotationProps = {
    ...(props.file ? { file: props.file } : {}),
    ...(props.startLine ? { line: props.startLine } : {}),
    ...(props.endLine ? { endLine: props.endLine } : {}),
  };
  if (kind === "failure") core.error(message, annotationProps);
  else if (kind === "warning") core.warning(message, annotationProps);
  else core.notice(message, annotationProps);
}

async function main(): Promise<void> {
  let inputs;
  try {
    inputs = parseActionInputs((name) => core.getInput(name));
  } catch (err) {
    core.setFailed(`AIVettr 工具错误（exit 2）：${(err as Error).message}`);
    return;
  }

  let result: ActionResult;
  try {
    result = await runAction(inputs, {
      runScan,
      renderSarif: (r) => renderSarif(r),
      renderFormat: (r, format) => render({ result: r, format }),
      log: { info: core.info, warn: core.warning },
      emitAnnotation: emit,
      setOutput: core.setOutput,
      uploadSarif,
      uploadArtifact,
    });
  } catch (err) {
    core.setFailed(`AIVettr 工具错误（exit 2）：${(err as Error).message}`);
    return;
  }

  if (result.exitCode === 1) {
    const c = result.counts;
    core.setFailed(
      `AIVettr 安全失败（exit 1）：共 ${c.total} 条命中` +
        `（critical ${c.critical} / high ${c.high} / medium ${c.medium} / low ${c.low}），` +
        `达到 fail-on=${inputs.failOn} 阈值。这是安全结论失败，非工具故障。`,
    );
  } else if (result.exitCode === 2) {
    core.setFailed(
      "AIVettr 工具错误（exit 2）：扫描未能完成（路径/配置/规则加载错误），见上方日志；" +
        "与安全失败（exit 1）性质不同。",
    );
  }
}

main().catch((err) => {
  core.setFailed(`AIVettr 工具错误（exit 2）：${(err as Error).message}`);
});
