import { InlineKeyboard, type Context } from 'grammy';

import { AuthError, ConflictError, NotFoundError, ValidationError } from '../api/errors';
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
  GOAL_EDIT_AUTH_ERROR_MESSAGE,
  GOAL_EDIT_CONFLICT_MESSAGE,
  GOAL_EDIT_IMMUTABLE_UNIT_MESSAGE,
  GOAL_EDIT_NOT_FOUND_MESSAGE,
  GOAL_EDIT_NOTHING_TO_UPDATE_MESSAGE,
  GOAL_EDIT_UPSTREAM_FALLBACK_MESSAGE,
  GOAL_EDIT_VALIDATION_HINT,
  GOALS_LIST_AUTH_ERROR_MESSAGE,
  GOALS_LIST_EMPTY_MESSAGE,
  GOALS_LIST_NOT_FOUND_MESSAGE,
  GOALS_LIST_UPSTREAM_FALLBACK_MESSAGE,
  PROGRESS_ADD_AUTH_ERROR_MESSAGE,
  PROGRESS_ADD_NOT_FOUND_MESSAGE,
  PROGRESS_ADD_UPSTREAM_FALLBACK_MESSAGE,
  PROGRESS_ADD_VALIDATION_HINT,
  PROGRESS_DELETE_AUTH_ERROR_MESSAGE,
  PROGRESS_DELETE_NOT_FOUND_MESSAGE,
  PROGRESS_DELETE_SUCCESS_MESSAGE,
  PROGRESS_DELETE_UPSTREAM_FALLBACK_MESSAGE,
  PROGRESS_EDIT_AUTH_ERROR_MESSAGE,
  PROGRESS_EDIT_CONFLICT_MESSAGE,
  PROGRESS_EDIT_NOT_FOUND_MESSAGE,
  PROGRESS_EDIT_NOTHING_TO_UPDATE_MESSAGE,
  PROGRESS_EDIT_UPSTREAM_FALLBACK_MESSAGE,
  PROGRESS_EDIT_VALIDATION_HINT,
  PROGRESS_LIST_AUTH_ERROR_MESSAGE,
  PROGRESS_LIST_EMPTY_MESSAGE,
  PROGRESS_LIST_NOT_FOUND_MESSAGE,
  PROGRESS_LIST_UPSTREAM_FALLBACK_MESSAGE,
  PROGRESS_LIST_VALIDATION_HINT,
  START_SUCCESS_MESSAGE,
  START_TIMEZONE_HINT,
  START_UPSTREAM_FALLBACK_MESSAGE,
} from './messages';
import {
  formatGoalCreateSuccessResponse,
  formatGoalDetailsResponse,
  formatGoalEditSuccessResponse,
  formatGoalsListResponse,
  formatGoalTitleCommandLabel,
  formatProgressAddSuccessResponse,
  formatProgressEditSuccessResponse,
  formatProgressListResponse,
} from './response-formatters';

type GoalUnit = components['schemas']['GoalUnit'];
type GoalListItem = components['schemas']['GoalListItem'];
type SortDirection = 'asc' | 'desc';
const GOAL_UNITS: ReadonlySet<GoalUnit> = new Set(['pages', 'minutes', 'km']);
const SORT_DIRECTIONS: ReadonlySet<SortDirection> = new Set(['asc', 'desc']);

function isGoalUnit(value: string): value is GoalUnit {
  return GOAL_UNITS.has(value as GoalUnit);
}

