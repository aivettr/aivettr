// 合成正样本：字符串字面量源码含 4 个以上 \xHH 转义，用于隐藏真实文本
const hidden = "\x68\x65\x6c\x6c\x6f\x20world";

function decode() {
  return hidden;
}

export { decode };
