import { expect } from 'vitest';

import type { GoalsApiFetch } from '../../src/api/client';
import type { components } from '../../src/api/generated/schema';
import { createBot } from '../../src/bot/create-bot';
import type { AppConfig } from '../../src/config';

export const TEST_CHAT_ID = 12345;
const TEST_USER_FIRST_NAME = 'Test';

export const TEST_CONFIG: AppConfig = {
  TELEGRAM_BOT_TOKEN: 'test-token',
  GOALS_API_BASE_URL: 'https://api.example.com',
  GOALS_API_SERVICE_TOKEN: 'service-token',
  LOG_LEVEL: 'info',
  HTTP_TIMEOUT_MS: 10000,
  BOT_MODE: 'polling',
};

export const GOAL_DETAILS_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const PROGRESS_EVENT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
export const PROGRESS_EVENT_ID_2 = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

export const USER_TIMEZONE_HINT = 'Please provide a valid IANA timezone. Example: /start timezone=Europe/Kyiv';
export const GOAL_CREATE_VALIDATION_HINT =
  'Could not create the goal. Please check title, unit, target, and date format (YYYY-MM-DD), then try again.';
export const GOALS_LIST_EMPTY_MESSAGE = "You don't have any goals yet. Create one with /goal_create.";
export const GOALS_LIST_AUTH_ERROR_MESSAGE =
  'Temporary technical issue while loading your goals. Please try again later.';
export const GOALS_LIST_NOT_FOUND_MESSAGE =
  'Could not find your profile context. Run /start timezone=<IANA> and then try /goals again.';
export const GOAL_DETAILS_ETA_NULL_EXPLANATION = 'ETA cannot be estimated at the current pace.';
export const GOAL_EDIT_IMMUTABLE_UNIT_MESSAGE =
  'Goal unit cannot be changed after the goal is created. Create a new goal with /goal_create to use a different unit.';
export const GOAL_EDIT_CONFLICT_MESSAGE =
  'Could not apply this update because it conflicts with the goal state (for example, target below current progress). Please review the values and try again.';
export const PROGRESS_ADD_NOT_FOUND_MESSAGE = 'Goal not found. Run /goals to check available goal IDs and try again.';
export const PROGRESS_LIST_EMPTY_MESSAGE =
  'No progress events found for this goal. Record progress with /progress_add goal=<uuid> delta=<number>.';
export const PROGRESS_EDIT_NOTHING_TO_UPDATE_MESSAGE = 'Nothing to update. Provide at least one of: delta, date, note.';
export const PROGRESS_EDIT_NOT_FOUND_MESSAGE =
  'Progress event not found. Run /progress_list goal=<uuid> to check available event IDs and try again.';
export const PROGRESS_DELETE_SUCCESS_MESSAGE = 'Progress event deleted.';
export const PROGRESS_DELETE_NOT_FOUND_MESSAGE =
  'Progress event not found. Run /progress_list goal=<uuid> to check available event IDs and try again.';

export type GoalDetail = components['schemas']['GoalDetail'];

export type ApiCall = {
  method: string;
  payload: unknown;
};

export type SendMessagePayload = {
  chat_id: number;
  text: string;
  reply_markup?: {
    inline_keyboard?: Array<Array<{ text: string; callback_data: string }>>;
    keyboard?: Array<Array<{ text: string }>>;
    one_time_keyboard?: boolean;
    resize_keyboard?: boolean;
    input_field_placeholder?: string;
  };
};

type BotUpdate = Parameters<ReturnType<typeof createBot>['handleUpdate']>[0];

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

export function toRequest(input: RequestInfo | URL, init?: RequestInit): Request {
  if (input instanceof Request) {
    return input;
  }

  return new Request(input, init);
}

export function buildTextUpdate(text: string): BotUpdate {
  return {
    update_id: 1,
    message: {
      message_id: 5,
      date: 1,
      chat: {
        id: TEST_CHAT_ID,
        type: 'private',
        first_name: TEST_USER_FIRST_NAME,
      },
      from: {
        id: TEST_CHAT_ID,
        is_bot: false,
        first_name: TEST_USER_FIRST_NAME,
      },
      text,
      entities: [
        {
          offset: 0,
          length: text.split(' ')[0].length,
          type: 'bot_command',
        },
      ],
    },
  };
}

