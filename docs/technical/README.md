# Technical Docs

This folder contains implementation and runtime documentation for `goals-tracker-bot`.

## Contents

- [runtime-config.md](./runtime-config.md) - environment variables, startup validation, polling/webhook modes.
- [api-client.md](./api-client.md) - `openapi-typescript` + `openapi-fetch` integration rules, headers, error normalization.
- [testing.md](./testing.md) - test pyramid, typed client checks, and contract regression checks.
- [observability.md](./observability.md) - logging and minimal operational signals.

## Approved API Integration Stack (MVP)

- Contract source: `../goals-tracker-api/swagger.yaml`
- Types generation: `openapi-typescript`
- Typed client runtime: `openapi-fetch` over native Node.js `fetch`
- One centralized API client with middleware for auth/user headers and correlation ID

## External references

- `../goals-tracker-api/swagger.yaml`
- `../goals-tracker-api/docs/business-spec/05-api-contracts-mvp.md`
- `../goals-tracker-api/docs/business-spec/06-computed-metrics.md`
