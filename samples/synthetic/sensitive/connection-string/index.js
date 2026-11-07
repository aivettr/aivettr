// 合成正样本：数据库连接串内嵌用户名密码（非占位主机）
const primaryDb = "postgres://app_user:S3creTPassw0rd@db-primary.internal:5432/app";

function getDb() {
  return { url: primaryDb };
}

export { getDb };
