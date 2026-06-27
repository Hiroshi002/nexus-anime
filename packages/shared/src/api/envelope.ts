/**
 * API response envelope — the single shape every route handler and Server
 * Action returns. Success wraps data as `{ data }`; failure wraps errors as
 * `{ error: { message, code, details } }`.
 *
 * Source of truth for the contract; consumed by apps/web route handlers and
 * any future app. See CLAUDE.md API Rules and docs/06-api/.
 */

export type ApiError = {
  message: string;
  code: string;
  details?: unknown;
};

export type ApiResult<T> = { data: T } | { error: ApiError };

export function ok<T>(data: T): ApiResult<T> {
  return { data };
}

export function fail<T>(error: ApiError): ApiResult<T> {
  return { error };
}

export function isOk<T>(result: ApiResult<T>): result is { data: T } {
  return "data" in result;
}

export function isError<T>(result: ApiResult<T>): result is { error: ApiError } {
  return "error" in result;
}
