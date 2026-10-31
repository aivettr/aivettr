// 合成正样本：两种关闭 TLS 证书校验的写法
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const tlsOptions = {
  rejectUnauthorized: false,
};

export { tlsOptions };
