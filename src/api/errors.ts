export type ApiErrorCode =
  | 'AUTH_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND_ERROR'
  | 'CONFLICT_ERROR'
  | 'TRANSIENT_UPSTREAM_ERROR';

export type NormalizeApiErrorInput = {
  status?: number;
  error?: unknown;
  method?: string;
  path?: string;
};

type ApiErrorMetadata = {
  status?: number;
  method?: string;
  path?: string;
  upstreamCode?: string;
  cause?: unknown;
};

const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EPIPE',
  'EAI_AGAIN',
]);

abstract class ApiClientError extends Error {
  readonly code: ApiErrorCode;
  readonly status?: number;
  readonly method?: string;
  readonly path?: string;
  readonly upstreamCode?: string;

  protected constructor(code: ApiErrorCode, message: string, metadata: ApiErrorMetadata = {}) {
    super(message, metadata.cause === undefined ? undefined : { cause: metadata.cause });
    this.name = new.target.name;
    this.code = code;
    this.status = metadata.status;
    this.method = metadata.method;
    this.path = metadata.path;
    this.upstreamCode = metadata.upstreamCode;
  }
}

export class AuthError extends ApiClientError {
  constructor(message = 'Upstream authentication failed', metadata: ApiErrorMetadata = {}) {
    super('AUTH_ERROR', message, metadata);
  }
}

export class ValidationError extends ApiClientError {
  constructor(message = 'Upstream validation failed', metadata: ApiErrorMetadata = {}) {
    super('VALIDATION_ERROR', message, metadata);
  }
}

export class NotFoundError extends ApiClientError {
  constructor(message = 'Requested resource was not found upstream', metadata: ApiErrorMetadata = {}) {
    super('NOT_FOUND_ERROR', message, metadata);
  }
}

export class ConflictError extends ApiClientError {
  constructor(message = 'Upstream conflict response', metadata: ApiErrorMetadata = {}) {
    super('CONFLICT_ERROR', message, metadata);
  }
}

export class TransientUpstreamError extends ApiClientError {
  constructor(message = 'Temporary upstream failure', metadata: ApiErrorMetadata = {}) {
    super('TRANSIENT_UPSTREAM_ERROR', message, metadata);
  }
}

export type NormalizedApiError = AuthError | ValidationError | NotFoundError | ConflictError | TransientUpstreamError;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getNumericStatus(error: unknown): number | undefined {
  if (!isRecord(error)) {
    return undefined;
  }

  const rawStatus = error.status;
  return typeof rawStatus === 'number' ? rawStatus : undefined;
}

function getStringProperty(error: unknown, key: string): string | undefined {
  if (!isRecord(error)) {
    return undefined;
  }

  const value = error[key];
  return typeof value === 'string' ? value : undefined;
}

function getUpstreamMessage(error: unknown): string | undefined {
  if (error instanceof Error && typeof error.message === 'string' && error.message.length > 0) {
    return error.message;
  }

  return getStringProperty(error, 'message');
}

function getUpstreamCode(error: unknown): string | undefined {
  return getStringProperty(error, 'code');
}

function isAbortError(error: unknown): boolean {
  return getStringProperty(error, 'name') === 'AbortError';
}

function isNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }

  const code = getStringProperty(error, 'code');
  return code !== undefined && TRANSIENT_NETWORK_CODES.has(code);
}

function createMetadata(input: NormalizeApiErrorInput, status: number | undefined): ApiErrorMetadata {
  return {
    status,
    method: input.method,
    path: input.path,
    upstreamCode: getUpstreamCode(input.error),
    cause: input.error,
  };
}

export function isNormalizedApiError(error: unknown): error is NormalizedApiError {
  return (
    error instanceof AuthError ||
    error instanceof ValidationError ||
    error instanceof NotFoundError ||
    error instanceof ConflictError ||
    error instanceof TransientUpstreamError
  );
}

export function normalizeApiError(input: NormalizeApiErrorInput): NormalizedApiError {
  if (isNormalizedApiError(input.error)) {
    return input.error;
  }

  const status = input.status ?? getNumericStatus(input.error);
  const message = getUpstreamMessage(input.error);
  const metadata = createMetadata(input, status);

  switch (status) {
    case 400:
      return new ValidationError(message ?? 'Upstream returned validation error (400)', metadata);
    case 401:
      return new AuthError(message ?? 'Upstream returned unauthorized response (401)', metadata);
    case 404:
      return new NotFoundError(message ?? 'Upstream resource not found (404)', metadata);
    case 409:
      return new ConflictError(message ?? 'Upstream returned conflict response (409)', metadata);
    default:
      break;
  }

  if (status !== undefined && status >= 500) {
    return new TransientUpstreamError(message ?? `Upstream server error (${status})`, metadata);
  }

  if (isAbortError(input.error)) {
    return new TransientUpstreamError(message ?? 'Upstream request timed out', metadata);
  }

  if (isNetworkFailure(input.error)) {
    return new TransientUpstreamError(message ?? 'Upstream network failure', metadata);
  }

  if (status !== undefined) {
    return new TransientUpstreamError(message ?? `Upstream request failed (${status})`, metadata);
  }

  return new TransientUpstreamError(message ?? 'Unknown upstream failure', metadata);
}
