import { isApiErrorResponse, type ApiResponse } from "@/lib/api/envelope";

export interface ApiClientError {
  code: string;
  message: string;
  details: { field?: string; message: string }[];
  requestId: string;
}

export async function parseApiError(response: Response): Promise<ApiClientError> {
  let body: ApiResponse<unknown>;
  try {
    body = await response.json();
  } catch {
    return {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      details: [],
      requestId: response.headers.get("X-Request-Id") ?? "unknown",
    };
  }

  if (isApiErrorResponse(body)) {
    return {
      code: body.error.code,
      message: body.error.message,
      details: body.error.details,
      requestId: body.meta?.requestId ?? "unknown",
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
    details: [],
    requestId: response.headers.get("X-Request-Id") ?? "unknown",
  };
}
