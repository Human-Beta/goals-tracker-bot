import { describe, expect, it } from 'vitest';

import type { GoalsApiFetch } from '../../src/api/client';
import {
  buildGoalDetailResponse,
  buildTextUpdate,
  expectAuthHeaders,
  GOAL_DETAILS_ID,
  GOALS_LIST_FALLBACK_MESSAGE,
  jsonResponse,
  PROGRESS_EVENT_ID,
  runBotScenario,
  TEST_CHAT_ID,
} from './helpers';

describe('Recommended scenarios (docs/technical/testing.md)', () => {
  describe('happy path: create goal -> add progress -> show metrics', () => {
    it('creates goal, records progress, then renders metrics across three updates', async () => {
      const createGoalFetch: GoalsApiFetch = async () =>
        jsonResponse(
          {
            id: GOAL_DETAILS_ID,
            user_id: '11111111-1111-4111-8111-111111111111',
            title: 'Read Clean Code',
            unit: 'pages',
            target_value: 464,
            start_date: '2026-05-03',
            end_date: '2026-12-31',
            status: 'active',
            created_at: '2026-05-03T12:00:00.000Z',
            updated_at: '2026-05-03T12:00:00.000Z',
          },
          201
        );

      const createResult = await runBotScenario({
        goalsApiFetch: createGoalFetch,
        update: buildTextUpdate('/goal_create title="Read Clean Code" unit=pages target=464 end=2026-12-31'),
      });

      expect(createResult.goalsRequests).toHaveLength(1);
      const createRequest = createResult.goalsRequests[0];
      expect(createRequest.method).toBe('POST');
      expect(new URL(createRequest.url).pathname).toBe('/goals');
      expect(await createRequest.clone().json()).toEqual({
        title: 'Read Clean Code',
        unit: 'pages',
        target_value: 464,
        end_date: '2026-12-31',
      });
      expect(createResult.sendMessagePayload.chat_id).toBe(TEST_CHAT_ID);
      expect(createResult.sendMessagePayload.text).toContain(`id: ${GOAL_DETAILS_ID}`);
      expect(createResult.sendMessagePayload.text).toContain('title: Read Clean Code');
      expect(createResult.sendMessagePayload.text).toContain('target: 464');
      expect(createResult.sendMessagePayload.text).toContain('end_date: 2026-12-31');

      const addProgressFetch: GoalsApiFetch = async () =>
        jsonResponse(
          {
            id: PROGRESS_EVENT_ID,
            goal_id: GOAL_DETAILS_ID,
            date: '2026-05-03',
            delta_value: 10,
            created_at: '2026-05-03T13:00:00.000Z',
            updated_at: '2026-05-03T13:00:00.000Z',
          },
          201
        );

      const addResult = await runBotScenario({
        goalsApiFetch: addProgressFetch,
        update: buildTextUpdate(`/progress_add goal=${GOAL_DETAILS_ID} delta=10 date=2026-05-03`),
      });

      expect(addResult.goalsRequests).toHaveLength(1);
      const addRequest = addResult.goalsRequests[0];
      expect(addRequest.method).toBe('POST');
      expect(new URL(addRequest.url).pathname).toBe(`/goals/${GOAL_DETAILS_ID}/progress`);
      expect(await addRequest.clone().json()).toEqual({
        delta_value: 10,
        date: '2026-05-03',
      });
      expect(addResult.sendMessagePayload.chat_id).toBe(TEST_CHAT_ID);
      expect(addResult.sendMessagePayload.text).toContain('Progress recorded:');
      expect(addResult.sendMessagePayload.text).toContain(`id: ${PROGRESS_EVENT_ID}`);
      expect(addResult.sendMessagePayload.text).toContain('delta_value: 10');

      const metricsFetch: GoalsApiFetch = async () =>
        jsonResponse(
          buildGoalDetailResponse({
            percent_complete: 2.16,
            current_value: 10,
            remaining_value: 454,
          })
        );

      const metricsResult = await runBotScenario({
        goalsApiFetch: metricsFetch,
        update: buildTextUpdate(`/goal id=${GOAL_DETAILS_ID}`),
      });

      expect(metricsResult.goalsRequests).toHaveLength(1);
      const metricsRequest = metricsResult.goalsRequests[0];
      expect(metricsRequest.method).toBe('GET');
      expect(new URL(metricsRequest.url).pathname).toBe(`/goals/${GOAL_DETAILS_ID}`);
      expect(metricsResult.sendMessagePayload.chat_id).toBe(TEST_CHAT_ID);
      expect(metricsResult.sendMessagePayload.text).toContain('percent_complete: 2.2');
      expect(metricsResult.sendMessagePayload.text).toContain('current_value: 10');
      expect(metricsResult.sendMessagePayload.text).toContain('remaining_value: 454');
    });
  });

  describe('transient failure: retry then fallback', () => {
    it('retries 3 times on 5xx then sends fallback message via /goals', async () => {
      let callCount = 0;
      const goalsApiFetch: GoalsApiFetch = async () => {
        callCount += 1;
        return jsonResponse({ code: 'internal_error', message: 'upstream down' }, 503);
      };

      const { goalsRequests, sendMessagePayload } = await runBotScenario({
        goalsApiFetch,
        update: buildTextUpdate('/goals'),
      });

      // DEFAULT_RETRY_MAX_ATTEMPTS in src/api/client.ts is 3.
      expect(callCount).toBe(3);
      expect(goalsRequests).toHaveLength(3);
      for (const request of goalsRequests) {
        expect(request.method).toBe('GET');
        expect(new URL(request.url).pathname).toBe('/goals');
        expectAuthHeaders(request);
      }

      // GOALS_LIST_FALLBACK_MESSAGE ("Temporary issue while…") is the transient/fallback path.
      // It differs from GOALS_LIST_AUTH_ERROR_MESSAGE ("Temporary technical issue while…"), which
      // is the 401 path; do not conflate the two.
      expect(sendMessagePayload).toMatchObject({
        chat_id: TEST_CHAT_ID,
        text: GOALS_LIST_FALLBACK_MESSAGE,
      });
    });
  });

  describe('identity propagation', () => {
    it('sends X-Telegram-User-Id and Authorization on a user-scoped GET', async () => {
      const goalsApiFetch: GoalsApiFetch = async () => jsonResponse({ items: [] });

      const { goalsRequests } = await runBotScenario({
        goalsApiFetch,
        update: buildTextUpdate('/goals'),
      });

      expect(goalsRequests).toHaveLength(1);
      const request = goalsRequests[0];
      expect(request.method).toBe('GET');
      expect(new URL(request.url).pathname).toBe('/goals');
      expectAuthHeaders(request);
    });
  });
});
