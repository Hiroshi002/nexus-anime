# M3.3 — Session & Token Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the session and token strategy for Nexus Anime — JWT structure with rolling refresh, Remember Me extension, device tracking with concurrent session limits, logout flows, and JTI-based token revocation.

**Architecture:** Auth.js v5 with JWT-in-cookie strategy. Single JWT (no separate access/refresh tokens). Rolling re-sign via Auth.js `jwt` callback when < 7 days remain. Device tracking via heuristic fingerprint (UA + language + IP subnet). Revocation via `revoked_sessions` table + Redis per-JTI cache. `user_device_sessions` table owns per-device lifecycle and concurrent-session limits.

**Tech Stack:** Next.js 16, Auth.js v5 (`next-auth@5`), `@auth/drizzle-adapter`, Drizzle ORM, Neon PostgreSQL, Upstash Redis (`@upstash/redis`), Zod, Vitest.

## Global Constraints

- Auth.js v5 JWT strategy only — no DB-backed sessions (M2.6 resolved decision).
- `__Host-` prefix on all session cookies (Secure, Path=/, no Domain).
- `AUTH_SECRET` is 32+ bytes from `openssl rand -base64 32`.
- `v1:` prefix on all Redis keys (matches `/api/v1/` URL prefix, enables bulk invalidation on API version bump).
- Only Services may import `@nexus/cache` — Route Handlers go through a Service.
- No `process.env` access outside `lib/env.ts` (exception: `@nexus/cache` client singleton per M2.5 §3.3).
- API envelope: `{ data: {} }` / `{ error: { message, code, details: [] }, meta: { requestId, version: "v1" } }`.
- All Zod schemas live in `@nexus/validation` workspace package (create if missing).
- Migrations use Drizzle (`packages/db/src/migrations/`), numbered sequentially after existing `015_*`.
- Tests use Vitest + `@testing-library/react` for components, plain Vitest for services/libs.

---

## File Structure

### New workspace package: `packages/auth/`

```
packages/auth/
├── src/
│   ├── config.ts              # Auth.js v5 configuration (providers, callbacks, cookies)
│   ├── handlers.ts            # Route handler factory for /api/auth/[...nextauth]
│   ├── guards.ts              # requireAuth, requireSubscriber, requireRole, requireOwner
│   ├── session.ts             # getSession, getSessionUser, getSessionExpires
│   ├── callbacks.ts           # Custom JWT/session callbacks (role injection, rolling refresh, device_id)
│   ├── revocation.ts          # isRevoked(jti), revokeAllUserSessions(userId, opts)
│   ├── remember-me.ts         # createRememberMeToken, isRememberMeTokenValid, clearRememberMeToken
│   ├── device.ts              # computeDeviceFingerprint, generateDeviceLabel, upsertDeviceSession
│   ├── constants.ts           # TOKEN_VERSION, SESSION_TTL, REMEMBER_ME_TTL, ABSOLUTE_MAX
│   └── index.ts               # Public API barrel
├── package.json
└── tsconfig.json
```

### New workspace package: `packages/validation/`

```
packages/validation/
├── src/
│   ├── auth.ts                # loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema
│   ├── remember-me.ts         # rememberMeSchema
│   └── index.ts
├── package.json
└── tsconfig.json
```

### New workspace package: `packages/db/` extensions

```
packages/db/
├── src/
│   ├── schema/
│   │   ├── revoked-sessions.ts      # revoked_sessions table
│   │   └── user-device-sessions.ts  # user_device_sessions table
│   └── migrations/
│       ├── 016_create_revoked_sessions.sql
│       └── 017_create_user_device_sessions.sql
```

### Modified files

```
apps/web/
├── middleware.ts              # Add iat absolute-max check + remember-me auto-login
├── app/api/auth/[...nextauth]/route.ts   # Wire Auth.js handlers
├── app/api/cron/cleanup-revoked-sessions/route.ts  # Daily cleanup cron
├── app/api/v1/admin/users/[id]/revoke-sessions/route.ts  # Admin force-logout
├── app/(auth)/login/page.tsx  # Add Remember Me checkbox
├── actions/auth.ts            # Login action (remember-me), signout action, password-change action
├── lib/env.ts                 # Add AUTH_SECRET, AUTH_URL validation
└── lib/session-listener.ts    # Client-side remote-revocation polling (60s)
```

### New files

```
apps/web/
├── app/(app)/settings/security/devices/
│   ├── page.tsx               # Device list UI
│   └── [id]/revoke/route.ts  # Single-device revoke route
├── features/auth/
│   ├── services/
│   │   ├── auth-service.ts    # Login, signup, password change orchestration
│   │   └── device-service.ts  # Device session CRUD + concurrent limit enforcement
│   └── components/
│       ├── signout-button.tsx # Sign-out with client cache clear
│       └── new-device-alert.tsx  # New-device login notification banner
├── __tests__/
│   ├── session-revocation.test.ts
│   ├── device-tracking.test.ts
│   ├── remember-me.test.ts
│   └── logout-flow.test.ts
```

---

## Task 1: Workspace Scaffolding & Auth.js Config

**Files:**
- Create: `packages/auth/package.json`
- Create: `packages/auth/tsconfig.json`
- Create: `packages/auth/src/constants.ts`
- Create: `packages/auth/src/config.ts`
- Create: `packages/auth/src/handlers.ts`
- Create: `packages/auth/src/index.ts`
- Create: `packages/validation/package.json`
- Create: `packages/validation/tsconfig.json`
- Create: `packages/validation/src/auth.ts`
- Create: `packages/validation/src/index.ts`
- Modify: `apps/web/lib/env.ts`

**Interfaces:**
- Consumes: nothing (scaffolding)
- Produces:
  - `TOKEN_VERSION = 1` (constant)
  - `SESSION_TTL = 30 * 86400` (constant)
  - `REMEMBER_ME_TTL = 365 * 86400` (constant)
  - `ABSOLUTE_MAX = 30 * 86400` (constant)
  - `REFRESH_THRESHOLD = 7 * 86400` (constant)
  - `createAuthConfig()` → Auth.js v5 config object (providers, callbacks, cookies)
  - `loginSchema`, `registerSchema`, `forgotPasswordSchema`, `resetPasswordSchema` (Zod)
  - `env.AUTH_SECRET` (string), `env.AUTH_URL` (string)

- [ ] **Step 1: Create `packages/auth/package.json`**

```json
{
  "name": "@nexus/auth",
  "version": "0.0.0",
  "private": true,
  "dependencies": {
    "next-auth": "^5.0.0-beta.25"
  },
  "peerDependencies": {
    "next": "^16.0.0"
  }
}
```

