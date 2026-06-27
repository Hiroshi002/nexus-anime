# Notifications

> **Authoritative endpoint reference** for the `/api/v1/users/me/notifications` and `/api/v1/admin/notifications` resources. Covers in-app notification delivery, listing, read-state management, and admin broadcast.
>
> Ownership: **Lead API Architect**. Last reviewed: 2026-06-26.

---

## 1. Purpose

In-app notifications are the platform's primary engagement surface for M3 — alerting users to new episodes, replies to their comments, system events, personalized recommendations, and achievement unlocks. The resource is **append-only and TTL-driven**: notifications are inserted by internal processes (event handlers, cron jobs, admin actions) and expire after 90 days.

Email, push, and real-time WebSocket/SSE delivery are **deferred to M5+**. In M3 the only supported channel is `in_app`.

**Schema reference:** The authoritative column list, constraints, indexes, and enum values live in [`docs/07-database/Notifications.md`](../07-database/Notifications.md). This document only summarizes field shapes for request/response contract clarity.

---

## 2. Schema (summary)

Response payloads in this document use the shape below. JSON fields are `camelCase` per [`API-Standards.md`](./API-Standards.md) 5; the underlying columns are `snake_case` (see `docs/07-database/Notifications.md` 2).

```ts
// Response payload shape — item in list, and target of singleton endpoints.
Notification {
  id: string;                        // uuid — surrogate key
  userId: string;                    // uuid — recipient
  type:                              // discriminated enum — what kind of notification
    | "new_episode"
    | "reply"
    | "system"
    | "recommendation"
    | "achievement";
  channel: "in_app";                // M3: in_app only
  priority: "low" | "normal" | "high";
  title: string;                     // plain text, max 120 chars
  body: string;                      // plain text, max 500 chars
  imageUrl: string | null;           // url — optional hero/thumbnail image
  actionUrl: string | null;          // deep-link url — where the notification routes
  payload: Record<string, unknown>;   // jsonb — arbitrary structured data (animeId, episodeId, etc.)
  isRead: boolean;                   // derived from readAt
  readAt: string | null;             // ISO-8601 timestamptz; null = unread
  sentAt: string;                    // ISO-8601 timestamptz — when the notification was created
  expiresAt: string;                 // ISO-8601 timestamptz — sent_at + 90 days
  createdAt: string;                 // = sentAt (alias for audit parity)
  createdBy: string | null;          // uuid — null for system-generated
}
```

### 2.1 Field rules

| Field       | Constraint                              | Notes                                                                                                      |
| :---------- | :-------------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| `userId`    | `NOT NULL` FK → `users.id`              | Resolved from the session on read; the client cannot set it.                                               |
| `type`      | `NOT NULL`, enum                        | One of `new_episode`, `reply`, `system`, `recommendation`, `achievement`.                                  |
| `channel`   | `NOT NULL DEFAULT 'in_app'`             | M3 only supports `in_app`. Other channels (`email`, `push`) are deferred to M5+.                           |
| `priority`  | `NOT NULL DEFAULT 'normal'`             | One of `low`, `normal`, `high`. Used for client-side sorting/filtering.                                    |
| `title`     | `NOT NULL`, `char_length(title) <= 120` | Plain text. Rendered through DOMPurify on the client.                                                      |
| `body`      | `NOT NULL`, `char_length(body) <= 500`  | Plain text.                                                                                                |
| `imageUrl`  | nullable, valid URL                     | Optional thumbnail/hero image. Served via `next/image` compatible URL.                                     |
| `actionUrl` | nullable, valid URL                     | Deep-link target (e.g. `/anime/{id}/episodes/{epId}`).                                                     |
| `payload`   | `NOT NULL DEFAULT '{}'`                 | `jsonb`. Structured context (e.g. `{ animeId, episodeId, commentId }`). Schema varies by `type`.           |
| `isRead`    | derived                                 | `readAt IS NOT NULL`. Not a stored column — computed in the response.                                      |
| `readAt`    | nullable                                | Set when the user marks the notification read. Null = unread.                                              |
| `sentAt`    | `NOT NULL DEFAULT now()`                | When the notification was created.                                                                         |
| `expiresAt` | `NOT NULL`                              | `sent_at + interval '90 days'`. Rows past `expiresAt` are candidates for hard-delete by the retention job. |

