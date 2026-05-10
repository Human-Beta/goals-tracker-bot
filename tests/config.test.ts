import { describe, expect, it } from 'vitest';

import { ConfigValidationError, loadConfig } from '../src/config';

const VALID_ENV: NodeJS.ProcessEnv = {
  TELEGRAM_BOT_TOKEN: 'telegram-token',
  GOALS_API_BASE_URL: 'https://api.example.com',
  GOALS_API_SERVICE_TOKEN: 'service-token',
};

function buildEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return { ...VALID_ENV, ...overrides };
}

function getConfigValidationError(rawEnv: NodeJS.ProcessEnv): ConfigValidationError {
  try {
    loadConfig(rawEnv);
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      return error;
    }
    throw error;
  }

  throw new Error('Expected ConfigValidationError to be thrown');
}

describe('loadConfig', () => {
  it('throws controlled error when required env is missing', () => {
    const configError = getConfigValidationError({
      GOALS_API_BASE_URL: 'https://api.example.com',
    });

    expect(configError.code).toBe('CONFIG_VALIDATION_ERROR');
    expect(configError.fields).toEqual(expect.arrayContaining(['TELEGRAM_BOT_TOKEN', 'GOALS_API_SERVICE_TOKEN']));
    expect(configError.issues.join(' ')).toContain('TELEGRAM_BOT_TOKEN');
    expect(configError.issues.join(' ')).toContain('GOALS_API_SERVICE_TOKEN');
  });

  it('applies defaults for optional env vars', () => {
    const config = loadConfig(buildEnv());

    expect(config.LOG_LEVEL).toBe('info');
    expect(config.BOT_MODE).toBe('polling');
    expect(config.HTTP_TIMEOUT_MS).toBe(10000);
    expect(config.BOT_WEBHOOK_PORT).toBe(8080);
    expect(config.BOT_WEBHOOK_PUBLIC_URL).toBeUndefined();
    expect(config.BOT_WEBHOOK_SECRET_PATH).toBeUndefined();
  });

  it('reports invalid values with readable messages', () => {
    const configError = getConfigValidationError(
      buildEnv({
        GOALS_API_BASE_URL: 'not-a-url',
        HTTP_TIMEOUT_MS: '0',
        BOT_MODE: 'invalid',
      })
    );

    expect(configError.fields).toEqual(expect.arrayContaining(['GOALS_API_BASE_URL', 'HTTP_TIMEOUT_MS', 'BOT_MODE']));
    expect(configError.issues.join(' ')).toContain('GOALS_API_BASE_URL');
    expect(configError.issues.join(' ')).toContain('HTTP_TIMEOUT_MS');
    expect(configError.issues.join(' ')).toContain('BOT_MODE');
  });

  it('does not require webhook vars when BOT_MODE=polling', () => {
    const config = loadConfig(buildEnv({ BOT_MODE: 'polling' }));

    expect(config.BOT_MODE).toBe('polling');
    expect(config.BOT_WEBHOOK_PUBLIC_URL).toBeUndefined();
    expect(config.BOT_WEBHOOK_SECRET_PATH).toBeUndefined();
  });

  it('requires BOT_WEBHOOK_PUBLIC_URL and BOT_WEBHOOK_SECRET_PATH when BOT_MODE=webhook', () => {
    const configError = getConfigValidationError(buildEnv({ BOT_MODE: 'webhook' }));

    expect(configError.fields).toEqual(expect.arrayContaining(['BOT_WEBHOOK_PUBLIC_URL', 'BOT_WEBHOOK_SECRET_PATH']));
    expect(configError.issues.join(' ')).toContain('BOT_WEBHOOK_PUBLIC_URL');
    expect(configError.issues.join(' ')).toContain('BOT_WEBHOOK_SECRET_PATH');
  });

  it('parses BOT_MODE=webhook with valid webhook vars', () => {
    const config = loadConfig(
      buildEnv({
        BOT_MODE: 'webhook',
        BOT_WEBHOOK_PORT: '9090',
        BOT_WEBHOOK_PUBLIC_URL: 'https://bot.example.com',
        BOT_WEBHOOK_SECRET_PATH: '/tg/abc123',
      })
    );

    expect(config.BOT_MODE).toBe('webhook');
    expect(config.BOT_WEBHOOK_PORT).toBe(9090);
    expect(config.BOT_WEBHOOK_PUBLIC_URL).toBe('https://bot.example.com');
    expect(config.BOT_WEBHOOK_SECRET_PATH).toBe('/tg/abc123');
  });

  it('applies default BOT_WEBHOOK_PORT when omitted in webhook mode', () => {
    const config = loadConfig(
      buildEnv({
        BOT_MODE: 'webhook',
        BOT_WEBHOOK_PUBLIC_URL: 'https://bot.example.com',
        BOT_WEBHOOK_SECRET_PATH: '/tg/abc123',
      })
    );

    expect(config.BOT_WEBHOOK_PORT).toBe(8080);
  });

  it('rejects invalid BOT_WEBHOOK_PORT', () => {
    const configError = getConfigValidationError(buildEnv({ BOT_WEBHOOK_PORT: 'abc' }));

    expect(configError.fields).toContain('BOT_WEBHOOK_PORT');
    expect(configError.issues.join(' ')).toContain('BOT_WEBHOOK_PORT');
  });

  it('rejects BOT_WEBHOOK_SECRET_PATH that does not start with "/"', () => {
    const configError = getConfigValidationError(
      buildEnv({
        BOT_MODE: 'webhook',
        BOT_WEBHOOK_PUBLIC_URL: 'https://bot.example.com',
        BOT_WEBHOOK_SECRET_PATH: 'tg/no-slash',
      })
    );

    expect(configError.fields).toContain('BOT_WEBHOOK_SECRET_PATH');
    expect(configError.issues.join(' ')).toContain('BOT_WEBHOOK_SECRET_PATH');
  });

  it('rejects invalid BOT_WEBHOOK_PUBLIC_URL', () => {
    const configError = getConfigValidationError(
      buildEnv({
        BOT_MODE: 'webhook',
        BOT_WEBHOOK_PUBLIC_URL: 'not-a-url',
        BOT_WEBHOOK_SECRET_PATH: '/tg',
      })
    );

    expect(configError.fields).toContain('BOT_WEBHOOK_PUBLIC_URL');
    expect(configError.issues.join(' ')).toContain('BOT_WEBHOOK_PUBLIC_URL');
  });
});
