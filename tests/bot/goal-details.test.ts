import { describe, expect, it } from 'vitest';

import type { GoalsApiFetch } from '../../src/api/client';
import {
  buildGoalDetailResponse,
  buildGoalDetailsCallbackUpdate,
  buildTextUpdate,
  expectAuthHeaders,
  GOAL_DETAILS_ETA_NULL_EXPLANATION,
  GOAL_DETAILS_ID,
  jsonResponse,
  runBotScenario,
  TEST_CHAT_ID,
} from './helpers';

describe('/goal details', () => {
  it('calls GET /goals/{goalId} and renders metrics from API response', async () => {
    const expectedGoalDetail = buildGoalDetailResponse({
      percent_complete: 42.5,
      current_value: 197,
      remaining_value: 267,
      days_left: 19,
      pace_current_7d: 13.25,
      pace_required_per_day: 14.05,
      eta_date: '2026-03-30',
      behind_value: 11.5,
    });

    const { goalsRequests, sendMessagePayload } = await runBotScenario({
      goalsApiFetch: async () => jsonResponse(expectedGoalDetail),
      update: buildTextUpdate(`/goal id=${GOAL_DETAILS_ID}`),
    });

    expect(goalsRequests).toHaveLength(1);
    const request = goalsRequests[0];
    expect(request.method).toBe('GET');
    expect(new URL(request.url).pathname).toBe(`/goals/${GOAL_DETAILS_ID}`);
    expectAuthHeaders(request);

    expect(sendMessagePayload.chat_id).toBe(TEST_CHAT_ID);
    expect(sendMessagePayload.text).toContain('percent_complete: 42.5');
    expect(sendMessagePayload.text).toContain('current_value: 197');
    expect(sendMessagePayload.text).toContain('remaining_value: 267');
    expect(sendMessagePayload.text).toContain('days_left: 19');
    expect(sendMessagePayload.text).toContain('pace_current_7d: 13.3');
    expect(sendMessagePayload.text).toContain('pace_required_per_day: 14.1');
    expect(sendMessagePayload.text).toContain('eta_date: 2026-03-30');
    expect(sendMessagePayload.text).toContain('behind_value: 11.5');
    expect(sendMessagePayload.text).not.toContain(GOAL_DETAILS_ETA_NULL_EXPLANATION);
  });

  it('handles goal-details callback button by loading goal details via hidden id', async () => {
    const goalsApiFetch: GoalsApiFetch = async () =>
      jsonResponse(
        buildGoalDetailResponse({
          percent_complete: 42.5,
          current_value: 197,
          remaining_value: 267,
          days_left: 19,
          pace_current_7d: 13.25,
          pace_required_per_day: 14.05,
          eta_date: '2026-03-30',
          behind_value: 11.5,
        })
      );

    const { goalsRequests, apiCalls, sendMessagePayload } = await runBotScenario({
      goalsApiFetch,
      update: buildGoalDetailsCallbackUpdate(GOAL_DETAILS_ID),
    });

    expect(goalsRequests).toHaveLength(1);
    const request = goalsRequests[0];
    expect(request.method).toBe('GET');
    expect(new URL(request.url).pathname).toBe(`/goals/${GOAL_DETAILS_ID}`);
    expectAuthHeaders(request);

    expect(apiCalls.find(call => call.method === 'answerCallbackQuery')).toBeDefined();

    expect(sendMessagePayload.chat_id).toBe(TEST_CHAT_ID);
    expect(sendMessagePayload.text).toContain('percent_complete: 42.5');
    expect(sendMessagePayload.text).toContain('current_value: 197');
    expect(sendMessagePayload.text).toContain('remaining_value: 267');
    expect(sendMessagePayload.text).toContain('days_left: 19');
    expect(sendMessagePayload.text).toContain('pace_current_7d: 13.3');
    expect(sendMessagePayload.text).toContain('pace_required_per_day: 14.1');
    expect(sendMessagePayload.text).toContain('eta_date: 2026-03-30');
    expect(sendMessagePayload.text).toContain('behind_value: 11.5');
  });

  it('renders explanation when API returns eta_date as null', async () => {
    const { sendMessagePayload } = await runBotScenario({
      goalsApiFetch: async () =>
        jsonResponse(
          buildGoalDetailResponse({
            eta_date: null,
            behind_value: 7.75,
          })
        ),
      update: buildTextUpdate(`/goal id=${GOAL_DETAILS_ID}`),
    });

    expect(sendMessagePayload.chat_id).toBe(TEST_CHAT_ID);
    expect(sendMessagePayload.text).toContain('percent_complete: 25.9');
    expect(sendMessagePayload.text).toContain('eta_date: null');
    expect(sendMessagePayload.text).toContain(`eta_note: ${GOAL_DETAILS_ETA_NULL_EXPLANATION}`);
    expect(sendMessagePayload.text).toContain('behind_value: 7.8');
  });

  it('keeps negative sign for behind_value when API returns ahead-of-schedule metrics', async () => {
    const { sendMessagePayload } = await runBotScenario({
      goalsApiFetch: async () =>
        jsonResponse(
          buildGoalDetailResponse({
            behind_value: -6.2,
          })
        ),
      update: buildTextUpdate(`/goal id=${GOAL_DETAILS_ID}`),
    });

    expect(sendMessagePayload.chat_id).toBe(TEST_CHAT_ID);
    expect(sendMessagePayload.text).toContain('behind_value: -6.2');
  });
});