### 2.2 Type-specific `payload` shapes

| `type`           | `payload` shape                                                                       |
| :--------------- | :------------------------------------------------------------------------------------ |
| `new_episode`    | `{ animeId: string, episodeId: string, episodeNumber: number, episodeTitle: string }` |
| `reply`          | `{ commentId: string, parentCommentId: string, animeId: string, authorId: string }`   |
| `system`         | `{ messageKey: string, params?: Record<string, string> }`                             |
| `recommendation` | `{ animeId: string, reason: string }`                                                 |
| `achievement`    | `{ achievementId: string, achievementName: string, iconUrl: string }`                 |

---

## 3. Constraints & indexes

Mirrors `docs/07-database/Notifications.md` 2.2.

| Name                            | Type           | Definition                                               |
| :------------------------------ | :------------- | :------------------------------------------------------- | ---------------------- |
| `pk_notifications`              | primary key    | `id`                                                     |
| `idx_notifications_user_id`     | b-tree         | `(user_id, sent_at DESC) WHERE expires_at > now()`       | List endpoint scan.    |
| `idx_notifications_user_unread` | partial b-tree | `(user_id) WHERE read_at IS NULL AND expires_at > now()` | Unread count endpoint. |
| `idx_notifications_expires_at`  | b-tree         | `expires_at`                                             | Retention job sweep.   |

No unique constraints — notifications are append-only and may repeat (e.g. multiple `new_episode` notifications for the same anime across seasons).

---

## 4. Authentication

All user-scoped endpoints require an authenticated session. The user scope is tied to the session identity — `userId` is derived from `session.sub`, never from the request body.

| Method   | URL                                           | Auth                       |
| :------- | :-------------------------------------------- | :------------------------- |
| `GET`    | `/api/v1/users/me/notifications`              | required                   |
| `GET`    | `/api/v1/users/me/notifications/unread-count` | required                   |
| `POST`   | `/api/v1/users/me/notifications/mark-read`    | required                   |
| `DELETE` | `/api/v1/users/me/notifications/{id}`         | required                   |
| `POST`   | `/api/v1/admin/notifications`                 | required + `role: "admin"` |

A missing or invalid session returns `401 UNAUTHORIZED`. A non-admin calling the admin broadcast endpoint returns `403 FORBIDDEN`.

---

## 5. Rate limiting

All endpoints in this document share the **user-scoped** quota defined in [`Rate-Limiting.md`](./Rate-Limiting.md) 5 row 9 ("Notifications"):

| Scope                          | Limit       | Window     | Bucket key                                           |
| :----------------------------- | :---------- | :--------- | :--------------------------------------------------- |
| Authenticated user — reads     | 30 requests | 60 seconds | `nexus:ratelimit:user:{sub}:notifications:read`      |
| Authenticated user — mark-read | 10 requests | 60 seconds | `nexus:ratelimit:user:{sub}:notifications:mark-read` |
| Admin — broadcast              | 5 requests  | 60 seconds | `nexus:ratelimit:user:{sub}:notifications:admin`     |

Standard rate-limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) are emitted on every response. `Retry-After` is sent only on `429`. Clients implement self-throttle logic against the headers per `Rate-Limiting.md` 12.

---

## 6. Caching

Notification state is **user-private and read-state-sensitive**. The cache policy reflects that — reads must always reflect the latest unread count and list state.

### 6.1 All endpoints (read, mutation, admin)

```
Cache-Control: private, no-store
```

