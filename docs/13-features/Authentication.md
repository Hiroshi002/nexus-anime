# Authentication — Nexus Anime

> **Audience:** Engineers implementing auth flows (login, signup, verify email, forgot/reset password, OAuth, session management, middleware redirects). Security reviewers.
> **Milestone:** M3
> **Owner:** Engineering
> **Status:** Draft

---

## 1. Purpose

Define the end-to-end authentication and authorization system for Nexus Anime, covering credential signup/login (email + password), Google and GitHub OAuth, email verification, password reset, session management, role-based access control, and middleware guards. Auth.js v5 (NextAuth.js) with a Drizzle adapter is the chosen library; database-backed sessions are used for instant revocation capability.

## 2. Business Goals

- **Conversion:** Reduce signup friction — OAuth one-click paths and minimal-form credential signup increase registration completion rate. Target: signup completion > 70%.
- **Retention:** 30-day absolute session expiry keeps users signed in across visits without re-authentication. Target: 30-day retention + 15% vs. 7-day session baseline.
- **Security posture:** Eliminate custom auth code — Auth.js v5 is widely reviewed and CVE-tracked. Database sessions enable instant revocation on password change. Target: zero credential-leakage incidents.
- **Trust:** Email verification required before catalog access reduces throwaway accounts and improves email-deliverability sender reputation. Target: verified-account bounce rate < 2%.
- **Future-proofing:** Architecture supports passkeys (WebAuthn), TOTP 2FA, and session management UI without schema redesign.

## 3. Functional Requirements

### 3.1 Happy Path

1. Visitor navigates to `/auth/signin` and submits email + password. System validates credentials against `user_accounts.password_hash` (bcrypt), creates a `user_sessions` row, sets the `__Host-authjs.session-token` cookie, and redirects to `/`.
2. Visitor navigates to `/auth/signup`, submits email + password + username. System validates with Zod, hashes password, creates `users` + `user_accounts` rows, creates a `verification_tokens` row, sends verification email, and shows "check your email" interstitial.
3. User clicks email verification link (`/auth/verify?token=...`). System hashes token, looks up `verification_tokens`, checks expiry, sets `users.email_verified_at = now()`, deletes token row, and redirects to `/`.
4. User clicks "Sign in with Google" or "Sign in with GitHub". System redirects to provider consent screen, handles callback, normalizes profile, auto-links to existing account if email matches verified account, creates session, and redirects to `/`.
5. User navigates to `/auth/forgot`, submits email. System creates `verification_tokens` row (1-hour expiry), sends reset email. User clicks link, submits new password, system updates hash, deletes all sessions, creates fresh session for current device.
6. Authenticated user visits protected route. Middleware reads session cookie, validates against `user_sessions`, attaches session to request, route handler executes.
7. Authenticated user signs out via POST `/api/auth/signout`. System deletes session row, clears cookie, redirects to `/`.

### 3.2 Alternate Flows

1. **OAuth account linking:** If a Google/GitHub user signs in with an email matching an existing verified credentials account, the OAuth identity is linked to the existing `users` row (a new `user_accounts` row is created; no duplicate user).
2. **OAuth new account creation:** If no existing user matches the OAuth email, a new `users` + `user_accounts` row is created. The user is marked verified (Google) or must verify (GitHub with private email).
3. **Unverified credentials user:** User signs in successfully but `email_verified_at IS NULL`. System issues a session but middleware redirects to `/auth/verify` interstitial instead of catalog.
4. **Expired verification token:** User clicks expired link. System shows "link expired" page with "resend verification email" button.
5. **Password change (settings):** User submits old + new password. System verifies old password, hashes new password, updates `user_accounts.password_hash`, deletes all `user_sessions` rows for the user, creates fresh session for current device.
6. **Session expiry:** User makes a request with an expired cookie. Middleware detects `expires_at < now()`, redirects to `/auth/signin?reason=expired`.
7. **Concurrent OAuth + credential signup:** User signs up with credentials, then later signs in with Google using the same email. Auto-link merges the identities; the credential password hash remains in `user_accounts`.

