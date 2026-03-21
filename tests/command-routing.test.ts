import { describe, expect, it } from 'vitest';

import {
  GLOBAL_FALLBACK_RESPONSE,
  KNOWN_COMMAND_NOT_IMPLEMENTED_RESPONSE,
  PING_RESPONSE,
  routeTextMessage,
} from '../src/bot/router';

const VALID_GOAL_ID = '11111111-1111-4111-8111-111111111111';

describe('routeTextMessage', () => {
  it('routes /ping to pong', () => {
    expect(routeTextMessage('/ping')).toBe(PING_RESPONSE);
  });

  it('returns known-not-implemented for valid recognized command', () => {
    expect(routeTextMessage(`/goal id=${VALID_GOAL_ID}`)).toBe(KNOWN_COMMAND_NOT_IMPLEMENTED_RESPONSE);
  });

  it('returns command format error for invalid known command input', () => {
    const response = routeTextMessage('/goal id=invalid');

    expect(response).toContain('Invalid command format');
    expect(response).toContain('/goal id=<uuid>');
  });

  it('returns fallback for unknown slash command', () => {
    expect(routeTextMessage('/unknown')).toBe(GLOBAL_FALLBACK_RESPONSE);
  });

  it('returns fallback for non-command text', () => {
    expect(routeTextMessage('hello there')).toBe(GLOBAL_FALLBACK_RESPONSE);
  });
});
