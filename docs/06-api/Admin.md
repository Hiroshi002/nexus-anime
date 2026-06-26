# Admin

> **Authoritative endpoint reference** for the `/api/v1/admin/*` resource tree. Covers user management, catalog curation, import orchestration, moderation queues, audit trail, broadcast notifications, platform stats, and deep health checks.
>
> Ownership: **Lead API Architect**. Last reviewed: 2026-06-26.

---

## 1. Purpose

The Admin API is the operational surface for users holding the `admin` role. It is not a public API — every endpoint in this document rejects non-admin callers with `403 FORBIDDEN` and rejects unauthenticated callers with `401 UNAUTHORIZED`.

Responsibilities covered here:

- **User management** — list, read, update (ban, role assignment), soft-delete.
- **Catalog curation** — list anime including soft-deleted rows, trigger asynchronous imports from upstream providers (TMDB, AniList).
- **Moderation** — comments queue, ratings queue, approve/hide/remove actions.
- **Audit trail** — immutable record of privileged actions, retained for 7 years.
- **Broadcast notifications** — create platform-wide or targeted notification campaigns.
- **Platform stats** — aggregate counts and time-series for users, anime, views, ratings, signups.
- **Deep health check** — liveness and dependency status (DB, Redis, upstream APIs).

All admin endpoints share the error envelope and code registry defined in [`Error-Codes.md`](./Error-Codes.md). The codes you will see here:

| Code                 | HTTP | Trigger in this resource                  |
| :------------------- | :--- | :---------------------------------------- |
| `VALIDATION_ERROR`   | 400  | Query/body failed Zod schema             |
| `FIELD_REQUIRED`     | 400  | Nested in `VALIDATION_ERROR.details`      |
| `FIELD_INVALID`      | 400  | Nested in `VALIDATION_ERROR.details`      |
| `UNAUTHORIZED`       | 401  | Missing or invalid bearer token           |
| `FORBIDDEN`          | 403  | Authenticated caller lacks admin role     |
| `USER_NOT_FOUND`     | 404  | User `id` lookup miss (excludes soft-deleted unless noted) |
| `ANIME_NOT_FOUND`    | 404  | Anime `id` lookup miss                    |
| `IMPORT_JOB_NOT_FOUND` | 404 | Import job `id` lookup miss             |
| `CONFLICT`           | 409  | Version mismatch on PATCH, or duplicate import job |
| `RATE_LIMITED`       | 429  | Quota exhausted (120/60s)                 |
| `INTERNAL_ERROR`     | 500  | Unhandled failure                         |

---

## 2. Authentication & authorization

Every endpoint in this document requires:

```
Authorization: Bearer <token>
```

The bearer token is validated by middleware before the handler runs. The handler then asserts `role = "admin"` on the resolved user. A missing or invalid token returns `401 UNAUTHORIZED`; a valid token for a non-admin user returns `403 FORBIDDEN`.

Role assignment is governed by the `users.role` enum (`viewer | moderator | admin`) described in [`Profiles.md`](./Profiles.md) and the `users` schema in `docs/07-database`.

---

## 3. Audit log

Every mutating endpoint in this document (PATCH, DELETE, POST where a write occurs) writes an immutable row to the `audit_log` table. The append-only contract:

- Rows are **never updated or deleted** by application code. The only removal path is the 7-year retention TTL defined in `docs/07-database`.
- Each row records: `actor_id` (the admin user), `action` (e.g. `user.update`, `comment.moderate`, `anime.import`), `resource_type`, `resource_id`, `metadata` (JSONB — before/after diff or action-specific payload), `created_at`.
- Audit writes happen inside the same transaction as the mutation. A failed mutation leaves no audit row; a failed audit write fails the whole request with `500 INTERNAL_ERROR`.
- Audit rows are queryable through `GET /api/v1/admin/audit-log` (section 9).

The 7-year retention is enforced by a database-level TTL or partition-rotation migration — application code does not run `DELETE` against this table.

---

## 4. Rate limiting

Admin endpoints use a **higher quota** than the default public bucket:

