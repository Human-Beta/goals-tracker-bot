import { Bot, type Context } from 'grammy';

import { createGoalsApiClient, type GoalsApiFetch } from '../api/client';
import { ValidationError } from '../api/errors';
import type { AppConfig } from '../config';
import { parseCommandText } from './command-parser';
import { routeTextMessage } from './router';

const START_SUCCESS_MESSAGE = 'You are all set. Timezone saved:';
const START_TIMEZONE_HINT = 'Please provide a valid IANA timezone. Example: /start timezone=Europe/Kyiv';
const START_UPSTREAM_FALLBACK_MESSAGE = 'Temporary issue while saving your profile. Please try again later.';

export type CreateBotDependencies = {
  goalsApiFetch?: GoalsApiFetch;
};

function getInvalidStartResponse(): string {
  return START_TIMEZONE_HINT;
}

async function handleStartCommand(
  ctx: Context,
  config: AppConfig,
  dependencies: CreateBotDependencies,
  timezone: string | undefined
): Promise<string> {
  if (timezone === undefined) {
    return getInvalidStartResponse();
  }

  if (ctx.from === undefined) {
    return START_UPSTREAM_FALLBACK_MESSAGE;
  }

  const client = createGoalsApiClient({
    baseUrl: config.GOALS_API_BASE_URL,
    serviceToken: config.GOALS_API_SERVICE_TOKEN,
    telegramUserId: ctx.from.id,
    fetch: dependencies.goalsApiFetch,
    timeoutMs: config.HTTP_TIMEOUT_MS,
  });

  try {
    await client.POST('/bot/users/upsert', {
      body: {
        telegram_user_id: ctx.from.id,
        timezone,
      },
    });

    return `${START_SUCCESS_MESSAGE} ${timezone}.`;
  } catch (error) {
    if (error instanceof ValidationError) {
      return START_TIMEZONE_HINT;
    }

    console.warn('[bot] failed to upsert user on /start', error);
    return START_UPSTREAM_FALLBACK_MESSAGE;
  }
}

export function createBot(config: AppConfig, dependencies: CreateBotDependencies = {}): Bot<Context> {
  const bot = new Bot<Context>(config.TELEGRAM_BOT_TOKEN);

  bot.on('message:text', async ctx => {
    console.debug('[bot] incoming raw message', ctx.message);
    const parsedCommand = parseCommandText(ctx.message.text);
    let responseText: string;

    if (parsedCommand.kind === 'invalid_command' && parsedCommand.commandName === 'start') {
      responseText = getInvalidStartResponse();
    } else if (parsedCommand.kind === 'known_command' && parsedCommand.command.name === 'start') {
      responseText = await handleStartCommand(ctx, config, dependencies, parsedCommand.command.args.timezone);
    } else {
      responseText = routeTextMessage(ctx.message.text);
    }

    console.debug('[bot] outgoing reply payload', { text: responseText });
    await ctx.reply(responseText);
  });

  return bot;
}
