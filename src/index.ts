//                   _ooOoo_
//                  o8888888o
//                  88" . "88
//                  (| o_0 |)
//                  O\  =  /O
//               ____/`---'\____
//             .'  \\|     |//  `.
//            /  \\|||  :  |||//  \
//           /  _||||| -:- |||||-  \
//           |   | \\\  -  /// |   |
//           | \_|  ''\---/''  |   |
//           \  .-\__  `-`  ___/-. /
//         ___`. .'  /--.--\  `. . __
//      ."" '<  `.___\_<|>_/___.'  >'"".
//     | | :  `- \`.;`\ _ /`;.`/ - ` : | |
//     \  \ `-.   \_ __\ /__ _/   .-` /  /
//======`-.____`-.___\_____/___.-`____.-'======
//                   `=---='
//
//^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                  南无加特林菩萨
//          菩提本无树           明镜亦非台
//          本来无BUG            何必常修改
//                  佛曰: 能跑就行

import { Context, Schema, Logger, h, sleep } from "koishi";
import puppeteer from "koishi-plugin-puppeteer";
import fs from "fs";
import os from "node:os";

export const name = "oni-wiki-qq";

export const inject = ["puppeteer"];
export const usage = `
  - 0.0.5 太久没写忘记build了...
  - 0.0.4 煞笔腾讯不给发md了艹
  - 0.0.3 将链接改为md发送以绕过沟腾讯的链接拦截
  - 0.0.2 基本功能完成
  - 0.0.1 初始化，明天再慢慢写了（
`;

export interface Config {
  api: string;
  imgPath: string;
  urlPath: string;
}
export const Config: Schema<Config> = Schema.object({
  api: Schema.string()
    .default("https://oxygennotincluded.wiki.gg/zh/api.php")
    .description("api地址"),
  imgPath: Schema.string()
    .default(os.homedir() + "/wikiImg/")
    .description("图片保存路径"),
  urlPath: Schema.string().description("图片公网访问路径"),
});

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger;

  // 注册指令
  ctx
    .command("t <itemName>", "查询缺氧中文wiki")
    .alias("/查wiki")
    .option("delete", "-d 删除本地缓存", { authority: 2 })
    .action(async ({ session, options }, itemName = "电解器") => {
      logger.info(session.guildId);

      const filePath =
        config.imgPath +
        itemName.replace(/\//g, "-").replace(/:/g, "-").replace(/'/g, "-") +
        ".jpeg";

      const urlPath =
        config.urlPath +
        itemName.replace(/\//g, "-").replace(/:/g, "-").replace(/'/g, "-") +
        ".jpeg";
      if (options.delete) {
        if (checkFileExists(filePath)) {
          fs.unlinkSync(filePath);
          return `已尝试删除${itemName}的缓存...`;
        } else {
          return `文件不存在.请检查....`;
        }
      }
      // 检查本地缓存

      if (checkFileExists(filePath)) {
        return h("img", { src: `${urlPath}` });
      }
      // 主流程
      session.send(`您查询的「${itemName}」进行中,请稍等...`);
      await sleep(2000);

      const res: string[] = await getWiki(config.api);
      if (res.length == 0) {
        return `在Wiki里没找到或API查询超时或....`;
      }

      const title = [...res[0]];
      let itemUrl: string[] = [...res[1]];
      logger.info(`API返回的数据为: ${title}`);

      if (title[0] === itemName) {
        let res: boolean = await screenShot(itemUrl[0]);
        if (res) {
          return h("img", { src: `${urlPath}` });
        } else {
          return `截图发生错误.请稍后重试..`;
        }
      } else {
        let [one = "萌新的骨头汤", two = "托德的女装", three = "鮟鱇鱼"] =
          title;
        session.send(
          `wiki里没有找到,你可以看看底下有没有你需要的,有,回复数字序号,没有,请等待查询超时减轻服务器压力.\n1.${one}\n2.${two}\n3.${three}`
        );

        const awlist = [1, 2, 3];
        const awser =
          +(await session.prompt(50 * 1000))?.replace(/\s+/g, "")?.slice(-1) ||
          NaN;
        if (awlist.includes(awser)) {
          let res = await screenShot(itemUrl[awser - 1]);
          if (res) {
            return h("img", { src: `${urlPath}` });
          } else {
            return `截图发生错误.请稍后重试..`;
          }
        } else if (Number.isNaN(awser)) {
          return `您输入的选项有误，已完结本轮查询。如需，如有需要，请重新发起查询.`;
        }
      }

      // 从wiki获取查询到的数据
      async function getWiki(api: string) {
        return await ctx.http
          .get(api, {
            headers: {
              "Content-Type": "application/json",
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
            },
            params: {
              action: `opensearch`,
              search: itemName,
              limit: 3,
              redirects: "return",
              format: "json",
            },
          })
          .then(async (res) => {
            logger.info(res);
            return [res[1], res[3]];
          })
          .catch((err) => {
            logger.error(err);
            return [];
          });
      }

      // 获取截图并保存到本地
      async function screenShot(url: string) {
        const page = await ctx.puppeteer.page();
        await page.goto(url, {
          timeout: 0,
        });
        // 等待一小会儿
        await sleep(3000);

        // 添加详情页边框  mw-parser-output
        await page.addStyleTag({
          content: "#mw-content-text{padding: 40px}",
        });
        const selector = await page.$("#mw-content-text");
        return await selector
          .screenshot({
            type: "jpeg",
            quality: 50,
            path: filePath,
          })
          .then(() => {
            return true;
          })
          .catch((err) => {
            logger.error(err);
            return false;
          })
          .finally(async () => await page.close());
      }
    });
}

function checkFileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
}
