import { pinyin } from "pinyin-pro";

/**
 * 处理文本，生成标准化的全拼和首字母
 * @param text 中文文本
 * @returns {pinyin_full: string, pinyin_first: string} 处理后的拼音信息
 */
function generatePinyinInfo(text: string): {
  pinyin_full: string;
  pinyin_first: string;
} {
  if (!text) return { pinyin_full: "", pinyin_first: "" };

  // 过滤特殊字符（保留中文、字母、数字）
  const cleanText = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
  if (!cleanText) return { pinyin_full: "", pinyin_first: "" };

  // 生成全拼（无音调，无分隔符，小写）
  const fullPinyin = pinyin(cleanText, {
    toneType: "none",
    type: "string",
    separator: "",
  }).toLowerCase();

  // 生成首字母缩写（小写）
  const firstLetter = pinyin(cleanText, {
    pattern: "initial",
    separator: "",
  }).toLowerCase();

  return {
    pinyin_full: fullPinyin,
    pinyin_first: firstLetter,
  };
}
export { generatePinyinInfo };