import dotenv from 'dotenv';

import { buildSafeConfigSummary, ConfigValidationError, loadConfig, type AppConfig } from './config';
import { createBot } from './bot/create-bot';

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

function runBot(appConfig: AppConfig): void {
  if (appConfig.BOT_MODE !== 'polling') {
    console.warn(`BOT_MODE=${appConfig.BOT_MODE} is not implemented yet. Polling startup skipped.`);
    return;
  }

  const bot = createBot(appConfig);
  void bot.start({
    onStart: botInfo => {
      console.info(`Bot polling started for @${botInfo.username}`);
    },
  });
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
