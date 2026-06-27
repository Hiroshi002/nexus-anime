/**
 * Stable error codes and a typed ApiError discriminated union. Codes are
 * part of the public API contract — clients branch on `code`, not on the
 * human-readable `message`, so treat renames as breaking changes.
 */

export const ERROR_CODES = {
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  VALIDATION: "VALIDATION",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export type ApiError = {
  message: string;
  code: ErrorCode;
  details?: unknown;
};

export class ApiErrorClass extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }

  toJSON(): ApiError {
    return { message: this.message, code: this.code, details: this.details };
  }
}
