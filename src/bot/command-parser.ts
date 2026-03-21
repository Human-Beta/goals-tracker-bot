import {
  COMMAND_SPECS,
  isKnownCommandName,
  type CommandName,
  type CommandSpec,
  validateCommandArguments,
} from './command-contract';
import { KeyValueParseError, parseKeyValueArgs } from './key-value-parser';

export type ParsedCommand = {
  name: CommandName;
  spec: CommandSpec;
  args: Readonly<Record<string, string>>;
};

export type CommandParseResult =
  | {
      kind: 'not_command';
    }
  | {
      kind: 'unknown_command';
      commandName: string;
    }
  | {
      kind: 'invalid_command';
      commandName: CommandName;
      usage: string;
      reason: string;
    }
  | {
      kind: 'known_command';
      command: ParsedCommand;
    };

type ParsedCommandToken = {
  commandName: string;
  rawArgs: string;
};

function parseCommandToken(text: string): ParsedCommandToken | null {
  const trimmedText = text.trim();
  if (!trimmedText.startsWith('/')) {
    return null;
  }

  const firstWhitespaceIndex = trimmedText.search(/\s/);
  const token = firstWhitespaceIndex === -1 ? trimmedText : trimmedText.slice(0, firstWhitespaceIndex);
  const rawArgs = firstWhitespaceIndex === -1 ? '' : trimmedText.slice(firstWhitespaceIndex).trim();
  const match = /^\/([a-z_][a-z0-9_]*)(?:@[a-z0-9_]+)?$/i.exec(token);
  if (match === null) {
    return {
      commandName: token.slice(1).toLowerCase(),
      rawArgs,
    };
  }

  return {
    commandName: match[1].toLowerCase(),
    rawArgs,
  };
}

export function parseCommandText(text: string): CommandParseResult {
  const parsedToken = parseCommandToken(text);
  if (parsedToken === null) {
    return {
      kind: 'not_command',
    };
  }

  if (!isKnownCommandName(parsedToken.commandName)) {
    return {
      kind: 'unknown_command',
      commandName: parsedToken.commandName,
    };
  }

  const spec = COMMAND_SPECS[parsedToken.commandName];
  let parsedArgs: Record<string, string> = {};
  if (parsedToken.rawArgs.length > 0) {
    try {
      parsedArgs = parseKeyValueArgs(parsedToken.rawArgs);
    } catch (error) {
      if (error instanceof KeyValueParseError) {
        return {
          kind: 'invalid_command',
          commandName: spec.name,
          usage: spec.usage,
          reason: error.message,
        };
      }
      throw error;
    }
  }

  const validationError = validateCommandArguments(spec, parsedArgs);
  if (validationError !== null) {
    return {
      kind: 'invalid_command',
      commandName: spec.name,
      usage: spec.usage,
      reason: validationError,
    };
  }

  return {
    kind: 'known_command',
    command: {
      name: spec.name,
      spec,
      args: parsedArgs,
    },
  };
}
