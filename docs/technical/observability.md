# Observability

## Logging

Log at least:

- Telegram update identifier and command intent.
- API endpoint/method, status code, duration.
- Retry attempts and final outcome.

Do not log secrets or full tokens.

## Minimal health signals

- Command success/failure counts.
- API error rate by status class.
- Timeout rate and retry success rate.

## Incident debugging baseline

- Correlation ID propagation across bot internal logs and outbound API requests.
- Include user context identifiers in a privacy-safe form.
