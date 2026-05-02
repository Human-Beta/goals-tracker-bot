import { describe, expect, it } from 'vitest';

import type { GoalsApiFetch } from '../../src/api/client';
import {
  buildTextUpdate,
  expectAuthHeaders,
  jsonResponse,
  runBotScenario,
  TEST_CHAT_ID,
  USER_TIMEZONE_HINT,
} from './helpers';

describe('/start', () => {
  it('calls upsert endpoint and confirms saved timezone', async () => {
    const goalsApiFetch: GoalsApiFetch = async () =>
      jsonResponse({
        user_id: '11111111-1111-4111-8111-111111111111',
        telegram_user_id: 12345,
        timezone: 'Europe/Kyiv',
      });

    const { goalsRequests, sendMessagePayload } = await runBotScenario({
      goalsApiFetch,
      update: buildTextUpdate('/start timezone=Europe/Kyiv'),
    });

    expect(goalsRequests).toHaveLength(1);
    const request = goalsRequests[0];
    expect(request.method).toBe('POST');
    expect(new URL(request.url).pathname).toBe('/bot/users/upsert');
    expectAuthHeaders(request);
    expect(await request.clone().json()).toEqual({
      telegram_user_id: 12345,
      timezone: 'Europe/Kyiv',
    });

    expect(sendMessagePayload).toMatchObject({
      chat_id: TEST_CHAT_ID,
      text: 'You are all set. Timezone saved: Europe/Kyiv.',
    });
  });

  it('returns timezone hint when upsert fails with 400', async () => {
    const goalsApiFetch: GoalsApiFetch = async () =>
      jsonResponse(
        {
          code: 'validation_error',
          message: 'timezone is invalid',
        },
        400
      );

    const { sendMessagePayload } = await runBotScenario({
      goalsApiFetch,
      update: buildTextUpdate('/start timezone=Europe/Kyiv'),
    });

    expect(sendMessagePayload).toMatchObject({
      chat_id: TEST_CHAT_ID,
      text: USER_TIMEZONE_HINT,
    });
  });

  it.each(['/start', '/start timezone=Invalid/Timezone'])(
    'returns timezone hint when payload is invalid: %s',
    async command => {
      const { goalsRequests, sendMessagePayload } = await runBotScenario({
        update: buildTextUpdate(command),
      });

      expect(goalsRequests).toHaveLength(0);
      expect(sendMessagePayload).toMatchObject({
        chat_id: TEST_CHAT_ID,
        text: USER_TIMEZONE_HINT,
      });
    }
  );
});
