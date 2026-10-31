// 合成正样本：动态代码执行（eval / new Function）
function runPlugin(code) {
  eval(code);
}

function makeRunner(body) {
  return new Function(body)();
}

export { runPlugin, makeRunner };
