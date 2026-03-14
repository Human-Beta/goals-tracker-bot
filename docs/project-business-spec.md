# Bot Project Business Spec (Fallback)

This document is a fallback overview for bot contributors and AI agents.
Prefer modular docs in `docs/business-spec/` for day-to-day work.

## Mission

`goals-tracker-bot` provides Telegram UX and orchestrates calls to `goals-tracker-api`.
It does not own core domain validation or persistence.

## Canonical API source

Use these as source of truth:

- `../goals-tracker-api/swagger.yaml`
- `../goals-tracker-api/docs/business-spec/01-auth-and-access.md`
- `../goals-tracker-api/docs/business-spec/05-api-contracts-mvp.md`
- `../goals-tracker-api/docs/business-spec/06-computed-metrics.md`

## MVP behavior summary

- Ensure user context is propagated to API (`telegram_user_id` + service token).
- Call API endpoints for user upsert, goal CRUD reads/writes, and progress CRUD.
- Convert API responses and domain errors into clear Telegram messages.
- Render metrics returned by API; avoid duplicate metric formulas in bot.
