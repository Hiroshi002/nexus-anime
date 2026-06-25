| id | title | status | related_specs | runner | spec_version |
|----|-------|--------|--------------|--------|--------------|
| M3.9 | Auth & Security Testing Strategy | Draft | M2.7, M3.3, M3.4, M3.5, M3.6, M3.7, M3.8 v1.1.0 | Vitest 3 | v1.0.0 |

# M3.9 — Auth & Security Testing Strategy

**Status:** Draft · **Milestone:** M3 (Sprints 5–6) · **Runner:** Vitest
**Owning workspaces:** `packages/auth/`, `packages/validation/`, `apps/web/`

# 0. Executive Summary — Class/Spec Map

| # | Class | Owner | Primary specs |
|---|-------|-------|----------------|
| 1 | Unit | `packages/auth/`, `packages/validation/` | M3.3 §2–§6, §8–§9; M3.5 §2–§3; M3.6 §3, §7; M3.7 §2, §9, §11 |
| 2 | Integration | `apps/web/` Route Handler devs | M3.8 §1, §15–§23; M3.3 §7–§8; M3.4 §3–§6; M3.6 §6; M3.7 §13.2 |
| 3 | Authentication | Auth specialist | M2.7 §3, §3.5; M3.3 §2–§7; M3.4 §2–§6; M3.5 §4–§5; M3.6 §8; M3.7 §2, §3, §8 |
| 4 | Authorization | Auth specialist | M2.7 §4, §4.5; M3.5 §2–§7; M3.6 §8; M3.8 §21 |
| 5 | Security | Security lead | M3.7 §2–§13; M2.7 §6–§7; M3.4 §3; M3.8 §22–§23 |

## 1. Overview & Goals

This document is the testing plan that proves the claims made by the six upstream specs. Every section in §5–§9 maps verbatim to §N anchors from those specs; no test case exists without a cited source. The five test classes are Unit, Integration, Authentication, Authorization, and Security — in that order the pyramid narrows. Goals: catch credential / OAuth regression before it reaches `main`; produce a nightly-attested security baseline derived from M3.7 §13; satisfy the error-code contract of M3.8 §20 without localisation coupling. Out of scope: full Playwright E2E, property-based fuzz, and third-party pen testing — these have dedicated M4.x follow-ups.

## 2. Test Pyramid

```mermaid
graph TD
    S["Security (CSRF, XSS, rate, brute-force)"]
    A["Authentication (credentials + OAuth lifecycle)"]
    Z["Authorization (RBAC matrix × route mapping)"]
    I["Integration (every public route in M3.8 §15–§19)"]
    U["Unit (guards, callbacks, schemas)"]

    S --> A --> Z --> I --> U

    style S fill:#ff6b6b,color:#000
    style A fill:#ffa94d,color:#000
    style Z fill:#ffd43b,color:#000
    style I fill:#69db7c,color:#000
    style U fill:#74c0fc,color:#000
```

**In scope:** pure functions, public API contract, full auth flows, guard matrix, OWASP-relevant attack surfaces. **Out of scope:** Playwright E2E, property-based fuzz (fast-check), OWASP ZAP DAST, load testing, quarterly external pen testing — tracked in M3.7 §13.3 and §15.

## 3. Tooling

| Choice | Justification |
|--------|---------------|
| Vitest | Repo-wide runner declared by the M3.3 plan Global Constraints |
| `@testing-library/react` | Component tests for auth UI pieces (login form, OAuth callback handler, session-expiry banner) |
| `next-test-api-route-handler` (or `node-mocks-http`) | Drive `apps/web/app/api/v1/**/route.ts` without spinning the full Next.js server |
| `msw` v2 | Stub Google / Discord OAuth token + userinfo endpoints — never hit provider sandboxes from CI |
| `testcontainers` (`@testcontainers/postgresql`, `@testcontainers/redis`) | Provide real Postgres + Redis for integration / security classes; same engine as prod so revocation and lockout behave honestly |
| `fast-check` (optional, class 5 only) | Property test for JWT parse / Zod schema round-trips when M3.7 §13.3 unblocks |
| `undici` (class 5 only) | Raw HTTP for cookie / header / pen-test-lite cases where Node's cookie jar would mask the attacker model |