- `private` — the response is scoped to the authenticated user; shared caches (CDN edge) must not store it.
- `no-store` — the response must never be satisfied from cache. Unread count and list freshness are critical for the notification bell; serving stale state risks missed or double-counted alerts.

No `@nexus/cache` key writes — the response itself is not cached. The database is the source of truth for every request.

---

## 7. Endpoints

### 7.1. `GET /api/v1/users/me/notifications` — list current user's notifications

#### Purpose

Paginated list of the authenticated user's notifications, newest first. Powers the notification dropdown and dedicated notifications page.

#### Method & URL

```
GET /api/v1/users/me/notifications
```

#### Auth

Required.

#### Query parameters

| Parameter | Type                   | Default | Description                                                               |
| :-------- | :--------------------- | :------ | :------------------------------------------------------------------------ |
| `isRead`  | `"true"` \| `"false"`  | —       | Filter by read state. Omit to return all.                                 |
| `type`    | `Notification["type"]` | —       | Filter by notification type. Omit to return all.                          |
| `channel` | `"in_app"`             | —       | Filter by channel. M3 only supports `in_app`; other values return `400`.  |
| `cursor`  | string                 | —       | Opaque cursor from `data.pagination.nextCursor`. Omit for the first page. |
| `limit`   | integer (1–100)        | `20`    | Page size. Hard cap 100.                                                  |

#### Response schema

```ts
{
  data: {
    items: Notification[],
    pagination: {
      nextCursor: string | null,
      prevCursor: string | null,
      hasMore: boolean,
      limit: number,
    },
  },
  meta: { requestId: string },
}
```

Cursor pagination follows the contract in [`Pagination.md`](./Pagination.md) 3. The cursor is a base64url-encoded JSON object encoding the boundary `(sentAt, id)`.

#### Success response example

```http
GET /api/v1/users/me/notifications?limit=2
```

```json
{
  "data": {
    "items": [
      {
        "id": "ntf_1a2b3c4d",
        "userId": "usr_9z8y7x6w",
        "type": "new_episode",
        "channel": "in_app",
        "priority": "normal",
        "title": "New episode of *Azure Horizon*",
        "body": "Episode 12 — \"The Sky We Lost\" is now streaming.",
        "imageUrl": "https://img.nexus.anime/anime/azure-horizon/cover.jpg",
        "actionUrl": "/anime/azure-horizon/episodes/12",
        "payload": {
          "animeId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          "episodeId": "ep_9876543210",
          "episodeNumber": 12,
          "episodeTitle": "The Sky We Lost"
        },
        "isRead": false,
        "readAt": null,
        "sentAt": "2026-06-26T10:00:00.000Z",
        "expiresAt": "2027-03-25T10:00:00.000Z",
        "createdAt": "2026-06-26T10:00:00.000Z",
        "createdBy": null
      },
      {
        "id": "ntf_0a1b2c3d",
        "userId": "usr_9z8y7x6w",
        "type": "reply",
        "channel": "in_app",
        "priority": "low",
        "title": "Alex replied to your comment",
        "body": "Totally agree — the animation in episode 10 was unreal.",
        "imageUrl": null,
        "actionUrl": "/anime/crimson-blade/episodes/10?comment=c_5678",
        "payload": {
          "commentId": "c_5678",
          "parentCommentId": "c_1234",
          "animeId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
          "authorId": "usr_1a2b3c4d"
        },
        "isRead": true,
        "readAt": "2026-06-25T14:30:00.000Z",
        "sentAt": "2026-06-25T14:28:00.000Z",
        "expiresAt": "2027-03-24T14:28:00.000Z",
        "createdAt": "2026-06-25T14:28:00.000Z",
        "createdBy": "usr_1a2b3c4d"
      }
    ],
    "pagination": {
      "nextCursor": "eyJ2IjoiMjAyNi0wNi0yNlQxMDowMDowMC4wMDBaIiwiZCI6ImFzYyIsImtkIjoxLCJpZCI6Im50Zl8xYTJiM2M0ZCJ9",
      "prevCursor": null,
      "hasMore": true,
      "limit": 2
    }
  },
  "meta": { "requestId": "req_list_ntf_01" }
}
```

