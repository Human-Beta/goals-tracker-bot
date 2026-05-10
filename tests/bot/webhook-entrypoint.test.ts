import { afterEach, describe, expect, it } from 'vitest';

import { createBot } from '../../src/bot/create-bot';
import { startWebhook, type WebhookHandle } from '../../src/bot/webhook-entrypoint';
import { buildTextUpdate, TEST_CHAT_ID, TEST_CONFIG, type ApiCall, type SendMessagePayload } from './helpers';

type BotWithApi = ReturnType<typeof createBot>;

function installTelegramApiInterceptor(bot: BotWithApi): { apiCalls: ApiCall[] } {
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
      const sendMessagePayload = payload as SendMessagePayload;
      return {
        ok: true,
        result: {
          message_id: 1,
          date: 1,
          chat: { id: sendMessagePayload.chat_id, type: 'private' },
          text: sendMessagePayload.text,
        },
      } as Awaited<ReturnType<typeof _prev>>;
    }

    throw new Error(`Unexpected Telegram method: ${method}`);
  });

  return { apiCalls };
}

describe('webhook entrypoint smoke', () => {
  let handle: WebhookHandle | undefined;

  afterEach(async () => {
    if (handle !== undefined) {
      await handle.close();
      handle = undefined;
    }
  });

  it('routes POST update on configured path through bot handler and sends a reply', async () => {
    const bot = createBot(TEST_CONFIG);
    const { apiCalls } = installTelegramApiInterceptor(bot);

    handle = await startWebhook(bot, {
      port: 0,
      publicUrl: 'http://localhost',
      secretPath: '/tg/test',
    });

    const response = await fetch(`http://127.0.0.1:${handle.port}/tg/test`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildTextUpdate('/ping')),
    });

    expect(response.status).toBe(200);

    const sendCall = apiCalls.find(call => call.method === 'sendMessage');
    expect(sendCall).toBeDefined();
    expect(sendCall?.payload).toMatchObject({ chat_id: TEST_CHAT_ID, text: 'pong' });
  });

  it('returns 404 for requests on the wrong path without invoking the bot', async () => {
    const bot = createBot(TEST_CONFIG);
    const { apiCalls } = installTelegramApiInterceptor(bot);

    handle = await startWebhook(bot, {
      port: 0,
      publicUrl: 'http://localhost',
      secretPath: '/tg/test',
    });

    const response = await fetch(`http://127.0.0.1:${handle.port}/wrong-path`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildTextUpdate('/ping')),
    });

    expect(response.status).toBe(404);
    expect(apiCalls.find(call => call.method === 'sendMessage')).toBeUndefined();
  });

  it('returns 404 for GET requests on the secret path', async () => {
    const bot = createBot(TEST_CONFIG);
    installTelegramApiInterceptor(bot);

    handle = await startWebhook(bot, {
      port: 0,
      publicUrl: 'http://localhost',
      secretPath: '/tg/test',
    });

    const response = await fetch(`http://127.0.0.1:${handle.port}/tg/test`, { method: 'GET' });

    expect(response.status).toBe(404);
  });
});
