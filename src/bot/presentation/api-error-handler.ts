import { AuthError, ConflictError, NotFoundError, ValidationError } from '../../api/errors';

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

export function mapApiError(error: unknown, messages: ApiErrorMessages): string {
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

  console.warn(`[bot] ${messages.logContext}`, error);
  return messages.fallback;
}
