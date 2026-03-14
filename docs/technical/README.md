# Technical Docs

This folder contains implementation and runtime documentation for `goals-tracker-bot`.

## Contents

- [runtime-config.md](./runtime-config.md) - environment variables, startup validation, polling/webhook modes.
- [api-client.md](./api-client.md) - HTTP client rules for `goals-tracker-api`, headers, error normalization.
- [testing.md](./testing.md) - test pyramid and contract checks against API assumptions.
- [observability.md](./observability.md) - logging and minimal operational signals.

## External references

- `../goals-tracker-api/swagger.yaml`
- `../goals-tracker-api/docs/business-spec/05-api-contracts-mvp.md`
- `../goals-tracker-api/docs/business-spec/06-computed-metrics.md`
