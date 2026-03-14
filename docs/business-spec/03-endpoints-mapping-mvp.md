# Endpoint Mapping (MVP)

This file maps bot intents/flows to backend API endpoints.

## User bootstrap flow

- Bot receives first meaningful user interaction.
- Bot calls `POST /bot/users/upsert` with `telegram_user_id` and user timezone.
- Bot stores internal `user_id` only if needed for local correlation; API remains source of truth.

## Goal lifecycle flows

- Create goal -> `POST /goals`
- List goals -> `GET /goals`
- Goal details -> `GET /goals/{goalId}`
- Edit goal -> `PATCH /goals/{goalId}`

## Progress flows

- Add progress event -> `POST /goals/{goalId}/progress`
- View progress history -> `GET /goals/{goalId}/progress?from=&to=&sort=`
- Correct progress event -> `PATCH /goals/{goalId}/progress/{eventId}`
- Delete incorrect event -> `DELETE /goals/{goalId}/progress/{eventId}`

## Mandatory contract checks

Before changing bot request/response mapping, verify against:

- `../goals-tracker-api/swagger.yaml`
- `../goals-tracker-api/docs/business-spec/05-api-contracts-mvp.md`
