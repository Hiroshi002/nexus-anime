# Authentication Architecture — Nexus Anime

> **Audience:** Engineers implementing auth flows, session management, and authorization checks. This document covers the complete auth system from credential entry to session lifecycle.

---

## 1. Authentication Library

**Auth.js v5** (formerly NextAuth.js v5) — the official Next.js auth library.

### Why Auth.js v5 over alternatives

| Alternative     | Why rejected                                                                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Custom JWT auth | Manual implementation of token signing, rotation, revocation, CSRF. Every edge case (expired token during request, concurrent refresh, session fixation) must be handled. Auth.js solves these. |
| Clerk           | Hosted auth service — adds a third-party dependency for a core feature. Vendor lock-in for user data (Clerk owns the user table). Free tier limits: 10K MAU.                                    |
| Supabase Auth   | Tied to Supabase's Postgres — we use Neon. Migration would require exporting users.                                                                                                             |
| Lucia           | Good library, but smaller community. Auth.js is the de facto Next.js standard with first-class App Router support.                                                                              |

---

## 2. Auth Providers

| Provider        | Type             | When                              | Why                                                                                                     |
| --------------- | ---------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Credentials** | Email + password | Primary — always available        | Universal; works without third-party OAuth setup. Users who don't want Google/GitHub linkage need this. |
| **Google**      | OAuth 2.0        | Recommended — reduces friction    | Most users have Google accounts. OIDC gives verified email automatically.                               |
| **GitHub**      | OAuth 2.0        | Optional — for developer audience | Niche but aligns with the gaming-crossover audience. Secondary OAuth option.                            |

### Why credentials + OAuth, not OAuth-only

OAuth-only excludes users without Google/GitHub accounts (rare, but real). It also creates a single point of failure — if Google OAuth is down, nobody can sign up. Credentials provide a reliable fallback.

### Why not Magic Links (email-only)

| Pros                    | Cons                                                     |
| ----------------------- | -------------------------------------------------------- |
| No password to remember | Requires email delivery infrastructure (Resend/SendGrid) |
| No password reset flow  | Email delivery is unreliable (spam filters, delays)      |
| Simpler mental model    | Not familiar to all users — some expect password login   |

Magic links are considered for a future enhancement (M4+), but credentials + OAuth covers the M3 auth requirement without adding email delivery complexity.

---

## 3. Session Strategy

**Database sessions** (not JWT-only). Auth.js v5 with the Drizzle adapter stores sessions in the `sessions` table.

### Why database sessions over stateless JWT

| Criterion            | Database sessions                                              | Stateless JWT                                       |
| -------------------- | -------------------------------------------------------------- | --------------------------------------------------- |
| Immediate revocation | Delete session row → revoked instantly                         | Must wait for token expiry (or implement blocklist) |
| Session listing      | Query DB → user sees all active sessions                       | JWT is opaque — can't list sessions without a store |
| Session metadata     | Store IP, user-agent, last-active in session row               | JWT payload is limited (size, public)               |
| Performance          | One DB query per request (mitigated by session cookie caching) | Zero DB queries (fast)                              |
| Scalability          | Scales with Neon (serverless Postgres, connection pooling)     | Better at extreme scale (zero DB)                   |

**Decision:** Database sessions for revocability. The DB query cost is mitigated by Auth.js v5's session cookie strategy — it verifies the session cookie's signature first, and only queries the DB when the cookie is fresh or expired. This gives near-JWT performance with revocability.

---

## 4. Session Schema

```ts
// packages/db/src/schema/sessions.ts
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionToken: text("session_token").notNull().unique(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  // Audit fields
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});
```

### User schema

```ts
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  name: text("name"),
  image: text("image"), // Avatar URL (R2)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }), // Soft delete
});
```

### Account schema (OAuth)

```ts
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "oauth" or "email"
  provider: text("provider").notNull(), // "google", "github"
  providerAccountId: text("provider_account_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  // ...standard Auth.js account fields
});
```

---

## 5. Auth.js Configuration

```ts
// apps/web/src/lib/auth.config.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@nexus/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const validated = loginSchema.parse(credentials);
        const user = await authService.validateCredentials(validated);
        return user;
      },
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60 }, // 30 days
  pages: {
    signIn: "/login",
    signOut: "/login",
    error: "/login",
    verifyRequest: "/verify",
  },
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id;
      session.user.image = user.image;
      return session;
    },
  },
});
```

### Route Handler for Auth.js

```ts
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth.config";
export const { GET, POST } = handlers;
```

---

## 6. Password Security

### Hashing: bcrypt via `bcryptjs`

- **Work factor:** 12 (default). This gives ~200ms hash time on modern hardware, which is acceptable for login latency and provides strong resistance against offline brute-force.
- **Never log passwords.** Not even hashed passwords — a compromised hash table is a precomputation attack target.

### Password validation rules

| Rule                                                                | Why                                                                                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Minimum 8 characters                                                | Below 8 is trivially brute-forceable                                                                   |
| Maximum 128 characters                                              | Prevents DoS via long input; bcrypt has a 72-byte limit anyway                                         |
| No complexity rules (no "must contain uppercase + number + symbol") | NIST SP 800-63B recommends against forced complexity — it encourages predictable patterns (Password1!) |

### Why bcrypt over argon2

