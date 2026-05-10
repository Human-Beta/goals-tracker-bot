# Runtime Configuration

## Required environment variables (MVP)

- `TELEGRAM_BOT_TOKEN` - Telegram bot API token.
- `GOALS_API_BASE_URL` - base URL for `goals-tracker-api`.
- `GOALS_API_SERVICE_TOKEN` - service bearer token for bot->API calls.

## Recommended optional variables

- `LOG_LEVEL` - log verbosity (`info` default).
- `HTTP_TIMEOUT_MS` - outbound API timeout.
- `BOT_MODE` - `polling` or `webhook` (default `polling`).

## Webhook-mode variables

These are validated only when `BOT_MODE=webhook`, so polling-only development
does not require setting them.

- `BOT_WEBHOOK_PORT` - HTTP listener port for incoming Telegram updates.
  Optional, defaults to `8080`. Must be a positive integer.
- `BOT_WEBHOOK_PUBLIC_URL` - the public HTTPS URL the operator has registered
  with Telegram (`setWebhook`). Required when `BOT_MODE=webhook`. Used for
  startup logging and operator confirmation.
- `BOT_WEBHOOK_SECRET_PATH` - the URL path the bot accepts Telegram updates on
  (for example `/tg/<random>`). Required when `BOT_MODE=webhook`. Must start
  with `/`. Acts as an obscurity layer: requests to other paths return 404.

## BOT_MODE guidance

- Use `polling` for local development and manual testing.
- Use `webhook` for production deployments (including serverless platforms).
- Keep a single active delivery mode per bot token (do not run polling while
  webhook is configured). The bot process itself starts exactly one of polling
  or webhook based on `BOT_MODE`.
- Webhook registration with Telegram (`setWebhook`) is performed out-of-band by
  the operator. The bot only listens for incoming updates on the configured
  port and path.

## Startup checks

- Validate required envs at process start.
- Fail fast with clear error if required config is missing.
- Print safe config summary (without secrets).
