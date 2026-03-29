import type { Context } from 'grammy';

import type { AppConfig } from '../config';
import type { CommandParseResult } from './command-parser';
import { toCommandResponse, type CommandResponse } from './command-response';
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
): Promise<CommandResponse> {
  let response = toCommandResponse(routeTextMessage(rawText));

  switch (parsedCommand.kind) {
    case 'invalid_command':
      switch (parsedCommand.commandName) {
        case 'start':
          response = toCommandResponse(START_TIMEZONE_HINT);
          break;
        case 'goal_create':
        case 'goal':
          response = toCommandResponse(formatInvalidCommandMessage(parsedCommand.reason, parsedCommand.usage));
          break;
        default:
          break;
      }
      break;
    case 'known_command':
      switch (parsedCommand.command.name) {
        case 'start':
          response = toCommandResponse(
            await handleStartCommand(ctx, config, dependencies, parsedCommand.command.args.timezone)
          );
          break;
        case 'goal_create':
          response = toCommandResponse(
            await handleGoalCreateCommand(ctx, config, dependencies, parsedCommand.command.args)
          );
          break;
        case 'goals':
          response = await handleGoalsListCommand(ctx, config, dependencies);
          break;
        case 'goal':
          response = toCommandResponse(
            await handleGoalDetailsCommand(ctx, config, dependencies, parsedCommand.command.args)
          );
          break;
        default:
          break;
      }
      break;
    case 'not_command':
    case 'unknown_command':
      break;
  }

  return response;
}
