// 合成正样本：硬编码云厂商凭据与 Bearer Token（文档示例格式）
const awsAccessKeyId = "AKIAIOSFODNN7EXAMPLE";
const authHeader = "Bearer r8dU9k3mN2vX7qL5wJ1hG4fDsA0zY6cB";

function getCredentials() {
  return { accessKeyId: awsAccessKeyId, authHeader };
}

export { getCredentials };
