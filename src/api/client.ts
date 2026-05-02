import * as crypto from 'node:crypto';

import createClient, { type ClientOptions, type Middleware } from 'openapi-fetch';

import { normalizeApiError, TransientUpstreamError } from './errors';
import type { paths } from './generated/schema';

export const CORRELATION_ID_HEADER = 'X-Correlation-Id';

const DEFAULT_RETRY_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 100;

export type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
};

type ResolvedRetryOptions = {
  maxAttempts: number;
  baseDelayMs: number;
};

type ApiMethod = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace';
type ParamGroup = 'query' | 'header' | 'path' | 'cookie';

type PathKey = keyof paths;

type OperationFor<Path extends PathKey, Method extends ApiMethod> = Exclude<
  paths[Path] extends { [K in Method]?: infer Operation } ? Operation : never,
  undefined | never
>;

type PathsForMethod<Method extends ApiMethod> = {
  [Path in PathKey]: [OperationFor<Path, Method>] extends [never] ? never : Path;
}[PathKey];

type JsonFromContent<Content> = Content extends { 'application/json': infer Json }
  ? Json
  : Content extends Record<string, infer AnyMedia>
    ? AnyMedia
    : never;

type RequestBodyForOperation<Operation> = Operation extends { requestBody: { content: infer Content } }
  ? JsonFromContent<Content>
  : Operation extends { requestBody?: { content: infer Content } }
    ? JsonFromContent<Content>
    : never;

type PathParameters<Path extends PathKey> = paths[Path] extends { parameters: infer Parameters } ? Parameters : never;

type OperationParameters<Operation> = Operation extends { parameters: infer Parameters } ? Parameters : never;

type ParamValue<Parameters, Group extends ParamGroup> = Parameters extends { [K in Group]?: infer Value }
  ? Exclude<Value, undefined>
  : never;

type MergeParamValue<PathValue, OperationValue> = [OperationValue] extends [never]
  ? PathValue
  : [PathValue] extends [never]
    ? OperationValue
    : PathValue & OperationValue;

type EmptyObjectToNever<T> = T extends object ? (keyof T extends never ? never : T) : T;

type StripTelegramHeader<T> = T extends Record<string, unknown> ? Omit<T, 'X-Telegram-User-Id'> : T;

type ParamsFor<Path extends PathKey, Method extends ApiMethod> = {
  query?: MergeParamValue<
    ParamValue<PathParameters<Path>, 'query'>,
    ParamValue<OperationParameters<OperationFor<Path, Method>>, 'query'>
  >;
  path?: MergeParamValue<
    ParamValue<PathParameters<Path>, 'path'>,
    ParamValue<OperationParameters<OperationFor<Path, Method>>, 'path'>
  >;
  header?: EmptyObjectToNever<
    StripTelegramHeader<
      MergeParamValue<
        ParamValue<PathParameters<Path>, 'header'>,
        ParamValue<OperationParameters<OperationFor<Path, Method>>, 'header'>
      >
    >
  >;
  cookie?: MergeParamValue<
    ParamValue<PathParameters<Path>, 'cookie'>,
    ParamValue<OperationParameters<OperationFor<Path, Method>>, 'cookie'>
  >;
};

type ResponsesForOperation<Operation> = Operation extends { responses: infer Responses } ? Responses : never;

type ResponseAt<Responses, Status extends number> = Status extends keyof Responses ? Responses[Status] : never;

type JsonResponseBody<Response> = Response extends { content: infer Content } ? JsonFromContent<Content> : never;

type SuccessDataForOperation<Operation> =
  | JsonResponseBody<ResponseAt<ResponsesForOperation<Operation>, 200>>
  | JsonResponseBody<ResponseAt<ResponsesForOperation<Operation>, 201>>
  | JsonResponseBody<ResponseAt<ResponsesForOperation<Operation>, 202>>
  | JsonResponseBody<ResponseAt<ResponsesForOperation<Operation>, 203>>
  | JsonResponseBody<ResponseAt<ResponsesForOperation<Operation>, 204>>
  | JsonResponseBody<ResponseAt<ResponsesForOperation<Operation>, 205>>
  | JsonResponseBody<ResponseAt<ResponsesForOperation<Operation>, 206>>;

