import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { webhookCallback, type Bot, type Context } from 'grammy';

import type { AppConfig } from '../config';
import { log } from '../shared/logger';

export type WebhookRuntimeConfig = {
  port: number;
  publicUrl: string;
  secretPath: string;
};

export type WebhookHandle = {
  port: number;
  close: () => Promise<void>;
};

export function resolveWebhookRuntimeConfig(appConfig: AppConfig): WebhookRuntimeConfig {
  if (appConfig.BOT_WEBHOOK_PUBLIC_URL === undefined || appConfig.BOT_WEBHOOK_SECRET_PATH === undefined) {
    throw new Error('BOT_WEBHOOK_PUBLIC_URL and BOT_WEBHOOK_SECRET_PATH must be set when BOT_MODE=webhook');
  }

  return {
    port: appConfig.BOT_WEBHOOK_PORT,
    publicUrl: appConfig.BOT_WEBHOOK_PUBLIC_URL,
    secretPath: appConfig.BOT_WEBHOOK_SECRET_PATH,
  };
}

export async function startWebhook(bot: Bot<Context>, webhookConfig: WebhookRuntimeConfig): Promise<WebhookHandle> {
  await bot.init();

  const handleUpdate = webhookCallback(bot, 'http');

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'POST' && req.url === webhookConfig.secretPath) {
      void handleUpdate(req, res);
      return;
    }

    res.writeHead(404).end();
  });

  const boundPort = await listen(server, webhookConfig.port);

  log('info', 'webhook_started', {
    port: boundPort,
    public_url: webhookConfig.publicUrl,
    secret_path_set: true,
  });

  return {
    port: boundPort,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close(error => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

function listen(server: Server, port: number): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.off('error', onError);
      const address = server.address();
      if (address !== null && typeof address === 'object') {
        resolve((address as AddressInfo).port);
        return;
      }
      resolve(port);
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen({ port, host: '0.0.0.0' });
  });
}
