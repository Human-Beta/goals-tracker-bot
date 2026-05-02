import { describe, expect, it } from 'vitest';

import type { GoalsApiFetch } from '../../src/api/client';
import {
  buildTextUpdate,
  expectAuthHeaders,
  GOAL_DETAILS_ID,
  jsonResponse,
  PROGRESS_ADD_NOT_FOUND_MESSAGE,
  PROGRESS_EVENT_ID,
  runBotScenario,
  TEST_CHAT_ID,
} from './helpers';

describe('/progress_add', () => {
  it('calls POST /goals/{goalId}/progress and returns event details', async () => {
    const goalsApiFetch: GoalsApiFetch = async () =>
      jsonResponse(
        {
          id: PROGRESS_EVENT_ID,
          goal_id: GOAL_DETAILS_ID,
          date: '2026-05-02',
          delta_value: 2.5,
          note: 'ran 5k',
          created_at: '2026-05-02T12:00:00.000Z',
          updated_at: '2026-05-02T12:00:00.000Z',
        },
        201
      );

    const { goalsRequests, sendMessagePayload } = await runBotScenario({
      goalsApiFetch,
      update: buildTextUpdate(`/progress_add goal=${GOAL_DETAILS_ID} delta=2.5 date=2026-05-02 note="ran 5k"`),
    });

    expect(goalsRequests).toHaveLength(1);
    const request = goalsRequests[0];
    expect(request.method).toBe('POST');
    expect(new URL(request.url).pathname).toBe(`/goals/${GOAL_DETAILS_ID}/progress`);
    expectAuthHeaders(request);
    expect(await request.clone().json()).toEqual({
      delta_value: 2.5,
      date: '2026-05-02',
      note: 'ran 5k',
    });

    expect(sendMessagePayload.chat_id).toBe(TEST_CHAT_ID);
    expect(sendMessagePayload.text).toContain('Progress recorded:');
    expect(sendMessagePayload.text).toContain(`id: ${PROGRESS_EVENT_ID}`);
    expect(sendMessagePayload.text).toContain('delta_value: 2.5');
  });

  it('returns format validation message and does not call API for invalid payload', async () => {
    const { goalsRequests, sendMessagePayload } = await runBotScenario({
      update: buildTextUpdate(`/progress_add goal=${GOAL_DETAILS_ID} delta=abc`),
    });

    expect(goalsRequests).toHaveLength(0);
    expect(sendMessagePayload.chat_id).toBe(TEST_CHAT_ID);
    expect(sendMessagePayload.text).toContain('Invalid command format');
    expect(sendMessagePayload.text).toContain('argument "delta" must be a valid number');
    expect(sendMessagePayload.text).toContain('/progress_add goal=<uuid> delta=<number>');
  });

  it('returns not-found message when API fails with 404', async () => {
    const goalsApiFetch: GoalsApiFetch = async () =>
      jsonResponse(
        {
          code: 'goal_not_found',
          message: 'goal not found',
        },
        404
      );

    const { sendMessagePayload } = await runBotScenario({
      goalsApiFetch,
      update: buildTextUpdate(`/progress_add goal=${GOAL_DETAILS_ID} delta=1`),
    });

    expect(sendMessagePayload).toMatchObject({
      chat_id: TEST_CHAT_ID,
      text: PROGRESS_ADD_NOT_FOUND_MESSAGE,
    });
  });
});