HTTP: `200`.

#### Error responses

| Scenario                         | HTTP | `code`             | `details`               |
| :------------------------------- | :--- | :----------------- | :---------------------- |
| `limit` outside 1–100            | 400  | `VALIDATION_ERROR` | `errors[]` on `limit`   |
| Malformed `cursor`               | 400  | `VALIDATION_ERROR` | `errors[]` on `cursor`  |
| Invalid `type`                   | 400  | `VALIDATION_ERROR` | `errors[]` on `type`    |
| Invalid `channel` (not `in_app`) | 400  | `VALIDATION_ERROR` | `errors[]` on `channel` |

---

### 7.2. `GET /api/v1/users/me/notifications/unread-count` — count of unread notifications

#### Purpose

Returns the number of unread, non-expired notifications for the authenticated user. Powers the notification bell badge.

#### Method & URL

```
GET /api/v1/users/me/notifications/unread-count
```

#### Auth

Required.

#### Response schema

```ts
{
  data: {
    count: number,
  },
  meta: { requestId: string },
}
```

#### Success response example

```http
GET /api/v1/users/me/notifications/unread-count
```

```json
{
  "data": { "count": 7 },
  "meta": { "requestId": "req_unread_ntf_01" }
}
```

HTTP: `200`.

---

### 7.3. `POST /api/v1/users/me/notifications/mark-read` — mark one or all read

#### Purpose

Mark a set of notifications as read, or mark all unread notifications as read. Idempotent — marking an already-read notification read again is a no-op.

#### Method & URL

```
POST /api/v1/users/me/notifications/mark-read
```

#### Auth

Required.

#### Headers

| Header                     | Value               |
| :------------------------- | :------------------ |
| `Content-Type`             | `application/json`  |
| `Cache-Control` (response) | `private, no-store` |

#### Body schema

```ts
// Mark specific notifications read.
NotificationMarkReadRequest {
  ids: string[];       // uuid[] — 1 to 100 ids; all must belong to the authenticated user.
}

// Mark all unread notifications read.
NotificationMarkReadAllRequest {
  all: true;
}
```

Exactly one of `ids` or `all` must be provided. Providing both, or neither, returns `400 VALIDATION_ERROR`.

#### Semantics

1. Validate the body with Zod.
2. If `ids` is provided:
   - Look up each id; verify `userId` matches the authenticated user. If any id is missing or owned by another user, return `NOTIFICATION_NOT_FOUND` (the entire batch fails — no partial success).
   - Set `readAt = now()` for each matched row where `readAt IS NULL`.
3. If `all` is provided:
   - Set `readAt = now()` for all rows where `userId = sub AND readAt IS NULL AND expiresAt > now()`.
4. Return the count of rows actually updated.

#### Response schema

```ts
{
  data: {
    updated: number,
  },
  meta: { requestId: string },
}
```

#### Success response example (specific ids)

```http
POST /api/v1/users/me/notifications/mark-read
Content-Type: application/json

{ "ids": ["ntf_1a2b3c4d", "ntf_0a1b2c3d"] }
```

```json
{
  "data": { "updated": 1 },
  "meta": { "requestId": "req_markread_ntf_01" }
}
```

`updated: 1` — one was already read; only one row was changed.

#### Success response example (all)

```http
POST /api/v1/users/me/notifications/mark-read
Content-Type: application/json

{ "all": true }
```

```json
{
  "data": { "updated": 7 },
  "meta": { "requestId": "req_markreadall_ntf_01" }
}
```

HTTP: `200`.

#### Error responses

