# Nexus Anime — API Specification

> **Version:** v1.1.0
> **Status:** Authoritative Contract
> **Date:** 2026-06-25
> **Author:** Tech Lead
> **Milestone:** M3.8 (API Design — Auth, User, Profile, Session, Admin User modules)

> **Changelog:**
> - v1.1.0 (M3.8): Added §14 Resolved Decisions, §15 Auth API (expanded), §16 User API, §17 Profile API, §18 Session API, §19 Admin User API (expanded), §20 Error Code Registry (expanded), §21 Audit Event Triggers, §22 Rate Limit Matrix, §23 Security Headers & Cookie Policy. Extended Appendix A.
> - v1.0.0 (M2): Original specification.

---

## Table of Contents

1. [Conventions & Foundations](#1-conventions--foundations)
2. [Authentication](#2-authentication)
3. [Users](#3-users)
4. [Anime / Catalog](#4-anime--catalog)
5. [Episodes](#5-episodes)
6. [Search](#6-search)
7. [Watchlists](#7-watchlists)
8. [Favorites](#8-favorites)
9. [Reviews](#9-reviews)
10. [Comments](#10-comments)
11. [Admin](#11-admin)
12. [Webhooks](#12-webhooks)
13. [Appendices](#13-appendices)
14. [Resolved Decisions (M3.8)](#14-resolved-decisions-m38)
15. [Auth API (Expanded)](#15-auth-api-expanded)
16. [User API](#16-user-api)
17. [Profile API](#17-profile-api)
18. [Session API](#18-session-api)
19. [Admin User API (Expanded)](#19-admin-user-api-expanded)
20. [Error Code Registry (Expanded)](#20-error-code-registry-expanded)
21. [Audit Event Triggers](#21-audit-event-triggers)
22. [Rate Limit Matrix](#22-rate-limit-matrix)
23. [Security Headers & Cookie Policy](#23-security-headers--cookie-policy)

---

## 1. Conventions & Foundations

### 1.1 Base URL

| Environment | Base URL |
|-------------|----------|
| Production | `https://nexus-anime.com` |
| Staging | `https://staging.nexus-anime.com` |
| Development | `http://localhost:3000` |

All versioned endpoints are prefixed with `/api/v1/`. The current API version is `v1`.

### 1.2 Request/Response Envelope

Every response — success or error — wraps its payload in a standard envelope.

**Success Envelope:**

```json
{
  "data": {},
  "meta": {
    "requestId": "req_abc123def456",
    "version": "v1"
  }
}
```

**Error Envelope:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  },
  "meta": {
    "requestId": "req_abc123def456",
    "version": "v1"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data` | `T \| null` | Response payload (null on error) |
| `error` | `object \| null` | Error details (null on success) |
| `error.code` | `string` | Machine-readable error code |
| `error.message` | `string` | Human-readable error message |
| `error.details` | `array` | Field-level validation errors (may be empty) |
| `error.details[].field` | `string \| null` | Field path (null for general errors) |
| `error.details[].message` | `string` | Field-level error description |
| `meta.requestId` | `string` | Unique request identifier for tracing |
| `meta.version` | `string` | API version that produced the response |

### 1.3 Error Codes Reference

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `VALIDATION_ERROR` | 400 | Input failed Zod validation |
| `UNAUTHORIZED` | 401 | Missing or invalid session |
| `FORBIDDEN` | 403 | Valid session, insufficient permission |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | Duplicate resource |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server failure |

> **Expanded registry:** See [§20 Error Code Registry (Expanded)](#20-error-code-registry-expanded) for the complete list including M3.8 additions (`ACCOUNT_LOCKED`, `ACCOUNT_SUSPENDED`, `CANNOT_UNLINK`, `SET_PASSWORD_FIRST`, `OAUTH_ACCOUNT_NOT_LINKED`, `CONCURRENT_SESSION_LIMIT`, `TOKEN_EXPIRED`).

### 1.4 Pagination

The API supports both **cursor-based** and **offset-based** pagination. Cursor is the default and preferred method.

**Cursor-Based Pagination Request:**

```
GET /api/v1/titles?cursor=eyJpZCI6InV1aWQtMTIzIn0&limit=20
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `cursor` | `string` | No | — | Opaque cursor from previous response |
| `limit` | `integer` | No | 20 | Page size (1–100) |

**Cursor-Based Pagination Response:**

```json
{
  "data": [...],
  "meta": {
    "requestId": "req_abc123",
    "version": "v1"
  },
  "pagination": {
    "nextCursor": "eyJpZCI6InV1aWQtNDU2In0",
    "hasNextPage": true,
    "limit": 20
  }
}
```

**Offset-Based Pagination Request:**

```
GET /api/v1/titles?page=2&limit=20
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | `integer` | No | 1 | Page number (1-indexed) |
| `limit` | `integer` | No | 20 | Page size (1–100) |

**Offset-Based Pagination Response:**

```json
{
  "data": [...],
  "meta": {
    "requestId": "req_abc123",
    "version": "v1"
  },
  "pagination": {
    "currentPage": 2,
    "totalPages": 10,
    "totalItems": 200,
    "limit": 20,
    "hasNextPage": true
  }
}
```

### 1.5 Rate Limiting

All `/api/v1/*` endpoints are rate-limited. The per-endpoint rate limit matrix is defined in [§22 Rate Limit Matrix](#22-rate-limit-matrix). The default for unlisted endpoints is **100 requests per 15-minute window per IP**.

Rate limit headers are included in every response:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests per window |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |

When the limit is exceeded:

```json
// HTTP 429
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please retry after 899 seconds.",
    "details": []
  },
  "meta": { "requestId": "req_abc123", "version": "v1" }
}
```

### 1.6 Authentication

Authentication is session-based via **HTTP-only cookies** containing a JWT issued by Auth.js v5.

| Cookie | Attributes | Description |
|--------|-----------|-------------|
| `__Host-nexus-session` | `HttpOnly; Secure; SameSite=Lax; Path=/` | Session JWT |
| `__Host-nexus-remember` | `HttpOnly; Secure; SameSite=Lax; Path=/` | Remember Me token (365-day TTL) |

The session cookie is automatically sent by the browser. API clients must include `credentials: "same-origin"` (or `credentials: "include"` for cross-origin requests with CORS).

### 1.7 Route Protection Matrix

| Route Pattern | Guard | Failure Response |
|---------------|-------|-----------------|
| `/api/v1/*` | Rate limit (per §22) | 429 |
| `/api/v1/webhooks/*` | Stripe signature verification | 400 |
| `/api/v1/nexus/*` | `requireAuth()` — valid session required | 401 |
| `/api/v1/nexus/watch/*` | `requireSubscriber()` — active subscription required | 403 |
| `/api/v1/admin/*` | `requireRole('admin')` + API key | 403 |

### 1.8 Common Request Headers

| Header | Required | Description |
|---------|----------|-------------|
| `Content-Type` | Yes (for POST/PUT/PATCH) | `application/json` |
| `Accept` | No | `application/json` (default) |
| `X-API-Key` | Admin only | Admin API key for `/api/v1/admin/*` |
| `X-Request-Id` | No | Client-generated request ID for tracing |

### 1.9 HTTP Methods

| Method | Usage |
|--------|-------|
| `GET` | Read operations (list, detail, search) |
| `POST` | Create operations, webhook receivers |
| `PUT` | Full resource replacement |
| `PATCH` | Partial resource update |
| `DELETE` | Soft-delete or hard-delete |

### 1.10 Version Negotiation

The API version is determined by the URL prefix. Future versions will be available at `/api/v2/`, etc.

Optional header-based negotiation:

```
Accept: application/vnd.nexus.v2+json
```

If no version header is present, the server responds with the current active version (`v1`).

---

## 2. Authentication

All auth endpoints are handled by **Auth.js v5** via the central handler at `/api/auth/[...nextauth]`. Mutations that require authentication are also available as **Server Actions** for form-based interactions.

### 2.1 Login

Authenticate with email and password.

**Endpoint:** `POST /api/auth/callback/credentials`

**Server Action:** `actions/auth.ts` → `login()`

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "redirect": false,
  "remember": false
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | `string` | Yes | Valid email format (Zod: `z.string().email()`) |
| `password` | `string` | Yes | Min 8 characters (Zod: `z.string().min(8)`) |
| `redirect` | `boolean` | No | Default: `false` — return JSON instead of redirect |
| `remember` | `boolean` | No | Default: `false` — enables 365-day Remember Me cookie |

**Zod Schema:**

```typescript
const LoginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  redirect: z.boolean().default(false),
  remember: z.boolean().default(false),
});
```

**Success Response (200):**

```json
{
  "data": {
    "user": {
      "id": "uuid-123",
      "email": "user@example.com",
      "name": "AnimeFan",
      "image": null,
      "role": "user"
    },
    "sessionExpires": "2026-09-20T00:00:00.000Z"
  },
  "meta": { "requestId": "req_auth_001", "version": "v1" }
}
```

**Error Responses:**

```json
// 401 — Invalid credentials
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid email or password",
    "details": []
  },
  "meta": { "requestId": "req_auth_002", "version": "v1" }
}

// 423 — Account locked (brute force)
{
  "error": {
    "code": "ACCOUNT_LOCKED",
    "message": "Account temporarily locked due to too many failed login attempts. Try again in 15 minutes.",
    "details": []
  },
  "meta": { "requestId": "req_auth_lock", "version": "v1" }
}

// 423 — Account suspended
{
  "error": {
    "code": "ACCOUNT_SUSPENDED",
    "message": "This account has been suspended. Contact support.",
    "details": []
  },
  "meta": { "requestId": "req_auth_susp", "version": "v1" }
}
```

> **Rate limit:** 5 req / 5 min per IP + email. See [§22](#22-rate-limit-matrix).
> **Audit:** `login_success` on success; `login_failure` on bad credentials; `brute_force_lockout` on lockout.

### 2.2 Register

Create a new account.

**Endpoint:** `POST /api/auth/register` (Server Action)

**Server Action:** `actions/auth.ts` → `register()`

**Request Body:**

```json
{
  "email": "newuser@example.com",
  "password": "securePassword123",
  "name": "NewUser"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | `string` | Yes | Valid email, not already registered |
| `password` | `string` | Yes | Min 8 chars, at least 1 uppercase, 1 number, zxcvbn score ≥ 2 |
| `name` | `string` | Yes | 1–50 characters |

**Zod Schema:**

```typescript
const RegisterSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  name: z.string().min(1, "Name is required").max(50, "Name too long"),
});
```

> **Password strength:** Server validates with `@zxcvbn-ts/core`. Score ≤ 1 rejected; score 2 accepted with warning in `details`; score ≥ 3 accepted. Optionally checked against HIBP k-anomaly (800ms timeout, fallback to static blocklist).

**Success Response (201):**

```json
{
  "data": {
    "user": {
      "id": "uuid-456",
      "email": "newuser@example.com",
      "name": "NewUser",
      "image": null,
      "role": "user"
    },
    "message": "Account created. Please verify your email."
  },
  "meta": { "requestId": "req_auth_003", "version": "v1" }
}
```

**Error Responses:**

```json
// 409 — Email already registered
{
  "error": {
    "code": "CONFLICT",
    "message": "An account with this email already exists",
    "details": [{ "field": "email", "message": "Email is already in use" }]
  },
  "meta": { "requestId": "req_auth_004", "version": "v1" }
}
```

> **Rate limit:** 3 req / 5 min per IP.
> **Audit:** `registration_success` on success.

### 2.3 Logout

Destroy the current session.

**Endpoint:** `POST /api/auth/signout` (Server Action)

**Server Action:** `actions/auth.ts` → `logout()`

**Request (JSON body):**

```json
{
  "revokeAll": false
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `revokeAll` | `boolean` | No | Default: `false`. `true` revokes all sessions for the user (keeps current until response completes) |

> **Note:** When `revokeAll: true`, the server iterates `user_device_sessions` for the user, inserts all JTIs into `revoked_sessions`, and invalidates Redis revocation cache. The current session cookie is cleared immediately; other sessions fail on their next revocation check.

**Success Response (200):**

```json
{
  "data": {
    "message": "Successfully logged out"
  },
  "meta": { "requestId": "req_auth_005", "version": "v1" }
}
```

> **Audit:** `logout` on success.

### 2.4 Get Session

Retrieve the current authenticated session.

**Endpoint:** `GET /api/auth/session`

**Server Action:** `getSession()` from `@nexus/auth`

**Request:** No body required.

**Success Response (200) — Authenticated:**

```json
{
  "data": {
    "user": {
      "id": "uuid-123",
      "email": "user@example.com",
      "name": "AnimeFan",
      "image": "https://...",
      "role": "user"
    },
    "expires": "2026-09-20T00:00:00.000Z"
  },
  "meta": { "requestId": "req_auth_006", "version": "v1" }
}
```

**Success Response (200) — Unauthenticated:**

```json
{
  "data": null,
  "meta": { "requestId": "req_auth_007", "version": "v1" }
}
```

### 2.5 Google OAuth

Initiate or complete Google OAuth authentication flow.

**Step 1 — Initiate:**

**Endpoint:** `GET /api/auth/signin/google`

Redirects to Google's OAuth consent screen. On success, redirects to `/api/auth/callback/google`.

**Step 2 — Callback:**

**Endpoint:** `GET /api/auth/callback/google`

Handles the OAuth callback. Creates or links the user account. Sets the session cookie.

**Query Parameters (set by Google):**

| Parameter | Description |
|-----------|-------------|
| `code` | Authorization code |
| `state` | CSRF protection token |

**Success:** Redirects to `/nexus` (or the `callbackUrl` parameter).

**Error:** Redirects to `/login?error=...`

| Error Query | Meaning |
|-------------|---------|
| `OAuthAccountNotLinked` | Email exists with different provider |
| `OAuthCallbackError` | OAuth flow failed |
| `AccessDenied` | User denied consent |

> **Audit:** `oauth_signin` on success; `account_link` on link; `account_unlink` on unlink.

### 2.6 Discord OAuth

Same flow as Google. Provider-specific:

**Endpoints:** `GET /api/auth/signin/discord`, `GET /api/auth/callback/discord`

**Scopes:** `identify email`

> **Note:** Discord only reports `email_verified: true` if the user has verified in Discord settings. If `false`, the user must complete Nexus's own `verification_tokens` flow before gated features.

### 2.7 Password Reset

**Step 1 — Request Reset Token:**

**Endpoint:** `POST /api/auth/forgot-password` (Server Action)

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Zod Schema:**

```typescript
const ForgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
});
```

**Success Response (200):**

```json
{
  "data": {
    "message": "If an account with that email exists, a reset link has been sent."
  },
  "meta": { "requestId": "req_auth_008", "version": "v1" }
}
```

> **Note:** Always returns 200 to prevent email enumeration.

**Step 2 — Reset Password with Token:**

**Endpoint:** `POST /api/auth/reset-password` (Server Action)

**Request Body:**

```json
{
  "token": "reset-token-from-email",
  "password": "newSecurePassword123"
}
```

**Zod Schema:**

```typescript
const ResetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});
```

**Success Response (200):**

```json
{
  "data": {
    "message": "Password has been reset. Please log in with your new password."
  },
  "meta": { "requestId": "req_auth_009", "version": "v1" }
}
```

> **Side effect:** All existing sessions for the user are revoked (JTIs blacklisted) except the current session if the reset was initiated from one. Audit: `password_reset`.

### 2.8 Email Verification

**Endpoint:** `POST /api/auth/verify-email` (Server Action)

**Request Body:**

```json
{
  "token": "verification-token-from-email"
}
```

**Zod Schema:**

```typescript
const VerifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});
```

**Success Response (200):**

```json
{
  "data": {
    "message": "Email verified successfully."
  },
  "meta": { "requestId": "req_auth_010", "version": "v1" }
}
```

**Error Response (400):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid or expired verification token",
    "details": []
  },
  "meta": { "requestId": "req_auth_011", "version": "v1" }
}
```

**Resend Verification Email:**

**Endpoint:** `POST /api/auth/verify-email/resend` (Server Action)

**Guard:** `requireAuth()`

**Success Response (200):**

```json
{
  "data": {
    "message": "Verification email sent."
  },
  "meta": { "requestId": "req_auth_012", "version": "v1" }
}
```

> **Rate limit:** 3 req / 10 min per user.

### 2.9 Session Refresh (Manual)

> **Note:** Auth.js v5 automatically refreshes the JWT via the `jwt` callback when `exp - now < 7 days`. This endpoint is an **explicit** refresh trigger for clients that want to force a re-sign.

**Endpoint:** `POST /api/auth/refresh` (Server Action)

**Guard:** `requireAuth()`

**Request:** No body required.

**Success Response (200):**

```json
{
  "data": {
    "sessionExpires": "2026-09-20T00:00:00.000Z"
  },
  "meta": { "requestId": "req_auth_013", "version": "v1" }
}
```

> **Side effect:** Issues a new `Set-Cookie` header with the refreshed JWT. The old JTI is **not** blacklisted (rolling refresh, not rotation).

---

## 3. Users

All user endpoints require authentication (`requireAuth()`).

### 3.1 Get User Profile

Retrieve the authenticated user's profile.

**Endpoint:** `GET /api/v1/nexus/users/me`

**Request:** No parameters.

**Success Response (200):**

```json
{
  "data": {
    "id": "uuid-123",
    "email": "user@example.com",
    "name": "AnimeFan",
    "image": "https://...",
    "role": "user",
    "emailVerified": "2026-06-01T00:00:00.000Z",
    "profile": {
      "id": "uuid-profile-1",
      "bio": "Love isekai and mecha anime!",
      "avatarUrl": "https://...",
      "website": "https://myblog.com",
      "location": "Tokyo, Japan",
      "dateOfBirth": "1995-03-15",
      "socialLinks": {
        "twitter": "@animefan",
        "discord": "animefan#1234"
      }
    },
    "preferences": {
      "id": "uuid-pref-1",
      "playbackQuality": "auto",
      "subtitleLanguage": "en",
      "autoplay": true,
      "skipIntro": false,
      "theme": "dark",
      "language": "en",
      "privacySettings": {
        "profileVisibility": "public",
        "watchHistoryVisibility": "friends",
        "showOnlineStatus": true
      }
    },
    "subscription": {
      "id": "uuid-sub-1",
      "status": "active",
      "currentPeriodStart": "2026-06-01T00:00:00.000Z",
      "currentPeriodEnd": "2026-07-01T00:00:00.000Z",
      "cancelAtPeriodEnd": false
    },
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-06-20T00:00:00.000Z"
  },
  "meta": { "requestId": "req_user_001", "version": "v1" }
}
```

**TypeScript Types:**

```typescript
interface UserProfileResponse {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: "user" | "admin" | "superadmin";
  emailVerified: string | null;
  profile: {
    id: string;
    bio: string | null;
    avatarUrl: string | null;
    website: string | null;
    location: string | null;
    dateOfBirth: string | null;
    socialLinks: Record<string, string> | null;
  };
  preferences: {
    id: string;
    playbackQuality: string;
    subtitleLanguage: string | null;
    autoplay: boolean;
    skipIntro: boolean;
    theme: string;
    language: string;
    privacySettings: {
      profileVisibility: "public" | "friends" | "private";
      watchHistoryVisibility: "public" | "friends" | "private";
      showOnlineStatus: boolean;
    };
  };
  subscription: {
    id: string;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  createdAt: string;
  updatedAt: string;
}
```

### 3.2 Update User Profile

Update the authenticated user's profile information.

**Endpoint:** `PATCH /api/v1/nexus/users/me`

**Request Body:**

```json
{
  "name": "AnimeFanUpdated",
  "bio": "Updated bio — now into slice-of-life too!",
  "website": "https://newblog.com",
  "location": "Osaka, Japan",
  "dateOfBirth": "1995-03-15",
  "socialLinks": {
    "twitter": "@animefan_v2"
  }
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | `string` | No | 1–50 characters |
| `bio` | `string` | No | Max 500 characters, plain text only (no markdown/HTML — prevents XSS) |
| `website` | `string` | No | Valid URL, max 500 chars |
| `location` | `string` | No | Max 100 chars |
| `dateOfBirth` | `string` | No | ISO 8601 date, must be in past |
| `socialLinks` | `object` | No | Key-value pairs, max 10 keys, each value ≤ 200 chars |

**Zod Schema:**

```typescript
const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  website: z.string().url().max(500).optional(),
  location: z.string().max(100).optional(),
  dateOfBirth: z.string().date().optional(),
  socialLinks: z.record(z.string().max(200)).max(10).optional(),
});
```

**Success Response (200):**

```json
{
  "data": {
    "id": "uuid-123",
    "name": "AnimeFanUpdated",
    "profile": {
      "bio": "Updated bio — now into slice-of-life too!",
      "website": "https://newblog.com",
      "location": "Osaka, Japan"
    }
  },
  "meta": { "requestId": "req_user_002", "version": "v1" }
}
```

> **Audit:** `profile_updated`.

### 3.3 Update Preferences

Update the authenticated user's application preferences.

**Endpoint:** `PATCH /api/v1/nexus/users/me/preferences`

**Request Body:**

```json
{
  "playbackQuality": "1080p",
  "subtitleLanguage": "ja",
  "autoplay": true,
  "skipIntro": true,
  "theme": "light",
  "privacySettings": {
    "profileVisibility": "friends",
    "watchHistoryVisibility": "private",
    "showOnlineStatus": false
  }
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `playbackQuality` | `string` | No | `"auto"`, `"360p"`, `"480p"`, `"720p"`, `"1080p"` |
| `subtitleLanguage` | `string` | No | ISO 639-1 language code |
| `autoplay` | `boolean` | No | — |
| `skipIntro` | `boolean` | No | — |
| `theme` | `string` | No | `"dark"`, `"light"`, `"system"` |
| `language` | `string` | No | ISO 639-1 language code |
| `privacySettings.profileVisibility` | `string` | No | `"public"`, `"friends"`, `"private"` |
| `privacySettings.watchHistoryVisibility` | `string` | No | `"public"`, `"friends"`, `"private"` |
| `privacySettings.showOnlineStatus` | `boolean` | No | — |

**Zod Schema:**

```typescript
const UpdatePreferencesSchema = z.object({
  playbackQuality: z.enum(["auto", "360p", "480p", "720p", "1080p"]).optional(),
  subtitleLanguage: z.string().length(2).optional(),
  autoplay: z.boolean().optional(),
  skipIntro: z.boolean().optional(),
  theme: z.enum(["dark", "light", "system"]).optional(),
  language: z.string().length(2).optional(),
  privacySettings: z.object({
    profileVisibility: z.enum(["public", "friends", "private"]).optional(),
    watchHistoryVisibility: z.enum(["public", "friends", "private"]).optional(),
    showOnlineStatus: z.boolean().optional(),
  }).optional(),
});
```

**Success Response (200):**

```json
{
  "data": {
    "id": "uuid-pref-1",
    "playbackQuality": "1080p",
    "subtitleLanguage": "ja",
    "autoplay": true,
    "skipIntro": true,
    "theme": "light",
    "language": "en",
    "privacySettings": {
      "profileVisibility": "friends",
      "watchHistoryVisibility": "private",
      "showOnlineStatus": false
    }
  },
  "meta": { "requestId": "req_user_003", "version": "v1" }
}
```

### 3.4 Get Subscription

Retrieve the authenticated user's subscription details.

**Endpoint:** `GET /api/v1/nexus/users/me/subscription`

**Success Response (200) — Active:**

```json
{
  "data": {
    "id": "uuid-sub-1",
    "stripeCustomerId": "cus_xxx",
    "stripeSubscriptionId": "sub_xxx",
    "status": "active",
    "currentPeriodStart": "2026-06-01T00:00:00.000Z",
    "currentPeriodEnd": "2026-07-01T00:00:00.000Z",
    "cancelAtPeriodEnd": false,
    "plan": {
      "name": "Nexus Prime",
      "price": 7.99,
      "currency": "usd",
      "interval": "month"
    }
  },
  "meta": { "requestId": "req_user_004", "version": "v1" }
}
```

**Success Response (200) — No Subscription:**

```json
{
  "data": null,
  "meta": { "requestId": "req_user_005", "version": "v1" }
}
```

### 3.5 Delete Account

Permanently delete the authenticated user's account and all associated data (GDPR right to erasure).

**Endpoint:** `DELETE /api/v1/nexus/users/me`

**Request Body:**

```json
{
  "password": "securePassword123",
  "confirmation": "DELETE MY ACCOUNT"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `password` | `string` | Yes | Must match current password (OAuth-only users: see note) |
| `confirmation` | `string` | Yes | Must be exactly `"DELETE MY ACCOUNT"` |

> **OAuth-only users** without a password: the `password` field is replaced by a `providerReverification` object containing a freshly signed provider assertion token issued by `/api/auth/reverify/{provider}`. This ensures the user still controls the linked OAuth account before deletion.

**Zod Schema:**

```typescript
const DeleteAccountSchema = z.object({
  password: z.string().min(1).optional(),
  confirmation: z.literal("DELETE MY ACCOUNT"),
  providerReverification: z.object({
    provider: z.enum(["google", "discord"]),
    token: z.string().min(1),
  }).optional(),
}).refine((d) => d.password || d.providerReverification, {
  message: "Either password or providerReverification is required",
});
```

**Success Response (200):**

```json
{
  "data": {
    "message": "Account scheduled for permanent deletion. You have 30 days to cancel."
  },
  "meta": { "requestId": "req_user_006", "version": "v1" }
}
```

**Side effects:**
1. `users.deleted_at` set to now (soft delete).
2. All JTIs for user blacklisted in `revoked_sessions`.
3. All `user_device_sessions` rows deleted.
4. All `accounts` (OAuth) rows deleted.
5. Redis revocation cache invalidated for user.
6. `user_deleted` audit event emitted.
7. Vercel Cron job hard-deletes after 30 days (GDPR grace period).
8. Resend email to user confirming deletion with cancellation link.

**Error Response (401):**

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Password is incorrect",
    "details": []
  },
  "meta": { "requestId": "req_user_007", "version": "v1" }
}
```

**Error Response (403) — OAuth-only without reverify:**

```json
{
  "error": {
    "code": "SET_PASSWORD_FIRST",
    "message": "Please set a password or reverify your OAuth provider before deleting your account.",
    "details": []
  },
  "meta": { "requestId": "req_user_008", "version": "v1" }
}
```

> **Audit:** `user_deleted`.

---

## 4. Anime / Catalog

Public endpoints for browsing the anime catalog. No authentication required.

### 4.1 List Titles

Retrieve a paginated, filterable list of anime titles.

**Endpoint:** `GET /api/v1/titles`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `cursor` | `string` | No | — | Cursor for cursor-based pagination |
| `page` | `integer` | No | 1 | Page number for offset pagination |
| `limit` | `integer` | No | 20 | Page size (1–100) |
| `genre` | `string` | No | — | Filter by genre slug (e.g., `action`) |
| `status` | `string` | No | — | Filter by status: `airing`, `finished`, `upcoming` |
| `type` | `string` | No | — | Filter by type: `TV`, `OVA`, `ONA`, `Movie`, `Special` |
| `season` | `string` | No | — | Filter by season: `spring-2026`, `winter-2025`, etc. |
| `year` | `integer` | No | — | Filter by year |
| `sort` | `string` | No | `popularity` | Sort field: `popularity`, `score`, `newest`, `title` |
| `order` | `string` | No | `desc` | Sort order: `asc`, `desc` |

**Zod Schema:**

```typescript
const ListTitlesSchema = z.object({
  cursor: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  genre: z.string().optional(),
  status: z.enum(["airing", "finished", "upcoming"]).optional(),
  type: z.enum(["TV", "OVA", "ONA", "Movie", "Special"]).optional(),
  season: z.string().optional(),
  year: z.coerce.number().int().min(1917).max(2099).optional(),
  sort: z.enum(["popularity", "score", "newest", "title"]).default("popularity").optional(),
  order: z.enum(["asc", "desc"]).default("desc").optional(),
});
```

**Example Request:**

```
GET /api/v1/titles?genre=action&status=airing&sort=score&order=desc&limit=10
```

**Success Response (200):**

```json
{
  "data": [
    {
      "id": "uuid-anime-1",
      "slug": "attack-on-titan",
      "title": "Attack on Titan",
      "titleJp": "進撃の巨人",
      "coverImageUrl": "https://cdn.nexus-anime.com/covers/aot.jpg",
      "type": "TV",
      "status": "finished",
      "totalEpisodes": 87,
      "score": 9.1,
      "genres": [
        { "id": "uuid-genre-1", "slug": "action", "name": "Action" },
        { "id": "uuid-genre-2", "slug": "drama", "name": "Drama" }
      ],
      "studio": {
        "id": "uuid-studio-1",
        "slug": "wit-studio",
        "name": "WIT Studio"
      }
    }
  ],
  "meta": { "requestId": "req_titles_001", "version": "v1" },
  "pagination": {
    "nextCursor": "eyJzY29yZSI6OC41fQ",
    "hasNextPage": true,
    "limit": 10
  }
}
```

**TypeScript Types:**

```typescript
interface TitleSummary {
  id: string;
  slug: string;
  title: string;
  titleJp: string | null;
  coverImageUrl: string | null;
  type: "TV" | "OVA" | "ONA" | "Movie" | "Special" | null;
  status: "airing" | "finished" | "upcoming" | null;
  totalEpisodes: number | null;
  score: number | null;
  genres: GenreSummary[];
  studio: StudioSummary | null;
}

interface GenreSummary {
  id: string;
  slug: string;
  name: string;
}

interface StudioSummary {
  id: string;
  slug: string;
  name: string;
}
```

### 4.2 Get Title Detail

Retrieve full details for a single anime title by slug.

**Endpoint:** `GET /api/v1/titles/[slug]`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `slug` | `string` | Yes | URL-friendly title identifier |

**Example Request:**

```
GET /api/v1/titles/attack-on-titan
```

**Success Response (200):**

```json
{
  "data": {
    "id": "uuid-anime-1",
    "slug": "attack-on-titan",
    "title": "Attack on Titan",
    "titleJp": "進撃の巨人",
    "synopsis": "In a world where humanity lives within enormous walled cities...",
    "coverImageUrl": "https://cdn.nexus-anime.com/covers/aot.jpg",
    "bannerImageUrl": "https://cdn.nexus-anime.com/banners/aot.jpg",
    "type": "TV",
    "status": "finished",
    "totalEpisodes": 87,
    "durationMinutes": 24,
    "startDate": "2013-04-07",
    "endDate": "2023-11-04",
    "score": 9.1,
    "popularityRank": 1,
    "genres": [
      { "id": "uuid-genre-1", "slug": "action", "name": "Action" },
      { "id": "uuid-genre-2", "slug": "drama", "name": "Drama" },
      { "id": "uuid-genre-3", "slug": "fantasy", "name": "Fantasy" }
    ],
    "studio": {
      "id": "uuid-studio-1",
      "slug": "wit-studio",
      "name": "WIT Studio",
      "logoUrl": "https://cdn.nexus-anime.com/logos/wit.png"
    },
    "seasons": [
      {
        "id": "uuid-season-1",
        "seasonNumber": 1,
        "title": "Season 1",
        "episodeCount": 25
      },
      {
        "id": "uuid-season-2",
        "seasonNumber": 2,
        "title": "Season 2",
        "episodeCount": 12
      }
    ],
    "userInteraction": {
      "inWatchlist": true,
      "watchlistStatus": "watching",
      "isFavorited": true,
      "myRating": 9
    },
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-06-20T00:00:00.000Z"
  },
  "meta": { "requestId": "req_titles_002", "version": "v1" }
}
```

> **Note:** `userInteraction` is `null` for unauthenticated requests. When authenticated, it reflects the current user's relationship with the title.

**TypeScript Types:**

```typescript
interface TitleDetail extends TitleSummary {
  synopsis: string | null;
  bannerImageUrl: string | null;
  durationMinutes: number | null;
  startDate: string | null;
  endDate: string | null;
  popularityRank: number | null;
  seasons: SeasonSummary[];
  userInteraction: UserInteraction | null;
  createdAt: string;
  updatedAt: string;
}

interface SeasonSummary {
  id: string;
  seasonNumber: number;
  title: string | null;
  episodeCount: number;
}

interface UserInteraction {
  inWatchlist: boolean;
  watchlistStatus: "plan_to_watch" | "watching" | "completed" | "dropped" | "on_hold" | null;
  isFavorited: boolean;
  myRating: number | null;
}
```

**Error Response (404):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Title 'nonexistent-slug' not found",
    "details": []
  },
  "meta": { "requestId": "req_titles_003", "version": "v1" }
}
```

### 4.3 List Genres

Retrieve all available genres.

**Endpoint:** `GET /api/v1/genres`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `sort` | `string` | No | `name` | Sort field: `name`, `popularity` |
| `order` | `string` | No | `asc` | Sort order: `asc`, `desc` |

**Success Response (200):**

```json
{
  "data": [
    {
      "id": "uuid-genre-1",
      "slug": "action",
      "name": "Action",
      "description": "Fast-paced, high-energy sequences...",
      "iconUrl": "https://cdn.nexus-anime.com/icons/action.svg",
      "animeCount": 342
    },
    {
      "id": "uuid-genre-2",
      "slug": "adventure",
      "name": "Adventure",
      "description": "Journeys and exploration...",
      "iconUrl": null,
      "animeCount": 218
    }
  ],
  "meta": { "requestId": "req_genres_001", "version": "v1" }
}
```

**TypeScript Types:**

```typescript
interface GenreDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  animeCount: number;
}
```

### 4.4 List Studios

Retrieve all studios.

**Endpoint:** `GET /api/v1/studios`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `sort` | `string` | No | `name` | Sort field: `name` |
| `order` | `string` | No | `asc` | Sort order: `asc`, `desc` |

**Success Response (200):**

```json
{
  "data": [
    {
      "id": "uuid-studio-1",
      "slug": "wit-studio",
      "name": "WIT Studio",
      "description": "Founded in 2012 by former Gainax staff...",
      "logoUrl": "https://cdn.nexus-anime.com/logos/wit.png",
      "website": "https://witstudio.co.jp",
      "foundedDate": "2012-06-01",
      "animeCount": 28
    }
  ],
  "meta": { "requestId": "req_studios_001", "version": "v1" }
}
```

**TypeScript Types:**

```typescript
interface StudioDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  website: string | null;
  foundedDate: string | null;
  animeCount: number;
}
```

### 4.5 List Shelves

Retrieve all active content shelves.

**Endpoint:** `GET /api/v1/shelves`

**Success Response (200):**

```json
{
  "data": [
    {
      "id": "uuid-shelf-1",
      "key": "trending",
      "name": "Trending Now",
      "description": "Most popular titles this week",
      "iconUrl": null,
      "sortOrder": 1,
      "isActive": true
    },
    {
      "id": "uuid-shelf-2",
      "key": "new_releases",
      "name": "New Releases",
      "description": "Freshly added titles",
      "iconUrl": null,
      "sortOrder": 2,
      "isActive": true
    }
  ],
  "meta": { "requestId": "req_shelves_001", "version": "v1" }
}
```

**TypeScript Types:**

```typescript
interface ShelfSummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}
```

### 4.6 Get Shelf Detail

Retrieve a single shelf with its anime items.

**Endpoint:** `GET /api/v1/shelves/[key]`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | `string` | Yes | Shelf programmatic key (e.g., `trending`) |

**Success Response (200):**

```json
{
  "data": {
    "id": "uuid-shelf-1",
    "key": "trending",
    "name": "Trending Now",
    "description": "Most popular titles this week",
    "items": [
      {
        "id": "uuid-item-1",
        "position": 0,
        "anime": {
          "id": "uuid-anime-1",
          "slug": "attack-on-titan",
          "title": "Attack on Titan",
          "coverImageUrl": "https://cdn.nexus-anime.com/covers/aot.jpg",
          "score": 9.1
        }
      },
      {
        "id": "uuid-item-2",
        "position": 1,
        "anime": {
          "id": "uuid-anime-2",
          "slug": "jujutsu-kaisen",
          "title": "Jujutsu Kaisen",
          "coverImageUrl": "https://cdn.nexus-anime.com/covers/jjk.jpg",
          "score": 8.7
        }
      }
    ]
  },
  "meta": { "requestId": "req_shelves_002", "version": "v1" }
}
```

**TypeScript Types:**

```typescript
interface ShelfDetail extends ShelfSummary {
  items: ShelfItemDetail[];
}

interface ShelfItemDetail {
  id: string;
  position: number;
  anime: TitleSummary;
}
```

---

## 5. Episodes

Episode endpoints. Stream URL access requires an active subscription.

### 5.1 List Episodes by Anime

Retrieve all episodes for a given anime, organized by season.

**Endpoint:** `GET /api/v1/titles/[slug]/episodes`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `slug` | `string` | Yes | Anime slug |

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `season` | `integer` | No | — | Filter by season number |

**Example Request:**

```
GET /api/v1/titles/attack-on-titan/episodes?season=1
```

**Success Response (200):**

```json
{
  "data": [
    {
      "id": "uuid-ep-1",
      "seasonId": "uuid-season-1",
      "seasonNumber": 1,
      "episodeNumber": 1,
      "title": "To You, in 2000 Years: The Fall of Shiganshina, Part 1",
      "synopsis": "The year 845...",
      "durationSeconds": 1440,
      "airDate": "2013-04-07",
      "isFiller": false,
      "thumbnailUrl": "https://cdn.nexus-anime.com/thumbs/aot-s1e1.jpg"
    },
    {
      "id": "uuid-ep-2",
      "seasonId": "uuid-season-1",
      "seasonNumber": 1,
      "episodeNumber": 2,
      "title": "That Day: The Fall of Shiganshina, Part 2",
      "synopsis": "After the fall of Wall Maria...",
      "durationSeconds": 1440,
      "airDate": "2013-04-14",
      "isFiller": false,
      "thumbnailUrl": "https://cdn.nexus-anime.com/thumbs/aot-s1e2.jpg"
    }
  ],
  "meta": { "requestId": "req_ep_001", "version": "v1" }
}
```

**TypeScript Types:**

```typescript
interface EpisodeSummary {
  id: string;
  seasonId: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string | null;
  synopsis: string | null;
  durationSeconds: number | null;
  airDate: string | null;
  isFiller: boolean;
  thumbnailUrl: string | null;
}
```

### 5.2 Get Episode Detail

Retrieve full details for a single episode.

**Endpoint:** `GET /api/v1/titles/[slug]/episodes/[episodeNumber]`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `slug` | `string` | Yes | Anime slug |
| `episodeNumber` | `integer` | Yes | Episode number |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `season` | `integer` | No | Season number (required for multi-season titles) |

**Success Response (200):**

```json
{
  "data": {
    "id": "uuid-ep-1",
    "animeId": "uuid-anime-1",
    "animeSlug": "attack-on-titan",
    "animeTitle": "Attack on Titan",
    "seasonId": "uuid-season-1",
    "seasonNumber": 1,
    "seasonTitle": "Season 1",
    "episodeNumber": 1,
    "title": "To You, in 2000 Years: The Fall of Shiganshina, Part 1",
    "synopsis": "The year 845...",
    "durationSeconds": 1440,
    "airDate": "2013-04-07",
    "isFiller": false,
    "thumbnailUrl": "https://cdn.nexus-anime.com/thumbs/aot-s1e1.jpg",
    "watchProgress": {
      "positionSeconds": 720,
      "completionPct": 50.0,
      "watchedAt": "2026-06-15T10:30:00.000Z"
    }
  },
  "meta": { "requestId": "req_ep_002", "version": "v1" }
}
```

> **Note:** `watchProgress` is `null` for unauthenticated users.

**TypeScript Types:**

```typescript
interface EpisodeDetail extends EpisodeSummary {
  animeId: string;
  animeSlug: string;
  animeTitle: string;
  seasonTitle: string | null;
  watchProgress: WatchProgress | null;
}

interface WatchProgress {
  positionSeconds: number;
  completionPct: number;
  watchedAt: string;
}
```

### 5.3 Get Stream URL

Retrieve a signed HLS stream URL for an episode. **Requires active subscription.**

**Endpoint:** `GET /api/v1/nexus/watch/[slug]/episodes/[episodeNumber]/stream`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `slug` | `string` | Yes | Anime slug |
| `episodeNumber` | `integer` | Yes | Episode number |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `season` | `integer` | No | Season number |
| `quality` | `string` | No | Preferred quality: `auto`, `360p`, `480p`, `720p`, `1080p` |

**Guard:** `requireSubscriber()` — returns 403 if no active subscription.

**Success Response (200):**

```json
{
  "data": {
    "streamUrl": "https://cloudflare-stream.com/manifest/.../master.m3u8?token=...",
    "subtitleUrl": "https://cloudflare-stream.com/subtitles/.../subs.vtt",
    "expiresAt": "2026-06-23T12:00:00.000Z",
    "quality": "1080p",
    "resolution": "1920x1080",
    "codec": "h264"
  },
  "meta": { "requestId": "req_stream_001", "version": "v1" }
}
```

**Error Response (403):**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "An active Nexus Prime subscription is required to stream content",
    "details": []
  },
  "meta": { "requestId": "req_stream_002", "version": "v1" }
}
```

**TypeScript Types:**

```typescript
interface StreamResponse {
  streamUrl: string;
  subtitleUrl: string | null;
  expiresAt: string;
  quality: string;
  resolution: string | null;
  codec: string | null;
}
```

### 5.4 Update Watch Progress

Update the playback position for an episode. Creates or updates a watch history entry.

**Endpoint:** `POST /api/v1/nexus/watch/[slug]/episodes/[episodeNumber]/progress`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `slug` | `string` | Yes | Anime slug |
| `episodeNumber` | `integer` | Yes | Episode number |

**Request Body:**

```json
{
  "positionSeconds": 720,
  "durationSeconds": 1440
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `positionSeconds` | `integer` | Yes | >= 0 |
| `durationSeconds` | `integer` | Yes | >= 0 |

**Zod Schema:**

```typescript
const UpdateProgressSchema = z.object({
  positionSeconds: z.number().int().min(0),
  durationSeconds: z.number().int().min(0),
});
```

**Success Response (200):**

```json
{
  "data": {
    "positionSeconds": 720,
    "completionPct": 50.0,
    "watchedAt": "2026-06-23T10:30:00.000Z"
  },
  "meta": { "requestId": "req_progress_001", "version": "v1" }
}
```

---

## 6. Search

Full-text search powered by PostgreSQL `tsvector` with GIN index.

### 6.1 Search Titles

Full-text search across title, Japanese title, and synopsis.

**Endpoint:** `GET /api/v1/search`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | `string` | Yes | — | Search query (min 2 chars) |
| `genre` | `string` | No | — | Filter by genre slug |
| `status` | `string` | No | — | Filter by status |
| `type` | `string` | No | — | Filter by type |
| `year` | `integer` | No | — | Filter by year |
| `sort` | `string` | No | `relevance` | Sort: `relevance`, `score`, `newest` |
| `cursor` | `string` | No | — | Pagination cursor |
| `limit` | `integer` | No | 20 | Page size (1–100) |

**Zod Schema:**

```typescript
const SearchSchema = z.object({
  q: z.string().min(2, "Search query must be at least 2 characters").max(200),
  genre: z.string().optional(),
  status: z.enum(["airing", "finished", "upcoming"]).optional(),
  type: z.enum(["TV", "OVA", "ONA", "Movie", "Special"]).optional(),
  year: z.coerce.number().int().optional(),
  sort: z.enum(["relevance", "score", "newest"]).default("relevance").optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});
```

**Example Request:**

```
GET /api/v1/search?q=attack+titan&genre=action&sort=relevance
```

**Success Response (200):**

```json
{
  "data": [
    {
      "id": "uuid-anime-1",
      "slug": "attack-on-titan",
      "title": "Attack on Titan",
      "titleJp": "進撃の巨人",
      "coverImageUrl": "https://cdn.nexus-anime.com/covers/aot.jpg",
      "type": "TV",
      "status": "finished",
      "score": 9.1,
      "synopsis": "In a world where humanity lives...",
      "rank": 1,
      "highlight": {
        "title": ["<em>Attack</em> on <em>Titan</em>"],
        "synopsis": ["In a world where humanity lives within enormous walled cities..."]
      }
    }
  ],
  "meta": { "requestId": "req_search_001", "version": "v1" },
  "pagination": {
    "nextCursor": "eyJyYW5rIjowLjV9",
    "hasNextPage": true,
    "limit": 20
  }
}
```

**TypeScript Types:**

```typescript
interface SearchResult extends TitleSummary {
  synopsis: string | null;
  rank: number;
  highlight: {
    title: string[];
    synopsis: string[];
  };
}
```

### 6.2 Autocomplete Suggestions

Fast prefix-based suggestions for search-as-you-type.

**Endpoint:** `GET /api/v1/search/autocomplete`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | `string` | Yes | — | Partial query (min 1 char) |
| `limit` | `integer` | No | 8 | Max results (1–20) |

**Example Request:**

```
GET /api/v1/search/autocomplete?q=att&limit=5
```

**Success Response (200):**

```json
{
  "data": [
    {
      "slug": "attack-on-titan",
      "title": "Attack on Titan",
      "coverImageUrl": "https://cdn.nexus-anime.com/covers/aot.jpg",
      "type": "TV"
    },
    {
      "slug": "attack-on-titan-the-final-season",
      "title": "Attack on Titan: The Final Season",
      "coverImageUrl": "https://cdn.nexus-anime.com/covers/aot-final.jpg",
      "type": "TV"
    }
  ],
  "meta": { "requestId": "req_search_002", "version": "v1" }
}
```

**TypeScript Types:**

```typescript
interface AutocompleteResult {
  slug: string;
  title: string;
  coverImageUrl: string | null;
  type: string | null;
}
```

---

## 7. Watchlists

All watchlist endpoints require authentication (`requireAuth()`).

### 7.1 List Watchlist

Retrieve the authenticated user's watchlist.

**Endpoint:** `GET /api/v1/nexus/watchlists`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | `string` | No | — | Filter by status |
| `sort` | `string` | No | `updated` | Sort: `updated`, `added`, `title`, `priority` |
| `order` | `string` | No | `desc` | Sort order: `asc`, `desc` |
| `cursor` | `string` | No | — | Pagination cursor |
| `limit` | `integer` | No | 20 | Page size (1–100) |

**Zod Schema:**

```typescript
const ListWatchlistSchema = z.object({
  status: z.enum(["plan_to_watch", "watching", "completed", "dropped", "on_hold"]).optional(),
  sort: z.enum(["updated", "added", "title", "priority"]).default("updated").optional(),
  order: z.enum(["asc", "desc"]).default("desc").optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});
```

**Success Response (200):**

```json
{
  "data": [
    {
      "id": "uuid-wl-1",
      "status": "watching",
      "episodesWatched": 15,
      "priority": 1,
      "notes": "Peak fiction",
      "anime": {
        "id": "uuid-anime-1",
        "slug": "attack-on-titan",
        "title": "Attack on Titan",
        "coverImageUrl": "https://cdn.nexus-anime.com/covers/aot.jpg",
        "totalEpisodes": 87,
        "score": 9.1
      },
      "createdAt": "2026-01-15T00:00:00.000Z",
      "updatedAt": "2026-06-20T00:00:00.000Z"
    }
  ],
  "meta": { "requestId": "req_wl_001", "version": "v1" },
  "pagination": {
    "nextCursor": "eyJ1cGRhdGVkQXQiOiIyMDI2LTA2LTIwIn0",
    "hasNextPage": false,
    "limit": 20
  }
}
```

**TypeScript Types:**

```typescript
interface WatchlistItem {
  id: string;
  status: "plan_to_watch" | "watching" | "completed" | "dropped" | "on_hold";
  episodesWatched: number;
  priority: number;
  notes: string | null;
  anime: TitleSummary & { totalEpisodes: number | null };
  createdAt: string;
  updatedAt: string;
}
```

### 7.2 Add to Watchlist

Add an anime to the authenticated user's watchlist.

**Endpoint:** `POST /api/v1/nexus/watchlists`

**Request Body:**

```json
{
  "animeId": "uuid-anime-2",
  "status": "plan_to_watch",
  "priority": 0,
  "notes": "Heard great things about this one"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `animeId` | `string` (UUID) | Yes | Valid UUID |
| `status` | `string` | No | Default: `plan_to_watch` |
| `priority` | `integer` | No | Default: `0` |
| `notes` | `string` | No | Max 1000 characters |

**Zod Schema:**

```typescript
const AddToWatchlistSchema = z.object({
  animeId: z.string().uuid("Invalid anime ID"),
  status: z.enum(["plan_to_watch", "watching", "completed", "dropped", "on_hold"]).default("plan_to_watch"),
  priority: z.number().int().min(0).max(1).default(0),
  notes: z.string().max(1000).optional(),
});
```

**Success Response (201):**

```json
{
  "data": {
    "id": "uuid-wl-2",
    "status": "plan_to_watch",
    "episodesWatched": 0,
    "priority": 0,
    "notes": "Heard great things about this one",
    "anime": {
      "id": "uuid-anime-2",
      "slug": "jujutsu-kaisen",
      "title": "Jujutsu Kaisen",
      "coverImageUrl": "https://cdn.nexus-anime.com/covers/jjk.jpg"
    }
  },
  "meta": { "requestId": "req_wl_002", "version": "v1" }
}
```

**Error Response (409):**

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "This anime is already in your watchlist",
    "details": []
  },
  "meta": { "requestId": "req_wl_003", "version": "v1" }
}
```

### 7.3 Update Watchlist Status

Update the status or progress of a watchlist entry.

**Endpoint:** `PATCH /api/v1/nexus/watchlists/[animeId]`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `animeId` | `string` (UUID) | Yes | Anime ID |

**Request Body:**

```json
{
  "status": "watching",
  "episodesWatched": 5,
  "priority": 1,
  "notes": "Getting good!"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `status` | `string` | No | One of the watchlist statuses |
| `episodesWatched` | `integer` | No | >= 0 |
| `priority` | `integer` | No | 0 or 1 |
| `notes` | `string` | No | Max 1000 characters |

**Zod Schema:**

```typescript
const UpdateWatchlistSchema = z.object({
  status: z.enum(["plan_to_watch", "watching", "completed", "dropped", "on_hold"]).optional(),
  episodesWatched: z.number().int().min(0).optional(),
  priority: z.number().int().min(0).max(1).optional(),
  notes: z.string().max(1000).optional(),
});
```

**Success Response (200):**

```json
{
  "data": {
    "id": "uuid-wl-1",
    "status": "watching",
    "episodesWatched": 5,
    "priority": 1,
    "notes": "Getting good!"
  },
  "meta": { "requestId": "req_wl_004", "version": "v1" }
}
```

### 7.4 Remove from Watchlist

Remove an anime from the authenticated user's watchlist.

**Endpoint:** `DELETE /api/v1/nexus/watchlists/[animeId]`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `animeId` | `string` (UUID) | Yes | Anime ID |

**Success Response (200):**

```json
{
  "data": {
    "message": "Removed from watchlist"
  },
  "meta": { "requestId": "req_wl_005", "version": "v1" }
}
```

---

## 8. Favorites

All favorite endpoints require authentication (`requireAuth()`).

### 8.1 List Favorites

Retrieve the authenticated user's favorite anime.

**Endpoint:** `GET /api/v1/nexus/favorites`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `sort` | `string` | No | `added` | Sort: `added`, `title`, `score` |
| `order` | `string` | No | `desc` | Sort order: `asc`, `desc` |
| `cursor` | `string` | No | — | Pagination cursor |
| `limit` | `integer` | No | 20 | Page size (1–100) |

**Success Response (200):**

```json
{
  "data": [
    {
      "id": "uuid-fav-1",
      "anime": {
        "id": "uuid-anime-1",
        "slug": "attack-on-titan",
        "title": "Attack on Titan",
        "coverImageUrl": "https://cdn.nexus-anime.com/covers/aot.jpg",
        "score": 9.1
      },
      "createdAt": "2026-01-15T00:00:00.000Z"
    }
  ],
  "meta": { "requestId": "req_fav_001", "version": "v1" },
  "pagination": {
    "nextCursor": null,
    "hasNextPage": false,
    "limit": 20
  }
}
```

**TypeScript Types:**

```typescript
interface FavoriteItem {
  id: string;
  anime: TitleSummary;
  createdAt: string;
}
```

### 8.2 Add Favorite

Add an anime to the authenticated user's favorites.

**Endpoint:** `POST /api/v1/nexus/favorites`

**Request Body:**

```json
{
  "animeId": "uuid-anime-2"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `animeId` | `string` (UUID) | Yes | Valid UUID |

**Zod Schema:**

```typescript
const AddFavoriteSchema = z.object({
  animeId: z.string().uuid("Invalid anime ID"),
});
```

**Success Response (201):**

```json
{
  "data": {
    "id": "uuid-fav-2",
    "anime": {
      "id": "uuid-anime-2",
      "slug": "jujutsu-kaisen",
      "title": "Jujutsu Kaisen"
    }
  },
  "meta": { "requestId": "req_fav_002", "version": "v1" }
}
```

**Error Response (409):**

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "This anime is already in your favorites",
    "details": []
  },
  "meta": { "requestId": "req_fav_003", "version": "v1" }
}
```

### 8.3 Remove Favorite

Remove an anime from the authenticated user's favorites.

**Endpoint:** `DELETE /api/v1/nexus/favorites/[animeId]`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `animeId` | `string` (UUID) | Yes | Anime ID |

**Success Response (200):**

```json
{
  "data": {
    "message": "Removed from favorites"
  },
  "meta": { "requestId": "req_fav_004", "version": "v1" }
}
```

---

## 9. Reviews

Reviews can be read by anyone. Creating, updating, and deleting requires authentication.

### 9.1 List Reviews

Retrieve reviews for a specific anime or globally.

**Endpoint:** `GET /api/v1/reviews`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `animeId` | `string` (UUID) | No | — | Filter by anime |
| `userId` | `string` (UUID) | No | — | Filter by user |
| `sort` | `string` | No | `newest` | Sort: `newest`, `helpful` |
| `cursor` | `string` | No | — | Pagination cursor |
| `limit` | `integer` | No | 20 | Page size (1–100) |

**Success Response (200):**

```json
{
  "data": [
    {
      "id": "uuid-review-1",
      "title": "A Masterpiece of Storytelling",
      "body": "Attack on Titan redefined what anime can achieve...",
      "isSpoiler": false,
      "helpfulCount": 142,
      "status": "published",
      "user": {
        "id": "uuid-user-1",
        "name": "AnimeFan",
        "image": "https://..."
      },
      "anime": {
        "id": "uuid-anime-1",
        "slug": "attack-on-titan",
        "title": "Attack on Titan"
      },
      "createdAt": "2026-03-15T00:00:00.000Z",
      "updatedAt": "2026-03-15T00:00:00.000Z"
    }
  ],
  "meta": { "requestId": "req_review_001", "version": "v1" },
  "pagination": {
    "nextCursor": "eyJjcmVhdGVkQXQiOiIyMDI2LTAzLTE1In0",
    "hasNextPage": true,
    "limit": 20
  }
}
```

**TypeScript Types:**

```typescript
interface ReviewSummary {
  id: string;
  title: string | null;
  body: string;
  isSpoiler: boolean;
  helpfulCount: number;
  status: "published" | "draft" | "hidden";
  user: {
    id: string;
    name: string;
    image: string | null;
  };
  anime: {
    id: string;
    slug: string;
    title: string;
  };
  createdAt: string;
  updatedAt: string;
}
```

### 9.2 Create Review

Create a new review for an anime. Requires authentication.

**Endpoint:** `POST /api/v1/nexus/reviews`

**Request Body:**

```json
{
  "animeId": "uuid-anime-1",
  "title": "A Masterpiece of Storytelling",
  "body": "Attack on Titan redefined what anime can achieve. The plot twists are unpredictable...",
  "isSpoiler": false
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `animeId` | `string` (UUID) | Yes | Valid UUID, anime must exist |
| `title` | `string` | No | Max 500 characters |
| `body` | `string` | Yes | Min 50 characters, max 10000 |
| `isSpoiler` | `boolean` | No | Default: `false` |

**Zod Schema:**

```typescript
const CreateReviewSchema = z.object({
  animeId: z.string().uuid("Invalid anime ID"),
  title: z.string().max(500).optional(),
  body: z
    .string()
    .min(50, "Review must be at least 50 characters")
    .max(10000, "Review must be at most 10000 characters"),
  isSpoiler: z.boolean().default(false),
});
```

**Success Response (201):**

```json
{
  "data": {
    "id": "uuid-review-1",
    "title": "A Masterpiece of Storytelling",
    "body": "Attack on Titan redefined what anime can achieve...",
    "isSpoiler": false,
    "helpfulCount": 0,
    "status": "published",
    "user": {
      "id": "uuid-user-1",
      "name": "AnimeFan"
    },
    "anime": {
      "id": "uuid-anime-1",
      "slug": "attack-on-titan",
      "title": "Attack on Titan"
    },
    "createdAt": "2026-06-23T10:00:00.000Z",
    "updatedAt": "2026-06-23T10:00:00.000Z"
  },
  "meta": { "requestId": "req_review_002", "version": "v1" }
}
```

**Error Response (409):**

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "You have already reviewed this anime",
    "details": []
  },
  "meta": { "requestId": "req_review_003", "version": "v1" }
}
```

### 9.3 Update Review

Update an existing review. Only the author may update.

**Endpoint:** `PATCH /api/v1/nexus/reviews/[reviewId]`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `reviewId` | `string` (UUID) | Yes | Review ID |

**Request Body:**

```json
{
  "title": "Updated: Still a Masterpiece",
  "body": "After rewatching, my opinion has only strengthened...",
  "isSpoiler": true
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | `string` | No | Max 500 characters |
| `body` | `string` | No | Min 50, max 10000 characters |
| `isSpoiler` | `boolean` | No | — |

**Zod Schema:**

```typescript
const UpdateReviewSchema = z.object({
  title: z.string().max(500).optional(),
  body: z.string().min(50).max(10000).optional(),
  isSpoiler: z.boolean().optional(),
});
```

**Success Response (200):**

```json
{
  "data": {
    "id": "uuid-review-1",
    "title": "Updated: Still a Masterpiece",
    "body": "After rewatching, my opinion has only strengthened...",
    "isSpoiler": true,
    "updatedAt": "2026-06-23T11:00:00.000Z"
  },
  "meta": { "requestId": "req_review_004", "version": "v1" }
}
```

### 9.4 Delete Review

Delete a review. Only the author (or admin) may delete.

**Endpoint:** `DELETE /api/v1/nexus/reviews/[reviewId]`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `reviewId` | `string` (UUID) | Yes | Review ID |

**Success Response (200):**

```json
{
  "data": {
    "message": "Review deleted"
  },
  "meta": { "requestId": "req_review_005", "version": "v1" }
}
```

### 9.5 Rate Review Helpful

Toggle a "helpful" vote on a review.

**Endpoint:** `POST /api/v1/nexus/reviews/[reviewId]/helpful`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `reviewId` | `string` (UUID) | Yes | Review ID |

**Request Body:**

```json
{
  "helpful": true
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `helpful` | `boolean` | Yes | `true` to add vote, `false` to remove |

**Zod Schema:**

```typescript
const RateHelpfulSchema = z.object({
  helpful: z.boolean(),
});
```

**Success Response (200):**

```json
{
  "data": {
    "helpfulCount": 143,
    "userVoted": true
  },
  "meta": { "requestId": "req_review_006", "version": "v1" }
}
```

---

## 10. Comments

Comments are threaded responses to reviews. All comment mutations require authentication.

### 10.1 List Comments

Retrieve comments for a specific review.

**Endpoint:** `GET /api/v1/reviews/[reviewId]/comments`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `reviewId` | `string` (UUID) | Yes | Review ID |

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `sort` | `string` | No | `newest` | Sort: `newest`, `oldest`, `likes` |
| `cursor` | `string` | No | — | Pagination cursor |
| `limit` | `integer` | No | 20 | Page size (1–100) |

**Success Response (200):**

```json
{
  "data": [
    {
      "id": "uuid-comment-1",
      "body": "Totally agree! The animation quality is unmatched.",
      "likesCount": 15,
      "user": {
        "id": "uuid-user-2",
        "name": "ReviewReader",
        "image": "https://..."
      },
      "parentCommentId": null,
      "replies": [
        {
          "id": "uuid-comment-2",
          "body": "Especially the ODM gear scenes!",
          "likesCount": 5,
          "user": {
            "id": "uuid-user-3",
            "name": "ActionFan",
            "image": null
          },
          "parentCommentId": "uuid-comment-1",
          "replies": []
        }
      ],
      "createdAt": "2026-03-16T00:00:00.000Z",
      "updatedAt": "2026-03-16T00:00:00.000Z"
    }
  ],
  "meta": { "requestId": "req_comment_001", "version": "v1" },
  "pagination": {
    "nextCursor": null,
    "hasNextPage": false,
    "limit": 20
  }
}
```

**TypeScript Types:**

```typescript
interface CommentDetail {
  id: string;
  body: string;
  likesCount: number;
  user: {
    id: string;
    name: string;
    image: string | null;
  };
  parentCommentId: string | null;
  replies: CommentDetail[];
  createdAt: string;
  updatedAt: string;
}
```

### 10.2 Create Comment

Create a new comment on a review. Supports nested replies.

**Endpoint:** `POST /api/v1/nexus/reviews/[reviewId]/comments`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `reviewId` | `string` (UUID) | Yes | Review ID |

**Request Body:**

```json
{
  "body": "Totally agree! The animation quality is unmatched.",
  "parentCommentId": null
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `body` | `string` | Yes | Min 1, max 2000 characters |
| `parentCommentId` | `string` (UUID) | No | Must be a comment on the same review |

**Zod Schema:**

```typescript
const CreateCommentSchema = z.object({
  body: z.string().min(1, "Comment cannot be empty").max(2000, "Comment too long"),
  parentCommentId: z.string().uuid().optional(),
});
```

**Success Response (201):**

```json
{
  "data": {
    "id": "uuid-comment-1",
    "body": "Totally agree! The animation quality is unmatched.",
    "likesCount": 0,
    "user": {
      "id": "uuid-user-1",
      "name": "AnimeFan"
    },
    "parentCommentId": null,
    "createdAt": "2026-06-23T12:00:00.000Z",
    "updatedAt": "2026-06-23T12:00:00.000Z"
  },
  "meta": { "requestId": "req_comment_002", "version": "v1" }
}
```

### 10.3 Update Comment

Update a comment. Only the author may update.

**Endpoint:** `PATCH /api/v1/nexus/comments/[commentId]`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `commentId` | `string` (UUID) | Yes | Comment ID |

**Request Body:**

```json
{
  "body": "Updated: Totally agree! The animation is even better on rewatch."
}
```

**Zod Schema:**

```typescript
const UpdateCommentSchema = z.object({
  body: z.string().min(1).max(2000),
});
```

**Success Response (200):**

```json
{
  "data": {
    "id": "uuid-comment-1",
    "body": "Updated: Totally agree! The animation is even better on rewatch.",
    "updatedAt": "2026-06-23T12:30:00.000Z"
  },
  "meta": { "requestId": "req_comment_003", "version": "v1" }
}
```

### 10.4 Delete Comment

Delete a comment. Only the author (or admin) may delete.

**Endpoint:** `DELETE /api/v1/nexus/comments/[commentId]`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `commentId` | `string` (UUID) | Yes | Comment ID |

**Success Response (200):**

```json
{
  "data": {
    "message": "Comment deleted"
  },
  "meta": { "requestId": "req_comment_004", "version": "v1" }
}
```

### 10.5 Like Comment

Toggle a like on a comment.

**Endpoint:** `POST /api/v1/nexus/comments/[commentId]/like`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `commentId` | `string` (UUID) | Yes | Comment ID |

**Request Body:**

```json
{
  "liked": true
}
```

**Zod Schema:**

```typescript
const LikeCommentSchema = z.object({
  liked: z.boolean(),
});
```

**Success Response (200):**

```json
{
  "data": {
    "likesCount": 16,
    "userLiked": true
  },
  "meta": { "requestId": "req_comment_005", "version": "v1" }
}
```

---

## 11. Admin

All admin endpoints require `requireRole('admin')` + `X-API-Key` header. These endpoints power the CMS and content management system.

### 11.1 Dashboard Stats

Retrieve platform-wide statistics.

**Endpoint:** `GET /api/v1/admin/dashboard`

**Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| `X-API-Key` | Yes | Admin API key |

**Success Response (200):**

```json
{
  "data": {
    "users": {
      "total": 1250,
      "active": 980,
      "newThisWeek": 45,
      "growthRate": 3.7
    },
    "subscriptions": {
      "active": 820,
      "trialing": 35,
      "canceled": 120,
      "churnRate": 2.1,
      "mrr": 6551.80
    },
    "content": {
      "totalTitles": 75,
      "totalEpisodes": 420,
      "totalSeasons": 95
    },
    "engagement": {
      "totalWatchlistItems": 3450,
      "totalReviews": 230,
      "totalComments": 890,
      "avgWatchTimeMinutes": 42
    },
    "popularTitles": [
      {
        "slug": "attack-on-titan",
        "title": "Attack on Titan",
        "watchlistCount": 890
      }
    ]
  },
  "meta": { "requestId": "req_admin_001", "version": "v1" }
}
```

**TypeScript Types:**

```typescript
interface DashboardStats {
  users: {
    total: number;
    active: number;
    newThisWeek: number;
    growthRate: number;
  };
  subscriptions: {
    active: number;
    trialing: number;
    canceled: number;
    churnRate: number;
    mrr: number;
  };
  content: {
    totalTitles: number;
    totalEpisodes: number;
    totalSeasons: number;
  };
  engagement: {
    totalWatchlistItems: number;
    totalReviews: number;
    totalComments: number;
    avgWatchTimeMinutes: number;
  };
  popularTitles: {
    slug: string;
    title: string;
    watchlistCount: number;
  }[];
}
```

### 11.2 Admin — Titles CRUD

#### 11.2.1 Create Title

**Endpoint:** `POST /api/v1/admin/titles`

**Request Body:**

```json
{
  "title": "Chainsaw Man",
  "titleJp": "チェンソーマン",
  "slug": "chainsaw-man",
  "synopsis": "Denji is a teenage boy living with a Chainsaw Devil named Pochita...",
  "coverImageUrl": "https://cdn.nexus-anime.com/covers/csm.jpg",
  "bannerImageUrl": "https://cdn.nexus-anime.com/banners/csm.jpg",
  "type": "TV",
  "status": "airing",
  "totalEpisodes": 12,
  "durationMinutes": 24,
  "startDate": "2022-10-12",
  "studioId": "uuid-studio-mappa",
  "genreIds": ["uuid-genre-action", "uuid-genre-horror"]
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | `string` | Yes | 1–500 characters |
| `slug` | `string` | Yes | Unique, URL-safe |
| `titleJp` | `string` | No | Max 500 characters |
| `synopsis` | `string` | No | Max 5000 characters |
| `coverImageUrl` | `string` | No | Valid URL |
| `bannerImageUrl` | `string` | No | Valid URL |
| `type` | `string` | No | One of `TV`, `OVA`, `ONA`, `Movie`, `Special` |
| `status` | `string` | No | One of `airing`, `finished`, `upcoming` |
| `totalEpisodes` | `integer` | No | >= 0 |
| `durationMinutes` | `integer` | No | > 0 |
| `startDate` | `string` | No | ISO 8601 date |
| `endDate` | `string` | No | ISO 8601 date |
| `studioId` | `string` (UUID) | No | Valid studio ID |
| `genreIds` | `string[]` | No | Array of genre UUIDs |

**Zod Schema:**

```typescript
const CreateTitleSchema = z.object({
  title: z.string().min(1).max(500),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/, "Slug must be URL-safe"),
  titleJp: z.string().max(500).optional(),
  synopsis: z.string().max(5000).optional(),
  coverImageUrl: z.string().url().optional(),
  bannerImageUrl: z.string().url().optional(),
  type: z.enum(["TV", "OVA", "ONA", "Movie", "Special"]).optional(),
  status: z.enum(["airing", "finished", "upcoming"]).optional(),
  totalEpisodes: z.number().int().min(0).optional(),
  durationMinutes: z.number().int().min(1).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  studioId: z.string().uuid().optional(),
  genreIds: z.array(z.string().uuid()).optional(),
});
```

**Success Response (201):**

```json
{
  "data": {
    "id": "uuid-anime-new",
    "slug": "chainsaw-man",
    "title": "Chainsaw Man",
    "type": "TV",
    "status": "airing",
    "genres": [
      { "id": "uuid-genre-action", "slug": "action", "name": "Action" },
      { "id": "uuid-genre-horror", "slug": "horror", "name": "Horror" }
    ],
    "studio": {
      "id": "uuid-studio-mappa",
      "slug": "mappa",
      "name": "MAPPA"
    },
    "createdAt": "2026-06-23T14:00:00.000Z"
  },
  "meta": { "requestId": "req_admin_002", "version": "v1" }
}
```

#### 11.2.2 Update Title

**Endpoint:** `PATCH /api/v1/admin/titles/[animeId]`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `animeId` | `string` (UUID) | Yes | Anime ID |

**Request Body:** Same fields as Create Title, all optional.

**Zod Schema:**

```typescript
const UpdateTitleSchema = CreateTitleSchema.partial();
```

**Success Response (200):**

```json
{
  "data": {
    "id": "uuid-anime-new",
    "slug": "chainsaw-man",
    "title": "Chainsaw Man",
    "status": "finished",
    "updatedAt": "2026-06-23T14:30:00.000Z"
  },
  "meta": { "requestId": "req_admin_003", "version": "v1" }
}
```

#### 11.2.3 Delete Title

**Endpoint:** `DELETE /api/v1/admin/titles/[animeId]`

Performs a soft delete (sets `deleted_at`).

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `animeId` | `string` (UUID) | Yes | Anime ID |

**Success Response (200):**

```json
{
  "data": {
    "message": "Title deleted (soft)"
  },
  "meta": { "requestId": "req_admin_004", "version": "v1" }
}
```

### 11.3 Admin — Seasons CRUD

#### 11.3.1 Create Season

**Endpoint:** `POST /api/v1/admin/titles/[animeId]/seasons`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `animeId` | `string` (UUID) | Yes | Anime ID |

**Request Body:**

```json
{
  "seasonNumber": 1,
  "title": "Season 1",
  "synopsis": "The beginning of Denji's journey...",
  "startDate": "2022-10-12",
  "endDate": "2022-12-28"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `seasonNumber` | `integer` | Yes | >= 1, unique per anime |
| `title` | `string` | No | Max 500 characters |
| `synopsis` | `string` | No | Max 5000 characters |
| `startDate` | `string` | No | ISO 8601 date |
| `endDate` | `string` | No | ISO 8601 date |

**Zod Schema:**

```typescript
const CreateSeasonSchema = z.object({
  seasonNumber: z.number().int().min(1),
  title: z.string().max(500).optional(),
  synopsis: z.string().max(5000).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
});
```

**Success Response (201):**

```json
{
  "data": {
    "id": "uuid-season-new",
    "animeId": "uuid-anime-new",
    "seasonNumber": 1,
    "title": "Season 1",
    "createdAt": "2026-06-23T14:05:00.000Z"
  },
  "meta": { "requestId": "req_admin_005", "version": "v1" }
}
```

#### 11.3.2 Update Season

**Endpoint:** `PATCH /api/v1/admin/seasons/[seasonId]`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `seasonId` | `string` (UUID) | Yes | Season ID |

**Request Body:** Same fields as Create Season, all optional.

**Zod Schema:**

```typescript
const UpdateSeasonSchema = CreateSeasonSchema.partial();
```

**Success Response (200):**

```json
{
  "data": {
    "id": "uuid-season-new",
    "title": "Season 1 (Updated)",
    "updatedAt": "2026-06-23T14:10:00.000Z"
  },
  "meta": { "requestId": "req_admin_006", "version": "v1" }
}
```

#### 11.3.3 Delete Season

**Endpoint:** `DELETE /api/v1/admin/seasons/[seasonId]`

Performs a soft delete.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `seasonId` | `string` (UUID) | Yes | Season ID |

**Success Response (200):**

```json
{
  "data": {
    "message": "Season deleted (soft)"
  },
  "meta": { "requestId": "req_admin_007", "version": "v1" }
}
```

### 11.4 Admin — Episodes CRUD

#### 11.4.1 Create Episode

**Endpoint:** `POST /api/v1/admin/seasons/[seasonId]/episodes`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `seasonId` | `string` (UUID) | Yes | Season ID |

**Request Body:**

```json
{
  "episodeNumber": 1,
  "title": "Dog & Chainsaw",
  "synopsis": "Denji lives a poor life with his devil pet Pochita...",
  "durationSeconds": 1440,
  "airDate": "2022-10-12",
  "isFiller": false,
  "thumbnailUrl": "https://cdn.nexus-anime.com/thumbs/csm-s1e1.jpg"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `episodeNumber` | `integer` | Yes | >= 0, unique per season |
| `title` | `string` | No | Max 500 characters |
| `synopsis` | `string` | No | Max 5000 characters |
| `durationSeconds` | `integer` | No | > 0 |
| `airDate` | `string` | No | ISO 8601 date |
| `isFiller` | `boolean` | No | Default: `false` |
| `thumbnailUrl` | `string` | No | Valid URL |

**Zod Schema:**

```typescript
const CreateEpisodeSchema = z.object({
  episodeNumber: z.number().int().min(0),
  title: z.string().max(500).optional(),
  synopsis: z.string().max(5000).optional(),
  durationSeconds: z.number().int().min(1).optional(),
  airDate: z.string().date().optional(),
  isFiller: z.boolean().default(false),
  thumbnailUrl: z.string().url().optional(),
});
```

**Success Response (201):**

```json
{
  "data": {
    "id": "uuid-ep-new",
    "seasonId": "uuid-season-new",
    "episodeNumber": 1,
    "title": "Dog & Chainsaw",
    "createdAt": "2026-06-23T14:15:00.000Z"
  },
  "meta": { "requestId": "req_admin_008", "version": "v1" }
}
```

#### 11.4.2 Update Episode

**Endpoint:** `PATCH /api/v1/admin/episodes/[episodeId]`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `episodeId` | `string` (UUID) | Yes | Episode ID |

**Request Body:** Same fields as Create Episode, all optional.

**Zod Schema:**

```typescript
const UpdateEpisodeSchema = CreateEpisodeSchema.partial();
```

**Success Response (200):**

```json
{
  "data": {
    "id": "uuid-ep-new",
    "title": "Dog & Chainsaw (Revised)",
    "updatedAt": "2026-06-23T14:20:00.000Z"
  },
  "meta": { "requestId": "req_admin_009", "version": "v1" }
}
```

#### 11.4.3 Delete Episode

**Endpoint:** `DELETE /api/v1/admin/episodes/[episodeId]`

Performs a soft delete.

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `episodeId` | `string` (UUID) | Yes | Episode ID |

**Success Response (200):**

```json
{
  "data": {
    "message": "Episode deleted (soft)"
  },
  "meta": { "requestId": "req_admin_010", "version": "v1" }
}
```

### 11.5 Admin — Genres CRUD

#### 11.5.1 Create Genre

**Endpoint:** `POST /api/v1/admin/genres`

**Request Body:**

```json
{
  "slug": "isekai",
  "name": "Isekai",
  "description": "Stories about characters transported to parallel worlds",
  "iconUrl": "https://cdn.nexus-anime.com/icons/isekai.svg"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `slug` | `string` | Yes | Unique, URL-safe |
| `name` | `string` | Yes | 1–255 characters |
| `description` | `string` | No | Max 2000 characters |
| `iconUrl` | `string` | No | Valid URL |

**Zod Schema:**

```typescript
const CreateGenreSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  iconUrl: z.string().url().optional(),
});
```

**Success Response (201):**

```json
{
  "data": {
    "id": "uuid-genre-new",
    "slug": "isekai",
    "name": "Isekai",
    "createdAt": "2026-06-23T14:25:00.000Z"
  },
  "meta": { "requestId": "req_admin_011", "version": "v1" }
}
```

#### 11.5.2 Update Genre

**Endpoint:** `PATCH /api/v1/admin/genres/[genreId]`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `genreId` | `string` (UUID) | Yes | Genre ID |

**Request Body:** Same fields as Create Genre, all optional.

**Zod Schema:**

```typescript
const UpdateGenreSchema = CreateGenreSchema.partial();
```

**Success Response (200):**

```json
{
  "data": {
    "id": "uuid-genre-new",
    "name": "Isekai (Updated)",
    "updatedAt": "2026-06-23T14:30:00.000Z"
  },
  "meta": { "requestId": "req_admin_012", "version": "v1" }
}
```

#### 11.5.3 Delete Genre

**Endpoint:** `DELETE /api/v1/admin/genres/[genreId]`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `genreId` | `string` (UUID) | Yes | Genre ID |

**Success Response (200):**

```json
{
  "data": {
    "message": "Genre deleted"
  },
  "meta": { "requestId": "req_admin_013", "version": "v1" }
}
```

### 11.6 Admin — Studios CRUD

#### 11.6.1 Create Studio

**Endpoint:** `POST /api/v1/admin/studios`

**Request Body:**

```json
{
  "slug": "cloverworks",
  "name": "CloverWorks",
  "description": "A-1 Pictures spin-off studio...",
  "logoUrl": "https://cdn.nexus-anime.com/logos/cloverworks.png",
  "website": "https://cloverworks.co.jp",
  "foundedDate": "2018-10-01"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `slug` | `string` | Yes | Unique, URL-safe |
| `name` | `string` | Yes | 1–255 characters |
| `description` | `string` | No | Max 2000 characters |
| `logoUrl` | `string` | No | Valid URL |
| `website` | `string` | No | Valid URL |
| `foundedDate` | `string` | No | ISO 8601 date |

**Zod Schema:**

```typescript
const CreateStudioSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  logoUrl: z.string().url().optional(),
  website: z.string().url().optional(),
  foundedDate: z.string().date().optional(),
});
```

**Success Response (201):**

```json
{
  "data": {
    "id": "uuid-studio-new",
    "slug": "cloverworks",
    "name": "CloverWorks",
    "createdAt": "2026-06-23T14:35:00.000Z"
  },
  "meta": { "requestId": "req_admin_014", "version": "v1" }
}
```

#### 11.6.2 Update Studio

**Endpoint:** `PATCH /api/v1/admin/studios/[studioId]`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `studioId` | `string` (UUID) | Yes | Studio ID |

**Request Body:** Same fields as Create Studio, all optional.

**Zod Schema:**

```typescript
const UpdateStudioSchema = CreateStudioSchema.partial();
```

**Success Response (200):**

```json
{
  "data": {
    "id": "uuid-studio-new",
    "name": "CloverWorks (Updated)",
    "updatedAt": "2026-06-23T14:40:00.000Z"
  },
  "meta": { "requestId": "req_admin_015", "version": "v1" }
}
```

#### 11.6.3 Delete Studio

**Endpoint:** `DELETE /api/v1/admin/studios/[studioId]`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `studioId` | `string` (UUID) | Yes | Studio ID |

**Success Response (200):**

```json
{
  "data": {
    "message": "Studio deleted"
  },
  "meta": { "requestId": "req_admin_016", "version": "v1" }
}
```

### 11.7 Admin — Shelves CRUD

#### 11.7.1 Create Shelf

**Endpoint:** `POST /api/v1/admin/shelves`

**Request Body:**

```json
{
  "key": "summer_2026",
  "name": "Summer 2026 Picks",
  "description": "The best anime of the summer season",
  "iconUrl": null,
  "sortOrder": 5,
  "isActive": true
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `key` | `string` | Yes | Unique, URL-safe |
| `name` | `string` | Yes | 1–255 characters |
| `description` | `string` | No | Max 2000 characters |
| `iconUrl` | `string` | No | Valid URL |
| `sortOrder` | `integer` | No | Default: 0 |
| `isActive` | `boolean` | No | Default: `true` |

**Zod Schema:**

```typescript
const CreateShelfSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  iconUrl: z.string().url().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});
```

**Success Response (201):**

```json
{
  "data": {
    "id": "uuid-shelf-new",
    "key": "summer_2026",
    "name": "Summer 2026 Picks",
    "createdAt": "2026-06-23T14:45:00.000Z"
  },
  "meta": { "requestId": "req_admin_017", "version": "v1" }
}
```

#### 11.7.2 Update Shelf

**Endpoint:** `PATCH /api/v1/admin/shelves/[shelfId]`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `shelfId` | `string` (UUID) | Yes | Shelf ID |

**Request Body:** Same fields as Create Shelf, all optional.

**Zod Schema:**

```typescript
const UpdateShelfSchema = CreateShelfSchema.partial();
```

**Success Response (200):**

```json
{
  "data": {
    "id": "uuid-shelf-new",
    "name": "Summer 2026 Picks (Updated)",
    "updatedAt": "2026-06-23T14:50:00.000Z"
  },
  "meta": { "requestId": "req_admin_018", "version": "v1" }
}
```

#### 11.7.3 Delete Shelf

**Endpoint:** `DELETE /api/v1/admin/shelves/[shelfId]`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `shelfId` | `string` (UUID) | Yes | Shelf ID |

**Success Response (200):**

```json
{
  "data": {
    "message": "Shelf deleted"
  },
  "meta": { "requestId": "req_admin_019", "version": "v1" }
}
```

#### 11.7.4 Add Item to Shelf

**Endpoint:** `POST /api/v1/admin/shelves/[shelfId]/items`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `shelfId` | `string` (UUID) | Yes | Shelf ID |

**Request Body:**

```json
{
  "animeId": "uuid-anime-1",
  "position": 0
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `animeId` | `string` (UUID) | Yes | Valid anime ID |
| `position` | `integer` | No | Default: 0 |

**Zod Schema:**

```typescript
const AddShelfItemSchema = z.object({
  animeId: z.string().uuid(),
  position: z.number().int().min(0).default(0),
});
```

**Success Response (201):**

```json
{
  "data": {
    "id": "uuid-shelf-item-new",
    "shelfId": "uuid-shelf-new",
    "animeId": "uuid-anime-1",
    "position": 0
  },
  "meta": { "requestId": "req_admin_020", "version": "v1" }
}
```

#### 11.7.5 Remove Item from Shelf

**Endpoint:** `DELETE /api/v1/admin/shelves/[shelfId]/items/[itemId]`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `shelfId` | `string` (UUID) | Yes | Shelf ID |
| `itemId` | `string` (UUID) | Yes | Shelf item ID |

**Success Response (200):**

```json
{
  "data": {
    "message": "Item removed from shelf"
  },
  "meta": { "requestId": "req_admin_021", "version": "v1" }
}
```

### 11.8 Admin — User Management

> **Expanded in M3.8.** See [§19 Admin User API (Expanded)](#19-admin-user-api-expanded) for complete user management including role assignment, suspension, force-logout, and admin deletion.

#### 11.8.1 List Users

**Endpoint:** `GET /api/v1/admin/users`

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `role` | `string` | No | — | Filter by role: `user`, `admin`, `superadmin` |
| `search` | `string` | No | — | Search by name or email |
| `status` | `string` | No | — | Filter: `active`, `suspended` |
| `sort` | `string` | No | `newest` | Sort: `newest`, `oldest`, `name` |
| `cursor` | `string` | No | — | Pagination cursor |
| `limit` | `integer` | No | 20 | Page size (1–100) |

**Success Response (200):**

```json
{
  "data": [
    {
      "id": "uuid-user-1",
      "email": "user@example.com",
      "name": "AnimeFan",
      "role": "user",
      "emailVerified": true,
      "subscription": {
        "status": "active",
        "currentPeriodEnd": "2026-07-01T00:00:00.000Z"
      },
      "watchlistCount": 15,
      "reviewCount": 3,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "lastLoginAt": "2026-06-22T00:00:00.000Z"
    }
  ],
  "meta": { "requestId": "req_admin_022", "version": "v1" },
  "pagination": {
    "nextCursor": "eyJjcmVhdGVkQXQiOiIyMDI2LTAxLTAxIn0",
    "hasNextPage": true,
    "limit": 20
  }
}
```

**TypeScript Types:**

```typescript
interface AdminUserSummary {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin" | "superadmin";
  emailVerified: boolean;
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
  } | null;
  watchlistCount: number;
  reviewCount: number;
  createdAt: string;
  lastLoginAt: string | null;
}
```

#### 11.8.2 Update User Role

**Endpoint:** `PATCH /api/v1/admin/users/[userId]/role`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | `string` (UUID) | Yes | User ID |

**Request Body:**

```json
{
  "role": "admin"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `role` | `string` | Yes | `user`, `admin`, `superadmin` |

**Zod Schema:**

```typescript
const UpdateUserRoleSchema = z.object({
  role: z.enum(["user", "admin", "superadmin"]),
});
```

**Success Response (200):**

```json
{
  "data": {
    "id": "uuid-user-1",
    "role": "admin",
    "updatedAt": "2026-06-23T15:00:00.000Z"
  },
  "meta": { "requestId": "req_admin_023", "version": "v1" }
}
```

#### 11.8.3 Suspend User

**Endpoint:** `POST /api/v1/admin/users/[userId]/suspend`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | `string` (UUID) | Yes | User ID |

**Request Body:**

```json
{
  "reason": "Violation of community guidelines"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `reason` | `string` | Yes | 1–500 characters |

**Zod Schema:**

```typescript
const SuspendUserSchema = z.object({
  reason: z.string().min(1).max(500),
});
```

**Success Response (200):**

```json
{
  "data": {
    "id": "uuid-user-1",
    "suspended": true,
    "suspensionReason": "Violation of community guidelines",
    "suspendedAt": "2026-06-23T15:05:00.000Z"
  },
  "meta": { "requestId": "req_admin_024", "version": "v1" }
}
```

#### 11.8.4 Unsuspend User

**Endpoint:** `POST /api/v1/admin/users/[userId]/unsuspend`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | `string` (UUID) | Yes | User ID |

**Success Response (200):**

```json
{
  "data": {
    "id": "uuid-user-1",
    "suspended": false,
    "unsuspendedAt": "2026-06-23T15:10:00.000Z"
  },
  "meta": { "requestId": "req_admin_025", "version": "v1" }
}
```

---

## 12. Webhooks

### 12.1 Stripe Webhook

Receives events from Stripe for subscription lifecycle management.

**Endpoint:** `POST /api/v1/webhooks/stripe`

**Guard:** Stripe signature verification via `STRIPE_WEBHOOK_SECRET`.

**Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| `Stripe-Signature` | Yes | HMAC-SHA256 signature |
| `Content-Type` | Yes | `application/json` |

**Supported Events:**

| Event | Description | Action |
|-------|-------------|--------|
| `customer.subscription.created` | New subscription created | Create/update local subscription record |
| `customer.subscription.updated` | Subscription updated (renewal, plan change) | Sync subscription status and dates |
| `customer.subscription.deleted` | Subscription canceled/expired | Mark subscription as `canceled` |
| `customer.subscription.trial_will_end` | Trial ending in 3 days | Send trial ending notification |
| `invoice.payment_succeeded` | Payment received | Update `current_period_end` |
| `invoice.payment_failed` | Payment failed | Mark subscription as `past_due`, send dunning email |
| `customer.created` | New Stripe customer created | Link to local user record |
| `customer.updated` | Customer details updated | Sync payment method info |

**Success Response (200):**

```json
{
  "received": true
}
```

**Error Response (400):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid webhook signature",
    "details": []
  }
}
```

**Webhook Event Payload Example:**

```json
{
  "id": "evt_xxx",
  "object": "event",
  "type": "customer.subscription.updated",
  "data": {
    "object": {
      "id": "sub_xxx",
      "customer": "cus_xxx",
      "status": "active",
      "current_period_start": 1719014400,
      "current_period_end": 1722643200,
      "cancel_at_period_end": false
    }
  }
}
```

---

## 13. Appendices

### Appendix A: Complete Error Codes Reference

> **Expanded in M3.8.** The table below supersedes §1.3.

| Code | HTTP Status | Meaning | Example |
|------|-------------|---------|---------|
| `VALIDATION_ERROR` | 400 | Input failed Zod validation | Invalid email format, missing required field |
| `UNAUTHORIZED` | 401 | Missing or invalid session | No session cookie, expired JWT |
| `FORBIDDEN` | 403 | Valid session, insufficient permission | Non-admin accessing admin endpoint, non-subscriber accessing stream |
| `NOT_FOUND` | 404 | Resource does not exist | Invalid slug, deleted resource |
| `CONFLICT` | 409 | Duplicate resource | Email already registered, anime already in watchlist |
| `RATE_LIMITED` | 429 | Too many requests | Exceeded rate limit |
| `INTERNAL_ERROR` | 500 | Unexpected server failure | Database connection lost, unhandled exception |
| `ACCOUNT_LOCKED` | 423 | Account temporarily locked (brute force) | 5 failed login attempts in 15 min |
| `ACCOUNT_SUSPENDED` | 423 | Account suspended by admin | Admin suspension |
| `CANNOT_UNLINK` | 400 | Cannot unlink OAuth provider | User has no other auth method |
| `SET_PASSWORD_FIRST` | 403 | Must set password before sensitive action | OAuth-only user attempting account deletion or provider unlink |
| `OAUTH_ACCOUNT_NOT_LINKED` | 409 | OAuth email exists with different provider | Google login with email that uses Discord |
| `CONCURRENT_SESSION_LIMIT` | 409 | Device session limit reached | Tier-based limit (Free 2 / Prime 5 / Resonance 10) |
| `TOKEN_EXPIRED` | 401 | JWT explicitly expired (distinct from UNTOKEN) | Client-side token refresh failed |

### Appendix B: Pagination Parameters Summary

**Cursor-Based (Recommended):**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cursor` | `string` | — | Opaque cursor from `pagination.nextCursor` |
| `limit` | `integer` | 20 | Page size (1–100) |

**Offset-Based:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `integer` | 1 | Page number (1-indexed) |
| `limit` | `integer` | 20 | Page size (1–100) |

### Appendix C: Rate Limiting Headers

Every API response includes these headers:

| Header | Type | Description |
|--------|------|-------------|
| `X-RateLimit-Limit` | `integer` | Maximum requests per window |
| `X-RateLimit-Remaining` | `integer` | Requests remaining in current window |
| `X-RateLimit-Reset` | `integer` | Unix timestamp when the window resets |

### Appendix D: Authentication Cookies

| Cookie | Attributes | TTL | Description |
|--------|-----------|-----|-------------|
| `__Host-nexus-session` | `HttpOnly; Secure; SameSite=Lax; Path=/` | 30 days (rolling) | Session JWT (Auth.js v5) |
| `__Host-nexus-remember` | `HttpOnly; Secure; SameSite=Lax; Path=/` | 365 days | Remember Me token |
| `__Host-next-auth.csrf-token` | `HttpOnly=False; Secure; SameSite=Lax; Path=/` | Session | CSRF double-submit (Auth.js) |
| `nexus_consent` | `HttpOnly=False; Secure; SameSite=Lax; Path=/` | 1 year | GDPR consent |
| `nexus_theme` | `HttpOnly=False; Secure; SameSite=Lax; Path=/` | 1 year | Theme preference |

### Appendix E: API Version Lifecycle

| Phase | Behavior | Headers |
|-------|----------|---------|
| **Active** | Default version, fully supported | `API-Version: v1` |
| **Deprecated** | Still functional, sunset announced | `API-Version: v1`, `Deprecation: true`, `Sunset: <ISO date>` |
| **Retired** | Returns `410 Gone` with migration guide link | N/A |

### Appendix F: Module Dependency Map

```
catalog ←── auth ←── billing
   ↑           ↑
library ←── catalog
admin ←── auth + catalog
session ←── auth
```

| Module | Domain | Key Endpoints |
|--------|--------|---------------|
| `catalog` | Title browsing, search, shelves | `GET /api/v1/titles`, `GET /api/v1/search` |
| `auth` | Authentication, session, OAuth | `POST /api/auth/callback/credentials`, `GET /api/auth/session` |
| `billing` | Subscriptions, Stripe | `POST /api/v1/webhooks/stripe` |
| `library` | Watchlist, watch progress, preferences | `GET /api/v1/nexus/watchlists`, `PATCH /api/v1/nexus/users/me/preferences` |
| `admin` | CMS, content ingestion, user management | `POST /api/v1/admin/titles`, `GET /api/v1/admin/dashboard` |
| `session` | Device management, session revocation | `GET /api/v1/nexus/settings/security/devices` |

### Appendix G: Database ENUM Summary

| Enum | Values | Used By |
|------|--------|---------|
| `user_role` | `user`, `admin`, `superadmin` | `users.role` |
| `anime_type` | `TV`, `OVA`, `ONA`, `Movie`, `Special` | `anime.type` |
| `anime_status` | `airing`, `finished`, `upcoming` | `anime.status` |
| `watchlist_status` | `plan_to_watch`, `watching`, `completed`, `dropped`, `on_hold` | `watchlists.status` |
| `review_status` | `published`, `draft`, `hidden` | `reviews.status` |
| `subscription_status` | `active`, `past_due`, `canceled`, `unpaid`, `trialing` | `subscriptions.status` |
| `notification_type` | `system`, `episode`, `social`, `promo` | `notifications.type` |

> **Note:** `user_role` post-MVP adds `premium`, `moderator` via `ALTER TYPE user_role ADD VALUE`.

### Appendix H: Zod Validation Quick Reference

| Pattern | Zod Expression |
|---------|---------------|
| Required string | `z.string().min(1)` |
| Optional string | `z.string().optional()` |
| Email | `z.string().email()` |
| UUID | `z.string().uuid()` |
| URL | `z.string().url()` |
| Integer | `z.number().int()` |
| Positive integer | `z.number().int().min(0)` |
| Boolean | `z.boolean()` |
| Enum | `z.enum(["a", "b", "c"])` |
| Max length | `z.string().max(255)` |
| Coerced integer | `z.coerce.number().int()` |
| Literal | `z.literal("value")` |
| Array of UUIDs | `z.array(z.string().uuid())` |

### Appendix I: HTTP Status Code Usage

| Status | Usage |
|--------|-------|
| 200 | Successful GET, PUT, PATCH, DELETE |
| 201 | Successful POST (resource created) |
| 204 | Successful request with no content (not used — 200 with body preferred) |
| 400 | Validation error |
| 401 | Authentication required |
| 403 | Permission denied |
| 404 | Resource not found |
| 409 | Conflict (duplicate resource) |
| 423 | Account locked / suspended |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

## 14. Resolved Decisions (M3.8)

This section documents decisions that resolve contradictions between earlier specs (M2.7, M3.2, M3.3, M3.4, M3.5, M3.6, M3.7). All decisions are **authoritative** — where a conflict exists, this section supersedes the referenced documents.

### RD-01: `sessions` table is NOT implemented

- **Conflict:** M3.2 §3.5 defines a `sessions` table; M3.3 §9.1 states it is not implemented.
- **Decision:** Do NOT create a `sessions` table. Session state lives entirely in the JWT cookie.
- **Rationale:** Auth.js v5 with JWT strategy does not materialize a session table. M3.3 is authoritative.
- **Supersedes:** M3.2 §3.5 (session table definition).

### RD-02: `revoked_sessions` schema

- **Conflict:** M2.7 §8.4 / M3.2 §3.5 omit `revoked_by`; M3.3 §9.2 includes it.
- **Decision:** Use M3.3 schema: `jti` (PK), `user_id`, `revoked_at`, `expires_at`, `reason`, `revoked_by` (nullable FK → users).
- **Rationale:** Audit trail requires knowing who revoked the session (admin vs self).
- **Supersedes:** M2.7 §8.4, M3.2 §3.5.

### RD-03: Redis revocation key format

- **Conflict:** M2.7 §5.4 uses `SADD revoked_sessions {jti}` (Redis SET); M3.3 §8.2 uses per-JTI keys `v1:revoked:{jti}`.
- **Decision:** Per-JTI keys (`v1:revoked:{jti}`) with TTL = `min(30d, remaining token lifetime)`.
- **Rationale:** Per-key TTL avoids a growing SET; faster lookup (O(1) vs SMEMBERS).
- **Supersedes:** M2.7 §5.4.

### RD-04: Role ENUM values

- **Conflict:** M2.7 §4.1 / M3.2 §3.3 define 4 roles; M3.5 §2.1 adds `premium` and `moderator`.
- **Decision:** Start with 3 ENUM values (`user`, `admin`, `superadmin`). Add `premium` and `moderator` post-MVP via `ALTER TYPE user_role ADD VALUE`.
- **Rationale:** MVP only needs 3 roles; ENUM additions are non-breaking in Postgres.
- **Supersedes:** M2.7 §4.1, M3.2 §3.3 (partial — M3.5 is authoritative for RBAC design).

### RD-05: Permission seed count

- **Conflict:** M3.2 §3.4 seeds 14 permissions; M3.5 §3.1 seeds 16.
- **Decision:** 16 permissions (M3.5 is authoritative). Includes `comment:delete_any` and `review:delete_any` granted to moderator, admin, superadmin.
- **Rationale:** M3.5 is the canonical RBAC spec.
- **Supersedes:** M3.2 §3.4.

### RD-06: Session TTL

- **Conflict:** M3.3 §5 says 30-day absolute / 365-day Remember Me; M3.7 env says 7-day / 30-day.
- **Decision:** 30-day absolute max, 365-day Remember Me (M3.3 is authoritative).
- **Rationale:** M3.3 is the canonical session strategy; M3.7 env values are stale.
- **Supersedes:** M3.7 §9.1 (TTL values only).

### RD-07: Concurrent device limits

- **Conflict:** M3.3 §6.6 says tier-based (2/5/10); M3.7 §8.3 says 5 devices flat.
- **Decision:** Tier-based: Free 2 / Prime 5 / Resonance 10. Oldest device evicted on LIFO.
- **Rationale:** Tier-based aligns with business model; M3.7's "5" is the Prime default.
- **Supersedes:** M3.7 §8.3.

### RD-08: `user_device_sessions` vs `user_sessions`

- **Conflict:** M3.3 §6 defines `user_device_sessions`; M3.7 §11.4 defines `user_sessions`.
- **Decision:** Both exist. `user_device_sessions` = device-level tracking (fingerprint, label). `user_sessions` = denormalized read model for `/settings/sessions` UI.
- **Rationale:** Separation of concerns: device tracking vs session listing.
- **Supersedes:** None — both retained.

### RD-09: OAuth account linking

- **Conflict:** M3.4 §5.2 allows linking when provider email is verified; no guidance for unverified.
- **Decision:** Link only when `email_verified = true` from provider. Otherwise reject with `OAuthAccountNotLinked`.
- **Rationale:** Prevents account takeover via unverified email.
- **Supersedes:** M3.4 §5.2 (clarified).

### RD-10: Audit table naming

- **Conflict:** M3.7 uses `audit_events`; M2.7 §7.6 uses `audit_logs`.
- **Decision:** `audit_events` (M3.7 is authoritative).
- **Rationale:** M3.7 is the newer, more detailed spec.
- **Supersedes:** M2.7 §7.6.

### RD-11: Account deletion

- **Conflict:** M3.6 defers deletion; no endpoint defined.
- **Decision:** M3.8 defines `DELETE /api/v1/nexus/users/me` with soft-delete + 30-day GDPR grace + JTI blacklist.
- **Rationale:** GDPR right to erasure requires a deletion endpoint.
- **Supersedes:** M3.6 (deletion deferred → now implemented).

### RD-12: Token encryption at rest

- **Conflict:** M3.2 says `refresh_token`, `access_token`, `id_token` are encrypted at rest; no scheme specified.
- **Decision:** Application-layer AES-256-GCM. Key from `AUTH_ENCRYPTION_KEY` env var. Encryption/decryption in `@nexus/auth`.
- **Rationale:** Column-level encryption is transparent to ORM; application-level gives key rotation control.
- **Supersedes:** M3.2 (added specificity).

### RD-13: Profile/preferences row creation

- **Conflict:** M3.2 / M3.6 do not specify when `user_profiles` and `user_preferences` rows are created.
- **Decision:** Both rows created eagerly at registration time (in the same transaction as `users` insert).
- **Rationale:** Avoids null-checking on every profile read; simplifies queries.
- **Supersedes:** None (gap fill).

### RD-14: `nonce` parameter for OAuth

- **Conflict:** M3.7 §3 mentions "state/nonce" but only state is implemented.
- **Decision:** State only for MVP. Nonce deferred to post-MVP (OIDC ID token replay protection).
- **Rationale:** Auth.js v5 handles state; nonce requires additional OIDC library.
- **Supersedes:** M3.7 §3 (clarified).

### RD-15: OAuth state TTL

- **Gap:** No TTL specified for OAuth state cookie.
- **Decision:** State cookie TTL = 10 minutes. Failed OAuth flows redirect to `/login?error=...`.
- **Rationale:** Short-lived state prevents stale CSRF tokens.
- **Supersedes:** None (gap fill).

---

## 15. Auth API (Expanded)

> This section expands [§2](#2-authentication) with M3.8 additions. Endpoints defined in §2 are retained; additions below supplement them.

### 15.1 Login — Device Tracking

When a login succeeds, the server ensures a `user_device_sessions` row exists for the device fingerprint.

**Fingerprint = SHA-256 of `{UA}|{Accept-Language}|{/24 subnet}` → 16 hex chars.**

**Device label** = simplified UA parse (Chrome/Firefox/Safari + OS) + GeoIP (from `cf-ipcountry` header).

**Concurrent session limit check:**
1. Count active `user_device_sessions` for user.
2. If count > tier limit (Free 2 / Prime 5 / Resonance 10), evict oldest `last_active_at` session.
3. Evicted session's JTI is blacklisted in `revoked_sessions`.
4. New session is created.

If the limit is hit on a **new** device login, the response includes a warning:

```json
{
  "data": {
    "user": { "..." : "..." },
    "sessionExpires": "...",
    "deviceSession": {
      "id": "uuid-devicesession",
      "deviceLabel": "Chrome • macOS • US",
      "isCurrent": true
    }
  },
  "meta": { "..." : "..." }
}
```

### 15.2 Login — Brute Force

| Attempt | Action |
|---------|--------|
| 1–4 failed | Log normally, increment counter in Redis |
| 5 failed (in 15 min) | Lock account 15 min, respond 423 `ACCOUNT_LOCKED` |
| Retry while locked | Exponential backoff: `attempt^1.5 × 10` seconds between attempts |

**IP-level:** 50 failed logins in 15 min from same IP (across accounts) → block IP for 1 hour via Redis key `v1:ip_block:{ip}` with TTL 3600s.

**Audit:** Every lockout triggers `brute_force_lockout` event. Email alert to user via Resend.

### 15.3 OAuth — Account Unlink

**Endpoint:** `POST /api/auth/oauth/{provider}/unlink`

**Guard:** `requireAuth()`

**Request Body:**

```json
{
  "password": "currentPassword"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `password` | `string` | Yes (if password user) | Must match current password |
| `provider` | `string` | Yes (path) | `google`, `discord` |

> **OAuth-only users** (no password): must use `providerReverification` token from `/api/auth/reverify/{provider}` instead of `password`.

**Business rule:** User may only unlink if at least one other auth method remains (another OAuth provider OR a password). Otherwise respond 400 `CANNOT_UNLINK`.

**Success Response (200):**

```json
{
  "data": {
    "message": "{provider} account unlinked."
  },
  "meta": { "requestId": "req_auth_unlink", "version": "v1" }
}
```

**Error Response (400):**

```json
{
  "error": {
    "code": "CANNOT_UNLINK",
    "message": "You cannot unlink your only authentication method. Set a password or link another provider first.",
    "details": []
  },
  "meta": { "requestId": "req_auth_unlink_fail", "version": "v1" }
}
```

> **Audit:** `account_unlink`.

### 15.4 OAuth — Provider Reverification

Used for sensitive actions (account deletion, unlinking) by OAuth-only users.

**Endpoint:** `POST /api/auth/reverify/{provider}`

**Guard:** `requireAuth()`

**Request:** Initiates a fresh OAuth flow with `prompt=consent`. Returns a redirect URL to the provider.

**Success Response (200):**

```json
{
  "data": {
    "redirectUrl": "https://accounts.google.com/...",
    "token": "signed-reverify-token"
  },
  "meta": { "requestId": "req_auth_reverify", "version": "v1" }
}
```

> The `token` is a short-lived (5 min) JWT signed with `AUTH_SECRET` that embeds the user's ID and the intended action (`delete` or `unlink`). The callback endpoint validates this token before proceeding.

### 15.5 Password Change

**Endpoint:** `POST /api/auth/password/change`

**Guard:** `requireAuth()`

**Request Body:**

```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newSecurePassword456"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `currentPassword` | `string` | Yes | Must match current password |
| `newPassword` | `string` | Yes | Min 8 chars, zxcvbn ≥ 2, not identical to current |

**Zod Schema:**

```typescript
const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[0-9]/),
});
```

**Success Response (200):**

```json
{
  "data": {
    "message": "Password changed successfully. All other sessions have been revoked."
  },
  "meta": { "requestId": "req_auth_pw_change", "version": "v1" }
}
```

**Side effects:**
1. `users.hashed_password` updated (bcrypt 12 rounds).
2. All JTIs for user blacklisted **except current session**.
3. All `user_device_sessions` rows kept (not deleted).
4. Redis revocation cache invalidated.
5. Resend email notification to user.

> **Audit:** `password_change`.

### 15.6 Session Token Encryption

All OAuth tokens stored in the `accounts` table (`refresh_token`, `access_token`, `id_token`) are encrypted at rest using **AES-256-GCM**.

**Implementation:**
- Key: 32-byte key from `AUTH_ENCRYPTION_KEY` env var (validated at startup via Zod).
- IV: 16-byte random per encryption, stored alongside ciphertext.
- Auth tag: 16-byte GCM tag, stored alongside ciphertext.
- Encryption/decryption: `@nexus/auth/encryption.ts` module.
- Key rotation: Re-encrypt all tokens on next write after key change; old key decryption supported for 24h via `AUTH_ENCRYPTION_KEY_PREVIOUS` env var.

---

## 16. User API

> This section expands [§3](#3-users) with M3.8 additions.

### 16.1 Get Public User Profile

Retrieve another user's profile (privacy-gated).

**Endpoint:** `GET /api/v1/nexus/users/[userId]`

**Guard:** `requireAuth()`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | `string` (UUID) | Yes | User ID |

**Privacy resolution:**
- Owner or admin → full profile.
- `profile_visibility = public` → limited profile (id, name, image, bio, role).
- `profile_visibility = friends` → limited profile if friends (post-MVP: treated as `private`).
- `profile_visibility = private` → 403 `FORBIDDEN`.

**Success Response (200) — Public:**

```json
{
  "data": {
    "id": "uuid-user-2",
    "name": "OtherUser",
    "image": "https://...",
    "role": "user",
    "profile": {
      "bio": "Anime enthusiast",
      "avatarUrl": null,
      "website": null,
      "location": null,
      "socialLinks": null
    }
  },
  "meta": { "requestId": "req_user_public", "version": "v1" }
}
```

**Error Response (403):**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "This user's profile is private.",
    "details": []
  },
  "meta": { "requestId": "req_user_private", "version": "v1" }
}
```

### 16.2 Update Email

Email update requires re-verification.

**Endpoint:** `PATCH /api/v1/nexus/users/me/email`

**Guard:** `requireAuth()`

**Request Body:**

```json
{
  "email": "newemail@example.com",
  "password": "currentPassword123"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `email` | `string` | Yes | Valid email, not already in use |
| `password` | `string` | Yes | Must match current password |

**Success Response (200):**

```json
{
  "data": {
    "message": "Email updated. Please verify your new email address.",
    "emailVerified": false
  },
  "meta": { "requestId": "req_user_email", "version": "v1" }
}
```

**Side effects:**
1. `users.email` updated.
2. `users.email_verified` set to `null`.
3. Verification email sent to new address.
4. Old address notified of change via Resend.

> **Audit:** `email_changed`.

### 16.3 Update Avatar

Avatar update uses the presigned URL flow (see [§17.4](#174-avatar-presign)).

**Endpoint:** `PATCH /api/v1/nexus/users/me/avatar`

**Guard:** `requireAuth()`

**Request Body:**

```json
{
  "avatarUrl": "https://cdn.nexus-anime.com/avatars/uuid-123/abc.jpg"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `avatarUrl` | `string` | Yes | Must be a URL from the presigned upload response |

> **Note:** The client must first call `POST /api/v1/nexus/profile/avatar/presign` to get a presigned PUT URL, upload the image directly to R2, then call this endpoint with the public URL.

**Success Response (200):**

```json
{
  "data": {
    "avatarUrl": "https://cdn.nexus-anime.com/avatars/uuid-123/abc.jpg"
  },
  "meta": { "requestId": "req_user_avatar", "version": "v1" }
}
```

**Avatar resolution order (when reading):**
1. `user_profiles.avatar_url` (if non-null) — custom override
2. `users.image` (if non-null) — custom upload
3. OAuth provider image (from `accounts` / Auth.js session)
4. Generated fallback (DiceBear based on email hash)

---

## 17. Profile API

> This section expands [§3.2](#32-update-user-profile) and [§3.3](#33-update-preferences) with M3.8 additions.

### 17.1 Get Profile (Self)

Alias for `GET /api/v1/nexus/users/me` that returns the profile + preferences section only.

**Endpoint:** `GET /api/v1/nexus/profile`

**Guard:** `requireAuth()`

**Success Response (200):**

```json
{
  "data": {
    "id": "uuid-profile-1",
    "userId": "uuid-123",
    "bio": "Love isekai and mecha anime!",
    "avatarUrl": "https://...",
    "website": "https://myblog.com",
    "location": "Tokyo, Japan",
    "dateOfBirth": "1995-03-15",
    "socialLinks": {
      "twitter": "@animefan",
      "discord": "animefan#1234"
    }
  },
  "meta": { "requestId": "req_profile_001", "version": "v1" }
}
```

### 17.2 Update Profile

**Endpoint:** `PATCH /api/v1/nexus/profile`

**Guard:** `requireAuth()` + `requirePermission('user:update')`

**Request Body:** Same fields as §3.2.

**Success Response (200):**

```json
{
  "data": {
    "id": "uuid-profile-1",
    "bio": "Updated bio",
    "website": "https://newblog.com",
    "location": "Osaka, Japan"
  },
  "meta": { "requestId": "req_profile_002", "version": "v1" }
}
```

### 17.3 Update Privacy Settings

**Endpoint:** `PATCH /api/v1/nexus/profile/privacy`

**Guard:** `requireAuth()` + `requirePermission('user:update')`

**Request Body:**

```json
{
  "profileVisibility": "friends",
  "watchHistoryVisibility": "private",
  "showOnlineStatus": false
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `profileVisibility` | `string` | No | `public`, `friends`, `private` |
| `watchHistoryVisibility` | `string` | No | `public`, `friends`, `private` |
| `showOnlineStatus` | `boolean` | No | — |

**Zod Schema:**

```typescript
const UpdatePrivacySchema = z.object({
  profileVisibility: z.enum(["public", "friends", "private"]).optional(),
  watchHistoryVisibility: z.enum(["public", "friends", "private"]).optional(),
  showOnlineStatus: z.boolean().optional(),
});
```

**Success Response (200):**

```json
{
  "data": {
    "profileVisibility": "friends",
    "watchHistoryVisibility": "private",
    "showOnlineStatus": false
  },
  "meta": { "requestId": "req_profile_privacy", "version": "v1" }
}
```

### 17.4 Avatar Presign

Generate a presigned PUT URL for direct avatar upload to Cloudflare R2.

**Endpoint:** `POST /api/v1/nexus/profile/avatar/presign`

**Guard:** `requireAuth()` + `requirePermission('user:update')`

**Request Body:**

```json
{
  "contentType": "image/png"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `contentType` | `string` | Yes | `image/jpeg`, `image/png`, `image/webp`, `image/gif` |

**Success Response (200):**

```json
{
  "data": {
    "uploadUrl": "https://r2.cloudflarestorage.com/nexus-anime/avatars/uuid-123/abc.png?X-Amz-Algorithm=...&X-Amz-Signature=...",
    "publicUrl": "https://cdn.nexus-anime.com/avatars/uuid-123/abc.png",
    "expiresAt": "2026-06-25T13:00:00.000Z",
    "key": "avatars/uuid-123/abc.png"
  },
  "meta": { "requestId": "req_avatar_presign", "version": "v1" }
}
```

**Constraints:**
- MIME: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- Max size: 5 MB (enforced by R2 presigned policy)
- Min dimensions: 64×64
- Max dimensions: 4096×4096
- Storage layout: `s3://nexus-anime/avatars/{user_id}/{uuid}.{ext}`
- Previous avatars kept 30 days then lifecycle-deleted

**Error Response (400):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Unsupported content type",
    "details": [{ "field": "contentType", "message": "Must be image/jpeg, image/png, image/webp, or image/gif" }]
  },
  "meta": { "requestId": "req_avatar_presign_err", "version": "v1" }
}
```

### 17.5 Avatar Delete

Reset avatar to fallback (OAuth provider image or generated).

**Endpoint:** `DELETE /api/v1/nexus/profile/avatar`

**Guard:** `requireAuth()` + `requirePermission('user:update')`

**Success Response (200):**

```json
{
  "data": {
    "avatarUrl": null,
    "message": "Avatar reset to fallback."
  },
  "meta": { "requestId": "req_avatar_delete", "version": "v1" }
}
```

> **Side effect:** `user_profiles.avatar_url` set to null. Old avatar file lifecycle-deleted after 30 days.

---

## 18. Session API

> M3.8 new module. Manages active device sessions and revocation.

### 18.1 List Active Devices

**Endpoint:** `GET /api/v1/nexus/settings/security/devices`

**Guard:** `requireAuth()`

**Success Response (200):**

```json
{
  "data": [
    {
      "id": "uuid-device-1",
      "deviceLabel": "Chrome • macOS • US",
      "deviceId": "a1b2c3d4",
      "isCurrent": true,
      "lastActiveAt": "2026-06-25T10:00:00.000Z",
      "createdAt": "2026-06-01T00:00:00.000Z",
      "expiresAt": "2026-07-25T10:00:00.000Z"
    },
    {
      "id": "uuid-device-2",
      "deviceLabel": "Safari • iOS • JP",
      "deviceId": "e5f6g7h8",
      "isCurrent": false,
      "lastActiveAt": "2026-06-20T15:30:00.000Z",
      "createdAt": "2026-05-20T00:00:00.000Z",
      "expiresAt": "2026-07-20T15:30:00.000Z"
    }
  ],
  "meta": { "requestId": "req_devices_list", "version": "v1" }
}
```

### 18.2 Revoke Device Session

**Endpoint:** `DELETE /api/v1/nexus/settings/security/devices/[deviceId]`

**Guard:** `requireAuth()`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `deviceId` | `string` (UUID) | Yes | Device session ID |

> **Note:** Cannot revoke the current session via this endpoint (use `POST /api/auth/signout` instead). Attempting to revoke current device returns 400.

**Success Response (200):**

```json
{
  "data": {
    "message": "Device session revoked."
  },
  "meta": { "requestId": "req_device_revoke", "version": "v1" }
}
```

**Side effects:**
1. Device's JTI blacklisted in `revoked_sessions`.
2. `user_device_sessions` row deleted.
3. Redis revocation cache updated.

> **Audit:** `session_revoke`.

### 18.3 Revoke All Other Sessions

**Endpoint:** `POST /api/v1/nexus/settings/security/devices/revoke-all`

**Guard:** `requireAuth()`

**Success Response (200):**

```json
{
  "data": {
    "revokedCount": 3,
    "message": "All other sessions revoked."
  },
  "meta": { "requestId": "req_devices_revoke_all", "version": "v1" }
}
```

**Side effects:**
1. All `user_device_sessions` rows for user deleted **except current**.
2. All JTIs for user blacklisted **except current**.
3. Redis revocation cache invalidated.

> **Audit:** `session_revoke_all`.

---

## 19. Admin User API (Expanded)

> This section expands [§11.8](#118-admin--user-management) with M3.8 additions.

### 19.1 Get User Detail

**Endpoint:** `GET /api/v1/admin/users/[userId]`

**Guard:** `requireRole('admin')` + `X-API-Key`

**Success Response (200):**

```json
{
  "data": {
    "id": "uuid-user-1",
    "email": "user@example.com",
    "name": "AnimeFan",
    "role": "user",
    "emailVerified": true,
    "isSuspended": false,
    "suspensionReason": null,
    "suspendedAt": null,
    "lastLoginAt": "2026-06-22T00:00:00.000Z",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-06-22T00:00:00.000Z",
    "subscription": {
      "status": "active",
      "currentPeriodEnd": "2026-07-01T00:00:00.000Z"
    },
    "accounts": [
      { "provider": "google", "linkedAt": "2026-01-01T00:00:00.000Z" }
    ],
    "deviceCount": 2,
    "watchlistCount": 15,
    "reviewCount": 3
  },
  "meta": { "requestId": "req_admin_user_detail", "version": "v1" }
}
```

### 19.2 Assign Role

**Endpoint:** `PATCH /api/v1/admin/users/[userId]/role`

**Guard:** `requireRole('superadmin')` + `X-API-Key` (role assignment is superadmin-only)

**Request Body:**

```json
{
  "role": "admin"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `role` | `string` | Yes | `user`, `admin`, `superadmin` |

> **Note:** `requirePermission('role:assign')` resolves to superadmin-only per M3.5.

**Success Response (200):**

```json
{
  "data": {
    "id": "uuid-user-1",
    "role": "admin",
    "updatedAt": "2026-06-23T15:00:00.000Z"
  },
  "meta": { "requestId": "req_admin_role", "version": "v1" }
}
```

> **Audit:** `role_changed` with payload `{ from: "user", to: "admin", by: "uuid-admin" }`.

### 19.3 Force Logout User

**Endpoint:** `POST /api/v1/admin/users/[userId]/revoke-sessions`

**Guard:** `requireRole('admin')` + `X-API-Key`

**Success Response (200):**

```json
{
  "data": {
    "revokedCount": 3,
    "message": "All sessions for user revoked."
  },
  "meta": { "requestId": "req_admin_revoke", "version": "v1" }
}
```

**Side effects:**
1. All JTIs for user blacklisted.
2. All `user_device_sessions` rows deleted.
3. Redis revocation cache invalidated.

> **Audit:** `session_revoke_all` with `{ by: "uuid-admin", target: "uuid-user" }`.

### 19.4 Admin Delete User

**Endpoint:** `DELETE /api/v1/admin/users/[userId]`

**Guard:** `requireRole('admin')` + `X-API-Key` + `requirePermission('user:manage')`

**Request Body:**

```json
{
  "reason": "Fraudulent account"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `reason` | `string` | Yes | 1–500 characters |

**Success Response (200):**

```json
{
  "data": {
    "message": "User scheduled for permanent deletion."
  },
  "meta": { "requestId": "req_admin_user_delete", "version": "v1" }
}
```

**Side effects:** Same as self-deletion (§3.5) but initiated by admin. 30-day GDPR grace period still applies.

> **Audit:** `user_deleted` with `{ by: "uuid-admin", reason: "..." }`.

### 19.5 List User Sessions (Admin)

**Endpoint:** `GET /api/v1/admin/users/[userId]/sessions`

**Guard:** `requireRole('admin')` + `X-API-Key`

**Success Response (200):**

```json
{
  "data": [
    {
      "id": "uuid-device-1",
      "deviceLabel": "Chrome • macOS • US",
      "isCurrent": true,
      "lastActiveAt": "2026-06-25T10:00:00.000Z",
      "createdAt": "2026-06-01T00:00:00.000Z",
      "expiresAt": "2026-07-25T10:00:00.000Z"
    }
  ],
  "meta": { "requestId": "req_admin_sessions", "version": "v1" }
}
```

---

## 20. Error Code Registry (Expanded)

> This section supersedes [Appendix A](#appendix-a-complete-error-codes-reference).

### 20.1 Core Error Codes (unchanged)

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_ERROR` | 400 | Input failed Zod validation |
| `UNAUTHORIZED` | 401 | Missing or invalid session |
| `FORBIDDEN` | 403 | Valid session, insufficient permission |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | Duplicate resource |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server failure |

### 20.2 M3.8 New Error Codes

| Code | HTTP | Meaning | Triggered By |
|------|------|---------|--------------|
| `ACCOUNT_LOCKED` | 423 | Account temporarily locked (brute force) | §2.1 Login |
| `ACCOUNT_SUSPENDED` | 423 | Account suspended by admin | §2.1 Login |
| `CANNOT_UNLINK` | 400 | Cannot unlink OAuth provider (last auth method) | §15.3 OAuth Unlink |
| `SET_PASSWORD_FIRST` | 403 | Must set password before sensitive action | §3.5 Delete Account, §15.3 OAuth Unlink |
| `OAUTH_ACCOUNT_NOT_LINKED` | 409 | OAuth email exists with different provider | §2.5 Google OAuth, §2.6 Discord OAuth |
| `CONCURRENT_SESSION_LIMIT` | 409 | Device session limit reached | §15.1 Login |
| `TOKEN_EXPIRED` | 401 | JWT explicitly expired (distinct from UNTOKEN) | Any authenticated endpoint |

### 20.3 Error Code Priority

When multiple error codes could apply, use the most specific one:

1. `VALIDATION_ERROR` for input issues (always 400).
2. `ACCOUNT_LOCKED` / `ACCOUNT_SUSPENDED` for login failures (423 — more specific than 401).
3. `TOKEN_EXPIRED` for expired JWTs (401 — more specific than generic UNTOKEN).
4. `CANNOT_UNLINK` / `SET_PASSWORD_FIRST` for OAuth issues (400/403 — more specific than FORBIDDEN).
5. `CONCURRENT_SESSION_LIMIT` for device limits (409 — more specific than FORBIDDEN).
6. `OAUTH_ACCOUNT_NOT_LINKED` for OAuth conflicts (409 — more specific than UNTOKEN).

---

## 21. Audit Event Triggers

> M3.8 new section. Defines which events fire on which operations.

### 21.1 Event Registry

| Event Type | Trigger | Payload Shape | Retention |
|------------|---------|---------------|-----------|
| `login_success` | Successful login (§2.1) | `{ channel, device_id, ip }` | 90 days |
| `login_failure` | Failed login (bad password) | `{ email, ip, reason: "bad_password" }` | 90 days |
| `logout` | Logout (§2.3) | `{ user_id, device_id, scope: "self" \| "all" }` | 90 days |
| `registration_success` | Account created (§2.2) | `{ email, channel: "credentials" }` | 90 days |
| `oauth_signin` | OAuth login success (§2.5, §2.6) | `{ provider, device_id, ip }` | 90 days |
| `account_link` | OAuth account linked | `{ user_id, provider }` | 90 days |
| `account_unlink` | OAuth account unlinked (§15.3) | `{ user_id, provider }` | 90 days |
| `password_change` | Password changed (§15.5) | `{ user_id }` | 90 days |
| `password_reset` | Password reset complete (§2.7) | `{ user_id }` | 90 days |
| `email_changed` | Email updated (§16.2) | `{ user_id, old_email, new_email }` | 90 days |
| `email_verified` | Email verified (§2.8) | `{ user_id }` | 90 days |
| `profile_updated` | Profile updated (§3.2) | `{ user_id, fields: string[] }` | 90 days |
| `avatar_uploaded` | Avatar uploaded (§17.4) | `{ user_id, key }` | 90 days |
| `avatar_deleted` | Avatar deleted (§17.5) | `{ user_id }` | 90 days |
| `brute_force_lockout` | Account locked (§15.2) | `{ user_id, email, ip, attempt_count }` | 90 days |
| `session_revoke` | Single session revoked (§18.2) | `{ user_id, device_id, revoked_by }` | 90 days |
| `session_revoke_all` | All sessions revoked (§18.3, §19.3) | `{ user_id, revoked_by, count }` | 90 days |
| `role_changed` | Role assigned (§19.2) | `{ user_id, from, to, by }` | 1 year |
| `user_suspended` | User suspended (§11.8.3) | `{ user_id, reason, by }` | 1 year |
| `user_unsuspended` | User unsuspended (§11.8.4) | `{ user_id, by }` | 1 year |
| `user_deleted` | Account deleted (§3.5, §19.4) | `{ user_id, by, reason, self_delete }` | 1 year |
| `permission_denied` | Guard rejection | `{ user_id, permission, resource }` | 90 days |

### 21.2 Audit Event Schema

```typescript
interface AuditEvent {
  id: string;                 // UUID
  user_id: string | null;     // nullable (login failures may have no user)
  ip_address: string;         // inet
  user_agent: string;
  event_type: string;         // one of the above
  payload: Record<string, unknown>;
  created_at: string;         // timestamptz
  request_id: string;         // correlation ID from API envelope
}
```

### 21.3 Audit Write Strategy

1. Event payload pushed to Redis list `v1:audit_queue`.
2. Batch flush worker (Vercel Cron every 60s) drains the list into `audit_events` table.
3. Redis list survives DB outages; DB is the durable store.
4. Retention enforced by monthly partition drop (PostgreSQL declarative partitioning on `created_at`).

---

## 22. Rate Limit Matrix

> This section supersedes [§1.5](#1-5-rate-limiting) with the per-endpoint matrix.

### 22.1 Endpoint Rate Limits

| Endpoint | Limit / Window | Identifier | Response on Excess |
|----------|---------------|------------|---------------------|
| `POST /api/auth/callback/credentials` (login) | 5 req / 5 min | IP + email | 429 `RATE_LIMITED` |
| `POST /api/auth/register` | 3 req / 5 min | IP | 429 `RATE_LIMITED` |
| `POST /api/auth/forgot-password` | 3 req / 10 min | IP + email | 429 `RATE_LIMITED` |
| `POST /api/auth/reset-password` | 5 req / 10 min | IP | 429 `RATE_LIMITED` |
| `POST /api/auth/verify-email/resend` | 3 req / 10 min | User ID | 429 `RATE_LIMITED` |
| `POST /api/auth/password/change` | 5 req / 10 min | User ID | 429 `RATE_LIMITED` |
| `POST /api/auth/signout` | 20 req / 15 min | User ID | 429 `RATE_LIMITED` |
| `GET /api/auth/session` | 100 req / 15 min | IP | 429 `RATE_LIMITED` |
| `GET /api/auth/signin/{provider}` | 20 req / 15 min | IP | 429 `RATE_LIMITED` |
| `GET /api/auth/callback/{provider}` | 20 req / 15 min | IP | 429 `RATE_LIMITED` |
| `POST /api/auth/oauth/{provider}/unlink` | 10 req / 10 min | User ID | 429 `RATE_LIMITED` |
| `POST /api/auth/reverify/{provider}` | 5 req / 10 min | User ID | 429 `RATE_LIMITED` |
| `GET /api/v1/*` (public endpoints) | 100 req / 15 min | IP | 429 `RATE_LIMITED` |
| `GET /api/v1/nexus/*` (authed reads) | 200 req / 15 min | User ID | 429 `RATE_LIMITED` |
| `POST /api/v1/nexus/*` (authed writes) | 100 req / 15 min | User ID | 429 `RATE_LIMITED` |
| `PATCH /api/v1/nexus/users/me/preferences` | 30 req / 15 min | User ID | 429 `RATE_LIMITED` |
| `DELETE /api/v1/nexus/users/me` | 3 req / 10 min | User ID | 429 `RATE_LIMITED` |
| `POST /api/v1/nexus/profile/avatar/presign` | 10 req / 10 min | User ID | 429 `RATE_LIMITED` |
| `GET /api/v1/nexus/settings/security/devices` | 30 req / 15 min | User ID | 429 `RATE_LIMITED` |
| `DELETE /api/v1/nexus/settings/security/devices/:id` | 20 req / 15 min | User ID | 429 `RATE_LIMITED` |
| `POST /api/v1/nexus/settings/security/devices/revoke-all` | 3 req / 10 min | User ID | 429 `RATE_LIMITED` |
| `GET /api/v1/admin/*` | 30 req / 15 min | IP | 429 `RATE_LIMITED` |
| `POST /api/v1/admin/users/:id/suspend` | 10 req / 15 min | IP | 429 `RATE_LIMITED` |
| `POST /api/v1/admin/users/:id/revoke-sessions` | 10 req / 15 min | IP | 429 `RATE_LIMITED` |
| `PATCH /api/v1/admin/users/:id/role` | 10 req / 15 min | IP | 429 `RATE_LIMITED` |
| `POST /api/v1/webhooks/stripe` | Unlimited | Stripe signature | 400 on bad signature |

### 22.2 Rate Limit Implementation

- Implementation: `@upstash/ratelimit` via `@nexus/cache`.
- Keys: `v1:ratelimit:{identifier}:{window}`.
- Sliding window: 15-minute window, refreshed on each request.
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` (429 only).

### 22.3 IP Blocking (Brute Force)

- Key: `v1:ip_block:{ip}`.
- TTL: 3600s (1 hour).
- Trigger: 50 failed logins in 15 min from same IP (across accounts).
- Response: 403 `FORBIDDEN` with message "IP temporarily blocked due to suspicious activity."

---

## 23. Security Headers & Cookie Policy

> M3.8 new section. Codifies M3.7 security requirements.

### 23.1 Security Headers

All responses include the following headers (set in `middleware.ts` and `next.config.ts`):

| Header | Value | Layer |
|--------|-------|-------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | middleware, next.config.ts |
| `Content-Security-Policy` | See §23.2 | middleware |
| `X-Content-Type-Options` | `nosniff` | middleware |
| `X-Frame-Options` | `DENY` | middleware |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | middleware |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(self)` | middleware |
| `X-Powered-By` | (removed) | next.config.ts |
| `X-DNS-Prefetch-Control` | `off` | middleware |

### 23.2 CSP String

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https://cdn.nexus-anime.com https://img.nexus-anime.com;
font-src 'self' data:;
connect-src 'self';
frame-src 'self' https://player.cloudflare.stream;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
upgrade-insecure-requests;
```

> **Note:** `script-src 'self'` forbids inline scripts and `eval()`. Use Webpack/Vite nonce if third-party scripts are needed (post-MVP).

### 23.3 XSS Protections

1. React auto-escaping (default).
2. `script-src 'self'` CSP.
3. DOMPurify (strict allowlist) for any user-generated HTML (reviews with allowed tags: `b`, `i`, `em`, `strong`, `br`, `p`, `ul`, `ol`, `li`, `a` with `href` — all other tags/attributes stripped).
4. **Forbidden:** `dangerouslySetInnerHTML` without DOMPurify, `eval()`, inline event handlers with user data.

### 23.4 CSRF Protections (layered)

1. `SameSite=Lax` cookie (prevents cross-origin cookie attachment).
2. Auth.js built-in CSRF token (double-submit cookie pattern via `__Host-next-auth.csrf-token`).
3. `__Host-` prefix (host-only, no subdomain leakage).
4. Origin header check in middleware (POST/PUT/PATCH/DELETE only) against `Origin: https://nexus-anime.com`.
5. Custom CSRF token for non-Auth.js forms (e.g., admin panel).

### 23.5 CORS Policy

- Production: same-origin only (`https://nexusanime.com`, `https://www.nexusanime.com`).
- Development: `http://localhost:3000`.
- Credentials allowed.
- No wildcard origin (`Access-Control-Allow-Origin: *` is forbidden).

### 23.6 Secret Management

| Secret | Storage | Rotation |
|--------|---------|----------|
| `AUTH_SECRET` | Vercel env | Rotate via Vercel dashboard; invalidates all sessions |
| `AUTH_ENCRYPTION_KEY` | Vercel env | See §15.6 key rotation |
| `DATABASE_URL` | Vercel env | Neon dashboard → redeploy |
| `AUTH_GOOGLE_ID/SECRET` | Vercel env | Google Cloud Console → redeploy |
| `AUTH_DISCORD_ID/SECRET` | Vercel env | Discord Developer Portal → redeploy |
| `STRIPE_SECRET_KEY` | Vercel env | Stripe dashboard → redeploy |
| `STRIPE_WEBHOOK_SECRET` | Vercel env | Stripe dashboard → redeploy |
| `RESEND_API_KEY` | Vercel env | Resend dashboard → redeploy |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel env | Upstash dashboard → redeploy |
| `R2_ACCESS_KEY_ID/SECRET` | Vercel env | Cloudflare dashboard → redeploy |

**Prohibited:** Secrets in source code, commit history, client bundles, SSR props, CI workflow files, `NEXT_PUBLIC_` prefix on secrets.

### 23.7 Incident Response

| Severity | Response Time | Examples |
|----------|--------------|---------|
| P0 | 15 min | Site down, breach, all streams fail |
| P1 | 1 hour | Login broken, payments fail |
| P2 | 4 hours | Search slow, single title broken |
| P3 | Next business day | Cosmetic issues |

Playbooks (stored in `/docs/incidents/`): credential leak, account takeover, SQL injection, DDoS, data breach (< 72h GDPR notification).

---

*This document is the authoritative API contract for Nexus Anime. All route handlers, services, and client integrations must conform to the specifications defined herein. For the canonical database schema, see [database-design.md](./database-design.md). For the backend architecture, see [backend-architecture.md](./architecture/backend-architecture.md). For the resolved cross-spec decisions that take precedence where conflicts exist, see [§14 Resolved Decisions](#14-resolved-decisions-m38).*