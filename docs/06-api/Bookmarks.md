# Bookmarks

> **Authoritative endpoint reference** for the `/api/v1/users/me/bookmarks` resource. Covers the current user's watchlist: listing, adding, updating, removing, and per-anime membership checks.
>
> Ownership: **Lead API Architect**. Last reviewed: 2026-06-26.

---

## 1. Purpose

Bookmarks are the current user's personal watchlist — a set of anime they saved for later. Each entry links a user to an anime and carries a small amount of user-owned state: a free-text note, a manual sort order, and an opt-out for new-episode notifications.

The resource is **user-scoped and private**. Every endpoint in this document operates on the **authenticated user's own** list — there is no admin or cross-user read surface in M3. Callers access other users' bookmark state only through the public anime detail `bookmark_count` (see [`Anime.md`](./Anime.md) section 2).

**Schema reference:** The authoritative column list, constraints, indexes, and enum values live in [`docs/07-database/Bookmark.md`](../07-database/Bookmark.md). This document only summarizes field shapes for request/response contract clarity.

---

## 2. Schema (summary)

Response payloads in this document use the shape below. JSON fields are `camelCase` per [`API-Standards.md`](./API-Standards.md) §5; the underlying columns are `snake_case` (see `docs/07-database/Bookmark.md` §2).

```ts
// Response payload shape — item in list, and target of singleton endpoints.
Bookmark {
  id: string;                        // uuid — surrogate key
  userId: string;                    // uuid — owner (always the authenticated user)
  animeId: string;                   // uuid — bookmarked anime
  note: string | null;               // personal note, plain text, max 500 chars
  sortOrder: number;                 // manual ordering within the user's list
  notifyOnNewEpisode: boolean;       // opt into new-episode notifications (default true)
  deletedAt: string | null;          // ISO-8601 timestamptz; non-null = removed
  createdAt: string;                 // ISO-8601 timestamptz — first bookmarked
  updatedAt: string;                 // ISO-8601 timestamptz — last mutation
  createdBy: string | null;          // uuid — = userId (self-owned audit pointer)
  updatedBy: string | null;          // uuid — last mutator
}
```

### 2.1 Field rules

| Field                 | Constraint                           | Notes                                                                                  |
| :-------------------- | :----------------------------------- | :------------------------------------------------------------------------------------- |
| `userId`              | `NOT NULL` FK → `users.id`           | Resolved from the session; the client cannot set it.                                   |
| `animeId`             | `NOT NULL` FK → `anime.id`           | Must reference an active anime.                                                        |
| `note`                | nullable, `char_length(note) <= 500` | Plain text only. Rendered through DOMPurify on the client — never interpreted as HTML. |
| `sortOrder`           | `NOT NULL DEFAULT 0`                 | Manual order. Gaps are allowed; values need not be contiguous.                         |
| `notifyOnNew_episode` | `NOT NULL DEFAULT true`              | Users are opted in by default; opt-out is explicit.                                    |
| `deletedAt`           | nullable                             | Soft-delete marker. Active bookmarks have `deletedAt = null`.                          |

---

## 3. Constraints & indexes

Mirrors `docs/07-database/Bookmark.md` §2.2. The partial unique is the load-bearing invariant for this resource.

| Name                      | Type           | Definition                                            |
| :------------------------ | :------------- | :---------------------------------------------------- |
| `uq_bookmarks_user_anime` | partial unique | `UNIQUE (user_id, anime_id) WHERE deleted_at IS NULL` |

The partial unique enforces **one active bookmark per (user, anime)**. A removed bookmark (`deleted_at IS NOT NULL`) frees the (user, anime) pair so the user can re-add the anime later. Re-adding inserts a new row rather than restoring the old one, so `createdAt` stays accurate for "date added" display.

Indexes that matter for these endpoints:

