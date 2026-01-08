import { pinyin } from "pinyin-pro";

/**
 * 处理标题，生成标准化的全拼和首字母
 * @param title 页面标题
 * @returns {pinyin_full: string, pinyin_first: string} 处理后的拼音信息
 */
function generatePinyinInfo(title: string): {
  pinyin_full: string;
  pinyin_first: string;
} {
  if (!title) return { pinyin_full: "", pinyin_first: "" };

  // 过滤特殊字符（保留中文、字母、数字），处理特殊符号干扰
  const cleanTitle = title.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "");
  if (!cleanTitle) return { pinyin_full: "", pinyin_first: "" };

  // 生成全拼（无音调，无分隔符）
  const fullPinyin = pinyin(cleanTitle, {
    toneType: "none",
    type: "string",
    separator: "",
  }).toLowerCase();

  // 生成首字母缩写（小写）
  const firstLetter = pinyin(cleanTitle, {
    pattern: "initial",
    separator: "",
  }).toLowerCase();

  return {
    pinyin_full: fullPinyin,
    pinyin_first: firstLetter,
  };
}
export { generatePinyinInfo };