## 4. Test Data

Fixtures seed the M3.6 §3 `user_profiles` columns (`username`, `display_name`, `avatar_url`, `preferences`, `privacy_flags`) and the M3.3 §9 `user_sessions` / `revoked_sessions` / `remember_me_tokens` rows; factories produce roles from the M3.5 §2 enum (`guest, user, premium, moderator, admin, superadmin`) and the M3.5 §3 permission set (`anime:read`, `comment:create`, `user:update_any`, `role:assign`, …). A `createUser({ role, locked })` factory emits the `login_attempts` and `brute_force_lockouts` rows referenced by M3.7 §11. Provider fixtures for M3.4 §3 and §4 ship pre-issued `code` + `code_verifier` pairs so PKCE is exercised without a live redirect, plus canned `id_token` JWTs with/without `email_verified` for §4.3 and §4.5. Each test runs inside a Drizzle transaction that is rolled back on teardown; Redis is flushed once per test file. Fixtures are lazy-loaded so the majority of unit tests that need zero rows pay nothing for the database — a `createUser()` returns a handle and only materialises the row when awaited. `AUTH_SECRET` is a fixed 32-byte test-only value per M3.3 Global Constraints; tests that rotate it use `vi.hoisted` so the new value is bound at module init before the config module reads it.

## 5. Class 1 — Unit Tests

**Scope.** Covers M3.3 §2, §3, §5, §6, §8, §9; M3.5 §2, §3; M3.6 §3, §7; M3.7 §2, §9. All Redis / Postgres / network stubbed.

**Strategy.** `vi.mock()` for Redis, Postgres, and `next/headers`. Arrange/act/assert, one assertion per case, no free-text error comparison. Time-driven assertions use `vi.useFakeTimers()`.

**Representative cases (12):**
- [M3.3 §2] `encodeSessionJWT` produces a token carrying `sub`, `role`, `channel`, `v`, `jti`, `iat`, `exp`; empty input rejects.
- [M3.3 §2] `decodeSessionJWT` rejects malformed tokens (missing `sub`, `role`, `jti`, or `exp`) — never silently defaults; all-claims enforcement.
- [M3.3 §3] rolling refresh triggers when `exp - now < 7 days`; does not trigger otherwise.
- [M3.3 §5] `isRememberMeTokenValid` rejects expired, revoked, and non-constant-time mismatches.
- [M3.3 §6] `computeDeviceFingerprint` returns stable hash for identical UA / language / IP-subnet; distinct on any change.
- [M3.3 §8] `revokeAllUserSessions` flushes the Redis cache entry and inserts a `revoked_sessions` row.
- [M3.3 §9] revoking single `jti` revokes only that session; other sessions for the same user remain valid until independently revoked.
- [M3.3 §5] a remembered-me token whose `expires_at` is in the past fails validation even when the row is unrevoked; expiry semantics tested via `vi.useFakeTimers()` to avoid waiting wall-clock.
- [M3.5 §2] `requireRole` allows `admin` when `user.role = superadmin`; denies with `FORBIDDEN` when strictly lower.
- [M3.5 §3] permission-matrix enumeration: every (role, permission) pair's allow/deny outcome matches the M3.5 §3 table.
- [M3.6 §3] profile-columns factory refuses invalid `username` (non-UTF-8, < 3 chars, reserved word).
- [M3.6 §7] avatar upload size cap enforced at schema level — rejects payloads over the M3.6 §5.1 limit with `PAYLOAD_TOO_LARGE`.
- [M3.6 §7] profile bio length (≤ 512), display_name (≤ 64), and pluralised preferences keys all have both a positive and a negative boundary test.
- [M3.6 §7] Zod rules reject exact boundary values (`bio.length > 512`, `display_name` empty, malformed avatar URL).
- [M3.7 §2] password schema enforces PW-01..PW-07 against known-bad inputs (min length, Unicode block support, Zxcvbn threshold, breach blocklist).
- [M3.7 §9] cookie-shape assertion rejects any `Set-Cookie` missing `__Host-` prefix, `Secure`, `HttpOnly`, `SameSite=Lax` flags simultaneously.
- [M3.7 §9] remember-me token row from §5 carries the rotation column used by §5.5; unit test asserts rotation semantics against that exact `remember_me_tokens` schema.
- [M3.3 §9] `session.test.ts` confirms the `user_sessions` row shape matches columns listed in §9 (`user_id`, `jti`, `device_fingerprint`, `expires_at`, `revoked_at`).
- [M3.3 §5] Remember-Me token rotation revokes the prior row; constant-time comparison enforced so short-circuits cannot be fingerprinted.

