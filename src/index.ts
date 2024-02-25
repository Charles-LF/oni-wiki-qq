import { Context, Schema } from "koishi";
import puppeteer from "koishi-plugin-puppeteer";

export const name = "oni-wiki-qq";
export const inject = ["puppeteer"];
export const usage = `
  - 0.0.1 初始化，明天再慢慢写了（
`;

export interface Config {}

export const Config: Schema<Config> = Schema.object({});

export function apply(ctx: Context) {}
