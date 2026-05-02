import { defineApiErrorMessages } from './api-error-handler';

export const startMessages = defineApiErrorMessages({
  success: 'You are all set. Timezone saved:',
  validation: 'Please provide a valid IANA timezone. Example: /start timezone=Europe/Kyiv',
  fallback: 'Temporary issue while saving your profile. Please try again later.',
  logContext: 'failed to upsert user on /start',
});

export const goalCreateMessages = defineApiErrorMessages({
  validation:
    'Could not create the goal. Please check title, unit, target, and date format (YYYY-MM-DD), then try again.',
  fallback: 'Temporary issue while creating your goal. Please try again later.',
  logContext: 'failed to create goal on /goal_create',
});

export const goalsListMessages = defineApiErrorMessages({
  empty: "You don't have any goals yet. Create one with /goal_create.",
  auth: 'Temporary technical issue while loading your goals. Please try again later.',
  notFound: 'Could not find your profile context. Run /start timezone=<IANA> and then try /goals again.',
  fallback: 'Temporary issue while loading your goals. Please try again later.',
  logContext: 'failed to list goals on /goals',
});

export const goalDetailsMessages = defineApiErrorMessages({
  auth: 'Temporary technical issue while loading your goal details. Please try again later.',
  notFound: 'Goal not found. Run /goals to check available goal IDs and try again.',
  fallback: 'Temporary issue while loading your goal details. Please try again later.',
  etaNullExplanation: 'ETA cannot be estimated at the current pace.',
  logContext: 'failed to get goal details on /goal',
});

export const goalEditMessages = defineApiErrorMessages({
  validation: 'Could not update the goal. Please check title, target, and date format (YYYY-MM-DD), then try again.',
  nothingToUpdate: 'Nothing to update. Provide at least one of: title, target, start, end.',
  immutableUnit:
    'Goal unit cannot be changed after the goal is created. Create a new goal with /goal_create to use a different unit.',
  notFound: 'Goal not found. Run /goals to check available goal IDs and try again.',
  conflict:
    'Could not apply this update because it conflicts with the goal state (for example, target below current progress). Please review the values and try again.',
  auth: 'Temporary technical issue while updating your goal. Please try again later.',
  fallback: 'Temporary issue while updating your goal. Please try again later.',
  logContext: 'failed to edit goal on /goal_edit',
});

export const progressAddMessages = defineApiErrorMessages({
  validation:
    'Could not record progress. Please check that delta is a positive number and date is in YYYY-MM-DD format, then try again.',
  notFound: 'Goal not found. Run /goals to check available goal IDs and try again.',
  auth: 'Temporary technical issue while recording your progress. Please try again later.',
  fallback: 'Temporary issue while recording your progress. Please try again later.',
  logContext: 'failed to record progress on /progress_add',
});

export const PROGRESS_LIST_DISPLAY_LIMIT = 20;

export function formatProgressListTruncatedNotice(shown: number, total: number): string {
  return `Showing first ${shown} of ${total} events. Use from=YYYY-MM-DD and to=YYYY-MM-DD to narrow the date range.`;
}

export const progressListMessages = defineApiErrorMessages({
  validation:
    'Could not load progress events. Please check that from/to are in YYYY-MM-DD format and from is on or before to.',
  empty: 'No progress events found for this goal. Record progress with /progress_add goal=<uuid> delta=<number>.',
  notFound: 'Goal not found. Run /goals to check available goal IDs and try again.',
  auth: 'Temporary technical issue while loading progress history. Please try again later.',
  fallback: 'Temporary issue while loading progress history. Please try again later.',
  logContext: 'failed to list progress on /progress_list',
});

export const progressEditMessages = defineApiErrorMessages({
  validation:
    'Could not update the progress event. Please check that delta is a number, date is in YYYY-MM-DD format, and note is non-empty, then try again.',
  nothingToUpdate: 'Nothing to update. Provide at least one of: delta, date, note.',
  notFound: 'Progress event not found. Run /progress_list goal=<uuid> to check available event IDs and try again.',
  conflict:
    'Could not apply this update because it conflicts with the goal state. Please review the values and try again.',
  auth: 'Temporary technical issue while updating your progress event. Please try again later.',
  fallback: 'Temporary issue while updating your progress event. Please try again later.',
  logContext: 'failed to edit progress on /progress_edit',
});

export const progressDeleteMessages = defineApiErrorMessages({
  success: 'Progress event deleted.',
  notFound: 'Progress event not found. Run /progress_list goal=<uuid> to check available event IDs and try again.',
  auth: 'Temporary technical issue while deleting your progress event. Please try again later.',
  fallback: 'Temporary issue while deleting your progress event. Please try again later.',
  logContext: 'failed to delete progress on /progress_delete',
});
