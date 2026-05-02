import { InlineKeyboard, type Context } from 'grammy';

import type { components } from '../../api/generated/schema';
import type { AppConfig } from '../../config';
import { mapApiError } from '../presentation/api-error-handler';
import { createUserScopedGoalsClient, type CreateBotDependencies } from '../goals-client-context';
import { buildGoalDetailsCallbackData } from './goal-callback-data';
import { toCommandResponse, type CommandResponse } from './command-response';
import {
  goalCreateMessages,
  goalDetailsMessages,
  goalEditMessages,
  goalsListMessages,
  progressAddMessages,
  progressDeleteMessages,
  progressEditMessages,
  progressListMessages,
  startMessages,
} from '../presentation/messages';
import {
  formatGoalCreateSuccessResponse,
  formatGoalDetailsResponse,
  formatGoalEditSuccessResponse,
  formatGoalsListResponse,
  formatGoalTitleCommandLabel,
  formatProgressAddSuccessResponse,
  formatProgressEditSuccessResponse,
  formatProgressListResponse,
} from '../presentation/response-formatters';

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
    return startMessages.validation;
  }

  const scopedClient = createUserScopedGoalsClient(ctx, config, dependencies);
  if (scopedClient === null) {
    return startMessages.fallback;
  }

  try {
    await scopedClient.client.POST('/bot/users/upsert', {
      body: {
        telegram_user_id: scopedClient.telegramUserId,
        timezone,
      },
    });

    return `${startMessages.success} ${timezone}.`;
  } catch (error) {
    return mapApiError(error, startMessages);
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
    return goalCreateMessages.fallback;
  }

  if (title === undefined || unit === undefined || target === undefined || end === undefined) {
    return goalCreateMessages.validation;
  }

  if (!isGoalUnit(unit)) {
    return goalCreateMessages.validation;
  }

  const targetValue = Number(target);
  if (!Number.isFinite(targetValue)) {
    return goalCreateMessages.validation;
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
    return mapApiError(error, goalCreateMessages);
  }
}

export async function handleGoalsListCommand(
  ctx: Context,
  config: AppConfig,
  dependencies: CreateBotDependencies
): Promise<CommandResponse> {
  const scopedClient = createUserScopedGoalsClient(ctx, config, dependencies);
  if (scopedClient === null) {
    return toCommandResponse(goalsListMessages.fallback);
  }

  try {
    const response = await scopedClient.client.GET('/goals');
    if (response.items.length === 0) {
      return toCommandResponse(goalsListMessages.empty);
    }

    return toCommandResponse(formatGoalsListResponse(response.items), {
      reply_markup: buildGoalsListKeyboard(response.items),
    });
  } catch (error) {
    return toCommandResponse(mapApiError(error, goalsListMessages));
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
    return goalDetailsMessages.fallback;
  }

  const goalId = args.id;
  if (goalId === undefined) {
    return goalDetailsMessages.fallback;
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
    return mapApiError(error, goalDetailsMessages);
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
    return goalEditMessages.fallback;
  }

  if (goalId === undefined) {
    return goalEditMessages.validation;
  }

  if (unit !== undefined) {
    return goalEditMessages.immutableUnit;
  }

  if (title === undefined && target === undefined && start === undefined && end === undefined) {
    return goalEditMessages.nothingToUpdate;
  }

  let targetValue: number | undefined;
  if (target !== undefined) {
    const parsedTarget = Number(target);
    if (!Number.isFinite(parsedTarget)) {
      return goalEditMessages.validation;
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
    return mapApiError(error, goalEditMessages);
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
    return progressAddMessages.fallback;
  }

  if (goalId === undefined || delta === undefined) {
    return progressAddMessages.validation;
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
    return mapApiError(error, progressAddMessages);
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
    return progressListMessages.fallback;
  }

  if (goalId === undefined) {
    return progressListMessages.validation;
  }

  if (sort !== undefined && !isSortDirection(sort)) {
    return progressListMessages.validation;
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
      return progressListMessages.empty;
    }

    return formatProgressListResponse(result.items);
  } catch (error) {
    return mapApiError(error, progressListMessages);
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
    return progressEditMessages.fallback;
  }

  if (goalId === undefined || eventId === undefined) {
    return progressEditMessages.validation;
  }

  if (delta === undefined && date === undefined && note === undefined) {
    return progressEditMessages.nothingToUpdate;
  }

  let deltaValue: number | undefined;
  if (delta !== undefined) {
    const parsedDelta = Number(delta);
    if (!Number.isFinite(parsedDelta)) {
      return progressEditMessages.validation;
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
    return mapApiError(error, progressEditMessages);
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
    return progressDeleteMessages.fallback;
  }

  if (goalId === undefined || eventId === undefined || confirm !== 'yes') {
    return progressDeleteMessages.fallback;
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

    return progressDeleteMessages.success;
  } catch (error) {
    return mapApiError(error, progressDeleteMessages);
  }
}
