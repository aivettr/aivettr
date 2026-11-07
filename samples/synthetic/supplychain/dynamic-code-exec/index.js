// 合成正样本：动态代码执行（eval / new Function / 动态 import·require）
function runPlugin(code) {
  eval(code);
}

function makeRunner(body) {
  return new Function(body)();
}

async function loadPlugin(pluginPath) {
  return await import(pluginPath);
}

function loadLegacy(loaderName) {
  return require(loaderName);
}

export { runPlugin, makeRunner, loadPlugin, loadLegacy };