type OperationData<Operation> = [SuccessDataForOperation<Operation>] extends [never]
  ? void
  : SuccessDataForOperation<Operation>;

type RequestOptionsFor<Path extends PathKey, Method extends ApiMethod> = Omit<
  RequestInit,
  'body' | 'headers' | 'method'
> & {
  baseUrl?: string;
  parseAs?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'stream';
  params?: ParamsFor<Path, Method>;
  body?: RequestBodyForOperation<OperationFor<Path, Method>>;
  headers?: ClientOptions['headers'];
  fetch?: ClientOptions['fetch'];
  querySerializer?: ClientOptions['querySerializer'];
  bodySerializer?: ClientOptions['bodySerializer'];
  pathSerializer?: ClientOptions['pathSerializer'];
  middleware?: Middleware[];
};

export type GoalsApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type CreateGoalsApiClientOptions = {
  baseUrl: string;
  serviceToken: string;
  telegramUserId: string | number;
  correlationId?: string;
  fetch?: GoalsApiFetch;
  timeoutMs?: number;
  retry?: RetryOptions;
};

export interface GoalsApiClient {
  request<Method extends ApiMethod, Path extends PathsForMethod<Method>>(
    method: Method,
    path: Path,
    init?: RequestOptionsFor<Path, Method>
  ): Promise<OperationData<OperationFor<Path, Method>>>;

  GET<Path extends PathsForMethod<'get'>>(
    path: Path,
    init?: RequestOptionsFor<Path, 'get'>
  ): Promise<OperationData<OperationFor<Path, 'get'>>>;

  PUT<Path extends PathsForMethod<'put'>>(
    path: Path,
    init?: RequestOptionsFor<Path, 'put'>
  ): Promise<OperationData<OperationFor<Path, 'put'>>>;

  POST<Path extends PathsForMethod<'post'>>(
    path: Path,
    init?: RequestOptionsFor<Path, 'post'>
  ): Promise<OperationData<OperationFor<Path, 'post'>>>;

  DELETE<Path extends PathsForMethod<'delete'>>(
    path: Path,
    init?: RequestOptionsFor<Path, 'delete'>
  ): Promise<OperationData<OperationFor<Path, 'delete'>>>;

  OPTIONS<Path extends PathsForMethod<'options'>>(
    path: Path,
    init?: RequestOptionsFor<Path, 'options'>
  ): Promise<OperationData<OperationFor<Path, 'options'>>>;

  HEAD<Path extends PathsForMethod<'head'>>(
    path: Path,
    init?: RequestOptionsFor<Path, 'head'>
  ): Promise<OperationData<OperationFor<Path, 'head'>>>;

  PATCH<Path extends PathsForMethod<'patch'>>(
    path: Path,
    init?: RequestOptionsFor<Path, 'patch'>
  ): Promise<OperationData<OperationFor<Path, 'patch'>>>;

  TRACE<Path extends PathsForMethod<'trace'>>(
    path: Path,
    init?: RequestOptionsFor<Path, 'trace'>
  ): Promise<OperationData<OperationFor<Path, 'trace'>>>;
}

function resolveCorrelationId(value: string | undefined): string {
  if (value !== undefined && value.trim().length > 0) {
    return value.trim();
  }

  return crypto.randomUUID();
}

function resolveFetch(fetchImpl: GoalsApiFetch | undefined): GoalsApiFetch {
  if (fetchImpl !== undefined) {
    return fetchImpl;
  }

  if (typeof globalThis.fetch !== 'function') {
    throw new Error('Global fetch is not available');
  }

  return globalThis.fetch.bind(globalThis);
}