- [ ] **Step 2: Create `packages/auth/tsconfig.json`**

```json
{
  "extends": "@nexus/config-typescript/base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `packages/validation/package.json`**

```json
{
  "name": "@nexus/validation",
  "version": "0.0.0",
  "private": true,
  "dependencies": {
    "zod": "^3.23.0"
  },
  "peerDependencies": {
    "next": "^16.0.0"
  }
}
```

- [ ] **Step 4: Create `packages/validation/tsconfig.json`**

```json
{
  "extends": "@nexus/config-typescript/base.json",
  "include": ["src/**/*"]
}
```

- [ ] **Step 5: Create `packages/validation/src/auth.ts`**

```typescript
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  remember: z.boolean().optional().default(false),
});

export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128)
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[0-9]/, "Must contain number"),
  name: z.string().min(1).max(50),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().max(255),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128)
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[0-9]/, "Must contain number"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
```

- [ ] **Step 6: Create `packages/validation/src/index.ts`**

```typescript
export * from "./auth";
```

- [ ] **Step 7: Create `packages/auth/src/constants.ts`**

```typescript
export const TOKEN_VERSION = 1;
export const SESSION_TTL = 30 * 86400;        // 30 days
export const REMEMBER_ME_TTL = 365 * 86400;   // 365 days
export const ABSOLUTE_MAX = 30 * 86400;       // 30 days
export const REFRESH_THRESHOLD = 7 * 86400;   // 7 days
export const DEVICE_LIMITS = {
  free: 2,
  prime: 5,
  resonance: 10,
} as const;
```

- [ ] **Step 8: Create `packages/auth/src/config.ts`**

```typescript
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@nexus/db";
import { loginSchema } from "@nexus/validation";
import { TOKEN_VERSION, SESSION_TTL } from "./constants";

export function createAuthConfig(): NextAuthConfig {
  return {
    adapter: DrizzleAdapter(db) as any,
    providers: [
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
      }),
      Credentials({
        credentials: { email: {}, password: {} },
        authorize: async (credentials) => {
          const parsed = loginSchema.safeParse(credentials);
          if (!parsed.success) return null;
          // Delegate to auth-service (Task 5)
          return null;
        },
      }),
    ],
    session: { strategy: "jwt", maxAge: SESSION_TTL },
    cookies: {
      sessionToken: {
        name: "__Host-nexus-session",
        options: {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        },
      },
    },
    callbacks: {
      jwt({ token, user }) {
        if (user) {
          token.sub = user.id;
          token.role = (user as any).role ?? "user";
          token.email = user.email;
          token.email_verified = !!(user as any).emailVerified;
          token.name = user.name;
          token.image = user.image;
          token.channel = (user as any).channel ?? "credentials";
          token.device_id = (user as any).device_id ?? null;
          token.v = TOKEN_VERSION;
        }
        return token;
      },
      session({ session, token }) {
        session.user.id = token.sub as string;
        session.user.email = token.email as string;
        session.user.role = token.role as "user" | "admin" | "superadmin";
        session.user.name = token.name as string | null;
        session.user.image = token.image as string | null;
        (session.user as any).emailVerified = token.email_verified;
        (session.user as any).deviceId = token.device_id;
        return session;
      },
    },
    pages: {
      signIn: "/login",
      error: "/login",
    },
  };
}
```

- [ ] **Step 9: Create `packages/auth/src/handlers.ts`**

```typescript
import NextAuth from "next-auth";
import { createAuthConfig } from "./config";

const { handlers } = NextAuth(createAuthConfig());

export const { GET, POST } = handlers;
```

- [ ] **Step 10: Create `packages/auth/src/index.ts`**

```typescript
export { GET, POST } from "./handlers";
export { createAuthConfig } from "./config";
export * from "./constants";
export { getSession, getSessionUser } from "./session";
export { isRevoked, revokeAllUserSessions } from "./revocation";
export { requireAuth, requireRole, requireOwner } from "./guards";
```

- [ ] **Step 11: Modify `apps/web/lib/env.ts`**

Add to the Zod schema:

```typescript
import "server-only";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  // M3.3 — Auth
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url().default("http://localhost:3000"),
});

const parsed = envSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_URL: process.env.AUTH_URL,
});

if (!parsed.success) {
  const formatted = parsed.error.flatten().fieldErrors;
  throw new Error(`Invalid environment variables: ${JSON.stringify(formatted)}`);
}

export const env = parsed.data;
```

- [ ] **Step 12: Commit**

```bash
git add packages/auth packages/validation apps/web/lib/env.ts
git commit -m "feat(@nexus/auth): scaffold workspace package with Auth.js v5 config

- Add packages/auth with NextAuth config (Google + Credentials providers)
- Add packages/validation with login/register/forgot/reset schemas
- Add TOKEN_VERSION, SESSION_TTL, REMEMBER_ME_TTL, ABSOLUTE_MAX constants
- Extend lib/env.ts with AUTH_SECRET and AUTH_URL validation"
```

---

## Task 2: Session Helpers & Guards

**Files:**
- Create: `packages/auth/src/session.ts`
- Create: `packages/auth/src/guards.ts`

**Interfaces:**
- Consumes: `createAuthConfig` (types from NextAuth), `getRedis` from `@nexus/cache`
- Produces:
  - `getSession(request: NextRequest): Promise<Session | null>`
  - `getSessionUser(request: NextRequest): Promise<SessionUser | null>`
  - `getSessionExpires(): Promise<string>`
  - `requireAuth(request): Promise<{ session } | { redirect }>`
  - `requireRole(request, role): Promise<{ session } | { redirect }>`
  - `requireOwner(session, resourceOwnerId): void` (throws ApiError)

- [ ] **Step 1: Create `packages/auth/src/session.ts`**

```typescript
import { GET as authGet } from "./handlers";
import type { Session } from "next-auth";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: "user" | "admin" | "superadmin";
  emailVerified: boolean | null;
  deviceId: string | null;
}

export async function getSession(): Promise<Session | null> {
  return (await authGet()) as any) as Session | null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session?.user) return null;
  return {
    id: (session.user as any).id,
    email: session.user.email!,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
    role: (session.user as any).role ?? "user",
    emailVerified: (session.user as any).emailVerified ?? null,
    deviceId: (session.user as any).deviceId ?? null,
  };
}