### 3.3 Edge Cases

1. **Race condition — duplicate signup:** Two concurrent requests with the same email both pass uniqueness check before either inserts. The partial unique index `WHERE deleted_at IS NULL` causes the second INSERT to fail with a unique violation; the system returns a friendly "this email is already registered" error.
2. **OAuth provider returns no email:** GitHub with private email scope denied. System rejects the signup with `EMAIL_NOT_VERIFIED` and prompts user to grant `user:email` scope.
3. **OAuth provider returns unverified email:** Some providers may not verify email. System treats unverified email as insufficient for auto-linking; creates a new account and requires email verification.
4. **Session token rotation during concurrent requests:** Two requests with the same session cookie both trigger rotation. One succeeds (inserts new token, deletes old); the other fails (old token already deleted). The failing request returns `UNAUTHORIZED`; the client re-authenticates or retries with the new cookie.
5. **Password reset with no existing account:** User submits email for an account that does not exist. System returns the same success message as a valid reset ("check your email") to prevent account enumeration. No email is sent.
6. **Verification token reuse:** User clicks the same verification link twice. The second attempt finds the token already deleted; system shows "already verified — sign in" message.
7. **Session cookie theft:** Attacker exfiltrates session cookie. User changes password — all sessions are deleted, attacker's cookie is invalidated immediately.
8. **Neon database failover:** Active session validation hits a transient DB error. System retries once; on second failure, returns 503 with a "try again" message. Does not cache stale session state.
9. **Extremely long password:** User submits a 10,000-character password. Zod rejects at 128 characters before hashing — prevents DoS via bcrypt on huge inputs.
10. **Unicode in username:** User submits `用户名` as username. Zod regex (`/^[a-z0-9_]{3,32}$/`) rejects — only ASCII lowercase, digits, and underscore allowed to prevent homograph attacks in URLs.

## 4. Non-Functional Requirements

- **Performance:** Credential login < 500ms end-to-end (includes bcrypt ~250ms + DB insert + cookie set). Session validation < 20ms (DB lookup by indexed `session_token_hash`).
- **Availability:** 99.9% for auth endpoints. Auth is on the critical path for every authenticated page; degraded auth means degraded product.
- **Scalability:** Support 100k registered users by end of M3, 1M by M5. Session table grows ~30k rows/day at 1M DAU (30-day sessions); background purge keeps table bounded.
- **Accessibility:** WCAG 2.2 AA. All form fields have visible labels, errors linked via `aria-describedby`, password toggle uses `aria-pressed`, skip-to-content link present.
- **Localization:** All user-facing strings externalized (no hardcoded English). Error messages use message keys resolved at render time. CJK input allowed in display names only (not usernames).
- **Security:** OWASP Top 10 mitigations — bcrypt cost 12, SHA-256 hashed tokens in DB, `__Host-` cookie prefix, `HttpOnly` + `SameSite=lax`, CSRF double-submit, rate-limited login/signup, CSP with nonces, HSTS 2-year max-age.

## 5. User Stories

- As a **visitor**, I want to sign up with my email and password so that I can create an account and start watching.
- As a **visitor**, I want to sign in with Google or GitHub so that I can create an account without remembering another password.
- As a **new user**, I want to receive a verification email so that I can prove I own the email address and access the catalog.
- As a **forgetful user**, I want to reset my password via email so that I can regain access to my account.
- As a **returning user**, I want to stay signed in for 30 days so that I do not have to re-authenticate on every visit.
- As a **security-conscious user**, I want my sessions revoked when I change my password so that any stolen cookies stop working immediately.
- As an **admin**, I want to assign roles to users so that moderators and other admins can help manage the platform.

## 6. Acceptance Criteria

