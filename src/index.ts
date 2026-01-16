//                   _ooOoo_
//                  o8888888o
//                  88" . "88
//                  (| o_0 |)
//                  O\  =  /O
//               ____/`---'\____
//             .'  \\|     |//  `.
//            /  \\|||  :  ||||//  \
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
import {} from "@koishijs/plugin-server";
import { QQ } from "@koishijs/plugin-adapter-qq";
import { Mwn } from "mwn";
import { generatePinyinInfo } from "./lib";

export const name = "oni-wiki-qq";

export const usage = `
  - 0.9.0 添加md发送
  - 0.8.2 添加使用说明，空关键词返回使用说明
  - 0.8.1 修复模糊匹配同音不同字问题，优化拼音匹配规则和权重
  - 0.8.0 优化拼音/首字母匹配逻辑，新增拼音/首字母数据库缓存，提升匹配速度和精准度
  - 0.7.5 开启SSL
  - 0.7.4 添加重定向指令
  - 0.7.2 尝试修复短链接跳转问题
  - 0.7.0 实现短链路由转发，链接改为klei.vip/ggwiki或者bwiki+页面ID
  - 0.6.0 集成pinyin-pro拼音模糊匹配，精准匹配优先
  - 0.5.0 移除重定向功能 GG站点已修复，保留bwiki更新功能
  - 0.4.9 添加重定向功能
`;

export const inject = ["database", "server"];

// 扩展数据库声明，新增拼音和首字母字段
declare module "koishi" {
  interface Tables {
    wikipages: WikiPages;
  }
}

export interface WikiPages {
  id: number;
  title: string;
  pinyin_full: string; // 全拼（无音调，无分隔符）
  pinyin_first: string; // 首字母缩写（小写）
}