| Parameter | Value |
| :-------- | :---- |
| `limit`   | 120   |
| `window`  | 60s   |
| `key`     | `nexus:ratelimit:admin:{userId}` |

The bucket is keyed per admin user, not per IP, because admin sessions are assumed to originate from a small set of known operators. A `429 RATE_LIMITED` reply includes the standard `Retry-After` header.

See [`Rate-Limiting.md`](./Rate-Limiting.md) for the algorithm and scoping rules.

---

## 5. Cache headers

Read-only admin endpoints (sections 6.1, 6.2, 6.5, 7, 8, 9, 10, 12) emit:

```
Cache-Control: private, max-age=0, no-store
```

Rationale: admin responses contain privileged data that must not be cached by shared CDN edges. The client may cache locally (`private`) but intermediate proxies must not.

Mutation endpoints (sections 6.3, 6.4, 6.6, 8.2, 11) emit no cache header — responses are not cacheable by definition.

---

## 6. User management

### 6.1. `GET /api/v1/admin/users` — list users

#### Purpose

Paginated list of users with filtering and search. Used by the admin user directory.

#### Method & URL

```
GET /api/v1/admin/users
```

#### Auth

Admin role required.

#### Query parameters

All optional. Combining filters is an AND operation; list params are OR-within-facet.

| Parameter      | Type | Default | Description |
| :------------- | :--- | :------ | :---------- |
| `role?`        | `"viewer" \| "moderator" \| "admin"` | — | Filter by role. Exact match. |
| `is_banned?`   | `boolean` | — | Filter by ban status. |
| `created_from?` | `string` (ISO-8601) | — | Inclusive lower bound on `created_at`. |
| `created_to?`  | `string` (ISO-8601) | — | Inclusive upper bound on `created_at`. |
| `q?`           | `string` | — | Free-text search across `username`, `display_name`, `email`. Trigram match. |
| `cursor?`      | `string` | — | Opaque cursor from `meta.pagination.nextCursor`. |
| `limit?`       | `integer` (1–100) | `25` | Page size. Hard cap 100. |

#### Response schema

```ts
{
  data: AdminUserSummary[],
  meta: {
    requestId: string,
    pagination: {
      nextCursor: string | null,
      hasMore: boolean,
    },
  }
}
```

`AdminUserSummary`:

```ts
{
  id: string;
  username: string;
  display_name: string | null;
  email: string;
  email_verified: boolean;
  role: "viewer" | "moderator" | "admin";
  is_banned: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
```

---

### 6.2. `GET /api/v1/admin/users/{id}` — user detail

#### Purpose

Full user record for the admin detail view. Includes soft-deleted users.

#### Method & URL

```
GET /api/v1/admin/users/{id}
```

#### Auth

Admin role required.

#### Path parameters

| Parameter | Type | Description |
| :-------- | :--- | :---------- |
| `id`      | `string` (uuid) | User ID. |

#### Response schema

```ts
{
  data: AdminUserDetail,
  meta: { requestId: string },
}
```

`AdminUserDetail` extends `AdminUserSummary` with:

```ts
{
  bio: string | null;
  preferences: UserPreferences;
  last_login_at: string | null;
  login_count: number;
}
```

A soft-deleted user is returned with `deleted_at` populated. A non-existent user returns `404 USER_NOT_FOUND`.

---

### 6.3. `PATCH /api/v1/admin/users/{id}` — update user

#### Purpose

Update ban status or role. Partial update — only the fields in the request body are modified.

#### Method & URL

```
PATCH /api/v1/admin/users/{id}
```

#### Auth

Admin role required.

#### Path parameters

| Parameter | Type | Description |
| :-------- | :--- | :---------- |
| `id`      | `string` (uuid) | User ID. |

#### Request body

```ts
{
  role?: "viewer" | "moderator"";   // Cannot be set to "admin" via this endpoint — admin assignment is an out-of-band operation.
  is_banned?: boolean;
  banned_reason?: string;            // Required when is_banned=true; ignored otherwise. Max 500 chars.
}
```

Validation rules:

