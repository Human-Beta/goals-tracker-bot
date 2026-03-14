# Runtime Configuration

## Required environment variables (MVP)

- `TELEGRAM_BOT_TOKEN` - Telegram bot API token.
- `GOALS_API_BASE_URL` - base URL for `goals-tracker-api`.
- `GOALS_API_SERVICE_TOKEN` - service bearer token for bot->API calls.

## Recommended optional variables

- `LOG_LEVEL` - log verbosity (`info` default).
- `HTTP_TIMEOUT_MS` - outbound API timeout.
- `BOT_MODE` - `polling` or `webhook`.

## Startup checks

- Validate required envs at process start.
- Fail fast with clear error if required config is missing.
- Print safe config summary (without secrets).