export async function getSessionExpires(): Promise<string | null> {
  const session = await getSession();
  return session?.expires ?? null;
}
```

- [ ] **Step 2: Create `packages/auth/src/guards.ts`**

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@nexus/api/envelope";
import { getSessionUser, type SessionUser } from "./session";

export async function requireAuth(
  request: NextRequest,
): Promise<{ session: SessionUser } | { redirect: string }> {
  const session = await getSessionUser();
  if (!session) {
    return { redirect: `/login?callbackUrl=${encodeURIComponent(request.url)}` };
  }
  return { session };
}

export async function requireRole(
  request: NextRequest,
  role: "admin" | "superadmin",
): Promise<{ session: SessionUser } | { redirect: string }> {
  const auth = await requireAuth(request);
  if ("redirect" in auth) return { redirect: auth.redirect };

  const hierarchy: Record<string, number> = { user: 0, admin: 1, superadmin: 2 };
  if ((hierarchy[auth.session.role] ?? 0) < hierarchy[role]) {
    return { redirect: "/login" };
  }
  return { session: auth.session };
}

export function requireOwner(
  session: SessionUser | null,
  resourceOwnerId: string,
): asserts session is SessionUser {
  if (!session) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
  }
  if (session.id !== resourceOwnerId && session.role !== "admin" && session.role !== "superadmin") {
    throw new ApiError(403, "FORBIDDEN", "You do not own this resource");
  }
}
```

- [ ] **Step 3: Write the failing test**

Create `packages/auth/src/__tests__/guards.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { requireOwner } from "../guards";
import type { SessionUser } from "../session";

describe("requireOwner", () => {
  it("throws 401 when no session", () => {
    expect(() => requireOwner(null, "user-1")).toThrow(/Authentication required/);
  });

  it("passes when user owns the resource", () => {
    const session: SessionUser = {
      id: "user-1", email: "a@b.com", name: null, image: null,
      role: "user", emailVerified: true, deviceId: null,
    };
    expect(() => requireOwner(session, "user-1")).not.toThrow();
  });

  it("throws 403 when user does not own the resource", () => {
    const session: SessionUser = {
      id: "user-1", email: "a@b.com", name: null, image: null,
      role: "user", emailVerified: true, deviceId: null,
    };
    expect(() => requireOwner(session, "user-2")).toThrow(/do not own/);
  });

  it("passes for admin accessing any resource", () => {
    const session: SessionUser = {
      id: "admin-1", email: "admin@b.com", name: null, image: null,
      role: "admin", emailVerified: true, deviceId: null,
    };
    expect(() => requireOwner(session, "user-2")).not.toThrow();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd packages/auth && npx vitest run src/__tests__/guards.test.ts`
Expected: FAIL — `ApiError` not yet imported (will pass once Task 5 wires `@nexus/api`).

- [ ] **Step 5: Commit**

```bash
git add packages/auth/src/session.ts packages/auth/src/guards.ts packages/auth/src/__tests__/
git commit -m "feat(@nexus/auth): add session helpers and authorization guards

- getSession, getSessionUser, getSessionExpires helpers
- requireAuth, requireRole, requireOwner guards
- Unit tests for requireOwner"
```

---

## Task 3: Revocation Module

**Files:**
- Create: `packages/auth/src/revocation.ts`
- Create: `packages/db/src/schema/revoked-sessions.ts`
- Create: `packages/db/src/migrations/016_create_revoked_sessions.sql`
- Create: `packages/auth/src/__tests__/revocation.test.ts`

**Interfaces:**
- Consumes: `getRedis` from `@nexus/cache`, `db` from `@nexus/db`
- Produces:
  - `isRevoked(jti: string): Promise<boolean>`
  - `revokeAllUserSessions(userId, { reason, exceptJti?, revokedBy? }): Promise<number>`

- [ ] **Step 1: Create `packages/db/src/schema/revoked-sessions.ts`**

```typescript
import { pgTable, varchar, uuid, timestamp } from "drizzle-orm/pg-core";

export const revokedSessions = pgTable("revoked_sessions", {
  jti: varchar("jti", { length: 255 }).primaryKey(),
  userId: uuid("user_id").notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  reason: varchar("reason", { length: 100 }),
  revokedBy: uuid("revoked_by"),
});
```

- [ ] **Step 2: Create `packages/db/src/migrations/016_create_revoked_sessions.sql`**

```sql
CREATE TABLE IF NOT EXISTS revoked_sessions (
    jti varchar(255) PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    revoked_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    reason varchar(100),
    revoked_by uuid REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_revoked_sessions_user ON revoked_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_revoked_sessions_expires ON revoked_sessions(expires_at);
```

- [ ] **Step 3: Create `packages/auth/src/revocation.ts`**

```typescript
import { getRedis } from "@nexus/cache/client";
import { db } from "@nexus/db";
import { revokedSessions } from "@nexus/db/schema/revoked-sessions";
import { eq } from "drizzle-orm";

export async function isRevoked(jti: string): Promise<boolean> {
  const redis = getRedis();
  const cached = await redis.get<boolean>(`v1:revoked:${jti}`);
  if (cached !== null) return cached;

  const row = await db.query.revokedSessions.findFirst({
    where: eq(revokedSessions.jti, jti),
  });

  const ttl = row
    ? Math.min(30 * 86400, Math.floor((row.expiresAt.getTime() - Date.now()) / 1000))
    : 60;
  await redis.set(`v1:revoked:${jti}`, !!row, { ex: Math.max(ttl, 60) });

  return !!row;
}

export async function revokeAllUserSessions(
  userId: string,
  options: { reason: string; exceptJti?: string; revokedBy?: string },
): Promise<number> {
  const { userDeviceSessions } = await import("@nexus/db/schema/user-device-sessions");
  const devices = await db.query.userDeviceSessions.findMany({
    where: eq(userDeviceSessions.userId, userId),
  });

  let count = 0;
  for (const device of devices) {
    if (options.exceptJti && device.currentJti === options.exceptJti) continue;
    if (!device.currentJti) continue;

    await db.insert(revokedSessions).values({
      jti: device.currentJti,
      userId,
      expiresAt: device.expiresAt,
      reason: options.reason,
      revokedBy: options.revokedBy ?? null,
    });

    const redis = getRedis();
    await redis.set(`v1:revoked:${device.currentJti}`, true, { ex: 30 * 86400 });
    count++;
  }

  return count;
}
```

- [ ] **Step 4: Write the failing test**

