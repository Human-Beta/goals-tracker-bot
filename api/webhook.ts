import type { IncomingMessage, ServerResponse } from 'node:http';

import { webhookCallback } from 'grammy';

import { createBot } from '../src/bot/create-bot';
import { loadConfig } from '../src/config';

const config = loadConfig(process.env);
const bot = createBot(config);

// Lazy init — resolved once per cold start, safe under concurrent requests
let initPromise: Promise<void> | null = null;
const ensureInitialized = (): Promise<void> => {
  initPromise ??= bot.init();
  return initPromise;
};

const handleUpdate = webhookCallback(bot, 'http');

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.writeHead(405).end();
    return;
  }

  await ensureInitialized();
  await handleUpdate(req, res);
}
