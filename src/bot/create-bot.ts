import { Bot, type Context } from 'grammy';

import type { AppConfig } from '../config';
import { parseCommandText } from './command-parser';
import { resolveCommandResponse } from './command-dispatch';
import type { CreateBotDependencies } from './goals-client-context';

export function createBot(config: AppConfig, dependencies: CreateBotDependencies = {}): Bot<Context> {
  const bot = new Bot<Context>(config.TELEGRAM_BOT_TOKEN);

  bot.on('message:text', async ctx => {
    console.debug('[bot] incoming raw message', ctx.message);
    const parsedCommand = parseCommandText(ctx.message.text);
    const response = await resolveCommandResponse(ctx, config, dependencies, ctx.message.text, parsedCommand);

    console.debug('[bot] outgoing reply payload', response);
    await ctx.reply(response.text, response.replyOptions);
  });

  return bot;
}