function isSortDirection(value: string): value is SortDirection {
  return SORT_DIRECTIONS.has(value as SortDirection);
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
  { title, unit, target, end, start }: Readonly<Record<string, string>>
): Promise<string> {
  const scopedClient = createUserScopedGoalsClient(ctx, config, dependencies);
  if (scopedClient === null) {
    return GOAL_CREATE_UPSTREAM_FALLBACK_MESSAGE;
  }

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

export async function handleGoalEditCommand(
  ctx: Context,
  config: AppConfig,
  dependencies: CreateBotDependencies,
  { id: goalId, title, target, start, end, unit }: Readonly<Record<string, string>>
): Promise<string> {
  const scopedClient = createUserScopedGoalsClient(ctx, config, dependencies);
  if (scopedClient === null) {
    return GOAL_EDIT_UPSTREAM_FALLBACK_MESSAGE;
  }

  if (goalId === undefined) {
    return GOAL_EDIT_VALIDATION_HINT;
  }

  if (unit !== undefined) {
    return GOAL_EDIT_IMMUTABLE_UNIT_MESSAGE;
  }

  if (title === undefined && target === undefined && start === undefined && end === undefined) {
    return GOAL_EDIT_NOTHING_TO_UPDATE_MESSAGE;
  }

  let targetValue: number | undefined;
  if (target !== undefined) {
    const parsedTarget = Number(target);
    if (!Number.isFinite(parsedTarget)) {
      return GOAL_EDIT_VALIDATION_HINT;
    }
    targetValue = parsedTarget;
  }

  try {
    const updatedGoal = await scopedClient.client.PATCH('/goals/{goalId}', {
      params: {
        path: {
          goalId,
        },
      },
      body: {
        ...(title === undefined ? {} : { title }),
        ...(targetValue === undefined ? {} : { target_value: targetValue }),
        ...(start === undefined ? {} : { start_date: start }),
        ...(end === undefined ? {} : { end_date: end }),
      },
    });

    return formatGoalEditSuccessResponse(updatedGoal);
  } catch (error) {
    if (error instanceof ValidationError) {
      return GOAL_EDIT_VALIDATION_HINT;
    }

    if (error instanceof ConflictError) {
      return GOAL_EDIT_CONFLICT_MESSAGE;
    }

    if (error instanceof NotFoundError) {
      return GOAL_EDIT_NOT_FOUND_MESSAGE;
    }

    if (error instanceof AuthError) {
      return GOAL_EDIT_AUTH_ERROR_MESSAGE;
    }

    console.warn('[bot] failed to edit goal on /goal_edit', error);
    return GOAL_EDIT_UPSTREAM_FALLBACK_MESSAGE;
  }
}

export async function handleProgressAddCommand(
  ctx: Context,
  config: AppConfig,
  dependencies: CreateBotDependencies,
  { goal: goalId, delta, date, note }: Readonly<Record<string, string>>
): Promise<string> {
  const scopedClient = createUserScopedGoalsClient(ctx, config, dependencies);
  if (scopedClient === null) {
    return PROGRESS_ADD_UPSTREAM_FALLBACK_MESSAGE;
  }

  if (goalId === undefined || delta === undefined) {
    return PROGRESS_ADD_VALIDATION_HINT;
  }

  try {
    const event = await scopedClient.client.POST('/goals/{goalId}/progress', {
      params: {
        path: {
          goalId,
        },
      },
      body: {
        delta_value: Number(delta),
        ...(date === undefined ? {} : { date }),
        ...(note === undefined ? {} : { note }),
      },
    });

    return formatProgressAddSuccessResponse(event);
  } catch (error) {
    if (error instanceof ValidationError) {
      return PROGRESS_ADD_VALIDATION_HINT;
    }

    if (error instanceof NotFoundError) {
      return PROGRESS_ADD_NOT_FOUND_MESSAGE;
    }

    if (error instanceof AuthError) {
      return PROGRESS_ADD_AUTH_ERROR_MESSAGE;
    }

    console.warn('[bot] failed to record progress on /progress_add', error);
    return PROGRESS_ADD_UPSTREAM_FALLBACK_MESSAGE;
  }
}

export async function handleProgressListCommand(
  ctx: Context,
  config: AppConfig,
  dependencies: CreateBotDependencies,
  { goal: goalId, from, to, sort }: Readonly<Record<string, string>>
): Promise<string> {
  const scopedClient = createUserScopedGoalsClient(ctx, config, dependencies);
  if (scopedClient === null) {
    return PROGRESS_LIST_UPSTREAM_FALLBACK_MESSAGE;
  }

  if (goalId === undefined) {
    return PROGRESS_LIST_VALIDATION_HINT;
  }

  if (sort !== undefined && !isSortDirection(sort)) {
    return PROGRESS_LIST_VALIDATION_HINT;
  }

  try {
    const result = await scopedClient.client.GET('/goals/{goalId}/progress', {
      params: {
        path: {
          goalId,
        },
        query: {
          ...(from === undefined ? {} : { from }),
          ...(to === undefined ? {} : { to }),
          ...(sort === undefined ? {} : { sort }),
        },
      },
    });

    if (result.items.length === 0) {
      return PROGRESS_LIST_EMPTY_MESSAGE;
    }

    return formatProgressListResponse(result.items);
  } catch (error) {
    if (error instanceof ValidationError) {
      return PROGRESS_LIST_VALIDATION_HINT;
    }

    if (error instanceof NotFoundError) {
      return PROGRESS_LIST_NOT_FOUND_MESSAGE;
    }

    if (error instanceof AuthError) {
      return PROGRESS_LIST_AUTH_ERROR_MESSAGE;
    }

    console.warn('[bot] failed to list progress on /progress_list', error);
    return PROGRESS_LIST_UPSTREAM_FALLBACK_MESSAGE;
  }
}

export async function handleProgressEditCommand(
  ctx: Context,
  config: AppConfig,
  dependencies: CreateBotDependencies,
  { goal: goalId, event: eventId, delta, date, note }: Readonly<Record<string, string>>
): Promise<string> {
  const scopedClient = createUserScopedGoalsClient(ctx, config, dependencies);
  if (scopedClient === null) {
    return PROGRESS_EDIT_UPSTREAM_FALLBACK_MESSAGE;
  }

  if (goalId === undefined || eventId === undefined) {
    return PROGRESS_EDIT_VALIDATION_HINT;
  }

  if (delta === undefined && date === undefined && note === undefined) {
    return PROGRESS_EDIT_NOTHING_TO_UPDATE_MESSAGE;
  }

  let deltaValue: number | undefined;
  if (delta !== undefined) {
    const parsedDelta = Number(delta);
    if (!Number.isFinite(parsedDelta)) {
      return PROGRESS_EDIT_VALIDATION_HINT;
    }
    deltaValue = parsedDelta;
  }

  try {
    const updatedEvent = await scopedClient.client.PATCH('/goals/{goalId}/progress/{eventId}', {
      params: {
        path: {
          goalId,
          eventId,
        },
      },
      body: {
        ...(deltaValue === undefined ? {} : { delta_value: deltaValue }),
        ...(date === undefined ? {} : { date }),
        ...(note === undefined ? {} : { note }),
      },
    });

    return formatProgressEditSuccessResponse(updatedEvent);
  } catch (error) {
    if (error instanceof ValidationError) {
      return PROGRESS_EDIT_VALIDATION_HINT;
    }

    if (error instanceof ConflictError) {
      return PROGRESS_EDIT_CONFLICT_MESSAGE;
    }

    if (error instanceof NotFoundError) {
      return PROGRESS_EDIT_NOT_FOUND_MESSAGE;
    }

    if (error instanceof AuthError) {
      return PROGRESS_EDIT_AUTH_ERROR_MESSAGE;
    }

    console.warn('[bot] failed to edit progress on /progress_edit', error);
    return PROGRESS_EDIT_UPSTREAM_FALLBACK_MESSAGE;
  }
}

export async function handleProgressDeleteCommand(
  ctx: Context,
  config: AppConfig,
  dependencies: CreateBotDependencies,
  { goal: goalId, event: eventId, confirm }: Readonly<Record<string, string>>
): Promise<string> {
  const scopedClient = createUserScopedGoalsClient(ctx, config, dependencies);
  if (scopedClient === null) {
    return PROGRESS_DELETE_UPSTREAM_FALLBACK_MESSAGE;
  }

  if (goalId === undefined || eventId === undefined || confirm !== 'yes') {
    return PROGRESS_DELETE_UPSTREAM_FALLBACK_MESSAGE;
  }

  try {
    await scopedClient.client.DELETE('/goals/{goalId}/progress/{eventId}', {
      params: {
        path: {
          goalId,
          eventId,
        },
      },
    });

    return PROGRESS_DELETE_SUCCESS_MESSAGE;
  } catch (error) {
    if (error instanceof NotFoundError) {
      return PROGRESS_DELETE_NOT_FOUND_MESSAGE;
    }

    if (error instanceof AuthError) {
      return PROGRESS_DELETE_AUTH_ERROR_MESSAGE;
    }

    console.warn('[bot] failed to delete progress on /progress_delete', error);
    return PROGRESS_DELETE_UPSTREAM_FALLBACK_MESSAGE;
  }
}
