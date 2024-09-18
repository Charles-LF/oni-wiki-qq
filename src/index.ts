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

import { Context, Schema, Logger, Time, $ } from "koishi";

export const name = "oni-wiki-qq";

export const usage = `
  - 0.4.3 收集搜索的词汇频率
  - 0.4.2 修改/ 的使用方式,改为 >
  - 0.4.1 增加/的处理
  - 0.4.0 移除MWN.将查询处理改至查询数据库
  - 0.3.0 移除耗内存的截图部分,使用镜像站点网页
  - 0.2.0 尝试添加 MWN 库
`;

export const inject = ["database"];

// 数据库声明
declare module "koishi" {
  interface Tables {
    wikipages: WikiPages; // 全部页面
    searchpages: searchPages; // 搜索词
  }
}

export interface WikiPages {
  id: number;
  title: string;
}

export interface searchPages {
  id: number;
  title: string;
  time: string;
}

// 配置项
export interface Config {
  SESSDATA: string;
}
export const Config: Schema<Config> = Schema.object({
  SESSDATA: Schema.string().description("SESSDATA"),
});

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger;

  ctx.model.extend("wikipages", {
    id: "integer",
    title: "string",
  });
  ctx.model.extend(
    "searchpages",
    {
      id: "unsigned",
      title: "string",
      time: "string",
    },
    {
      primary: "id",
      autoInc: true,
    }
  );

  // 注册指令
  ctx
    .command("x <itemName>", "查询缺氧中文wiki")
    .alias("/查wiki")
    .action(async ({ session }, itemName = "电解器") => {
      await ctx.database.create("searchpages", {
        title: itemName,
        time: Time.template("yyyy-MM-dd hh:mm:ss", new Date()),
      });
      const res = await ctx.database.get("wikipages", {
        title: [`${itemName.replace("/", ">")}`],
      });
      logger.info(res);
      if (res.length == 0) {
        return `在Wiki里没找到或API查询超时,如有需要,请按照游戏内名称重新发起查询....`;
      }
      return `请点击链接前往站点查看:\n原站点:  http://oni.wiki/${encodeURI(
        itemName
      )}\n镜像站:  https://klei.vip/oni/usiz6d/${encodeURI(itemName)}`;
    });

  ctx
    .command("update", "更新本地页面缓存", { authority: 2 })
    .action(async () => {
      const url = `https://wiki.biligame.com/oni/api.php?action=query&list=allpages&aplimit=5000&format=json`;
      return await ctx.http
        .get(url, {
          headers: {
            "Content-Type": "application/json",
            "user-agent": "Charles'queryBot",
            Cookie: `SESSDATA=${config.SESSDATA}`,
          },
        })
        .then((res) => {
          console.log(res["query"]["allpages"]);
          res["query"]["allpages"].forEach(async (element) => {
            console.log(element.title);
            await ctx.database.upsert("wikipages", () => [
              { id: element.pageid, title: element.title.replace("/", ">") },
            ]);
          });
          return `更新已完成,已尝试写入数据库}`;
        })
        .catch((err) => {
          console.log(err);
          return `出现了一点点问题`;
        });
    });

  ctx
    .command("doc", "大叔的文档链接")
    .alias("/大叔文档")
    .action(async () => {
      return `大叔的文档链接:\n https://klei.vip/oni/926f8b`;
    });
  ctx
    .command("RocketCalculator", "火箭计算器")
    .alias("火箭计算器")
    .action(async () => {
      return `火箭计算器链接:\n https://klei.vip/oni/t93o56`;
    });
  // ctx
  //   .command("frequency", "获取本月搜索次数最高的10位")
  //   .alias("搜索频率")
  //   .action(async ({ session }) => {
  //     let now = Time.template("yyyy-MM-dd hh:mm:ss", new Date());
  //     let a = await ctx.database
  //       .select("searchpages")
  //       .where((row) => $.gt(row.time, now))
  //       .orderBy((row) => row.id)
  //       .execute();
  //     console.log(a);
  //   });
}