- At least one field must be present.
- `role` cannot be set to `admin` through this endpoint. Attempting to do so returns `400 VALIDATION_ERROR` with code `FIELD_INVALID`.
- `banned_reason` is required when transitioning from unbanned to banned. It is stored on the user row and in the audit log `metadata`.
- Banning an already-banned user without changing `banned_reason` is a no-op (not an error).
- `is_banned: false` clears `banned_reason`.

#### Response schema

```ts
{
  data: AdminUserDetail,
  meta: { requestId: string },
}
```

#### Audit

Action: `user.update`. Metadata includes `{ before, after }` for changed fields.

---

### 6.4. `DELETE /api/v1/admin/users/{id}` — soft-delete user

#### Purpose

Soft-deletes a user by setting `deleted_at`. The user's data is preserved for the retention period; the row is excluded from all non-admin queries.

#### Method & URL

```
DELETE /api/v1/admin/users/{id}
```

#### Auth

Admin role required.

#### Path parameters

| Parameter | Type | Description |
| :-------- | :--- | :---------- |
| `id`      | `string` (uuid) | User ID. |

#### Query parameters

| Parameter | Type | Default | Description |
| :-------- | :--- | :------ | :---------- |
| `hard?`   | `boolean` | `false` | When `true`, performs a hard delete. Requires a separate `admin:hard-delete` permission flag (see `docs/07-database`). Default soft delete is the only option without that flag. |

#### Response

`204 No Content` on success. No body.

A soft-deleted user cannot log in but their data remains queryable through the admin detail endpoint (section 6.2) and the audit log (section 9).

#### Audit

Action: `user.delete`. Metadata includes `{ hard: boolean, deleted_at }`.

---

## 7. Catalog curation

### 7.1. `GET /api/v1/admin/anime` — list anime (including soft-deleted)

#### Purpose

Paginated anime list for the admin catalog dashboard. Unlike the public catalog endpoint, this endpoint returns soft-deleted rows by default and exposes audit fields (`version`, `deleted_at`).

#### Method & URL

```
GET /api/v1/admin/anime
```

#### Auth

Admin role required.

#### Query parameters

| Parameter        | Type | Default | Description |
| :--------------- | :--- | :------ | :---------- |
| `includeDeleted?` | `boolean` | `true` | When `false`, excludes soft-deleted rows. When `true` (default), includes them. |
| `q?`             | `string` | — | Free-text search across `title`, `title_jp`, `title_synonyms`, `slug`. |
| `status?`        | `AnimeStatus` | — | Filter by lifecycle status. |
| `type?`          | `AnimeType` | — | Filter by type. |
| `sort?`          | `"title" \| "created_at" \| "updated_at" \| "popularity"` | `"created_at"` | Sort field. |
| `order?`         | `"asc" \| "desc"` | `"desc"` | Sort direction. |
| `cursor?`        | `string` | — | Opaque cursor. |
| `limit?`         | `integer` (1–100) | `25` | Page size. |

#### Response schema

```ts
{
  data: AdminAnimeSummary[],
  meta: {
    requestId: string,
    pagination: {
      nextCursor: string | null,
      hasMore: boolean,
    },
  }
}
```

`AdminAnimeSummary` includes all fields from the public `AnimeSummary` plus:

```ts
{
  deleted_at: string | null;
  version: number;
}
```

---

### 7.2. `POST /api/v1/admin/anime/import` — trigger upstream import

#### Purpose

Triggers an asynchronous import of anime metadata from an upstream provider (TMDB or AniList). Returns a job ID immediately; the client polls `GET /api/v1/admin/import-jobs/{id}` for completion.

#### Method & URL

```
POST /api/v1/admin/anime/import
```

#### Auth

Admin role required.

#### Request body

```ts
{
  provider: "tmdb" | "anilist";   // Required
  mode: "full" | "delta";         // Required. "full" re-imports all; "delta" only fetches updates since last import.
  tmdb_id?: number;                // Optional. When present, imports a single TMDB entry by ID.
  anilist_id?: number;             // Optional. When present, imports a single AniList entry by ID.
}
```

Validation rules:

- Exactly one of `tmdb_id` / `anilist_id` may be supplied when `mode = "full"` and you want a single-entry import. Omitting both imports the full catalog (or delta range).
- `mode = "delta"` requires a prior successful import for the provider; otherwise returns `409 CONFLICT`.

