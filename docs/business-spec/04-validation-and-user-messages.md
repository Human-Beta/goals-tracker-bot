# Validation and User Message Mapping

Bot should map API error responses into concise and actionable user text.

## Input validation strategy

- Bot may do light pre-validation for UX (empty command arguments, obvious format errors).
- API remains authoritative for domain rules.

## HTTP status mapping

- `400 Bad Request`: invalid input format or validation error.
  - User-facing: ask user to correct specific field (date/number/title, etc.).
- `401 Unauthorized`: missing/invalid service auth.
  - User-facing: generic technical issue; suggest retry later.
  - Internal action: high-priority log/alert.
- `404 Not Found`: goal/event/user context missing.
  - User-facing: explain object not found and suggest refresh/list command.
- `409 Conflict`: domain invariant conflict (for example target lower than current progress).
  - User-facing: explain conflict and offer next valid action.

## Message quality rules

- No internal stack traces in user text.
- Keep user text short, concrete, and recovery-oriented.
- Include a clear next step where possible.
