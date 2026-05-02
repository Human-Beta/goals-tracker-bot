import { describe, expect, it } from 'vitest';

import type { GoalsApiFetch } from '../../src/api/client';
import {
  buildTextUpdate,
  expectAuthHeaders,
  GOAL_DETAILS_ID,
  jsonResponse,
  PROGRESS_EVENT_ID,
  PROGRESS_EVENT_ID_2,
  PROGRESS_LIST_EMPTY_MESSAGE,
  runBotScenario,
  TEST_CHAT_ID,
} from './helpers';

describe('/progress_list', () => {
  it('calls GET /goals/{goalId}/progress and renders events', async () => {
    const goalsApiFetch: GoalsApiFetch = async () =>
      jsonResponse({
        items: [
          {
            id: PROGRESS_EVENT_ID,
            goal_id: GOAL_DETAILS_ID,
            date: '2026-04-15',
            delta_value: 1.5,
            note: 'morning run',
            created_at: '2026-04-15T08:00:00.000Z',
            updated_at: '2026-04-15T08:00:00.000Z',
          },
          {
            id: PROGRESS_EVENT_ID_2,
            goal_id: GOAL_DETAILS_ID,
            date: '2026-04-20',
            delta_value: 3,
            note: null,
            created_at: '2026-04-20T08:00:00.000Z',
            updated_at: '2026-04-20T08:00:00.000Z',
          },
        ],
      });

    const { goalsRequests, sendMessagePayload } = await runBotScenario({
      goalsApiFetch,
      update: buildTextUpdate(`/progress_list goal=${GOAL_DETAILS_ID}`),
    });

    expect(goalsRequests).toHaveLength(1);
    const request = goalsRequests[0];
    expect(request.method).toBe('GET');
    const requestUrl = new URL(request.url);
    expect(requestUrl.pathname).toBe(`/goals/${GOAL_DETAILS_ID}/progress`);
    expect(requestUrl.searchParams.get('from')).toBeNull();
    expect(requestUrl.searchParams.get('to')).toBeNull();
    expect(requestUrl.searchParams.get('sort')).toBeNull();
    expectAuthHeaders(request);

    expect(sendMessagePayload.chat_id).toBe(TEST_CHAT_ID);
    expect(sendMessagePayload.text).toContain('Progress history:');
    expect(sendMessagePayload.text).toContain(`event_id: ${PROGRESS_EVENT_ID}`);
    expect(sendMessagePayload.text).toContain(`event_id: ${PROGRESS_EVENT_ID_2}`);
    expect(sendMessagePayload.text).toContain('delta_value: 1.5');
    expect(sendMessagePayload.text).toContain('delta_value: 3');
    expect(sendMessagePayload.text).toContain('note: morning run');
    const eventTwoSection = sendMessagePayload.text.split(`event_id: ${PROGRESS_EVENT_ID_2}`)[1] ?? '';
    expect(eventTwoSection).not.toContain('note:');
  });

  it('forwards from and to query params', async () => {
    const goalsApiFetch: GoalsApiFetch = async () =>
      jsonResponse({
        items: [
          {
            id: PROGRESS_EVENT_ID,
            goal_id: GOAL_DETAILS_ID,
            date: '2026-04-15',
            delta_value: 1.5,
            note: 'morning run',
            created_at: '2026-04-15T08:00:00.000Z',
            updated_at: '2026-04-15T08:00:00.000Z',
          },
        ],
      });

    const { goalsRequests, sendMessagePayload } = await runBotScenario({
      goalsApiFetch,
      update: buildTextUpdate(`/progress_list goal=${GOAL_DETAILS_ID} from=2026-04-01 to=2026-05-01`),
    });

    expect(goalsRequests).toHaveLength(1);
    const requestUrl = new URL(goalsRequests[0].url);
    expect(requestUrl.pathname).toBe(`/goals/${GOAL_DETAILS_ID}/progress`);
    expect(requestUrl.searchParams.get('from')).toBe('2026-04-01');
    expect(requestUrl.searchParams.get('to')).toBe('2026-05-01');
    expect(requestUrl.searchParams.get('sort')).toBeNull();

    expect(sendMessagePayload.text).toContain(`event_id: ${PROGRESS_EVENT_ID}`);
  });

  it('forwards sort=desc', async () => {
    const goalsApiFetch: GoalsApiFetch = async () =>
      jsonResponse({
        items: [
          {
            id: PROGRESS_EVENT_ID_2,
            goal_id: GOAL_DETAILS_ID,
            date: '2026-04-20',
            delta_value: 3,
            note: null,
            created_at: '2026-04-20T08:00:00.000Z',
            updated_at: '2026-04-20T08:00:00.000Z',
          },
          {
            id: PROGRESS_EVENT_ID,
            goal_id: GOAL_DETAILS_ID,
            date: '2026-04-15',
            delta_value: 1.5,
            note: 'morning run',
            created_at: '2026-04-15T08:00:00.000Z',
            updated_at: '2026-04-15T08:00:00.000Z',
          },
        ],
      });

    const { goalsRequests, sendMessagePayload } = await runBotScenario({
      goalsApiFetch,
      update: buildTextUpdate(`/progress_list goal=${GOAL_DETAILS_ID} sort=desc`),
    });

    expect(goalsRequests).toHaveLength(1);
    expect(new URL(goalsRequests[0].url).searchParams.get('sort')).toBe('desc');

    const firstEventIndex = sendMessagePayload.text.indexOf(`event_id: ${PROGRESS_EVENT_ID_2}`);
    const secondEventIndex = sendMessagePayload.text.indexOf(`event_id: ${PROGRESS_EVENT_ID}`);
    expect(firstEventIndex).toBeGreaterThan(-1);
    expect(secondEventIndex).toBeGreaterThan(firstEventIndex);
  });

  it('returns empty-state message when no events match', async () => {
    const { sendMessagePayload } = await runBotScenario({
      goalsApiFetch: async () => jsonResponse({ items: [] }),
      update: buildTextUpdate(`/progress_list goal=${GOAL_DETAILS_ID} from=2026-04-01 to=2026-04-02`),
    });

    expect(sendMessagePayload).toMatchObject({
      chat_id: TEST_CHAT_ID,
      text: PROGRESS_LIST_EMPTY_MESSAGE,
    });
  });
});
