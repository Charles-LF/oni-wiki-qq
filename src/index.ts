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

import { Context, Schema } from "koishi";
import fs from "fs";
import os from "os";
import puppeteer from "koishi-plugin-puppeteer";
import * as lib from "./lib";

export const name = "oni-wiki-qq";
export const inject = ["puppeteer"];
export const usage = `
  - 0.0.3 将链接改为md发送以绕过沟腾讯的链接拦截
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
  mdId: Schema.string().description("模板ID").default("102019091_1708758661"),
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
        await session.bot.internal.sendMessage(session.guildId, {
          content: "111",
          msg_type: 2,
          markdown: {
            custom_template_id: config.mdId,
            params: [
              {
                key: "text1",
                values: [
                  `文件缓存已命中，缓存时间为：${lib.getFileModifyTime(
                    filePath
                  )} 请前往以下网址查看:[🔗${itemName}`,
                ],
              },
              {
                key: "text2",
                values: [
                  `](${
                    config.publicUrl +
                    itemName
                      .replace(/\//g, "-")
                      .replace(/:/g, "-")
                      .replace(/'/g, "-")
                  }.jpeg)`,
                ],
              },
            ],
          },
          keyboard: {
            content: {
              rows: [
                {
                  buttons: [
                    {
                      id: "1",
                      render_data: {
                        label: "我也要查wiki",
                        visited_label: "我也要查wiki",
                      },
                      action: {
                        type: 2,
                        permission: {
                          type: 2,
                        },
                        unsupport_tips: "兼容文本",
                        data: "/查wiki ",
                        enter: false,
                      },
                    },
                  ],
                },
              ],
            },
          },
          msg_id: session.messageId,
          timestamp: session.timestamp,
          msg_seq: Math.floor(Math.random() * 500),
        });
        return;
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
            let res = await lib.screenShot(res_url[0], ctx, itemName, config);
            if (res) {
              await session.bot.internal.sendMessage(session.guildId, {
                content: "111",
                msg_type: 2,
                markdown: {
                  custom_template_id: config.mdId,
                  params: [
                    {
                      key: "text1",
                      values: [
                        `文件缓存已命中，缓存时间为：${lib.getFileModifyTime(
                          filePath
                        )} 请前往以下网址查看:[🔗${itemName}`,
                      ],
                    },
                    {
                      key: "text2",
                      values: [
                        `](${
                          config.publicUrl +
                          itemName
                            .replace(/\//g, "-")
                            .replace(/:/g, "-")
                            .replace(/'/g, "-")
                        }.jpeg)`,
                      ],
                    },
                  ],
                },
                keyboard: {
                  content: {
                    rows: [
                      {
                        buttons: [
                          {
                            id: "1",
                            render_data: {
                              label: "我也要查wiki",
                              visited_label: "我也要查wiki",
                            },
                            action: {
                              type: 2,
                              permission: {
                                type: 2,
                              },
                              unsupport_tips: "兼容文本",
                              data: "/查wiki ",
                              enter: false,
                            },
                          },
                        ],
                      },
                    ],
                  },
                },
                msg_id: session.messageId,
                timestamp: session.timestamp,
                msg_seq: Math.floor(Math.random() * 500),
              });
            }
          } else {
            let [
              one = "曼德拉草汤",
              two = "火龙果派",
              three = "大肉汤",
              four = "饺子",
              five = "萌新骨头汤",
            ] = title;
            // 发送md消息

            let btn_list = [["①", "1", "②", "2", "③", "④", "4", "⑤", "5"]];
            await session.bot.internal.sendMessage(session.guildId, {
              content: "111",
              msg_type: 2,
              markdown: {
                custom_template_id: config.mdId,
                params: [
                  {
                    key: "text1",
                    values: ["Oh,No,出现了一丢丢问题"],
                  },
                  {
                    key: "text2",
                    values: [
                      "没有找到您查询的关键字,以下是自主搜索的结果,你康康有没有需要的,点击按钮选择,没有的话,请等待超时结束本轮查询以减轻服务器压力",
                    ],
                  },
                  {
                    key: "text3",
                    values: [`占位`],
                  },
                  {
                    key: "text4",
                    values: [`1- ${one}`],
                  },
                  {
                    key: "text5",
                    values: [`2- ${two}`],
                  },
                  {
                    key: "text6",
                    values: [`3- ${three}`],
                  },
                  {
                    key: "text7",
                    values: [`4- ${four}`],
                  },
                  {
                    key: "text8",
                    values: [`5- ${five}`],
                  },
                ],
              },
              keyboard: {
                content: {
                  rows: [
                    {
                      buttons: [
                        {
                          id: "1",
                          render_data: {
                            label: `①`,
                            visited_label: `①`,
                          },
                          action: {
                            type: 2,
                            permission: {
                              type: 2,
                            },
                            unsupport_tips: "兼容文本",
                            data: "1",
                            enter: true,
                          },
                        },
                        {
                          id: "2",
                          render_data: {
                            label: `②`,
                            visited_label: `②`,
                          },
                          action: {
                            type: 2,
                            permission: {
                              type: 2,
                            },
                            unsupport_tips: "兼容文本",
                            data: "2",
                            enter: true,
                          },
                        },
                        {
                          id: "3",
                          render_data: {
                            label: `③`,
                            visited_label: `③`,
                          },
                          action: {
                            type: 2,
                            permission: {
                              type: 2,
                            },
                            unsupport_tips: "兼容文本",
                            data: "3",
                            enter: true,
                          },
                        },
                        {
                          id: "4",
                          render_data: {
                            label: `④`,
                            visited_label: `④`,
                          },
                          action: {
                            type: 2,
                            permission: {
                              type: 2,
                            },
                            unsupport_tips: "兼容文本",
                            data: "4",
                            enter: true,
                          },
                        },
                        {
                          id: "5",
                          render_data: {
                            label: `⑤`,
                            visited_label: `⑤`,
                          },
                          action: {
                            type: 2,
                            permission: {
                              type: 2,
                            },
                            unsupport_tips: "兼容文本",
                            data: "5",
                            enter: true,
                          },
                        },
                      ],
                    },
                    {
                      buttons: [
                        {
                          id: "1",
                          render_data: {
                            label: "我也要查wiki",
                            visited_label: "我也要查wiki",
                          },
                          action: {
                            type: 2,
                            permission: {
                              type: 2,
                            },
                            unsupport_tips: "兼容文本",
                            data: "/查wiki ",
                            enter: false,
                          },
                        },
                      ],
                    },
                  ],
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
              let res = await lib.screenShot(
                res_url[awser - 1],
                ctx,
                itemName,
                config
              );
              if (res) {
                await session.bot.internal.sendMessage(session.guildId, {
                  content: "111",
                  msg_type: 2,
                  markdown: {
                    custom_template_id: config.mdId,
                    params: [
                      {
                        key: "text1",
                        values: [
                          `文件缓存已命中，缓存时间为：${lib.getFileModifyTime(
                            filePath
                          )} 请前往以下网址查看:[🔗${itemName}`,
                        ],
                      },
                      {
                        key: "text2",
                        values: [
                          `](${
                            config.publicUrl +
                            itemName
                              .replace(/\//g, "-")
                              .replace(/:/g, "-")
                              .replace(/'/g, "-")
                          }.jpeg)`,
                        ],
                      },
                    ],
                  },
                  keyboard: {
                    content: {
                      rows: [
                        {
                          buttons: [
                            {
                              id: "1",
                              render_data: {
                                label: "我也要查wiki",
                                visited_label: "我也要查wiki",
                              },
                              action: {
                                type: 2,
                                permission: {
                                  type: 2,
                                },
                                unsupport_tips: "兼容文本",
                                data: "/查wiki ",
                                enter: false,
                              },
                            },
                          ],
                        },
                      ],
                    },
                  },
                  msg_id: session.messageId,
                  timestamp: session.timestamp,
                  msg_seq: Math.floor(Math.random() * 500),
                });
              }
            } else if (Number.isNaN(awser)) {
              return `您输入的选项有误，已完结本轮查询。如需，如有需要，请重新发起查询.`;
            }
          }
        }
      }
    });
}
