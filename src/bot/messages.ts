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
