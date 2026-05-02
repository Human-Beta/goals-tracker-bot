import { describe, expect, it } from 'vitest';

import type { GoalsApiFetch } from '../../src/api/client';
import {
  buildTextUpdate,
  expectAuthHeaders,
  GOAL_DETAILS_ID,
  jsonResponse,
  PROGRESS_DELETE_NOT_FOUND_MESSAGE,
  PROGRESS_DELETE_SUCCESS_MESSAGE,
  PROGRESS_EVENT_ID,
  runBotScenario,
  TEST_CHAT_ID,
} from './helpers';

describe('/progress_delete', () => {
  it('calls DELETE /goals/{goalId}/progress/{eventId} when confirm=yes', async () => {
    const goalsApiFetch: GoalsApiFetch = async () => new Response(null, { status: 204 });

    const { goalsRequests, sendMessagePayload } = await runBotScenario({
      goalsApiFetch,
      update: buildTextUpdate(`/progress_delete goal=${GOAL_DETAILS_ID} event=${PROGRESS_EVENT_ID} confirm=yes`),
    });

    expect(goalsRequests).toHaveLength(1);
    const request = goalsRequests[0];
    expect(request.method).toBe('DELETE');
    expect(new URL(request.url).pathname).toBe(`/goals/${GOAL_DETAILS_ID}/progress/${PROGRESS_EVENT_ID}`);
    expectAuthHeaders(request);

    expect(sendMessagePayload).toMatchObject({
      chat_id: TEST_CHAT_ID,
      text: PROGRESS_DELETE_SUCCESS_MESSAGE,
    });
  });

  it('rejects request without confirm=yes and does not call API', async () => {
    const { goalsRequests, sendMessagePayload } = await runBotScenario({
      update: buildTextUpdate(`/progress_delete goal=${GOAL_DETAILS_ID} event=${PROGRESS_EVENT_ID}`),
    });

    expect(goalsRequests).toHaveLength(0);
    expect(sendMessagePayload.chat_id).toBe(TEST_CHAT_ID);
    expect(sendMessagePayload.text).toContain('Invalid command format');
    expect(sendMessagePayload.text).toContain('missing required argument "confirm"');
    expect(sendMessagePayload.text).toContain('/progress_delete goal=<uuid> event=<uuid> confirm=yes');
  });

  it('returns not-found message when API fails with 404', async () => {
    const goalsApiFetch: GoalsApiFetch = async () =>
      jsonResponse(
        {
          code: 'event_not_found',
          message: 'event not found',
        },
        404
      );

    const { sendMessagePayload } = await runBotScenario({
      goalsApiFetch,
      update: buildTextUpdate(`/progress_delete goal=${GOAL_DETAILS_ID} event=${PROGRESS_EVENT_ID} confirm=yes`),
    });

    expect(sendMessagePayload).toMatchObject({
      chat_id: TEST_CHAT_ID,
      text: PROGRESS_DELETE_NOT_FOUND_MESSAGE,
    });
  });
});
