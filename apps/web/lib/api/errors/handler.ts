import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { errorResponse } from "@/lib/api/envelope";
import { logger } from "@/lib/logging/logger";
import {
  NexusError,
} from "./errors";

export function handleApiError(
  error: unknown,
  requestId: string,
  route: string,
): NextResponse {
  if (error instanceof NexusError) {
    logger.warn(error.message, {
      type: "api_error",
      requestId,
      route,
      errorCode: error.code,
      statusCode: error.statusCode,
    });
    return NextResponse.json(
      errorResponse(error.message, error.code, {
        requestId,
        version: "v1",
      }, error.details),
      { status: error.statusCode },
    );
  }

  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    logger.info("Request validation failed", { type: "validation_error", requestId, route, details });
    return NextResponse.json(
      errorResponse("Request validation failed", "VALIDATION_ERROR", {
        requestId,
        version: "v1",
      }, details),
      { status: 400 },
    );
  }

  logger.error("Unhandled error", {
    type: "unhandled_error",
    requestId,
    route,
    error:
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { raw: String(error) },
  });
  return NextResponse.json(
    errorResponse("An unexpected error occurred", "INTERNAL_ERROR", {
      requestId,
      version: "v1",
    }),
    { status: 500 },
  );
}
