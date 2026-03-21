import { Bot, type Context } from 'grammy';

import type { AppConfig } from '../config';
import { routeTextMessage } from './router';

export function createBot(config: AppConfig): Bot<Context> {
  const bot = new Bot<Context>(config.TELEGRAM_BOT_TOKEN);

  bot.on('message:text', async ctx => {
    const responseText = routeTextMessage(ctx.message.text);
    await ctx.reply(responseText);
  });

  return bot;
}
