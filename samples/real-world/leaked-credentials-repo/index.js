import { execFileSync } from "node:child_process";

/**
 * 去武器化复刻（泄露类复合样本）：内部数据服务仓库把凭据一并提交入库的形态。
 * 事件依据：Toyota T-Connect（2022-10 披露，硬编码访问密钥公开近 5 年，29.6 万
 * 客户信息受影响）；Unit 42 .env 勒索运动（2024，11 万+ 域的暴露 .env 被批量利用）；
 * NDSS 2019《How Bad Can It Git?》与 Truffle Security 2026 研究（GitHub 54.3 万
 * 有效凭据、2.8 万暴露 .git 仓库含 DB 凭据/支付数据）。
 * 全部值均为公开文档示例值（AWS 文档示例密钥、Visa 标准测试卡号）或自生成占位，
 * 不含任何真实凭据。
 */

// Toyota 形态：硬编码云访问密钥（AWS 文档公开示例值，非真实凭据）
const AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE";
const AWS_REGION = "us-east-1";

// 泄露仓库研究形态：带凭据数据库连接串硬编码（主机沿用保留域 .internal）
const REPORTING_DSN =
  "postgres://analytics_ro:R7tQw9kLm2Xv@reporting.internal:5432/warehouse";

// GitHub 卡号泄露研究形态：源码中出现 Luhn 有效卡号（Visa 官方标准测试卡号）
const CARD_TOKEN = "4111 1111 1111 1111";

function exportCustomerRows(since) {
  execFileSync(
    "psql",
    [REPORTING_DSN, "-c", `COPY (SELECT * FROM customers WHERE since > '${since}') TO STDOUT`],
    { stdio: "ignore" },
  );
}

export { AWS_ACCESS_KEY, AWS_REGION, REPORTING_DSN, CARD_TOKEN, exportCustomerRows };
