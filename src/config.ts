import { z } from 'zod';

const LOG_LEVEL_VALUES = ['trace', 'debug', 'info', 'warn', 'error'] as const;
const BOT_MODE_VALUES = ['polling', 'webhook'] as const;

const requiredString = (fieldName: string) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (typeof value !== 'string' || value.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${fieldName} is required`,
        });
        return z.NEVER;
      }

      return value.trim();
    });

const requiredUrl = (fieldName: string) =>
  requiredString(fieldName).refine(
    value => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    {
      message: `${fieldName} must be a valid URL`,
    }
  );

const timeoutSchema = z
  .string()
  .optional()
  .default('10000')
  .transform((value, ctx) => {
    const timeout = Number(value);

    if (!Number.isInteger(timeout) || timeout <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'HTTP_TIMEOUT_MS must be a positive integer',
      });
      return z.NEVER;
    }

    return timeout;
  });

export const EnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: requiredString('TELEGRAM_BOT_TOKEN'),
  GOALS_API_BASE_URL: requiredUrl('GOALS_API_BASE_URL'),
  GOALS_API_SERVICE_TOKEN: requiredString('GOALS_API_SERVICE_TOKEN'),
  LOG_LEVEL: z.enum(LOG_LEVEL_VALUES).optional().default('info'),
  HTTP_TIMEOUT_MS: timeoutSchema,
  BOT_MODE: z.enum(BOT_MODE_VALUES).optional().default('polling'),
});

export type AppConfig = z.infer<typeof EnvSchema>;

export class ConfigValidationError extends Error {
  readonly code = 'CONFIG_VALIDATION_ERROR';
  readonly issues: ReadonlyArray<string>;
  readonly fields: ReadonlyArray<string>;

  constructor(issues: string[], fields: string[]) {
    super('Invalid runtime configuration');
    this.name = 'ConfigValidationError';
    this.issues = issues;
    this.fields = fields;
  }
}

const issueToMessage = (issue: z.ZodIssue): string => {
  const path = issue.path
    .map(segment => segment.toString())
    .filter(segment => segment.length > 0)
    .join('.');
  return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
};

const issueToField = (issue: z.ZodIssue): string | null => {
  const [firstPathSegment] = issue.path;
  return typeof firstPathSegment === 'string' ? firstPathSegment : null;
};

export function loadConfig(rawEnv: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(rawEnv);
  if (parsed.success) {
    return parsed.data;
  }

  const issues = parsed.error.issues.map(issueToMessage);
  const fields = Array.from(
    new Set(parsed.error.issues.map(issueToField).filter((field): field is string => field !== null))
  );

  throw new ConfigValidationError(issues, fields);
}

export type SafeConfigSummary = {
  GOALS_API_BASE_URL: string;
  LOG_LEVEL: AppConfig['LOG_LEVEL'];
  HTTP_TIMEOUT_MS: number;
  BOT_MODE: AppConfig['BOT_MODE'];
  hasTelegramBotToken: boolean;
  hasGoalsApiServiceToken: boolean;
};

export function buildSafeConfigSummary(config: AppConfig): SafeConfigSummary {
  return {
    GOALS_API_BASE_URL: config.GOALS_API_BASE_URL,
    LOG_LEVEL: config.LOG_LEVEL,
    HTTP_TIMEOUT_MS: config.HTTP_TIMEOUT_MS,
    BOT_MODE: config.BOT_MODE,
    hasTelegramBotToken: config.TELEGRAM_BOT_TOKEN.length > 0,
    hasGoalsApiServiceToken: config.GOALS_API_SERVICE_TOKEN.length > 0,
  };
}