| Index                      | Columns                                                              | Serves                                                                   |
| :------------------------- | :------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| `idx_bookmarks_user_id`    | `(user_id, sort_order) WHERE deleted_at IS NULL`                     | Ordered watchlist scan (list endpoint).                                  |
| `idx_bookmarks_user_anime` | `(user_id, anime_id) WHERE deleted_at IS NULL`                       | "Is this in my list?" toggle check (singleton GET, POST conflict check). |
| `idx_bookmarks_anime_id`   | `anime_id WHERE deleted_at IS NULL`                                  | Bookmark count for an anime (maintained on the `anime` row).             |
| `idx_bookmarks_notify`     | `anime_id WHERE notify_on_new_episode = true AND deleted_at IS NULL` | Notification fan-out on new episode.                                     |

---

## 4. Authentication

Every endpoint in this document requires an authenticated session. The user scope is tied to the session identity — `userId` is derived from `session.sub`, never from the request body.

| Method   | URL                                    | Auth     |
| :------- | :------------------------------------- | :------- |
| `GET`    | `/api/v1/users/me/bookmarks`           | required |
| `POST`   | `/api/v1/users/me/bookmarks`           | required |
| `PATCH`  | `/api/v1/users/me/bookmarks/{animeId}` | required |
| `DELETE` | `/api/v1/users/me/bookmarks/{animeId}` | required |
| `GET`    | `/api/v1/users/me/bookmarks/{animeId}` | required |

A missing or invalid session returns `401 UNAUTHORIZED`. There is no admin or cross-user read scope for private bookmarks in M3.

---

## 5. Rate limiting

All endpoints in this document share the **user-scoped** quota defined in [`Rate-Limiting.md`](./Rate-Limiting.md) §5 row 7 ("Bookmark toggle"):

| Scope              | Limit       | Window     |
| :----------------- | :---------- | :--------- |
| Authenticated user | 10 requests | 60 seconds |

The bucket key is `nexus:ratelimit:user:{sub}:bookmarks:*`. Standard rate-limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) are emitted on every response. `Retry-After` is sent only on `429`. Clients implement self-throttle logic against the headers per `Rate-Limiting.md` §12.

---

## 6. Caching

Bookmark state is **user-private and mutation-sensitive**. The cache policy reflects that — reads are briefly fresh, but any mutation requires the client to observe the new state on the next request.

### 6.1 Read endpoints (list, singleton)

```
Cache-Control: private, max-age=30, must-revalidate
```

- `private` — the response is scoped to the authenticated user; shared caches (CDN edge) must not store it.
- `max-age=30` — a short freshness window. The watchlist changes on explicit user action; 30 seconds covers rapid repeat reads (component remounts, Strict-Mode double render) without a round-trip.
- `must-revalidate` — once stale, the client must revalidate with the origin. Because bookmark responses are not currently ETag-tagged in M3, revalidation is effectively a refetch.

### 6.2 Mutation endpoints (POST, PATCH, DELETE)

```
Cache-Control: no-store, no-cache, must-revalidate
```

Mutation responses are not cacheable by definition. The handler is responsible for invalidating the user's cached read keys in `@nexus/cache`:

```
nexus:bookmarks:user:{userId}:list:*
nexus:bookmarks:user:{userId}:anime:{animeId}
```

After a successful mutation, the next `GET` must reflect the new state. The `private, max-age=30` window on reads means a client that mutates and immediately re-reads within 30 seconds **may** see stale data unless the cache key is invalidated — which is why the handler invalidates synchronously before returning.

---

## 7. Endpoints

### 7.1. `GET /api/v1/users/me/bookmarks` — list current user's bookmarks

#### Purpose

Paginated list of the authenticated user's active bookmarks, ordered by the user's chosen sort order. Powers the "My List" page.

#### Method & URL

```
GET /api/v1/users/me/bookmarks
```

#### Auth

Required.

#### Query parameters

| Parameter | Type                           | Default                                            | Description                                                               |
| :-------- | :----------------------------- | :------------------------------------------------- | :------------------------------------------------------------------------ |
| `sort`    | `"sortOrder"` \| `"createdAt"` | `"sortOrder"`                                      | Sort field.                                                               |
| `order`   | `"asc"` \| `"desc"`            | `"asc"` for `sortOrder`, `"desc"` for `createdAt"` | Sort direction.                                                           |
| `cursor`  | string                         | —                                                  | Opaque cursor from `data.pagination.nextCursor`. Omit for the first page. |
| `limit`   | integer (1–100)                | `20`                                               | Page size. Hard cap 100.                                                  |

