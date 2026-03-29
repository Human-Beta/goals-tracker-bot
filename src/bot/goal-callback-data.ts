import { UUID_PATTERN } from '../shared/patterns';

const GOAL_DETAILS_CALLBACK_PREFIX = 'goal_details:';

export function buildGoalDetailsCallbackData(goalId: string): string {
  return `${GOAL_DETAILS_CALLBACK_PREFIX}${goalId}`;
}

export function parseGoalDetailsCallbackData(data: string): string | null {
  if (!data.startsWith(GOAL_DETAILS_CALLBACK_PREFIX)) {
    return null;
  }

  const goalId = data.slice(GOAL_DETAILS_CALLBACK_PREFIX.length);
  return UUID_PATTERN.test(goalId) ? goalId : null;
}
