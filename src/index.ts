import dotenv from 'dotenv';
import type { Bot, Context } from 'grammy';

import { buildSafeConfigSummary, ConfigValidationError, loadConfig, type AppConfig } from './config';
import { createBot as defaultCreateBot } from './bot/create-bot';
import {
  resolveWebhookRuntimeConfig,
  startWebhook as defaultStartWebhook,
  type WebhookHandle,
  type WebhookRuntimeConfig,
} from './bot/webhook-entrypoint';

export function start(rawEnv: NodeJS.ProcessEnv = process.env): AppConfig {
  const appConfig = loadConfig(rawEnv);
  console.info('Runtime config summary', buildSafeConfigSummary(appConfig));
  console.info('goals-tracker-bot bootstrap started');
  return appConfig;
}

function handleStartupError(error: unknown): never {
  if (error instanceof ConfigValidationError) {
    console.error('Runtime configuration is invalid. Fix the following environment variables:');
    for (const issue of error.issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  throw error;
}

function defaultStartPolling(bot: Bot<Context>): void {
  void bot.start({
    onStart: botInfo => {
      console.info(`Bot polling started for @${botInfo.username}`);
    },
  });
}

export type RunBotDependencies = {
  createBot?: (config: AppConfig) => Bot<Context>;
  startPolling?: (bot: Bot<Context>) => void;
  startWebhook?: (bot: Bot<Context>, webhookConfig: WebhookRuntimeConfig) => Promise<WebhookHandle>;
};

export function runBot(appConfig: AppConfig, deps: RunBotDependencies = {}): void {
  const create = deps.createBot ?? defaultCreateBot;
  const bot = create(appConfig);

  if (appConfig.BOT_MODE === 'polling') {
    const startPolling = deps.startPolling ?? defaultStartPolling;
    startPolling(bot);
    return;
  }

  const startWebhook = deps.startWebhook ?? defaultStartWebhook;
  const webhookConfig = resolveWebhookRuntimeConfig(appConfig);
  void startWebhook(bot, webhookConfig);
}

if (require.main === module) {
  dotenv.config();
  try {
    const appConfig = start();
    runBot(appConfig);
  } catch (error) {
    handleStartupError(error);
  }
}
