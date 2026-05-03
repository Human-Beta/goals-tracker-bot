import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { GoalsApiFetch } from '../src/api/client';
import { CORRELATION_ID_HEADER } from '../src/api/client';
import { UUID_PATTERN } from '../src/shared/patterns';
import {
  buildTextUpdate,
  captureLogs,
  jsonResponse,
  parseStructuredLogs,
  runBotScenario,
  TEST_CONFIG,
  type LogCapture,
} from './bot/helpers';

describe('observability', () => {
  let capture: LogCapture;

  beforeEach(() => {
    capture = captureLogs();
  });

  afterEach(() => {
    capture.restore();
  });

  it('emits update_received and update_completed with shared correlation_id for /ping', async () => {
    await runBotScenario({ update: buildTextUpdate('/ping') });

    const events = parseStructuredLogs(capture);
    const received = events.find(e => e.event === 'update_received');
    const completed = events.find(e => e.event === 'update_completed');

    expect(received).toBeDefined();
    expect(completed).toBeDefined();
    expect(received?.fields).toMatchObject({
      update_id: 1,
      kind: 'message_text',
      command_name: 'ping',
    });
    expect(received?.fields.correlation_id).toMatch(UUID_PATTERN);
    expect(completed?.fields).toMatchObject({
      update_id: 1,
      command_name: 'ping',
      outcome: 'success',
    });
    expect(completed?.fields.correlation_id).toBe(received?.fields.correlation_id);
    expect(typeof completed?.fields.duration_ms).toBe('number');
  });

  it('propagates correlation_id from update log into outbound API request header', async () => {
    const goalsApiFetch: GoalsApiFetch = async () =>
      jsonResponse({
        user_id: '11111111-1111-4111-8111-111111111111',
        telegram_user_id: 12345,
        timezone: 'Europe/Kyiv',
      });

    const { goalsRequests } = await runBotScenario({
      goalsApiFetch,
      update: buildTextUpdate('/start timezone=Europe/Kyiv'),
    });

    const events = parseStructuredLogs(capture);
    const received = events.find(e => e.event === 'update_received');
    const apiCompleted = events.find(e => e.event === 'api_request_completed');
    const correlationId = received?.fields.correlation_id;

    expect(correlationId).toMatch(UUID_PATTERN);
    expect(goalsRequests).toHaveLength(1);
    expect(goalsRequests[0].headers.get(CORRELATION_ID_HEADER)).toBe(correlationId);
    expect(apiCompleted?.fields).toMatchObject({
      correlation_id: correlationId,
      method: 'POST',
      path: '/bot/users/upsert',
      status: 200,
      attempts: 1,
      outcome: 'success',
    });
    expect(typeof apiCompleted?.fields.duration_ms).toBe('number');
  });

  it('logs api_request_retry then api_request_completed with attempts=2 for 5xx then 200', async () => {
    const responses = [
      jsonResponse({ code: 'internal_error' }, 500),
      jsonResponse({
        user_id: '11111111-1111-4111-8111-111111111111',
        telegram_user_id: 12345,
        timezone: 'Europe/Kyiv',
      }),
    ];
    const goalsApiFetch: GoalsApiFetch = async () => responses.shift() ?? jsonResponse({}, 500);

    await runBotScenario({
      goalsApiFetch,
      update: buildTextUpdate('/start timezone=Europe/Kyiv'),
    });

    const events = parseStructuredLogs(capture);
    const retries = events.filter(e => e.event === 'api_request_retry');
    const apiCompleted = events.find(e => e.event === 'api_request_completed');

    expect(retries).toHaveLength(1);
    expect(retries[0].fields).toMatchObject({
      method: 'POST',
      path: '/bot/users/upsert',
      attempt: 1,
      status: 500,
    });
    expect(apiCompleted?.fields).toMatchObject({
      method: 'POST',
      path: '/bot/users/upsert',
      attempts: 2,
      status: 200,
      outcome: 'success',
    });
  });

  it('logs api_request_completed outcome=error and api_error_unmapped on exhausted 5xx', async () => {
    const goalsApiFetch: GoalsApiFetch = async () => jsonResponse({ code: 'internal_error' }, 500);

    await runBotScenario({
      goalsApiFetch,
      update: buildTextUpdate('/start timezone=Europe/Kyiv'),
    });

    const events = parseStructuredLogs(capture);
    const apiCompleted = events.find(e => e.event === 'api_request_completed');
    const unmapped = events.find(e => e.event === 'api_error_unmapped');

    expect(apiCompleted?.fields).toMatchObject({
      outcome: 'error',
      attempts: 3,
      status: 500,
      error_name: 'TransientUpstreamError',
    });
    expect(unmapped?.fields).toMatchObject({
      context: 'failed to upsert user on /start',
      error_name: 'TransientUpstreamError',
      error_code: 'TRANSIENT_UPSTREAM_ERROR',
      status: 500,
    });
    expect(unmapped?.fields.correlation_id).toBe(apiCompleted?.fields.correlation_id);
  });

  it('does not leak service token, bearer header, or telegram bot token into logs', async () => {
    const goalsApiFetch: GoalsApiFetch = async () =>
      jsonResponse({
        user_id: '11111111-1111-4111-8111-111111111111',
        telegram_user_id: 12345,
        timezone: 'Europe/Kyiv',
      });

    await runBotScenario({
      goalsApiFetch,
      update: buildTextUpdate('/start timezone=Europe/Kyiv'),
    });

    const allLogs = capture.joined();
    expect(allLogs).not.toContain(TEST_CONFIG.GOALS_API_SERVICE_TOKEN);
    expect(allLogs).not.toContain(TEST_CONFIG.TELEGRAM_BOT_TOKEN);
    expect(allLogs).not.toContain('Bearer ');
    expect(allLogs).not.toContain('Authorization');
  });
});