#### Response schema

`202 Accepted`:

```ts
{
  data: {
    jobId: string;         // uuid
    status: "queued";
    estimatedDurationSeconds: number | null;
  },
  meta: { requestId: string },
}
```

The import runs out-of-band via a queue worker. On completion, the job row is updated to `succeeded` or `failed` with an error message.

#### Audit

Action: `anime.import`. Metadata includes `{ provider, mode, tmdb_id?, anilist_id? }`.

---

### 7.3. `GET /api/v1/admin/import-jobs/{id}` — import job status

#### Purpose

Poll endpoint for an asynchronous import job.

#### Method & URL

```
GET /api/v1/admin/import-jobs/{id}
```

#### Auth

Admin role required.

#### Path parameters

| Parameter | Type | Description |
| :-------- | :--- | :---------- |
| `id`      | `string` (uuid) | Job ID returned by the import endpoint. |

#### Response schema

```ts
{
  data: ImportJob,
  meta: { requestId: string },
}
```

`ImportJob`:

```ts
{
  id: string;
  provider: "tmdb" | "anilist";
  mode: "full" | "delta";
  status: "queued" | "running" | "succeeded" | "failed";
  totalRecords: number | null;
  processedRecords: number;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}
```

A `404 IMPORT_JOB_NOT_FOUND` is returned for unknown IDs.

---

## 8. Moderation

### 8.1. `GET /api/v1/admin/comments` — moderation queue

#### Purpose

Paginated list of comments pending moderation. Used by the admin moderation dashboard.

#### Method & URL

```
GET /api/v1/admin/comments
```

#### Auth

Admin role required.

#### Query parameters

| Parameter     | Type | Default | Description |
| :------------ | :--- | :------ | :---------- |
| `is_hidden?`  | `boolean` | — | Filter by hidden status. When omitted, returns all regardless of hidden state. |
| `is_flagged?` | `boolean` | — | Filter by flagged status. When omitted, returns all. |
| `sort?`       | `"created_at" \| "flag_count"` | `"created_at"` | Sort field. |
| `order?`      | `"asc" \| "desc"` | `"desc"` | Sort direction. |
| `cursor?`     | `string` | — | Opaque cursor. |
| `limit?`      | `integer` (1–100) | `25` | Page size. |

#### Response schema

```ts
{
  data: AdminComment[],
  meta: {
    requestId: string,
    pagination: {
      nextCursor: string | null,
      hasMore: boolean,
    },
  }
}
```

`AdminComment`:

```ts
{
  id: string;
  user_id: string;
  username: string;
  anime_id: string;
  anime_title: string;
  body: string;              // Raw text as stored
  is_hidden: boolean;
  is_flagged: boolean;
  flag_count: number;
  created_at: string;
  updated_at: string;
}
```

---

### 8.2. `POST /api/v1/admin/comments/{id}/moderate` — moderate a comment

#### Purpose

Approve, hide, or remove a single comment.

#### Method & URL

```
POST /api/v1/admin/comments/{id}/moderate
```

#### Auth

Admin role required.

#### Path parameters

| Parameter | Type | Description |
| :-------- | :--- | :---------- |
| `id`      | `string` (uuid) | Comment ID. |

#### Request body

```ts
{
  action: "approve" | "hide" | "remove";  // Required
  reason?: string;                        // Optional. Stored in audit metadata. Max 500 chars.
}
```

Action semantics:

| Action   | Effect |
| :------- | :----- |
| `approve` | Clears `is_flagged` and `is_hidden`. Resets `flag_count` to 0. |
| `hide`    | Sets `is_hidden = true`. The comment is hidden from public view but preserved. |
| `remove`  | Soft-deletes the comment (sets `deleted_at`). The row is excluded from all public and moderation queries. |

#### Response schema

```ts
{
  data: AdminComment,          // For approve/hide
  meta: { requestId: string },
}
```

`204 No Content` for `remove`.

#### Audit

Action: `comment.moderate`. Metadata includes `{ action, reason?, before, after }`.

---

### 8.3. `GET /api/v1/admin/ratings` — ratings moderation