**Tools.** Vitest, `vi.mock()`, `vi.useFakeTimers()`.

**Anti-patterns.** Do not assert on error `message` — M3.8 §20 is the contract. Do not mock `jti` with a constant (breaks revocation uniqueness). Do not assert bcrypt cost here (belongs in class 5). Do not share mutable role objects between tests. Do not rely on real `Date.now()`.

## 6. Class 2 — Integration Tests

**Scope.** Public routes listed in M3.8 §15–§19 (Auth, User, Profile, Session, Admin User). Covers M3.8 §1, §15–§19, §20, §21, §22, §23; M3.3 §7, §8; M3.4 §3–§6; M3.6 §6; M3.7 §13.2.

**Strategy.** Drive route handlers through `node-mocks-http` against `testcontainers` Postgres + Redis. Assert both the M3.8 §1 envelope shape (`meta.requestId`, `meta.version: "v1"`) and the error codes from §20 — never free strings. Every listed route has at least one happy-path + one error-path test.

**Representative cases (14):**
- [M3.8 §15] `POST /api/v1/auth/login` returns `INVALID_CREDENTIALS` and `VALIDATION_ERROR`; happy-path sets `__Host-nexus-session` with attributes per M3.7 §9.1.
- [M3.8 §15] `POST /api/v1/auth/register` hashes password, writes `audit_events`, sets session cookie; duplicate e-mail returns `EMAIL_TAKEN`.
- [M3.8 §15] `POST /api/v1/auth/logout` returns 204 with expiration cookie; repeated old-cookie use → 401.
- [M3.8 §15] `GET /api/v1/auth/oauth/google` redirects with `state` + `code_challenge=S256`; provider-disabled returns 404.
- [M3.8 §15] `GET /api/v1/auth/oauth/google/callback` issues JWT with `channel: "google"`; mismatched state → `BAD_STATE`.
- [M3.8 §15] `POST /api/v1/auth/password-reset` returns 202 always (no enumeration); rate-limited after 3 attempts per M3.7 §6.
- [M3.8 §16] `PATCH /api/v1/users/me` updates profile fields per M3.6 §6; rejects invalid payload with `VALIDATION_ERROR`.
- [M3.8 §16] `GET /api/v1/users/me` returns the merged profile respecting `privacy_flags` from M3.6 §3; private fields masked for unauthenticated callers.
- [M3.8 §17] `PATCH /api/v1/users/me/avatar` returns presigned URL per M3.6 §5.1; rejects binary upload.
- [M3.8 §18] `POST /api/v1/sessions` lists active devices per M3.3 §6.7; unauthenticated → 401.
- [M3.8 §19] `POST /api/v1/admin/users/:id/revoke-sessions` requires admin+; non-admin → `FORBIDDEN`.
- [M3.8 §21] every security-event route writes an `audit_events` row with the trigger type listed in the audit-event table.
- [M3.8 §22] `X-RateLimit-Limit`, `-Remaining`, `-Reset` headers present on every authenticated route.
- [M3.8 §23] every `Set-Cookie` string parses to the exact M3.7 §9.1 attribute set.
- [M3.8 §20] every error response carries an `error.code` value present in the registry — no free-string codes; localisation sits only in `error.message`, which tests never assert.
- [M3.7 §11] `login_attempts`, `brute_force_lockouts`, and `user_sessions` rows reflect login / logout / revoke transitions.

