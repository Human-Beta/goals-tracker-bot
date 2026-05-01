import { describe, expect, it } from 'vitest';

import { parseCommandText } from '../src/bot/command-parser';
import { KeyValueParseError, parseKeyValueArgs } from '../src/bot/key-value-parser';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

describe('parseKeyValueArgs', () => {
  it('parses key=value tokens with quoted string and escapes', () => {
    const parsed = parseKeyValueArgs('title="Read \\"Clean Code\\"" note="Path \\\\tmp" delta=12.5');

    expect(parsed).toEqual({
      title: 'Read "Clean Code"',
      note: 'Path \\tmp',
      delta: '12.5',
    });
  });

  it('throws on duplicate keys', () => {
    expect(() => parseKeyValueArgs('goal=one goal=two')).toThrow(KeyValueParseError);
  });

  it('throws on unclosed quotes', () => {
    expect(() => parseKeyValueArgs('title="missing')).toThrow(KeyValueParseError);
  });
});

describe('parseCommandText', () => {
  it('parses valid known command with args', () => {
    const parsed = parseCommandText(`/progress_edit goal=${UUID_A} event=${UUID_B} delta=5 note="Fix typo"`);

    expect(parsed).toMatchObject({
      kind: 'known_command',
      command: {
        name: 'progress_edit',
        args: {
          goal: UUID_A,
          event: UUID_B,
          delta: '5',
          note: 'Fix typo',
        },
      },
    });
  });

  it('returns strict validation error for unknown key', () => {
    const parsed = parseCommandText('/goal id=11111111-1111-4111-8111-111111111111 extra=1');

    expect(parsed).toMatchObject({
      kind: 'invalid_command',
      commandName: 'goal',
    });
    if (parsed.kind === 'invalid_command') {
      expect(parsed.reason).toContain('unknown argument "extra"');
    }
  });

  it('returns strict validation error for missing required arg', () => {
    const parsed = parseCommandText(
      '/progress_delete goal=11111111-1111-4111-8111-111111111111 event=22222222-2222-4222-8222-222222222222'
    );

    expect(parsed).toMatchObject({
      kind: 'invalid_command',
      commandName: 'progress_delete',
    });
    if (parsed.kind === 'invalid_command') {
      expect(parsed.reason).toContain('missing required argument "confirm"');
    }
  });

  it('returns validation error for malformed value format', () => {
    const parsed = parseCommandText('/goal id=bad-uuid');

    expect(parsed).toMatchObject({
      kind: 'invalid_command',
      commandName: 'goal',
      usage: '/goal id=<uuid>',
    });
    if (parsed.kind === 'invalid_command') {
      expect(parsed.reason).toContain('must be a valid UUID');
    }
  });

  it('returns not_command for plain text', () => {
    expect(parseCommandText('hello world')).toEqual({ kind: 'not_command' });
  });

  it('returns unknown_command for unknown slash command', () => {
    expect(parseCommandText('/hello there=1')).toMatchObject({
      kind: 'unknown_command',
      commandName: 'hello',
    });
  });

  it('accepts goal_edit with unit so the handler can return a specific immutable-field message', () => {
    const parsed = parseCommandText(`/goal_edit id=${UUID_A} unit=km`);

    expect(parsed).toMatchObject({
      kind: 'known_command',
      command: {
        name: 'goal_edit',
        args: {
          id: UUID_A,
          unit: 'km',
        },
      },
    });
  });

  it('rejects goal_edit when required id is missing', () => {
    const parsed = parseCommandText('/goal_edit title="New title"');

    expect(parsed).toMatchObject({
      kind: 'invalid_command',
      commandName: 'goal_edit',
    });
    if (parsed.kind === 'invalid_command') {
      expect(parsed.reason).toContain('missing required argument "id"');
    }
  });

  it('rejects goal_edit when id is not a valid UUID', () => {
    const parsed = parseCommandText('/goal_edit id=bad-uuid title="New title"');

    expect(parsed).toMatchObject({
      kind: 'invalid_command',
      commandName: 'goal_edit',
    });
    if (parsed.kind === 'invalid_command') {
      expect(parsed.reason).toContain('must be a valid UUID');
    }
  });
});
