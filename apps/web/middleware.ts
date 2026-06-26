import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";

import { auth } from "@/auth";
import { logger } from "@/lib/logging/logger";
import { getRequestId, REQUEST_ID_HEADER } from "@/lib/logging/request-id";

export const API_VERSION_HEADER = "API-Version";

/**
 * Routes that never require authentication. The (auth) group (login,
 * register, forgot-password) and the auth API itself must stay public,
 * otherwise a signed-out user can never reach the sign-in page.
 */
const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/api/auth",
];

/**
 * Routes that require authentication AND an admin or superadmin role.
 */
const ADMIN_PREFIXES = ["/admin"];

/**
 * Routes that require authentication (any signed-in user).
 */
const PROTECTED_PREFIXES = ["/settings", "/watchlist", "/history"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function requiresAdmin(pathname: string): boolean {
  return ADMIN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function requiresAuth(pathname: string): boolean {
  if (isPublic(pathname)) return false;
  return (
    requiresAdmin(pathname) ||
    PROTECTED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  );
}

function runMiddleware(req: NextAuthRequest): ReturnType<typeof NextResponse.next> {
  const requestId = getRequestId(req);
  const { method, nextUrl } = req;
  const start = Date.now();
  const pathname = nextUrl.pathname;

  logger.info("Request received", {
    type: "http_request",
    requestId,
    method,
    path: pathname,
    userAgent: req.headers.get("user-agent"),
  });

  if (requiresAuth(pathname) && !req.auth) {
    const signInUrl = new URL("/login", nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", pathname);
    logger.info("Unauthenticated access blocked", {
      type: "auth_guard",
      requestId,
      path: pathname,
    });
    return NextResponse.redirect(signInUrl);
  }

  const role = req.auth?.user?.role;
  if (
    requiresAdmin(pathname) &&
    role !== "admin" &&
    role !== "superadmin"
  ) {
    logger.info("Non-admin access blocked", {
      type: "rbac_guard",
      requestId,
      path: pathname,
      role,
    });
    return NextResponse.redirect(new URL("/", nextUrl.origin));
  }

  const response = NextResponse.next();
  response.headers.set(REQUEST_ID_HEADER, requestId);
  response.headers.set(API_VERSION_HEADER, "v1");

  logger.info("Response dispatched", {
    type: "http_response",
    requestId,
    method,
    path: pathname,
    status: response.status,
    durationMs: Date.now() - start,
  });

  return response;
}

const middleware = auth(runMiddleware);
export default middleware;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
