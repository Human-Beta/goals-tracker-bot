import { InlineKeyboard, type Context } from 'grammy';

import { AuthError, NotFoundError, ValidationError } from '../api/errors';
import type { components } from '../api/generated/schema';
import type { AppConfig } from '../config';
import { createUserScopedGoalsClient, type CreateBotDependencies } from './goals-client-context';
import { buildGoalDetailsCallbackData } from './goal-callback-data';
import { toCommandResponse, type CommandResponse } from './command-response';
import {
  GOAL_CREATE_UPSTREAM_FALLBACK_MESSAGE,
  GOAL_CREATE_VALIDATION_HINT,
  GOAL_DETAILS_AUTH_ERROR_MESSAGE,
  GOAL_DETAILS_NOT_FOUND_MESSAGE,
  GOAL_DETAILS_UPSTREAM_FALLBACK_MESSAGE,
  GOALS_LIST_AUTH_ERROR_MESSAGE,
  GOALS_LIST_EMPTY_MESSAGE,
  GOALS_LIST_NOT_FOUND_MESSAGE,
  GOALS_LIST_UPSTREAM_FALLBACK_MESSAGE,
  START_SUCCESS_MESSAGE,
  START_TIMEZONE_HINT,
  START_UPSTREAM_FALLBACK_MESSAGE,
} from './messages';
import {
  formatGoalCreateSuccessResponse,
  formatGoalDetailsResponse,
  formatGoalsListResponse,
  formatGoalTitleCommandLabel,
} from './response-formatters';

type GoalUnit = components['schemas']['GoalUnit'];
type GoalListItem = components['schemas']['GoalListItem'];
const GOAL_UNITS: ReadonlySet<GoalUnit> = new Set(['pages', 'minutes', 'km']);

function isGoalUnit(value: string): value is GoalUnit {
  return GOAL_UNITS.has(value as GoalUnit);
}

function buildGoalsListKeyboard(items: GoalListItem[]): InlineKeyboard {
  return InlineKeyboard.from(
    items.map(goal => [
      InlineKeyboard.text(formatGoalTitleCommandLabel(goal.title), buildGoalDetailsCallbackData(goal.id)),
    ])
  );
}

export async function handleStartCommand(
  ctx: Context,
  config: AppConfig,
  dependencies: CreateBotDependencies,
  timezone: string | undefined
): Promise<string> {
  if (timezone === undefined) {
    return START_TIMEZONE_HINT;
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

export async function handleGoalCreateCommand(
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

export async function handleGoalsListCommand(
  ctx: Context,
  config: AppConfig,
  dependencies: CreateBotDependencies
): Promise<CommandResponse> {
  const scopedClient = createUserScopedGoalsClient(ctx, config, dependencies);
  if (scopedClient === null) {
    return toCommandResponse(GOALS_LIST_UPSTREAM_FALLBACK_MESSAGE);
  }

  try {
    const response = await scopedClient.client.GET('/goals');
    if (response.items.length === 0) {
      return toCommandResponse(GOALS_LIST_EMPTY_MESSAGE);
    }

    return toCommandResponse(formatGoalsListResponse(response.items), {
      reply_markup: buildGoalsListKeyboard(response.items),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return toCommandResponse(GOALS_LIST_AUTH_ERROR_MESSAGE);
    }

    if (error instanceof NotFoundError) {
      return toCommandResponse(GOALS_LIST_NOT_FOUND_MESSAGE);
    }

    console.warn('[bot] failed to list goals on /goals', error);
    return toCommandResponse(GOALS_LIST_UPSTREAM_FALLBACK_MESSAGE);
  }
}

export async function handleGoalDetailsCommand(
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
