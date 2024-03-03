import { Context, Schema } from "koishi";
import fs from "fs";
import os from "os";
import puppeteer from "koishi-plugin-puppeteer";
import * as lib from "./lib";

export const name = "oni-wiki-qq";
export const inject = ["puppeteer"];
export const usage = `
  - 0.0.2 基本功能完成
  - 0.0.1 初始化，明天再慢慢写了（
`;

export interface Config {
  mdId: string;
  api: string;
  imgPath: string;
  publicUrl: string;
}

export const Config: Schema<Config> = Schema.object({
  mdId: Schema.string().description("模板ID"),
  api: Schema.string()
    .description("api地址")
    .default("https://oxygennotincluded.fandom.com/zh/api.php"),
  imgPath: Schema.string()
    .description("图片保存路径")
    .default(os.homedir() + "\\wikiImg\\"),
  publicUrl: Schema.string().description("图片公网访问路径"),
});

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger(name);
  // 注册指令
  ctx
    .command("c <itemName>", "查询缺氧中文wiki")
    .alias("/查wiki")
    .option("update", "-u 更新本地缓存", { authority: 2 })
    .option("delete", "-d 删除本地缓存", { authority: 2 })
    .option("rename", "-r <newName> 重命名本地缓存", { authority: 2 })
    .action(async ({ session, options }, itemName = "电解器") => {
      let filePath =
        config.imgPath +
        itemName.replace(/\//g, "-").replace(/:/g, "-").replace(/'/g, "-") +
        ".jpeg";
      if (options.update) {
        let url =
          "https://oxygennotincluded.fandom.com/zh/wiki/" + encodeURI(itemName);
        await lib.screenShot(url, ctx, itemName, config);
        return `已尝试为您更新${itemName}的缓存...}`;
      }
      if (options.delete) {
        let filePath = config.imgPath + itemName + ".jpeg";
        if (lib.checkFileExists(filePath)) {
          fs.unlinkSync(filePath);
          return `已尝试删除${itemName}的缓存...`;
        } else {
          return `文件不存在...`;
        }
      }
      if (options.rename) {
        if (lib.checkFileExists(filePath)) {
          fs.renameSync(filePath, config.imgPath + options.rename + ".jpeg");
          return `已尝试重命名文件...`;
        } else {
          return `文件不存在...`;
        }
      }
      // 主流程
      session.send("正在查询中，请稍后...");
      await lib.delay(1000);
      // 判断文件是否在本地

      if (lib.checkFileExists(filePath)) {
        return `文件缓存已命中，缓存时间为：${lib.getFileModifyTime(
          filePath
        )} 请前往以下网址查看: \n ${
          config.publicUrl +
          encodeURI(
            itemName.replace(/\//g, "-").replace(/:/g, "-").replace(/'/g, "-")
          )
        }.jpeg`;
      } else {
        // 没有缓存
        let res: string[] = await lib.getFromFandom(config.api, ctx, itemName);
        if (res.length === 0) {
          // session.send()
          return `在Wiki里没找到或API查询超时或....`;
        } else {
          const title = [...res[0]];
          let res_url: string[] = [...res[1]];
          logger.info(`API返回的数据为: ${title}`);
          if (title[0] === itemName) {
            return lib.screenShot(res_url[0], ctx, itemName, config);
          } else {
            let [
              one = "曼德拉草汤",
              two = "火龙果派",
              three = "大肉汤",
              four = "饺子",
              five = "萌新骨头汤",
            ] = title;
            // 发送md消息
            let md_str_list: string[] = [
              "text1",
              "oh no,出现了亿点点问题!!!",
              "text2",
              "在wiki里没有找到你所输入的关键字,下面是自主搜索的结果,你看看有没有需要的:",
              "text3",
              `占位`,
              "text4",
              `1.${one}\r2.${two}\r3.${three}\r4.${four}\r5.${five}`,
              "text5",
              "有的话,请点击按钮选择,没有,请等待30秒自动结束本轮查询以减少服务器压力",
            ];
            let btn_list = [["①", "1", "②", "2", "③", "④", "4", "⑤", "5"]];
            await session.bot.internal.sendMessage(session.guildId, {
              content: "111",
              msg_type: 2,
              markdown: {
                custom_template_id: config.mdId,
                params: lib.createMd(md_str_list),
              },
              keyboard: {
                content: {
                  rows: lib.createBtn(btn_list),
                },
              },
              msg_id: session.messageId,
              timestamp: session.timestamp,
              msg_seq: Math.floor(Math.random() * 500),
            });
            const awlist = [1, 2, 3, 4, 5];
            const awser =
              +(await session.prompt(50 * 1000))
                ?.replace(/\s+/g, "")
                ?.slice(-1) || NaN;
            if (awlist.includes(awser)) {
              return lib.screenShot(res_url[awser - 1], ctx, itemName, config);
            } else if (Number.isNaN(awser)) {
              return `您输入的选项有误，已完结本轮查询。如需，如有需要，请重新发起查询.`;
            }
          }
        }
      }
    });
}
