import { describe, expect, it } from 'vitest';

import type { GoalsApiFetch } from '../src/api/client';
import {
  buildGoalDetailResponse,
  buildGoalDetailsCallbackUpdate,
  buildTextUpdate,
  expectAuthHeaders,
  GOAL_CREATE_VALIDATION_HINT,
  GOAL_DETAILS_ETA_NULL_EXPLANATION,
  GOAL_DETAILS_ID,
  GOAL_EDIT_CONFLICT_MESSAGE,
  GOAL_EDIT_IMMUTABLE_UNIT_MESSAGE,
  GOALS_LIST_AUTH_ERROR_MESSAGE,
  GOALS_LIST_EMPTY_MESSAGE,
  GOALS_LIST_NOT_FOUND_MESSAGE,
  jsonResponse,
  PROGRESS_ADD_NOT_FOUND_MESSAGE,
  PROGRESS_DELETE_NOT_FOUND_MESSAGE,
  PROGRESS_DELETE_SUCCESS_MESSAGE,
  PROGRESS_EDIT_NOT_FOUND_MESSAGE,
  PROGRESS_EDIT_NOTHING_TO_UPDATE_MESSAGE,
  PROGRESS_EVENT_ID,
  PROGRESS_EVENT_ID_2,
  PROGRESS_LIST_EMPTY_MESSAGE,
  runBotScenario,
  TEST_CHAT_ID,
  USER_TIMEZONE_HINT,
} from './bot/helpers';

