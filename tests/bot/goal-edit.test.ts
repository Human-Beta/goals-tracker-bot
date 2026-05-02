import { describe, expect, it } from 'vitest';

import type { GoalsApiFetch } from '../../src/api/client';
import {
  buildTextUpdate,
  expectAuthHeaders,
  GOAL_DETAILS_ID,
  GOAL_EDIT_CONFLICT_MESSAGE,
  GOAL_EDIT_IMMUTABLE_UNIT_MESSAGE,
  jsonResponse,
  runBotScenario,
  TEST_CHAT_ID,
} from './helpers';

describe('/goal_edit', () => {
  it('calls PATCH /goals/{goalId} with only the provided field', async () => {
    const goalsApiFetch: GoalsApiFetch = async () =>
      jsonResponse({
        id: GOAL_DETAILS_ID,
        user_id: '11111111-1111-4111-8111-111111111111',
        title: 'Updated title',
        unit: 'pages',
        target_value: 464,
        start_date: '2026-02-10',
        end_date: '2026-03-15',
        status: 'active',
        created_at: '2026-02-10T12:00:00.000Z',
        updated_at: '2026-02-12T12:00:00.000Z',
      });

    const { goalsRequests, sendMessagePayload } = await runBotScenario({
      goalsApiFetch,
      update: buildTextUpdate(`/goal_edit id=${GOAL_DETAILS_ID} title="Updated title"`),
    });

    expect(goalsRequests).toHaveLength(1);
    const request = goalsRequests[0];
    expect(request.method).toBe('PATCH');
    expect(new URL(request.url).pathname).toBe(`/goals/${GOAL_DETAILS_ID}`);
    expectAuthHeaders(request);
    expect(await request.clone().json()).toEqual({
      title: 'Updated title',
    });

    expect(sendMessagePayload.chat_id).toBe(TEST_CHAT_ID);
    expect(sendMessagePayload.text).toContain('Goal updated successfully');
    expect(sendMessagePayload.text).toContain('title: Updated title');
  });

  it('maps target/start/end to API fields and omits unset keys on PATCH body', async () => {
    const goalsApiFetch: GoalsApiFetch = async () =>
      jsonResponse({
        id: GOAL_DETAILS_ID,
        user_id: '11111111-1111-4111-8111-111111111111',
        title: 'Read Clean Code',
        unit: 'pages',
        target_value: 500,
        start_date: '2026-02-10',
        end_date: '2026-12-31',
        status: 'active',
        created_at: '2026-02-10T12:00:00.000Z',
        updated_at: '2026-02-12T12:00:00.000Z',
      });

    const { goalsRequests } = await runBotScenario({
      goalsApiFetch,
      update: buildTextUpdate(`/goal_edit id=${GOAL_DETAILS_ID} target=500 end=2026-12-31`),
    });

    expect(goalsRequests).toHaveLength(1);
    const request = goalsRequests[0];
    expect(request.method).toBe('PATCH');
    expect(new URL(request.url).pathname).toBe(`/goals/${GOAL_DETAILS_ID}`);
    expect(await request.clone().json()).toEqual({
      target_value: 500,
      end_date: '2026-12-31',
    });
  });

  it('rejects unit-only edit and does not call API', async () => {
    const { goalsRequests, sendMessagePayload } = await runBotScenario({
      update: buildTextUpdate(`/goal_edit id=${GOAL_DETAILS_ID} unit=km`),
    });

    expect(goalsRequests).toHaveLength(0);
    expect(sendMessagePayload).toMatchObject({
      chat_id: TEST_CHAT_ID,
      text: GOAL_EDIT_IMMUTABLE_UNIT_MESSAGE,
    });
  });

  it('rejects unit edit even when other valid fields are provided', async () => {
    const { goalsRequests, sendMessagePayload } = await runBotScenario({
      update: buildTextUpdate(`/goal_edit id=${GOAL_DETAILS_ID} title="X" unit=km`),
    });

    expect(goalsRequests).toHaveLength(0);
    expect(sendMessagePayload).toMatchObject({
      chat_id: TEST_CHAT_ID,
      text: GOAL_EDIT_IMMUTABLE_UNIT_MESSAGE,
    });
  });

  it('returns conflict message when API fails with 409', async () => {
    const goalsApiFetch: GoalsApiFetch = async () =>
      jsonResponse(
        {
          code: 'target_below_progress',
          message: 'target_value below current progress',
        },
        409
      );

    const { sendMessagePayload } = await runBotScenario({
      goalsApiFetch,
      update: buildTextUpdate(`/goal_edit id=${GOAL_DETAILS_ID} target=10`),
    });

    expect(sendMessagePayload).toMatchObject({
      chat_id: TEST_CHAT_ID,
      text: GOAL_EDIT_CONFLICT_MESSAGE,
    });
  });
});
