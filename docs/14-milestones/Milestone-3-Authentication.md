# M3 — Authentication

## Objective

Implement complete authentication for Nexus Anime using Auth.js v5, covering credential-based login (email + password), OAuth integration (Google and GitHub), session management with database-backed sessions, email verification, password reset, CSRF protection, middleware-based auth guards, and RBAC with three roles (viewer, moderator, admin). At the end of M3, users can sign up, log in via credentials or OAuth, verify their email, reset their password, and access protected routes with proper authorization enforcement.

## Scope

- Auth.js v5 configuration with Drizzle adapter, all providers, callbacks, and custom pages
- Credential provider: bcrypt-hashed passwords (cost factor 12), Zod-validated input, NIST SP 800-63B aligned password policy (8–128 chars, no complexity rules)
- OAuth providers: Google (recommended), GitHub (optional), auto-linking on verified email
- Session strategy: database sessions (not JWT), 30-day absolute expiry, 24-hour rotation window, SHA-256 hashed session tokens
- Session schema: `users`, `user_accounts`, `user_sessions`, `verification_tokens`, `user_roles`, `roles`, `auth_events`
- Email verification flow: SHA-256 hashed tokens, 24-hour expiry, resend capability
- Password reset flow: secure token-based reset via email
- CSRF protection: double-submit cookie pattern via Auth.js
- Rate limiting on auth routes: stricter limits on login/signup/reset endpoints
- Middleware auth guard: redirect unauthenticated users, allow public routes, apply security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy, X-Content-Type-Options, Permissions-Policy)
- Auth pages: login, signup, verify-email, forgot-password, error
- RBAC: 3-tier roles (viewer, moderator, admin), `requireRole()` helper, seeded admin user
- Security hardening: 25 measures including no password logging, safe error messages, httpOnly cookies

Out of scope: TOTP/MFA (M5+), passkeys (M5+), session management UI (M5+), impersonation (M5+), RBAC admin panel (M4+), OAuth account linking UI (M4+).

## Deliverables

### D1 — Auth.js Configuration

`apps/web/src/lib/auth/config.ts` — Auth.js v5 configuration with:
- Drizzle adapter (`@auth/drizzle-adapter`) mapped to the `users`, `user_accounts`, `user_sessions` tables
- Providers: Credentials (with bcrypt verification), Google (with profile normalization), GitHub (with profile normalization)
- Callbacks: `signIn` (auto-link OAuth accounts with verified email), `session` (attach role to session), `jwt` (no-op since using database sessions)
- Pages: custom login, signup, verify-email, forgot-password, error pages
- Events: `signIn`, `signOut`, `createUser`, `linkAccount` — logged to `auth_events` table

### D2 — Database Schema for Auth

`packages/db/src/schema/auth.ts` — Drizzle schema definitions for:
- `users` — id, name, email, emailVerified, image, role (denormalized, authoritative in M3), createdAt, updatedAt
- `user_accounts` — id, userId, provider, providerAccountId, refreshToken, accessToken, expiresAt, tokenType, scope, idToken, sessionState
- `user_sessions` — id, userId, sessionToken (SHA-256 hashed), expires, userAgent, ip
- `verification_tokens` — id, identifier, token (SHA-256 hashed), expires
- `roles` — id, name (viewer, moderator, admin), description
- `user_roles` — id, userId, roleId
- `auth_events` — id, userId, type, createdAt, ip, userAgent, metadata

Migration applied to the Neon database.

### D3 — Credential Provider

`apps/web/src/lib/auth/credentials.ts` — credential provider logic:
- Password verified with bcrypt (cost factor 12)
- Zod validation: email (valid email format), password (8–128 chars, no complexity rules per NIST)
- Safe error messages: "Invalid email or password" (no indication of which field is wrong)
- Rate limiting integrated (via `@nexus/cache` rate limiter)

### D4 — OAuth Providers

`apps/web/src/lib/auth/oauth.ts` — OAuth provider configuration:
- Google: OAuth 2.0 with profile normalization (name, email, image), email verified flag check
- GitHub: OAuth 2.0 with profile normalization, email verified flag check (GitHub does not always verify email — handle gracefully)
- Auto-link: if a user signs in with OAuth and an existing account has the same verified email, link the accounts automatically

### D5 — Session Management

`apps/web/src/lib/auth/session.ts` — session helpers:
- `getSession()` — read session from the database, validate expiry, return user with role
- `requireSession()` — throw `ApiError(UNAUTHORIZED)` if no valid session
- `requireRole(role)` — throw `ApiError(FORBIDDEN)` if user lacks the required role
- Session cookie: `__Host-authjs.session-token` with `httpOnly`, `secure`, `sameSite: lax`, `path: /`

