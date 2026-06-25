# M3.4 — OAuth Provider Strategy

> **Scope:** This document defines the **OAuth Provider Strategy for Nexus Anime** — provider selection, OAuth flow implementation, callback handling, account linking, and account recovery. It is the authoritative design reference for OAuth integration under Auth.js v5.

> **Status:** Draft — Pending Review
> **Date:** 2026-06-25
> **Author:** Tech Lead
> **Milestone:** M3 (Sprints 4–5)

---

## Table of Contents

1. [Purpose & Relationship to M2.7 and M3.3](#1-purpose--relationship-to-m27-and-m33)
2. [Provider Selection](#2-provider-selection)
3. [OAuth Flow](#3-oauth-flow)
4. [Callback Flow](#4-callback-flow)
5. [Account Linking](#5-account-linking)
6. [Account Recovery](#6-account-recovery)
7. [Implementation Guidance](#7-implementation-guidance)
8. [Environment Variables](#8-environment-variables)
9. [Database Schema](#9-database-schema)
10. [Security Considerations](#10-security-considerations)
11. [Sprint Deliverables](#11-sprint-deliverables)
12. [References](#12-references)

---

## 1. Purpose & Relationship to M2.7 and M3.3

### 1.1 Purpose

M3.4 is the authoritative specification for **OAuth provider integration** in Nexus Anime. It defines which providers are supported, how the OAuth flow is implemented within Auth.js v5, how provider callbacks are handled, how OAuth identities are linked to existing credentials accounts, and how users recover access when they lose their OAuth provider account.

### 1.2 Relationship to M2.7

M2.7 ([Authentication Architecture](authentication-architecture.md)) remains authoritative for the **base authentication flows** (sign-up, login, password reset), **RBAC**, **trust boundaries**, and **security architecture** (CSRF, CORS, rate limiting). M3.4 extends M2.7 §3.5 (Google OAuth) into a multi-provider strategy and adds Discord as a Beta provider plus GitHub as an optional future provider.

### 1.3 Relationship to M3.3

M3.3 ([Session & Token Strategy](session-strategy.md)) remains authoritative for **session format**, **JWT claims**, **rolling refresh**, **token revocation**, and **device tracking**. M3.4 works within the M3.3 session model — OAuth-issued sessions are subject to the same JWT structure, expiration, revocation, and device tracking rules as credential-issued sessions.

### 1.4 Scope Matrix

| Topic | Owner | Document |
|-------|-------|----------|
| Provider selection & priority | **M3.4** | This document §2 |
| OAuth flow (authorization code + PKCE) | **M3.4** | This document §3 |
| Callback flow & identity resolution | **M3.4** | This document §4 |
| Account linking (OAuth ↔ credentials) | **M3.4** | This document §5 |
| Account recovery (OAuth-only users) | **M3.4** | This document §6 |
| Session JWT claims & versioning | M3.3 | [session-strategy.md](session-strategy.md) |
| Token revocation & device tracking | M3.3 | [session-strategy.md](session-strategy.md) |
| Base auth flows & RBAC | M2.7 | [authentication-architecture.md](authentication-architecture.md) |
| User & account data models | M3.2 | [user-domain-design.md](../user-domain-design.md) |

---

## 2. Provider Selection

### 2.1 Provider Priority

| Provider | Status | Priority | Rationale |
|----------|--------|----------|-----------|
| **Google** | MVP (required) | Primary | Largest user base; reliable provider; email verification guaranteed |
| **Discord** | Beta | Secondary | Aligns with gaming community; rich presence/ID verification; younger demographic |
| **GitHub** | Optional (post-MVP) | Tertiary | Developer audience; not core to anime streaming; available for S7+ |

### 2.2 Provider Comparison

| Concern | Google | Discord | GitHub |
|---------|--------|---------|--------|
| OAuth 2.0 compliant | Yes | Yes | Yes |
| PKCE support | Yes | Yes | Yes |
| Email verified flag | `email_verified` (reliable) | `email_verified` (only if verified) | Primary email only |
| Users with no email | None | Rare | Some |
| Token refresh | `refresh_token` | `refresh_token` | `refresh_token` (rare) |
| Scope for our use case | `openid email profile` | `identify email` | `read:user user:email` |
| Rate limits (provider side) | Generous | Generous | Generous |
| Profile picture | `picture` | `avatar` | `avatar_url` |
| Profile URL | N/A | N/A | `html_url` |

### 2.3 Provider Configuration (Auth.js v5)

```typescript
// packages/auth/src/config.ts
import Google from "next-auth/providers/google";
import Discord from "next-auth/providers/discord";  // S4 — Beta
// import GitHub from "next-auth/providers/github"; // S7+ — Optional

export const oauthProviders = [
  Google({
    clientId: process.env.AUTH_GOOGLE_ID,
    clientSecret: process.env.AUTH_GOOGLE_SECRET,
    authorization: {
      params: {
        scope: "openid email profile",
        prompt: "consent",
        access_type: "offline",  // receive refresh_token
      },
    },
  }),
  Discord({
    clientId: process.env.AUTH_DISCORD_ID,
    clientSecret: process.env.AUTH_DISCORD_SECRET,
    authorization: {
      params: {
        scope: "identify email",
      },
    },
  }),
  // GitHub — enabled in S7+
  // GitHub({
  //   clientId: process.env.AUTH_GITHUB_ID,
  //   clientSecret: process.env.AUTH_GITHUB_SECRET,
  //   authorization: {
  //     params: {
  //       scope: "read:user user:email",
  //     },
  //   },
  // }),
];
```

### 2.4 Provider Enabling Strategy

| Sprint | Providers Enabled | Config Flag |
|--------|-------------------|-------------|
| S4 (MVP) | Google only | `oauthProviders` array in `config.ts` |
| S5 (Beta) | Google + Discord | Add Discord to array |
| S7+ (Optional) | Google + Discord + GitHub | Add GitHub to array |

Runtime provider selection is **configuration-only** — all code paths are provider-agnostic. Adding a new provider requires only appending to the `oauthProviders` array and setting the corresponding env vars. No conditional branching in callbacks or events.

---

## 3. OAuth Flow

### 3.1 Authorization Code Flow with PKCE

Auth.js v5 uses **Authorization Code Flow** with **PKCE** (Proof Key for Code Exchange) for all OAuth providers. This aligns with M2.7 §3.5 and is the recommended OAuth 2.0 best practice for public clients.

```mermaid
sequenceDiagram
    participant Client as Browser
    participant Next as Next.js Route
    participant Auth as Auth.js
    participant Provider as Google/Discord/GitHub

    Note over Client: Step 1: User clicks "Sign in with Google"
    Client->>Next: GET /api/auth/signin/google
    Next->>Auth: signIn("google", { redirect: "/nexus" })
    Auth->>Auth: Generate state (CSRF) + PKCE code_verifier + code_challenge
    Auth->>Auth: Store state + code_verifier in __Host-next-auth.csrf-token cookie
    Auth->>Provider: 302 Redirect to accounts.google.com/oauth2/v2/auth
    Note over Provider: User authenticates & consents
    Provider-->>Auth: 302 Redirect with code + state

    Note over Client: Step 2: Callback arrives
    Client->>Next: GET /api/auth/callback/google?code=...&state=...
    Next->>Auth: callback({ code, state })
    Auth->>Auth: Verify state matches stored value
    Auth->>Auth: Verify PKCE code_verifier matches code_challenge
    Auth->>Provider: POST /token { code, code_verifier, redirect_uri }
    Provider-->>Auth: { access_token, id_token, refresh_token, expires_in }
    Auth->>Provider: GET /oauth2/vinfo (or /users/@me)
    Provider-->>Auth: { sub, email, name, picture, email_verified }
    Auth->>Auth: Account linking logic (§5)
    Auth->>Auth: Issue JWT → Set-Cookie __Host-nexus-session
    Auth-->>Next: 302 Redirect to /nexus
    Next-->>Client: 302 /nexus
```

### 3.2 Step-by-Step

1. **Initiate:** User clicks provider button on `/login` or `/register` page. Client navigates to `/api/auth/signin/{provider}` (Auth.js route).
2. **Generate state + PKCE:** Auth.js generates `state` (CSRF protection), `code_verifier`, and `code_challenge` (SHA-256 of verifier). Both `state` and `code_verifier` are stored in the `__Host-next-auth.csrf-token` cookie.
3. **Redirect to provider:** Browser is redirected to the provider's authorization endpoint with `client_id`, `redirect_uri`, `code_challenge`, `state`, and `scope`.
4. **User consents:** User authenticates with the provider (if not already) and grants requested scopes.
5. **Provider redirects back:** Browser is redirected to `/api/auth/callback/{provider}` with `code` and `state`.
6. **Verify state:** Auth.js compares the returned `state` against the stored value. Mismatch → 403 error.
7. **Exchange code for tokens:** Auth.js sends `code`, `code_verifier`, `client_id`, `client_secret`, and `redirect_uri` to the provider's token endpoint.
8. **Fetch user info:** Auth.js calls the provider's userinfo endpoint with the `access_token`.
9. **Account linking:** Auth.js determines whether to create a new user, link to an existing user, or reject (see §5).
10. **Issue session:** JWT is signed with `AUTH_SECRET` and set as `__Host-nexus-session` cookie (M3.3 §2).
11. **Redirect:** User is redirected to the target page (`/nexus` or the original `callbackUrl`).

### 3.3 Provider-Specific Endpoint Configuration

| Provider | Authorization URL | Token URL | Userinfo URL |
|----------|-------------------|-----------|--------------|
| Google | `https://accounts.google.com/o/oauth2/v2/auth` | `https://oauth2.googleapis.com/token` | `https://openidconnect.googleapis.com/v1/userinfo` |
| Discord | `https://discord.com/api/oauth2/authorize` | `https://discord.com/api/oauth2/token` | `https://discord.com/api/users/@me` |
| GitHub | `https://github.com/login/oauth/authorize` | `https://github.com/login/oauth/access_token` | `https://api.github.com/user` |

### 3.4 Session JWT Claims for OAuth Users

The `channel` claim in the M3.3 JWT structure identifies the authentication method:

```typescript
// M3.3 §2.1 — SessionJWT — OAuth uses these channel values
type OAuthChannel = "google" | "discord" | "github";

// When issuing session from OAuth callback:
token.channel = "google";   // or "discord" / "github"
token.sub = user.id;        // Nexus user ID
token.email = profile.email;
token.email_verified = profile.email_verified;  // Google: reliable; Discord: check
token.name = profile.name;
token.image = profile.picture;
token.role = user.role;
token.device_id = deviceFingerprint ?? null;
token.v = TOKEN_VERSION;
```

### 3.5 Scope Justification

| Provider | Scopes | Why |
|----------|--------|-----|
| Google | `openid email profile` | `openid` gives ID token with `sub` (stable user ID); `email` gives verified email; `profile` gives name + picture |
| Discord | `identify email` | `identify` gives username + discriminator + id + avatar; `email` gives primary email |
| GitHub | `read:user user:email` | `read:user` gives name + bio + avatar; `user:email` gives primary email (even if private) |

---

## 4. Callback Flow

### 4.1 Auth.js Callback Handling

```mermaid
sequenceDiagram
    participant Auth as Auth.js
    participant DB as Neon PostgreSQL
    participant Cache as Upstash Redis
    participant Lookup as Account Lookup

    Auth->>Auth: Parse callback params (code, state, error)
    Auth->>Auth: Verify state matches stored cookie
    state mismatch: 403
    Auth->>Auth: Exchange code for tokens
    Auth->>Auth: Decode ID token (JWT) or call userinfo
    Auth->>Lookup: findUserByProviderAccount(provider, providerAccountId)

    alt Account exists (previous OAuth login)
        Lookup-->>Auth: userId
        Auth->>DB: UPDATE accounts SET access_token, refresh_token, expires_at
        Auth->>Auth: Fetch user by userId
    else Account not found — email in DB?
        Auth->>Lookup: findUserByEmail(email)
        alt Email matches existing credentials user
            Lookup-->>Auth: userId
            Auth->>DB: INSERT INTO accounts (link)
            Auth->>Auth: Fetch user by userId
        else No existing user
            Auth->>DB: INSERT INTO users (email_verified=true)
            Auth->>DB: INSERT INTO accounts
        end
    end

    Auth->>Auth: Run `signIn` event
    Auth->>Cache: Update subscription cache
    Auth->>Auth: Run `jwt` callback → set claims
    Auth->>Auth: Run `session` callback → expose claims
    Auth-->>Auth: Set-Cookie __Host-nexus-session
```

### 4.2 Error Handling in Callback

| Error | Auth.js Error | Client Behavior | Log Level |
|-------|---------------|-----------------|-----------|
| `state` mismatch | `OAUTH_CALLBACK_ERROR` | 403 → `/login?error=OAuthCallback` | `warn` |
| `access_denied` (user denied consent) | `ACCESS_DENIED` | 302 → `/login?error=AccessDenied` | `info` |
| Provider API timeout | `OAUTH_GET_ACCESS_TOKEN_ERROR` | 302 → `/login?error=OAuthSignin` | `error` |
| Provider returns invalid token | `OAUTH_PARSE_USERINFO_ERROR` | 302 → `/login?error=OAuthCallback` | `error` |
| Email exists with different provider | `OAuthAccountNotLinked` | 302 → `/login?error=OAuthAccountNotLinked` | `warn` |

### 4.3 Error Redirect UX

Auth.js redirects to `/login?error={ErrorCode}` by default. The login page must parse the `error` query parameter and display a user-friendly message:

| Error Code | User-Facing Message (EN) | User-Facing Message (TH) |
|------------|--------------------------|--------------------------|
| `OAuthSignin` | "Failed to sign in with {provider}. Please try again." | "เข้าสู่ระบบด้วย {provider} ไม่สำเร็จ กรุณาลองใหม่" |
| `OAuthCallback` | "Authentication failed. Please try again." | "การยืนยันตัวตนล้มเหลว กรุณาลองใหม่" |
| `OAuthAccountNotLinked` | "An account with this email already exists. Please sign in with your original method or link your account in settings." | "อีเมนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบด้วยวิธีเดิม หรือเชื่อมโยงบัญชีในการตั้งค่า" |
| `AccessDenied` | "You denied access. To sign in, please grant the requested permissions." | "คุณปฏิเสธการเข้าถึง กรุณาอนุญาตสิทธิ์ที่ขอเพื่อเข้าสู่ระบบ" |
| `EmailCreateAccount` | "Your provider did not return an email. Please use a different sign-in method." | "ผู้ให้บริการไม่ได้ส่งอีเมลกลับ กรุณาใช้วิธีเข้าสู่ระบบอื่น" |

### 4.4 Token Refresh on Expiry

When a user returns with a valid `_nexus-session` but a **provider token** has expired (e.g., no refresh token granted), the session continues as normal (the Nexus session is independent). However, if a feature requires a live provider token (e.g., connecting Discord for server status post-MVP), the feature must handle the re-auth flow gracefully:

```typescript
// apps/web/features/auth/services/oauth-token.ts
export async function ensureFreshAccessToken(userId: string, provider: string) {
  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.provider, provider)),
  });

  if (!account?.refreshToken) return null;

  const expiresAt = (account.expiresAt ?? 0) * 1000;
  if (expiresAt > Date.now()) return account.accessToken;  // still valid

  // Refresh via Auth.js internal endpoint
  const refreshed = await fetchAccessToken(provider, account.refreshToken);
  await db.update(accounts).set({
    accessToken: refreshed.access_token,
    expiresAt: refreshed.expires_at,
    refreshToken: refreshed.refresh_token ?? account.refreshToken,  // rotate if returned
  });
  return refreshed.access_token;
}
```

---

## 5. Account Linking

### 5.1 Problem Statement

A user may have created an account with email/password credentials and later attempt to sign in with Google using the **same email**. Without account linking, Auth.js v5 (with `DrizzleAdapter`) returns `OAuthAccountNotLinked` error. M3.4 defines the resolution strategy.

### 5.2 Linking Rules

| Condition | Action | Trust Level |
|-----------|--------|-------------|
| OAuth email matches existing `credentials` user with **same email** AND email is **verified** by provider | **Link:** insert `accounts` row pointing to existing user | High (provider verified email) |
| OAuth email matches existing `credentials` user, email is **not verified** by provider | **Reject** with `OAuthAccountNotLinked` — user must log in with credentials first, then link in settings | Low (cannot prove ownership) |
| OAuth email is in DB but user signed up with a **different provider** | **Reject** with `OAuthAccountNotLinked` | Conflicting |
| OAuth email is **new** (not in DB) | **Create** new user + `accounts` row | High |
| User already has `accounts` row with same provider | **Update** tokens (re-login) | High |

### 5.3 Auth.js Configuration for Linking

```typescript
// packages/auth/src/config.ts
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: oauthProviders,
  callbacks: {
    async signIn({ user, account, profile }) {
      // Let Auth.js handle linking for verified emails
      // This callback runs AFTER Auth.js's default logic
      if (account?.provider !== "credentials") {
        // Additional custom validation can go here
        // e.g., check is_suspended
        const dbUser = await findUserById(user.id);
        if (dbUser?.is_suspended) return false;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      // On initial OAuth sign-in: persist provider info
      if (account) {
        token.channel = account.provider;
      }
      // M3.3 §3.2 rolling refresh logic...
      return token;
    },
    async session({ session, token }) {
      // M3.3 §3.3 session mapping...
      return session;
    },
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      // Audit log: OAuth sign-in
      await auditLog({
        event: "oauth_signin",
        userId: user.id,
        ip: getRequestIp(),
        metadata: {
          provider: account?.provider,
          isNewUser,
        },
      });
    },
    async linkAccount({ user, account }) {
      // Audit log: account link
      await auditLog({
        event: "account_link",
        userId: user.id,
        metadata: {
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        },
      });
    },
  },
});
```

### 5.4 Manual Link (Settings UI)

Post-login, users can link additional providers from their security settings:

| Step | Action | Guard |
|------|--------|-------|
| 1 | User navigates to `/nexus/settings/security` | `requireAuth` |
| 2 | User clicks "Link Google" | `requireAuth` + current session |
| 3 | Auth.js signs in with provider | Requires user to authenticate with provider |
| 4 | Auth.js finds current session email matches OAuth email | Links `accounts` row to current user |
| 5 | Session updated with new `channel` claim | JWT re-issued |

This flow is **only available** to authenticated users. It bypasses the `OAuthAccountNotLinked` error because the user is already identified via their session cookie.

### 5.5 Unlink Provider

Users may unlink a provider **only if** they have at least one remaining authentication method:

```typescript
// apps/web/app/api/v1/nexus/users/me/providers/[provider]/route.ts
// DELETE — unlink provider

async function unlinkProvider(request: NextRequest, { params }: { params: { provider: string } }) {
  const session = await requireApiAuth(session);

  // Count total auth methods
  const linkedProviders = await db.query.accounts.findMany({
    where: eq(accounts.userId, session.user.id),
  });
  const hasPassword = linkedProviders.some(a => a.provider === "credentials");

  if (linkedProviders.length <= 1) {
    throw new ApiError(400, "CANNOT_UNLINK", "You must have at least one sign-in method");
  }

  if (!hasPassword && linkedProviders.filter(a => a.provider !== "credentials").length <= 1) {
    throw new ApiError(400, "SET_PASSWORD_FIRST", "Set a password before unlinking your last OAuth provider");
  }

  await db.delete(accounts).where(
    and(eq(accounts.userId, session.user.id), eq(accounts.provider, params.provider))
  );

  // Also clear tokens (GDPR)
  await auditLog({ event: "account_unlink", userId: session.user.id, metadata: { provider: params.provider } });

  return { data: { message: `${params.provider} unlinked` } };
}
```

### 5.6 Linking State Diagram

```mermaid
flowchart TD
    A[OAuth callback initiated] --> B{Account exists for<br/>provider + provider_account_id?}
    B -->|Yes — existing OAuth user| C[Refresh tokens<br/>Issue session]
    B -->|No| D{Email in users table?}
    D -->|No — new email| E[Create user<br/>Create accounts row<br/>email_verified=true]
    D -->|Yes — credentials exists| F{Email verified<br/>by provider?}
    F -->|Yes| G[Create accounts row<br/>Link to existing user<br/>Issue session]
    F -->|No| H[Reject: OAuthAccountNotLinked]
    C --> I[Session JWT issued<br/>channel=provider]
    E --> I
    G --> I
```

---

## 6. Account Recovery

### 6.1 Problem Statement

Users who authenticate **exclusively via OAuth** (no password set) cannot use the standard password-reset flow. M3.4 defines recovery paths for these scenarios.

### 6.2 Recovery Scenarios

| Scenario | User Type | Recovery Path |
|----------|-----------|---------------|
| User forgot password | Has bcrypt hash | Standard password reset (M2.7 §3.4) — email token |
| User lost access to Google account | OAuth-only, no password | Recovery email flow + support verification |
| User lost access to all linked providers | OAuth-only | Support-assisted identity verification |
| User wants to add password | OAuth-only | Settings → set password (requires active OAuth session) |
| User wants to remove password | Has password + OAuth | Settings → remove password (requires linked OAuth) |

### 6.3 Recovery Email Flow (OAuth-Only Users)

```mermaid
sequenceDiagram
    participant User
    participant Next as Next.js Route
    participant DB as Neon PostgreSQL
    participant Email as Resend

    User->>Next: POST /api/auth/forgot-password
    Note over Next: Removes manual entry!
    // OAuth-only ไม่ต้องรู้รหัสผ่าน
    Next->>DB: SELECT id FROM users WHERE email = ?
    DB-->>Next: userId
    Next->>Next: Lookup linked OAuth providers
    alt OAuth-only user
        Next->>Next: generateResetToken()
        Next->>DB: INSERT password_reset_tokens<br/>(allows SET password, not RESET)
        Next->>Email: sendSetPasswordEmail(email, token)
        Email-->>User: "Set a password for your account"
    else User has password
        Next->>Email: sendResetPasswordEmail(email, token)
        Email-->>User: "Reset your password"
    end
    Next-->>User: 200 { message: "If an account exists..." }

    User->>Next: POST /api/auth/set-password { token, newPassword }
    Next->>DB: bcrypt.hash(newPassword, 12)
    Next->>DB: UPDATE users SET hashed_password = ?
    Next->>DB: DELETE password_reset_tokens
    Next-->>User: 200 { message: "Password set. You can now sign in with email." }
```

### 6.4 Password Set vs Reset Logic

The recovery email flow branches based on whether the user has a password:

```typescript
// apps/web/actions/auth.ts
async function handleForgotPassword(email: string) {
  const user = await findUserByEmail(email);
  if (!user) return ok("If an account exists...");  // anti-enumeration

  const token = generateResetToken();  // 32 bytes random
  await insertResetToken(user.id, hashToken(token));

  if (user.hashedPassword) {
    // Existing password → reset flow
    await resend.emails.send({
      to: email,
      template: "password-reset",
      data: { resetUrl: `${BASE_URL}/reset-password?token=${token}` },
    });
  } else {
    // OAuth-only → set password flow
    await resend.emails.send({
      to: email,
      template: "set-password",
      data: { setUrl: `${BASE_URL}/set-password?token=${token}` },
    });
  }

  return ok("If an account exists, an email has been sent.");
}
```

### 6.5 OAuth Provider Change in Nexus (GitHub Optional Note)

**Decision:** If a user wants to change their linked OAuth provider (e.g., from Google to Discord), there is **no automated merge**. The user must:

1. Log in with their **current** provider
2. Link the new provider in settings
3. The old provider can be unlinked (if a password or other provider remains)

This prevents account takeover via provider cycling.

### 6.6 Lost-Access-to-Provider Flow

If a user **cannot authenticate** with any linked provider and has no password, the only path is manual support verification:

1. User contacts support via email from their registered address
2. Support verifies identity (original registration date, recent activity, IP history)
3. Support issues a one-time recovery link that allows setting a password
4. User sets password and can now sign in with credentials

This is a **manual process** outside the MVP automation scope. The support tooling is defined in the admin API (M2.7 §8.4).

### 6.7 Google Email Verification Nuance

| Provider | `email_verified` behavior |
|----------|--------------------------|
| Google | `true` for all auths (Google never returns unverified emails) |
| Discord | `true` only if user has verified email in Discord settings; `false` otherwise |
| GitHub | N/A (we fetch primary email via separate API call and treat as verified) |

**Rule:** If `email_verified = false` from provider, the user must complete email verification via our `verification_tokens` flow before they can access gated features.

```typescript
// packages/auth/src/callbacks.ts
async function signIn({ user, account, profile }) {
  if (account?.provider !== "credentials") {
    const providerEmailVerified = profile.email_verified ?? false;

    if (!providerEmailVerified) {
      // Force our own verification flow
      const dbUser = await findUserById(user.id!);
      if (dbUser && !dbUser.emailVerified) {
        await sendVerificationEmail(dbUser.email);
        // Allow sign-in but flag session
      }
    }
  }
  return true;
}
```

---

## 7. Implementation Guidance

### 7.1 `packages/auth/src/config.ts` — Full Configuration

```typescript
// packages/auth/src/config.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Discord from "next-auth/providers/discord";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@nexus/db";
import { loginSchema } from "@nexus/validation";
import { TOKEN_VERSION } from "./constants";
import { auditLog } from "@nexus/audit";

export const oauthProviders = [
  Google({
    clientId: process.env.AUTH_GOOGLE_ID,
    clientSecret: process.env.AUTH_GOOGLE_SECRET,
    authorization: {
      params: {
        scope: "openid email profile",
        prompt: "consent",
        access_type: "offline",
      },
    },
  }),
  Discord({
    clientId: process.env.AUTH_DISCORD_ID,
    clientSecret: process.env.AUTH_DISCORD_SECRET,
    authorization: {
      params: {
        scope: "identify email",
      },
    },
  }),
];

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    ...oauthProviders,
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        return authenticateUser(parsed.data.email, parsed.data.password);
      },
    }),
  ],
  session: { strategy: "jwt" },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production"
        ? "__Host-nexus-session"
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      },
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "credentials") {
        const dbUser = await db.query.users.findFirst({
          where: eq(users.id, user.id!),
        });
        if (dbUser?.is_suspended) return false;

        // Discord email verification check
        if (account?.provider === "discord" && profile?.email_verified === false) {
          user.emailVerified = false;
        }
      }
      return true;
    },
    async jwt({ token, user, account, trigger }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.email = user.email;
        token.email_verified = !!user.emailVerified;
        token.name = user.name;
        token.image = user.image;
        token.channel = account?.provider ?? "credentials";
        token.device_id = user.device_id ?? null;
        token.v = TOKEN_VERSION;
      }

      // M3.3 §3.2 rolling refresh
      const expiresIn = (token.exp as number) - Math.floor(Date.now() / 1000);
      if (expiresIn < 7 * 86400) {
        token.exp = Math.floor(Date.now() / 1000) + 30 * 86400;
        token.iat = Math.floor(Date.now() / 1000);
        token.jti = crypto.randomUUID();
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub!;
      session.user.email = token.email!;
      session.user.role = token.role as "user" | "admin" | "superadmin";
      session.user.name = token.name;
      session.user.image = token.image;
      session.user.emailVerified = token.email_verified;
      session.user.deviceId = token.device_id;
      session.user.channel = token.channel;
      session.expires = new Date((token.exp as number) * 1000).toISOString();
      return session;
    },
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      await auditLog({
        event: "oauth_signin",
        userId: user.id,
        metadata: {
          provider: account?.provider,
          isNewUser,
        },
      });
    },
    async linkAccount({ user, account }) {
      await auditLog({
        event: "account_link",
        userId: user.id,
        metadata: {
          provider: account.provider,
          providerAccountId: account.providerAccountId,
        },
      });
    },
  },
});
```

### 7.2 `apps/web/app/api/auth/[...nextauth]/route.ts` — Route Handler

```typescript
// apps/web/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@nexus/auth";

export const { GET, POST } = handlers;
```

### 7.3 Login Page Provider Buttons

```tsx
// apps/web/app/(auth)/login/page.tsx
import { signIn } from "@nexus/auth";

export default function LoginPage() {
  return (
    <div className="auth-card">
      <h1>Sign in to Nexus Anime</h1>

      {/* Credentials form... */}

      <div className="oauth-divider">
        <span>or continue with</span>
      </div>

      <form action={async () => {
        "use server";
        await signIn("google", { redirectTo: "/nexus" });
      }}>
        <button type="submit" className="oauth-btn google">
          <GoogleIcon /> Sign in with Google
        </button>
      </form>

      <form action={async () => {
        "use server";
        await signIn("discord", { redirectTo: "/nexus" });
      }}>
        <button type="submit" className="oauth-btn discord">
          <DiscordIcon /> Sign in with Discord
        </button>
      </form>
    </div>
  );
}
```

### 7.4 Provider-Callback Redirect URI

Auth.js v5 auto-generates callback URLs based on the provider's registration pattern:

| Provider | Callback URL Pattern |
|----------|---------------------|
| Google | `${BASE_URL}/api/auth/callback/google` |
| Discord | `${BASE_URL}/api/auth/callback/discord` |
| GitHub | `${BASE_URL}/api/auth/callback/github` |

These must be registered in each provider's developer console:

| Provider | Console URL | Required Fields |
|----------|-------------|-----------------|
| Google | Google Cloud Console → APIs & Services → Credentials | Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`, `https://nexusanime.com/api/auth/callback/google` |
| Discord | Discord Developer Portal → OAuth2 | Redirects: `http://localhost:3000/api/auth/callback/discord`, `https://nexusanime.com/api/auth/callback/discord` |
| GitHub | GitHub Settings → Developer settings → OAuth Apps | Authorization callback URL: `http://localhost:3000/api/auth/callback/github`, `https://nexusanime.com/api/auth/callback/github` |

---

## 8. Environment Variables

### 8.1 New Variables (M3.4 Additions)

```bash
# ── OAuth Providers (S4) ─────────────────────────────────
AUTH_GOOGLE_ID=       # Google OAuth Client ID
AUTH_GOOGLE_SECRET=   # Google OAuth Client Secret
AUTH_DISCORD_ID=      # Discord Application Client ID
AUTH_DISCORD_SECRET=  # Discord Application Client Secret

# ── OAuth Providers (S7+ — GitHub) ────────────────────────
AUTH_GITHUB_ID=       # GitHub OAuth App Client ID
AUTH_GITHUB_SECRET=   # GitHub OAuth App Client Secret
```

### 8.2 Updated `.env.example` (S4)

```bash
# ── Application ──────────────────────────────────────────
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ── Database (S2) ────────────────────────────────────────
DATABASE_URL=postgresql://nexus:nexus@localhost:5432/nexus_anime

# ── Auth (S4) ────────────────────────────────────────────
AUTH_SECRET=            # openssl rand -base64 32
AUTH_URL=http://localhost:3000

# ── OAuth Providers (S4) ─────────────────────────────────
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_DISCORD_ID=
AUTH_DISCORD_SECRET=

# ── Email (S4) ───────────────────────────────────────────
RESEND_API_KEY=
EMAIL_FROM=noreply@nexusanime.com

# ── Redis (S11 Beta) ─────────────────────────────────────
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# ── Stripe (S5) ──────────────────────────────────────────
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# ── Cloudflare (S6) ────────────────────────────────────────
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_STREAM_API_TOKEN=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=

# ── Monitoring (S9) ────────────────────────────────────────
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
```

---

## 9. Database Schema

### 9.1 `accounts` Table

The `accounts` table schema is defined in M3.2 §3.6 and is managed by Auth.js v5 via `DrizzleAdapter`. M3.4 does **not** modify this schema.

```sql
CREATE TABLE accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider varchar(255) NOT NULL,
    provider_account_id varchar(255) NOT NULL,
    refresh_token text,
    access_token text,
    expires_at integer,
    token_type text,
    scope text,
    id_token text,
    session_state text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(provider, provider_account_id)
);

CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_accounts_provider ON accounts(provider, provider_account_id);
```

### 9.2 `users` Table Extensions for OAuth

No schema changes. OAuth-only users have `hashed_password = NULL`. The existing schema already supports this.

### 9.3 Data Lifecycle

| Action | `users` row | `accounts` row |
|--------|-------------|----------------|
| OAuth login (new user) | INSERT (`email_verified=NOW()`) | INSERT |
| OAuth login (existing) | No change | UPDATE tokens |
| Unlink provider | No change | DELETE `accounts` row |
| Delete account (GDPR) | `deleted_at = NOW()` | CASCADE DELETE row |

---

## 10. Security Considerations

### 10.1 CSRF & State

| Layer | Implementation | Owner |
|-------|---------------|-------|
| State parameter | Auth.js v5 generates and validates per-request | M2.7 §7.1 |
| PKCE | Auth.js v5 uses SHA-256 code_challenge by default | M3.4 §3.1 |
| Cookie `__Host-` prefix | Enforces host-only, Secure, Path=/ | M2.7 §7.1 |
| Origin header check | Middleware validates `Origin` matches expected | M2.7 §7.2 |

### 10.2 Token Storage

| Token | Storage | Encryption | Lifecycle |
|-------|---------|------------|-----------|
| Provider `access_token` | `accounts.access_token` column | At-rest encryption (Neon AES-256) | Updated on refresh |
| Provider `refresh_token` | `accounts.refresh_token` column | At-rest encryption | Stored until unlinked |
| Nexus session JWT | `__Host-nexus-session` cookie | N/A (signed, not encrypted) | 30-day rolling |
| Auth.js CSRF token | `__Host-next-auth.csrf-token` cookie | N/A | Short-lived |

### 10.3 Risk Mitigations (M2.9)

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| OAuth token leak from DB | High | Low | Neon encryption at rest; TLS in transit; no client-side access |
| Account takeover via fake provider | Critical | Very Low | Provider email verification check; state + PKCE; nonce validation |
| Cross-provider account collision | Medium | Low | Email-match linking only when provider verified email |
| User enumeration via OAuth | Medium | Low | Unified error messages; no "user not found" leak in OAuth path |
| Stale provider tokens | Low | Low | Background refresh in `ensureFreshAccessToken` |
| Account recovery abuse | Medium | Low | Rate-limit `/api/auth/forgot-password`; token expiry (1h) |

### 10.4 Audit Events (OAuth)

| Event Type | Trigger | Fields |
|------------|---------|--------|
| `oauth_signin` | Successful OAuth sign-in | userId, provider, isNewUser |
| `oauth_callback` | Callback received | provider, email_verified |
| `account_link` | Provider linked post-login | userId, provider, providerAccountId |
| `account_unlink` | Provider unlinked | userId, provider |
| `account_link_failed` | OAuthAccountNotLinked triggered | provider, email (masked) |
| `password_set_via_recovery` | OAuth-only user set password | userId |

---

## 11. Sprint Deliverables

### 11.1 Sprint S4 (Auth — MVP)

| Deliverable | File(s) | Status |
|-------------|---------|--------|
| Auth.js config with Google provider | `packages/auth/src/config.ts` | ⬜ |
| Auth.js config with Discord provider (Beta) | `packages/auth/src/config.ts` | ⬜ |
| OAuth callback handler (via Auth.js) | `packages/auth/src/callbacks.ts` | ⬜ |
| Account linking logic | `packages/auth/src/callbacks.ts` | ⬜ |
| Login page with provider buttons | `apps/web/app/(auth)/login/page.tsx` | ⬜ |
| Register page with provider buttons | `apps/web/app/(auth)/register/page.tsx` | ⬜ |
| Error page for OAuth failures | `apps/web/app/(auth)/error/page.tsx` | ⬜ |
| Recovery email (set password variant) | `packages/email/templates/set-password.tsx` | ⬜ |
| `AUTH_GOOGLE_ID/SECRET` env in `lib/env.ts` | `apps/web/lib/env.ts` | ⬜ |
| `AUTH_DISCORD_ID/SECRET` env in `lib/env.ts` | `apps/web/lib/env.ts` | ⬜ |
| Audit events for OAuth flows | `packages/auth/src/audit.ts` | ⬜ |
| OAuth integration tests | `apps/web/__tests__/oauth.test.ts` | ⬜ |

### 11.2 Sprint S5 (Billing + Session Integration)

| Deliverable | File(s) | Status |
|-------------|---------|--------|
| Device tracking integration for OAuth logins | `packages/auth/src/device.ts` | ⬜ |
| New-device notification for OAuth sessions | `packages/email/templates/new-device.tsx` | ⬜ |
| Account recovery flow | `apps/web/app/(auth)/set-password/page.tsx` | ⬜ |

### 11.3 Sprint S7+ (Optional — GitHub)

| Deliverable | File(s) | Status |
|-------------|---------|--------|
| GitHub provider in config | `packages/auth/src/config.ts` | ⬜ |
| GitHub provider button on login | `apps/web/app/(auth)/login/page.tsx` | ⬜ |
| `AUTH_GITHUB_ID/SECRET` env | `apps/web/lib/env.ts` | ⬜ |

---

## 12. References

- [M2.7 — Authentication Architecture](authentication-architecture.md) — auth flows, RBAC, trust boundaries, security architecture
- [M3.3 — Session & Token Strategy](session-strategy.md) — JWT structure, rolling refresh, token revocation, device tracking
- [M3.2 — User Domain Design](../user-domain-design.md) — user entities, `accounts` schema, OAuthAccount lifecycle
- [M2.5 — Redis Strategy](../redis-strategy.md) — cache domains, key conventions, rate limiting
- [M2.1 — Backend Architecture](backend-architecture.md) — module structure, dependency rules
- [API Specification](../api-specification.md) — request/response contracts
- [Environment Specification](../environment-specification.md) — §4.2 auth variables
- [Auth.js v5 Documentation](https://authjs.dev/)
- [Auth.js v5 Google Provider](https://authjs.dev/getting-started/providers/google)
- [Auth.js v5 Discord Provider](https://authjs.dev/getting-started/providers/discord)
- [OAuth 2.0 Security Best Current Practice](https://datatracker.ietf.org/doc/html/rfc9700)

---

*This document is the authoritative reference for the Nexus Anime OAuth provider strategy. All OAuth flows, account linking, account recovery, and provider configuration must conform to this specification.*