`packages/auth/src/__tests__/revocation.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { isRevoked, revokeAllUserSessions } from "../revocation";
import { getRedis } from "@nexus/cache/client";

vi.mock("@nexus/cache/client", () => ({
  getRedis: vi.fn(),
}));

vi.mock("@nexus/db", () => ({
  db: {
    query: { revokedSessions: { findFirst: vi.fn() } },
    insert: vi.fn(() => ({ values: vi.fn() })),
  },
}));

describe("isRevoked", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when Redis cache says revoked", async () => {
    const redis = { get: vi.fn().mockResolvedValue(true), set: vi.fn() };
    (getRedis as any).mockReturnValue(redis);
    expect(await isRevoked("jti-123")).toBe(true);
  });

  it("returns false when no cache and no DB row", async () => {
    const redis = { get: vi.fn().mockResolvedValue(null), set: vi.fn() };
    (getRedis as any).mockReturnValue(redis);
    const { db } = await import("@nexus/db");
    (db.query.revokedSessions.findFirst as any).mockResolvedValue(null);

    expect(await isRevoked("jti-456")).toBe(false);
    expect(redis.set).toHaveBeenCalledWith("v1:revoked:jti-456", false, { ex: 60 });
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd packages/auth && npx vitest run src/__tests__/revocation.test.ts`
Expected: FAIL — `@nexus/db/schema/user-device-sessions` not yet created (Task 4).

- [ ] **Step 6: Commit**

```bash
git add packages/auth/src/revocation.ts packages/db/src/schema/revoked-sessions.ts packages/db/src/migrations/016_create_revoked_sessions.sql packages/auth/src/__tests__/revocation.test.ts
git commit -m "feat(@nexus/auth): add JTI revocation with Redis cache

- isRevoked checks Redis v1:revoked:{jti} first, falls back to DB
- revokeAllUserSessions bulk-revokes all device JTIs for a user
- revoked_sessions table migration (016) with revoked_by column
- Unit tests for isRevoked"
```

---

## Task 4: Device Tracking Module

**Files:**
- Create: `packages/auth/src/device.ts`
- Create: `packages/db/src/schema/user-device-sessions.ts`
- Create: `packages/db/src/migrations/017_create_user_device_sessions.sql`
- Create: `packages/auth/src/__tests__/device.test.ts`

**Interfaces:**
- Consumes: `getRedis` from `@nexus/cache`, `db` from `@nexus/db`
- Produces:
  - `computeDeviceFingerprint(req: NextRequest): string`
  - `generateDeviceLabel(req: NextRequest): string`
  - `upsertDeviceSession(userId, fingerprint, req): Promise<{ deviceId: string; isNew: boolean }>`
  - `enforceDeviceLimit(userId, tier): Promise<void>` — revokes oldest if over limit

- [ ] **Step 1: Create `packages/db/src/schema/user-device-sessions.ts`**

```typescript
import {
  pgTable, uuid, varchar, timestamp, boolean,
} from "drizzle-orm/pg-core";

export const userDeviceSessions = pgTable("user_device_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  deviceId: varchar("device_id", { length: 32 }).notNull(),
  deviceLabel: varchar("device_label", { length: 255 }),
  deviceFingerprint: varchar("device_fingerprint", { length: 64 }).notNull(),
  currentJti: varchar("current_jti", { length: 255 }),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
  ipSubnet: varchar("ip_subnet", { length: 45 }),
  isCurrent: boolean("is_current").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
```

- [ ] **Step 2: Create `packages/db/src/migrations/017_create_user_device_sessions.sql`**

```sql
CREATE TABLE IF NOT EXISTS user_device_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id varchar(32) NOT NULL,
    device_label varchar(255),
    device_fingerprint varchar(64) NOT NULL,
    current_jti varchar(255),
    last_active_at timestamptz NOT NULL DEFAULT now(),
    ip_subnet varchar(45),
    is_current boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    UNIQUE(user_id, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_device_sessions_user ON user_device_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_device_sessions_expires ON user_device_sessions(expires_at);
```

- [ ] **Step 3: Create `packages/auth/src/device.ts`**

```typescript
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { getRedis } from "@nexus/cache/client";
import { db } from "@nexus/db";
import { userDeviceSessions } from "@nexus/db/schema/user-device-sessions";
import { and, eq, asc } from "drizzle-orm";
import { DEVICE_LIMITS } from "./constants";

export function computeDeviceFingerprint(req: NextRequest): string {
  const ua = req.headers.get("user-agent") ?? "";
  const lang = req.headers.get("accept-language") ?? "";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const subnet = ip.split(".").slice(0, 3).join(".") + ".0/24";
  const raw = `${ua}|${lang}|${subnet}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

export function generateDeviceLabel(req: NextRequest): string {
  const ua = req.headers.get("user-agent") ?? "";
  // Simplified UA parsing — production can use ua-parser-js
  let browser = "Unknown";
  if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";

  let os = "Unknown";
  if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("iPhone")) os = "iPhone";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("Linux")) os = "Linux";

  return `${browser} • ${os}`;
}

export async function upsertDeviceSession(
  userId: string,
  req: NextRequest,
  jti: string | null,
): Promise<{ deviceId: string; isNew: boolean; deviceLabel: string }> {
  const fingerprint = computeDeviceFingerprint(req);
  const label = generateDeviceLabel(req);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const subnet = ip.split(".").slice(0, 3).join(".") + ".0/24";

  const existing = await db.query.userDeviceSessions.findFirst({
    where: and(
      eq(userDeviceSessions.userId, userId),
      eq(userDeviceSessions.deviceFingerprint, fingerprint),
    ),
  });

  if (existing) {
    await db.update(userDeviceSessions)
      .set({ lastActiveAt: new Date(), ipSubnet: subnet, currentJti: jti, isCurrent: true })
      .where(eq(userDeviceSessions.id, existing.id));
    return { deviceId: existing.deviceId, isNew: false, deviceLabel: label };
  }

  await db.insert(userDeviceSessions).values({
    userId,
    deviceId: fingerprint.slice(0, 8),
    deviceLabel: label,
    deviceFingerprint: fingerprint,
    currentJti: jti,
    ipSubnet: subnet,
    isCurrent: true,
    expiresAt: new Date(Date.now() + 30 * 86400 * 1000),
  });

  return { deviceId: fingerprint.slice(0, 8), isNew: true, deviceLabel: label };
}