#### Purpose

Paginated list of ratings that have been flagged for review.

#### Method & URL

```
GET /api/v1/admin/ratings
```

#### Auth

Admin role required.

#### Query parameters

| Parameter     | Type | Default | Description |
| :------------ | :--- | :------ | :---------- |
| `is_flagged?` | `boolean` | — | Filter by flagged status. |
| `cursor?`     | `string` | — | Opaque cursor. |
| `limit?`      | `integer` (1–100) | `25` | Page size. |

#### Response schema

```ts
{
  data: AdminRating[],
  meta: {
    requestId: string,
    pagination: {
      nextCursor: string | null,
      hasMore: boolean,
    },
  }
}
```

`AdminRating`:

```ts
{
  id: string;
  user_id: string;
  username: string;
  anime_id: string;
  anime_title: string;
  score: number;             // 1–10
  is_flagged: boolean;
  created_at: string;
}
```

Individual ratings cannot be edited or removed through this endpoint. A `POST /api/v1/admin/ratings/{id}/moderate` endpoint may be added in a future milestone; today, rating moderation is a read-only queue that feeds into the comment moderation workflow.

---

## 9. `GET /api/v1/admin/audit-log` — audit trail

#### Purpose

Paginated, filterable view of the immutable audit log.

#### Method & URL

```
GET /api/v1/admin/audit-log
```

#### Auth

Admin role required.

#### Query parameters

| Parameter       | Type | Default | Description |
| :-------------- | :--- | :------ | :---------- |
| `actor_id?`     | `string` (uuid) | — | Filter by the admin user who performed the action. |
| `resource_type?` | `string` | — | Filter by resource type (e.g. `user`, `comment`, `anime`). |
| `action?`       | `string` | — | Filter by action name (e.g. `user.update`, `comment.moderate`). |
| `created_from?` | `string` (ISO-8601) | — | Inclusive lower bound on `created_at`. |
| `created_to?`   | `string` (ISO-8601) | — | Inclusive upper bound on `created_at`. |
| `cursor?`       | `string` | — | Opaque cursor. |
| `limit?`        | `integer` (1–100) | `50` | Page size. |

#### Response schema

```ts
{
  data: AuditLogEntry[],
  meta: {
    requestId: string,
    pagination: {
      nextCursor: string | null,
      hasMore: boolean,
    },
  }
}
```

`AuditLogEntry`:

```ts
{
  id: string;
  actor_id: string;
  actor_username: string;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}
```

The audit log is **read-only** through this endpoint. There is no write, update, or delete path except the 7-year retention TTL.

---

## 10. `GET /api/v1/admin/notifications` — broadcast notifications

#### Purpose

Lists existing broadcast notification campaigns. This endpoint is read-only; broadcast creation is handled through an internal tool or a future `POST` endpoint.

#### Method & URL

```
GET /api/v1/admin/notifications
```

#### Auth

Admin role required.

#### Query parameters

| Parameter       | Type | Default | Description |
| :-------------- | :--- | :------ | :---------- |
| `status?`       | `"draft" \| "scheduled" \| "sent" \| "cancelled"` | — | Filter by campaign status. |
| `created_from?` | `string` (ISO-8601) | — | Inclusive lower bound on `created_at`. |
| `created_to?`   | `string` (ISO-8601) | — | Inclusive upper bound on `created_at`. |
| `cursor?`       | `string` | — | Opaque cursor. |
| `limit?`        | `integer` (1–100) | `25` | Page size. |

#### Response schema

```ts
{
  data: AdminNotificationCampaign[],
  meta: {
    requestId: string,
    pagination: {
      nextCursor: string | null,
      hasMore: boolean,
    },
  }
}
```

`AdminNotificationCampaign`:

```ts
{
  id: string;
  title: string;
  body: string;
  audience: "all" | "role:viewer" | "role:moderator" | "role:admin";
  scheduled_at: string | null;
  sent_at: string | null;
  status: "draft" | "scheduled" | "sent" | "cancelled";
  created_by: string;          // actor_id
  created_at: string;
  updated_at: string;
}
```

---

## 11. `GET /api/v1/admin/stats` — platform stats