- [ ] User can sign up with email + password + username and receives a verification email.
- [ ] User cannot access catalog before verifying email (redirected to `/auth/verify` interstitial).
- [ ] User can sign in with Google and is auto-linked if the same email exists as a verified credentials account.
- [ ] User can sign in with GitHub; private email scope denial shows a clear error.
- [ ] User can request a password reset and complete the flow (email link → new password → signed in).
- [ ] Changing password invalidates all other sessions and keeps the current device signed in.
- [ ] Expired session redirects to `/auth/signin?reason=expired`.
- [ ] Rate-limited login returns `429` with a user-friendly "Too many attempts" message.
- [ ] Error messages never reveal whether an email is registered (no enumeration).
- [ ] All auth routes pass `pnpm typecheck` with strict mode (no `any`).
- [ ] Session cookie has `__Host-` prefix, `Secure`, `HttpOnly`, `SameSite=lax`.
- [ ] CSRF double-submit token is present on all credential forms.
- [ ] Middleware matcher excludes `auth/*`, `_next/static`, `_next/image`, `favicon.ico`, `public/`.
- [ ] Security headers (HSTS, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy) present on all responses passing through middleware.

## 7. UI Components

| Component | Responsibility | Reusable? | Package |
|-----------|---------------|-----------|---------|
| `CenteredAuthLayout` | Full-screen vertical + horizontal centering with orb backdrop | Yes | `apps/web` |
| `AuthCard` | Max-width 440px glassmorphism card containing auth forms | Yes | `apps/web` |
| `AuthHeader` | Title + subtitle above the form | Yes | `apps/web` |
| `FormField` | Label + input + inline error, linked via `aria-describedby` | Yes | `@nexus/ui` |
| `PasswordToggle` | Show/hide password button with `aria-pressed` | Yes | `@nexus/ui` |
| `PasswordStrengthMeter` | 4-bar strength indicator (signup only) | Yes | `@nexus/ui` |
| `OAuthButton` | Full-width outline button for Google/GitHub | Yes | `@nexus/ui` |
| `RememberMeCheckbox` | Persist session preference (login only) | Yes | `@nexus/ui` |
| `InlineFormError` | `aria-live` region for form-level errors | Yes | `@nexus/ui` |
| `Divider` | Visual separator with "or continue with" text | Yes | `@nexus/ui` |
| `AlternateFlowLink` | Switch between signin/signup | Yes | `apps/web` |
| `VerifyEmailInterstitial` | "Check your email" post-signup page with resend | No | `apps/web` |
| `ForgotPasswordForm` | Email-only form for initiating reset | No | `apps/web` |
| `ResetPasswordForm` | New password + confirm fields | No | `apps/web` |

## 8. API Dependencies

| Endpoint | Method | Auth Required | Rate Limit | Cache |
|----------|--------|---------------|------------|-------|
| `/api/auth/callback/credentials` | POST | No | 10/min per IP | None |
| `/api/auth/callback/google` | GET | No | None (redirect flow) | None |
| `/api/auth/callback/github` | GET | No | None (redirect flow) | None |
| `/api/auth/signout` | POST | Yes (CSRF) | None | None |
| `/api/auth/verify` | GET | No | 30/min per IP | None |
| `/api/auth/verify/resend` | POST | Yes | 3/hour per user | None |
| `/api/auth/forgot` | POST | No | 5/min per IP | None |
| `/api/auth/reset` | POST | No | 10/min per IP | None |
| `/api/auth/session` | GET | No | None | None |
| `/api/auth/csrf` | GET | No | None | None |

## 9. Database Dependencies

| Table / View | Operation | Index / Query Notes |
|--------------|-----------|---------------------|
| `users` | SELECT, INSERT | PK `id`; partial unique index on `email WHERE deleted_at IS NULL` |
| `user_accounts` | SELECT, INSERT | FK `user_id`; unique on `(provider, provider_account_id)`; indexed on `email` for credential lookup |
| `user_sessions` | SELECT, INSERT, DELETE | PK `id`; unique on `session_token_hash` (lookup on every request); indexed on `user_id` (session listing); indexed on `expires_at` (purge job) |
| `verification_tokens` | SELECT, INSERT, DELETE | PK `id`; unique on `token_hash`; indexed on `user_id`; expires at 24h (email verify) or 1h (password reset) |
| `audit_log` | INSERT | Records `user.login`, `user.logout`, `user.password_change`, `user.role_change` |

