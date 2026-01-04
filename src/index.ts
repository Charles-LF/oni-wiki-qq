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
import { Mwn } from "mwn";
import { pinyin } from "pinyin-pro";

export const name = "oni-wiki-qq";

export const usage = `
  - 0.6.1 ✅ 模糊匹配返回最多5条结果+序号等待交互，超时无输入则静默结束
  - 0.6.0 集成pinyin-pro拼音模糊匹配，精准匹配优先
  - 0.5.0 移除重定向功能 GG站点已修复，保留bwiki更新功能
  - 0.4.9 添加重定向功能
  - 0.4.8 重启bwiki更新
  - 0.4.6 移除没必要的功能
  - 0.4.5 检测教程页面
`;

export const inject = ["database"];

// 数据库声明
declare module "koishi" {
  interface Tables {
    wikipages: WikiPages;
  }
}

export interface WikiPages {
  id: number;
  title: string;
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
  bwiki_session: Schema.string().description(
    "bwiki的session，无法连接到gg时使用"
  ),
});

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger(name);
  let wikibot: Mwn;

  ctx.model.extend("wikipages", {
    id: "integer",
    title: "string",
  });

  // Wiki机器人登录
  ctx.on("ready", async () => {
    wikibot = new Mwn({
      apiUrl: "https://oxygennotincluded.wiki.gg/zh/api.php",
      username: config.bot_username,
      password: config.bot_password,
      userAgent: "Charles`Bot/2.1",
      defaultParams: { assert: "user" },
    });
    wikibot
      .login()
      .then(() => logger.info("Wiki机器人登录成功"))
      .catch((err) => logger.error("Wiki机器人登录失败", err));
  });

  ctx
    .command("x <itemName>", "查询缺氧中文wiki，精准匹配+拼音模糊匹配+序号选择")
    .alias("/查wiki")
    .action(async ({ session }, itemName = "电解器") => {
      // 教程页面特殊处理
      if (/教程/.test(itemName)) {
        return `请点击链接前往站点查看:\n原站点:  http://oni.wiki/${encodeURI(
          `教程`
        )}?variant=zh\n镜像站:  http://klei.vip/oni/usiz6d/${encodeURI(
          `教程`
        )}`;
      }

      const queryKey = itemName.trim();
      // 精准匹配：完全一致直接返回网址
      const preciseRes = await ctx.database.get("wikipages", {
        $or: [{ title: queryKey }],
      });
      if (preciseRes.length > 0) {
        const pageName = preciseRes[0].title;
        return `✅ 精准匹配成功
原站点:  http://oni.wiki/${encodeURI(pageName)}?variant=zh
镜像站:  http://klei.vip/oni/usiz6d/${encodeURI(pageName)}`;
      }

      // 无精准匹配 → 拼音模糊匹配（返回最多5条结果）
      const allPages = await ctx.database.get("wikipages", {});
      if (allPages.length === 0) {
        return `❌ 本地缓存为空，请联系管理员执行【update】指令更新缓存！`;
      }

      const userPinyin = pinyin(queryKey, {
        toneType: "none",
        type: "string",
        separator: "",
      });
      const userFirstLetter = pinyin(queryKey, {
        type: "string",
        separator: "",
      }).toLowerCase();
      const matchResult: Array<{ title: string; score: number }> = [];

      allPages.forEach((page) => {
        const targetTitle = page.title || "";
        if (!targetTitle) return;
        const titlePinyin = pinyin(targetTitle, {
          toneType: "none",
          type: "string",
          separator: "",
        });
        const titleFirstLetter = pinyin(targetTitle, {
          type: "string",
          separator: "",
        }).toLowerCase();

        let score = 0;
        if (
          titlePinyin.includes(userPinyin) ||
          userPinyin.includes(titlePinyin)
        )
          score += 5;
        if (targetTitle.includes(queryKey)) score += 4;
        if (
          titleFirstLetter.includes(userFirstLetter) ||
          userFirstLetter.includes(titleFirstLetter)
        )
          score += 3;
        if (score > 0) matchResult.push({ title: targetTitle, score });
      });

      // 无模糊匹配结果 → 直接返回提示，不等待
      if (matchResult.length === 0) {
        return `❌ 未找到【${queryKey}】相关内容，请按游戏内标准名称重新查询！`;
      }

      // 排序+去重 → 最多返回5条候选结果
      const sortedResult = matchResult.sort((a, b) => b.score - a.score);
      const uniqueResult = Array.from(
        new Map(sortedResult.map((item) => [item.title, item])).values()
      ).slice(0, 5);
      const resultCount = uniqueResult.length;

      // 发送候选结果，等待用户输入序号（10秒超时，无输入则静默结束）
      let replyMsg = `🔍 未找到精准匹配，为你找到【 ${resultCount} 】个相似结果，请输入序号选择（10秒内有效）：\n`;
      uniqueResult.forEach((item, index) => {
        replyMsg += `${index + 1}. ${item.title}\n`;
      });
      replyMsg += `\n❗️ 提示：超时将静默结束，无任何回应`;
      // 发送候选列表给用户
      await session.send(replyMsg);

      // 等待用户输入序号，超时返回null → 静默结束，无任何回应
      const userInput = await session.prompt(10000); // 超时时间：10000ms=10秒
      if (!userInput) return;

      // 处理用户输入的序号，返回对应网址
      const selectNum = parseInt(userInput.trim());
      // 校验序号有效性：非数字/超出范围 → 提示错误，不返回其他内容
      if (isNaN(selectNum) || selectNum < 1 || selectNum > resultCount) {
        return `❌ 输入无效！请输入 1-${resultCount} 之间的数字序号`;
      }
      // 序号有效 → 拼接对应页面的网址返回
      const targetPage = uniqueResult[selectNum - 1].title;
      return `✅ 选择成功
原站点:  http://oni.wiki/${encodeURI(targetPage)}?variant=zh
镜像站:  http://klei.vip/oni/usiz6d/${encodeURI(targetPage)}`;
    });

  ctx
    .command("update", "更新本地页面缓存", { authority: 2 })
    .action(async ({ session }) => {
      wikibot
        .request({
          action: "query",
          list: "allpages",
          format: "json",
          aplimit: "max",
        })
        .then((res) => {
          logger.info("查询成功");
          const pages = res.query.allpages;
          pages.forEach((page) => {
            ctx.database.upsert("wikipages", () => [
              { id: page.pageid, title: page.title },
            ]);
          });
          session.send(`检索到 ${pages.length} 个页面，已尝试更新至数据库`);
          logger.info(`检索到 ${pages.length} 个页面，已尝试更新至数据库`);
        })
        .catch((err) => logger.error("查询失败", err));
    });

  ctx
    .command("update.delete", "删除本地页面缓存", { authority: 4 })
    .action(async ({ session }) => {
      const count = await ctx.database.remove("wikipages", {});
      session.send(`已删除 ${count.removed} 条本地缓存`);
      logger.info(`已删除 ${count.removed} 条本地缓存`);
    });

  ctx
    .command("update.bwiki", "使用bwiki的session更新缓存", { authority: 2 })
    .action(async ({ session }) => {
      const headers = {
        "Content-Type": "application/json",
        "user-agent": "Charles'queryBot",
        Cookie: `SESSDATA=${config.bwiki_session}`,
      };
      const url = `https://wiki.biligame.com/oni/api.php?action=query&list=allpages&apnamespace=0&aplimit=5000&format=json`;
      ctx.http
        .get(url, { headers })
        .then((res) => {
          res["query"]["allpages"].forEach((page) => {
            ctx.database.upsert("wikipages", () => [
              { id: page.pageid, title: page.title },
            ]);
          });
          session.send(
            `检索到 ${res["query"]["allpages"].length} 个页面，已尝试更新至数据库`
          );
          logger.info(
            `检索到 ${res["query"]["allpages"].length} 个页面，已尝试更新至数据库`
          );
        })
        .catch((err) => {
          session.send("更新失败,请联系管理员检查日志");
          logger.error("更新失败", err);
        });
    });

  ctx
    .command("update.status", "查询本地缓存数量", { authority: 1 })
    .action(async ({ session }) => {
      const count = await ctx.database.get("wikipages", {});
      session.send(`数据库中缓存了 ${count.length} 条页面`);
      logger.info(`数据库中缓存了 ${count.length} 条页面`);
    });
}
