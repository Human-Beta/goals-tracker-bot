import { describe, expect, it, vi } from 'vitest';
import type { Bot, Context } from 'grammy';

import type { AppConfig } from '../src/config';
import { runBot } from '../src/index';

const POLLING_CONFIG: AppConfig = {
  TELEGRAM_BOT_TOKEN: 'test-token',
  GOALS_API_BASE_URL: 'https://api.example.com',
  GOALS_API_SERVICE_TOKEN: 'service-token',
  LOG_LEVEL: 'info',
  HTTP_TIMEOUT_MS: 10000,
  BOT_MODE: 'polling',
  BOT_WEBHOOK_PORT: 8080,
  BOT_WEBHOOK_PUBLIC_URL: undefined,
  BOT_WEBHOOK_SECRET_PATH: undefined,
};

const WEBHOOK_CONFIG: AppConfig = {
  ...POLLING_CONFIG,
  BOT_MODE: 'webhook',
  BOT_WEBHOOK_PORT: 9090,
  BOT_WEBHOOK_PUBLIC_URL: 'https://bot.example.com',
  BOT_WEBHOOK_SECRET_PATH: '/tg/abc',
};

function makeFakeBot(): Bot<Context> {
  return { __fake: true } as unknown as Bot<Context>;
}

describe('runBot mode selection', () => {
  it('starts polling and does not start webhook when BOT_MODE=polling', () => {
    const fakeBot = makeFakeBot();
    const createBot = vi.fn().mockReturnValue(fakeBot);
    const startPolling = vi.fn();
    const startWebhook = vi.fn().mockResolvedValue({ port: 0, close: async () => {} });

    runBot(POLLING_CONFIG, { createBot, startPolling, startWebhook });

    expect(createBot).toHaveBeenCalledTimes(1);
    expect(createBot).toHaveBeenCalledWith(POLLING_CONFIG);
    expect(startPolling).toHaveBeenCalledTimes(1);
    expect(startPolling).toHaveBeenCalledWith(fakeBot);
    expect(startWebhook).not.toHaveBeenCalled();
  });

  it('starts webhook and does not start polling when BOT_MODE=webhook', () => {
    const fakeBot = makeFakeBot();
    const createBot = vi.fn().mockReturnValue(fakeBot);
    const startPolling = vi.fn();
    const startWebhook = vi.fn().mockResolvedValue({ port: 9090, close: async () => {} });

    runBot(WEBHOOK_CONFIG, { createBot, startPolling, startWebhook });

    expect(createBot).toHaveBeenCalledTimes(1);
    expect(createBot).toHaveBeenCalledWith(WEBHOOK_CONFIG);
    expect(startWebhook).toHaveBeenCalledTimes(1);
    expect(startWebhook).toHaveBeenCalledWith(fakeBot, {
      port: 9090,
      publicUrl: 'https://bot.example.com',
      secretPath: '/tg/abc',
    });
    expect(startPolling).not.toHaveBeenCalled();
  });

  it('throws when BOT_MODE=webhook but webhook fields are missing (defensive check)', () => {
    const createBot = vi.fn().mockReturnValue(makeFakeBot());
    const startPolling = vi.fn();
    const startWebhook = vi.fn();

    expect(() =>
      runBot(
        { ...WEBHOOK_CONFIG, BOT_WEBHOOK_PUBLIC_URL: undefined, BOT_WEBHOOK_SECRET_PATH: undefined },
        { createBot, startPolling, startWebhook }
      )
    ).toThrow(/BOT_WEBHOOK_PUBLIC_URL and BOT_WEBHOOK_SECRET_PATH/);

    expect(startPolling).not.toHaveBeenCalled();
    expect(startWebhook).not.toHaveBeenCalled();
  });
});
