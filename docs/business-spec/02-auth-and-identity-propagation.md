# Auth and Identity Propagation

## Bot -> API auth (service mode)

Every request from bot to API must include:

- `Authorization: Bearer <BOT_SERVICE_TOKEN>`
- Telegram identity context (`telegram_user_id`), sent either:
  - in `X-Telegram-User-Id` header (preferred for goal/progress endpoints), or
  - in request body where contract requires it (for `/bot/users/upsert`).

## Trust boundary

- API trusts telegram identity only when service token is valid.
- Bot must never log raw service token.

## Local environment expectations

- Bot runtime stores API base URL and service token in environment variables.
- Missing required auth config must fail fast at startup.

## Reference

- `../goals-tracker-api/docs/business-spec/01-auth-and-access.md`
- `../goals-tracker-api/swagger.yaml`