// 配置项
export interface Config {
  bot_username: string;
  bot_password: string;
  bwiki_session: string;
  domain: string;
  main_site: string;
  mirror_site: string;
  markdown_template_id: string;
  keyboard_id: string;
}
export const Config: Schema<Config> = Schema.object({
  bot_username: Schema.string().description("机器人用户名"),
  bot_password: Schema.string().description("机器人密码"),
  bwiki_session: Schema.string().description(
    "bwiki的session，无法连接到gg时使用"
  ),
  domain: Schema.string()
    .description("你的短链域名（必填，如：klei.vip）")
    .default("klei.vip"),
  main_site: Schema.string()
    .description("主站域名（必填，如：oxygennotincluded.wiki.gg）")
    .default("oxygennotincluded.wiki.gg/zh"),
  mirror_site: Schema.string()
    .description("镜像站域名（必填，如：wiki.biligame.com）")
    .default("wiki.biligame.com/oni"),
  markdown_template_id: Schema.string()
    .description("Markdown模板ID")
    .default("102019091_1708758661"),
  keyboard_id: Schema.string()
    .description("键盘ID")
    .default("102019091_1721643019"),
});

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger(name);
  let wikibot: Mwn;

  // 扩展数据库表
  ctx.model.extend("wikipages", {
    id: "integer",
    title: "string",
    pinyin_full: "string", // 全拼
    pinyin_first: "string", // 首字母
  });

  //原站路由：klei.vip/gg/[id] → 跳转至 oni.wiki/[title]?variant=zh
  ctx.server.get("/gg/:id", async (router) => {
    const pageId = Number(router.params.id);
    if (isNaN(pageId)) return (router.body = "❌ 无效的页面ID，必须为数字！");

    const [page] = await ctx.database.get("wikipages", { id: pageId });
    if (!page)
      return (router.body = `❌ 未找到ID为【${pageId}】的页面，请联系管理员更新缓存！`);
    const targetUrl = `https://${config.main_site}/${encodeURIComponent(
      page.title
    )}?variant=zh`;
    router.redirect(targetUrl); //重定向至oxygennotincluded.wiki.gg
  });

  // 镜像站路由：klei.vip/bw/[id] → 跳转至 wiki.biligame.com/oni/[title]
  ctx.server.get("/bw/:id", async (router) => {
    const pageId = Number(router.params.id);
    if (isNaN(pageId)) return (router.body = "❌ 无效的页面ID，必须为数字！");

    const [page] = await ctx.database.get("wikipages", { id: pageId });
    if (!page)
      return (router.body = `❌ 未找到ID为【${pageId}】的页面，请联系管理员更新缓存！`);

    const targetUrl = `https://${config.mirror_site}/${encodeURIComponent(
      page.title
    )}`;
    router.redirect(targetUrl); //重定向至wiki.biligame.com
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
    .command("x <itemName>", "查询缺氧中文wiki，精准匹配+拼音模糊匹配")
    .alias("/查wiki")
    .action(async ({ session }, itemName = "") => {
      const queryKey = itemName.trim().toLowerCase();
      // 空关键词返回使用说明，不进行查询，需要手动输入数据库ID 8个8
      if (queryKey === "")
        return `以下是使用说明：\n原站点: https://${config.domain}/gg/88888888\n\n镜像站: https://${config.domain}/bw/88888888`;

      // 将用户输入的关键词转换为拼音/首字母
      const { pinyin_full: queryPinyinFull, pinyin_first: queryPinyinFirst } =
        generatePinyinInfo(queryKey);

      // 精准匹配标题
      const preciseTitleRes = await ctx.database.get("wikipages", {
        title: queryKey,
      });
      if (preciseTitleRes.length > 0) {
        const { id } = preciseTitleRes[0];
        return `✅ 精准匹配成功\n原站点: https://${config.domain}/gg/${id}\n\n镜像站: https://${config.domain}/bw/${id}`;
      }

      // 匹配全拼
      const preciseFullPinyinRes = await ctx.database.get("wikipages", {
        pinyin_full: queryKey,
      });
      if (preciseFullPinyinRes.length > 0) {
        const { id, title } = preciseFullPinyinRes[0];
        return `✅ 拼音精准匹配成功（${queryKey} → ${title}）\n原站点: https://${config.domain}/gg/${id}\n\n镜像站: https://${config.domain}/bw/${id}`;
      }

      // 匹配首字母
      const preciseFirstPinyinRes = await ctx.database.get("wikipages", {
        pinyin_first: queryKey,
      });
      if (preciseFirstPinyinRes.length > 0) {
        const { id, title } = preciseFirstPinyinRes[0];
        return `✅ 首字母精准匹配成功（${queryKey} → ${title}）\n原站点: https://${config.domain}/gg/${id}\n\n镜像站: https://${config.domain}/bw/${id}`;
      }

      // 模糊匹配（标题/全拼/首字母包含关键词）
      const allPages = await ctx.database.get("wikipages", {});
      if (allPages.length === 0) {
        return `❌ 本地缓存为空，请联系管理员执行【update】指令更新缓存！`;
      }

      const matchResult: Array<{ id: number; title: string; score: number }> =
        [];

      allPages.forEach((page) => {
        const { title, pinyin_full, pinyin_first } = page;
        let score = 0;

        // 标题包含关键词（最高权重）
        if (title.includes(queryKey)) score += 10;
        // 标题拼音前缀匹配用户输入关键词的拼音（次高权重）
        if (pinyin_full.startsWith(queryPinyinFull)) score += 9;
        // 标题拼音包含用户输入关键词的拼音
        if (pinyin_full.includes(queryPinyinFull)) score += 8;
        // 标题首字母包含用户输入关键词的首字母
        if (pinyin_first.includes(queryPinyinFirst)) score += 6;
        // 用户输入关键词的拼音包含标题拼音的前缀（兜底）
        if (
          queryPinyinFull.includes(
            pinyin_full.substring(
              0,
              Math.min(pinyin_full.length, queryPinyinFull.length)
            )
          )
        )
          score += 5;

        if (score > 0) {
          matchResult.push({ id: page.id, title, score });
        }
      });

      if (matchResult.length === 0) {
        return `❌ 未找到【${queryKey}】相关内容，请按游戏内标准名称重新查询！`;
      }

      // 排序：分数降序 → 标题长度升序
      const sortedResult = matchResult.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.title.length - b.title.length;
      });

      // 去重 + 取前5条
      const uniqueResult = Array.from(
        new Map(sortedResult.map((item) => [item.title, item])).values()
      ).slice(0, 5);
      const resultCount = uniqueResult.length;

      let replyMsg = `🔍 未找到精准匹配，为你找到【 ${resultCount} 】个相似结果，请输入序号选择（10秒内有效）：\n`;
      uniqueResult.forEach((item, index) => {
        replyMsg += `${index + 1}. ${item.title}\n`;
      });
      replyMsg += `\n❗️ 提示：超时将静默结束，无任何回应`;
      if (config.markdown_template_id) {
        try {
          const md = {
            content: "111",
            msg_type: 2,
            markdown: {
              custom_template_id: config.markdown_template_id,
              params: [
                {
                  key: "text1",
                  // QQ 支持的 合规换行转义符 &#10;
                  values: [replyMsg.replace(/\n/g, "&#10;")],
                },
              ],
            },
            keyboard: {
              id: config.keyboard_id,
            },
            msg_id: session.messageId,
            timestamp: session.timestamp,
            msg_seq: Math.floor(Math.random() * 500),
          };
          await session.qq.sendMessage(session.guildId, md);
        } catch (err) {
          logger.error("发送markdown失败", err);
          await session.send(replyMsg);
        }
      }
      // 等待用户输入
      const userInput = await session.prompt(15000);
      if (!userInput) return;

      const selectNum = parseInt(userInput.trim());
      if (isNaN(selectNum) || selectNum < 1 || selectNum > resultCount) {
        return `❌ 输入无效！请输入 1-${resultCount} 之间的数字序号`;
      }

      const { id } = uniqueResult[selectNum - 1];
      return `✅ 选择成功\n原站点: https://${config.domain}/gg/${id}\n\n镜像站: https://${config.domain}/bw/${id}`;
    });

  // 缓存更新相关指令（主站）
  ctx
    .command("update", "更新本地页面缓存（主站）", { authority: 2 })
    .action(async ({ session }) => {
      await session.execute("update.status");
      try {
        const res = await wikibot.request({
          action: "query",
          list: "allpages",
          format: "json",
          aplimit: "max",
        });
        logger.info("主站页面查询成功");
        const pages = res.query.allpages || [];

        // 批量处理页面数据，生成拼音信息
        const pageData = pages.map((page) => {
          const { pinyin_full, pinyin_first } = generatePinyinInfo(page.title);
          return {
            id: page.pageid,
            title: page.title,
            pinyin_full,
            pinyin_first,
          };
        });

        // 批量更新数据库
        if (pageData.length > 0) {
          await ctx.database.upsert("wikipages", pageData);
        }

        session.send(`✅ 检索到 ${pages.length} 个页面，已更新至数据库`);
        logger.info(`检索到 ${pages.length} 个页面，已更新至数据库`);
      } catch (err) {
        logger.error("主站缓存更新失败", err);
        session.send("❌ 主站缓存更新失败，请联系管理员查看日志");
      }
    });

  // 删除本地缓存
  ctx
    .command("update.delete", "删除本地页面缓存", { authority: 4 })
    .action(async ({ session }) => {
      try {
        const count = await ctx.database.remove("wikipages", {});
        session.send(`✅ 已删除 ${count.removed} 条本地缓存`);
        logger.info(`已删除 ${count.removed} 条本地缓存`);
      } catch (err) {
        logger.error("删除缓存失败", err);
        session.send("❌ 删除缓存失败，请联系管理员查看日志");
      }
    });

  // 使用bwiki更新缓存
  ctx
    .command("update.bw", "使用bwiki的session更新缓存", { authority: 2 })
    .action(async ({ session }) => {
      try {
        const headers = {
          "Content-Type": "application/json",
          "user-agent": "Charles'queryBot",
          Cookie: `SESSDATA=${config.bwiki_session}`,
        };
        const url = `https://wiki.biligame.com/oni/api.php?action=query&list=allpages&apnamespace=0&aplimit=5000&format=json`;

        const res = await ctx.http.get(url, { headers });
        const pages = res.query?.allpages || [];

        // 批量处理页面数据，生成拼音信息
        const pageData = pages.map((page) => {
          const { pinyin_full, pinyin_first } = generatePinyinInfo(page.title);
          return {
            id: page.pageid,
            title: page.title,
            pinyin_full,
            pinyin_first,
          };
        });

        // 批量更新数据库
        if (pageData.length > 0) {
          await ctx.database.upsert("wikipages", pageData);
        }

        session.send(`✅ 从Bwiki检索到 ${pages.length} 个页面，已更新至数据库`);
        logger.info(`从Bwiki检索到 ${pages.length} 个页面，已更新至数据库`);
      } catch (err) {
        logger.error("Bwiki缓存更新失败", err);
        session.send("❌ Bwiki缓存更新失败，请联系管理员查看日志");
      }
    });

  // 查询缓存状态
  ctx
    .command("update.status", "查询本地缓存数量", { authority: 1 })
    .action(async ({ session }) => {
      try {
        const pages = await ctx.database.get("wikipages", {});
        session.send(`📊 数据库中缓存了 ${pages.length} 条页面`);
        logger.info(`数据库中缓存了 ${pages.length} 条页面`);
      } catch (err) {
        logger.error("查询缓存状态失败", err);
        session.send("❌ 查询缓存状态失败，请联系管理员查看日志");
      }
    });

  // 添加重定向
  ctx
    .command("redirect <pageName> <targetPageName>", "添加原站点重定向", {
      authority: 2,
    })
    .alias("重定向")
    .action(async ({ session }, pageName, targetPageName) => {
      if (!pageName || !targetPageName) {
        return "❌ 参数错误！用法：redirect <原页面名> <目标页面名>";
      }
      try {
        await wikibot.create(
          pageName,
          `#REDIRECT [[${targetPageName}]]`,
          "来自qq机器人的添加重定向页面请求"
        );
        logger.info(`已为 ${pageName} 添加重定向至 ${targetPageName}`);
        session.send(`✅ 已尝试添加重定向 ${pageName} -> ${targetPageName}`);
        // 更新缓存
        await session.execute(`update`);
      } catch (err) {
        logger.error(`添加重定向 ${pageName} -> ${targetPageName} 失败`, err);
        session.send(`❌ 添加重定向失败，请联系管理员查看日志`);
      }
    });
}