**Tools.** Vitest + `testcontainers` (Postgres + Redis) + `node-mocks-http`.

**Anti-patterns.** Do not mock Postgres or Redis here — they are the source of truth. Do not share request context across tests. Do not skip rollback between tests. Do not assert `error.message`. Do not skip the rate-limit header checks — they're part of the same contract.

## 7. Class 3 — Authentication Tests

**Scope.** Full credential + OAuth lifecycle. Covers M2.7 §3, §3.5; M3.3 §2–§7; M3.4 §2–§6; M3.5 §4, §5; M3.6 §8; M3.7 §2, §3, §8.

**Strategy.** Compose request → route handler → cookies → `audit_events`. Drive OAuth round-trip with `msw` stubbing provider token + userinfo, never live Google / Discord sandboxes. Both credential and OAuth account-linking paths exercised.

**Representative cases (15):**
- [M2.7 §3] valid credentials → 302 + `__Host-nexus-session` cookie + `login.success` audit.
- [M2.7 §3] wrong password → `INVALID_CREDENTIALS` (no enumeration) and `login_attempts +1`; constant-time response window.
- [M3.4 §2] Discord flow requests scope `identify email` only; user without e-mail blocked with directive message.
- [M3.4 §2] GitHub flow (post-MVP scaffold) uses scope `read:user user:email`; unit test still verifies the scope string does not include `repo` or `delete_repo`.
- [M3.4 §3] first-time Google login creates account, sets `channel: "google"` claim, scope limited to `openid email profile`.
- [M3.4 §3] returning Google user with matching e-mail triggers verify-owner linking flow per §5; unverified attempt → `FORBIDDEN`.
- [M3.4 §5] verify-owner step succeeds when caller re-authenticates with the existing provider and produces an `account.linked` audit event; aborts otherwise.
- [M3.4 §5] duplicate-email linking without e-mail verified → `OAuthAccountNotLinked`; with verified → linking succeeds and audit emitted.
- [M3.4 §6] account-recovery: OAuth-only account losing provider access produces correct status + user-facing recovery path.
- [M3.4 §5.5] unlink: last auth method → `CANNOT_UNLINK`; OAuth-only without reverify → `SET_PASSWORD_FIRST`; successful unlink deletes the `accounts` row and writes `account_unlink` audit.
- [M3.7 §3] state/PKCE: redirect carries `state` + `code_challenge`; invalid state → `BAD_STATE` + `oauth.state_mismatch` audit.
- [M3.7 §3] Google `email_verified: false` short-circuits the callback with `UNVERIFIED_EMAIL`.
- [M3.7 §3] forged `redirect_uri` to non-allowlisted host → 400 before any token exchange.
- [M3.3 §5] Remember-Me sets `Expires` to REMEMBER_ME_TTL; validating a token rotates it (prior revoked) per §5.5.
- [M3.3 §7] self-logout revokes JTI, emits expiration cookie; repeated old-cookie use → 401 with `session.revoked_access_attempt` audit.
- [M2.7 §3] password-reset: known and unknown e-mail both return 202; token reuse → `TOKEN_ALREADY_USED`.
- [M3.7 §8] concurrent session over limit (5 default, 10 premium per M3.5 §2.2) evicts oldest device and emits `session.evicted`.
- [M3.4 §4] callback route validates `code` + `verifier` pair with a constant-time compare; replayed `code` from a prior session cannot succeed.
- [M3.4 §4] `email_verified: false` short-circuits the callback with `UNVERIFIED_EMAIL` before any account row is written — audit row per §21 is emitted on the rejection.
- [M3.7 §8] `SameSite=Lax` asserted directly on the `Set-Cookie` attribute string — browsers must not send the session cookie on cross-site POSTs; integration drives a cross-origin POST via `node-mocks-http` with a forged `Origin` and asserts the session is not accepted.
- [M3.7 §13] OWASP ASVS L1 checklist items V2.1 (password policy), V3.1 (session fixation), V5.1 (CSRF) covered programmatically via §5–§9; remaining checklist items reserved for the Playwright `release-gate`.
- [M3.7 §12] security-related env vars (`AUTH_SECRET` length ≥ 32 bytes, `AUTH_*_ID` non-empty when provider is enabled, `NODE_ENV` production flag) are validated at type-level — test asserts invalid config rejects before app boot.
- [M3.6 §8] profile-scope checks run after auth — authenticated-but-unauthorised request yields 403 not 302.

