import type { Context } from 'grammy';

import type { AppConfig } from '../config';
import type { CommandParseResult } from './command-parser';
import {
  handleGoalCreateCommand,
  handleGoalDetailsCommand,
  handleGoalsListCommand,
  handleStartCommand,
} from './command-handlers';
import type { CreateBotDependencies } from './goals-client-context';
import { START_TIMEZONE_HINT } from './messages';
import { formatInvalidCommandMessage, routeTextMessage } from './router';

export async function resolveCommandResponse(
  ctx: Context,
  config: AppConfig,
  dependencies: CreateBotDependencies,
  rawText: string,
  parsedCommand: CommandParseResult
): Promise<string> {
  let responseText = routeTextMessage(rawText);

  switch (parsedCommand.kind) {
    case 'invalid_command':
      switch (parsedCommand.commandName) {
        case 'start':
          responseText = START_TIMEZONE_HINT;
          break;
        case 'goal_create':
        case 'goal':
          responseText = formatInvalidCommandMessage(parsedCommand.reason, parsedCommand.usage);
          break;
        default:
          break;
      }
      break;
    case 'known_command':
      switch (parsedCommand.command.name) {
        case 'start':
          responseText = await handleStartCommand(ctx, config, dependencies, parsedCommand.command.args.timezone);
          break;
        case 'goal_create':
          responseText = await handleGoalCreateCommand(ctx, config, dependencies, parsedCommand.command.args);
          break;
        case 'goals':
          responseText = await handleGoalsListCommand(ctx, config, dependencies);
          break;
        case 'goal':
          responseText = await handleGoalDetailsCommand(ctx, config, dependencies, parsedCommand.command.args);
          break;
        default:
          break;
      }
      break;
    case 'not_command':
    case 'unknown_command':
      break;
  }

  return responseText;
}
