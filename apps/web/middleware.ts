import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * M1: pass-through middleware scaffold.
 * S4: session injection, auth redirects, RBAC guards.
 * S5: subscription gate on title watch routes.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
