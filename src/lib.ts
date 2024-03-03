import fs from "fs";
import { Context, Row } from "koishi";
import puppeteer from "koishi-plugin-puppeteer";
import { Config } from ".";

/**
 * 检查文件是否存在
 * @param filePath 文件路径
 * @returns true:存在 false:不存在
 */
export function checkFileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * @desc 获取文件修改时间
 * @param filePath 文件路径
 * @returns string 文件修改时间
 */
export function getFileModifyTime(filePath: string): string {
  const stats = fs.statSync(filePath);
  const fileModifiedTime = stats.mtime.getTime();
  return new Date(fileModifiedTime).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
}

/**
 * @desc 截屏
 * @param url 截屏地址
 * @param ctx 上下文
 * @param config 配置
 * @param itemName 物品名称
 * @returns string
 */
export async function screenShot(
  url: string,
  ctx: Context,
  itemName: string,
  config: Config
) {
  if (!url) {
    return `你游还没有这些东西...`;
  } else {
    const page = await ctx.puppeteer.page();
    await page.goto(url, {
      timeout: 0,
    });
    await delay(5000);
    await page.addStyleTag({
      // 添加详情页边框
      content: "#mw-content-text{padding: 40px}",
    });
    await delay(3000);

    const selector = await page.$("#mw-content-text");
    await delay(2000);
    return await selector
      .screenshot({
        type: "jpeg",
        quality: 80,
        path: `${config.imgPath}${itemName
          .replace(/\//g, "-")
          .replace(/:/g, "-")
          .replace(/'/g, "-")}.jpeg`,
      })
      .then(async () => {
        // console.info(`截图成功...`);
        return `截图已保存到以下网址，请自行点击查看:\n ${
          config.publicUrl
        }${encodeURI(
          itemName.replace(/\//g, "-").replace(/:/g, "-").replace(/'/g, "-")
        )}.jpeg`;
      })
      .catch((err) => {
        console.error(err);
        return `截图失败...`;
      })
      .finally(async () => {
        await page.close();
      });
  }
}

/**
 *
 * @param ms 延迟毫秒数
 * @returns void
 */
export async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @desc 从fandom获取数据
 * @returns []
 */
export async function getFromFandom(
  url: string,
  ctx: Context,
  itemName: string
) {
  return await ctx.http
    .get(url, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
      },
      params: {
        action: `opensearch`,
        search: itemName,
        limit: 5,
        redirects: "return",
        format: "json",
      },
    })
    .then(async (res) => {
      console.log(res);
      return [res[1], res[3]];
    })
    .catch((err) => {
      console.error(err);
      return [];
    });
}

/**
 * @param list 传入的列表,内部元素要求为偶数个
 * @returns 对象列表
 */
export function createMd(list: string[]): object[] {
  let res = [];
  for (let i = 0; i < list.length; i += 2) {
    res.push({
      key: list[i],
      values: [list[i + 1]],
    });
  }
  return res;
}

/**
 * @param btn_list 按钮数组 [['第一行按钮','第一行按钮DATA'],['第二行按钮','第二行按钮DATA']]
 * @returns 按钮列表rows
 * @description 创建多行按钮
 */
export function createBtn(input: string[][]): object[] {
  const rows = [];
  input.forEach((subList) => {
    const row = {
      buttons: [],
    };
    for (let i = 0; i < subList.length; i += 2) {
      const button = {
        id: i / 2 + 1,
        render_data: {
          label: subList[i],
          visited_label: subList[i],
        },
        ction: {
          type: 2,
          permission: {
            type: 2,
          },
          unsupport_tips: "兼容文本",
          data: subList[i + 1],
          enter: true,
        },
      };
      row.buttons.push(button);
    }
    rows.push(row);
  });
  return rows;
}
