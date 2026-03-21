import { describe, expect, it } from 'vitest';

import { CORRELATION_ID_HEADER, createGoalsApiClient, type GoalsApiFetch } from '../src/api/client';
import { UUID_PATTERN } from '../src/shared/patterns';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

describe('createGoalsApiClient middleware', () => {
  it('injects auth, telegram user id and correlation id headers', async () => {
    const requests: Request[] = [];

    const fetchMock: GoalsApiFetch = async input => {
      requests.push(input as Request);
      return jsonResponse({ items: [] });
    };

    const client = createGoalsApiClient({
      baseUrl: 'https://api.example.com',
      serviceToken: 'service-token',
      telegramUserId: 987654,
      correlationId: 'corr-123',
      fetch: fetchMock,
    });

    const response = await client.GET('/goals', {
      headers: {
        Authorization: 'Bearer overridden',
      },
    });

    expect(response).toEqual({ items: [] });
    expect(requests).toHaveLength(1);

    const request = requests[0];
    expect(request.headers.get('Authorization')).toBe('Bearer service-token');
    expect(request.headers.get('X-Telegram-User-Id')).toBe('987654');
    expect(request.headers.get(CORRELATION_ID_HEADER)).toBe('corr-123');
  });

  it('generates correlation id when caller did not provide it', async () => {
    const requests: Request[] = [];

    const fetchMock: GoalsApiFetch = async input => {
      requests.push(input as Request);
      return jsonResponse({ items: [] });
    };

    const client = createGoalsApiClient({
      baseUrl: 'https://api.example.com',
      serviceToken: 'service-token',
      telegramUserId: 42,
      fetch: fetchMock,
    });

    await client.GET('/goals');

    expect(requests).toHaveLength(1);
    const correlationId = requests[0].headers.get(CORRELATION_ID_HEADER);
    expect(correlationId).toMatch(UUID_PATTERN);
  });
});
