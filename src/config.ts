import { z } from 'zod';

const LOG_LEVEL_VALUES = ['trace', 'debug', 'info', 'warn', 'error'] as const;
const BOT_MODE_VALUES = ['polling', 'webhook'] as const;

const requiredString = (fieldName: string) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value.trim().length === 0) {
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

const positiveIntSchema = (fieldName: string, defaultValue: string) =>
  z
    .string()
    .optional()
    .default(defaultValue)
    .transform((value, ctx) => {
      const parsed = Number(value);

      if (!Number.isInteger(parsed) || parsed <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${fieldName} must be a positive integer`,
        });
        return z.NEVER;
      }

      return parsed;
    });

const optionalUrl = (fieldName: string) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value.trim().length === 0) {
        return undefined;
      }

      const trimmed = value.trim();
      try {
        new URL(trimmed);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${fieldName} must be a valid URL`,
        });
        return z.NEVER;
      }

      return trimmed;
    });

const optionalPath = (fieldName: string) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value.trim().length === 0) {
        return undefined;
      }

      const trimmed = value.trim();
      if (!trimmed.startsWith('/')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${fieldName} must start with "/"`,
        });
        return z.NEVER;
      }

      return trimmed;
    });

const BaseEnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: requiredString('TELEGRAM_BOT_TOKEN'),
  GOALS_API_BASE_URL: requiredUrl('GOALS_API_BASE_URL'),
  GOALS_API_SERVICE_TOKEN: requiredString('GOALS_API_SERVICE_TOKEN'),
  LOG_LEVEL: z.enum(LOG_LEVEL_VALUES).optional().default('info'),
  HTTP_TIMEOUT_MS: positiveIntSchema('HTTP_TIMEOUT_MS', '10000'),
  BOT_MODE: z.enum(BOT_MODE_VALUES).optional().default('polling'),
  BOT_WEBHOOK_PORT: positiveIntSchema('BOT_WEBHOOK_PORT', '8080'),
  BOT_WEBHOOK_PUBLIC_URL: optionalUrl('BOT_WEBHOOK_PUBLIC_URL'),
  BOT_WEBHOOK_SECRET_PATH: optionalPath('BOT_WEBHOOK_SECRET_PATH'),
});

export const EnvSchema = BaseEnvSchema.superRefine((data, ctx) => {
  if (data.BOT_MODE !== 'webhook') {
    return;
  }

  if (data.BOT_WEBHOOK_PUBLIC_URL === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['BOT_WEBHOOK_PUBLIC_URL'],
      message: 'BOT_WEBHOOK_PUBLIC_URL is required when BOT_MODE=webhook',
    });
  }

  if (data.BOT_WEBHOOK_SECRET_PATH === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['BOT_WEBHOOK_SECRET_PATH'],
      message: 'BOT_WEBHOOK_SECRET_PATH is required when BOT_MODE=webhook',
    });
  }
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
  BOT_WEBHOOK_PORT: number;
  BOT_WEBHOOK_PUBLIC_URL: string | null;
  hasBotWebhookSecretPath: boolean;
  hasTelegramBotToken: boolean;
  hasGoalsApiServiceToken: boolean;
};

export function buildSafeConfigSummary(config: AppConfig): SafeConfigSummary {
  return {
    GOALS_API_BASE_URL: config.GOALS_API_BASE_URL,
    LOG_LEVEL: config.LOG_LEVEL,
    HTTP_TIMEOUT_MS: config.HTTP_TIMEOUT_MS,
    BOT_MODE: config.BOT_MODE,
    BOT_WEBHOOK_PORT: config.BOT_WEBHOOK_PORT,
    BOT_WEBHOOK_PUBLIC_URL: config.BOT_WEBHOOK_PUBLIC_URL ?? null,
    hasBotWebhookSecretPath: config.BOT_WEBHOOK_SECRET_PATH !== undefined,
    hasTelegramBotToken: config.TELEGRAM_BOT_TOKEN.length > 0,
    hasGoalsApiServiceToken: config.GOALS_API_SERVICE_TOKEN.length > 0,
  };
}
