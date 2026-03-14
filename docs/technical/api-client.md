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

## Notes for openapi-fetch usage

- Prefer endpoint calls typed by path/method instead of custom ad-hoc request builders.
- Keep normalization centralized so command handlers work with domain-level bot errors, not raw transport details.

## Contract sync workflow

Before changing request/response mapping:

1. Verify endpoint and schema in `../goals-tracker-api/swagger.yaml`.
2. Verify domain intent in `../goals-tracker-api/docs/business-spec/05-api-contracts-mvp.md`.
3. Update bot docs/tests in the same change.
