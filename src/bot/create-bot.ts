import * as crypto from 'node:crypto';

import { Bot, type Context } from 'grammy';

import type { AppConfig } from '../config';
import { log } from '../shared/logger';
import { parseCommandText, type CommandParseResult } from './commands/command-parser';
import { resolveCallbackQueryResponse, resolveCommandResponse } from './commands/command-dispatch';
import type { CreateBotDependencies } from './goals-client-context';

const CALLBACK_COMMAND_NAME = 'goal_details_callback';

function describeCommand(parsed: CommandParseResult): string {
  switch (parsed.kind) {
    case 'known_command':
      return parsed.command.name;
    case 'invalid_command':
      return parsed.commandName;
    case 'unknown_command':
      return 'unknown';
    case 'not_command':
      return 'not_command';
  }
}

export function createBot(config: AppConfig, dependencies: CreateBotDependencies = {}): Bot<Context> {
  const bot = new Bot<Context>(config.TELEGRAM_BOT_TOKEN);

  bot.on('message:text', async ctx => {
    const correlationId = crypto.randomUUID();
    const updateId = ctx.update.update_id;
    const parsedCommand = parseCommandText(ctx.message.text);
    const commandName = describeCommand(parsedCommand);
    const startedAt = Date.now();

    log('info', 'update_received', {
      update_id: updateId,
      correlation_id: correlationId,
      kind: 'message_text',
      command_name: commandName,
    });

    try {
      const response = await resolveCommandResponse(
        ctx,
        config,
        dependencies,
        ctx.message.text,
        parsedCommand,
        correlationId
      );
      await ctx.reply(response.text, response.replyOptions);

      log('info', 'update_completed', {
        update_id: updateId,
        correlation_id: correlationId,
        command_name: commandName,
        outcome: 'success',
        duration_ms: Date.now() - startedAt,
      });
    } catch (error) {
      log('error', 'update_failed', {
        update_id: updateId,
        correlation_id: correlationId,
        command_name: commandName,
        outcome: 'error',
        error_name: error instanceof Error ? error.name : 'UnknownError',
        duration_ms: Date.now() - startedAt,
      });
      throw error;
    }
  });

  bot.on('callback_query:data', async ctx => {
    const correlationId = crypto.randomUUID();
    const updateId = ctx.update.update_id;
    const startedAt = Date.now();

    log('info', 'update_received', {
      update_id: updateId,
      correlation_id: correlationId,
      kind: 'callback_query',
      command_name: CALLBACK_COMMAND_NAME,
    });

    try {
      const response = await resolveCallbackQueryResponse(
        ctx,
        config,
        dependencies,
        ctx.callbackQuery.data,
        correlationId
      );

      await ctx.answerCallbackQuery();

      if (response !== null) {
        await ctx.reply(response.text, response.replyOptions);
      }

      log('info', 'update_completed', {
        update_id: updateId,
        correlation_id: correlationId,
        command_name: CALLBACK_COMMAND_NAME,
        outcome: 'success',
        duration_ms: Date.now() - startedAt,
      });
    } catch (error) {
      log('error', 'update_failed', {
        update_id: updateId,
        correlation_id: correlationId,
        command_name: CALLBACK_COMMAND_NAME,
        outcome: 'error',
        error_name: error instanceof Error ? error.name : 'UnknownError',
        duration_ms: Date.now() - startedAt,
      });
      throw error;
    }
  });

  return bot;
}