**Tools.** Vitest, `msw` v2, `testcontainers`, `next-test-api-route-handler`.

**Anti-patterns.** Never embed live provider credentials. Do not wait real minutes for lockout / TTL — use `vi.useFakeTimers()`. Do not assert lockout by response message; verify via `brute_force_lockouts` row. Do not skip the account-recovery branch even though it's post-MVP for happy path — §7 must still validate the error case.

## 8. Class 4 — Authorization Tests

**Scope.** Route-level and resource-level guards. Covers M2.7 §4, §4.5; M3.5 §2–§6, §7; M3.6 §8; M3.8 §21.

**Strategy.** Table-driven test over M3.3 §2 role hierarchy × M3.5 §3 permission matrix × M3.5 §6 route map. Every (role, route) triple is asserted as one of `allow`, `UNAUTHORIZED`, or `FORBIDDEN`.

**Representative cases (13):**
- [M3.5 §3] matrix enumeration: all 6 roles × every permission in/out status affirmed vs M3.5 §3 table.
- [M3.5 §5] guard chain (`requireAuth`, `requireRole`, `requirePermission`, `requireOwner`, `requireSubscriber`): 3 tests each (pass / fail-auth / fail-Forbidden).
- [M3.5 §6] route-level matrix: authenticated-but-underpriv yields `FORBIDDEN`; unauthenticated yields `UNAUTHORIZED`.
- [M2.7 §4.5] resource-level: owner can edit own profile; non-owner even admin denied `user:update` on someone else's row (IDOR blocked).
- [M3.5 §8] superadmin bypass: passes `requireOwner` on every resource including role assignment.
- [M3.5 §7] role assignment: non-admin → `FORBIDDEN`; admin self-escalate to superadmin → rejected; every successful assignment writes `audit.role_change`.
- [M3.5 §2] premium limit: 6th concurrent session for free-tier triggers eviction; premium passes 6th–10th.
- [M3.8 §21] every `PERMISSION_DENIED` writes an `audit_events` row with the exact trigger name.
- [M3.5 §3] permission `role:assign` is superadmin-only — assert admin is denied with `FORBIDDEN`.
- [M3.5 §4] role hierarchy: `premium` can do everything `user` can, plus premium-only routes; `moderator` inherits comment deletion, not role assignment.
- [M3.6 §8] profile `privacy_flags` restricts field visibility; admin reading another user's private fields returns masked values, not raw data.
- [M3.5 §5] chained guards (`requirePermission("user:update_any")` OR `requireOwner`) correctly composes OR vs AND semantics.
- [M3.5 §6] route without explicit permission mapping returns `NOT_FOUND` to the caller, not `FORBIDDEN`, to avoid leaking route existence.
- [M3.5 §2] role-enum exhaustiveness: guards reject any `role` value outside `guest|user|premium|moderator|admin|superadmin` at the schema boundary before it reaches the matrix.
- [M3.5 §6] `PUT /api/v1/users/me/preferences` upserts preferences; valid both empty body and partial merge, returns updated row with `VALIDATION_ERROR` on invalid keys.
- [M3.5 §6] `DELETE /api/v1/users/me` (GDPR wipe) revokes all sessions, writes the deletion audit row, and blanks PII columns in `user_profiles`; verified from an unauthenticated follow-up request that the row becomes unreadable.
- [M3.5 §6] `PATCH /api/v1/users/me/privacy` flips privacy flags; returns updated row, requires per-M3.6 §8 RBAC permission `privacy:update` which is `user+`.
- [M3.5 §5] `requireRoleForRole(targetRole, assignerRole)` enforces assigner ≥ target per M3.5 §4 — assert admin cannot assign superadmin and moderator cannot assign admin.
- [M3.5 §5] route-level AND vs OR guard composition (`requirePermission(x).or(requirePermission(y))`): assert OR passes with either; AND requires both.

