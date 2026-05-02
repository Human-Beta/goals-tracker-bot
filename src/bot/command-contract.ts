import { UUID_PATTERN } from '../shared/patterns';

export type CommandName =
  | 'start'
  | 'goal_create'
  | 'goals'
  | 'goal'
  | 'goal_edit'
  | 'progress_add'
  | 'progress_list'
  | 'progress_edit'
  | 'progress_delete'
  | 'ping';

type ValueValidator = (value: string) => string | null;

export type CommandSpec = {
  name: CommandName;
  usage: string;
  requiredKeys: readonly string[];
  optionalKeys: readonly string[];
  validators: Readonly<Record<string, ValueValidator>>;
  implemented: boolean;
};

function enumValidator(values: readonly string[]): ValueValidator {
  return value => (values.includes(value) ? null : `must be one of: ${values.join('|')}`);
}

function numberValidator(value: string): string | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? null : 'must be a valid number';
}

function uuidValidator(value: string): string | null {
  const isUuid = UUID_PATTERN.test(value);
  return isUuid ? null : 'must be a valid UUID';
}

function dateValidator(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    return 'must be in YYYY-MM-DD format';
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  const isSameDate =
    parsedDate.getUTCFullYear() === year && parsedDate.getUTCMonth() === month - 1 && parsedDate.getUTCDate() === day;

  return isSameDate ? null : 'must be a real calendar date in YYYY-MM-DD format';
}

function nonEmptyTextValidator(value: string): string | null {
  return value.trim().length > 0 ? null : 'must not be empty';
}

function timezoneValidator(value: string): string | null {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return null;
  } catch {
    return 'must be a valid IANA timezone';
  }
}

const sortValidator = enumValidator(['asc', 'desc']);
const unitValidator = enumValidator(['pages', 'minutes', 'km']);
const yesValidator = enumValidator(['yes']);

export const COMMAND_SPECS: Readonly<Record<CommandName, CommandSpec>> = {
  start: {
    name: 'start',
    usage: '/start timezone=<IANA>',
    requiredKeys: ['timezone'],
    optionalKeys: [],
    validators: {
      timezone: timezoneValidator,
    },
    implemented: true,
  },
  goal_create: {
    name: 'goal_create',
    usage: '/goal_create title="<text>" unit=<pages|minutes|km> target=<number> end=<YYYY-MM-DD> [start=<YYYY-MM-DD>]',
    requiredKeys: ['title', 'unit', 'target', 'end'],
    optionalKeys: ['start'],
    validators: {
      title: nonEmptyTextValidator,
      unit: unitValidator,
      target: numberValidator,
      start: dateValidator,
      end: dateValidator,
    },
    implemented: true,
  },
  goals: {
    name: 'goals',
    usage: '/goals',
    requiredKeys: [],
    optionalKeys: [],
    validators: {},
    implemented: true,
  },
  goal: {
    name: 'goal',
    usage: '/goal id=<uuid>',
    requiredKeys: ['id'],
    optionalKeys: [],
    validators: {
      id: uuidValidator,
    },
    implemented: true,
  },
  goal_edit: {
    name: 'goal_edit',
    usage: '/goal_edit id=<uuid> [title="<text>"] [target=<number>] [start=<YYYY-MM-DD>] [end=<YYYY-MM-DD>]',
    requiredKeys: ['id'],
    optionalKeys: ['title', 'target', 'start', 'end', 'unit'],
    validators: {
      id: uuidValidator,
      title: nonEmptyTextValidator,
      target: numberValidator,
      start: dateValidator,
      end: dateValidator,
    },
    implemented: true,
  },
  progress_add: {
    name: 'progress_add',
    usage: '/progress_add goal=<uuid> delta=<number> [date=<YYYY-MM-DD>] [note="<text>"]',
    requiredKeys: ['goal', 'delta'],
    optionalKeys: ['date', 'note'],
    validators: {
      goal: uuidValidator,
      delta: numberValidator,
      date: dateValidator,
      note: nonEmptyTextValidator,
    },
    implemented: true,
  },
  progress_list: {
    name: 'progress_list',
    usage: '/progress_list goal=<uuid> [from=<YYYY-MM-DD>] [to=<YYYY-MM-DD>] [sort=<asc|desc>]',
    requiredKeys: ['goal'],
    optionalKeys: ['from', 'to', 'sort'],
    validators: {
      goal: uuidValidator,
      from: dateValidator,
      to: dateValidator,
      sort: sortValidator,
    },
    implemented: true,
  },
  progress_edit: {
    name: 'progress_edit',
    usage: '/progress_edit goal=<uuid> event=<uuid> [delta=<number>] [date=<YYYY-MM-DD>] [note="<text>"]',
    requiredKeys: ['goal', 'event'],
    optionalKeys: ['delta', 'date', 'note'],
    validators: {
      goal: uuidValidator,
      event: uuidValidator,
      delta: numberValidator,
      date: dateValidator,
      note: nonEmptyTextValidator,
    },
    implemented: true,
  },
  progress_delete: {
    name: 'progress_delete',
    usage: '/progress_delete goal=<uuid> event=<uuid> confirm=yes',
    requiredKeys: ['goal', 'event', 'confirm'],
    optionalKeys: [],
    validators: {
      goal: uuidValidator,
      event: uuidValidator,
      confirm: yesValidator,
    },
    implemented: true,
  },
  ping: {
    name: 'ping',
    usage: '/ping',
    requiredKeys: [],
    optionalKeys: [],
    validators: {},
    implemented: true,
  },
};

const COMMAND_NAMES = new Set<CommandName>(Object.keys(COMMAND_SPECS) as CommandName[]);

export function isKnownCommandName(value: string): value is CommandName {
  return COMMAND_NAMES.has(value as CommandName);
}

export function validateCommandArguments(spec: CommandSpec, args: Readonly<Record<string, string>>): string | null {
  const allowedKeys = new Set([...spec.requiredKeys, ...spec.optionalKeys]);

  for (const key of Object.keys(args)) {
    if (!allowedKeys.has(key)) {
      return `unknown argument "${key}"`;
    }
  }

  for (const requiredKey of spec.requiredKeys) {
    if (args[requiredKey] === undefined) {
      return `missing required argument "${requiredKey}"`;
    }
  }

  for (const [key, value] of Object.entries(args)) {
    const validator = spec.validators[key];
    if (validator === undefined) {
      continue;
    }

    const validationError = validator(value);
    if (validationError !== null) {
      return `argument "${key}" ${validationError}`;
    }
  }

  return null;
}
