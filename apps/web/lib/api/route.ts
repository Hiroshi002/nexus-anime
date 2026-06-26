import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { successResponse } from "./envelope";
import { handleApiError } from "./errors/handler";
import { getRequestId } from "@/lib/logging/request-id";

type RouteHandler<T> = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) => Promise<T> | T;

/**
 * Wraps an API route handler with:
 * - request ID injection
 * - uniform success envelope
 * - global exception filtering (NexusError / ZodError / unknown)
 *
 * Route handlers only need to return the data payload or throw.
 */
export function route<T>(handler: RouteHandler<T>) {
  return async (
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    const requestId = getRequestId(request);
    try {
      const data = await handler(request, context);
      return NextResponse.json(successResponse(data, { requestId, version: "v1" }), {
        headers: { "X-Request-Id": requestId },
      });
    } catch (error) {
      return handleApiError(error, requestId, "route");
    }
  };
}
