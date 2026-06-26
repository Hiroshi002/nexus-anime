import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/api/errors/errors";

/**
 * Resolves the current session or throws `UnauthorizedError` (401).
 *
 * Use inside route handlers to enforce authentication at the handler level.
 * The middleware already redirects unauthenticated browsers at the route-group
 * level; this guards direct API calls, which don't redirect — they 401.
 *
 * The thrown `UnauthorizedError` is a `NexusError`, so the `route()` wrapper
 * formats it into the standard error envelope automatically.
 */
export async function requireAuthOrThrow(): Promise<{
  id: string;
  role: "user" | "admin" | "superadmin";
}> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }
  return { id: session.user.id, role: session.user.role ?? "user" };
}
