import { describe, expect, it } from 'vitest';

import type { GoalsApiFetch } from '../src/api/client';
import type { components } from '../src/api/generated/schema';
import { createBot } from '../src/bot/create-bot';
import type { AppConfig } from '../src/config';

type ApiCall = {
  method: string;
  payload: unknown;
};

const TEST_CONFIG: AppConfig = {
  TELEGRAM_BOT_TOKEN: 'test-token',
  GOALS_API_BASE_URL: 'https://api.example.com',
  GOALS_API_SERVICE_TOKEN: 'service-token',
  LOG_LEVEL: 'info',
  HTTP_TIMEOUT_MS: 10000,
  BOT_MODE: 'polling',
};

const USER_TIMEZONE_HINT = 'Please provide a valid IANA timezone. Example: /start timezone=Europe/Kyiv';
const GOAL_CREATE_VALIDATION_HINT =
  'Could not create the goal. Please check title, unit, target, and date format (YYYY-MM-DD), then try again.';
const GOALS_LIST_EMPTY_MESSAGE = "You don't have any goals yet. Create one with /goal_create.";
const GOALS_LIST_AUTH_ERROR_MESSAGE = 'Temporary technical issue while loading your goals. Please try again later.';
const GOALS_LIST_NOT_FOUND_MESSAGE =
  'Could not find your profile context. Run /start timezone=<IANA> and then try /goals again.';
const GOAL_DETAILS_ETA_NULL_EXPLANATION = 'ETA cannot be estimated at the current pace.';
const GOAL_DETAILS_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