| Scenario                                | HTTP | `code`                   | `details`           |
| :-------------------------------------- | :--- | :----------------------- | :------------------ |
| Neither `ids` nor `all` provided        | 400  | `VALIDATION_ERROR`       | `errors[]`          |
| Both `ids` and `all` provided           | 400  | `VALIDATION_ERROR`       | `errors[]`          |
| `ids` empty array                       | 400  | `VALIDATION_ERROR`       | `errors[]` on `ids` |
| `ids` exceeds 100 items                 | 400  | `VALIDATION_ERROR`       | `errors[]` on `ids` |
| Any `id` not a valid UUID               | 400  | `VALIDATION_ERROR`       | `errors[]` on `ids` |
| Any `id` not found or not owned by user | 404  | `NOTIFICATION_NOT_FOUND` | `{ id }`            |

---

### 7.4. `DELETE /api/v1/users/me/notifications/{id}` — delete one notification

#### Purpose

Hard-delete a single notification for the authenticated user. Unlike bookmarks, notifications are not soft-deleted — the row is removed entirely. This is the only mutation that reduces row count; all other mutations only change `readAt`.

#### Method & URL

```
DELETE /api/v1/users/me/notifications/{id}
```

#### Path parameters

| Parameter | Type          | Required | Description             |
| :-------- | :------------ | :------- | :---------------------- |
| `id`      | string (uuid) | yes      | Notification to delete. |

#### Auth

Required.

#### Headers

| Header                     | Value               |
| :------------------------- | :------------------ |
| `Cache-Control` (response) | `private, no-store` |

#### Body

Empty.

#### Semantics

1. Look up the notification by `id`; verify `userId` matches the authenticated user. If not found or not owned, return `NOTIFICATION_NOT_FOUND`.
2. Hard-delete the row.

#### Response schema

```ts
{
  data: { id: string },
  meta: { requestId: string },
}
```

#### Success response example

```http
DELETE /api/v1/users/me/notifications/ntf_1a2b3c4d
```

```json
{
  "data": { "id": "ntf_1a2b3c4d" },
  "meta": { "requestId": "req_del_ntf_01" }
}
```

HTTP: `200`.

#### Error responses

| Scenario                            | HTTP | `code`                   | `details`          |
| :---------------------------------- | :--- | :----------------------- | :----------------- |
| `id` not a valid UUID               | 400  | `VALIDATION_ERROR`       | `errors[]` on `id` |
| Notification not found or not owned | 404  | `NOTIFICATION_NOT_FOUND` | `{ id }`           |

---

### 7.5. `POST /api/v1/admin/notifications` — broadcast to users (admin only)

#### Purpose

Create and deliver in-app notifications to a set of users, or to all users. This is the system entry point for event-driven notifications (new episodes, replies, achievements) and for manual admin broadcasts (announcements, maintenance notices).

#### Method & URL

```
POST /api/v1/admin/notifications
```

#### Auth

Required. `role: "admin"` — non-admins receive `403 FORBIDDEN`.

#### Headers

| Header                     | Value                                                 |
| :------------------------- | :---------------------------------------------------- |
| `Content-Type`             | `application/json`                                    |
| `Idempotency-Key`          | uuid-v4 or opaque token, max 128 chars — **required** |
| `Cache-Control` (response) | `private, no-store`                                   |

`Idempotency-Key` is **required** on this endpoint. A missing or malformed key returns `400 Bad Request` with code `IDEMPOTENCY_KEY_REQUIRED` per [`API-Standards.md`](./API-Standards.md) 9. The key is stored in `@nexus/cache` under `nexus:idem:{sha256(key)}` with a 24-hour TTL; repeat requests within the TTL return the byte-identical original response.

#### Body schema

```ts
NotificationBroadcastRequest {
  userIds: string[] | "all";          // target recipients; "all" = every active user
  type: Notification["type"];          // required
  title: string;                       // plain text, max 120 chars
  body: string;                        // plain text, max 500 chars
  imageUrl?: string;                   // optional
  actionUrl?: string;                  // optional
  payload?: Record<string, unknown>;   // jsonb; type-specific per 2.2
  priority?: "low" | "normal" | "high"; // defaults to "normal"
  channel?: "in_app";                  // M3: in_app only; defaults to "in_app"
}
```