#### Sort semantics

| `sort` value | Indexed order              | Default `order` |
| :----------- | :------------------------- | :-------------- |
| `sortOrder`  | `sort_order ASC, id ASC`   | `asc`           |
| `createdAt`  | `created_at DESC, id DESC` | `desc`          |

Both sort paths are backed by the `idx_bookmarks_user_id` partial index (`WHERE deleted_at IS NULL`), so the scan never touches soft-deleted rows.

#### Response schema

```ts
{
  data: {
    items: Bookmark[],
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

Cursor pagination follows the contract in [`Pagination.md`](./Pagination.md) §3. The cursor is a base64url-encoded JSON object encoding the boundary `(sortKey, id)` for the active sort.

#### Success response example

```http
GET /api/v1/users/me/bookmarks?sort=sortOrder&limit=2
```

```json
{
  "data": {
    "items": [
      {
        "id": "bm_1a2b3c4d",
        "userId": "usr_9z8y7x6w",
        "animeId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "note": "watch with Sarah this weekend",
        "sortOrder": 0,
        "notifyOnNewEpisode": true,
        "deletedAt": null,
        "createdAt": "2026-06-10T08:00:00.000Z",
        "updatedAt": "2026-06-10T08:00:00.000Z",
        "createdBy": "usr_9z8y7x6w",
        "updatedBy": "usr_9z8y7x6w"
      },
      {
        "id": "bm_2b3c4d5e",
        "userId": "usr_9z8y7x6w",
        "animeId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "note": null,
        "sortOrder": 1,
        "notifyOnNewEpisode": false,
        "deletedAt": null,
        "createdAt": "2026-06-12T14:30:00.000Z",
        "updatedAt": "2026-06-20T09:15:00.000Z",
        "createdBy": "usr_9z8y7x6w",
        "updatedBy": "usr_9z8y7x6w"
      }
    ],
    "pagination": {
      "nextCursor": "eyJ2IjoxLCJzIjoic29ydF9vcmRlciIsImQiOiJhc2MiLCJrIjoxLCJpZCI6ImJtXzJiM2M0ZDVlIn0",
      "prevCursor": null,
      "hasMore": true,
      "limit": 2
    }
  },
  "meta": { "requestId": "req_abcd1234" }
}
```

HTTP: `200`

#### Error responses

| Scenario                 | HTTP | `code`             | `details`              |
| :----------------------- | :--- | :----------------- | :--------------------- |
| `limit` outside 1–100    | 400  | `VALIDATION_ERROR` | `errors[]` on `limit`  |
| Malformed `cursor`       | 400  | `VALIDATION_ERROR` | `errors[]` on `cursor` |
| Invalid `sort` / `order` | 400  | `VALIDATION_ERROR` | `errors[]`             |

---

### 7.2. `POST /api/v1/users/me/bookmarks` — add to bookmarks

#### Purpose

Add an anime to the current user's watchlist. **Idempotent via `Idempotency-Key`** — replaying the same key returns the original response. If the anime is already actively bookmarked, the request returns `409 CONFLICT` with code `DUPLICATE_BOOKMARK`.

#### Method & URL

```
POST /api/v1/users/me/bookmarks
```

#### Auth

Required.

#### Headers

| Header                     | Value                                                 |
| :------------------------- | :---------------------------------------------------- |
| `Content-Type`             | `application/json`                                    |
| `Idempotency-Key`          | uuid-v4 or opaque token, max 128 chars — **required** |
| `Cache-Control` (response) | `no-store, no-cache, must-revalidate`                 |

`Idempotency-Key` is **required** on this endpoint. A missing or malformed key returns `400 Bad Request` with code `IDEMPOTENCY_KEY_REQUIRED` per [`API-Standards.md`](./API-Standards.md) §9. The key is stored in `@nexus/cache` under `nexus:idem:{sha256(key)}` with a 24-hour TTL; repeat requests within the TTL return the byte-identical original response (including the original `X-Request-Id`).

#### Body schema

```ts
BookmarkCreateRequest {
  animeId: string;                   // uuid — required
  note?: string;                     // plain text, max 500 chars
  sortOrder?: number;                // defaults to 0
  notifyOnNewEpisode?: boolean;      // defaults to true
}
```

#### Semantics

1. Validate the body with Zod.
2. Look up the anime by `animeId`; if no active anime exists, return `ANIME_NOT_FOUND`.
3. Check the partial unique: if an active bookmark already exists for `(userId, animeId)`, return `DUPLICATE_BOOKMARK`.
4. Insert the row, set `created_by = updated_by = userId`, and increment `anime.bookmark_count`.
5. Invalidate `nexus:bookmarks:user:{userId}:list:*` and `nexus:bookmarks:user:{userId}:anime:{animeId}`.

The insert and the `bookmark_count` bump run in a single transaction.

#### Response schema

```ts
{
  data: Bookmark,
  meta: { requestId: string },
}
```

#### Success response example

```http
POST /api/v1/users/me/bookmarks
Content-Type: application/json
Idempotency-Key: 7c9e6679-7425-40de-944b-e07fc1f90ae7

