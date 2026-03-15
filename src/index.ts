import dotenv from 'dotenv';

import { buildSafeConfigSummary, ConfigValidationError, loadConfig, type AppConfig } from './config';

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

if (require.main === module) {
  dotenv.config();
  try {
    start();
  } catch (error) {
    handleStartupError(error);
  }
}
