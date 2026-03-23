import { describe, expect, it } from 'vitest';

import type { GoalsApiFetch } from '../src/api/client';
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
});
