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
});
