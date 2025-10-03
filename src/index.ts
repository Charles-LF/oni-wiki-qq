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

import { Context, Schema, Logger } from "koishi";
import { Mwn } from 'mwn'

export const name = "oni-wiki-qq";

export const usage = `
  - 0.4.9 添加重定向功能
  - 0.4.8 重启bwiki更新
  - 0.4.6 移除没必要的功能
  - 0.4.5 检测教程页面
`;

export const inject = ["database"];

// 数据库声明
declare module "koishi" {
  interface Tables {
    wikipages: WikiPages; // 全部页面
  }
}

export interface WikiPages {
  id: number;
  title: string;
  redirect: string;
}

// 配置项
export interface Config {
  bot_username: string;
  bot_password: string;
  bwiki_session: string;
}
export const Config: Schema<Config> = Schema.object({
  bot_username: Schema.string().description("机器人用户名"),
  bot_password: Schema.string().description("机器人密码"),
  bwiki_session: Schema.string().description("bwiki的session,无法连接到gg时使用"),
});

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger;
  let wikibot: Mwn;

  ctx.model.extend("wikipages", {
    id: "integer",
    title: "string",
    redirect: "string",
  });

  // 启动时登录
  ctx.on("ready", async () => {
    wikibot = new Mwn({
      apiUrl: 'https://oxygennotincluded.wiki.gg/zh/api.php',
      username: config.bot_username,
      password: config.bot_password,
      userAgent: 'Charles`Bot/2.1',
      defaultParams: {
        assert: 'user'
      }
    });
    wikibot.login().then(() => {
      logger.info('Wiki机器人登录成功');
    }).catch((err) => {
      logger.error('Wiki机器人登录失败', err);
    });
  });

  // 注册指令
  ctx
    .command("x <itemName>", "查询缺氧中文wiki")
    .alias("/查wiki")
    .action(async ({ session }, itemName = "电解器") => {
      if (/教程/.test(itemName)) {
        return `请点击链接前往站点查看:\n原站点:  http://oni.wiki/${encodeURI(
          `教程`
        )}\n镜像站:  http://klei.vip/oni/usiz6d/${encodeURI(`教程`)}`;
      }
      const res = await ctx.database.get("wikipages", {
        $or: [{
          title: itemName
        },
        {
          redirect: itemName
        }]
      });

      if (res.length == 0) {
        return `在Wiki里没找到,如有需要,请按照游戏内名称重新发起查询....`;
      }
      const pageName = res[0].title;
      return `请点击链接前往站点查看:\n原站点:  http://oni.wiki/${encodeURI(
        pageName
      )}\n镜像站:  http://klei.vip/oni/usiz6d/${encodeURI(pageName)}`;
    });

  ctx.command("x.redirect <itemName:string> <redirect:string>", "物品重定向", { authority: 2 }).alias("重定向")
    .action(async ({ session }, itemName, redirect) => {
      if (!itemName || !redirect) {
        return `请提供物品名称或重定向链接，格式如下：\n重定向 页面名称 重定向到页面物品名称`;
      }
      // 检查数据库中是否存在
      const database_res = await ctx.database.get("wikipages", {
        $or: [{
          title: itemName
        },
        {
          redirect: itemName
        }]
      });
      if (database_res.length == 0) {
        return `在数据库里没找到 ${itemName},如有需要,请按照游戏内名称重新发起重定向或联系管理员`;
      }
      if (database_res[0].redirect) {
        return `${itemName} 已存在重定向,如需修改请联系管理员`;
      }
      // 写入数据库
      await ctx.database.upsert("wikipages", [{
        id: database_res[0].id,
        title: itemName,
        redirect: redirect
      }]).then(() => {
        wikibot.save(`${itemName}`, `#REDIRECT [[${redirect}]]`)
          .then(() => {
            session.send(`已成功将 ${itemName} 重定向至 ${redirect}并写入GG原站点`);
          }).catch((err) => {
            logger.error('写入重定向至原站点失败：', err);
            session.send('写入重定向至原站点失败,请联系管理员检查日志或自行前往原站点编辑');
          });
        return `已成功将 ${itemName} 重定向至 ${redirect} 并写入数据库`;
      });
    });

  ctx.command("update", "更新本地页面缓存", { authority: 2 }).action(async ({ session }) => {
    wikibot.request({
      action: 'query',
      list: 'allpages',
      format: 'json',
      aplimit: 'max'
    }).then((res) => {
      logger.info('查询成功');
      const pages = res.query.allpages;
      pages.forEach((page) => {
        ctx.database.upsert('wikipages', () => [
          { id: page.pageid, title: page.title },
        ]);
      });
      session.send(`检索到 ${pages.length} 个页面，已尝试更新至数据库`);
      logger.info(`检索到 ${pages.length} 个页面，已尝试更新至数据库`);
    }).catch((err) => {
      logger.error('查询失败', err);
    });
  });
  ctx.command("update.delete", " 删除本地页面缓存", { authority: 4 }).action(async ({ session }) => {
    const count = await ctx.database.remove('wikipages', {});
    session.send(`已删除 ${count.removed} 条本地缓存`);
    logger.info(`已删除 ${count.removed} 条本地缓存`);
  });
  ctx.command("update.bwiki", "使用bwiki的session更新本地页面缓存", { authority: 2 })
    .action(async ({ session }) => {
      const headers = {
        "Content-Type": "application/json",
        "user-agent": "Charles'queryBot",
        Cookie: `SESSDATA=${config.bwiki_session}`,
      };
      const url = `https://wiki.biligame.com/oni/api.php?action=query&list=allpages&apnamespace=0&aplimit=5000&format=json`;
      ctx.http.get(url, { headers: headers })
        .then((res) => {
          res["query"]["allpages"].forEach((page) => {
            ctx.database.upsert('wikipages', () => [
              { id: page.pageid, title: page.title },
            ]);
          });
          session.send(`检索到 ${res["query"]["allpages"].length} 个页面，已尝试更新至数据库`);
          logger.info(`检索到 ${res["query"]["allpages"].length} 个页面，已尝试更新至数据库`);
        })
        .catch((err) => {
          session.send('更新失败,请联系管理员检查日志');
          logger.error('更新失败', err);
        });
    });
  ctx.command("update.status", "查询本地页面缓存数量", { authority: 1 }).action(async ({ session }) => {
    const count = await ctx.database.get('wikipages', {});
    session.send(`数据库中缓存了 ${count.length} 条页面`);
    logger.info(`数据库中缓存了 ${count.length} 条页面`);
  });
}

