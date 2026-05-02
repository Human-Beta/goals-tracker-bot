import { describe, expect, it } from 'vitest';

import type { GoalsApiFetch } from '../../src/api/client';
import {
  buildTextUpdate,
  expectAuthHeaders,
  GOAL_CREATE_VALIDATION_HINT,
  jsonResponse,
  runBotScenario,
  TEST_CHAT_ID,
} from './helpers';

describe('/goal_create', () => {
  it('calls POST /goals and returns key fields', async () => {
    const goalsApiFetch: GoalsApiFetch = async () =>
      jsonResponse(
        {
          id: '55555555-5555-4555-8555-555555555555',
          user_id: '11111111-1111-4111-8111-111111111111',
          title: 'Read Clean Code',
          unit: 'pages',
          target_value: 464,
          start_date: '2026-02-10',
          end_date: '2026-03-15',
          status: 'active',
          created_at: '2026-02-10T12:00:00.000Z',
          updated_at: '2026-02-10T12:00:00.000Z',
        },
        201
      );

    const { goalsRequests, sendMessagePayload } = await runBotScenario({
      goalsApiFetch,
      update: buildTextUpdate(
        '/goal_create title="Read Clean Code" unit=pages target=464 end=2026-03-15 start=2026-02-10'
      ),
    });

    expect(goalsRequests).toHaveLength(1);
    const request = goalsRequests[0];
    expect(request.method).toBe('POST');
    expect(new URL(request.url).pathname).toBe('/goals');
    expectAuthHeaders(request);
    expect(await request.clone().json()).toEqual({
      title: 'Read Clean Code',
      unit: 'pages',
      target_value: 464,
      start_date: '2026-02-10',
      end_date: '2026-03-15',
    });

    expect(sendMessagePayload.chat_id).toBe(TEST_CHAT_ID);
    expect(sendMessagePayload.text).toContain('id: 55555555-5555-4555-8555-555555555555');
    expect(sendMessagePayload.text).toContain('title: Read Clean Code');
    expect(sendMessagePayload.text).toContain('target: 464');
    expect(sendMessagePayload.text).toContain('end_date: 2026-03-15');
  });

  it('returns format validation message and does not call API for invalid payload', async () => {
    const { goalsRequests, sendMessagePayload } = await runBotScenario({
      update: buildTextUpdate('/goal_create title="Read Clean Code" unit=pages target=abc end=2026-03-15'),
    });

    expect(goalsRequests).toHaveLength(0);
    expect(sendMessagePayload.chat_id).toBe(TEST_CHAT_ID);
    expect(sendMessagePayload.text).toContain('Invalid command format');
    expect(sendMessagePayload.text).toContain('argument "target" must be a valid number');
    expect(sendMessagePayload.text).toContain('/goal_create title="<text>" unit=<pages|minutes|km> target=<number>');
  });

  it('returns user-friendly message when API fails with 400', async () => {
    const goalsApiFetch: GoalsApiFetch = async () =>
      jsonResponse(
        {
          code: 'validation_error',
          message: 'end_date must be after today',
        },
        400
      );

    const { sendMessagePayload } = await runBotScenario({
      goalsApiFetch,
      update: buildTextUpdate('/goal_create title="Read Clean Code" unit=pages target=464 end=2026-03-15'),
    });

    expect(sendMessagePayload).toMatchObject({
      chat_id: TEST_CHAT_ID,
      text: GOAL_CREATE_VALIDATION_HINT,
    });
  });
});