#### Purpose

Aggregate counts and time-series data for the admin dashboard.

#### Method & URL

```
GET /api/v1/admin/stats
```

#### Auth

Admin role required.

#### Query parameters

| Parameter | Type | Default | Description |
| :-------- | :--- | :------ | :---------- |
| `from?`   | `string` (ISO-8601) | 30 days before `to` | Start of the time range. |
| `to?`     | `string` (ISO-8601) | now | End of the time range. |
| `metrics?` | `string[]` (CSV or repeated) | all | One or more of: `users`, `anime`, `views`, `ratings`, `signups`. |

#### Response schema

```ts
{
  data: PlatformStats,
  meta: { requestId: string },
}
```

`PlatformStats`:

```ts
{
  range: { from: string; to: string };
  totals: {
    users: number;
    anime: number;
    views: number;
    ratings: number;
  };
  signups: TimeSeriesPoint[];   // Daily signup count within the range
  viewsByDay: TimeSeriesPoint[];
  ratingsByDay: TimeSeriesPoint[];
}

TimeSeriesPoint: { date: string; value: number }
```

The `signups`, `viewsByDay`, and `ratingsByDay` arrays are only present when the corresponding metric is requested.

---

## 12. `GET /api/v1/admin/health` — deep health check

#### Purpose

Returns the liveness and dependency status of the platform. Unlike a shallow liveness probe (which only confirms the HTTP server is up), this endpoint checks real dependencies.

#### Method & URL

```
GET /api/v1/admin/health
```

#### Auth

Admin role required. This endpoint must **not** be exposed to unauthenticated callers — the response reveals infrastructure details.

#### Response schema

`200 OK` when all dependencies are healthy. `503 Service Unavailable` when any dependency is degraded or down.

```ts
{
  data: {
    status: "ok" | "degraded" | "down";
    checks: HealthCheck[];
    timestamp: string;
  },
  meta: { requestId: string },
}
```

`HealthCheck`:

```ts
{
  name: "database" | "redis" | "tmdb_api" | "anilist_api" | "storage";
  status: "ok" | "degraded" | "down";
  latency_ms: number;
  message?: string;            // Present only when status != "ok"
}
```

| Check         | Probes |
| :------------ | :----- |
| `database`    | `SELECT 1` against the primary Neon connection. |
| `redis`       | `PING` against the Upstash Redis endpoint. |
| `tmdb_api`    | HTTP `GET` to TMDB `/configuration` with the server-side API key. |
| `anilist_api` | HTTP `POST` to AniList GraphQL with a trivial `{ ping { status } }` query. |
| `storage`     | HEAD request to the Cloudflare R2 bucket root (or the configured storage backend). |

The overall `status` is the worst status across all checks. A `degraded` Redis connection (fail-open) does not degrade the overall status below `degraded`; a `down` database returns `down` immediately.

---

## 13. Examples

### 13.1. List banned users

```http
GET /api/v1/admin/users?is_banned=true&limit=10 HTTP/1.1
Host: api.nexus-anime.example
Authorization: Bearer <admin-token>
Accept: application/json
```

```json
{
  "data": [
    {
      "id": "usr_8f14e45f",
      "username": "spammer42",
      "display_name": null,
      "email": "spam@example.com",
      "email_verified": false,
      "role": "viewer",
      "is_banned": true,
      "avatar_url": null,
      "created_at": "2026-05-12T08:21:13Z",
      "updated_at": "2026-06-01T14:00:00Z",
      "deleted_at": null
    }
  ],
  "meta": {
    "requestId": "req_9a3b2c",
    "pagination": {
      "nextCursor": null,
      "hasMore": false
    }
  }
}
```

### 13.2. Ban a user

```http
PATCH /api/v1/admin/users/usr_8f14e45f HTTP/1.1
Host: api.nexus-anime.example
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "is_banned": true,
  "banned_reason": "Repeated spam comments after moderator warning."
}
```

```json
{
  "data": {
    "id": "usr_8f14e45f",
    "username": "spammer42",
    "is_banned": true,
    "role": "viewer",
    "updated_at": "2026-06-26T10:15:30Z",
    "...": "remaining fields"
  },
  "meta": { "requestId": "req_9a3b2d" }
}
```

