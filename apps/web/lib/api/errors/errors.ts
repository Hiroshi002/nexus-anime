export interface ErrorDetail {
  field?: string;
  message: string;
}

export class NexusError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: ErrorDetail[];

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details: ErrorDetail[] = [],
  ) {
    super(message);
    this.name = "NexusError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends NexusError {
  constructor(details: ErrorDetail[]) {
    super("Request validation failed", 400, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }

  static fromZod(error: {
    issues: { path: (string | number)[]; message: string }[];
  }): ValidationError {
    return new ValidationError(
      error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
}

export class UnauthorizedError extends NexusError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends NexusError {
  constructor(message = "Insufficient permissions") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends NexusError {
  public readonly resource: string;
  public readonly ref: string;
  constructor(resource: string, ref: string) {
    super(`${resource} '${ref}' not found`, 404, "NOT_FOUND");
    this.name = "NotFoundError";
    this.resource = resource;
    this.ref = ref;
  }
}

export class ConflictError extends NexusError {
  constructor(message: string, details: ErrorDetail[] = []) {
    super(message, 409, "CONFLICT", details);
    this.name = "ConflictError";
  }
}

export class RateLimitedError extends NexusError {
  public readonly retryAfter: number;
  constructor(retryAfter: number) {
    super(
      `Too many requests. Please retry after ${retryAfter} seconds.`,
      429,
      "RATE_LIMITED",
    );
    this.name = "RateLimitedError";
    this.retryAfter = retryAfter;
  }
}

export class InternalError extends NexusError {
  constructor(message = "An unexpected error occurred") {
    super(message, 500, "INTERNAL_ERROR");
    this.name = "InternalError";
  }
}
