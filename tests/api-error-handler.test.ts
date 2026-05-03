import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthError, ConflictError, NotFoundError, ValidationError } from '../src/api/errors';
import { defineApiErrorMessages, mapApiError } from '../src/bot/presentation/api-error-handler';
import { goalEditMessages } from '../src/bot/presentation/messages';

const SECRET = 'SECRET INTERNAL DETAIL';

const fullMessages = defineApiErrorMessages({
  validation: 'V',
  conflict: 'C',
  notFound: 'N',
  auth: 'A',
  fallback: 'F',
  logContext: 'test',
});

describe('mapApiError', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    { name: 'ValidationError', factory: () => new ValidationError(SECRET), expected: 'V' },
    { name: 'AuthError', factory: () => new AuthError(SECRET), expected: 'A' },
    { name: 'NotFoundError', factory: () => new NotFoundError(SECRET), expected: 'N' },
    { name: 'ConflictError', factory: () => new ConflictError(SECRET), expected: 'C' },
  ])('maps $name to its configured message without leaking error text', ({ factory, expected }) => {
    const result = mapApiError(factory(), fullMessages);

    expect(result).toBe(expected);
    expect(result).not.toContain('SECRET');
  });

  it.each([
    { name: 'ValidationError', factory: () => new ValidationError(SECRET) },
    { name: 'AuthError', factory: () => new AuthError(SECRET) },
    { name: 'NotFoundError', factory: () => new NotFoundError(SECRET) },
    { name: 'ConflictError', factory: () => new ConflictError(SECRET) },
  ])('falls back when $name has no configured message and does not leak error text', ({ factory }) => {
    const fallbackOnly = defineApiErrorMessages({
      fallback: 'F',
      logContext: 'test',
    });

    const result = mapApiError(factory(), fallbackOnly);

    expect(result).toBe('F');
    expect(result).not.toContain('SECRET');
    const logged = warnSpy.mock.calls.map((call: unknown[]) => String(call[0])).join('\n');
    expect(logged).not.toContain('SECRET');
  });

  it('falls back for unknown errors and does not leak error text', () => {
    const result = mapApiError(new Error('boom internal stack'), fullMessages);

    expect(result).toBe('F');
    expect(result).not.toContain('boom');
    expect(result).not.toContain('stack');
    const logged = warnSpy.mock.calls.map((call: unknown[]) => String(call[0])).join('\n');
    expect(logged).not.toContain('boom');
    expect(logged).not.toContain('stack');
  });

  it('integrates with goalEditMessages dictionary for ConflictError', () => {
    const result = mapApiError(new ConflictError('upstream details'), goalEditMessages);

    expect(result).toBe(goalEditMessages.conflict);
    expect(result).toContain('conflicts with the goal state');
  });

  it('emits structured api_error_unmapped log with correlation id and error metadata for fallback path', () => {
    const fallbackOnly = defineApiErrorMessages({
      fallback: 'F',
      logContext: 'ctx-label',
    });

    mapApiError(new ValidationError(SECRET), fallbackOnly, 'corr-xyz');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(warnSpy.mock.calls[0][0] as string) as Record<string, unknown>;
    expect(payload).toMatchObject({
      event: 'api_error_unmapped',
      context: 'ctx-label',
      error_name: 'ValidationError',
      error_code: 'VALIDATION_ERROR',
      correlation_id: 'corr-xyz',
    });
  });
});
