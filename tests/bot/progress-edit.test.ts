import { describe, expect, it } from 'vitest';

import type { GoalsApiFetch } from '../../src/api/client';
import {
  buildTextUpdate,
  expectAuthHeaders,
  GOAL_DETAILS_ID,
  jsonResponse,
  PROGRESS_EDIT_NOT_FOUND_MESSAGE,
  PROGRESS_EDIT_NOTHING_TO_UPDATE_MESSAGE,
  PROGRESS_EVENT_ID,
  runBotScenario,
  TEST_CHAT_ID,
} from './helpers';

describe('/progress_edit', () => {
  it('calls PATCH /goals/{goalId}/progress/{eventId} and returns updated event', async () => {
    const goalsApiFetch: GoalsApiFetch = async () =>
      jsonResponse({
        id: PROGRESS_EVENT_ID,
        goal_id: GOAL_DETAILS_ID,
        date: '2026-04-20',
        delta_value: 3.5,
        note: 'Fix typo',
        created_at: '2026-04-20T12:00:00.000Z',
        updated_at: '2026-04-21T09:00:00.000Z',
      });

    const { goalsRequests, sendMessagePayload } = await runBotScenario({
      goalsApiFetch,
      update: buildTextUpdate(
        `/progress_edit goal=${GOAL_DETAILS_ID} event=${PROGRESS_EVENT_ID} delta=3.5 date=2026-04-20 note="Fix typo"`
      ),
    });

    expect(goalsRequests).toHaveLength(1);
    const request = goalsRequests[0];
    expect(request.method).toBe('PATCH');
    expect(new URL(request.url).pathname).toBe(`/goals/${GOAL_DETAILS_ID}/progress/${PROGRESS_EVENT_ID}`);
    expectAuthHeaders(request);
    expect(await request.clone().json()).toEqual({
      delta_value: 3.5,
      date: '2026-04-20',
      note: 'Fix typo',
    });

    expect(sendMessagePayload.chat_id).toBe(TEST_CHAT_ID);
    expect(sendMessagePayload.text).toContain('Progress event updated:');
    expect(sendMessagePayload.text).toContain(`id: ${PROGRESS_EVENT_ID}`);
    expect(sendMessagePayload.text).toContain('delta_value: 3.5');
    expect(sendMessagePayload.text).toContain('note: Fix typo');
  });

  it('returns nothing-to-update message and does not call API when no optional fields are provided', async () => {
    const { goalsRequests, sendMessagePayload } = await runBotScenario({
      update: buildTextUpdate(`/progress_edit goal=${GOAL_DETAILS_ID} event=${PROGRESS_EVENT_ID}`),
    });

    expect(goalsRequests).toHaveLength(0);
    expect(sendMessagePayload).toMatchObject({
      chat_id: TEST_CHAT_ID,
      text: PROGRESS_EDIT_NOTHING_TO_UPDATE_MESSAGE,
    });
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
      update: buildTextUpdate(`/progress_edit goal=${GOAL_DETAILS_ID} event=${PROGRESS_EVENT_ID} delta=2`),
    });

    expect(sendMessagePayload).toMatchObject({
      chat_id: TEST_CHAT_ID,
      text: PROGRESS_EDIT_NOT_FOUND_MESSAGE,
    });
  });
});
