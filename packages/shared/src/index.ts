/* eslint-disable import/no-unresolved -- relative TS imports resolved by tsconfig project */
export { ok, fail, isOk, isError } from "./api/envelope";
export type { ApiResult, ApiError as ApiErrorShape } from "./api/envelope";

export { ApiErrorClass, ERROR_CODES } from "./api/errors";
export type { ErrorCode, ApiError as ApiErrorData } from "./api/errors";

export type { PaginationParams, Paginated } from "./api/pagination";
