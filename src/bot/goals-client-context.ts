import type { Context } from 'grammy';

import { createGoalsApiClient, type GoalsApiClient, type GoalsApiFetch } from '../api/client';
import type { AppConfig } from '../config';

export type CreateBotDependencies = {
  goalsApiFetch?: GoalsApiFetch;
};

type UserScopedGoalsClient = {
  telegramUserId: number;
  client: GoalsApiClient;
};

export function createUserScopedGoalsClient(
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
