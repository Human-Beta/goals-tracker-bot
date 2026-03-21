import { describe, expect, it } from 'vitest';

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

    const update = {
      update_id: 1,
      message: {
        message_id: 5,
        date: 1,
        chat: {
          id: 12345,
          type: 'private',
        },
        from: {
          id: 12345,
          is_bot: false,
          first_name: 'Test',
        },
        text: '/ping',
        entities: [
          {
            offset: 0,
            length: 5,
            type: 'bot_command',
          },
        ],
      },
    } as Parameters<typeof bot.handleUpdate>[0];

    await bot.init();
    await bot.handleUpdate(update);

    const sendMessageCall = apiCalls.find(call => call.method === 'sendMessage');
    expect(sendMessageCall).toBeDefined();
    expect(sendMessageCall?.payload).toMatchObject({
      chat_id: 12345,
      text: 'pong',
    });
  });
});
