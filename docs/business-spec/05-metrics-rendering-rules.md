# Metrics Rendering Rules

## Source of truth

- Computed metrics are produced by API (`GET /goals/{goalId}` response).
- Bot should display metrics, not recompute formulas independently.

## MVP display set (recommended)

From API response, prefer exposing:

- `percent_complete`
- `current_value`, `remaining_value`
- `days_left`
- `pace_current_7d`
- `pace_required_per_day`
- `eta_date` (if not null)
- `behind_value`

## Rendering guidance

- Round for readability only in presentation layer.
- Preserve semantic meaning of signs (for example negative `behind_value` means ahead of schedule).
- If `eta_date` is `null`, explain that current pace is insufficient to estimate completion.

## Reference

- `../goals-tracker-api/docs/business-spec/06-computed-metrics.md`
