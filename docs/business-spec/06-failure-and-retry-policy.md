# Failure and Retry Policy

## Error categories

- Transient transport failures: timeout, DNS, temporary 5xx.
- Permanent request failures: 4xx from valid API response.

## Retry policy (MVP)

- Retry only transient failures (timeout, network failure, 5xx).
- Do not retry `400`, `401`, `404`, `409`.
- Up to 3 attempts (1 initial + 2 retries). Backoff 100 ms then 200 ms.
- All HTTP methods, including mutations, are retried. Correlation ID is propagated via `X-Correlation-Id` for post-mortem traceability.

## Idempotency expectations

- Bot commands that create/update data should avoid duplicate submissions when user resends quickly.
- Prefer explicit confirmation flow for ambiguous repeated actions.
- For retries on mutating requests, log correlation ID and user context for post-mortem traceability.

## Timeout and fallback

- Keep API timeout finite and user-friendly.
- On timeout, return clear message: temporary issue, suggest retry.

## Observability requirement

- Log request intent, endpoint, status code, and duration.
- Never log secrets.