describe('bot update handling', () => {
  it('handles /ping update end-to-end and sends pong', async () => {
    const { sendMessagePayload } = await runBotScenario({
      update: buildTextUpdate('/ping'),
    });

    expect(sendMessagePayload).toMatchObject({
      chat_id: TEST_CHAT_ID,
      text: 'pong',
    });
  });

  it('handles /start by calling upsert endpoint and confirming saved timezone', async () => {
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

  it('returns timezone hint when /start upsert fails with 400', async () => {
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
    'returns timezone hint when start payload is invalid: %s',
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

  it('handles /goal_create by calling POST /goals and returning key fields', async () => {
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

  it('returns format validation message and does not call API for invalid /goal_create payload', async () => {
    const { goalsRequests, sendMessagePayload } = await runBotScenario({
      update: buildTextUpdate('/goal_create title="Read Clean Code" unit=pages target=abc end=2026-03-15'),
    });

    expect(goalsRequests).toHaveLength(0);
    expect(sendMessagePayload.chat_id).toBe(TEST_CHAT_ID);
    expect(sendMessagePayload.text).toContain('Invalid command format');
    expect(sendMessagePayload.text).toContain('argument "target" must be a valid number');
    expect(sendMessagePayload.text).toContain('/goal_create title="<text>" unit=<pages|minutes|km> target=<number>');
  });

  it('returns user-friendly message when /goal_create fails with 400', async () => {
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

  it('handles /goal_edit by calling PATCH /goals/{goalId} with only the provided field', async () => {
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

  it('maps target/start/end to API fields and omits unset keys on /goal_edit PATCH body', async () => {
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

  it('rejects /goal_edit with unit and does not call API', async () => {
    const { goalsRequests, sendMessagePayload } = await runBotScenario({
      update: buildTextUpdate(`/goal_edit id=${GOAL_DETAILS_ID} unit=km`),
    });

    expect(goalsRequests).toHaveLength(0);
    expect(sendMessagePayload).toMatchObject({
      chat_id: TEST_CHAT_ID,
      text: GOAL_EDIT_IMMUTABLE_UNIT_MESSAGE,
    });
  });

  it('rejects /goal_edit with unit even when other valid fields are provided', async () => {
    const { goalsRequests, sendMessagePayload } = await runBotScenario({
      update: buildTextUpdate(`/goal_edit id=${GOAL_DETAILS_ID} title="X" unit=km`),
    });

    expect(goalsRequests).toHaveLength(0);
    expect(sendMessagePayload).toMatchObject({
      chat_id: TEST_CHAT_ID,
      text: GOAL_EDIT_IMMUTABLE_UNIT_MESSAGE,
    });
  });

  it('returns conflict message when /goal_edit fails with 409', async () => {
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

  it('handles /goals by calling GET /goals and rendering summary fields', async () => {
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

  it('handles /goal by calling GET /goals/{goalId} and rendering metrics from API response', async () => {
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

  it('renders explanation when /goal returns eta_date as null', async () => {
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

  it('keeps negative sign for behind_value when /goal returns ahead-of-schedule metrics', async () => {
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

  it('returns dedicated empty-state message when /goals list is empty', async () => {
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

  it('returns mapped technical message when /goals fails with 401', async () => {
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

  it('returns mapped not-found message when /goals fails with 404', async () => {
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

  it('handles /progress_add by calling POST /goals/{goalId}/progress and returning event details', async () => {
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

  it('returns format validation message and does not call API for invalid /progress_add payload', async () => {
    const { goalsRequests, sendMessagePayload } = await runBotScenario({
      update: buildTextUpdate(`/progress_add goal=${GOAL_DETAILS_ID} delta=abc`),
    });

    expect(goalsRequests).toHaveLength(0);
    expect(sendMessagePayload.chat_id).toBe(TEST_CHAT_ID);
    expect(sendMessagePayload.text).toContain('Invalid command format');
    expect(sendMessagePayload.text).toContain('argument "delta" must be a valid number');
    expect(sendMessagePayload.text).toContain('/progress_add goal=<uuid> delta=<number>');
  });

  it('returns not-found message when /progress_add fails with 404', async () => {
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

  it('handles /progress_list by calling GET /goals/{goalId}/progress and rendering events', async () => {
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

  it('forwards from and to query params on /progress_list', async () => {
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

  it('forwards sort=desc on /progress_list', async () => {
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

  it('returns empty-state message when /progress_list returns no events', async () => {
    const { sendMessagePayload } = await runBotScenario({
      goalsApiFetch: async () => jsonResponse({ items: [] }),
      update: buildTextUpdate(`/progress_list goal=${GOAL_DETAILS_ID} from=2026-04-01 to=2026-04-02`),
    });

    expect(sendMessagePayload).toMatchObject({
      chat_id: TEST_CHAT_ID,
      text: PROGRESS_LIST_EMPTY_MESSAGE,
    });
  });

  it('handles /progress_edit by calling PATCH /goals/{goalId}/progress/{eventId} and returning updated event', async () => {
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

  it('returns nothing-to-update message and does not call API when /progress_edit has no optional fields', async () => {
    const { goalsRequests, sendMessagePayload } = await runBotScenario({
      update: buildTextUpdate(`/progress_edit goal=${GOAL_DETAILS_ID} event=${PROGRESS_EVENT_ID}`),
    });

    expect(goalsRequests).toHaveLength(0);
    expect(sendMessagePayload).toMatchObject({
      chat_id: TEST_CHAT_ID,
      text: PROGRESS_EDIT_NOTHING_TO_UPDATE_MESSAGE,
    });
  });

  it('returns not-found message when /progress_edit fails with 404', async () => {
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

  it('handles /progress_delete by calling DELETE /goals/{goalId}/progress/{eventId} when confirm=yes', async () => {
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

  it('rejects /progress_delete without confirm=yes and does not call API', async () => {
    const { goalsRequests, sendMessagePayload } = await runBotScenario({
      update: buildTextUpdate(`/progress_delete goal=${GOAL_DETAILS_ID} event=${PROGRESS_EVENT_ID}`),
    });

    expect(goalsRequests).toHaveLength(0);
    expect(sendMessagePayload.chat_id).toBe(TEST_CHAT_ID);
    expect(sendMessagePayload.text).toContain('Invalid command format');
    expect(sendMessagePayload.text).toContain('missing required argument "confirm"');
    expect(sendMessagePayload.text).toContain('/progress_delete goal=<uuid> event=<uuid> confirm=yes');
  });

  it('returns not-found message when /progress_delete fails with 404', async () => {
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
