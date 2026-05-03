import { AuthError, ConflictError, isNormalizedApiError, NotFoundError, ValidationError } from '../../api/errors';
import { log } from '../../shared/logger';

export type ApiErrorMessages = {
  validation?: string;
  conflict?: string;
  notFound?: string;
  auth?: string;
  fallback: string;
  logContext: string;
};

export function defineApiErrorMessages<T extends ApiErrorMessages>(messages: T): T {
  return messages;
}

export function mapApiError(error: unknown, messages: ApiErrorMessages, correlationId?: string): string {
  if (messages.validation !== undefined && error instanceof ValidationError) {
    return messages.validation;
  }

  if (messages.conflict !== undefined && error instanceof ConflictError) {
    return messages.conflict;
  }

  if (messages.notFound !== undefined && error instanceof NotFoundError) {
    return messages.notFound;
  }

  if (messages.auth !== undefined && error instanceof AuthError) {
    return messages.auth;
  }

  log('warn', 'api_error_unmapped', {
    ...(correlationId === undefined ? {} : { correlation_id: correlationId }),
    context: messages.logContext,
    error_name: error instanceof Error ? error.name : 'UnknownError',
    ...(isNormalizedApiError(error) ? { error_code: error.code, status: error.status } : {}),
  });
  return messages.fallback;
}
