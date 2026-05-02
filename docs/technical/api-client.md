# API Client

## Single client rule

- Use one centralized API client module for all outbound requests to `goals-tracker-api`.
- Do not scatter endpoint calls across handlers.

## Approved stack

- Generate OpenAPI-based types with `openapi-typescript`.
- Build HTTP calls through `openapi-fetch` using generated `paths` types.
- Use native Node.js `fetch` under the hood (provided by runtime).

## Contract source

- `../goals-tracker-api/swagger.yaml` is the canonical source for request/response shapes.
- Bot must not maintain manually duplicated API schemas.

## Types generation workflow

1. Regenerate types when `swagger.yaml` changes.
2. Commit updated generated typings in the bot repository.
3. Update API client mappings/tests in the same change.

Example command:

```bash
npx openapi-typescript ../goals-tracker-api/swagger.yaml -o src/api/generated/schema.d.ts
```

## Required request metadata

- `Authorization: Bearer <GOALS_API_SERVICE_TOKEN>`
- `X-Telegram-User-Id` for user-scoped goal/progress operations
- Request-level correlation ID for tracing (header name is implementation-defined)

## Header injection strategy

- Configure header injection in `openapi-fetch` middleware so every request carries auth + identity metadata by default.
- Keep user-scoped context (`telegram_user_id`, correlation id) explicit at handler boundary and pass it into API client factory.

## Error normalization

Map transport + HTTP failures into a bot-internal error model:

- `AuthError` (401)
- `ValidationError` (400)
- `NotFoundError` (404)
- `ConflictError` (409)
- `TransientUpstreamError` (timeout/network/5xx)

This normalization is used by command handlers to produce user-facing text.

## Retry policy

- Retry only `TransientUpstreamError` (timeout, network failure, 5xx). Never retry `400`, `401`, `404`, `409`.
- Up to 3 attempts (1 initial + 2 retries). Fixed exponential backoff: 100 ms then 200 ms.
- All HTTP methods are retried, including mutations. The duplicate-effect risk on retried `POST`/`PATCH`/`DELETE` is accepted at MVP; the API returns `409` on duplicates which renders as a user-friendly conflict message.
- Each retry attempt is logged via `console.warn('[api] retrying transient failure', { method, path, attempt, nextDelayMs, errorName, status })`.
- Defaults are module-level constants in `src/api/client.ts`. They can be overridden per client instance via the `retry` option on `createGoalsApiClient` (used by tests). No env-var configuration is provided at MVP.

## Notes for openapi-fetch usage

- Prefer endpoint calls typed by path/method instead of custom ad-hoc request builders.
- Keep normalization centralized so command handlers work with domain-level bot errors, not raw transport details.

## Contract sync workflow

Before changing request/response mapping:

1. Verify endpoint and schema in `../goals-tracker-api/swagger.yaml`.
2. Verify domain intent in `../goals-tracker-api/docs/business-spec/05-api-contracts-mvp.md`.
3. Update bot docs/tests in the same change.