## 10. Edge Cases

1. **Duplicate email signup race:** Two concurrent signup requests with the same email. The partial unique index ensures only one INSERT succeeds; the second receives a unique violation and surfaces a friendly error. No two users share an email.
2. **OAuth with unverified email provider:** If the provider does not verify email (rare), the system creates a new account and requires email verification before catalog access. The user is not auto-linked.
3. **GitHub private email scope denied:** GitHub user who denies `user:email` scope cannot be identified. System shows a clear error: "GitHub must share your email address. Please grant the 'user:email' scope."
4. **Session rotation race:** Two concurrent requests with the same session cookie both trigger rotation (session age > 24h). One succeeds (inserts token B, deletes token A). The other fails to find token A and returns `UNAUTHORIZED`. The client retries with token B from the Set-Cookie header of the first response.
5. **Password reset for non-existent email:** System returns the same "check your inbox" message regardless of whether the email exists. No email is sent for non-existent accounts. This prevents enumeration.
6. **Verification token reuse:** After successful verification, the token row is hard-deleted. A second click on the same link shows "already verified — sign in" (no error, no re-send).
7. **Session cookie theft + password change:** Attacker has a stolen cookie. User changes password → all `user_sessions` rows deleted → attacker's cookie is invalidated. Current device gets a fresh session.
8. **Neon failover during session validation:** Transient DB error on session lookup. System retries once; on second failure, returns 503. Does not cache or assume session validity.
9. **10,000-character password submission:** Zod rejects at the boundary (max 128) before the input reaches bcrypt. No hash computation on malicious input.
10. **Unicode username:** Zod regex restricts usernames to `[a-z0-9_]`. CJK, emoji, and Cyrillic are rejected with a clear validation message. Prevents homograph confusion in profile URLs.
11. **Expired session on protected page:** User clicks a deep link with an expired cookie. Middleware redirects to `/auth/signin?reason=expired`. After signin, the user is redirected back to the deep link via `returnTo` query param.
12. **OAuth account merge after credential deletion:** User soft-deletes their credentials account, then signs in with Google using the same email. Auto-linking requires `email_verified_at IS NOT NULL` — if the credential account was soft-deleted but the `users` row remains verified, linking succeeds.

## 11. Error Handling

| Error Condition | User-Facing Message | Recovery Action | Log Level |
|-----------------|---------------------|-----------------|-----------|
| Invalid credentials | "Invalid email or password." | Stay on form, clear password field | warn (rate-limited) |
| Email not verified | "Please verify your email before continuing." | Redirect to `/auth/verify` interstitial | info |
| Rate-limited login | "Too many attempts. Try again in N minutes." | Show countdown, disable submit | warn |
| Expired session | "Your session has expired. Please sign in again." | Redirect to `/auth/signin?reason=expired` | info |
| Invalid/expired reset token | "This reset link is invalid or expired." | Offer to resend reset email | warn |
| OAuth scope denied | "GitHub must share your email. Please grant the 'user:email' scope." | Re-initiate OAuth with corrected scope | info |
| Network failure | "Could not reach the server. Check your connection." | Inline snackbar, retry button | error |
| CSRF mismatch | "Your session expired. Please try again." | Refresh page, re-submit | error |
| Account locked | "Too many attempts. Try again in N minutes." | Same as rate-limited (no enumeration) | warn |

## 12. Analytics Events

| Event Name | Trigger | Properties | Surface |
|------------|---------|------------|---------|
| `auth_signup_start` | User submits signup form | `{ provider: 'credentials' | 'google' | 'github' }` | Server |
| `auth_signup_success` | Account created | `{ provider, user_id }` | Server |
| `auth_signin_success` | Session created | `{ provider, user_id }` | Server |
| `auth_signout` | Session destroyed | `{ user_id }` | Server |
| `auth_email_verified` | Email verification successful | `{ user_id }` | Server |
| `auth_password_reset_request` | Forgot password submitted | `{ email_hash }` (no raw email) | Server |
| `auth_password_reset_complete` | Password reset successful | `{ user_id }` | Server |
| `auth_oauth_callback` | OAuth callback received | `{ provider, is_new_user, is_linked }` | Server |
| `auth_session_expired` | Expired session detected | `{ user_id? }` | Server |
| `auth_rate_limited` | Rate limit triggered | `{ action, ip_hash }` | Server |

