export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorBody {
  message: string;
  code: string;
  details: ApiErrorDetail[];
}

export interface ApiSuccessResponse<T> {
  data: T;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function successResponse<T>(data: T): ApiSuccessResponse<T> {
  return { data };
}

export function errorResponse(
  message: string,
  code: string,
  details: ApiErrorDetail[] = [],
): ApiErrorResponse {
  return {
    error: {
      message,
      code,
      details,
    },
  };
}

export function isApiErrorResponse(response: ApiResponse<unknown>): response is ApiErrorResponse {
  return "error" in response;
}