{
  "animeId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "note": "recommended by Alex",
  "sortOrder": 2,
  "notifyOnNewEpisode": true
}
```

```json
{
  "data": {
    "id": "bm_3c4d5e6f",
    "userId": "usr_9z8y7x6w",
    "animeId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "note": "recommended by Alex",
    "sortOrder": 2,
    "notifyOnNewEpisode": true,
    "deletedAt": null,
    "createdAt": "2026-06-26T15:00:00.000Z",
    "updatedAt": "2026-06-26T15:00:00.000Z",
    "createdBy": "usr_9z8y7x6w",
    "updatedBy": "usr_9z8y7x6w"
  },
  "meta": { "requestId": "req_create_bm_01" }
}
```

HTTP: `201`. `Location: /api/v1/users/me/bookmarks/c3d4e5f6-a7b8-9012-cdef-123456789012`.

#### Error responses

| Scenario                            | HTTP | `code`                     | `details`                                      |
| :---------------------------------- | :--- | :------------------------- | :--------------------------------------------- |
| Missing `Idempotency-Key`           | 400  | `IDEMPOTENCY_KEY_REQUIRED` | —                                              |
| Missing required `animeId`          | 400  | `VALIDATION_ERROR`         | `errors[].code: "FIELD_REQUIRED"` on `animeId` |
| `note` exceeds 500 chars            | 400  | `VALIDATION_ERROR`         | `errors[]` on `note`                           |
| `animeId` not a valid UUID          | 400  | `VALIDATION_ERROR`         | `errors[]` on `animeId`                        |
| No active anime with that `animeId` | 404  | `ANIME_NOT_FOUND`          | `{ animeId }`                                  |
| Already actively bookmarked         | 409  | `DUPLICATE_BOOKMARK`       | `{ animeId }`                                  |

On `DUPLICATE_BOOKMARK`, the client should treat the anime as already in the list and, if needed, surface the existing bookmark via `GET /api/v1/users/me/bookmarks/{animeId}`.

---

### 7.3. `PATCH /api/v1/users/me/bookmarks/{animeId}` — update note or sort order

#### Purpose

Partially update the current user's bookmark for a given anime. Only `note`, `sortOrder`, and `notifyOnNewEpisode` are mutable — `animeId` and `userId` are immutable identity.

#### Method & URL

```
PATCH /api/v1/users/me/bookmarks/{animeId}
```

#### Path parameters

| Parameter | Type          | Required | Description                            |
| :-------- | :------------ | :------- | :------------------------------------- |
| `animeId` | string (uuid) | yes      | Anime whose bookmark is being updated. |

#### Auth

Required.

#### Headers

| Header                     | Value                                 |
| :------------------------- | :------------------------------------ |
| `Content-Type`             | `application/json`                    |
| `Cache-Control` (response) | `no-store, no-cache, must-revalidate` |

`Idempotency-Key` is **recommended** (not required) on PATCH per `API-Standards.md` §9 — useful when the client retries a note edit after a network timeout.

#### Body schema

```ts
BookmarkUpdateRequest {
  note?: string | null;              // plain text, max 500 chars; null clears the note
  sortOrder?: number;
  notifyOnNewEpisode?: boolean;
}
```

All fields are optional. An empty body `{}` is a no-op that returns the current bookmark unchanged.

#### Semantics

1. Validate the body with Zod.
2. Look up the active bookmark for `(userId, animeId)`; if none exists, return `BOOKMARK_NOT_FOUND`.
3. Apply the provided fields, set `updated_by = userId`, bump `updated_at`.
4. Invalidate `nexus:bookmarks:user:{userId}:list:*` and `nexus:bookmarks:user:{userId}:anime:{animeId}`.

#### Response schema

```ts
{
  data: Bookmark,
  meta: { requestId: string },
}
```

#### Success response example

```http
PATCH /api/v1/users/me/bookmarks/c3d4e5f6-a7b8-9012-cdef-123456789012
Content-Type: application/json

