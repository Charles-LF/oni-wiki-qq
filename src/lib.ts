import fs from "fs";
import { Mwn } from "mwn";
import { Config } from ".";

export function checkFileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
}

export async function getWiki(
  itemName: string,
  config: Config
): Promise<string> {
  const { api, userName, password } = config;
  const bot: Mwn = await Mwn.init({
    apiUrl: api,
    username: userName,
    password: password,
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
      // 如果标题一样就直接返回网址，不一样就直接返回false
      if (res[1][0] == itemName) {
        return res[3][0];
      } else {
        return "";
      }
    })
    .catch(async (err) => console.log(err));
}
