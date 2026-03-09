# Goal Tracker Bot

Telegram bot for the Goal Tracker ecosystem.

Current status: bootstrap documentation stage. Runtime implementation is expected to be added incrementally.

## Related Repositories

- Bot (this repository): Telegram bot behavior, update handling, and API integration.
- API (reference repository): backend domain logic and data access.
- API GitHub URL: [goals-tracker-api](https://github.com/Human-Beta/goals-tracker-api)

## Responsibility Split

- `goals-tracker-bot`: receives Telegram updates, validates user intent, calls backend API, and renders user-facing responses.
- `goals-tracker-api`: owns business rules, persistence, and HTTP API contracts used by the bot.

This repository is the edit target. API repository files are used as a reference source.

## Integration Model

- The bot communicates with the backend over HTTP API endpoints exposed by `goals-tracker-api`.
- API request/response contracts should stay compatible with the API repository.
- When implementation details are needed, read API files via: `../goals-tracker-api`.

## Local Multi-Repo Layout

Expected local structure:

```text
../goals-tracker-bot
../goals-tracker-api
```

Reference API paths from this repository using:

```text
../goals-tracker-api
```

## Suggested Architecture (High Level)

### 1) Command and Update Handlers

- Parse Telegram updates and route commands/messages to use cases.
- Keep transport-level concerns (Telegram payload mapping) separate from business-facing orchestration.

### 2) API Client Layer

- Centralize outbound HTTP calls to `goals-tracker-api`.
- Keep endpoint paths, payload mapping, and error mapping in one place.

### 3) Configuration and Environment

- Centralize runtime configuration (tokens, base URLs, timeouts).
- Fail fast on missing required environment variables.

### 4) Error Handling and Logging

- Normalize API and transport errors before returning user-facing messages.
- Add structured logging for update lifecycle and API call failures.

### 5) Testing Strategy (Placeholder)

- Unit tests for command routing and API client behavior.
- Integration-style tests for update-to-response flows with mocked API boundaries.
- Contract checks against API request/response assumptions where practical.

## Practical Next Steps

1. Scaffold bot runtime entrypoint and Telegram update polling/webhook adapter.
2. Define API client module with base URL configuration and request helpers.
3. Implement first end-to-end bot command that calls a stable API endpoint.
4. Add baseline test setup for handlers and API client.
5. Add environment template and startup validation.

## Working Agreement

- `goals-tracker-bot` is the only mutation target in this workflow.
- `goals-tracker-api` is a reference repository, accessed locally via `../goals-tracker-api`.
