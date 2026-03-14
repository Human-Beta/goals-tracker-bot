# Testing Strategy

## MVP test layers

- Unit tests for command parsing, routing, and message mapping.
- Unit tests for API client request/response normalization.
- Integration-style tests for update -> API call -> user response (API mocked).

## Contract checks

- Keep fixtures aligned with `swagger.yaml` for core endpoints.
- Add regression tests for known API error mappings (`400`, `401`, `404`, `409`).

## Recommended scenarios

- Happy path: create goal, add progress, show metrics.
- Validation error: bad date or value.
- Conflict error: domain invariant violation.
- Transient failure: timeout with retry + user fallback text.