#### Semantics

1. Validate the body with Zod.
2. If `userIds` is an array: verify each id references an active user. If any id is invalid, return `USER_NOT_FOUND` (the entire batch fails).
3. If `userIds` is `"all"`: resolve the active user set from the `users` table.
4. Insert one notification row per recipient with `createdBy = session.sub` (the admin/system actor), `sentAt = now()`, `expiresAt = now() + interval '90 days'`.
5. The insert is batched; if the recipient set exceeds 1,000 users, the job is enqueued to a background worker and the endpoint returns `202 Accepted` with a `jobId`. Otherwise it returns `201 Created` with the count.

#### Response schema

```ts
// Synchronous (<= 1000 recipients)
{
  data: {
    delivered: number,
    jobIds: null,
  },
  meta: { requestId: string },
}

// Async (> 1000 recipients)
{
  data: {
    delivered: 0,
    jobId: string,          // uuid — poll via GET /api/v1/admin/jobs/{jobId} (deferred to M5+)
  },
  meta: { requestId: string },
}
```

#### Success response example (synchronous)

```http
POST /api/v1/admin/notifications
Content-Type: application/json
Idempotency-Key: 7c9e6679-7425-40de-944b-e07fc1f90ae7

{
  "userIds": ["usr_9z8y7x6w", "usr_1a2b3c4d"],
  "type": "system",
  "title": "Scheduled Maintenance",
  "body": "Nexus Anime will be briefly unavailable on June 28 from 02:00–03:00 UTC for infrastructure upgrades.",
  "priority": "high",
  "actionUrl": null,
  "payload": { "messageKey": "maintenance.scheduled", "params": { "start": "2026-06-28T02:00:00Z", "end": "2026-06-28T03:00:00Z" } }
}
```

```json
{
  "data": {
    "delivered": 2,
    "jobId": null
  },
  "meta": { "requestId": "req_broadcast_ntf_01" }
}
```

HTTP: `201`.

#### Success response example (async)

```http
POST /api/v1/admin/notifications
Content-Type: application/json
Idempotency-Key: 8dab72e8-...

{
  "userIds": "all",
  "type": "new_episode",
  "title": "New episode of *Azure Horizon*",
  "body": "Episode 12 is now streaming.",
  "imageUrl": "https://img.nexus.anime/anime/azure-horizon/cover.jpg",
  "actionUrl": "/anime/azure-horizon/episodes/12",
  "payload": { "animeId": "a1b2c3d4-...", "episodeId": "ep_9876543210", "episodeNumber": 12, "episodeTitle": "The Sky We Lost" },
  "priority": "normal"
}
```

```json
{
  "data": {
    "delivered": 0,
    "jobId": "job_abcd1234"
  },
  "meta": { "requestId": "req_broadcast_ntf_02" }
}
```

HTTP: `202`. Poll `jobId` via the admin jobs endpoint (deferred to M5+).

#### Error responses

| Scenario                                         | HTTP | `code`                     | `details`               |
| :----------------------------------------------- | :--- | :------------------------- | :---------------------- |
| Missing `Idempotency-Key`                        | 400  | `IDEMPOTENCY_KEY_REQUIRED` | —                       |
| Missing required field (`type`, `title`, `body`) | 400  | `VALIDATION_ERROR`         | `errors[]`              |
| `title` exceeds 120 chars                        | 400  | `VALIDATION_ERROR`         | `errors[]` on `title`   |
| `body` exceeds 500 chars                         | 400  | `VALIDATION_ERROR`         | `errors[]` on `body`    |
| Invalid `type`                                   | 400  | `VALIDATION_ERROR`         | `errors[]` on `type`    |
| Invalid `channel` (not `in_app`)                 | 400  | `VALIDATION_ERROR`         | `errors[]` on `channel` |
| `userIds` array contains invalid UUID            | 400  | `VALIDATION_ERROR`         | `errors[]` on `userIds` |
| `userIds` array references non-active user       | 404  | `USER_NOT_FOUND`           | `{ userId }`            |
| Non-admin caller                                 | 403  | `FORBIDDEN`                | —                       |

