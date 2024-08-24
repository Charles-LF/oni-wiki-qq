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
import { Mwn } from "mwn";

export const name = "oni-wiki-qq";

export const usage = `
  - 0.3.3 所有网址处理
  - 0.3.2 网址加白处理
  - 0.3.1 错别字修改
  - 0.3.0 移除耗内存的截图部分,使用镜像站点网页
  - 0.2.0 尝试添加 MWN 库
`;

export interface Config {
  api: string;
  originalUrl: string;
  mirrorUrl: string;
  docUrl: string;
  userName: string;
  password: string;
}
export const Config: Schema<Config> = Schema.object({
  api: Schema.string()
    .default("https://oxygennotincluded.wiki.gg/zh/api.php")
    .description("api地址"),
  originalUrl: Schema.string()
    .default("https://oxygennotincluded.wiki.gg/zh/wiki/")
    .description("原站点网址"),
  mirrorUrl: Schema.string()
    .default("https://klei.vip/oni/usiz6d/")
    .description("镜像站点网址"),
  docUrl: Schema.string()
    .default("klei.vip/oni/926f8b")
    .description("大叔的文档地址"),
  userName: Schema.string().description("机器人用户名"),
  password: Schema.string().description("机器人密码"),
});

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger;

  // 注册指令
  ctx
    .command("x <itemName>", "查询缺氧中文wiki")
    .alias("/查wiki")
    .action(async ({ session }, itemName = "电解器") => {
      session.send(`您查询的「${itemName}」进行中,请稍等...`);

      const res: string = await getWiki(itemName);

      if (!res) {
        return `在Wiki里没找到或API查询超时,如有需要,请按照游戏内名称重新发起查询....`;
      }
      return `请点击链接前往站点查看:\n原站点: ${res.replace(
        config.originalUrl,
        "http://oni.wiki/"
      )}\n镜像站: ${res.replace(config.originalUrl, config.mirrorUrl)}`;
    });
  async function getWiki(itemName: string): Promise<string> {
    const bot: Mwn = await Mwn.init({
      apiUrl: config.api,
      username: config.userName,
      password: config.password,
      userAgent: "queryBot 0.0.3 ([[user:Charles-lf]])",
      defaultParams: {
        assert: "user",
      },
    });
    return await bot
      .request({
        action: "opensearch",
        search: itemName,
        namespace: "*",
        limit: 3,
        redirects: "return",
        format: "json",
      })
      .then(async (res) => {
        logger.info(res);
        if (res[1][0] == itemName) {
          return res[3][0];
        } else {
          return "";
        }
      })
      .catch(async (err) => console.log(err))
      .finally(async () => {
        bot.logout();
      });
  }
  ctx
    .command("doc", "大叔的文档链接")
    .alias("/大叔文档")
    .action(async () => {
      return `大叔的文档链接:\n ${config.docUrl}`;
    });
}