**Tools.** Vitest, `node-mocks-http`, fixture factories from §4.

**Anti-patterns.** Do not fall back to `guest` on missing `role` claim — must throw. Do not skip branch coverage; `allow` without `DENY` proves nothing about the matrix. Do not test same-user IDOR implicitly; explicitly pass a different user's profile id.

## 9. Class 5 — Security Tests

**Scope.** M3.7 §2–§12 + §13 is the source of truth here; also M2.7 §6, §7; M3.4 §3 PKCE; M3.8 §22, §23.

**Strategy.** Slower tests that intentionally exercise hashing cost, lockout windows, CSP, and raw HTTP. Scheduled nightly plus PR trigger on ownership areas.

**Representative cases (15):**
- [M3.7 §2] PW-01..PW-07: boundary cases for each password rule, including bcrypt `$2b$12$` floor and blocklist of ≥ 10 000 entries.
- [M3.7 §3] PKCE: redirect URL contains `state`, `code_challenge`, `code_challenge_method=S256`; forged `redirect_uri` outside allowlist → 400.
- [M3.7 §4] CSRF: `x-csrf-token` header required on state-changing verbs; missing/mismatched → `CSRF_FAILED`; `Origin` outside allowlist → `BAD_ORIGIN`.
- [M3.7 §5] XSS: every API route returns `application/json` + `X-Content-Type-Options: nosniff`; static grep confirms no `dangerouslySetInnerHTML` in `./src`.
- [M3.7 §5] user-display fields rendered on profile must be HTML-escaped; integration injects `<script>alert(1)</script>` as a bio and asserts the response payload has no raw angle brackets.
- [M3.7 §6] rate-limit matrix: login 5/min/user, register 3/5min/IP, forgot-password 3/10min/IP, global 101/min/IP → all assert 429 + `Retry-After` + rate-limit headers per M3.8 §22.
- [M3.8 §22] rate-limit headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` are present and the `Remaining` value decrements on consecutive requests within the same window.
- [M3.7 §7] brute-force: 5 consecutive failures locks for 15 min; repeated lockouts apply exponential backoff; both `brute_force_lockouts` and audit row written.
- [M3.7 §8] cookie attributes: `__Host-`, `Secure`, `HttpOnly`, `SameSite=Lax`, no `Domain`.
- [M3.7 §10] strict-transport-security, referrer-policy (`strict-origin-when-cross-origin`), permissions-policy, x-frame-options present; CSP contains `script-src 'self'` and forbids `unsafe-inline` / `unsafe-eval`.
- [M3.7 §10] CSP Sources asserted via direct regex on the header string contain no `unsafe-inline` or `unsafe-eval` for every response on every public route.
- [M3.7 §11] `audit_events` rows carry `actor_id`, `action`, `target_id`, `ip_hash`, `created_at` per §11.3 — tests assert no `UPDATE`/`DELETE` grant for the application DB role.
- [M3.7 §9] no third-party cookies persist beyond OAuth callback.
- [M3.7 §11] `login_attempts`, `brute_force_lockouts`, `audit_events`, `user_sessions` rows prove correct writes and append-only audit role grants (no UPDATE/DELETE on `audit_events` for the application DB role).
- [M3.7 §11] `audit_events` carries `actor_id`, `action`, `target_id`, `ip_hash`, `created_at` per §11.3 — column presence and types asserted before any higher-level security test relies on them.
- [M3.7 §9] no `NEXT_PUBLIC_*` env var leaks into any response header or cookie — asserted by scanning `Set-Cookie` against the public-env allowlist before and after each OAuth flow.
- [M3.7 §10] every `api/v1/*` route returns `Permissions-Policy: camera=(), microphone=(), geolocation=()`; asserted on both preflight (`OPTIONS`) and the actual response.
- [M3.7 §7] brute-force counters reset on successful login from the same IP within the allowed window; verify both per-account and per-IP counters are independently cleared.
- [M2.7 §6] trust boundary: requests across `apps/web` → `packages/auth` boundary never leak internal error data to the response envelope — verify envelope shape per M3.8 §2.5 even on 500s.
- [M3.4 §3] OAuth-only account recovery path emits the status code and message per M3.4 §6; audit row type listed in M3.8 §21.
- [M3.8 §23] enforce exact security-header values on authenticated and unauthenticated landing-page responses.
- [M3.7 §13] pen-test lite: undici-driven requests with forged JWT (alg none, weak HMAC, other-tenant secret) and stolen JTI all return 401/403 and emit an audit row.
- [M3.7 §13] tampered JWT signature (flip one payload bit then re-base64url) must produce a `TOKEN_INVALID` and never a 500 — each provider-independent claim (`sub`, `role`, `jti`, `channel`, `exp`) is wiped one at a time to surface silent-default bugs.

**Tools.** Vitest, `testcontainers`, property-based `fast-check` (optional), custom undici harness.

**Anti-patterns.** Never sleep through lockout windows — fake timers. Never check lockout by message. Never rely on middleware-order assumptions; verify both `middleware.ts` and `next.config.ts`. Never embed production `AUTH_SECRET` in fixtures — bind via `vi.hoisted` test-only value.

## 10. Traceability Matrix

| Test class | M3.3 | M3.4 | M3.5 | M3.6 | M3.7 | API Spec |
|-----------|------|------|------|------|------|----------|
| Unit | §2, §3, §5, §6, §8, §9 | — | §2, §3 | §3, §7 | §2, §5.5, §9, §11 | — |
| Integration | §7, §8 | §3–§6 | — | §6 | §13.2, §11 | §1, §15–§19, §20–§23 |
| Authentication | §2–§7 | §2–§6, §5.5 | §4, §5 | §8 | §2, §3, §8 | — |
| Authorization | — | — | §2–§7 | §3, §7, §8 | — | §21 |
| Security | — | §3 | §2.2 | — | §2–§13, §5.3 | §22, §23 |

## 11. CI Pipeline & Coverage

| Stage | Trigger | Blocking |
|-------|---------|----------|
| `unit` | Push to PR on `packages/auth/**`, `packages/validation/**` | Yes |
| `integration` | Push to PR on `apps/web/app/api/v1/**/route.ts` | Yes |
| `auth-e2e` | Push touching `(auth)/**/*` and OAuth callbacks | Yes |
| `security` | Nightly + PR touch on `apps/web/middleware.ts`, `next.config.ts`, `packages/auth/**` | Nightly: soft-fail with security-lead alert |
| `release-gate` | On tagged RC (`v*`): Playwright-driven OWASP ASVS L1 manual checklist (smoke) | Yes |

Coverage targets: `packages/auth` ≥ 80% line / 75% branch; `packages/validation` ≥ 85% line; every route in M3.8 §15–§19 has at least one happy + error test. Flake policy: a test that fails twice on the same commit in unrelated CI runners is quarantined and filed; flake rate budget < 0.5% per sprint. Thresholds enforced via `pnpm vitest run --coverage --coverage.reporter=text --coverage.reporter=lcov --coverage.thresholds.statements=80 --coverage.thresholds.branches=75 --coverage.thresholds.functions=80`; txt summary published as CI artefact, lcov uploaded to Codecov.

## 12. How to run

```bash
pnpm install
pnpm -r build                                       # Turborepo first
pnpm --filter @nexus/auth test                    # class 1
pnpm --filter @nexus/auth test -- --coverage
pnpm --filter web test -- --testPathPattern=api   # class 2 + 3
pnpm --filter web test -- --testPathPattern=security # class 5
docker compose -f tooling/docker/docker-compose.yml up -d && \
  pnpm --filter web test -- --run                                 # nightly equivalent
```

Append `-- --watch` for local loops; `-- --reporter=junit --outputFile=reports/junit.xml` for CI artefacts. To run a single test file: `pnpm vitest run packages/auth/src/__tests__/guards.test.ts`. To update snapshots: `pnpm vitest run -u`. To scope by test name regex: `pnpm vitest run -t "rolling refresh"`. To run only class 5 without the rest of the suite: `pnpm vitest run --project security` (project configured in `apps/web/vitest.config.ts`).

**Troubleshooting.**
- `AUTH_SECRET` mismatch between local `.env.test` and CI → JWT verification fails with `INVALID_TOKEN` even on fresh logins; confirm both sides use the same 32-byte hex value per M3.3 Global Constraints.
- `testcontainers` fails to start in CI → runner must support Docker-in-Docker; the `unit` class never needs it, so CI can still gate on unit alone.
- `msw` handlers not intercepting → the OAuth callback URL must match the registered redirect URI exactly (`{BASE_URL}/api/auth/callback/{provider}`); mismatched path causes the request to hit the real network and fail.
- Flaky lockout / rate-limit tests → ensure `vi.useFakeTimers()` is active and no other test in the same file calls `vi.useRealTimers()` prematurely.
- Coverage report is empty → only classes 1, 2, 5 emit coverage by default (class 3 and 4 focus on flows not line coverage); run `pnpm vitest run --coverage --coverage.include='packages/auth/**'` to force the metric on `packages/auth/`.
- Auth flow tests fail with ` vi.useRealTimers()` already called → vitest isolates fake timers per file but a leaking real-timer call in shared setup will still pollute; isolate the test file and search for any top-level `useRealTimers`.
- `@testing-library/react` render warnings for `act()` → wrap state updates in `await act(async () => { ... })` per React 19 rules; the docs recommend fake timers over the deprecated `jest.useFakeTimers`.
- `pnpm -r build` required before tests → Turborepo cache misses when `dist/` is not present; `turbo build --filter=@nexus/auth` is the minimum viable command for class 1 + 4 only.

## 13. Out of Scope (post-MVP)

The following are explicitly deferred and may spawn a future M4.x spec or a follow-up M3.9 revision: Playwright-driven full E2E (referenced by M3.7 §13.3); property-based / fuzz testing for JWT and Zod schemas; OWASP ZAP automated DAST scans (quarterly); third-party penetration testing (referenced by M2.7 §14.3); and load testing of the auth path (M3.8 §22 defines the rate limits; load testing that exercises them is a separate discipline). Each item is tracked in the M3 backlog and revisited at M4 kickoff.

Environment variables for CI parity (`apps/web/.env.test`): `DATABASE_URL=postgres://test:test@localhost:5432/nexus_test`, `REDIS_URL=redis://localhost:6379/1`, `AUTH_SECRET=0123456789abcdef0123456789abcdef` (32 bytes hex per M3.3 Global Constraints), `AUTH_GOOGLE_ID=test-google-client`, `AUTH_GOOGLE_SECRET=test-google-secret`, `AUTH_DISCORD_ID=test-discord-client`, `AUTH_DISCORD_SECRET=test-discord-secret`. These are bound by the CI runner; local runs that skip OAuth flows work with only Postgres + Redis + `AUTH_SECRET`.

**CI runner notes.** The `unit` stage runs on every PR and does not require Docker; the `integration` and `security` stages require Docker-in-Docker (GitHub Actions `docker/setup-buildx-action` or GitLab `docker:dind`). When the runner lacks Docker, CI falls back to `unit` + `auth-e2e` only and posts a warning on the PR. The `release-gate` stage is manual (`workflow_dispatch`) and runs only on tags matching `v*`.

## Document History

| Timestamp | Author | Notes |
|-----------|--------|-------|
| 2026-06-25 | Hiroshi002 | Initial draft; covers M2.7 §3–7, M3.3 §2–§9, M3.4 §2–§6, M3.5 §2–§7, M3.6 §3–§8, M3.7 §2–§13, M3.8 §1, §15–§23 |
