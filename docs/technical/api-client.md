# API Client

## Single client rule

- Use one centralized API client module for all outbound requests to `goals-tracker-api`.
- Do not scatter endpoint calls across handlers.

## Required request metadata

- `Authorization: Bearer <GOALS_API_SERVICE_TOKEN>`
- `X-Telegram-User-Id` for user-scoped goal/progress operations
- Request-level correlation ID for tracing (header name is implementation-defined)

## Error normalization

Map transport + HTTP failures into a bot-internal error model:

- `AuthError` (401)
- `ValidationError` (400)
- `NotFoundError` (404)
- `ConflictError` (409)
- `TransientUpstreamError` (timeout/network/5xx)

This normalization is used by command handlers to produce user-facing text.

## Contract sync workflow

Before changing request/response mapping:

1. Verify endpoint and schema in `../goals-tracker-api/swagger.yaml`.
2. Verify domain intent in `../goals-tracker-api/docs/business-spec/05-api-contracts-mvp.md`.
3. Update bot docs/tests in the same change.
