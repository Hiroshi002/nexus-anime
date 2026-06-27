# Authentication

> **Authoritative reference** for how Nexus Anime identifies users, issues sessions, validates credentials, and guards API surfaces. Read this document whenever you touch login, signup, logout, session validation, OAuth flows, RBAC checks, or security headers.
>
> Ownership: **Lead API Architect & Lead Backend Architect**. Last reviewed: 2026-06-26.

---

## Table of contents

1. [Purpose & scope](#1-purpose--scope)
2. [Auth.js v5 summary + Drizzle adapter](#2-authjs-v5-summary--drizzle-adapter)
3. [Providers](#3-providers)
4. [Session strategy](#4-session-strategy)
5. [Password policy](#5-password-policy)
6. [Email verification flow](#6-email-verification-flow)
7. [OAuth account linking](#7-oauth-account-linking)
8. [Session lifecycle](#8-session-lifecycle)
9. [CSRF protection](#9-csrf-protection)
10. [Role-based access control (RBAC)](#10-role-based-access-control-rbac)
11. [Role assignment](#11-role-assignment)
12. [users.role vs roles/user_roles reconciliation](#12-usersrole-vs-rolesuser_roles-reconciliation)
13. [API authentication methods](#13-api-authentication-methods)
14. [Middleware auth guard](#14-middleware-auth-guard)
15. [Error responses](#15-error-responses)
16. [Upcoming M5+ features](#16-upcoming-m5-features)
17. [Security hardening](#17-security-hardening)
18. [Token/session refresh behavior](#18-tokensession-refresh-behavior)
19. [Changelog](#19-changelog)

---

## 1. Purpose & scope

This document defines the **end-to-end authentication and authorization system** for Nexus Anime. It covers:

- **How users prove identity** — credential signup/login (email + password), Google OAuth, GitHub OAuth.
- **How sessions are issued, validated, refreshed, and destroyed** — Auth.js v5 with a Drizzle adapter, database-backed sessions, 30-day absolute expiry.
- **How roles gate access** — viewer / moderator / admin RBAC, enforced at the service layer and reflected in middleware.
- **How the system resists abuse** — bcrypt hashing, CSRF double-submit cookies, rate limiting, email verification, security headers.
- **How API surfaces authenticate** — session cookie for Server Actions, `Authorization: Bearer <session-token>` for Route Handlers.

It does **not** cover:

- Streaming signed URLs (Cloudflare Stream — see future `docs/08-video.md`).
- Payment/subscription gating (Stripe — see future `docs/09-billing.md`).
- TOTP, passkeys, or session management UI (earmarked for M5+).

**Related documents:**

| Concern                                                                            | Document                                                                       |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Identity schema (`users`, `user_accounts`, `user_sessions`, `verification_tokens`) | [`07-database/User.md`](../07-database/User.md)                                |
| Audit log (who changed whose role)                                                 | [`07-database/Audit-Log.md`](../07-database/Audit-Log.md)                      |
| API envelope, error codes                                                          | [`API-Standards.md`](./API-Standards.md), [`Error-Codes.md`](./Error-Codes.md) |
| Rate limiting (login/signup throttling)                                            | [`Rate-Limiting.md`](./Rate-Limiting.md)                                       |

---

## 2. Auth.js v5 summary + Drizzle adapter

We use **[Auth.js v5](https://authjs.dev/)** (NextAuth.js v5) as the authentication protocol layer. Auth.js owns:

- OAuth handoffs (redirect to Google/GitHub, handle callback, normalize profile).
- Credential flow (verify email + password against `user_accounts.password_hash`).
- Session issuance (generate session token, manage `session` table rows).
- CSRF token generation for sign-in flows.

We own:

- The **Drizzle adapter** that maps Auth.js' expected table shapes to our `users` / `user_accounts` / `user_sessions` tables (defined in `07-database/User.md`).
- The **authorization layer** (RBAC) — Auth.js handles authentication only; roles are application-enforced.
- The **UI** (signin, signup, verification pages) — built on top of Auth.js' client API.

**Why Auth.js v5 instead of rolling our own?**

| Consideration              | Roll our own                                 | Auth.js v5                               |
| -------------------------- | -------------------------------------------- | ---------------------------------------- |
| OAuth provider maintenance | We track Google/GitHub API changes ourselves | Library maintains provider configs       |
| Security bugs              | Our responsibility to audit                  | Widely reviewed, CVE-tracked             |
| Credential hashing         | We choose and implement                      | Pluggable (we use bcrypt)                |
| Session management         | We design token format, rotation, expiry     | Built-in, well-tested                    |
| Ecosystem                  | Custom                                       | Next.js-native, Drizzle adapter official |

**Why the Drizzle adapter instead of the Prisma adapter?**

Our access layer is Drizzle (`@nexus/db` — see `05-database/Database-Overview.md`). The Drizzle adapter is officially supported by Auth.js v5 and maps directly to our schema. Using Prisma would mean running two ORMs against the same database — a maintenance burden with no benefit.

**Adapter mapping:**

| Auth.js concept | Our table       | Notes                                                                                                                                                                |
| --------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`          | `users`         | Profile fields; `emailVerified` maps to `email_verified_at`.                                                                                                         |
| `Account`       | `user_accounts` | Provider + provider account id; credential rows carry `password_hash`.                                                                                               |
| `Session`       | `user_sessions` | We store `session_token_hash` (SHA-256 of the raw token). Auth.js' default adapter stores the raw token; we hash it so a table dump does not yield live credentials. |

**Configuration location:** `apps/web/src/lib/auth/auth.ts` (to be created in M3). The config object is the single source of truth for providers, callbacks, and session policy.

---

## 3. Providers

Nexus Anime supports three providers. Each provider row in `user_accounts` links to exactly one `users` row.

### 3.1 Credentials (email + password)

The default provider for users who sign up with email.

| Property    | Value                                                |
| ----------- | ---------------------------------------------------- |
| Provider id | `"credentials"`                                      |
| Identifier  | `email` (case-insensitive via `citext`)              |
| Secret      | `password_hash` (bcrypt, cost 12) in `user_accounts` |
| Flow        | `Credentials` provider with `authorize()` callback   |
| MFA         | Not in M3; earmarked for M5+ (TOTP)                  |

**Signup flow:**

1. Client submits `{ email, password, username }` via the signup Server Action.
2. Server validates with Zod (see §5 — password policy).
3. Server checks `users.email` uniqueness (partial unique index `WHERE deleted_at IS NULL`).
4. Server hashes password with bcrypt (cost 12).
5. Server inserts `users` row + `user_accounts` row (`provider = 'credentials'`, `password_hash = <hash>`).
6. Server creates a `verification_tokens` row and sends a verification email (see §6).
7. User is signed in but **not yet verified** — they see a "check your email" interstitial.

**Signin flow:**

1. Client submits `{ email, password }` via the signin Server Action.
2. Auth.js `authorize()` looks up `user_accounts` by `provider = 'credentials'` + `email`.
3. If no row → `UNAUTHORIZED` (deliberately vague; do not reveal "email not found" vs "wrong password").
4. If row found — `bcrypt.compare(password, password_hash)`.
5. If mismatch → `UNAUTHORIZED`.
6. If match but `users.email_verified_at IS NULL` → `EMAIL_NOT_VERIFIED` (403, code defined in M3).
7. If match and verified — Auth.js issues a session token, we persist `user_sessions` row, set cookie.

### 3.2 Google OAuth

| Property              | Value                                                                        |
| --------------------- | ---------------------------------------------------------------------------- |
| Provider id           | `"google"`                                                                   |
| Scopes                | `openid email profile`                                                       |
| Client id / secret    | From `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` env vars                    |
| Callback              | `/api/auth/callback/google`                                                  |
| Profile normalization | Use `sub` as `provider_account_id`; fall back to email only if `sub` missing |

**Profile handling:**

- Google accounts always have a verified email (Google verifies it on their side). We trust `email_verified: true` from Google and set `users.email_verified_at = now()` on first sign-in.
- If a user signs and later tries to sign up with credentials using the same email, the OAuth linking logic in §7 handles the merge.

### 3.3 GitHub OAuth

| Property              | Value                                                                            |
| --------------------- | -------------------------------------------------------------------------------- |
| Provider id           | `"github"`                                                                       |
| Scopes                | `read:user user:email`                                                           |
| Client id / secret    | From `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` env vars                        |
| Callback              | `/api/auth/callback/github`                                                      |
| Profile normalization | Use `id` as `provider_account_id`; fetch emails separately if primary is private |

**Profile handling:**

- GitHub does not always expose a verified primary email. We call `/user/emails` to find the primary verified email and use that as the identifier.
- If no verified email is available, the signup is rejected with `EMAIL_NOT_VERIFIED`.
- GitHub accounts with private emails must explicitly grant `user:email` scope; otherwise we cannot link them to an existing account.

### 3.4 Provider comparison

| Aspect                      | Credentials                        | Google                                               | GitHub                          |
| --------------------------- | ---------------------------------- | ---------------------------------------------------- | ------------------------------- |
| Email verification required | Yes (via §6)                       | No (Google verifies)                                 | Yes (must be publicly verified) |
| MFA possible                | Yes (M5+ TOTP)                     | Yes (Google's)                                       | Yes (GitHub's)                  |
| Linking behavior            | Auto-link if same email + verified | Auto-link                                            | Auto-link                       |
| Token storage               | `password_hash`                    | `access_token_encrypted` + `refresh_token_encrypted` | Same                            |
| Depends on                  | bcrypt                             | Google API                                           | GitHub API + `/user/emails`     |

---

## 4. Session strategy

### 4.1 Database sessions (not JWT-only)

We use **database-backed sessions** as the primary strategy. Auth.js issues an opaque session token (high-entropy, 32 bytes, URL-safe base64); we persist a SHA-256 hash of it in `user_sessions`.

**Why database sessions instead of stateless JWTs?**

| Consideration       | Stateless JWT                               | Database session                                  |
| ------------------- | ------------------------------------------- | ------------------------------------------------- |
| Revocation          | Requires a blocklist (effectively stateful) | `DELETE FROM user_sessions` — instant             |
| Session listing     | Not possible without a server-side store    | `SELECT * FROM user_sessions WHERE user_id = :me` |
| Token size          | Large (carries claims)                      | Tiny (opaque 32 bytes)                            |
| Rotation complexity | Custom implementation                       | Built into Auth.js                                |
| Leaked token impact | Attacker gets full claims                   | Attacker gets opaque id; DB lookup required       |

**Why not JWT + database hybrid?** Auth.js v5 supports JWT sessions as an option, but we do not need the extra complexity. Database sessions give us instant revocation and session listing — both are requirements for the M5+ session management UI. If we later need stateless validation for a high-traffic read API, we can add a short-lived JWT at that boundary without changing the primary session model.

### 4.2 `user_sessions` table schema

Defined in detail in `07-database/User.md` §4. Summary of the contract:

| Column               | Type                   | Purpose                                                   |
| -------------------- | ---------------------- | --------------------------------------------------------- |
| `id`                 | `uuid` PK              | Surrogate key                                             |
| `user_id`            | `uuid` FK → `users.id` | Owner                                                     |
| `session_token_hash` | `text` UNIQUE          | SHA-256 of the raw token. Raw token never touches the DB. |
| `expires_at`         | `timestamptz` NOT NULL | Absolute expiry (30 days from creation).                  |
| `ip_address`         | `inet` nullable        | Source IP at creation (anti-abuse).                       |
| `user_agent`         | `text` nullable        | Client UA at creation (display in session management UI). |
| `created_at`         | `timestamptz`          | —                                                         |
| `updated_at`         | `timestamptz`          | —                                                         |

**Indexes:**

| Index                                     | Purpose                                                    |
| ----------------------------------------- | ---------------------------------------------------------- |
| `idx_user_sessions_token_lookup` (UNIQUE) | Validate a session cookie on every request.                |
| `idx_user_sessions_user_id`               | List a user's active sessions (M5+ session management UI). |
| `idx_user_sessions_expires_at`            | Background purge job range-scans for expired sessions.     |

### 4.3 30-day absolute expiry

Sessions have a **single fixed expiry** — 30 days from issuance. There is no idle timeout in M3 (the session survives as long as it is within the 30-day window). The expiry is stored in `user_sessions.expires_at` and also encoded in the Auth.js session cookie.

**Why 30 days?**

- Streaming applications are long-session by nature. Users expect to stay signed in across days of browsing.
- 30 days bounds the window of a leaked cookie without requiring users to re-authenticate weekly.
- M5+ will add configurable "remember me" and shorter-lived sessions for sensitive actions.

**Why absolute, not sliding?**

- Sliding expiry complicates revocation: if a user changes their password, a sliding window could keep the old session alive for days.
- Absolute expiry makes reasoning about session lifetime simple: created at T, expires at T+30d, no extensions.
- M5+ will add step-up authentication for sensitive actions (password change, billing) regardless of session age.

### 4.4 Cookie name and attributes

| Property | Value                         | Why                                                                                                                     |
| -------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Name     | `__Host-authjs.session-token` | `__Host-` prefix enforces Path=/, Secure, no Domain attribute — cookie cannot be set by a subdomain.                    |
| Path     | `/`                           | Available to all routes.                                                                                                |
| Secure   | `true`                        | Only sent over HTTPS.                                                                                                   |
| HttpOnly | `true`                        | Not readable by JavaScript — mitigates XSS cookie theft.                                                                |
| SameSite | `lax`                         | Allows top-level navigation GET requests to carry the cookie; blocks cross-origin POST (CSRF covered separately in §9). |
| Max-Age  | `2592000` (30 days)           | Matches `expires_at`.                                                                                                   |

**Why `__Host-` prefix instead of a plain cookie name?**

The `__Host-` prefix is a browser-enforced contract: cookies with this prefix are rejected if they lack `Secure`, if they set `Domain`, or if `Path` is not `/`. It is defense-in-depth against cookie-tossing attacks on subdomains. Since we do not operate subdomains that serve user content, the restriction is safe.

---

## 5. Password policy

Applies only to the **credentials** provider. OAuth users do not have a password.

| Rule                    | Value                         | Why                                                                                                                                                                                               |
| ----------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Algorithm               | bcrypt                        | Resistant to GPU cracking; widely supported; built into Auth.js.                                                                                                                                  |
| Cost factor             | 12                            | ~250ms per hash on modern hardware. Balances user experience (login latency) with attacker cost. NIST SP 800-63B recommends work factor ≥ 10 for memorized secrets.                               |
| Minimum length          | 8 characters                  | NIST SP 800-63B minimum.                                                                                                                                                                          |
| Maximum length          | 128 characters                | Prevents DoS via extremely long passwords (bcrypt truncates at 72 bytes anyway, but we enforce 128 at the Zod layer to avoid ambiguity).                                                          |
| Complexity requirements | **None**                      | NIST SP 800-63B §5.1.1.2 explicitly recommends against forced complexity rules (uppercase, digit, symbol). Length is the primary entropy driver. Composition rules lead to `Password1!` patterns. |
| Breach database check   | Planned for M5+               | HaveIBeenPwned k-anonymity API. Not in M3 scope.                                                                                                                                                  |
| Hash storage            | `user_accounts.password_hash` | Separated from `users` table to limit blast radius of a `users` table leak.                                                                                                                       |

**Zod validation schema (reference):**

```ts
// apps/web/src/lib/auth/schemas.ts
import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters");

export const signupSchema = z.object({
  email: z.string().email().max(254),
  password: passwordSchema,
  username: z.string().regex(/^[a-z0-9_]{3,32}$/),
});
```

**Why no forced complexity?**

Forced rules (must include uppercase, digit, symbol) reduce the password space in practice because users satisfy them deterministically (`Password1!`). NIST's guidance — adopted by OWASP, NCSC, and others — is to require length and screen against known-banned passwords. We follow that guidance. The trade-off is that we rely more heavily on rate limiting and breach detection to compensate for low-entropy-but-long passwords.

---

## 6. Email verification flow

Email verification is **required before a credentials user can access the platform**. Unverified accounts can sign in but see a "verify your email" interstitial instead of the catalog.

### 6.1 `verification_tokens` table

| Column       | Type                   | Purpose                                                                       |
| ------------ | ---------------------- | ----------------------------------------------------------------------------- |
| `id`         | `uuid` PK              | Surrogate key.                                                                |
| `user_id`    | `uuid` FK → `users.id` | Owner.                                                                        |
| `token_hash` | `text` UNIQUE          | SHA-256 of the raw token (same pattern as sessions — raw token never stored). |
| `expires_at` | `timestamptz` NOT NULL | Token valid for 24 hours.                                                     |
| `created_at` | `timestamptz`          | —                                                                             |

### 6.2 Flow

1. **Signup** — after inserting the user, we insert a `verification_tokens` row with a 32-byte random token (URL-safe base64) and send an email containing `https://nexus-anime.vercel.app/auth/verify?token=<raw>`.
2. **Resend** — a "resend verification email" button creates a new token (invalidating the old one) and re-sends. Rate-limited to 3 per hour per user (see `Rate-Limiting.md`).
3. **Verify** — `GET /auth/verify?token=<raw>` hashes the token, looks up the row, checks `expires_at > now()`, sets `users.email_verified_at = now()`, deletes the token row, and redirects to the home page.
4. **Expiry** — if the token is expired, the user is offered to resend. Expired tokens are purged by the same background job that purges expired sessions.

### 6.3 Why SHA-256 the token?

The raw token travels in the URL (email links). If the `verification_tokens` table is leaked, an attacker could verify any user's email by looking up the raw token. Hashing the token (same pattern as session tokens) means a table leak does not yield usable verification links.

---

## 7. OAuth account linking

When a user signs in with Google or GitHub, we attempt to **auto-link** the OAuth identity to an existing account with the same email address.

### 7.1 Auto-link conditions

Auto-linking happens **only when all three conditions are met**:

1. The OAuth provider reports a **verified** email.
2. A `users` row exists with that email (`users.email = <oauth_email>`).
3. The existing user's `email_verified_at IS NOT NULL`.

If any condition fails, a **new account is created** (not linked).

### 7.2 Why auto-link?

Without auto-linking, a user who signed up with credentials and then returns via Google ends up with two accounts — a confusing experience that fragments their watch history and bookmarks. Auto-linking prevents this.

### 7.3 Why require verified email?

Auto-linking without email verification would let an attacker create a Google account with `victim@example.com` (if the victim has not verified their email with Google) and merge into the victim's Nexus account. Requiring verified email on both sides prevents this.

### 7.4 Manual linking (M5+)

M5+ will add a "link account" flow in settings that lets a user connect additional providers to an existing account. This is a deliberate user-initiated action (not automatic) and requires re-authentication with the new provider.

---

## 8. Session lifecycle

### 8.1 Login

```
Client → POST /api/auth/callback/credentials { email, password }
  → Auth.js authorize() verifies credentials
  → Auth.js onSession() callback inserts user_sessions row
  → Set-Cookie: __Host-authjs.session-token=<token>; ...
  → Redirect to /
```

- A `user_sessions` row is created with `session_token_hash = SHA-256(token)`, `expires_at = now() + 30d`, `ip_address`, `user_agent`.
- `users.last_login_at` and `users.last_login_ip` are updated.
- An `audit_log` row is written with `action = 'user.login'`.

### 8.2 Request validation

```
Client → GET /api/v1/watchlist (Cookie: __Host-authjs.session-token=<token>)
  → middleware.ts reads cookie
  → SHA-256(token) → lookup user_sessions by session_token_hash
  → if not found → 401 UNAUTHORIZED
  → if expires_at < now() → 401 UNAUTHORIZED (TOKEN_EXPIRED in M3+)
  → if valid → attach session to request context
  → route handler executes
```

**Stale cache mitigation:** Auth.js also maintains its own session cache. If the database session is deleted (e.g. password change), the next request fails the DB lookup even if Auth.js' cache still considers the session valid. This is the desired behavior — revocation is immediate.

### 8.3 Logout

```
Client → POST /api/auth/signout
  → Auth.js signOut() callback deletes user_sessions row
  → Set-Cookie: __Host-authjs.session-token=; Max-Age=0; ...
  → Redirect to /
```

- The session row is hard-deleted (no soft-delete on sessions — they are ephemeral).
- The cookie is cleared by setting `Max-Age=0`.
- An `audit_log` row is written with `action = 'user.logout'`.

### 8.4 Password change

When a user changes their password (via settings or forgot-password flow):

1. The new password is hashed (bcrypt cost 12).
2. `user_accounts.password_hash` is updated.
3. **All `user_sessions` rows for the user are deleted** — this forces re-login on all devices.
4. A new session is created for the current request (so the user stays signed in on the device that initiated the change).
5. An `audit_log` row is written with `action = 'user.password_change'`.

**Why delete all sessions on password change?**

If an attacker has stolen a session cookie, password change is the user's primary defense. Deleting all sessions ensures the attacker's cookie is invalidated immediately. The current device gets a fresh session so the user is not disrupted.

### 8.5 Forgot password

1. User submits email on `/auth/forgot`.
2. A `verification_tokens` row is created (same table as email verification, 1-hour expiry).
3. Email with reset link is sent.
4. User clicks link → `/auth/reset?token=<raw>` → sets a short-lived "reset allowed" flag in Redis (15 min).
5. User submits new password → password is updated, all sessions deleted (see §8.4).

---

## 9. CSRF protection

Auth.js v5 includes built-in CSRF protection via the **double-submit cookie pattern**:

1. On sign-in, Auth.js generates a CSRF token and sets it in a cookie (`__Host-authjs.csrf-token`).
2. The same token is embedded in the sign-in form as a hidden field.
3. On form submission, Auth.js verifies that the cookie token matches the body token.
4. Mismatch → request is rejected.

**Why double-submit cookie?**

- Stateless: no server-side storage required.
- The attacker's cross-site request reads the cookie (sent automatically) but cannot read the body token (same-origin policy prevents reading the response that contains it).
- The `__Host-` prefix on the CSRF cookie provides the same cookie-tossing protection as the session cookie.

**Additional CSRF measures:**

- `SameSite=lax` on the session cookie blocks cross-origin POST requests at the browser level.
- State-changing API endpoints (POST/PUT/DELETE) require the `Authorization: Bearer <session-token>` header (see §13), which cross-origin requests cannot send without a CORS preflight that we do not allow for these endpoints.

---

## 10. Role-based access control (RBAC)

Nexus Anime uses a **three-tier role system**. Roles are application-enforced (not Postgres RLS — see `07-database/Database-Overview.md` §8).

### 10.1 Roles

| Role        | Meaning                                                                                             | Granted by          |
| ----------- | --------------------------------------------------------------------------------------------------- | ------------------- |
| `viewer`    | Default consumer. Can browse, watch, bookmark, comment, rate.                                       | Signup.             |
| `moderator` | Can hide/delete comments, mute users, view reported content.                                        | Admin action.       |
| `admin`     | Full platform management. User management, role assignment, audit log access, system configuration. | Admin action + MFA. |

### 10.2 Permissions matrix

| Permission               | viewer | moderator |   admin   |
| ------------------------ | :----: | :-------: | :-------: |
| Browse catalog           |  yes   |    yes    |    yes    |
| Watch video (own region) |  yes   |    yes    |    yes    |
| Add bookmark             |  yes   |    yes    |    yes    |
| Post comment             |  yes   |    yes    |    yes    |
| Edit own comment         |  yes   |    yes    |    yes    |
| Delete own comment       |  yes   |    yes    |    yes    |
| Rate anime/episode       |  yes   |    yes    |    yes    |
| Hide any comment         |   no   |    yes    |    yes    |
| Delete any comment       |   no   |    yes    |    yes    |
| Mute user (comments)     |   no   |    yes    |    yes    |
| View reported content    |   no   |    yes    |    yes    |
| View audit log           |   no   |    no     |    yes    |
| Change user roles        |   no   |    no     |    yes    |
| Administer users         |   no   |    no     |    yes    |
| Access billing settings  |   no   |    no     |    yes    |
| Impersonate user         |   no   |    no     | yes (M5+) |

### 10.3 Enforcement points

- **Server Actions** — `requireRole("moderator")` helper checks `session.user.role` before executing.
- **Route Handlers** — same helper, or inline check for performance-critical paths.
- **Middleware** — redirects unauthenticated users (see §14); does **not** enforce role (role is route-specific, not global).
- **UI** — conditionally render admin/moderator controls based on `useSession().data?.user?.role`. UI hiding is not security; it is UX. The server enforces.

```ts
// apps/web/src/lib/auth/session.ts
import { auth } from "@/lib/auth/auth";

export async function requireRole(minimumRole: "viewer" | "moderator" | "admin") {
  const session = await auth();
  if (!session?.user) throw new ApiError("UNAUTHORIZED", {});

  const roleHierarchy = { viewer: 0, moderator: 1, admin: 2 };
  if (roleHierarchy[session.user.role] < roleHierarchy[minimumRole]) {
    throw new ApiError("FORBIDDEN", { required: minimumRole });
  }
  return session;
}
```

---

## 11. Role assignment

### 11.1 Admin role is seeded

The initial admin user is created by `tooling/scripts/seed-admin.ts` (see existing stub). This script:

1. Creates a `users` row with `role = 'admin'`.
2. Links a `user_accounts` row for credentials or OAuth.
3. Is idempotent — running it multiple times does not create duplicates.

### 11.2 Roles are never self-assigned

A user **cannot** promote themselves. The role-change flow:

1. An existing admin navigates to the user management UI.
2. The admin selects a new role for a target user.
3. The Server Action receives the request, calls `requireRole("admin")`, updates `users.role`, writes an `audit_log` row with `action = 'user.role_change'`, `actor_id = <admin user_id>`, `before = <old role>`, `after = <new role>`.

**Why is this a hard rule?**

Self-assignment is the single most common privilege escalation vector. By requiring an existing admin to perform the change, we ensure:

- Two humans are involved (the admin and the target user who requested it).
- The audit log captures the admin's identity.
- An attacker who compromises a moderator account cannot escalate to admin without also compromising an admin account.

### 11.3 Admin + MFA

In, admin role assignment does not require MFA (there is no MFA yet). In **M5+**, the following additional rules apply:

- An admin **must** have TOTP enabled to perform role changes.
- An admin **cannot** demote themselves without another admin approving (prevents accidental lockout).
- The first admin (seeded) is exempt from the "another admin" rule to prevent a chicken-and-egg scenario.

---

## 12. `users.role` vs `roles`/`user_roles` reconciliation

### 12.1 The schema has both

The `users` table has a `role text NOT NULL DEFAULT 'viewer'` column (denormalized fast-path). The `07-database` design does **not** include a separate `roles` or `user_roles` table in M3 — roles are a closed set (`viewer` / `moderator` / `admin`) and a user has exactly one role.

### 12.2 Which is authoritative?

**`users.role` is the authoritative source of truth in M3.**

There is no `roles` lookup table or `user_roles` join table in the M3 schema. The `users.role` column is:

- Updated by the role-change Server Action.
- Read by `requireRole()` for authorization decisions.
- Checked by the `chk_users_role_range` constraint (`role IN ('viewer', 'moderator', 'admin')`).

### 12.3 Why denormalize?

| Consideration | Normalized (`roles` + `user_roles`) | Denormalized (`users.role`) |
| ------------- | ----------------------------------- | --------------------------- |
| Role changes  | UPDATE `user_roles` row             | UPDATE `users` row          |
| Role lookup   | JOIN required                       | Direct column read          |
| Flexibility   | Unlimited roles                     | Fixed set                   |
| Audit         | Same (audit_log captures change)    | Same                        |

For a three-role closed set, normalization adds JOINs for no benefit. The role is read on every authenticated request; a direct column read is faster and simpler.

### 12.4 Future reconciliation (M5+)

If M5+ introduces custom roles (e.g. `editor`, `translator`, `vip`), we will:

1. Create a `roles` table (`id`, `name`, `permissions jsonb`).
2. Create a `user_roles` join table (`user_id`, `role_id`).
3. Keep `users.role` as a **cached fast-path** — the application writes to both `user_roles` and `users.role` in a single transaction.
4. A background reconciliation job detects and repairs drift between `user_roles` and `users.role`.
5. Authorization reads `users.role` for performance; the reconciliation job ensures consistency.

**Why keep the denormalized column?**

Even with a normalized join table, the hot path (every authenticated request) benefits from a direct column read. The denormalized column is a cache; `user_roles` is the source of truth. The reconciliation job repairs drift within 60 seconds. This is the same pattern used by large-scale systems (e.g. Discord's role caching).

---

## 13. API authentication methods

Nexus Anime presents three API surfaces. Each authenticates differently.

### 13.1 Session cookie (Server Actions)

| Property   | Value                                                                             |
| ---------- | --------------------------------------------------------------------------------- |
| Mechanism  | `Cookie: __Host-authjs.session-token=<token>`                                     |
| Used by    | Server Actions invoked from the React tree                                        |
| Validation | `await auth()` reads the cookie, looks up `user_sessions` by `session_token_hash` |
| Helper     | `requireUser()` / `requireRole()` in `apps/web/src/lib/auth/session.ts`           |

Server Actions do not need to manually validate the cookie — Auth.js' `auth()` function does it for them. The helper functions add role checks on top.

### 13.2 Bearer token (Route Handlers)

| Property   | Value                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------- |
| Mechanism  | `Authorization: Bearer <session-token>`                                                            |
| Used by    | Route Handlers (`/api/v1/*`) called by mobile apps, third-party consumers, or cross-origin clients |
| Validation | Middleware extracts the header, SHA-256s the token, looks up `user_sessions`                       |
| Helper     | `requireApiSession()` in middleware                                                                |

**Why Bearer for Route Handlers?**

- Cookies are subject to SameSite and CORS restrictions that complicate mobile and third-party access.
- Bearer tokens are the standard for REST every HTTP client supports them.
- The token is the **same session token** that would be in the cookie — there is no separate API token system in M3.

### 13.3 mTLS + service token (Server-to-server)

| Property   | Value                                                              |
| ---------- | ------------------------------------------------------------------ |
| Mechanism  | mTLS client certificate + `X-Service-Token` header                 |
| Used by    | Internal workers, cron jobs, sidecars                              |
| Validation | Service mesh validates mTLS; service token validated by middleware |

Server-to-server calls do not carry user identity. They are authenticated as services, not users. See `API-Overview.md` §3.3.

### 13.4 Method comparison

| Method               | Caller                | Token source                           | Validation     |
| -------------------- | --------------------- | -------------------------------------- | -------------- |
| Session cookie       | Browser (same-origin) | `__Host-authjs.session-token` cookie   | `await auth()` |
| Bearer header        | Mobile / third-party  | `Authorization: Bearer <token>`        | Middleware     |
| mTLS + service token | Internal worker       | `X-Service-Token` header + client cert | Service mesh   |

---

## 14. Middleware auth guard

`apps/web/src/middleware.ts` runs on every request that matches the middleware matcher. It is the **first line of defense** for every page and API route.

### 14.1 Redirect behavior

| Condition                                                | Action                                                                                 |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| No session cookie + path matches protected routes        | Redirect to `/auth/signin?returnTo=<current-url>`                                      |
| Session cookie present but expired (`expires_at < now()` | Redirect to `/auth/signin?reason=expired`                                              |
| Session cookie present and valid                         | Pass through                                                                           |
| Path is public (signin, signup, verify, static assets)   | Pass through (no redirect)                                                             |
| Path is an API route (`/api/v1/*`)                       | Do not redirect; return 401 JSON instead clients cannot follow redirects meaningfully) |

### 14.2 Matcher

```ts
// middleware.ts
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public/
     * - auth/* (signin, signup, verify, callback routes)
     */
    "/((?!_next/static|_next/image|favicon.ico|public|auth/).*)",
  ],
};
```

**Why exclude `auth/*`?** The signin/signup pages must be accessible without a session. Including them in the matcher would cause redirect loops.

### 14.3 Security headers applied

Every response that passes through middleware carries these headers:

| Header                      | Value                                          | Why                                  |
| --------------------------- | ---------------------------------------------- | ------------------------------------ |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | HSTS — forces HTTPS for 2 years.     |
| `X-Content-Type-Options`    | `nosniff`                                      | Prevents MIME-type sniffing.         |
| `X-Frame-Options`           | `DENY`                                         | Prevents clickjacking.               |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`              | Limits referrer leakage.             |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=()`     | Disables sensitive browser features. |
| `Content-Security-Policy`   | See §14.4                                      | Mitigates XSS.                       |

### 14.4 Content Security Policy

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{random}' 'strict-dynamic';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: image.tmdb.org *.cloudflarestream.com;
  font-src 'self';
  connect-src 'self' api.github.com accounts.google.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```

**Why `'unsafe-inline'` for styles?** Tailwind CSS 4 and some UI libraries inject inline styles. We mitigate script injection via `'nonce-{random}'` — every inline server-rendered script gets a unique nonce, and only scripts with the nonce execute. This is stricter than `'unsafe-inline'` for scripts while remaining practical for styles.

### 14.5 Geo headers

Middleware adds a `x-geo-country` header (derived from `request.geo?.country` or Cloudflare's `cf-ipcountry` edge header) so the application can enforce regional content restrictions. Geo data is **not** used for authentication — only for content gating (future M4+).

---

## 15. Error responses

Authentication and authorization failures return typed error envelopes. The full error code registry is in `Error-Codes.md`; the auth-relevant subset is below.

### 15.1 401 Unauthorized — no session

Returned when the request has no valid session cookie or bearer token.

```json
{
  "error": {
    "message": "You must be signed in to do that.",
    "code": "UNAUTHORIZED",
    "details": {}
  },
  "meta": { "requestId": "req_abc123" }
}
```

HTTP: `401`

**When returned:**

- Server Action called without a session cookie.
- Route Handler called without `Authorization: Bearer` header.
- Session token does not match any `user_sessions.session_token_hash`.
- Session is expired (`expires_at < now()`).

**Client handling:** Redirect to `/auth/signin?returnTo=<current-url>` (browser) or surface the error to the API consumer (mobile).

### 15.2 403 Forbidden — insufficient role

Returned when the user is authenticated but lacks the required role.

```json
{
  "error": {
    "message": "You don't have permission to do that.",
    "code": "FORBIDDEN",
    "details": { "required": "admin" }
  },
  "meta": { "requestId": "req_def456" }
}
```

HTTP: `403`

**When returned:**

- A `viewer` attempts to access a moderator-only endpoint.
- A `moderator` attempts to access an admin-only endpoint.
- A credentials user attempts to access any endpoint before email verification (code `EMAIL_NOT_VERIFIED` in M3+).

**Client handling:** Show a "you don't have permission" message. Do not reveal what resource exists (avoid leaking IDs).

### 15.3 402 Payment Required — subscriber-only

Returned when the user's subscription state blocks the action. This is a **future M4+ code**; included here for completeness.

```json
{
  "error": {
    "message": "This content requires an active subscription.",
    "code": "PAYMENT_REQUIRED",
    "details": { "plan": "premium" }
  },
  "meta": { "requestId": "req_ghi789" }
}
```

HTTP: `402`

**When returned (M4+):**

- User attempts to watch premium content on a lapsed plan.
- User attempts to access HD/4K streaming on a basic plan.

**Client handling:** Redirect to `/billing/upgrade`.

### 15.4 Error-to-action mapping

| Code                 | HTTP | Client action                                |
| -------------------- | ---- | -------------------------------------------- |
| `UNAUTHORIZED`       | 401  | Redirect to signin                           |
| `FORBIDDEN`          | 403  | Show "no permission" message                 |
| `PAYMENT_REQUIRED`   | 402  | Redirect to billing upgrade                  |
| `EMAIL_NOT_VERIFIED` | 403  | Show "verify your email" interstitial        |
| `ACCOUNT_LOCKED`     | 403  | Show "account locked, contact support" (M3+) |
| `MFA_REQUIRED`       | 403  | Show MFA challenge (M5+)                     |

---

## 16. Upcoming M5+ features

These features are **not in scope for M3** but are designed for in the auth architecture. They are documented here so M3 decisions do not box them out.

| Feature                           | Description                                                                                                                            | M3 impact                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **TOTP 2FA**                      | Time-based one-time passwords (RFC 6238). Stored encrypted in `user_accounts.totp_secret_encrypted`. Required for admin role.          | `user_accounts` schema reserves a nullable column.                           |
| **Passkeys (WebAuthn)**           | FIDO2/WebAuthn for passwordless signin. Stored in a new `user_credentials` table alongside credential rows.                            | Schema designed to accommodate additional credential types.                  |
| **Session management UI**         | Users can view and revoke active sessions. Admins can revoke any user's sessions.                                                      | `user_sessions` table has `user_agent` and `ip_address` columns for display. |
| **Admin impersonation**           | Admins can sign in as another user for support. Logged in `audit_log`. The impersonated session is flagged (`is_impersonated = true`). | `user_sessions` schema reserves an `is_impersonated` column.                 |
| **HaveIBeenPwned check**          | On signup and password change, reject passwords found in breach databases.                                                             | No schema impact; external API call.                                         |
| **Configurable session lifetime** | "Remember me" extends to 90 days; default remains 30 days. Sensitive actions require step-up.                                          | `user_sessions.expires_at` already supports variable values.                 |
| **Custom roles**                  | M5+ may introduce `editor`, `translator`, etc. See §12.4 for the reconciliation plan.                                                  | `users.role` remains the fast-path; `roles` + `user_roles` tables added.     |

---

## 17. Security hardening

The following measures are **implemented in M3** unless noted.

| #   | Measure                                                               | Status | Why                                                       |
| --- | --------------------------------------------------------------------- | ------ | --------------------------------------------------------- |
| 1   | bcrypt cost 12                                                        | M3     | Resists GPU cracking; ~250ms per hash.                    |
| 2   | Session tokens hashed in DB (SHA-256)                                 | M3     | Table dump does not yield live tokens.                    |
| 3   | Verification tokens hashed in DB (SHA-256)                            | M3     | Table dump does not yield live verification links.        |
| 4   | `__Host-` cookie prefix                                               | M3     | Enforces Secure, Path=/, no Domain.                       |
| 5   | `HttpOnly` session cookie                                             | M3     | Not readable by JavaScript — mitigates XSS.               |
| 6   | `SameSite=lax` session cookie                                         | M3     | Blocks cross-origin POST (CSRF).                          |
| 7   | CSRF double-submit cookie (Auth.js built-in)                          | M3     | Defense-in-depth against CSRF.                            |
| 8   | Rate-limited login/signup (Redis)                                     | M3     | Thwarts credential stuffing. See `Rate-Limiting.md`.      |
| 9   | Email verification required before access                             | M3     | Prevents account creation with typos / throwaway emails.  |
| 10  | OAuth auto-link requires verified email                               | M3     | Prevents account merging attacks.                         |
| 11  | All sessions deleted on password change                               | M3     | Forces re-login on all devices.                           |
| 12  | Roles never self-assigned                                             | M3     | Prevents privilege escalation.                            |
| 13  | Audit log captures every role change                                  | M3     | Accountability.                                           |
| 14  | Security headers (HSTS, CSP, X-Frame-Options, etc.)                   | M3     | Defense-in-depth.                                         |
| 15  | `citext` for email/username                                           | M3     | Prevents case-squatting (`Alice@x.com` vs `alice@x.com`). |
| 16  | No `any` in auth code                                                 | M3     | TypeScript strict mode — auth code must be fully typed.   |
| 17  | Secrets in env vars / Vault, never in code                            | M3     | Prevents credential leakage via source control.           |
| 18  | Zod validation on all auth inputs                                     | M3     | Reject malformed input at the boundary.                   |
| 19  | Error messages are vague ("invalid credentials")                      | M3     | Do not reveal whether email exists.                       |
| 20  | TLS 1.2+ enforced at edge                                             | M3     | Prevents downgrade attacks.                               |
| 21  | CSP with nonce for inline scripts                                     | M3     | Mitigates XSS even if an attacker can inject HTML.        |
| 22  | `Permissions-Policy` disables camera/mic/geo                          | M3     | Reduces attack surface for browser-based exploits.        |
| 23  | Background purge of expired sessions                                  | M3     | Prevents unbounded table growth.                          |
| 24  | Partial unique indexes on email/username (`WHERE deleted_at IS NULL`) | M3     | Allows re-registration after soft-delete.                 |
| 25  | HaveIBeenPwned password check                                         | M5+    | Reject known-breached passwords.                          |
| 26  | TOTP 2FA                                                              | M5+    | Protects against credential theft.                        |
| 27  | Passkeys (WebAuthn)                                                   | M5+    | Phishing-resistant authentication.                        |
| 28  | Geo-gating enforcement                                                | M4+    | Regional content licensing compliance.                    |

---

## 18. Token/session refresh behavior

### 18.1 Cookie renewal strategy

Sessions have a **fixed 30-day absolute expiry** — there is no automatic renewal in M3. The cookie `Max-Age` matches `user_sessions.expires_at`. Once the 30 days elapse, the user must re-authenticate.

**Why no sliding renewal?**

- Sliding renewal complicates revocation. If a session is extended on every use, a stolen cookie remains valid for up to 30 days of inactivity — defeating the purpose of revocation.
- Absolute expiry is simple to reason about: created at T, expires at T+30d, no exceptions.
- M5+ will add a "remember me" option that extends to 90 days, but still absolute (not sliding).

### 18.2 Auth.js token rotation

Auth.js v5 supports **session token rotation** — on each validation, the old token is invalidated and a new token is issued. We **enable rotation** in M3 with a 24-hour rotation window:

- If the session is older than 24 hours, Auth.js issues a new session token and invalidates the old one.
- The old `user_sessions` row is deleted; a new row is inserted with the new token hash and a fresh `expires_at = now() + 30d`.
- The cookie is updated with the new token.

**Why rotate?**

- Limits the window of a stolen cookie. If a cookie is exfiltrated, the attacker has at most 24 hours before the legitimate user's next request rotates the token and invalidates the attacker's copy.
- The 24-hour window balances security with session stability — frequent rotation causes too many DB writes; infrequent rotation extends the theft window.

### 18.3 Refresh flow

```
Request arrives with session cookie (token A)
  → Auth.js validates token A against user_sessions
  → If session age < 24h: pass through, no rotation
  → If session age >= 24h:
    → Generate new token B
    → In transaction:
        INSERT user_sessions (token_hash = SHA256(B), expires_at = now() + 30d)
        DELETE user_sessions WHERE token_hash = SHA256(A)
    → Set-Cookie: __Host-authjs.session-token=B
    → Continue request
```

**Why a transaction?** If the INSERT succeeds but the DELETE fails, the user has two valid tokens — the old one and the new one. The transaction ensures atomicity: either both happen or neither does.

### 18.4 Concurrent request handling

If two requests arrive simultaneously with the same session token and both trigger rotation:

- The first request completes the rotation (inserts B, deletes A).
- The second request fails to find token A (already deleted) — it returns `UNAUTHORIZED`.
- The client re-authenticates or retries with token B (if it received the new cookie).

This is acceptable — the user's next request will succeed with token B. The alternative (locking the session row during rotation) introduces contention and complexity for a rare race.

### 18.5 M5+ refresh tokens

M5+ will introduce opaque refresh tokens for long-lived sessions:

- The session token remains short-lived (24h).
- A separate refresh token (stored hashed in `user_sessions.refresh_token_hash`) is used to rotate the session token without re-authentication.
- Refresh tokens are single-use — each rotation invalidates the old refresh token and issues a new one.
- Refresh token theft is detected by monitoring for reuse of an already-consumed token (indicates theft; all user sessions are revoked).

---

## 19. Changelog

| Date       | Change                      | Ticket / PR |
| ---------- | --------------------------- | ----------- |
| 2026-06-26 | Initial authentication spec | —           |
|            |                             |             |
|            |                             |             |

> Each entry is added when the auth contract changes — not on every bugfix. Backfill in the same PR that changes an auth behavior.

---

## 20. License & ownership

This specification is under the same license as the Nexus Anime repository. Auth contract changes require review from the **Lead API Architect**, the **Lead Backend Architect**, and two approving engineers. All trademarks and brand assets referenced remain property of their respective owners — this document is an engineering contract, not a license for redistribution.
