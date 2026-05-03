import type { Context } from 'grammy';

import type { AppConfig } from '../../config';
import type { CommandParseResult } from './command-parser';
import { toCommandResponse, type CommandResponse } from './command-response';
import {
  handleGoalCreateCommand,
  handleGoalDetailsCommand,
  handleGoalEditCommand,
  handleGoalsListCommand,
  handleProgressAddCommand,
  handleProgressDeleteCommand,
  handleProgressEditCommand,
  handleProgressListCommand,
  handleStartCommand,
} from './command-handlers';
import { parseGoalDetailsCallbackData } from './goal-callback-data';
import type { CreateBotDependencies } from '../goals-client-context';
import { startMessages } from '../presentation/messages';
import { formatInvalidCommandMessage, routeTextMessage } from '../router';

export async function resolveCommandResponse(
  ctx: Context,
  config: AppConfig,
  dependencies: CreateBotDependencies,
  rawText: string,
  parsedCommand: CommandParseResult,
  correlationId: string
): Promise<CommandResponse> {
  let response = toCommandResponse(routeTextMessage(rawText));

  switch (parsedCommand.kind) {
    case 'invalid_command':
      switch (parsedCommand.commandName) {
        case 'start':
          response = toCommandResponse(startMessages.validation);
          break;
        case 'goal_create':
        case 'goal':
        case 'goal_edit':
        case 'progress_add':
        case 'progress_list':
        case 'progress_edit':
        case 'progress_delete':
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
            await handleStartCommand(ctx, config, dependencies, parsedCommand.command.args.timezone, correlationId)
          );
          break;
        case 'goal_create':
          response = toCommandResponse(
            await handleGoalCreateCommand(ctx, config, dependencies, parsedCommand.command.args, correlationId)
          );
          break;
        case 'goals':
          response = await handleGoalsListCommand(ctx, config, dependencies, correlationId);
          break;
        case 'goal':
          response = toCommandResponse(
            await handleGoalDetailsCommand(ctx, config, dependencies, parsedCommand.command.args, correlationId)
          );
          break;
        case 'goal_edit':
          response = toCommandResponse(
            await handleGoalEditCommand(ctx, config, dependencies, parsedCommand.command.args, correlationId)
          );
          break;
        case 'progress_add':
          response = toCommandResponse(
            await handleProgressAddCommand(ctx, config, dependencies, parsedCommand.command.args, correlationId)
          );
          break;
        case 'progress_list':
          response = toCommandResponse(
            await handleProgressListCommand(ctx, config, dependencies, parsedCommand.command.args, correlationId)
          );
          break;
        case 'progress_edit':
          response = toCommandResponse(
            await handleProgressEditCommand(ctx, config, dependencies, parsedCommand.command.args, correlationId)
          );
          break;
        case 'progress_delete':
          response = toCommandResponse(
            await handleProgressDeleteCommand(ctx, config, dependencies, parsedCommand.command.args, correlationId)
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

export async function resolveCallbackQueryResponse(
  ctx: Context,
  config: AppConfig,
  dependencies: CreateBotDependencies,
  callbackData: string,
  correlationId: string
): Promise<CommandResponse | null> {
  const goalId = parseGoalDetailsCallbackData(callbackData);
  if (goalId === null) {
    return null;
  }

  const responseText = await handleGoalDetailsCommand(ctx, config, dependencies, { id: goalId }, correlationId);
  return toCommandResponse(responseText);
}