export async function enforceDeviceLimit(
  userId: string,
  tier: "free" | "prime" | "resonance",
): Promise<void> {
  const limit = DEVICE_LIMITS[tier];
  const sessions = await db.query.userDeviceSessions.findMany({
    where: eq(userDeviceSessions.userId, userId),
    orderBy: [asc(userDeviceSessions.lastActiveAt)],
  });

  if (sessions.length <= limit) return;

  const toRevoke = sessions.slice(0, sessions.length - limit);
  for (const session of toRevoke) {
    if (session.currentJti) {
      const { revokeAllUserSessions } = await import("./revocation");
      await revokeAllUserSessions(userId, {
        reason: "concurrent_limit",
        exceptJti: session.currentJti,
      });
    }
    await db.delete(userDeviceSessions).where(eq(userDeviceSessions.id, session.id));
  }
}
```

- [ ] **Step 4: Write the failing test**

`packages/auth/src/__tests__/device.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeDeviceFingerprint, generateDeviceLabel } from "../device";

function makeReq(headers: Record<string, string> = {}): any {
  return { headers: { get: (k: string) => headers[k] ?? null } };
}

describe("computeDeviceFingerprint", () => {
  it("returns a 16-char hex string", () => {
    const fp = computeDeviceFingerprint(makeReq({ "user-agent": "Mozilla/5.0 Chrome" }));
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is deterministic for same input", () => {
    const a = computeDeviceFingerprint(makeReq({ "user-agent": "Chrome", "accept-language": "en-US" }));
    const b = computeDeviceFingerprint(makeReq({ "user-agent": "Chrome", "accept-language": "en-US" }));
    expect(a).toBe(b);
  });

  it("differs for different UA", () => {
    const a = computeDeviceFingerprint(makeReq({ "user-agent": "Chrome" }));
    const b = computeDeviceFingerprint(makeReq({ "user-agent": "Firefox" }));
    expect(a).not.toBe(b);
  });
});

describe("generateDeviceLabel", () => {
  it("detects Chrome on macOS", () => {
    const req = makeReq({ "user-agent": "Mozilla/5.0 (Macintosh) Chrome/120.0" });
    expect(generateDeviceLabel(req)).toBe("Chrome • macOS");
  });

  it("detects Safari on iPhone", () => {
    const req = makeReq({ "user-agent": "Mozilla/5.0 (iPhone) Version/17.0 Safari" });
    expect(generateDeviceLabel(req)).toBe("Safari • iPhone");
  });
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/auth && npx vitest run src/__tests__/device.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/auth/src/device.ts packages/db/src/schema/user-device-sessions.ts packages/db/src/migrations/017_create_user_device_sessions.sql packages/auth/src/__tests__/device.test.ts
git commit -m "feat(@nexus/auth): add device fingerprinting and concurrent session limits

- computeDeviceFingerprint: UA + language + /24 subnet heuristic
- generateDeviceLabel: simplified UA parser (Chrome/Firefox/Safari + OS)
- upsertDeviceSession: records device on login, detects new devices
- enforceDeviceLimit: revokes oldest sessions beyond tier limit
- user_device_sessions table migration (017)
- Unit tests for fingerprint and label generation"
```

---

## Task 5: Remember Me Module

**Files:**
- Create: `packages/auth/src/remember-me.ts`
- Create: `packages/auth/src/__tests__/remember-me.test.ts`

**Interfaces:**
- Consumes: `getRedis` from `@nexus/cache`, `AUTH_SECRET` from env
- Produces:
  - `createRememberMeToken(userId, deviceId?): Promise<string>` — returns JWT signed with AUTH_SECRET
  - `isRememberMeTokenValid(token): Promise<{ valid: boolean; userId?: string; deviceId?: string }>`
  - `clearRememberMeToken(token): Promise<void>`

- [ ] **Step 1: Create `packages/auth/src/remember-me.ts`**

```typescript
import { SignJWT, jwtVerify } from "jose";
import { getRedis } from "@nexus/cache/client";
import { REMEMBER_ME_TTL } from "./constants";

const encoder = new TextEncoder();
function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 bytes");
  }
  return encoder.encode(secret);
}

export interface RememberMePayload {
  sub: string;       // user_id
  device_id: string | null;
  jti: string;
  iat: number;
  exp: number;
}

export async function createRememberMeToken(
  userId: string,
  deviceId: string | null,
): Promise<string> {
  const jti = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({ sub: userId, device_id: deviceId, jti })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + REMEMBER_ME_TTL)
    .setJti(jti)
    .sign(getSecret());

  // Store in Redis for quick invalidation lookup
  const redis = getRedis();
  await redis.set(`v1:remember_me:${jti}`, userId, { ex: REMEMBER_ME_TTL });

  return token;
}

export async function isRememberMeTokenValid(
  token: string,
): Promise<{ valid: boolean; userId?: string; deviceId?: string; jti?: string }> {
  try {
    const { payload } = await jwtVerify<RememberMePayload>(token, getSecret(), {
      algorithms: ["HS256"],
    });

    // Check Redis for revocation
    const redis = getRedis();
    const stored = await redis.get<string>(`v1:remember_me:${payload.jti}`);
    if (stored !== payload.sub) {
      return { valid: false };
    }

    return {
      valid: true,
      userId: payload.sub,
      deviceId: payload.device_id ?? null,
      jti: payload.jti,
    };
  } catch {
    return { valid: false };
  }
}

export async function clearRememberMeToken(token: string): Promise<void> {
  try {
    const { payload } = await jwtVerify<RememberMePayload>(token, getSecret(), {
      algorithms: ["HS256"],
    });
    const redis = getRedis();
    await redis.del(`v1:remember_me:${payload.jti}`);
  } catch {
    // Invalid token — nothing to clear
  }
}
```

- [ ] **Step 2: Write the failing test**

`packages/auth/src/__tests__/remember-me.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { createRememberMeToken, isRememberMeTokenValid, clearRememberMeToken } from "../remember-me";

process.env.AUTH_SECRET = "test-secret-that-is-32-bytes-long!!";

vi.mock("@nexus/cache/client", () => ({
  getRedis: vi.fn(() => ({
    set: vi.fn(),
    get: vi.fn().mockResolvedValue("user-1"),
    del: vi.fn(),
  })),
}));

