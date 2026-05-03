import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CORRELATION_ID_HEADER, createGoalsApiClient, type GoalsApiFetch } from '../src/api/client';
import { AuthError, ConflictError, NotFoundError, TransientUpstreamError, ValidationError } from '../src/api/errors';
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

type FetchOutcome = Response | Error;

function makeQueuedFetch(queue: FetchOutcome[]): { fetchMock: GoalsApiFetch; requests: Request[] } {
  const requests: Request[] = [];
  const fetchMock: GoalsApiFetch = async input => {
    requests.push(input as Request);
    const next = queue.shift();
    if (next === undefined) {
      throw new Error('queued fetch is exhausted');
    }
    if (next instanceof Error) {
      throw next;
    }
    return next;
  };
  return { fetchMock, requests };
}

function buildRetryClient(fetchMock: GoalsApiFetch, overrides: { maxAttempts?: number } = {}) {
  return createGoalsApiClient({
    baseUrl: 'https://api.example.com',
    serviceToken: 'service-token',
    telegramUserId: 42,
    correlationId: 'retry-test',
    fetch: fetchMock,
    retry: {
      baseDelayMs: 0,
      ...(overrides.maxAttempts === undefined ? {} : { maxAttempts: overrides.maxAttempts }),
    },
  });
}

describe('createGoalsApiClient retry', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it('retries on consecutive 5xx then succeeds', async () => {
    const { fetchMock, requests } = makeQueuedFetch([
      jsonResponse({ code: 'internal_error' }, 500),
      jsonResponse({ code: 'internal_error' }, 503),
      jsonResponse({ items: [] }, 200),
    ]);

    const data = await buildRetryClient(fetchMock).GET('/goals');

    expect(requests).toHaveLength(3);
    expect(data).toEqual({ items: [] });
  });

  it('retries on single 500 then succeeds', async () => {
    const { fetchMock, requests } = makeQueuedFetch([
      jsonResponse({ code: 'internal_error' }, 500),
      jsonResponse({ items: [] }, 200),
    ]);

    const data = await buildRetryClient(fetchMock).GET('/goals');

    expect(requests).toHaveLength(2);
    expect(data).toEqual({ items: [] });
  });

  it('retries on AbortError then succeeds', async () => {
    const { fetchMock, requests } = makeQueuedFetch([
      new DOMException('The operation was aborted', 'AbortError'),
      jsonResponse({ items: [] }, 200),
    ]);

    const data = await buildRetryClient(fetchMock).GET('/goals');

    expect(requests).toHaveLength(2);
    expect(data).toEqual({ items: [] });
  });

  it('retries on TypeError network failure then succeeds', async () => {
    const { fetchMock, requests } = makeQueuedFetch([new TypeError('fetch failed'), jsonResponse({ items: [] }, 200)]);

    const data = await buildRetryClient(fetchMock).GET('/goals');

    expect(requests).toHaveLength(2);
    expect(data).toEqual({ items: [] });
  });

  it('exhausts retries and throws TransientUpstreamError after 3 5xx responses', async () => {
    const { fetchMock, requests } = makeQueuedFetch([
      jsonResponse({ code: 'internal_error' }, 500),
      jsonResponse({ code: 'internal_error' }, 502),
      jsonResponse({ code: 'internal_error' }, 503),
    ]);

    await expect(buildRetryClient(fetchMock).GET('/goals')).rejects.toMatchObject({
      name: 'TransientUpstreamError',
      status: 503,
    });
    expect(requests).toHaveLength(3);
  });

  it.each([
    { status: 400, expected: ValidationError },
    { status: 401, expected: AuthError },
    { status: 404, expected: NotFoundError },
    { status: 409, expected: ConflictError },
  ])('does not retry on status $status', async ({ status, expected }) => {
    const { fetchMock, requests } = makeQueuedFetch([
      jsonResponse({ code: 'permanent_error', message: `status-${status}` }, status),
    ]);

    await expect(buildRetryClient(fetchMock).GET('/goals')).rejects.toBeInstanceOf(expected);
    expect(requests).toHaveLength(1);
  });

  it('logs retry attempts and request completion as structured JSON', async () => {
    const { fetchMock } = makeQueuedFetch([
      jsonResponse({ code: 'internal_error' }, 500),
      jsonResponse({ items: [] }, 200),
    ]);

    await buildRetryClient(fetchMock).GET('/goals');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const retryPayload = JSON.parse(warnSpy.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(retryPayload).toMatchObject({
      event: 'api_request_retry',
      method: 'GET',
      path: '/goals',
      attempt: 1,
      next_delay_ms: 0,
      status: 500,
      correlation_id: 'retry-test',
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const completedPayload = JSON.parse(infoSpy.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(completedPayload).toMatchObject({
      event: 'api_request_completed',
      method: 'GET',
      path: '/goals',
      status: 200,
      attempts: 2,
      outcome: 'success',
      correlation_id: 'retry-test',
    });
    expect(typeof completedPayload.duration_ms).toBe('number');
  });

  it('respects custom maxAttempts override', async () => {
    const { fetchMock, requests } = makeQueuedFetch([
      jsonResponse({ code: 'internal_error' }, 500),
      jsonResponse({ code: 'internal_error' }, 500),
    ]);

    await expect(buildRetryClient(fetchMock, { maxAttempts: 2 }).GET('/goals')).rejects.toBeInstanceOf(
      TransientUpstreamError
    );
    expect(requests).toHaveLength(2);
  });
});
