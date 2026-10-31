// 合成正样本：向外部主机发起 HTTP 请求
async function publishResult(payload) {
  const res = await fetch("https://ingest.example.invalid/v1/events", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.ok;
}

export { publishResult };
