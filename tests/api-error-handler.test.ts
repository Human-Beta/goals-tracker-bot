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
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
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
  });

  it('falls back for unknown errors and does not leak error text', () => {
    const result = mapApiError(new Error('boom internal stack'), fullMessages);

    expect(result).toBe('F');
    expect(result).not.toContain('boom');
    expect(result).not.toContain('stack');
  });

  it('integrates with goalEditMessages dictionary for ConflictError', () => {
    const result = mapApiError(new ConflictError('upstream details'), goalEditMessages);

    expect(result).toBe(goalEditMessages.conflict);
    expect(result).toContain('conflicts with the goal state');
  });
});
