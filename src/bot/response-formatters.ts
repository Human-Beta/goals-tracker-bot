import type { components } from '../api/generated/schema';
import { GOAL_DETAILS_ETA_NULL_EXPLANATION } from './messages';

type GoalBase = components['schemas']['GoalBase'];
type GoalListItem = components['schemas']['GoalListItem'];
type GoalDetail = components['schemas']['GoalDetail'];

function formatLabelValueLines(lines: ReadonlyArray<readonly [label: string, value: string | number]>): string {
  return lines.map(([label, value]) => `${label}: ${value}`).join('\n');
}

function formatGoalDetailsMetricValue(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return (Math.round(value * 10) / 10).toFixed(1);
}

function formatCommandTextArg(value: string): string {
  const isSimpleToken = /^[^\s"=]+$/.test(value);
  if (isSimpleToken) {
    return value;
  }

  const escapedValue = value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  return `"${escapedValue}"`;
}

export function formatGoalTitleCommandLabel(title: string): string {
  return `/goal title=${formatCommandTextArg(title)}`;
}

export function formatGoalCreateSuccessResponse(goal: GoalBase): string {
  return [
    'Goal created successfully:',
    formatLabelValueLines([
      ['id', goal.id],
      ['title', goal.title],
      ['target', goal.target_value],
      ['end_date', goal.end_date],
    ]),
  ].join('\n');
}

export function formatGoalsListResponse(items: GoalListItem[]): string {
  const formattedItems = items.map(goal =>
    formatLabelValueLines([
      ['id', goal.id],
      ['title', goal.title],
      ['percent_complete', goal.percent_complete],
      ['days_left', goal.days_left],
      ['pace_current_7d', goal.pace_current_7d],
    ])
  );

  return formattedItems.join('\n\n');
}

export function formatGoalDetailsResponse(goal: GoalDetail): string {
  const etaLines =
    goal.eta_date === null
      ? ([
          ['eta_date', 'null'],
          ['eta_note', GOAL_DETAILS_ETA_NULL_EXPLANATION],
        ] as const)
      : ([['eta_date', goal.eta_date]] as const);

  return formatLabelValueLines([
    ['id', goal.id],
    ['title', goal.title],
    ['percent_complete', formatGoalDetailsMetricValue(goal.percent_complete)],
    ['current_value', formatGoalDetailsMetricValue(goal.current_value)],
    ['remaining_value', formatGoalDetailsMetricValue(goal.remaining_value)],
    ['days_left', formatGoalDetailsMetricValue(goal.days_left)],
    ['pace_current_7d', formatGoalDetailsMetricValue(goal.pace_current_7d)],
    ['pace_required_per_day', formatGoalDetailsMetricValue(goal.pace_required_per_day)],
    ...etaLines,
    ['behind_value', formatGoalDetailsMetricValue(goal.behind_value)],
  ]);
}
