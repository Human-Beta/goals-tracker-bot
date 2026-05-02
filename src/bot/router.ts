import { parseCommandText } from './commands/command-parser';

export const PING_RESPONSE = 'pong';
export const KNOWN_COMMAND_NOT_IMPLEMENTED_RESPONSE = 'Command is recognized but not implemented yet.';
export const GLOBAL_FALLBACK_RESPONSE = 'I only understand commands. Try /ping.';

export function formatInvalidCommandMessage(reason: string, usage: string): string {
  return `Invalid command format: ${reason}. Usage: ${usage}`;
}

export function routeTextMessage(text: string): string {
  const parsedCommand = parseCommandText(text);
  switch (parsedCommand.kind) {
    case 'not_command':
      return GLOBAL_FALLBACK_RESPONSE;
    case 'unknown_command':
      return GLOBAL_FALLBACK_RESPONSE;
    case 'invalid_command':
      return formatInvalidCommandMessage(parsedCommand.reason, parsedCommand.usage);
    case 'known_command':
      return parsedCommand.command.name === 'ping' ? PING_RESPONSE : KNOWN_COMMAND_NOT_IMPLEMENTED_RESPONSE;
  }
}
