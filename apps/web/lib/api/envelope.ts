export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiMeta {
  requestId: string;
  version: string;
}

export interface ApiErrorBody {
  message: string;
  code: string;
  details: ApiErrorDetail[];
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function successResponse<T>(
  data: T,
  meta: ApiMeta = { requestId: "unknown", version: "v1" },
): ApiSuccessResponse<T> {
  return { data, meta };
}

export function errorResponse(
  message: string,
  code: string,
  meta: ApiMeta = { requestId: "unknown", version: "v1" },
  details: ApiErrorDetail[] = [],
): ApiErrorResponse {
  return {
    error: {
      message,
      code,
      details,
    },
    meta,
  };
}

export function isApiErrorResponse(
  response: ApiResponse<unknown>,
): response is ApiErrorResponse {
  return "error" in response;
}