---

## 8. Endpoint map reference

| Method   | URL                                           | Auth             | Idempotency-Key | Cache (response)    |
| :------- | :-------------------------------------------- | :--------------- | :-------------- | :------------------ |
| `GET`    | `/api/v1/users/me/notifications`              | required         | optional        | `private, no-store` |
| `GET`    | `/api/v1/users/me/notifications/unread-count` | required         | optional        | `private, no-store` |
| `POST`   | `/api/v1/users/me/notifications/mark-read`    | required         | optional        | `private, no-store` |
| `DELETE` | `/api/v1/users/me/notifications/{id}`         | required         | optional        | `private, no-store` |
| `POST`   | `/api/v1/admin/notifications`                 | required + admin | **required**    | `private, no-store` |

---

## 9. Error codes used by this resource

All endpoints share the error envelope and code registry defined in [`Error-Codes.md`](./Error-Codes.md). The codes you will see here:

| Code                       | HTTP | Trigger in this resource                   |
| :------------------------- | :--- | :----------------------------------------- |
| `VALIDATION_ERROR`         | 400  | Path/body/query failed Zod schema          |
| `FIELD_REQUIRED`           | 400  | Nested in `VALIDATION_ERROR.details`       |
| `FIELD_INVALID`            | 400  | Nested in `VALIDATION_ERROR.details`       |
| `IDEMPOTENCY_KEY_REQUIRED` | 400  | POST without `Idempotency-Key`             |
| `UNAUTHORIZED`             | 401  | Missing or invalid session                 |
| `FORBIDDEN`                | 403  | Non-admin calling admin broadcast          |
| `NOTIFICATION_NOT_FOUND`   | 404  | `id` lookup miss or not owned by user      |
| `USER_NOT_FOUND`           | 404  | Admin broadcast references non-active user |
| `RATE_LIMITED`             | 429  | Notification quota exhausted               |
| `INTERNAL_ERROR`           | 500  | Unhandled failure                          |

`NOTIFICATION_NOT_FOUND` is a `NOT_FOUND` subtype reserved for this resource. It is **not yet** promoted to a top-level code in `Error-Codes.md` 3.2 — it currently lives in `details.reason` under a `NOT_FOUND` envelope. Promote it to a standalone `code` in the same PR that ships these endpoints.

---

## 10. Retention & lifecycle

Notifications are **append-only** for their lifetime. The only hard-delete paths are:

1. User-initiated `DELETE /api/v1/users/me/notifications/{id}` (section 7.4).
2. Retention job: a daily cron hard-deletes rows where `expiresAt < now()`. The job is defined in `apps/web/src/jobs/notification-retention.ts` (deferred to M3 implementation).

The 90-day TTL is **fixed in M3**. Configurable per-user TTL and per-type overrides are deferred to M5+.

---

## 11. Future work (M5+)

| Feature                              | Status   | Notes                                                                                                               |
| :----------------------------------- | :------- | :------------------------------------------------------------------------------------------------------------------ |
| Email notifications                  | deferred | Requires email provider integration (Resend / SES).                                                                 |
| Push notifications                   | deferred | Requires service worker + Web Push setup.                                                                           |
| Real-time delivery (WebSocket / SSE) | deferred | In M3 the client polls `unread-count` on a 30s interval. M5+ will add a persistent connection for instant delivery. |
| Per-user TTL overrides               | deferred | 90-day fixed in M3.                                                                                                 |
| Per-type channel routing             | deferred | M3 is `in_app` only.                                                                                                |
| Notification preferences UI          | deferred | Users cannot opt out of notification types in M3.                                                                   |
| Admin broadcast job polling          | deferred | `GET /api/v1/admin/jobs/{jobId}` is deferred to M5+.                                                                |

