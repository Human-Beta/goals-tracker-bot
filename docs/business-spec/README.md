# Bot Business Spec (Modular)

This folder is the main business-logic context for agents working in `goals-tracker-bot`.
Start here, then open only the domain files that match your task.

## How to use during changes

1. Identify the bot domain you are changing (auth, endpoint mapping, messaging, retries, etc.).
2. Read only the matching domain file(s) from the map below.
3. If a change crosses domains, read all linked files before implementation.

## Domain map

- Bot/API responsibility boundaries: [01-bot-role-and-boundaries.md](./01-bot-role-and-boundaries.md)
- Auth and identity propagation rules: [02-auth-and-identity-propagation.md](./02-auth-and-identity-propagation.md)
- Bot flows -> API endpoints (MVP): [03-endpoints-mapping-mvp.md](./03-endpoints-mapping-mvp.md)
- Validation/error mapping to user messages: [04-validation-and-user-messages.md](./04-validation-and-user-messages.md)
- Rendering metrics from API response: [05-metrics-rendering-rules.md](./05-metrics-rendering-rules.md)
- Failure handling, retry, idempotency expectations: [06-failure-and-retry-policy.md](./06-failure-and-retry-policy.md)
- Deferred bot items after MVP: [07-post-mvp-roadmap.md](./07-post-mvp-roadmap.md)

## Fallback reference

Use [../project-business-spec.md](../project-business-spec.md) only when a modular domain file is missing required context.

## Canonical API sources

- `../goals-tracker-api/swagger.yaml`
- `../goals-tracker-api/docs/business-spec/05-api-contracts-mvp.md`
- `../goals-tracker-api/docs/business-spec/06-computed-metrics.md`
