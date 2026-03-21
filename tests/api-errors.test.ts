import { describe, expect, it } from 'vitest';

import {
  AuthError,
  ConflictError,
  normalizeApiError,
  NotFoundError,
  TransientUpstreamError,
  ValidationError,
} from '../src/api/errors';

describe('normalizeApiError', () => {
  it.each([
    { status: 400, expected: ValidationError },
    { status: 401, expected: AuthError },
    { status: 404, expected: NotFoundError },
    { status: 409, expected: ConflictError },
  ])('maps status $status to $expected.name', ({ status, expected }) => {
    const normalized = normalizeApiError({
      status,
      error: {
        code: 'validation_error',
        message: `status-${status}`,
      },
      method: 'GET',
      path: '/goals',
    });

    expect(normalized).toBeInstanceOf(expected);
    expect(normalized.status).toBe(status);
    expect(normalized.path).toBe('/goals');
    expect(normalized.method).toBe('GET');
  });

  it.each([405, 500])('maps status %s to TransientUpstreamError', status => {
    const normalized = normalizeApiError({
      status,
      error: {
        code: 'internal_error',
        message: `status-${status}`,
      },
      method: 'POST',
      path: '/goals',
    });

    expect(normalized).toBeInstanceOf(TransientUpstreamError);
    expect(normalized.status).toBe(status);
  });

  it('maps timeout errors to TransientUpstreamError', () => {
    const timeoutError = new DOMException('The operation was aborted', 'AbortError');

    const normalized = normalizeApiError({
      error: timeoutError,
      method: 'GET',
      path: '/goals',
    });

    expect(normalized).toBeInstanceOf(TransientUpstreamError);
    expect(normalized.message.toLowerCase()).toContain('aborted');
  });

  it('maps network errors to TransientUpstreamError', () => {
    const normalized = normalizeApiError({
      error: new TypeError('fetch failed'),
      method: 'GET',
      path: '/goals',
    });

    expect(normalized).toBeInstanceOf(TransientUpstreamError);
    expect(normalized.message.toLowerCase()).toContain('fetch failed');
  });
});