### D6 — Email Verification

`apps/web/src/lib/auth/verify-email.ts` — verification flow:
- Generate SHA-256 token, store in `verification_tokens` with 24-hour expiry
- Send verification email (via Mailpit in dev; email provider in production — deferred to M5+)
- Verify endpoint: `GET /api/auth/verify?token=<token>` — marks `emailVerified` on user, deletes token
- Resend: authenticated users can request a new verification email (rate-limited)

### D7 — Password Reset

`apps/web/src/lib/auth/reset-password.ts` — reset flow:
- Request: `POST /api/auth/forgot-password` — generate SHA-256 token, send email (Mailpit in dev)
- Reset: `POST /api/auth/reset-password` — verify token, hash new password, update user, invalidate all sessions
- Token: SHA-256 hashed, 1-hour expiry, single-use

### D8 — Auth Pages

- `apps/web/app/(auth)/login/page.tsx` — login form with email/password, OAuth buttons (Google, GitHub), "Forgot password?" link, "Sign up" link
- `apps/web/app/(auth)/signup/page.tsx` — signup form with name, email, password, confirm password, terms acceptance, OAuth buttons
- `apps/web/app/(auth)/verify-email/page.tsx` — verification pending page with resend button
- `apps/web/app/(auth)/forgot-password/page.tsx` — forgot password form with email input
- `apps/web/app/(auth)/reset-password/page.tsx` — reset password form with new password + confirm
- `apps/web/app/(auth)/error/page.tsx` — auth error page (e.g., OAuth callback failure)

### D9 — Middleware Auth Guard

