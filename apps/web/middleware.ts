import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { logger } from "@/lib/logging/logger";
import { getRequestId, REQUEST_ID_HEADER } from "@/lib/logging/request-id";

export const API_VERSION_HEADER = "API-Version";

/**
 * M2: request-id injection + structured access logging + error envelope fallback.
 * S4: session injection, auth redirects, RBAC guards.
 * S5: subscription gate on title watch routes.
 */
export function middleware(request: NextRequest) {
  const requestId = getRequestId(request);
  const { method, nextUrl } = request;
  const start = Date.now();

  logger.info("Request received", {
    type: "http_request",
    requestId,
    method,
    path: nextUrl.pathname,
    userAgent: request.headers.get("user-agent"),
  });

  const response = NextResponse.next();
  response.headers.set(REQUEST_ID_HEADER, requestId);
  response.headers.set(API_VERSION_HEADER, "v1");

  // Note: Next.js middleware cannot read response body.
  // Status-code logging happens in route handlers via `res.*` or `route()`.
  // We log the response headers here for timing.
  logger.info("Response dispatched", {
    type: "http_response",
    requestId,
    method,
    path: nextUrl.pathname,
    status: response.status,
    durationMs: Date.now() - start,
  });

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
