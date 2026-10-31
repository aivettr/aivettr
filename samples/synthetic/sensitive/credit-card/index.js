// 合成正样本：硬编码银行卡号（4111 标准测试卡，Luhn 校验通过）
const testCardNumber = "4111111111111111";

function charge(amount) {
  return { card: testCardNumber, amount };
}

export { charge };