### 13.3. Trigger a TMDB delta import

```http
POST /api/v1/admin/anime/import HTTP/1.1
Host: api.nexus-anime.example
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "provider": "tmdb",
  "mode": "delta"
}
```

```json
{
  "data": {
    "jobId": "job_4c8f1a2b",
    "status": "queued",
    "estimatedDurationSeconds": 420
  },
  "meta": { "requestId": "req_9a3b2e" }
}
```

### 13.4. Poll import job status

```http
GET /api/v1/admin/import-jobs/job_4c8f1a2b HTTP/1.1
Host: api.nexus-anime.example
Authorization: Bearer <admin-token>
```

```json
{
  "data": {
    "id": "job_4c8f1a2b",
    "provider": "tmdb",
    "mode": "delta",
    "status": "running",
    "totalRecords": 12400,
    "processedRecords": 3847,
    "error": null,
    "started_at": "2026-06-26T10:15:31Z",
    "finished_at": null,
    "created_at": "2026-06-26T10:15:30Z"
  },
  "meta": { "requestId": "req_9a3b2f" }
}
```

### 13.5. Hide a comment

```http
POST /api/v1/admin/comments/cmt_7d2e3f/moderate HTTP/1.1
Host: api.nexus-anime.example
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "action": "hide",
  "reason": "Off-topic; moved to discussion board by mod."
}
```

```json
{
  "data": {
    "id": "cmt_7d2e3f",
    "is_hidden": true,
    "is_flagged": true,
    "flag_count": 3,
    "updated_at": "2026-06-26T10:16:00Z",
    "...": "remaining fields"
  },
  "meta": { "requestId": "req_9a3b30" }
}
```

### 13.6. Query audit log for a specific actor

```http
GET /api/v1/admin/audit-log?actor_id=usr_admin01&resource_type=user&limit=5 HTTP/1.1
Host: api.nexus-anime.example
Authorization: Bearer <admin-token>
```

```json
{
  "data": [
    {
      "id": "aud_a1b2c3",
      "actor_id": "usr_admin01",
      "actor_username": "opslead",
      "action": "user.update",
      "resource_type": "user",
      "resource_id": "usr_8f14e45f",
      "metadata": {
        "before": { "is_banned": false, "role": "viewer" },
        "after": { "is_banned": true, "role": "viewer" }
      },
      "created_at": "2026-06-26T10:15:30Z"
    }
  ],
  "meta": {
    "requestId": "req_9a3b31",
    "pagination": { "nextCursor": null, "hasMore": false }
  }
}
```

### 13.7. Deep health check (degraded Redis)

```http
GET /api/v1/admin/health HTTP/1.1
Host: api.nexus-anime.example
Authorization: Bearer <admin-token>
```

```json
{
  "status": 503,
  "data": {
    "status": "degraded",
    "checks": [
      { "name": "database", "status": "ok", "latency_ms": 12 },
      { "name": "redis", "status": "degraded", "latency_ms": 380, "message": "Elevated latency; fail-open active" },
      { "name": "tmdb_api", "status": "ok", "latency_ms": 95 },
      { "name": "anilist_api", "status": "ok", "latency_ms": 210 },
      { "name": "storage", "status": "ok", "latency_ms": 45 }
    ],
    "timestamp": "2026-06-26T10:17:00Z"
  },
  "meta": { "requestId": "req_9a3b32" }
}
```

---

## 14. Future milestones

- **Admin notification creation** (M5): `POST /api/v1/admin/notifications` to create and schedule broadcast campaigns. Today the endpoint is read-only.
- **Rating moderation actions** (M5): `POST /api/v1/admin/ratings/{id}/moderate` for flag clearing and removal.
- **Admin permission flags** (M5): granular flags (`admin:hard-delete`, `admin:import`, `admin:moderate`) beyond the coarse `role = admin` check. See `docs/07-database` for the planned `admin_permissions` column.
- **Export endpoints** (M6): `GET /api/v1/admin/export/{resource}` for CSV/JSON download of audit log, user list, and stats.
