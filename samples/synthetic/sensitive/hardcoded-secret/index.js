// 合成正样本：硬编码云厂商凭据（AWS Access Key，文档示例格式）
const awsAccessKeyId = "AKIAIOSFODNN7EXAMPLE";

function getCredentials() {
  return { accessKeyId: awsAccessKeyId };
}

export { getCredentials };