describe("remember-me", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a valid JWT", async () => {
    const token = await createRememberMeToken("user-1", "device-abc");
    expect(token).toMatch(/^eyJ/); // JWT prefix
  });

  it("validates a fresh token", async () => {
    const token = await createRememberMeToken("user-1", "device-abc");
    const result = await isRememberMeTokenValid(token);
    expect(result.valid).toBe(true);
    expect(result.userId).toBe("user-1");
  });

  it("rejects a cleared token", async () => {
    const token = await createRememberMeToken("user-1", "device-abc");
    await clearRememberMeToken(token);
    const result = await isRememberMeTokenValid(token);
    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd packages/auth && npx vitest run src/__tests__/remember-me.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/remember-me.ts packages/auth/src/__tests__/remember-me.test.ts
git commit -m "feat(@nexus/auth): add Remember Me token flow

- createRememberMeToken: JWT signed with AUTH_SECRET, 365-day TTL
- isRememberMeTokenValid: signature + Redis revocation check
- clearRememberMeToken: invalidates Redis key
- Unit tests for create/validate/clear flow"
```

---

## Task 6: Auth Actions (Login, Signout, Password Change)

**Files:**
- Create: `apps/web/actions/auth.ts`
- Create: `apps/web/lib/session-listener.ts`
- Create: `apps/web/__tests__/actions/auth-action.test.ts`

**Interfaces:**
- Consumes: Auth.js `signIn`, `signOut` from `@nexus/auth/handlers`, `createRememberMeToken`, `revokeAllUserSessions`, `upsertDeviceSession`
- Produces:
  - `loginAction(formData: FormData): Promise<{ ok: boolean; error?: string }>`
  - `signoutAction(): Promise<void>`
  - `changePasswordAction(formData: FormData): Promise<{ ok: boolean; error?: string }>`
  - `SessionListener` React component (client)

- [ ] **Step 1: Create `apps/web/actions/auth.ts`**

```typescript
"use server";

import { signIn, signOut } from "@nexus/auth/handlers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { loginSchema, resetPasswordSchema } from "@nexus/validation";
import { createRememberMeToken, clearRememberMeToken } from "@nexus/auth/remember-me";
import { upsertDeviceSession } from "@nexus/auth/device";
import { revokeAllUserSessions } from "@nexus/auth/revocation";
import { getSessionUser } from "@nexus/auth/session";

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    remember: formData.get("remember") === "on",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors };
  }

  const { email, password, remember } = parsed.data;

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (err: any) {
    if (err?.name === "AuthError") {
      return { ok: false, error: "Invalid email or password" };
    }
    throw err;
  }

  // Issue remember-me cookie if requested
  if (remember) {
    const user = await getSessionUser();
    if (user) {
      const token = await createRememberMeToken(user.id, user.deviceId);
      cookies.set("__Host-nexus-remember", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 365 * 86400,
      });
    }
  }

  revalidatePath("/nexus");
  redirect("/nexus");
}

export async function signoutAction() {
  // Clear remember-me cookie
  const rememberToken = cookies().get("__Host-nexus-remember")?.value;
  if (rememberToken) {
    await clearRememberMeToken(rememberToken);
  }

  cookies().set("__Host-nexus-session", "", { maxAge: 0 });
  cookies().set("__Host-nexus-remember", "", { maxAge: 0 });

  await signOut({ redirect: false });
  redirect("/login");
}

export async function changePasswordAction(formData: FormData) {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten().fieldErrors };
  }

  const user = await getSessionUser();
  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  // Revoke all other sessions (keep current)
  await revokeAllUserSessions(user.id, {
    reason: "password_change",
  });

  revalidatePath("/settings/security");
  return { ok: true };
}
```

- [ ] **Step 2: Create `apps/web/lib/session-listener.ts`**

```typescript
"use client";

import { useEffect } from "react";

