# Bot Role and Boundaries (MVP)

## System split

- `goals-tracker-bot` owns Telegram update parsing, command routing, API orchestration, and user-facing text.
- `goals-tracker-api` owns domain validation, persistence, computed metrics, and authoritative business rules.

## Non-goals for bot layer

- The bot must not duplicate goal/progress validation rules owned by API.
- The bot must not calculate domain metrics independently when API already provides them.
- The bot must not bypass API and directly access database.

## Integration contract principle

- API contracts are source of truth.
- Any bot-side behavior that depends on payload shape/status codes must be traceable to:
  - `../goals-tracker-api/swagger.yaml`
  - `../goals-tracker-api/docs/business-spec/05-api-contracts-mvp.md`

## Ownership rule during incidents

- Transport failures (Telegram/API connectivity, timeout, network errors) are bot responsibility.
- Domain failures (`400`, `404`, `409` from API rules) are API decisions; bot only maps them into clear user messages.
