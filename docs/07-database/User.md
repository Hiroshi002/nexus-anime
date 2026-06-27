# User

> **Step 7 — Database Design**
> Defines the identity cluster: `users`, `user_accounts`, `user_sessions`. Auth.js v5 is the authentication layer; these tables are its relational backing store.

---

## 1. Purpose

The identity cluster owns **who a user is** and **how they prove it**. Auth.js v5 manages the authentication flow (OAuth handoffs, credential hashing, session issuance); the tables below persist the resulting identity and session state so the rest of the platform can reference a stable `user_id`.

**Design principle:** Auth.js owns the _protocol_ (tokens, OAuth state, password hashing); these tables own the _records_. We never implement custom auth logic.

---

## 2. `users` Table

The master account record. One row per human (or bot/service account) of the platform.

### 2.1 Fields

| Column              | Type            | Constraint                              | Description                                                                              |
| ------------------- | --------------- | --------------------------------------- | ---------------------------------------------------------------------------------------- |
| `id`                | `uuid`          | `PRIMARY KEY DEFAULT gen_random_uuid()` | Surrogate key — never exposed as a sequence.                                             |
| `username`          | `citext`        | `NOT NULL`                              | Public handle. Unique among active accounts. 3–32 chars, `[a-z0-9_]`.                    |
| `email`             | `citext`        | `NOT NULL`                              | Login & contact address. Unique among active accounts. Validated by Zod at the boundary. |
| `email_verified_at` | `timestamptz`   | nullable                                | When the email was confirmed. `NULL` until verified.                                     |
| `display_name`      | `text`          | nullable                                | Freeform shown name. Defaults to `username` when null at the app layer.                  |
| `avatar_url`        | `text`          | nullable                                | URL to avatar image (validated as URL by Zod).                                           |
| `bio`               | `text`          | nullable                                | Short profile text. Sanitized via DOMPurify before render; plain text only.              |
| `role`              | `text`          | `NOT NULL DEFAULT 'viewer'`             | Access tier. See §2.3.                                                                   |
| `preferences`       | `jsonb`         | `NOT NULL DEFAULT '{}'`                 | UI prefs (theme, autoplay, language). GIN-indexed for key lookups.                       |
| `last_login_at`     | `timestamptz`   | nullable                                | Last successful login. Updated by Auth.js callback.                                      |
| `last_login_ip`     | `inet`          | nullable                                | Source IP of last login (security/anti-abuse).                                           |
| `deleted_at`        | `timestamptz`   | nullable                                | Soft-delete marker.                                                                      |
| `created_at`        | `timestamptz`   | `NOT NULL DEFAULT now()`                | —                                                                                        |
| `updated_at`        | `timestamptz`   | `NOT NULL DEFAULT now()`                | —                                                                                        |
| `created_by`        | `uuid` nullable | FK → `users.id`                         | Self-referential; `NULL` for self-signup, set for admin-provisioned accounts.            |
| `updated_by`        | `uuid` nullable | FK → `users.id`                         | Last mutator.                                                                            |

### 2.2 Constraints

| Name                        | Type           | Definition                                   |
| --------------------------- | -------------- | -------------------------------------------- |
| `uq_users_username`         | partial unique | `UNIQUE (username) WHERE deleted_at IS NULL` |
| `uq_users_email`            | partial unique | `UNIQUE (email) WHERE deleted_at IS NULL`    |
| `chk_users_username_format` | check          | `username ~ '^[a-z0-9_]{3,32}$'`             |
| `chk_users_role_range`      | check          | `role IN ('viewer', 'moderator', 'admin')`   |

**Why partial unique?** A soft-deleted account frees its `username`/`email` so they can be re-registered, while still preserving the old row for history. A full unique index would block re-registration.

### 2.3 Roles

| Role        | Meaning                                               | Granted by          |
| ----------- | ----------------------------------------------------- | ------------------- |
| `viewer`    | Default consumer. Can watch, bookmark, comment, rate. | Signup.             |
| `moderator` | Can hide/delete comments, mute users.                 | Admin action.       |
| `admin`     | Full platform management.                             | Admin action + MFA. |