{
  "note": "moved to weekend queue",
  "sortOrder": 5
}
```

```json
{
  "data": {
    "id": "bm_3c4d5e6f",
    "userId": "usr_9z8y7x6w",
    "animeId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "note": "moved to weekend queue",
    "sortOrder": 5,
    "notifyOnNewEpisode": true,
    "deletedAt": null,
    "createdAt": "2026-06-26T15:00:00.000Z",
    "updatedAt": "2026-06-26T15:04:00.000Z",
    "createdBy": "usr_9z8y7x6w",
    "updatedBy": "usr_9z8y7x6w"
  },
  "meta": { "requestId": "req_patch_bm_01" }
}
```

HTTP: `200`.

#### Error responses

| Scenario                                   | HTTP | `code`               | `details`               |
| :----------------------------------------- | :--- | :------------------- | :---------------------- |
| `animeId` not a valid UUID                 | 400  | `VALIDATION_ERROR`   | `errors[]` on `animeId` |
| `note` exceeds 500 chars                   | 400  | `VALIDATION_ERROR`   | `errors[]` on `note`    |
| No active bookmark for `(userId, animeId)` | 404  | `BOOKMARK_NOT_FOUND` | `{ animeId }`           |

---

### 7.4. `DELETE /api/v1/users/me/bookmarks/{animeId}` — remove bookmark

#### Purpose

Soft-delete the current user's bookmark for a given anime. The row is retained with `deleted_at` set; the (user, anime) pair is freed so the user can re-add the anime later.

#### Method & URL

```
DELETE /api/v1/users/me/bookmarks/{animeId}
```

#### Path parameters

| Parameter | Type          | Required | Description                    |
| :-------- | :------------ | :------- | :----------------------------- |
| `animeId` | string (uuid) | yes      | Anime to remove from the list. |

#### Auth

Required.

#### Headers

| Header                     | Value                                 |
| :------------------------- | :------------------------------------ |
| `Cache-Control` (response) | `no-store, no-cache, must-revalidate` |

#### Body

Empty.

#### Semantics

1. Look up the active bookmark for `(userId, animeId)`; if none exists, return `BOOKMARK_NOT_FOUND`.
2. Set `deleted_at = now()`, `updated_by = userId`, bump `updated_at`.
3. Decrement `anime.bookmark_count`.
4. Invalidate `nexus:bookmarks:user:{userId}:list:*` and `nexus:bookmarks:user:{userId}:anime:{animeId}`.

The soft-delete and the `bookmark_count` decrement run in a single transaction.

#### Response schema

```ts
{
  data: { id: string, deletedAt: string },
  meta: { requestId: string },
}
```

#### Success response example

```http
DELETE /api/v1/users/me/bookmarks/c3d4e5f6-a7b8-9012-cdef-123456789012
```

```json
{
  "data": {
    "id": "bm_3c4d5e6f",
    "deletedAt": "2026-06-26T15:10:00.000Z"
  },
  "meta": { "requestId": "req_del_bm_01" }
}
```

HTTP: `200`.

#### Error responses

| Scenario                                   | HTTP | `code`               | `details`               |
| :----------------------------------------- | :--- | :------------------- | :---------------------- |
| `animeId` not a valid UUID                 | 400  | `VALIDATION_ERROR`   | `errors[]` on `animeId` |
| No active bookmark for `(userId, animeId)` | 404  | `BOOKMARK_NOT_FOUND` | `{ animeId }`           |

---

### 7.5. `GET /api/v1/users/me/bookmarks/{animeId}` — check if anime is bookmarked

#### Purpose

Return the current user's active bookmark for a given anime, or `404` if the anime is not in the list. Powers the filled / outlined bookmark icon on the anime detail page.

#### Method & URL

```
GET /api/v1/users/me/bookmarks/{animeId}
```

#### Path parameters

| Parameter | Type          | Required | Description     |
| :-------- | :------------ | :------- | :-------------- |
| `animeId` | string (uuid) | yes      | Anime to check. |

#### Auth

Required.

#### Headers

| Header                     | Value                                  |
| :------------------------- | :------------------------------------- |
| `Cache-Control` (response) | `private, max-age=30, must-revalidate` |

#### Response schema

```ts
{
  data: Bookmark,
  meta: { requestId: string },
}
```

#### Success response example

```http
GET /api/v1/users/me/bookmarks/c3d4e5f6-a7b8-9012-cdef-123456789012
```

```json
{
  "data": {
    "id": "bm_3c4d5e6f",
    "userId": "usr_9z8y7x6w",
    "animeId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "note": "moved to weekend queue",
    "sortOrder": 5,
    "notifyOnNewEpisode": true,
    "deletedAt": null,
    "createdAt": "2026-06-26T15:00:00.000Z",
    "updatedAt": "2026-06-26T15:04:00.000Z",
    "createdBy": "usr_9z8y7x6w",
    "updatedBy": "usr_9z8y7x6w"
  },
  "meta": { "requestId": "req_get_bm_01" }
}
```

HTTP: `200`.

#### Error responses

| Scenario                                   | HTTP | `code`               | `details`               |
| :----------------------------------------- | :--- | :------------------- | :---------------------- |
| `animeId` not a valid UUID                 | 400  | `VALIDATION_ERROR`   | `errors[]` on `animeId` |
| No active bookmark for `(userId, animeId)` | 404  | `BOOKMARK_NOT_FOUND` | `{ animeId }`           |

A `404` here means "not in list" — the client should render the outlined (not-bookmarked) icon. A soft-deleted bookmark is indistinguishable from a never-existing one at the API layer.

---

## 8. Endpoint map reference

| Method   | URL                                    | Auth     | Idempotency-Key | Cache (response)                       |
| :------- | :------------------------------------- | :------- | :-------------- | :------------------------------------- |
| `GET`    | `/api/v1/users/me/bookmarks`           | required | optional        | `private, max-age=30, must-revalidate` |
| `POST`   | `/api/v1/users/me/bookmarks`           | required | **required**    | `no-store, no-cache, must-revalidate`  |
| `PATCH`  | `/api/v1/users/me/bookmarks/{animeId}` | required | recommended     | `no-store, no-cache, must-revalidate`  |
| `DELETE` | `/api/v1/users/me/bookmarks/{animeId}` | required | optional        | `no-store, no-cache, must-revalidate`  |
| `GET`    | `/api/v1/users/me/bookmarks/{animeId}` | required | optional        | `private, max-age=30, must-revalidate` |

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
| `ANIME_NOT_FOUND`          | 404  | `animeId` lookup miss (no active anime)    |
| `BOOKMARK_NOT_FOUND`       | 404  | No active bookmark for `(userId, animeId)` |
| `DUPLICATE_BOOKMARK`       | 409  | POST for an already-bookmarked anime       |
| `RATE_LIMITED`             | 429  | Bookmark quota (10/60s) exhausted          |
| `INTERNAL_ERROR`           | 500  | Unhandled failure                          |

`BOOKMARK_NOT_FOUND` is a `NOT_FOUND` subtype reserved for this resource. It is **not yet** promoted to a top-level code in `Error-Codes.md` §3.2 — it currently lives in `details.reason` under a `NOT_FOUND` envelope. Promote it to a standalone `code` in the same PR that ships these endpoints.

---

## 10. Examples

### 10.1. Idempotent add (first attempt)

```http
POST /api/v1/users/me/bookmarks HTTP/1.1
Content-Type: application/json
Idempotency-Key: 7c9e6679-7425-40de-944b-e07fc1f90ae7