function withTimeout(fetchImpl: GoalsApiFetch, timeoutMs: number | undefined): NonNullable<ClientOptions['fetch']> {
  return async request => {
    if (timeoutMs === undefined || timeoutMs <= 0) {
      return fetchImpl(request);
    }

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      timeoutController.abort();
    }, timeoutMs);

    try {
      const signal = request.signal
        ? AbortSignal.any([request.signal, timeoutController.signal])
        : timeoutController.signal;
      const requestWithTimeout = new Request(request, { signal });
      return await fetchImpl(requestWithTimeout);
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

function normalizeMethod(method: ApiMethod): string {
  return method.toUpperCase();
}

function resolveRetryOptions(input: RetryOptions | undefined): ResolvedRetryOptions {
  const rawMaxAttempts = input?.maxAttempts;
  const maxAttempts =
    rawMaxAttempts !== undefined && Number.isInteger(rawMaxAttempts) && rawMaxAttempts >= 1
      ? rawMaxAttempts
      : DEFAULT_RETRY_MAX_ATTEMPTS;

  const rawBaseDelayMs = input?.baseDelayMs;
  const baseDelayMs =
    rawBaseDelayMs !== undefined && Number.isFinite(rawBaseDelayMs) && rawBaseDelayMs >= 0
      ? rawBaseDelayMs
      : DEFAULT_RETRY_BASE_DELAY_MS;

  return { maxAttempts, baseDelayMs };
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

type RetryContext = {
  method: string;
  path: string;
  signal?: AbortSignal | null;
};

async function executeWithRetry<T>(
  invocation: (attempt: number) => Promise<T>,
  context: RetryContext,
  retry: ResolvedRetryOptions
): Promise<T> {
  let attempt = 1;

  while (true) {
    try {
      return await invocation(attempt);
    } catch (error) {
      if (!(error instanceof TransientUpstreamError)) {
        throw error;
      }

      if (attempt >= retry.maxAttempts) {
        throw error;
      }

      if (context.signal?.aborted) {
        throw error;
      }

      const nextDelayMs = retry.baseDelayMs * 2 ** (attempt - 1);
      console.warn('[api] retrying transient failure', {
        method: context.method,
        path: context.path,
        attempt,
        nextDelayMs,
        errorName: error.name,
        status: error.status,
      });

      await delay(nextDelayMs);
      attempt += 1;
    }
  }
}

export function createGoalsApiClient(options: CreateGoalsApiClientOptions): GoalsApiClient {
  const correlationId = resolveCorrelationId(options.correlationId);
  const fetchImpl = withTimeout(resolveFetch(options.fetch), options.timeoutMs);
  const retry = resolveRetryOptions(options.retry);

  const client = createClient<paths>({
    baseUrl: options.baseUrl,
    fetch: fetchImpl,
  });

  const headersMiddleware: Middleware = {
    onRequest({ request }) {
      const headers = new Headers(request.headers);
      headers.set('Authorization', `Bearer ${options.serviceToken}`);
      headers.set('X-Telegram-User-Id', String(options.telegramUserId));
      headers.set(CORRELATION_ID_HEADER, correlationId);

      return new Request(request, { headers });
    },
  };

  client.use(headersMiddleware);

  const invokeRequest = client.request as unknown as (
    method: ApiMethod,
    path: string,
    init?: unknown
  ) => Promise<{
    data?: unknown;
    error?: unknown;
    response: Response;
  }>;

  async function request<Method extends ApiMethod, Path extends PathsForMethod<Method>>(
    method: Method,
    path: Path,
    init?: RequestOptionsFor<Path, Method>
  ): Promise<OperationData<OperationFor<Path, Method>>> {
    const normalizedMethod = normalizeMethod(method);
    const pathString = String(path);
    const callerSignal = init?.signal ?? null;

    return executeWithRetry(
      async () => {
        const result = await invokeRequest(method, pathString, init).catch(error => {
          throw normalizeApiError({
            error,
            method: normalizedMethod,
            path: pathString,
          });
        });

        if (result.error !== undefined) {
          throw normalizeApiError({
            status: result.response.status,
            error: result.error,
            method: normalizedMethod,
            path: pathString,
          });
        }

        return result.data as OperationData<OperationFor<Path, Method>>;
      },
      { method: normalizedMethod, path: pathString, signal: callerSignal },
      retry
    );
  }

  return {
    request,
    GET: (path, init) => request('get', path, init),
    PUT: (path, init) => request('put', path, init),
    POST: (path, init) => request('post', path, init),
    DELETE: (path, init) => request('delete', path, init),
    OPTIONS: (path, init) => request('options', path, init),
    HEAD: (path, init) => request('head', path, init),
    PATCH: (path, init) => request('patch', path, init),
    TRACE: (path, init) => request('trace', path, init),
  };
}
