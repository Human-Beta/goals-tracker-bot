import type { components } from '../api/generated/schema';
import { formatProgressListTruncatedNotice, goalDetailsMessages, PROGRESS_LIST_DISPLAY_LIMIT } from './messages';

type GoalBase = components['schemas']['GoalBase'];
type GoalListItem = components['schemas']['GoalListItem'];
type GoalDetail = components['schemas']['GoalDetail'];
type ProgressEvent = components['schemas']['ProgressEvent'];

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

export function formatGoalEditSuccessResponse(goal: GoalBase): string {
  return [
    'Goal updated successfully:',
    formatLabelValueLines([
      ['id', goal.id],
      ['title', goal.title],
      ['target', goal.target_value],
      ['start_date', goal.start_date],
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

export function formatProgressAddSuccessResponse(event: ProgressEvent): string {
  return [
    'Progress recorded:',
    formatLabelValueLines([
      ['id', event.id],
      ['goal_id', event.goal_id],
      ['date', event.date],
      ['delta_value', event.delta_value],
    ]),
  ].join('\n');
}

export function formatProgressEditSuccessResponse(event: ProgressEvent): string {
  const rows: Array<readonly [label: string, value: string | number]> = [
    ['id', event.id],
    ['goal_id', event.goal_id],
    ['date', event.date],
    ['delta_value', event.delta_value],
  ];

  if (typeof event.note === 'string' && event.note.length > 0) {
    rows.push(['note', event.note]);
  }

  return ['Progress event updated:', formatLabelValueLines(rows)].join('\n');
}

export function formatProgressListResponse(items: ProgressEvent[]): string {
  const visibleItems = items.slice(0, PROGRESS_LIST_DISPLAY_LIMIT);
  const formattedItems = visibleItems.map(item => {
    const rows: Array<readonly [label: string, value: string | number]> = [
      ['event_id', item.id],
      ['date', item.date],
      ['delta_value', item.delta_value],
    ];

    if (typeof item.note === 'string' && item.note.length > 0) {
      rows.push(['note', item.note]);
    }

    return formatLabelValueLines(rows);
  });

  const sections: string[] = ['Progress history:', formattedItems.join('\n\n')];

  if (items.length > PROGRESS_LIST_DISPLAY_LIMIT) {
    sections.push(formatProgressListTruncatedNotice(visibleItems.length, items.length));
  }

  return sections.join('\n\n');
}

export function formatGoalDetailsResponse(goal: GoalDetail): string {
  const etaLines =
    goal.eta_date === null
      ? ([
          ['eta_date', 'null'],
          ['eta_note', goalDetailsMessages.etaNullExplanation],
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