{ "animeId": "c3d4e5f6-a7b8-9012-cdef-123456789012", "note": "weekend" }
```

```http
HTTP/1.1 201 Created
Location: /api/v1/users/me/bookmarks/c3d4e5f6-a7b8-9012-cdef-123456789012
Cache-Control: no-store, no-cache, must-revalidate
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1750000060

{
  "data": { "id": "bm_3c4d5e6f", "animeId": "c3d4e5f6-a7b8-9012-cdef-123456789012", "note": "weekend", ... },
  "meta": { "requestId": "req_create_bm_01" }
}
```

### 10.2. Idempotent add (replay within 24h)

Same request, same `Idempotency-Key`. The handler returns the stored response byte-for-byte, including the original `X-Request-Id`:

```http
HTTP/1.1 201 Created
Location: /api/v1/users/me/bookmarks/c3d4e5f6-a7b8-9012-cdef-123456789012
Cache-Control: no-store, no-cache, must-revalidate
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1750000060

{
  "data": { "id": "bm_3c4d5e6f", "animeId": "c3d4e5f6-a7b8-9012-cdef-123456789012", "note": "weekend", ... },
  "meta": { "requestId": "req_create_bm_01" }
}
```

No new row is inserted; `anime.bookmark_count` is unchanged.

### 10.3. Conflict on double-add

```http
POST /api/v1/users/me/bookmarks HTTP/1.1
Content-Type: application/json
Idempotency-Key: 8dab72e8-...

