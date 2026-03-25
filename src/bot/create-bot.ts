import { Bot, type Context } from 'grammy';

import { createGoalsApiClient, type GoalsApiClient, type GoalsApiFetch } from '../api/client';
import { AuthError, NotFoundError, ValidationError } from '../api/errors';
import type { components } from '../api/generated/schema';
import type { AppConfig } from '../config';
import { parseCommandText } from './command-parser';
import { formatInvalidCommandMessage, routeTextMessage } from './router';

const START_SUCCESS_MESSAGE = 'You are all set. Timezone saved:';
const START_TIMEZONE_HINT = 'Please provide a valid IANA timezone. Example: /start timezone=Europe/Kyiv';
const START_UPSTREAM_FALLBACK_MESSAGE = 'Temporary issue while saving your profile. Please try again later.';
const GOAL_CREATE_VALIDATION_HINT =
  'Could not create the goal. Please check title, unit, target, and date format (YYYY-MM-DD), then try again.';
const GOAL_CREATE_UPSTREAM_FALLBACK_MESSAGE = 'Temporary issue while creating your goal. Please try again later.';
const GOALS_LIST_EMPTY_MESSAGE = "You don't have any goals yet. Create one with /goal_create.";
const GOALS_LIST_AUTH_ERROR_MESSAGE = 'Temporary technical issue while loading your goals. Please try again later.';
const GOALS_LIST_NOT_FOUND_MESSAGE =
  'Could not find your profile context. Run /start timezone=<IANA> and then try /goals again.';
const GOALS_LIST_UPSTREAM_FALLBACK_MESSAGE = 'Temporary issue while loading your goals. Please try again later.';

type GoalUnit = components['schemas']['GoalUnit'];
type GoalBase = components['schemas']['GoalBase'];
type GoalListItem = components['schemas']['GoalListItem'];
const GOAL_UNITS: ReadonlySet<GoalUnit> = new Set(['pages', 'minutes', 'km']);

export type CreateBotDependencies = {
  goalsApiFetch?: GoalsApiFetch;
};

type UserScopedGoalsClient = {
  telegramUserId: number;
  client: GoalsApiClient;
};

function isGoalUnit(value: string): value is GoalUnit {
  return GOAL_UNITS.has(value as GoalUnit);
}

function getInvalidStartResponse(): string {
  return START_TIMEZONE_HINT;
}

function createUserScopedGoalsClient(
  ctx: Context,
  config: AppConfig,
  dependencies: CreateBotDependencies
): UserScopedGoalsClient | null {
  if (ctx.from === undefined) {
    return null;
  }

  const telegramUserId = ctx.from.id;
  return {
    telegramUserId,
    client: createGoalsApiClient({
      baseUrl: config.GOALS_API_BASE_URL,
      serviceToken: config.GOALS_API_SERVICE_TOKEN,
      telegramUserId,
      fetch: dependencies.goalsApiFetch,
      timeoutMs: config.HTTP_TIMEOUT_MS,
    }),
  };
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

  const scopedClient = createUserScopedGoalsClient(ctx, config, dependencies);
  if (scopedClient === null) {
    return START_UPSTREAM_FALLBACK_MESSAGE;
  }

  try {
    await scopedClient.client.POST('/bot/users/upsert', {
      body: {
        telegram_user_id: scopedClient.telegramUserId,
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

function formatGoalCreateSuccessResponse(goal: GoalBase): string {
  return [
    'Goal created successfully:',
    `id: ${goal.id}`,
    `title: ${goal.title}`,
    `target: ${goal.target_value}`,
    `end_date: ${goal.end_date}`,
  ].join('\n');
}

function formatGoalsListResponse(items: GoalListItem[]): string {
  const formattedItems = items.map(goal =>
    [
      `id: ${goal.id}`,
      `title: ${goal.title}`,
      `percent_complete: ${goal.percent_complete}`,
      `days_left: ${goal.days_left}`,
      `pace_current_7d: ${goal.pace_current_7d}`,
    ].join('\n')
  );

  return formattedItems.join('\n\n');
}

async function handleGoalCreateCommand(
  ctx: Context,
  config: AppConfig,
  dependencies: CreateBotDependencies,
  args: Readonly<Record<string, string>>
): Promise<string> {
  const scopedClient = createUserScopedGoalsClient(ctx, config, dependencies);
  if (scopedClient === null) {
    return GOAL_CREATE_UPSTREAM_FALLBACK_MESSAGE;
  }

  const title = args.title;
  const unit = args.unit;
  const target = args.target;
  const end = args.end;
  const start = args.start;

  if (title === undefined || unit === undefined || target === undefined || end === undefined) {
    return GOAL_CREATE_VALIDATION_HINT;
  }

  if (!isGoalUnit(unit)) {
    return GOAL_CREATE_VALIDATION_HINT;
  }

  const targetValue = Number(target);
  if (!Number.isFinite(targetValue)) {
    return GOAL_CREATE_VALIDATION_HINT;
  }

  try {
    const createdGoal = await scopedClient.client.POST('/goals', {
      body: {
        title,
        unit,
        target_value: targetValue,
        end_date: end,
        ...(start === undefined ? {} : { start_date: start }),
      },
    });

    return formatGoalCreateSuccessResponse(createdGoal);
  } catch (error) {
    if (error instanceof ValidationError) {
      return GOAL_CREATE_VALIDATION_HINT;
    }

    console.warn('[bot] failed to create goal on /goal_create', error);
    return GOAL_CREATE_UPSTREAM_FALLBACK_MESSAGE;
  }
}

async function handleGoalsListCommand(
  ctx: Context,
  config: AppConfig,
  dependencies: CreateBotDependencies
): Promise<string> {
  const scopedClient = createUserScopedGoalsClient(ctx, config, dependencies);
  if (scopedClient === null) {
    return GOALS_LIST_UPSTREAM_FALLBACK_MESSAGE;
  }

  try {
    const response = await scopedClient.client.GET('/goals');
    if (response.items.length === 0) {
      return GOALS_LIST_EMPTY_MESSAGE;
    }

    return formatGoalsListResponse(response.items);
  } catch (error) {
    if (error instanceof AuthError) {
      return GOALS_LIST_AUTH_ERROR_MESSAGE;
    }

    if (error instanceof NotFoundError) {
      return GOALS_LIST_NOT_FOUND_MESSAGE;
    }

    console.warn('[bot] failed to list goals on /goals', error);
    return GOALS_LIST_UPSTREAM_FALLBACK_MESSAGE;
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
    } else if (parsedCommand.kind === 'invalid_command' && parsedCommand.commandName === 'goal_create') {
      responseText = formatInvalidCommandMessage(parsedCommand.reason, parsedCommand.usage);
    } else if (parsedCommand.kind === 'known_command' && parsedCommand.command.name === 'start') {
      responseText = await handleStartCommand(ctx, config, dependencies, parsedCommand.command.args.timezone);
    } else if (parsedCommand.kind === 'known_command' && parsedCommand.command.name === 'goal_create') {
      responseText = await handleGoalCreateCommand(ctx, config, dependencies, parsedCommand.command.args);
    } else if (parsedCommand.kind === 'known_command' && parsedCommand.command.name === 'goals') {
      responseText = await handleGoalsListCommand(ctx, config, dependencies);
    } else {
      responseText = routeTextMessage(ctx.message.text);
    }

    console.debug('[bot] outgoing reply payload', { text: responseText });
    await ctx.reply(responseText);
  });

  return bot;
}