| Criterion     | bcrypt                                  | argon2                                              |
| ------------- | --------------------------------------- | --------------------------------------------------- |
| Compatibility | Pure JS (bcryptjs) — works in Edge/Node | Native addon — requires libargon2, may fail in Edge |
| Security      | Adequate for web auth                   | Superior (memory-hard)                              |
| Performance   | ~200ms hash (work factor 12)            | ~50ms hash (tuned)                                  |

Argon2 is better but adds a native dependency that complicates serverless deployment (Vercel Edge/Node may not support the addon). bcrypt is the pragmatic choice for a Vercel-deployed app.

---

## 7. Email Verification

### Flow

1. User signs up with email + password.
2. Server creates a verification token (UUID, stored in `verification_tokens` table with expiry).
3. Server sends verification email via Mailpit (dev) / Resend (production).
4. User clicks the link (`/verify/:token`).
5. Server validates token, marks `emailVerified` on the user, deletes the token.
6. User is redirected to the login page with a success message.

### Why email verification

Prevents account creation with someone else's email. Without verification, anyone can sign up as `victim@gmail.com` and receive password-reset emails intended for the victim. Verified emails are also required for watchlist and payment features.

### Verification token schema

```ts
export const verificationTokens = pgTable("verification_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

---

## 8. OAuth Flow

### Google OAuth

1. User clicks "Continue with Google" → Client Component calls `signIn("google")`.
2. Auth.js redirects to Google's consent screen.
3. Google redirects back to `/api/auth/callback/google` with an authorization code.
4. Auth.js exchanges the code for tokens (access + refresh + ID token).
5. Auth.js extracts user info (email, name, avatar) from the ID token.
6. If user exists → create session. If not → create user + account + session.
7. Redirect to `callbackUrl` or `/`.

### Account linking

If a user signs up with email `alice@gmail.com` and later signs in with Google using the same email, Auth.js automatically links the accounts. This is safe because Google's OIDC token guarantees email ownership.

### Why auto-link, not manual linking

Manual linking requires the user to remember they have an account and navigate to settings to link. Auto-link reduces friction. The risk (someone registers with a victim's email before the victim does) is mitigated by email verification — the victim can't activate the credential account without verifying email.

---

## 9. Authorization Model

### Role-based access control (RBAC)

| Role         | Permissions                                                        | Assigned to                               |
| ------------ | ------------------------------------------------------------------ | ----------------------------------------- |
| `user`       | Browse catalog, manage watchlist, update profile, stream video     | All authenticated users                   |
| `subscriber` | All `user` permissions + premium content, HD/UHD streaming         | Paid subscribers                          |
| `admin`      | All permissions + admin panel, user management, content management | Admin users (seeded, never self-assigned) |

### Role schema

```ts
export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(), // "user", "subscriber", "admin"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.roleId] }),
  }),
);
```

### Why RBAC over ABAC

Attribute-based access control (ABAC) evaluates permissions based on attributes (location, time, subscription status). This is more flexible but adds significant complexity. For our use case (three roles, simple permission checks), RBAC is proportional. If we need fine-grained content gating (e.g., "available in Japan only"), we add a content policy layer — not a full ABAC engine.

---

## 10. Middleware Auth Guard

Middleware checks the session cookie and redirects unauthenticated users.

```ts
// apps/web/src/lib/middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get("authjs.session-token");

  if (isAuthenticatedRoute(request.nextUrl.pathname) && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|dev|login|signup|verify|pricing|about|terms).*)"],
};
```

### Why middleware, not layout-level guard

Middleware runs before the page renders, avoiding a flash of unauthenticated content. A layout-level check renders the layout, checks auth, then redirects — the user sees the layout briefly. Middleware prevents the render entirely.

---

## 11. Session Lifecycle

| Event            | Action                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| Login            | Create session row in DB, set session cookie, set CSRF cookie                                  |
| Request          | Auth.js verifies cookie signature, checks DB session (if cookie is stale), updates last-active |
| Logout           | Delete session row from DB, clear cookies                                                      |
| Expiry           | Session row deleted by cron job (runs daily, deletes `expiresAt < now()`)                      |
| Password change  | Delete all sessions for the user (force re-login on all devices)                               |
| Account deletion | Delete user + cascade: sessions, accounts, watchlist, progress                                 |

### Session TTL

- **Default:** 30 days (configurable in Auth.js).
- **Activity-based extension:** Not implemented — 30-day absolute expiry is simpler and sufficient. Activity extension requires a DB write on every request, which is expensive.

---

## 12. Security Considerations

- **CSRF:** Auth.js v5 uses Double Submit Cookie pattern — verifies the CSRF token in the cookie matches the one in the request body. Built-in, no manual work.
- **Session fixation:** New session ID on login — old cookie is invalidated.
- **XSS → session theft:** Session cookie is `httpOnly` + `secure` + `sameSite=lax`. JavaScript cannot read it; it's only sent on same-site requests (or top-level navigations).
- **Brute-force protection:** Rate limiting on login endpoint (5 attempts / 5 minutes).
- **Password never stored in logs** — audit all logging paths.

---

## 13. Future Enhancements

| Enhancement                      | Milestone | Why                                     |
| -------------------------------- | --------- | --------------------------------------- |
| Two-factor authentication (TOTP) | M5+       | Required for payment account security   |
| Passkeys (WebAuthn)              | M6+       | Passwordless login; better UX on mobile |
| Session management UI            | M4        | "Sign out of all devices" in settings   |
| Impersonation (admin-as-user)    | M7        | Customer support tool                   |
