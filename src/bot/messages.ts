export const START_SUCCESS_MESSAGE = 'You are all set. Timezone saved:';
export const START_TIMEZONE_HINT = 'Please provide a valid IANA timezone. Example: /start timezone=Europe/Kyiv';
export const START_UPSTREAM_FALLBACK_MESSAGE = 'Temporary issue while saving your profile. Please try again later.';

export const GOAL_CREATE_VALIDATION_HINT =
  'Could not create the goal. Please check title, unit, target, and date format (YYYY-MM-DD), then try again.';
export const GOAL_CREATE_UPSTREAM_FALLBACK_MESSAGE =
  'Temporary issue while creating your goal. Please try again later.';

export const GOALS_LIST_EMPTY_MESSAGE = "You don't have any goals yet. Create one with /goal_create.";
export const GOALS_LIST_AUTH_ERROR_MESSAGE =
  'Temporary technical issue while loading your goals. Please try again later.';
export const GOALS_LIST_NOT_FOUND_MESSAGE =
  'Could not find your profile context. Run /start timezone=<IANA> and then try /goals again.';
export const GOALS_LIST_UPSTREAM_FALLBACK_MESSAGE = 'Temporary issue while loading your goals. Please try again later.';

export const GOAL_DETAILS_AUTH_ERROR_MESSAGE =
  'Temporary technical issue while loading your goal details. Please try again later.';
export const GOAL_DETAILS_NOT_FOUND_MESSAGE = 'Goal not found. Run /goals to check available goal IDs and try again.';
export const GOAL_DETAILS_UPSTREAM_FALLBACK_MESSAGE =
  'Temporary issue while loading your goal details. Please try again later.';
export const GOAL_DETAILS_ETA_NULL_EXPLANATION = 'ETA cannot be estimated at the current pace.';

export const GOAL_EDIT_VALIDATION_HINT =
  'Could not update the goal. Please check title, target, and date format (YYYY-MM-DD), then try again.';
export const GOAL_EDIT_NOTHING_TO_UPDATE_MESSAGE =
  'Nothing to update. Provide at least one of: title, target, start, end.';
export const GOAL_EDIT_IMMUTABLE_UNIT_MESSAGE =
  'Goal unit cannot be changed after the goal is created. Create a new goal with /goal_create to use a different unit.';
export const GOAL_EDIT_NOT_FOUND_MESSAGE = 'Goal not found. Run /goals to check available goal IDs and try again.';
export const GOAL_EDIT_CONFLICT_MESSAGE =
  'Could not apply this update because it conflicts with the goal state (for example, target below current progress). Please review the values and try again.';
export const GOAL_EDIT_AUTH_ERROR_MESSAGE =
  'Temporary technical issue while updating your goal. Please try again later.';
export const GOAL_EDIT_UPSTREAM_FALLBACK_MESSAGE = 'Temporary issue while updating your goal. Please try again later.';

export const PROGRESS_ADD_VALIDATION_HINT =
  'Could not record progress. Please check that delta is a positive number and date is in YYYY-MM-DD format, then try again.';
export const PROGRESS_ADD_NOT_FOUND_MESSAGE = 'Goal not found. Run /goals to check available goal IDs and try again.';
export const PROGRESS_ADD_AUTH_ERROR_MESSAGE =
  'Temporary technical issue while recording your progress. Please try again later.';
export const PROGRESS_ADD_UPSTREAM_FALLBACK_MESSAGE =
  'Temporary issue while recording your progress. Please try again later.';
