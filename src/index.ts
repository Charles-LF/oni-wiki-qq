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
import { checkFileExists, getWiki } from "./lib";

export const name = "oni-wiki-qq";

export const inject = ["puppeteer"];
export const usage = `
  - 0.2.0 尝试添加 MWN 库
  - 0.1.0 添加登录和点击cookies按钮,删除没法判断答案的代码
  - 0.0.9 尝试移除导航框,更新koishi依赖
`;

export interface Config {
  api: string;
  imgPath: string;
  urlPath: string;
  navSelector: string;
  contentSelector: string;
  loginUrl: string;
  userNameSelector: string;
  passwordSelector: string;
  checkBoxSelector: string;
  userName: string;
  password: string;
  mainPage: string;
  btnSelector: string;
}
export const Config: Schema<Config> = Schema.object({
  api: Schema.string()
    .default("https://oxygennotincluded.wiki.gg/zh/api.php")
    .description("api地址"),
  imgPath: Schema.string()
    .default(os.homedir() + "/wikiImg/")
    .description("图片保存路径"),
  urlPath: Schema.string().description("图片公网访问路径"),
  navSelector: Schema.string().description("导航框类名").default(".navbox"),
  contentSelector: Schema.string()
    .description("内容区选择器")
    .default("#mw-content-text"),
  loginUrl: Schema.string()
    .description("登录页面地址")
    .default(
      "https://oxygennotincluded.wiki.gg/zh/index.php?title=Special:%E7%94%A8%E6%88%B7%E7%99%BB%E5%BD%95&returnto=%E9%A6%96%E9%A1%B5"
    ),
  userNameSelector: Schema.string()
    .description("用户名输入区选择器")
    .default("input[name='wpName']"),
  passwordSelector: Schema.string()
    .description("密码输入区选择器")
    .default("input[name='wpPassword']"),
  checkBoxSelector: Schema.string()
    .description("总是保持登录复选框")
    .default("inpt[name='wpRemeber']"),
  userName: Schema.string().description("用户名"),
  password: Schema.string().description("密码"),
  mainPage: Schema.string()
    .default("https://oxygennotincluded.wiki.gg/zh/")
    .description("主页地址"),
  btnSelector: Schema.string()
    .default(".NN0_TB_DIsNmMHgJWgT7U")
    .description("需要点击的按钮选择器"),
});

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger;

  // 注册指令
  ctx
    .command("x <itemName>", "查询缺氧中文wiki")
    .alias("/查wiki")
    .option("delete", "-d 删除本地缓存", { authority: 1 })
    .action(async ({ session, options }, itemName = "电解器") => {
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
        return h(
          "p",
          `图片已保存至：${encodeURI(urlPath)}`,
          h("img", { src: `${encodeURI(urlPath)}` })
        );
      }
      // 主流程
      session.send(`您查询的「${itemName}」进行中,请稍等...`);
      await sleep(500);

      const res: string = await getWiki(itemName, config);
      if (!res) {
        return `在Wiki里没找到或API查询超时,如有需要,请按照游戏内名称重新发起查询....`;
      }
      let screenShotRes: boolean = await screenShot(res);

      logger.info(`API返回的数据为: ${screenShotRes}`);

      if (screenShotRes) {
        return h(
          "p",
          `图片已保存至：${encodeURI(urlPath)}`,
          h("img", { src: `${encodeURI(urlPath)}` })
        );
      } else {
        return `截图发生错误.请稍后重试..`;
      }

      // 获取截图并保存到本地
      async function screenShot(url: string) {
        const page = await ctx.puppeteer.page();
        await page.goto(url, {
          timeout: 0,
        });
        // 等待一小会儿
        await sleep(2000);

        // 添加详情页边框  mw-parser-output   移除 导航框 pi-navbox
        await page.addStyleTag({
          content: `${config.contentSelector}{padding: 40px}`,
        });
        try {
          await page.$eval(config.navSelector, (el) => el.remove());
        } catch (error) {
          logger.error(error);
        }
        const selector = await page.$(config.contentSelector);
        return await selector
          .screenshot({
            type: "jpeg",
            quality: 50,
            path: filePath,
          })
          .then(() => {
            return true;
          })
          .catch(async (err) => {
            logger.error(err);
            return false;
          })
          .finally(async () => await page.close());
      }
    });
  ctx
    .command("loginwiki [BotuserName] <BotPassword>", "使用机器人账户登录", {
      authority: 4,
    })
    .action(async ({ session }, BotuserName = "", BotPassword) => {
      const page = await ctx.puppeteer.page();
      logger.info(`正在前往登录页:${config.loginUrl}`);
      await page.goto(config.loginUrl, {
        timeout: 0,
      });
      await sleep(4000);
      logger.info(`输入用户名`);
      await page.type(config.userNameSelector, BotuserName);
      await sleep(1000);
      logger.info(`输入密码`);
      await page.type(config.passwordSelector, BotPassword);
      await sleep(1000);
      logger.info("点击保持登录复选框");
      await page.click(config.checkBoxSelector);
      await sleep(1000);
      await page.click(`button[type="submit"]`);
      await sleep(6000);
      const img = await page.screenshot({ type: "jpeg", quality: 50 });
      session.send(h.image(img, "jpeg/image"));
      await page.close().then(() => logger.info(`页面已经成功关闭`));
      return `登录已完成.`;
    });

  ctx.command("clickBtn", { authority: 4 }).action(async ({ session }) => {
    const page = await ctx.puppeteer.page();
    await page.goto(config.mainPage, { timeout: 0 });
    const selector = await page.$(config.btnSelector);

    await sleep(8000);
    await selector
      .click()
      .then(() => logger.info(`成功点击了按钮`))
      .catch((err) => logger.info(`出错啦,${err}`));
    await sleep(8000);
    await page
      .click(`button[type="submit"]`)
      .then(() => logger.info(`点击了按钮`))
      .catch((err) => logger.error(`出错了,${err}`));
    await sleep(5000);
    session.send(
      h.image(
        await page.screenshot({ type: "jpeg", quality: 80 }),
        "jpeg/image"
      )
    );
    page.close;
  });
}