`apps/web/src/lib/middleware.ts`:
- Redirect unauthenticated users from `(authenticated)` routes to `/login?callbackUrl=<current-url>`
- Allow public routes: `(public)`, `(auth)`, `/api/health`, static assets
- Apply security headers: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy`
- Add `X-Geo-Country` header from Vercel's geo data (if available)
- Do not perform database or Redis queries in middleware

### D10 — Rate Limiting

`apps/web/src/lib/auth/rate-limit.ts`:
- Login: 5 attempts per 15 minutes per IP
- Signup: 3 attempts per hour per IP
- Password reset: 3 attempts per hour per IP
- Email verification resend: 3 attempts per hour per user
- Rate limit storage via Upstash Redis (atomic INCR + EXPIRE)
- Failed rate limit does not crash the request (fail open for reads, fail closed for auth writes)

### D11 — RBAC Implementation

- `roles` table seeded with 3 rows: viewer, moderator, admin
- `users.role` column is authoritative in M3 (denormalized from `user_roles`)
- `requireRole()` helper in `session.ts` checks `users.role` column
- Admin user seeded via `tooling/scripts/seed-admin.ts` (email from env)
- Roles table and `user_roles` table prepared for M5+ reconciliation

### D12 — Auth API Documentation

`docs/06-api/Authentication.md` — 19 sections covering:
- Auth.js v5 + Drizzle adapter configuration
- Provider details (Credentials, Google, GitHub)
- Session strategy and cookie attributes
- Password policy and Zod schema
- Email verification flow
- OAuth account linking rules
- CSRF protection details
- RBAC permission matrix (15 permissions across 3 roles)
- Error response formats (401, 403, 402, EMAIL_NOT_VERIFIED, etc.)
- Middleware auth guard and security headers
- 25 security hardening measures
- Token/session refresh mechanics

## Prerequisites

- M2 (Core Layout) is complete: database schema, Redis, root layout, route groups, error boundaries.
- Neon database is accessible from the application.
- Upstash Redis is accessible for rate limiting.
- Google OAuth client ID and secret are obtained (from Google Cloud Console) and stored in environment variables.
- GitHub OAuth client ID and secret are obtained (from GitHub Developer Settings) and stored in environment variables.
- Mailpit is running locally for dev email capture (configured in `docker-compose.yml`).
- Environment variables in `apps/web/.env.local`: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

## Dependencies

- `@nexus/db` — Drizzle schema for `users`, `user_accounts`, `user_sessions`, `verification_tokens`, `roles`, `user_roles`, `auth_events`; repositories for user operations
- `@nexus/cache` — Redis client for rate limiting
- `@nexus/ui` — Button, Input, Card, Badge components for auth pages
- `@auth/core`, `@auth/drizzle-adapter` — Auth.js v5 core and Drizzle adapter
- `bcrypt` — password hashing
- `zod` — input validation

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Auth.js v5 breaking API changes** | Medium | High | Pin to a specific Auth.js version; the M3 spec references `2026-06-26` initial spec; test upgrade path in staging before applying. Google/GitHub OAuth provider changes are rare but would require config updates. |
| **Drizzle adapter schema mismatch** | Medium | High | The adapter mapping is explicit in `config.ts` (User->users, Account->user_accounts, Session->user_sessions); verify column names match before applying migration; test with a manual insert query first. |
| **CSRF token mismatch on load-balanced deployments** | Low | High | Auth.js handles double-submit CSRF tokens out of the box; the `AUTH_SECRET` environment variable must be consistent across all deployment instances. |
| **Session token leakage via XSS** | Low | Critical | Session cookies use `httpOnly`, `secure`, `sameSite: lax`; CSP headers prevent inline script execution; user-generated content is sanitized with DOMPurify. |
| **OAuth account linking attack** | Medium | High | Auto-link only occurs when the OAuth provider has verified the email; unverified OAuth emails are rejected from auto-linking; require email verification before linking. |
| **Rate limit bypass behind proxy** | Medium | Medium | Rate limit key uses `x-forwarded-for` IP (validated by Next.js); document that the app must be behind a trusted proxy that sets this header; fallback to direct connection IP if header is absent. |
| **bcrypt cost factor 12 causes login latency > 500ms on edge** | Medium | Medium | bcrypt cost 12 takes ~250ms on modern hardware; on edge functions it may be slower — accept this as the cost of security; cache session lookups to reduce repeated bcrypt calls; do not reduce cost below 12. |
| **Email verification token collision** | Low | Critical | SHA-256 hashed tokens are cryptographically random (256-bit); collision probability is negligible; tokens are single-use and expired after 24 hours. |

## Acceptance Criteria

1. User can sign up with email + password via `/signup`; a verification email is sent (Mailpit captures it in dev).
2. User can click the verification link in the email; `emailVerified` is set to `true`; user is redirected to login.
3. User can log in with verified email + password via `/login`; session cookie `__Host-authjs.session-token` is set.
4. User can log in via Google OAuth; if the Google account email matches an existing verified email, accounts are auto-linked.
5. User can log in via GitHub OAuth; if the GitHub account email matches an existing verified email, accounts are auto-linked.
6. User can request a password reset via `/forgot-password`; reset email is sent with a secure token.
7. User can reset their password via the reset link; old sessions are invalidated.
8. Unauthenticated users accessing `(authenticated)` routes are redirected to `/login?callbackUrl=<current-url>`.
9. After login, the user is redirected to the `callbackUrl` (if valid) or to the home page.
10. Authenticated users can access `/api/auth/session` and receive their user object with role.
11. `requireRole("admin")` throws `ApiError(FORBIDDEN)` for non-admin users.
12. Rate limiting blocks login after 5 failed attempts within 15 minutes (per IP).
13. Brute-force signup is blocked after 3 attempts per hour (per IP).
14. Middleware applies all 6 security headers on every response (verified via `curl -I`).
15. CSP header does not break Google/GitHub OAuth scripts (verify OAuth flow works with CSP active).
16. `pnpm typecheck` passes with no errors in the auth modules.
17. `pnpm build` succeeds; auth pages are pre-rendered where possible (login, signup, forgot-password).
18. All security hardening measures from `Authentication.md` §17 are implemented.

## QA Checklist

- [ ] Signup with email + password creates a user in `users` table with `emailVerified: null`.
- [ ] Verification email is captured in Mailpit (dev) and link works.
- [ ] Login with correct credentials sets session cookie and redirects.
- [ ] Login with incorrect credentials shows "Invalid email or password" (no field indication).
- [ ] Login with unverified email redirects to `/verify-email`.
- [ ] Google OAuth login creates a user with `provider: "google"`.
- [ ] GitHub OAuth login creates a user with `provider: "github"`.
- [ ] Auto-link works: sign up with email, then sign in with OAuth using same verified email — accounts are linked.
- [ ] Password reset flow: request → email → new password → login with new password works.
- [ ] Old sessions are invalidated after password reset.
- [ ] Unauthenticated user redirected from `/profile` (placeholder) to `/login?callbackUrl=/profile`.
- [ ] After login, user lands on `/profile` (the callbackUrl).
- [ ] Rate limit: 5 failed logins in 15 min from same IP → 6th attempt returns 429.
- [ ] Rate limit: 3 signups in 1 hour from same IP → 4th attempt returns 429.
- [ ] Middleware security headers present on all responses: CSP, HSTS, X-Frame-Options, Referrer-Policy, X-Content-Type-Options, Permissions-Policy.
- [ ] CSP allows Google/GitHub OAuth scripts (no broken OAuth flow).
- [ ] Session cookie has `httpOnly`, `secure`, `sameSite: lax` attributes.
- [ ] `AUTH_SECRET` is at least 32 characters (verify in `.env.example`).
- [ ] `users.role` is set to "viewer" on signup (default role).
- [ ] `roles` table is seeded with viewer, moderator, admin.
- [ ] Admin user seeded via `seed-admin.ts` can access admin-only routes.
- [ ] No `any` types in `apps/web/src/lib/auth/`.
- [ ] No `ts-ignore` comments in `apps/web/src/lib/auth/`.
- [ ] No password or token logged in any `console.log` or `pino` call.
- [ ] `pnpm test` passes (if tests exist for password hashing, session validation, rate limiting).

## Estimated Tasks

| # | Task | Estimate | Owner | Dependencies |
|---|------|----------|-------|--------------|
| T1 | Install dependencies: `@auth/core`, `@auth/drizzle-adapter`, `bcrypt`, `zod` | 0.5h | Backend | M2 complete |
| T2 | Write Drizzle schema for auth tables (`users`, `user_accounts`, `user_sessions`, `verification_tokens`, `roles`, `user_roles`, `auth_events`) | 3h | Backend | M2 complete |
| T3 | Generate and apply migration for auth tables | 1h | Backend | T2 |
| T4 | Seed `roles` table with viewer, moderator, admin | 0.5h | Backend | T3 |
| T5 | Implement `seed-admin.ts` script | 1h | Backend | T3 |
| T6 | Configure Auth.js v5 with Drizzle adapter, all providers, callbacks | 3h | Backend | T1, T2 |
| T7 | Implement credential provider with bcrypt verification and Zod validation | 2h | Backend | T6 |
| T8 | Implement OAuth providers (Google, GitHub) with profile normalization and auto-link | 2.5h | Backend | T6 |
| T9 | Implement session management helpers (`getSession`, `requireSession`, `requireRole`) | 2h | Backend | T6 |
| T10 | Implement email verification flow (token generation, send, verify, resend) | 2.5h | Backend | T6 |
| T11 | Implement password reset flow (request, email, reset, session invalidation) | 2.5h | Backend | T6 |
| T12 | Implement rate limiting for auth routes | 1.5h | Backend | M2 Redis |
| T13 | Implement middleware with auth guard and security headers | 2h | Full-stack | T6, M2 middleware |
| T14 | Build login page (email/password, OAuth buttons, links) | 2h | Frontend | M1 complete |
| T15 | Build signup page (name, email, password, confirm, terms, OAuth) | 2h | Frontend | M1 complete |
| T16 | Build verify-email page (pending state, resend button) | 1h | Frontend | M1 complete |
| T17 | Build forgot-password and reset-password pages | 1.5h | Frontend | M1 complete |
| T18 | Build auth error page | 0.5h | Frontend | M1 complete |
| T19 | Wire auth pages into route group `(auth)` | 0.5h | Frontend | T14–T18 |
| T20 | Implement `/api/auth/session` endpoint | 1h | Backend | T9 |
| T21 | Implement `/api/auth/verify` endpoint | 1h | Backend | T10 |
| T22 | Implement `/api/auth/forgot-password` and `/api/auth/reset-password` endpoints | 1.5h | Backend | T11 |
| T23 | Write `docs/06-api/Authentication.md` (19 sections) | 6h | Docs | T6–T13 |
| T24 | Security audit: verify all 25 hardening measures from §17 | 3h | Security | T6–T13 |
| T25 | QA pass: all auth flows, rate limiting, middleware, error states | 4h | QA | T14–T22 |
| T26 | Final typecheck, lint, build verification | 1h | Full-stack | T25 |

**Total estimate: ~46 engineer-hours** (approximately 1 week for a full-stack engineer, or 3 days for a backend + frontend pair working in parallel).

## Completion Checklist

- [ ] All deliverables (D1–D12) are present in the repository.
- [ ] All acceptance criteria (1–18) are met.
- [ ] QA checklist is fully checked off.
- [ ] Auth.js v5 is configured and functional with all three providers.
- [ ] Database migration for auth tables is applied to Neon.
- [ ] `roles` table is seeded; admin user is seeded.
- [ ] All auth pages render without errors and are styled consistently with the design system.
- [ ] Middleware correctly redirects unauthenticated users and applies security headers.
- [ ] Rate limiting is functional and tested.
- [ ] `docs/06-api/Authentication.md` is complete with all 19 sections.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build` all pass.
- [ ] No secrets or tokens are logged in any environment.
- [ ] Milestone marked complete in GitHub Projects board.
- [ ] Branch `feature/m3-authentication` deleted after merge.