type GoalDetail = components['schemas']['GoalDetail'];
type SendMessagePayload = {
  chat_id: number;
  text: string;
  reply_markup?: {
    keyboard?: Array<Array<{ text: string }>>;
    one_time_keyboard?: boolean;
    resize_keyboard?: boolean;
    input_field_placeholder?: string;
  };
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function toRequest(input: RequestInfo | URL, init?: RequestInit): Request {
  if (input instanceof Request) {
    return input;
  }

  return new Request(input, init);
}

function buildTextUpdate(text: string): Parameters<ReturnType<typeof createBot>['handleUpdate']>[0] {
  return {
    update_id: 1,
    message: {
      message_id: 5,
      date: 1,
      chat: {
        id: 12345,
        type: 'private',
        first_name: 'Test',
      },
      from: {
        id: 12345,
        is_bot: false,
        first_name: 'Test',
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

function buildGoalDetailResponse(overrides: Partial<GoalDetail> = {}): GoalDetail {
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

async function runGoalDetailsScenario(
  goalsApiFetch: GoalsApiFetch,
  command = `/goal id=${GOAL_DETAILS_ID}`
): Promise<{ goalsRequests: Request[]; sendMessagePayload: SendMessagePayload }> {
  const apiCalls: ApiCall[] = [];
  const goalsRequests: Request[] = [];

  const trackedFetch: GoalsApiFetch = async (input, init) => {
    goalsRequests.push(toRequest(input, init));
    return goalsApiFetch(input, init);
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
          message_id: 200,
          date: 1,
          chat: {
            id: sendMessagePayload.chat_id,
            type: 'private',
          },
          text: sendMessagePayload.text,
        },
      } as Awaited<ReturnType<typeof _prev>>;
    }

    throw new Error(`Unexpected Telegram method: ${method}`);
  });

  await bot.init();
  await bot.handleUpdate(buildTextUpdate(command));

  const sendMessageCall = apiCalls.find(call => call.method === 'sendMessage');
  if (sendMessageCall === undefined) {
    throw new Error('Expected sendMessage call in goal details scenario');
  }

  return {
    goalsRequests,
    sendMessagePayload: sendMessageCall.payload as SendMessagePayload,
  };
}

describe('bot update handling', () => {
  it('handles /ping update end-to-end and sends pong', async () => {
    const bot = createBot(TEST_CONFIG);
    const apiCalls: ApiCall[] = [];

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
        const sendMessagePayload = payload as { chat_id: number; text: string };
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

      throw new Error(`Unexpected Telegram method: ${method}`);
    });

    const update = buildTextUpdate('/ping');

    await bot.init();
    await bot.handleUpdate(update);

    const sendMessageCall = apiCalls.find(call => call.method === 'sendMessage');
    expect(sendMessageCall).toBeDefined();
    expect(sendMessageCall?.payload).toMatchObject({
      chat_id: 12345,
      text: 'pong',
    });
  });

  it('handles /start by calling upsert endpoint and confirming saved timezone', async () => {
    const apiCalls: ApiCall[] = [];
    const goalsRequests: Request[] = [];

    const goalsApiFetch: GoalsApiFetch = async (input, init) => {
      const request = toRequest(input, init);
      goalsRequests.push(request);
      return jsonResponse({
        user_id: '11111111-1111-4111-8111-111111111111',
        telegram_user_id: 12345,
        timezone: 'Europe/Kyiv',
      });
    };

    const bot = createBot(TEST_CONFIG, { goalsApiFetch });

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
        const sendMessagePayload = payload as { chat_id: number; text: string };
        return {
          ok: true,
          result: {
            message_id: 2,
            date: 1,
            chat: {
              id: sendMessagePayload.chat_id,
              type: 'private',
            },
            text: sendMessagePayload.text,
          },
        } as Awaited<ReturnType<typeof _prev>>;
      }

      throw new Error(`Unexpected Telegram method: ${method}`);
    });

    const update = buildTextUpdate('/start timezone=Europe/Kyiv');
    await bot.init();
    await bot.handleUpdate(update);

    expect(goalsRequests).toHaveLength(1);
    const request = goalsRequests[0];
    expect(request.method).toBe('POST');
    expect(new URL(request.url).pathname).toBe('/bot/users/upsert');
    expect(request.headers.get('Authorization')).toBe('Bearer service-token');
    expect(request.headers.get('X-Telegram-User-Id')).toBe('12345');
    expect(await request.clone().json()).toEqual({
      telegram_user_id: 12345,
      timezone: 'Europe/Kyiv',
    });

    const sendMessageCall = apiCalls.find(call => call.method === 'sendMessage');
    expect(sendMessageCall?.payload).toMatchObject({
      chat_id: 12345,
      text: 'You are all set. Timezone saved: Europe/Kyiv.',
    });
  });

  it('returns timezone hint when /start upsert fails with 400', async () => {
    const apiCalls: ApiCall[] = [];
    const goalsApiFetch: GoalsApiFetch = async () =>
      jsonResponse(
        {
          code: 'validation_error',
          message: 'timezone is invalid',
        },
        400
      );
    const bot = createBot(TEST_CONFIG, { goalsApiFetch });

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
        const sendMessagePayload = payload as { chat_id: number; text: string };
        return {
          ok: true,
          result: {
            message_id: 3,
            date: 1,
            chat: {
              id: sendMessagePayload.chat_id,
              type: 'private',
            },
            text: sendMessagePayload.text,
          },
        } as Awaited<ReturnType<typeof _prev>>;
      }

      throw new Error(`Unexpected Telegram method: ${method}`);
    });

    const update = buildTextUpdate('/start timezone=Europe/Kyiv');
    await bot.init();
    await bot.handleUpdate(update);

    const sendMessageCall = apiCalls.find(call => call.method === 'sendMessage');
    expect(sendMessageCall?.payload).toMatchObject({
      chat_id: 12345,
      text: USER_TIMEZONE_HINT,
    });
  });

  it.each(['/start', '/start timezone=Invalid/Timezone'])(
    'returns timezone hint when start payload is invalid: %s',
    async command => {
      const apiCalls: ApiCall[] = [];
      let didCallGoalsApi = false;

      const goalsApiFetch: GoalsApiFetch = async () => {
        didCallGoalsApi = true;
        return jsonResponse({});
      };

      const bot = createBot(TEST_CONFIG, { goalsApiFetch });
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
          const sendMessagePayload = payload as { chat_id: number; text: string };
          return {
            ok: true,
            result: {
              message_id: 4,
              date: 1,
              chat: {
                id: sendMessagePayload.chat_id,
                type: 'private',
              },
              text: sendMessagePayload.text,
            },
          } as Awaited<ReturnType<typeof _prev>>;
        }

        throw new Error(`Unexpected Telegram method: ${method}`);
      });

      const update = buildTextUpdate(command);
      await bot.init();
      await bot.handleUpdate(update);

      expect(didCallGoalsApi).toBe(false);
      const sendMessageCall = apiCalls.find(call => call.method === 'sendMessage');
      expect(sendMessageCall?.payload).toMatchObject({
        chat_id: 12345,
        text: USER_TIMEZONE_HINT,
      });
    }
  );

  it('handles /goal_create by calling POST /goals and returning key fields', async () => {
    const apiCalls: ApiCall[] = [];
    const goalsRequests: Request[] = [];

    const goalsApiFetch: GoalsApiFetch = async (input, init) => {
      const request = toRequest(input, init);
      goalsRequests.push(request);
      return jsonResponse(
        {
          id: '55555555-5555-4555-8555-555555555555',
          user_id: '11111111-1111-4111-8111-111111111111',
          title: 'Read Clean Code',
          unit: 'pages',
          target_value: 464,
          start_date: '2026-02-10',
          end_date: '2026-03-15',
          status: 'active',
          created_at: '2026-02-10T12:00:00.000Z',
          updated_at: '2026-02-10T12:00:00.000Z',
        },
        201
      );
    };

    const bot = createBot(TEST_CONFIG, { goalsApiFetch });
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
        const sendMessagePayload = payload as { chat_id: number; text: string };
        return {
          ok: true,
          result: {
            message_id: 5,
            date: 1,
            chat: {
              id: sendMessagePayload.chat_id,
              type: 'private',
            },
            text: sendMessagePayload.text,
          },
        } as Awaited<ReturnType<typeof _prev>>;
      }

      throw new Error(`Unexpected Telegram method: ${method}`);
    });

    const update = buildTextUpdate(
      '/goal_create title="Read Clean Code" unit=pages target=464 end=2026-03-15 start=2026-02-10'
    );
    await bot.init();
    await bot.handleUpdate(update);

    expect(goalsRequests).toHaveLength(1);
    const request = goalsRequests[0];
    expect(request.method).toBe('POST');
    expect(new URL(request.url).pathname).toBe('/goals');
    expect(request.headers.get('Authorization')).toBe('Bearer service-token');
    expect(request.headers.get('X-Telegram-User-Id')).toBe('12345');
    expect(await request.clone().json()).toEqual({
      title: 'Read Clean Code',
      unit: 'pages',
      target_value: 464,
      start_date: '2026-02-10',
      end_date: '2026-03-15',
    });

    const sendMessageCall = apiCalls.find(call => call.method === 'sendMessage');
    const sendMessagePayload = sendMessageCall?.payload as { chat_id: number; text: string };
    expect(sendMessagePayload.chat_id).toBe(12345);
    expect(sendMessagePayload.text).toContain('id: 55555555-5555-4555-8555-555555555555');
    expect(sendMessagePayload.text).toContain('title: Read Clean Code');
    expect(sendMessagePayload.text).toContain('target: 464');
    expect(sendMessagePayload.text).toContain('end_date: 2026-03-15');
  });

  it('returns format validation message and does not call API for invalid /goal_create payload', async () => {
    const apiCalls: ApiCall[] = [];
    let didCallGoalsApi = false;

    const goalsApiFetch: GoalsApiFetch = async () => {
      didCallGoalsApi = true;
      return jsonResponse({});
    };

    const bot = createBot(TEST_CONFIG, { goalsApiFetch });
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
        const sendMessagePayload = payload as { chat_id: number; text: string };
        return {
          ok: true,
          result: {
            message_id: 6,
            date: 1,
            chat: {
              id: sendMessagePayload.chat_id,
              type: 'private',
            },
            text: sendMessagePayload.text,
          },
        } as Awaited<ReturnType<typeof _prev>>;
      }

      throw new Error(`Unexpected Telegram method: ${method}`);
    });

    const update = buildTextUpdate('/goal_create title="Read Clean Code" unit=pages target=abc end=2026-03-15');
    await bot.init();
    await bot.handleUpdate(update);

    expect(didCallGoalsApi).toBe(false);
    const sendMessageCall = apiCalls.find(call => call.method === 'sendMessage');
    const sendMessagePayload = sendMessageCall?.payload as { chat_id: number; text: string };
    expect(sendMessagePayload.chat_id).toBe(12345);
    expect(sendMessagePayload.text).toContain('Invalid command format');
    expect(sendMessagePayload.text).toContain('argument "target" must be a valid number');
    expect(sendMessagePayload.text).toContain('/goal_create title="<text>" unit=<pages|minutes|km> target=<number>');
  });

  it('returns user-friendly message when /goal_create fails with 400', async () => {
    const apiCalls: ApiCall[] = [];
    const goalsApiFetch: GoalsApiFetch = async () =>
      jsonResponse(
        {
          code: 'validation_error',
          message: 'end_date must be after today',
        },
        400
      );

    const bot = createBot(TEST_CONFIG, { goalsApiFetch });
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
        const sendMessagePayload = payload as { chat_id: number; text: string };
        return {
          ok: true,
          result: {
            message_id: 7,
            date: 1,
            chat: {
              id: sendMessagePayload.chat_id,
              type: 'private',
            },
            text: sendMessagePayload.text,
          },
        } as Awaited<ReturnType<typeof _prev>>;
      }

      throw new Error(`Unexpected Telegram method: ${method}`);
    });

    const update = buildTextUpdate('/goal_create title="Read Clean Code" unit=pages target=464 end=2026-03-15');
    await bot.init();
    await bot.handleUpdate(update);

    const sendMessageCall = apiCalls.find(call => call.method === 'sendMessage');
    expect(sendMessageCall?.payload).toMatchObject({
      chat_id: 12345,
      text: GOAL_CREATE_VALIDATION_HINT,
    });
  });

  it('handles /goals by calling GET /goals and rendering summary fields', async () => {
    const apiCalls: ApiCall[] = [];
    const goalsRequests: Request[] = [];

    const goalsApiFetch: GoalsApiFetch = async (input, init) => {
      const request = toRequest(input, init);
      goalsRequests.push(request);
      return jsonResponse({
        items: [
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            title: 'Read Clean Code',
            percent_complete: 42.5,
            days_left: 20,
            pace_current_7d: 18.25,
          },
          {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            title: 'Run 120 km',
            percent_complete: 55,
            days_left: 14,
            pace_current_7d: 6.5,
          },
        ],
      });
    };

    const bot = createBot(TEST_CONFIG, { goalsApiFetch });
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
            message_id: 8,
            date: 1,
            chat: {
              id: sendMessagePayload.chat_id,
              type: 'private',
            },
            text: sendMessagePayload.text,
          },
        } as Awaited<ReturnType<typeof _prev>>;
      }

      throw new Error(`Unexpected Telegram method: ${method}`);
    });

    const update = buildTextUpdate('/goals');
    await bot.init();
    await bot.handleUpdate(update);

    expect(goalsRequests).toHaveLength(1);
    const request = goalsRequests[0];
    expect(request.method).toBe('GET');
    expect(new URL(request.url).pathname).toBe('/goals');
    expect(request.headers.get('Authorization')).toBe('Bearer service-token');
    expect(request.headers.get('X-Telegram-User-Id')).toBe('12345');

    const sendMessageCall = apiCalls.find(call => call.method === 'sendMessage');
    const sendMessagePayload = sendMessageCall?.payload as SendMessagePayload;
    expect(sendMessagePayload.chat_id).toBe(12345);
    expect(sendMessagePayload.text).toContain('id: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(sendMessagePayload.text).toContain('title: Read Clean Code');
    expect(sendMessagePayload.text).toContain('percent_complete: 42.5');
    expect(sendMessagePayload.text).toContain('days_left: 20');
    expect(sendMessagePayload.text).toContain('pace_current_7d: 18.25');
    expect(sendMessagePayload.text).toContain('id: bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    expect(sendMessagePayload.text).toContain('title: Run 120 km');
    expect(sendMessagePayload.text).toContain('percent_complete: 55');
    expect(sendMessagePayload.text).toContain('days_left: 14');
    expect(sendMessagePayload.text).toContain('pace_current_7d: 6.5');
    expect(sendMessagePayload.reply_markup?.keyboard).toEqual([
      [{ text: '/goal id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }],
      [{ text: '/goal id=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }],
    ]);
    expect(sendMessagePayload.reply_markup?.one_time_keyboard).toBe(true);
    expect(sendMessagePayload.reply_markup?.resize_keyboard).toBe(true);
    expect(sendMessagePayload.reply_markup?.input_field_placeholder).toBe('Tap a goal button to open details');
  });

  it('handles /goal by calling GET /goals/{goalId} and rendering metrics from API response', async () => {
    const expectedGoalDetail = buildGoalDetailResponse({
      percent_complete: 42.5,
      current_value: 197,
      remaining_value: 267,
      days_left: 19,
      pace_current_7d: 13.25,
      pace_required_per_day: 14.05,
      eta_date: '2026-03-30',
      behind_value: 11.5,
    });

    const { goalsRequests, sendMessagePayload } = await runGoalDetailsScenario(async () =>
      jsonResponse(expectedGoalDetail)
    );

    expect(goalsRequests).toHaveLength(1);
    const request = goalsRequests[0];
    expect(request.method).toBe('GET');
    expect(new URL(request.url).pathname).toBe(`/goals/${GOAL_DETAILS_ID}`);
    expect(request.headers.get('Authorization')).toBe('Bearer service-token');
    expect(request.headers.get('X-Telegram-User-Id')).toBe('12345');

    expect(sendMessagePayload.chat_id).toBe(12345);
    expect(sendMessagePayload.text).toContain('percent_complete: 42.5');
    expect(sendMessagePayload.text).toContain('current_value: 197');
    expect(sendMessagePayload.text).toContain('remaining_value: 267');
    expect(sendMessagePayload.text).toContain('days_left: 19');
    expect(sendMessagePayload.text).toContain('pace_current_7d: 13.3');
    expect(sendMessagePayload.text).toContain('pace_required_per_day: 14.1');
    expect(sendMessagePayload.text).toContain('eta_date: 2026-03-30');
    expect(sendMessagePayload.text).toContain('behind_value: 11.5');
    expect(sendMessagePayload.text).not.toContain(GOAL_DETAILS_ETA_NULL_EXPLANATION);
  });

  it('renders explanation when /goal returns eta_date as null', async () => {
    const { sendMessagePayload } = await runGoalDetailsScenario(async () =>
      jsonResponse(
        buildGoalDetailResponse({
          eta_date: null,
          behind_value: 7.75,
        })
      )
    );

    expect(sendMessagePayload.chat_id).toBe(12345);
    expect(sendMessagePayload.text).toContain('percent_complete: 25.9');
    expect(sendMessagePayload.text).toContain('eta_date: null');
    expect(sendMessagePayload.text).toContain(`eta_note: ${GOAL_DETAILS_ETA_NULL_EXPLANATION}`);
    expect(sendMessagePayload.text).toContain('behind_value: 7.8');
  });

  it('keeps negative sign for behind_value when /goal returns ahead-of-schedule metrics', async () => {
    const { sendMessagePayload } = await runGoalDetailsScenario(async () =>
      jsonResponse(
        buildGoalDetailResponse({
          behind_value: -6.2,
        })
      )
    );

    expect(sendMessagePayload.chat_id).toBe(12345);
    expect(sendMessagePayload.text).toContain('behind_value: -6.2');
  });

  it('returns dedicated empty-state message when /goals list is empty', async () => {
    const apiCalls: ApiCall[] = [];

    const goalsApiFetch: GoalsApiFetch = async () =>
      jsonResponse({
        items: [],
      });

    const bot = createBot(TEST_CONFIG, { goalsApiFetch });
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
        const sendMessagePayload = payload as { chat_id: number; text: string };
        return {
          ok: true,
          result: {
            message_id: 9,
            date: 1,
            chat: {
              id: sendMessagePayload.chat_id,
              type: 'private',
            },
            text: sendMessagePayload.text,
          },
        } as Awaited<ReturnType<typeof _prev>>;
      }

      throw new Error(`Unexpected Telegram method: ${method}`);
    });

    const update = buildTextUpdate('/goals');
    await bot.init();
    await bot.handleUpdate(update);

    const sendMessageCall = apiCalls.find(call => call.method === 'sendMessage');
    expect(sendMessageCall?.payload).toMatchObject({
      chat_id: 12345,
      text: GOALS_LIST_EMPTY_MESSAGE,
    });
    const sendMessagePayload = sendMessageCall?.payload as SendMessagePayload;
    expect(sendMessagePayload.reply_markup).toBeUndefined();
  });

  it('returns mapped technical message when /goals fails with 401', async () => {
    const apiCalls: ApiCall[] = [];

    const goalsApiFetch: GoalsApiFetch = async () =>
      jsonResponse(
        {
          code: 'unauthorized',
          message: 'service token invalid',
        },
        401
      );

    const bot = createBot(TEST_CONFIG, { goalsApiFetch });
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
        const sendMessagePayload = payload as { chat_id: number; text: string };
        return {
          ok: true,
          result: {
            message_id: 10,
            date: 1,
            chat: {
              id: sendMessagePayload.chat_id,
              type: 'private',
            },
            text: sendMessagePayload.text,
          },
        } as Awaited<ReturnType<typeof _prev>>;
      }

      throw new Error(`Unexpected Telegram method: ${method}`);
    });

    const update = buildTextUpdate('/goals');
    await bot.init();
    await bot.handleUpdate(update);

    const sendMessageCall = apiCalls.find(call => call.method === 'sendMessage');
    expect(sendMessageCall?.payload).toMatchObject({
      chat_id: 12345,
      text: GOALS_LIST_AUTH_ERROR_MESSAGE,
    });
  });

  it('returns mapped not-found message when /goals fails with 404', async () => {
    const apiCalls: ApiCall[] = [];

    const goalsApiFetch: GoalsApiFetch = async () =>
      jsonResponse(
        {
          code: 'user_not_found',
          message: 'user not found',
        },
        404
      );

    const bot = createBot(TEST_CONFIG, { goalsApiFetch });
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
        const sendMessagePayload = payload as { chat_id: number; text: string };
        return {
          ok: true,
          result: {
            message_id: 11,
            date: 1,
            chat: {
              id: sendMessagePayload.chat_id,
              type: 'private',
            },
            text: sendMessagePayload.text,
          },
        } as Awaited<ReturnType<typeof _prev>>;
      }

      throw new Error(`Unexpected Telegram method: ${method}`);
    });

    const update = buildTextUpdate('/goals');
    await bot.init();
    await bot.handleUpdate(update);

    const sendMessageCall = apiCalls.find(call => call.method === 'sendMessage');
    expect(sendMessageCall?.payload).toMatchObject({
      chat_id: 12345,
      text: GOALS_LIST_NOT_FOUND_MESSAGE,
    });
  });
});