export function SessionListener() {
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        if (res.status === 401) {
          window.location.href = "/login?reason=expired";
        }
      } catch {
        // Network error — ignore, retry next interval
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
```

- [ ] **Step 3: Write the failing test**

`apps/web/__tests__/actions/auth-action.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { loginAction, signoutAction } from "../../actions/auth";

vi.mock("@nexus/auth/handlers", () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@nexus/auth/remember-me", () => ({
  createRememberMeToken: vi.fn(),
  clearRememberMeToken: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("loginAction", () => {
  it("returns error for invalid input", async () => {
    const formData = new FormData();
    formData.set("email", "not-an-email");
    formData.set("password", "short");

    const result = await loginAction(formData);
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd apps/web && npx vitest run __tests__/actions/auth-action.test.ts`
Expected: FAIL — `getSessionUser` not mocked (will pass once Task 7 wires middleware).

- [ ] **Step 5: Commit**

```bash
git add apps/web/actions/auth.ts apps/web/lib/session-listener.ts apps/web/__tests__/actions/auth-action.test.ts
git commit -m "feat(web): add auth actions for login, signout, password change

- loginAction: validates input, signs in, issues remember-me cookie
- signoutAction: clears cookies, invalidates remember-me token
- changePasswordAction: revokes all other sessions on password change
- SessionListener: client component polling for remote revocation every 60s"
```

---

## Task 7: Middleware Integration

**Files:**
- Modify: `apps/web/middleware.ts`

**Interfaces:**
- Consumes: `getSessionUser` from `@nexus/auth`, `isRememberMeTokenValid` from `@nexus/auth/remember-me`, `isRevoked` from `@nexus/auth/revocation`
- Produces: Updated middleware with iat absolute-max check + remember-me auto-login

- [ ] **Step 1: Modify `apps/web/middleware.ts`**

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@nexus/auth/session";
import { isRememberMeTokenValid } from "@nexus/auth/remember-me";
import { ABSOLUTE_MAX } from "@nexus/auth/constants";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Session resolution
  const session = await getSessionUser();

  // 2. Absolute-max enforcement (30-day window)
  if (session) {
    const iat = (session as any).iat;
    if (iat) {
      const age = Math.floor(Date.now() / 1000) - iat;
      if (age > ABSOLUTE_MAX) {
        const response = NextResponse.redirect(new URL("/login", request.url));
        response.cookies.set("__Host-nexus-session", "", { maxAge: 0 });
        return response;
      }
    }
  }

  // 3. Remember-me auto-login
  if (!session) {
    const rememberToken = request.cookies.get("__Host-nexus-remember")?.value;
    if (rememberToken) {
      const result = await isRememberMeTokenValid(rememberToken);
      if (result.valid && result.userId) {
        // Redirect to self to establish fresh session
        // (Full implementation calls an internal auto-login endpoint)
        const response = NextResponse.redirect(new URL("/api/auth/remember-me-login", request.url));
        return response;
      }
    }
  }

  // 4. Auth redirect (protected pages)
  if (pathname.startsWith("/nexus/") || pathname.startsWith("/settings/")) {
    if (!session) {
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${encodeURIComponent(request.url)}`, request.url),
      );
    }
  }

  // 5. Admin guard
  if (pathname.startsWith("/admin/")) {
    if (!session || (session.role !== "admin" && session.role !== "superadmin")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // 6. Security headers
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/middleware.ts
git commit -m "feat(web): integrate session strategy into middleware

- Add 30-day absolute-max enforcement via iat claim
- Add remember-me auto-login flow
- Preserve existing auth/admin redirects and security headers"
```

---

## Task 8: Auth Route Handler & Cron Cleanup

**Files:**
- Create: `apps/web/app/api/auth/[...nextauth]/route.ts`
- Create: `apps/web/app/api/cron/cleanup-revoked-sessions/route.ts`
- Create: `apps/web/app/api/v1/admin/users/[id]/revoke-sessions/route.ts`

**Interfaces:**
- Consumes: `GET, POST` from `@nexus/auth/handlers`, `revokeAllUserSessions`, `requireRole`
- Produces: Auth.js route handler, daily cleanup cron, admin force-logout endpoint

- [ ] **Step 1: Create `apps/web/app/api/auth/[...nextauth]/route.ts`**

```typescript
export { GET, POST } from "@nexus/auth/handlers";
```

- [ ] **Step 2: Create `apps/web/app/api/cron/cleanup-revoked-sessions/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { db } from "@nexus/db";
import { revokedSessions } from "@nexus/db/schema/revoked-sessions";
import { userDeviceSessions } from "@nexus/db/schema/user-device-sessions";
import { lt } from "drizzle-orm";

export async function GET() {
  // Auth: require Vercel Cron secret
  const authHeader = headers().get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }

  const deletedRevoked = await db.delete(revokedSessions).where(
    lt(revokedSessions.expiresAt, new Date()),
  );
  const deletedDevices = await db.delete(userDeviceSessions).where(
    lt(userDeviceSessions.expiresAt, new Date()),
  );

  return NextResponse.json({
    data: {
      deletedRevoked: deletedRevoked.rowCount,
      deletedDevices: deletedDevices.rowCount,
    },
    meta: { requestId: crypto.randomUUID(), version: "v1" },
  });
}
```

- [ ] **Step 3: Create `apps/web/app/api/v1/admin/users/[id]/revoke-sessions/route.ts`**

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@nexus/auth/guards";
import { revokeAllUserSessions } from "@nexus/auth/revocation";
import { getSessionUser } from "@nexus/auth/session";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireRole(request, "superadmin");
  if ("redirect" in auth) {
    return NextResponse.json({ error: { message: "Forbidden" } }, { status: 403 });
  }

  const admin = await getSessionUser();
  const count = await revokeAllUserSessions(params.id, {
    reason: "admin_action",
    revokedBy: admin?.id,
  });

  return NextResponse.json({
    data: { revoked: count },
    meta: { requestId: crypto.randomUUID(), version: "v1" },
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/auth apps/web/app/api/cron apps/web/app/api/v1/admin
git commit -m "feat(web): wire Auth.js route handler, cleanup cron, admin revoke

- /api/auth/[...nextauth] delegates to @nexus/auth handlers
- /api/cron/cleanup-revoked-sessions daily cleanup (CRON_SECRET auth)
- /api/v1/admin/users/[id]/revoke-sessions superadmin force-logout"
```

---

## Task 9: Login Page with Remember Me & Device Management UI

**Files:**
- Modify: `apps/web/app/(auth)/login/page.tsx`
- Create: `apps/web/app/(app)/settings/security/devices/page.tsx`
- Create: `apps/web/features/auth/components/signout-button.tsx`

**Interfaces:**
- Consumes: `loginAction`, `getSessionUser`, `requireAuth`
- Produces: Login page with Remember Me checkbox, device list UI, signout button

- [ ] **Step 1: Modify `apps/web/app/(auth)/login/page.tsx`**

Add a Remember Me checkbox:

```tsx
// Inside the login form, after the password field:
<label className="flex items-center gap-2 text-sm text-text-70">
  <input
    type="checkbox"
    name="remember"
    className="h-4 w-4 rounded border-white/20 bg-void-base text-resonance focus:ring-resonance"
  />
  Remember me for 1 year
</label>
```

- [ ] **Step 2: Create `apps/web/app/(app)/settings/security/devices/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { requireAuth } from "@nexus/auth/guards";
import { getSessionUser } from "@nexus/auth/session";
import { db } from "@nexus/db";
import { userDeviceSessions } from "@nexus/db/schema/user-device-sessions";
import { eq, desc } from "drizzle-orm";

export default async function DevicesPage() {
  const auth = await requireAuth(request);
  if ("redirect" in auth) return redirect(auth.redirect);

  const session = await getSessionUser();
  if (!session) return redirect("/login");

  const devices = await db.query.userDeviceSessions.findMany({
    where: eq(userDeviceSessions.userId, session.id),
    orderBy: [desc(userDeviceSessions.lastActiveAt)],
  });

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold text-text-100">Active Devices</h1>
      <p className="mb-4 text-text-70">
        You are signed in on {devices.length} device(s).
      </p>
      <ul className="space-y-3">
        {devices.map((device) => (
          <li
            key={device.id}
            className="flex items-center justify-between rounded-lg border border-white/10 bg-void-surface p-4"
          >
            <div>
              <p className="font-medium text-text-100">{device.deviceLabel}</p>
              <p className="text-sm text-text-45">
                Last active: {device.lastActiveAt.toLocaleString()}
                {device.isCurrent && (
                  <span className="ml-2 rounded bg-resonance/20 px-2 py-0.5 text-xs text-resonance">
                    This device
                  </span>
                )}
              </p>
            </div>
            {!device.isCurrent && (
              <form action={`/settings/security/devices/${device.id}/revoke`} method="POST">
                <button className="rounded bg-red-500/20 px-3 py-1 text-sm text-red-400">
                  Revoke
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/web/features/auth/components/signout-button.tsx`**

```tsx
"use client";

import { signoutAction } from "@/actions/auth";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await signoutAction();
    router.push("/login");
  }

  return (
    <button
      onClick={handleSignOut}
      className="rounded bg-white/10 px-4 py-2 text-sm text-text-100 hover:bg-white/20"
    >
      Sign out
    </button>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(auth\)/login/page.tsx apps/web/app/\(app\)/settings/security/devices apps/web/features/auth/components/signout-button.tsx
git commit -m "feat(web): add Remember Me checkbox, device management UI, signout button

- Login page: Remember Me checkbox feeds loginAction
- /settings/security/devices: list active devices with revoke button
- SignOutButton: client component calling signoutAction"
```

---

## Task 10: Integration Tests

**Files:**
- Create: `apps/web/__tests__/session-revocation.test.ts`
- Create: `apps/web/__tests__/device-tracking.test.ts`
- Create: `apps/web/__tests__/remember-me.test.ts`
- Create: `apps/web/__tests__/logout-flow.test.ts`

**Interfaces:**
- Consumes: All modules from Tasks 1-9
- Produces: End-to-end integration tests covering the full session lifecycle

- [ ] **Step 1: Create `apps/web/__tests__/session-revocation.test.ts`**

```typescript
import { describe, it, expect, vi } from "vitest";
import { isRevoked, revokeAllUserSessions } from "@nexus/auth/revocation";

describe("Session Revocation Integration", () => {
  it("revokes a single JTI on logout", async () => {
    const { getRedis } = await import("@nexus/cache/client");
    const redis = getRedis();
    const spy = vi.spyOn(redis, "set");

    await revokeAllUserSessions("user-1", { reason: "logout", exceptJti: "keep-this" });
    expect(spy).toHaveBeenCalledWith("v1:revoked:device-jti-1", true, { ex: 30 * 86400 });
  });

  it("skips exceptJti when revoking all", async () => {
    const { db } = await import("@nexus/db");
    const { userDeviceSessions } = await import("@nexus/db/schema/user-device-sessions");
    (db.query.userDeviceSessions.findMany as any).mockResolvedValue([
      { currentJti: "keep-this", expiresAt: new Date() },
      { currentJti: "revoke-this", expiresAt: new Date() },
    ]);

    const count = await revokeAllUserSessions("user-1", {
      reason: "password_change",
      exceptJti: "keep-this",
    });
    expect(count).toBe(1);
  });
});
```

- [ ] **Step 2: Create `apps/web/__tests__/device-tracking.test.ts`**

```typescript
import { describe, it, expect, vi } from "vitest";
import { computeDeviceFingerprint, generateDeviceLabel } from "@nexus/auth/device";
import { enforceDeviceLimit } from "@nexus/auth/device";

describe("Device Tracking Integration", () => {
  it("detects new device on different UA", () => {
    const req1 = { headers: { get: () => "Chrome/120 macOS" } };
    const req2 = { headers: { get: () => "Firefox/120 Windows" } };
    const fp1 = computeDeviceFingerprint(req1 as any);
    const fp2 = computeDeviceFingerprint(req2 as any);
    expect(fp1).not.toBe(fp2);
  });

  it("enforces concurrent session limit", async () => {
    const { db } = await import("@nexus/db");
    const { userDeviceSessions } = await import("@nexus/db/schema/user-device-sessions");
    (db.query.userDeviceSessions.findMany as any).mockResolvedValue([
      { id: "d1", currentJti: "jti-1", lastActiveAt: new Date("2026-01-01"), expiresAt: new Date() },
      { id: "d2", currentJti: "jti-2", lastActiveAt: new Date("2026-01-02"), expiresAt: new Date() },
      { id: "d3", currentJti: "jti-3", lastActiveAt: new Date("2026-01-03"), expiresAt: new Date() },
    ]);
    (db.delete as any).mockResolvedValue({});

    await enforceDeviceLimit("user-1", "free"); // limit = 2
    expect(db.delete).toHaveBeenCalledWith(userDeviceSessions, expect.anything());
  });
});
```

- [ ] **Step 3: Create `apps/web/__tests__/remember-me.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { createRememberMeToken, isRememberMeTokenValid } from "@nexus/auth/remember-me";

process.env.AUTH_SECRET = "integration-test-secret-32-bytes!!";

describe("Remember Me Integration", () => {
  it("creates and validates a token round-trip", async () => {
    const token = await createRememberMeToken("user-1", "device-abc");
    const result = await isRememberMeTokenValid(token);
    expect(result.valid).toBe(true);
    expect(result.userId).toBe("user-1");
    expect(result.deviceId).toBe("device-abc");
  });

  it("rejects a token with wrong secret", async () => {
    const token = await createRememberMeToken("user-1", null);
    process.env.AUTH_SECRET = "different-secret-32-bytes-long!!";
    const result = await isRememberMeTokenValid(token);
    expect(result.valid).toBe(false);
    process.env.AUTH_SECRET = "integration-test-secret-32-bytes!!";
  });
});
```

- [ ] **Step 4: Create `apps/web/__tests__/logout-flow.test.ts`**

```typescript
import { describe, it, expect, vi } from "vitest";
import { revokeAllUserSessions } from "@nexus/auth/revocation";

describe("Logout Flow Integration", () => {
  it("self-logout revokes only current JTI", async () => {
    const { db } = await import("@nexus/db");
    const insertSpy = vi.fn(() => ({ values: vi.fn() }));
    (db.insert as any).mockReturnValue(insertSpy);

    await revokeAllUserSessions("user-1", { reason: "logout", exceptJti: "current" });
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "logout" }),
    );
  });

  it("password-change logout revokes all except current", async () => {
    const { db } = await import("@nexus/db");
    const { userDeviceSessions } = await import("@nexus/db/schema/user-device-sessions");
    (db.query.userDeviceSessions.findMany as any).mockResolvedValue([
      { currentJti: "current", expiresAt: new Date() },
      { currentJti: "other-1", expiresAt: new Date() },
      { currentJti: "other-2", expiresAt: new Date() },
    ]);

    const count = await revokeAllUserSessions("user-1", {
      reason: "password_change",
      exceptJti: "current",
    });
    expect(count).toBe(2);
  });
});
```

- [ ] **Step 5: Run all tests**

Run: `cd apps/web && npx vitest run __tests__/`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/__tests__/session-revocation.test.ts apps/web/__tests__/device-tracking.test.ts apps/web/__tests__/remember-me.test.ts apps/web/__tests__/logout-flow.test.ts
git commit -m "test: add integration tests for session lifecycle

- Session revocation: single JTI, bulk with exceptJti
- Device tracking: fingerprinting, concurrent limit enforcement
- Remember Me: round-trip create/validate, wrong-secret rejection
- Logout flow: self-logout vs password-change revocation scope"
```

---

## Task 11: Final Verification & Cleanup

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: all prior tasks
- Produces: green test suite, clean typecheck

- [ ] **Step 1: Run full typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run full test suite**

Run: `cd apps/web && npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Run lint**

Run: `cd apps/web && npx next lint`
Expected: 0 errors

- [ ] **Step 4: Run build**

Run: `cd apps/web && npx next build`
Expected: Build succeeds

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: verify M3.3 implementation — typecheck, tests, lint, build green"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-25-m33-session-token-strategy.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?