## 13. Security Considerations

- **OWASP A02 (Cryptographic Failures):** bcrypt cost 12; SHA-256 hashed tokens in DB; no raw secrets in code or logs.
- **OWASP A07 (Identification and Authentication Failures):** Auth.js v5 handles credential + OAuth flows; no custom auth code; account enumeration prevented via vague error messages.
- **OWASP A01 (Access Control):** RBAC enforced at service layer (`requireRole`); middleware redirects unauthenticated users; UI hiding is UX, not security.
- **OWASP A05 (Security Misconfiguration):** `__Host-` cookie prefix enforces Secure + Path=/ + no Domain; CSP with nonces; HSTS 2-year; security headers on every middleware response.
- **OWASP A08 (Software and Data Integrity):** Auth.js v5 is widely reviewed, CVE-tracked; Drizzle adapter is official; no unmaintained crypto libraries.
- **CSRF:** Auth.js double-submit cookie pattern + `SameSite=lax` session cookie + `Authorization: Bearer` requirement for state-changing API endpoints.
- **Brute-force rate limiting:** Login and signup rate-limited via Redis (see `Rate-Limiting.md`); failed attempts do not reveal whether email exists.
- **Session theft:** 24-hour token rotation limits theft window; password change invalidates all sessions; `__Host-` + `HttpOnly` + `SameSite=lax` cookies.
- **OAuth account takeover:** Auto-linking requires verified email on both sides; unverified OAuth accounts cannot merge into existing users.
- **PII exposure:** Email and IP address are PII; not logged in error messages; audit log captures actor IDs but not raw credentials.
- **Token storage:** Raw session and verification tokens never touch the database; only SHA-256 hashes are stored. A table dump yields no usable tokens.

## 14. Performance Requirements

- **Credential login:** p95 < 500ms (includes bcrypt ~250ms + DB insert + Set-Cookie).
- **Session validation:** p95 < 20ms (indexed lookup on `session_token_hash`).
- **OAuth redirect initiation:** p95 < 100ms (redirect to provider, no DB write).
- **Session rotation:** Adds < 30ms overhead to the triggering request (insert new + delete old in a transaction).
- **Background session purge:** Runs every 10 minutes; deletes expired rows in batches of 1000; does not block request path.
- **Rendering strategy:** Auth pages are SSR (no ISR — session state is request-time data). Signin/signup pages are public and can be cached at edge for anonymous users.
- **Bundle-size budget:** Auth.js client bundle < 30kB gzipped; no heavy crypto libraries in the client bundle.

## 15. Future Improvements

1. **Passkey (WebAuthn) login** — FIDO2-based passwordless authentication; stored in a new `user_credentials` table alongside credential rows.
2. **TOTP 2FA** — Time-based one-time passwords (RFC 6238); required for admin role; stored encrypted in `user_accounts.totp_secret_encrypted`.
3. **Session management UI** — Users can view and revoke active sessions; admins can revoke any user's sessions. Leverages `user_sessions.user_agent` and `ip_address` columns.
4. **HaveIBeenPwned password check** — On signup and password change, reject passwords found in breach databases via k-anonymity API.
5. **Configurable session lifetime** — "Remember me" extends to 90 days; sensitive actions (password change, billing) require step-up re-authentication.
6. **Admin impersonation** — Admins can sign in as another user for support; logged in `audit_log`; flagged with `is_impersonated` on the session row.
7. **Custom roles** — M5+ may introduce `editor`, `translator`, etc. Schema designed to accommodate via `roles` + `user_roles` tables with `users.role` as a cached fast-path.
8. **Discord and Apple OAuth** — Additional OAuth providers; same auto-linking logic applies.
9. **Suspicious-login detection** — CAPTCHA or proof-of-work challenge before OAuth callback completes for high-risk signups.