Roles are **application-enforced**, not Postgres RLS (see `Database-Overview.md` §8). This keeps authorization logic in one testable layer (the service/repository) rather than split between DB and app.

### 2.4 Indexes

| Index                     | Type                    | Columns                               | Purpose                                                                  |
| ------------------------- | ----------------------- | ------------------------------------- | ------------------------------------------------------------------------ |
| `pk_users`                | btree (unique)          | `id`                                  | PK lookup.                                                               |
| `idx_users_username`      | btree (unique, partial) | `username` `WHERE deleted_at IS NULL` | Login by username.                                                       |
| `idx_users_email`         | btree (unique, partial) | `email` `WHERE deleted_at IS NULL`    | Login by email.                                                          |
| `idx_users_last_login_at` | btree                   | `last_login_at`                       | Admin queries, churn analysis.                                           |
| `idx_users_preferences`   | GIN                     | `preferences`                         | Lookup users by a pref key (e.g. `preferences @> '{"autoplay": true}'`). |

### 2.5 Decisions & Rationale

- **`citext` for `username`/`email`:** Case-insensitive by default. Prevents `Alice@x.com` and `alice@x.com` coexisting — a classic account-takeover vector. Avoids `lower()` in every query and unique index.
- **`preferences` as `jsonb`:** User prefs are sparse, user-specific, and evolve without schema changes. A normalized EAV table would require a migration for every new pref. GIN indexing keeps key lookups fast.
- **`last_login_ip` as `inet`:** Native IP type supports range queries (e.g. "logins from this /24") for anti-abuse, and validates format.
- **No `password_hash` here:** Credential secrets live in `user_accounts` (or Auth.js' own adapter table). Separating secrets from the profile limits the blast radius of a `users` table leak.

---

## 3. `user_accounts` Table

Links a user to one or more **authentication providers** (Google, GitHub, credential). This mirrors Auth.js v5's `Account` model.

### 3.1 Fields

| Column                    | Type          | Constraint                              | Description                                                                  |
| ------------------------- | ------------- | --------------------------------------- | ---------------------------------------------------------------------------- |
| `id`                      | `uuid`        | `PRIMARY KEY DEFAULT gen_random_uuid()` | —                                                                            |
| `user_id`                 | `uuid`        | `NOT NULL` FK → `users.id`              | Owner.                                                                       |
| `provider`                | `text`        | `NOT NULL`                              | Provider id: `'credentials'`, `'google'`, `'github'`.                        |
| `provider_account_id`     | `text`        | `NOT NULL`                              | The user's id at the provider.                                               |
| `access_token_encrypted`  | `text`        | nullable                                | Encrypted OAuth access token (at-rest encryption).                           |
| `refresh_token_encrypted` | `text`        | nullable                                | Encrypted OAuth refresh token.                                               |
| `access_token_expires_at` | `timestamptz` | nullable                                | Token expiry.                                                                |
| `token_type`              | `text`        | nullable                                | Usually `'Bearer'`.                                                          |
| `scope`                   | `text`        | nullable                                | OAuth scopes granted.                                                        |
| `id_token`                | `text`        | nullable                                | OIDC id token (if provided).                                                 |
| `password_hash`           | `text`        | nullable                                | **Only** for `provider = 'credentials'`. Argon2id hash. NULL for OAuth rows. |
| `created_at`              | `timestamptz` | `NOT NULL DEFAULT now()`                | —                                                                            |
| `updated_at`              | `timestamptz` | `NOT NULL DEFAULT now()`                | —                                                                            |

### 3.2 Constraints

| Name                                              | Type   | Definition                                               |
| ------------------------------------------------- | ------ | -------------------------------------------------------- |
| `uq_user_accounts_provider`                       | unique | `UNIQUE (provider, provider_account_id)`                 |
| `chk_user_accounts_credentials_requires_password` | check  | `provider <> 'credentials' OR password_hash IS NOT NULL` |

### 3.3 Indexes

| Index                               | Type           | Columns                           | Purpose                        |
| ----------------------------------- | -------------- | --------------------------------- | ------------------------------ |
| `pk_user_accounts`                  | btree (unique) | `id`                              | PK.                            |
| `idx_user_accounts_user_id`         | btree          | `user_id`                         | List a user's linked accounts. |
| `idx_user_accounts_provider_lookup` | btree (unique) | `(provider, provider_account_id)` | Auth.js sign-in lookup.        |

### 3.4 Decisions & Rationale

- **Encrypted tokens at rest:** OAuth tokens are secrets. We encrypt with AES-256-GCM (key in Vault) so a raw table dump is useless. The application decrypts on use.
- **`password_hash` nullable, only for credentials:** Keeps credential secrets in one column; OAuth rows never carry a password. The check constraint enforces this invariant.
- **Composite unique on `(provider, provider_account_id)`:** A given Google account links to exactly one Nexus user. Prevents duplicate links.

---

## 4. `user_sessions` Table

Active sessions. Auth.js issues a session token; we persist a hashed copy so we can validate, list, and revoke sessions.

### 4.1 Fields

| Column               | Type          | Constraint                              | Description                                                            |
| -------------------- | ------------- | --------------------------------------- | ---------------------------------------------------------------------- |
| `id`                 | `uuid`        | `PRIMARY KEY DEFAULT gen_random_uuid()` | —                                                                      |
| `user_id`            | `uuid`        | `NOT NULL` FK → `users.id`              | Owner.                                                                 |
| `session_token_hash` | `text`        | `NOT NULL`                              | SHA-256 of the session token (the raw token lives only in the cookie). |
| `expires_at`         | `timestamptz` | `NOT NULL`                              | Absolute expiry.                                                       |
| `ip_address`         | `inet`        | nullable                                | Source IP at creation.                                                 |
| `user_agent`         | `text`        | nullable                                | Client UA at creation.                                                 |
| `created_at`         | `timestamptz` | `NOT NULL DEFAULT now()`                | —                                                                      |
| `updated_at`         | `timestamptz` | `NOT NULL DEFAULT now()`                | —                                                                      |

### 4.2 Constraints

| Name                     | Type   | Definition                    |
| ------------------------ | ------ | ----------------------------- |
| `uq_user_sessions_token` | unique | `UNIQUE (session_token_hash)` |

### 4.3 Indexes

| Index                            | Type           | Columns              | Purpose                                 |
| -------------------------------- | -------------- | -------------------- | --------------------------------------- |
| `pk_user_sessions`               | btree (unique) | `id`                 | PK.                                     |
| `idx_user_sessions_token_lookup` | btree (unique) | `session_token_hash` | Validate a session cookie.              |
| `idx_user_sessions_user_id`      | btree          | `user_id`            | List a user's sessions (security page). |
| `idx_user_sessions_expires_at`   | btree          | `expires_at`         | Purge job scans for expired sessions.   |

### 4.4 Decisions & Rationale

- **Store only the token hash:** The raw session token is a bearer secret — if the table is leaked, hashing prevents session hijacking. SHA-256 is sufficient here (the token itself is high-entropy).
- **No `deleted_at`:** Sessions are hard-deleted on expiry or logout. They are ephemeral by nature; soft-delete would bloat the table.
- **`expires_at` index:** A background job periodically `DELETE`s expired sessions. The index turns this into a range scan instead of a full table scan.

---

## 5. Identity Cluster — Cross-Cutting Rules

| Rule                       | Detail                                                                                                                                                                                                                                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cascade on hard-delete** | When a user is hard-deleted (GDPR erasure), `user_accounts`, `user_sessions`, `bookmarks`, `ratings`, `notifications`, `search_history`, and `continue_watching` are hard-deleted. `watch_history` is anonymized (see `Watch-History.md`). `comments` are preserved with author set to `[deleted]`. |
| **Anonymization**          | Erasure replaces `username`, `email`, `display_name`, `avatar_url`, `bio`, `last_login_ip` with `NULL`/placeholder. The `id` is retained so foreign keys stay valid.                                                                                                                                |
| **Audit**                  | Every role change, email change, and account link/unlink writes an `audit_log` row.                                                                                                                                                                                                                 |
| **Rate limiting**          | Signup and login attempts are rate-limited via Redis (`@nexus/cache`), not DB constraints — the DB is the system of record, not the throttle.                                                                                                                                                       |