{ "animeId": "c3d4e5f6-a7b8-9012-cdef-123456789012" }
```

```http
HTTP/1.1 409 Conflict
Cache-Control: no-store, no-cache, must-revalidate
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 8
X-RateLimit-Reset: 1750000060

{
  "error": {
    "message": "You already have this anime in your list.",
    "code": "DUPLICATE_BOOKMARK",
    "details": { "animeId": "c3d4e5f6-a7b8-9012-cdef-123456789012" }
  },
  "meta": { "requestId": "req_dup_bm_01" }
}
```

### 10.4. Membership check (bookmarked)

```http
GET /api/v1/users/me/bookmarks/c3d4e5f6-a7b8-9012-cdef-123456789012 HTTP/1.1
```

```http
HTTP/1.1 200 OK
Cache-Control: private, max-age=30, must-revalidate
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1750000060

{
  "data": { "id": "bm_3c4d5e6f", "animeId": "c3d4e5f6-a7b8-9012-cdef-123456789012", ... },
  "meta": { "requestId": "req_get_bm_01" }
}
```

### 10.5. Membership check (not bookmarked)

```http
GET /api/v1/users/me/bookmarks/d4e5f6a7-b8c9-0123-defa-234567890123 HTTP/1.1
```

```http
HTTP/1.1 404 Not Found
Cache-Control: private, max-age=30, must-revalidate

{
  "error": {
    "message": "This anime is not in your list.",
    "code": "BOOKMARK_NOT_FOUND",
    "details": { "animeId": "d4e5f6a7-b8c9-0123-defa-234567890123" }
  },
  "meta": { "requestId": "req_get_bm_02" }
}
```

### 10.6. Rate-limited response

```http
POST /api/v1/users/me/bookmarks HTTP/1.1
Content-Type: application/json
Idempotency-Key: 9ecf83f9-...

{ "animeId": "e5f6a7b8-c9d0-1234-efab-345678901234" }
```

```http
HTTP/1.1 429 Too Many Requests
Cache-Control: no-store, no-cache, must-revalidate
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1750000060
Retry-After: 47

{
  "error": {
    "message": "Too many bookmark updates. Try again later.",
    "code": "RATE_LIMITED",
    "details": { "retryAfter": 47, "limit": 10, "window": 60 }
  },
  "meta": { "requestId": "req_rl_bm_01" }
}
```

---

## 11. Changelog

| Date       | Change                                  | Ticket / PR |
| :--------- | :-------------------------------------- | :---------- |
| 2026-06-26 | Initial bookmark endpoint specification | —           |

---

## 12. License & ownership

This specification is under the same license as the Nexus Anime repository. Endpoint contract changes require review from the **Lead API Architect** and one approving engineer.
