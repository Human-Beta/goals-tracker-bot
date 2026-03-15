import { describe, expect, it, vi } from 'vitest';

import { start } from '../src';

describe('bootstrap smoke', () => {
  it('starts without throwing and logs safe config summary', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const telegramToken = 'telegram-secret-token';
    const serviceToken = 'service-secret-token';

    expect(() =>
      start({
        TELEGRAM_BOT_TOKEN: telegramToken,
        GOALS_API_BASE_URL: 'https://api.example.com',
        GOALS_API_SERVICE_TOKEN: serviceToken,
      })
    ).not.toThrow();

    const summaryCall = infoSpy.mock.calls.find(([message]) => message === 'Runtime config summary');
    expect(summaryCall).toBeDefined();

    const summary = summaryCall?.[1] as Record<string, unknown>;
    expect(summary).toMatchObject({
      GOALS_API_BASE_URL: 'https://api.example.com',
      LOG_LEVEL: 'info',
      HTTP_TIMEOUT_MS: 10000,
      BOT_MODE: 'polling',
      hasTelegramBotToken: true,
      hasGoalsApiServiceToken: true,
    });
    expect(summary).not.toHaveProperty('TELEGRAM_BOT_TOKEN');
    expect(summary).not.toHaveProperty('GOALS_API_SERVICE_TOKEN');

    const serializedLogs = infoSpy.mock.calls
      .flat()
      .map(value => (typeof value === 'string' ? value : JSON.stringify(value)))
      .join(' ');

    expect(serializedLogs).not.toContain(telegramToken);
    expect(serializedLogs).not.toContain(serviceToken);

    infoSpy.mockRestore();
  });
});
