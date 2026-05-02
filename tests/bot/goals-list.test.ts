import { describe, expect, it } from 'vitest';

import type { GoalsApiFetch } from '../../src/api/client';
import {
  buildTextUpdate,
  expectAuthHeaders,
  GOALS_LIST_AUTH_ERROR_MESSAGE,
  GOALS_LIST_EMPTY_MESSAGE,
  GOALS_LIST_NOT_FOUND_MESSAGE,
  jsonResponse,
  runBotScenario,
  TEST_CHAT_ID,
} from './helpers';

describe('/goals list', () => {
  it('calls GET /goals and renders summary fields with inline keyboard', async () => {
    const goalsApiFetch: GoalsApiFetch = async () =>
      jsonResponse({
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

    const { goalsRequests, sendMessagePayload } = await runBotScenario({
      goalsApiFetch,
      update: buildTextUpdate('/goals'),
    });

    expect(goalsRequests).toHaveLength(1);
    const request = goalsRequests[0];
    expect(request.method).toBe('GET');
    expect(new URL(request.url).pathname).toBe('/goals');
    expectAuthHeaders(request);

    expect(sendMessagePayload.chat_id).toBe(TEST_CHAT_ID);
    expect(sendMessagePayload.text).toContain('title: Read Clean Code');
    expect(sendMessagePayload.text).toContain('percent_complete: 42.5');
    expect(sendMessagePayload.text).toContain('days_left: 20');
    expect(sendMessagePayload.text).toContain('pace_current_7d: 18.25');
    expect(sendMessagePayload.text).toContain('title: Run 120 km');
    expect(sendMessagePayload.text).toContain('percent_complete: 55');
    expect(sendMessagePayload.text).toContain('days_left: 14');
    expect(sendMessagePayload.text).toContain('pace_current_7d: 6.5');
    expect(sendMessagePayload.reply_markup?.inline_keyboard).toEqual([
      [
        {
          text: '/goal title="Read Clean Code"',
          callback_data: 'goal_details:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        },
      ],
      [
        {
          text: '/goal title="Run 120 km"',
          callback_data: 'goal_details:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        },
      ],
    ]);
    expect(sendMessagePayload.reply_markup?.keyboard).toBeUndefined();
  });

  it('returns dedicated empty-state message when list is empty', async () => {
    const { sendMessagePayload } = await runBotScenario({
      goalsApiFetch: async () => jsonResponse({ items: [] }),
      update: buildTextUpdate('/goals'),
    });

    expect(sendMessagePayload).toMatchObject({
      chat_id: TEST_CHAT_ID,
      text: GOALS_LIST_EMPTY_MESSAGE,
    });
    expect(sendMessagePayload.reply_markup).toBeUndefined();
  });

  it('returns mapped technical message when API fails with 401', async () => {
    const goalsApiFetch: GoalsApiFetch = async () =>
      jsonResponse(
        {
          code: 'unauthorized',
          message: 'service token invalid',
        },
        401
      );

    const { sendMessagePayload } = await runBotScenario({
      goalsApiFetch,
      update: buildTextUpdate('/goals'),
    });

    expect(sendMessagePayload).toMatchObject({
      chat_id: TEST_CHAT_ID,
      text: GOALS_LIST_AUTH_ERROR_MESSAGE,
    });
  });

  it('returns mapped not-found message when API fails with 404', async () => {
    const goalsApiFetch: GoalsApiFetch = async () =>
      jsonResponse(
        {
          code: 'user_not_found',
          message: 'user not found',
        },
        404
      );

    const { sendMessagePayload } = await runBotScenario({
      goalsApiFetch,
      update: buildTextUpdate('/goals'),
    });

    expect(sendMessagePayload).toMatchObject({
      chat_id: TEST_CHAT_ID,
      text: GOALS_LIST_NOT_FOUND_MESSAGE,
    });
  });
});
