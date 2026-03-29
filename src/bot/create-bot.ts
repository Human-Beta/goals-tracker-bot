import { Bot, type Context } from 'grammy';

import { createGoalsApiClient, type GoalsApiClient, type GoalsApiFetch } from '../api/client';
import { AuthError, NotFoundError, ValidationError } from '../api/errors';
import type { components } from '../api/generated/schema';
import type { AppConfig } from '../config';
import { CommandParseResult, parseCommandText } from './command-parser';
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
const GOAL_DETAILS_AUTH_ERROR_MESSAGE =
  'Temporary technical issue while loading your goal details. Please try again later.';
const GOAL_DETAILS_NOT_FOUND_MESSAGE = 'Goal not found. Run /goals to check available goal IDs and try again.';
const GOAL_DETAILS_UPSTREAM_FALLBACK_MESSAGE =
  'Temporary issue while loading your goal details. Please try again later.';
const GOAL_DETAILS_ETA_NULL_EXPLANATION = 'ETA cannot be estimated at the current pace.';

type GoalUnit = components['schemas']['GoalUnit'];
type GoalBase = components['schemas']['GoalBase'];
type GoalListItem = components['schemas']['GoalListItem'];
type GoalDetail = components['schemas']['GoalDetail'];
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

function formatLabelValueLines(lines: ReadonlyArray<readonly [label: string, value: string | number]>): string {
  return lines.map(([label, value]) => `${label}: ${value}`).join('\n');
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
    formatLabelValueLines([
      ['id', goal.id],
      ['title', goal.title],
      ['target', goal.target_value],
      ['end_date', goal.end_date],
    ]),
  ].join('\n');
}

function formatGoalsListResponse(items: GoalListItem[]): string {
  const formattedItems = items.map(goal =>
    formatLabelValueLines([
      ['id', goal.id],
      ['title', goal.title],
      ['percent_complete', goal.percent_complete],
      ['days_left', goal.days_left],
      ['pace_current_7d', goal.pace_current_7d],
    ])
  );

  return formattedItems.join('\n\n');
}

function formatGoalDetailsMetricValue(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return (Math.round(value * 10) / 10).toFixed(1);
}

function formatGoalDetailsResponse(goal: GoalDetail): string {
  const etaLines =
    goal.eta_date === null
      ? ([
          ['eta_date', 'null'],
          ['eta_note', GOAL_DETAILS_ETA_NULL_EXPLANATION],
        ] as const)
      : ([['eta_date', goal.eta_date]] as const);

  return formatLabelValueLines([
    ['id', goal.id],
    ['title', goal.title],
    ['percent_complete', formatGoalDetailsMetricValue(goal.percent_complete)],
    ['current_value', formatGoalDetailsMetricValue(goal.current_value)],
    ['remaining_value', formatGoalDetailsMetricValue(goal.remaining_value)],
    ['days_left', formatGoalDetailsMetricValue(goal.days_left)],
    ['pace_current_7d', formatGoalDetailsMetricValue(goal.pace_current_7d)],
    ['pace_required_per_day', formatGoalDetailsMetricValue(goal.pace_required_per_day)],
    ...etaLines,
    ['behind_value', formatGoalDetailsMetricValue(goal.behind_value)],
  ]);
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

async function handleGoalDetailsCommand(
  ctx: Context,
  config: AppConfig,
  dependencies: CreateBotDependencies,
  args: Readonly<Record<string, string>>
): Promise<string> {
  const scopedClient = createUserScopedGoalsClient(ctx, config, dependencies);
  if (scopedClient === null) {
    return GOAL_DETAILS_UPSTREAM_FALLBACK_MESSAGE;
  }

  const goalId = args.id;
  if (goalId === undefined) {
    return GOAL_DETAILS_UPSTREAM_FALLBACK_MESSAGE;
  }

  try {
    const response = await scopedClient.client.GET('/goals/{goalId}', {
      params: {
        path: {
          goalId,
        },
      },
    });

    return formatGoalDetailsResponse(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return GOAL_DETAILS_AUTH_ERROR_MESSAGE;
    }

    if (error instanceof NotFoundError) {
      return GOAL_DETAILS_NOT_FOUND_MESSAGE;
    }

    console.warn('[bot] failed to get goal details on /goal', error);
    return GOAL_DETAILS_UPSTREAM_FALLBACK_MESSAGE;
  }
}

async function resolveCommandResponse(
  ctx: Context,
  config: AppConfig,
  dependencies: CreateBotDependencies,
  rawText: string,
  parsedCommand: CommandParseResult
): Promise<string> {
  let responseText = routeTextMessage(rawText);

  switch (parsedCommand.kind) {
    case 'invalid_command':
      switch (parsedCommand.commandName) {
        case 'start':
          responseText = getInvalidStartResponse();
          break;
        case 'goal_create':
        case 'goal':
          responseText = formatInvalidCommandMessage(parsedCommand.reason, parsedCommand.usage);
          break;
        default:
          break;
      }
      break;
    case 'known_command':
      switch (parsedCommand.command.name) {
        case 'start':
          responseText = await handleStartCommand(ctx, config, dependencies, parsedCommand.command.args.timezone);
          break;
        case 'goal_create':
          responseText = await handleGoalCreateCommand(ctx, config, dependencies, parsedCommand.command.args);
          break;
        case 'goals':
          responseText = await handleGoalsListCommand(ctx, config, dependencies);
          break;
        case 'goal':
          responseText = await handleGoalDetailsCommand(ctx, config, dependencies, parsedCommand.command.args);
          break;
        default:
          break;
      }
      break;
    case 'not_command':
    case 'unknown_command':
      break;
  }

  return responseText;
}

export function createBot(config: AppConfig, dependencies: CreateBotDependencies = {}): Bot<Context> {
  const bot = new Bot<Context>(config.TELEGRAM_BOT_TOKEN);

  bot.on('message:text', async ctx => {
    console.debug('[bot] incoming raw message', ctx.message);
    const parsedCommand = parseCommandText(ctx.message.text);
    const responseText = await resolveCommandResponse(ctx, config, dependencies, ctx.message.text, parsedCommand);

    console.debug('[bot] outgoing reply payload', { text: responseText });
    await ctx.reply(responseText);
  });

  return bot;
}