---

## 12. Examples

### 12.1. Poll unread count (client bell badge)

```http
GET /api/v1/users/me/notifications/unread-count HTTP/1.1
```

```http
HTTP/1.1 200 OK
Cache-Control: private, no-store
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 29
X-RateLimit-Reset: 1750000060

{ "data": { "count": 7 }, "meta": { "requestId": "req_unread_ntf_01" } }
```

### 12.2. List unread notifications

```http
GET /api/v1/users/me/notifications?isRead=false&limit=5 HTTP/1.1
```

```http
HTTP/1.1 200 OK
Cache-Control: private, no-store
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 28
X-RateLimit-Reset: 1750000060

{
  "data": {
    "items": [ /* ... */ ],
    "pagination": { "nextCursor": "...", "prevCursor": null, "hasMore": true, "limit": 5 }
  },
  "meta": { "requestId": "req_list_ntf_02" }
}
```

### 12.3. Mark specific notifications read

```http
POST /api/v1/users/me/notifications/mark-read HTTP/1.1
Content-Type: application/json

{ "ids": ["ntf_1a2b3c4d", "ntf_0a1b2c3d"] }
```

```http
HTTP/1.1 200 OK
Cache-Control: private, no-store
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1750000060

{ "data": { "updated": 1 }, "meta": { "requestId": "req_markread_ntf_01" } }
```

### 12.4. Mark all read

```http
POST /api/v1/users/me/notifications/mark-read HTTP/1.1
Content-Type: application/json

{ "all": true }
```

```http
HTTP/1.1 200 OK
Cache-Control: private, no-store
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 8
X-RateLimit-Reset: 1750000060

{ "data": { "updated": 7 }, "meta": { "requestId": "req_markreadall_ntf_01" } }
```

### 12.5. Delete a notification

```http
DELETE /api/v1/users/me/notifications/ntf_1a2b3c4d HTTP/1.1
```

```http
HTTP/1.1 200 OK
Cache-Control: private, no-store
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 27
X-RateLimit-Reset: 1750000060

{ "data": { "id": "ntf_1a2b3c4d" }, "meta": { "requestId": "req_del_ntf_01" } }
```

### 12.6. Admin broadcast (synchronous)

```http
POST /api/v1/admin/notifications HTTP/1.1
Content-Type: application/json
Idempotency-Key: 7c9e6679-7425-40de-944b-e07fc1f90ae7

{
  "userIds": ["usr_9z8y7x6w"],
  "type": "system",
  "title": "Welcome to Nexus Anime",
  "body": "Thanks for joining! Explore our catalog and add anime to your list.",
  "priority": "normal",
  "actionUrl": "/catalog",
  "payload": { "messageKey": "welcome" }
}
```

```http
HTTP/1.1 201 Created
Cache-Control: private, no-store
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 1750000060

{ "data": { "delivered": 1, "jobId": null }, "meta": { "requestId": "req_broadcast_ntf_01" } }
```

### 12.7. Rate-limited response

```http
GET /api/v1/users/me/notifications/unread-count HTTP/1.1
```

```http
HTTP/1.1 429 Too Many Requests
Cache-Control: private, no-store
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1750000060
Retry-After: 42

{
  "error": {
    "message": "Too many notification reads. Try again later.",
    "code": "RATE_LIMITED",
    "details": { "retryAfter": 42, "limit": 30, "window": 60 }
  },
  "meta": { "requestId": "req_rl_ntf_01" }
}
```

---

## 13. Changelog

| Date       | Change                                      | Ticket / PR |
| :--------- | :------------------------------------------ | :---------- |
| 2026-06-26 | Initial notification endpoint specification | —           |

---

## 14. License & ownership

This specification is under the same license as the Nexus Anime repository. Endpoint contract changes require review from the **Lead API Architect** and one approving engineer.