export function buildGoalDetailsCallbackUpdate(goalId: string): BotUpdate {
  return {
    update_id: 2,
    callback_query: {
      id: 'callback-query-1',
      from: {
        id: TEST_CHAT_ID,
        is_bot: false,
        first_name: TEST_USER_FIRST_NAME,
      },
      chat_instance: 'test-chat-instance',
      message: {
        message_id: 6,
        date: 1,
        chat: {
          id: TEST_CHAT_ID,
          type: 'private',
          first_name: TEST_USER_FIRST_NAME,
        },
        text: '/goals',
      },
      data: `goal_details:${goalId}`,
    },
  };
}

export function buildGoalDetailResponse(overrides: Partial<GoalDetail> = {}): GoalDetail {
  return {
    id: GOAL_DETAILS_ID,
    user_id: '11111111-1111-4111-8111-111111111111',
    title: 'Read Clean Code',
    unit: 'pages',
    target_value: 464,
    start_date: '2026-02-10',
    end_date: '2026-03-15',
    status: 'active',
    created_at: '2026-02-10T12:00:00.000Z',
    updated_at: '2026-02-12T12:00:00.000Z',
    current_value: 120,
    remaining_value: 344,
    percent_complete: 25.86,
    days_left: 20,
    days_left_for_pace: 21,
    days_total: 34,
    days_elapsed: 14,
    pace_expected_per_day: 13.6470588235,
    pace_required_per_day: 16.380952381,
    pace_current_7d: 10.2,
    pace_current_30d: 8.5,
    pace_current_all: 8.571428571,
    eta_date: '2026-04-18',
    expected_by_today: 191.0588235294,
    behind_value: 71.0588235294,
    catchup_pace_next_7_days: 20.25,
    ...overrides,
  };
}

const NEVER_CALLED_GOALS_API: GoalsApiFetch = async () => {
  throw new Error('Goals API fetch was called but no mock was provided to runBotScenario.');
};

export type RunBotScenarioOptions = {
  update: BotUpdate;
  goalsApiFetch?: GoalsApiFetch;
};

export type RunBotScenarioResult = {
  goalsRequests: Request[];
  apiCalls: ApiCall[];
  sendMessagePayload: SendMessagePayload;
};

export async function runBotScenario(options: RunBotScenarioOptions): Promise<RunBotScenarioResult> {
  const goalsRequests: Request[] = [];
  const apiCalls: ApiCall[] = [];
  const innerFetch = options.goalsApiFetch ?? NEVER_CALLED_GOALS_API;

  const trackedFetch: GoalsApiFetch = async (input, init) => {
    goalsRequests.push(toRequest(input, init));
    return innerFetch(input, init);
  };

  const bot = createBot(TEST_CONFIG, { goalsApiFetch: trackedFetch });

  bot.api.config.use(async (_prev, method, payload) => {
    apiCalls.push({ method, payload });

    if (method === 'getMe') {
      return {
        ok: true,
        result: {
          id: 999,
          is_bot: true,
          first_name: 'Test Bot',
          username: 'test_bot',
          can_join_groups: true,
          can_read_all_group_messages: false,
          supports_inline_queries: false,
        },
      } as Awaited<ReturnType<typeof _prev>>;
    }

    if (method === 'sendMessage') {
      const sendMessagePayload = payload as SendMessagePayload;
      return {
        ok: true,
        result: {
          message_id: 1,
          date: 1,
          chat: {
            id: sendMessagePayload.chat_id,
            type: 'private',
          },
          text: sendMessagePayload.text,
        },
      } as Awaited<ReturnType<typeof _prev>>;
    }

    if (method === 'answerCallbackQuery') {
      return {
        ok: true,
        result: true,
      } as Awaited<ReturnType<typeof _prev>>;
    }

    throw new Error(`Unexpected Telegram method: ${method}`);
  });

  await bot.init();
  await bot.handleUpdate(options.update);

  const sendMessageCall = apiCalls.find(call => call.method === 'sendMessage');
  if (sendMessageCall === undefined) {
    throw new Error('Expected sendMessage call in scenario');
  }

  return {
    goalsRequests,
    apiCalls,
    sendMessagePayload: sendMessageCall.payload as SendMessagePayload,
  };
}

export function expectAuthHeaders(request: Request): void {
  expect(request.headers.get('Authorization')).toBe('Bearer service-token');
  expect(request.headers.get('X-Telegram-User-Id')).toBe('12345');
}
