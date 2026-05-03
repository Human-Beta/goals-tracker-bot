# Testing Strategy

## MVP test layers

- Unit tests for command parsing, routing, and message mapping.
- Unit tests for API client request/response normalization and header injection middleware.
- Integration-style tests for update -> API call -> user response (API mocked).

## Contract checks

- Keep generated types and fixtures aligned with `../goals-tracker-api/swagger.yaml` for core endpoints.
- Add regression tests for known API error mappings (`400`, `401`, `404`, `409`).

### Generated API types regression check

`npm run check:api-types` regenerates the OpenAPI types from `../goals-tracker-api/swagger.yaml` into a temporary file and byte-compares the result with the committed `src/api/generated/schema.d.ts`. If they differ, the script exits with code `1` and tells the developer to run `npm run generate:api-types` and commit the refreshed schema.

The check is wired into the `test` script (`npm run check:api-types && vitest run`), so it runs before vitest both locally and via the `pre-push` hook. The regeneration is fast (~1–2s) and the temporary directory is cleaned up via `try/finally`.

When `swagger.yaml` is missing (e.g. fresh clone without the sibling `goals-tracker-api` repo, or a Docker build without it), the script prints a warning and exits `0`. CI environments that should fail closed instead can opt in by setting `STRICT_API_CHECK=1`, which turns the missing-swagger case into a hard error.

If the check fails:

1. Run `npm run generate:api-types`.
2. Inspect the diff in `src/api/generated/schema.d.ts` and update API client mappings/tests if the change is non-trivial.
3. Commit the refreshed schema in the same change.

## Recommended scenarios

- Happy path: create goal, add progress, show metrics.
- Validation error: bad date or value.
- Conflict error: domain invariant violation.
- Transient failure: timeout with retry + user fallback text.
- Missing identity metadata: ensure user-scoped endpoints include `X-Telegram-User-Id`.
