# Seasons

> **Authoritative endpoint reference** for the `/api/v1/seasons` and `/api/v1/anime/{animeId}/seasons` resources. Covers season listing for a show, single-season detail, and admin mutations.

> Ownership: **Lead API Architect**. Last reviewed: 2026-06-26.

---

## 1. Purpose

The Seasons resource is the read and administrative surface for grouping episodes within an anime. It powers:

- **Season list views** — ordered list of seasons for an anime on the detail page.
- **Season detail** — single-season metadata for the season-episode sub-page.
- **Admin curation** — creation, metadata updates, and soft-deletes.

All read endpoints are **edge-cacheable**. Mutation endpoints require admin role and invalidate the cache via `@nexus/cache` write-through helpers.

**Schema reference:** The authoritative column list, constraints, indexes, and enum values live in [`docs/07-database/Season.md`](../07-database/Season.md). This endpoint document only summarizes field shapes for request/response contract clarity.

---

## 2. Fields & enums (summary)

Endpoint request and response payloads use the schema types below. They mirror the columns defined in `docs/07-database/Season.md` section 2.

```ts
// Response payload shape — GET /api/v1/seasons/{id}, and items in list.
Season: {
  id!: string;                        // uuid
  anime_id!: string;                  // uuid — parent anime
  number!: number;                    // integer — per-anime season number (1-based)
  title?: string | null;              // display title; falls back to `Season {number}`
  synopsis?: string | null;           // sanitized at render
  episode_count?: number | null;      // declared count; denormalized from episodes
  poster_url?: string | null;
  aired_from?: string | null;       // ISO-8601 timestamptz
  aired_to?: string | null;         // ISO-8601 timestamptz
  import_metadata?: Record<string, unknown>;  // raw upstream payload (jsonb)
  created_at!: string;                // ISO-8601 timestamptz
  updated_at!: string;                // ISO-8601 timestamptz
}
```

No string enums are defined on this resource. The `number` semantics (per-anime, 1-based) and the `title` nullable-with-fallback behavior are described in `docs/07-database/Season.md` sections 2.4 and 2.5.

---

## 3. Cache headers

All **read-only** endpoints in this document emit the same cache policy:

```
Cache-Control: public, max-age=3600, stale-while-revalidate=86400
```

Rationale: season metadata changes on a human-curated cadence (not real-time). 1 hour freshness serves subsequent page loads from CDN edge; 24 hours of stale-while-revalidate covers the gap while the origin revalidates in the background.

**Mutation endpoints** (POST, PATCH, DELETE) do not carry cache headers — responses are not cacheable by definition. The handler is responsible for invalidating cached read keys in `@nexus/cache` (`nexus:anime:{animeId}:seasons:*`, `nexus:seasons:{id}:*`).

See [API-Standards.md](./API-Standards.md) section on caching for the full cache key schema.

---

## 4. Common error codes

All endpoints in this document share the error envelope and code registry defined in [`Error-Codes.md`](./Error-Codes.md). The codes you will see here:

| Code                 | HTTP | Trigger in this resource                 |
| :------------------- | :--- | :--------------------------------------- |
| `VALIDATION_ERROR`   | 400  | Query/body failed Zod schema            |
| `FIELD_REQUIRED`     | 400  | Nested in `VALIDATION_ERROR.details`     |
| `FIELD_INVALID`      | 400  | Nested in `VALIDATION_ERROR.details`     |
| `UNAUTHORIZED`       | 401  | Missing bearer token on admin endpoints  |
| `FORBIDDEN`          | 403  | Non-admin caller on admin endpoints     |
| `ANIME_NOT_FOUND`    | 404  | `animeId` path param lookup miss         |
| `SEASON_NOT_FOUND`   | 404  | `id` lookup miss (no deleted)            |
| `CONFLICT`           | 409  | Duplicate `(anime_id, number)` on create |
| `RATE_LIMITED`       | 429  | Quota exhausted                          |
| `INTERNAL_ERROR`     | 500  | Unhandled failure                        |

Sub-code naming follows the `*_NOT_FOUND` pattern for each entity. A deleted season returns `SEASON_NOT_FOUND`, not `410 Gone` — soft-deleted rows are indistinguishable from non-existent rows at the API layer.

---

## 5. Authentication

| Endpoint group                          | Auth required                         |
| :-------------------------------------- | :------------------------------------ |
| GET reads (section 6.1–6.2)             | None — public endpoint                |
| POST `/api/v1/anime/{animeId}/seasons` (6.3) | `Authorization: Bearer <admin-token>` + admin role |
| PATCH `/api/v1/seasons/{id}` (6.4)      | Same                                  |
| DELETE `/api/v1/seasons/{id}` (6.5)     | Same                                  |

The admin role check follows the policy in [`Authentication.md`](./Authentication.md). Bearer tokens are validated by middleware before the handler runs. A `401 UNAUTHORIZED` reply is returned when the token is absent or invalid; a `403 FORBIDDEN` reply is returned when the token identifies a user who is not in the admin role.

---

## 6. Endpoints

### 6.1. `GET /api/v1/anime/{animeId}/seasons` — list seasons for an anime

#### Purpose

Ordered list of active seasons for a single anime. Used by the anime detail page to render season tabs.

#### Method & URL

```
GET /api/v1/anime/{animeId}/seasons
```

#### Path parameters

| Parameter | Type | Required | Description |
| :-------- | :--- | :------- | :---------- |
| `animeId` | `string` (uuid) | yes | Parent anime surrogate key. |

#### Auth

None.

#### Headers

| Header | Value |
| :----- | :---- |
| `Accept` | `application/json` |
| `Cache-Control` (response) | `public, max-age=3600, stale-while-revalidate=86400` |

#### Response schema

```ts
{
  data: Season[],
  meta: { requestId: string }
}
```

Returns all active seasons for the anime ordered by `number ASC`. An empty array (`[]`) is returned when the anime has no seasons (e.g. a flat show or a film) — still `200`, not `404`.

#### Success response example

```http
GET /api/v1/anime/a1b2c3d4-e5f6-7890-abcd-ef1234567890/seasons
```

```json
{
  "data": [
    {
      "id": "s1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "anime_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "number": 1,
      "title": null,
      "synopsis": "The year is 854...",
      "episode_count": 25,
      "poster_url": "https://img.nexus-anime.app/poster/aot-s1.jpg",
      "aired_from": "2013-04-07T00:00:00Z",
      "aired_to": "2013-09-29T00:00:00Z",
      "import_metadata": { "tmdb_season_id": 51234 },
      "created_at": "2025-11-12T08:00:00Z",
      "updated_at": "2025-11-12T08:00:00Z"
    },
    {
      "id": "s2a3b4c5-d6e7-8901-bcde-f12345678901",
      "anime_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "number": 2,
      "title": "The Final Season",
      "synopsis": "The war for Paradis intensifies.",
      "episode_count": 16,
      "poster_url": "https://img.nexus-anime.app/poster/aot-s2.jpg",
      "aired_from": "2017-04-01T00:00:00Z",
      "aired_to": "2018-03-27T00:00:00Z",
      "import_metadata": { "tmdb_season_id": 51235 },
      "created_at": "2025-11-12T08:00:00Z",
      "updated_at": "2025-11-12T08:00:00Z"
    }
  ],
  "meta": { "requestId": "req_ab12cd34" }
}
```

HTTP: `200`

#### Error responses

| Scenario | HTTP | `code` | `details` |
| :------- | :--- | :----- | :-------- |
| `animeId` not a valid UUID | 400 | `VALIDATION_ERROR` | `errors[]` on `animeId` |
| No active anime with that `animeId` | 404 | `ANIME_NOT_FOUND` | `{ animeId }` |

---

### 6.2. `GET /api/v1/seasons/{id}` — single season

#### Purpose

Fetch the full record for a single season. Used by the season detail page and admin editor hydration.

#### Method & URL

```
GET /api/v1/seasons/{id}
```

#### Path parameters

| Parameter | Type | Required | Description |
| :-------- | :--- | :------- | :---------- |
| `id` | `string` (uuid) | yes | Season surrogate key. |

#### Auth

None.

#### Headers

| Header | Value |
| :----- | :---- |
| `Accept` | `application/json` |
| `Cache-Control` (response) | `public, max-age=3600, stale-while-revalidate=86400` |

#### Response schema

```ts
{
  data: Season,
  meta: { requestId: string }
}
```

Returns `SEASON_NOT_FOUND` if the `id` does not match an active row.

#### Success response example

```http
GET /api/v1/seasons/s1a2b3c4-d5e6-7890-abcd-ef1234567890
```

```json
{
  "data": {
    "id": "s1a2b3c4-d5e6-7890-abcd-ef1234567890",
    "anime_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "number": 1,
    "title": null,
    "synopsis": "The year is 854...",
    "episode_count": 25,
    "poster_url": "https://img.nexus-anime.app/poster/aot-s1.jpg",
    "aired_from": "2013-04-07T00:00:00Z",
    "aired_to": "2013-09-29T00:00:00Z",
    "import_metadata": { "tmdb_season_id": 51234 },
    "created_at": "2025-11-12T08:00:00Z",
    "updated_at": "2025-11-12T08:00:00Z"
  },
  "meta": { "requestId": "req_ef56gh78" }
}
```

HTTP: `200`

#### Error responses

| Scenario | HTTP | `code` | `details` |
| :------- | :--- | :----- | :-------- |
| `id` not a valid UUID | 400 | `VALIDATION_ERROR` | `errors[]` on `id` |
| No active season with that `id` | 404 | `SEASON_NOT_FOUND` | `{ id }` |

---

### 6.3. `POST /api/v1/anime/{animeId}/seasons` — admin create

#### Purpose

Create a new season for an anime. Used by the admin curation UI and by the TMDB/AniList import flow.

#### Method & URL

```
POST /api/v1/anime/{animeId}/seasons
```

#### Headers

| Header | Value |
| :----- | :---- |
| `Authorization` | `Bearer <admin-token>` |
| `Content-Type` | `application/json` |
| `Cache-Control` (response) | none (response not cacheable) |

#### Path parameters

| Parameter | Type | Required | Description |
| :-------- | :--- | :------- | :---------- |
| `animeId` | `string` (uuid) | yes | Parent anime surrogate key. |

#### Body schema

```ts
SeasonCreateRequest: {
  number!: number,                    // integer — per-anime season number (1-based)
  title?: string,                     // optional display title
  synopsis?: string,
  episode_count?: number,
  poster_url?: string,
  aired_from?: string,               // ISO-8601
  aired_to?: string,                 // ISO-8601
  import_metadata?: Record<string, unknown>,
}
```

`id`, `anime_id`, `created_at`, `updated_at` are managed by the database and are **not** accepted on the request.

#### Response schema

```ts
{
  data: Season,
  meta: { requestId: string }
}
```

#### Success response

HTTP: `201`. `Location: /api/v1/seasons/{id}`.

```json
{
  "data": {
    "id": "s3a4b5c6-d7e8-9012-cdef-012345678902",
    "anime_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "number": 3,
    "title": "The Final Season — Part 2",
    "synopsis": null,
    "episode_count": 12,
    "poster_url": null,
    "aired_from": "2023-03-04T00:00:00Z",
    "aired_to": null,
    "import_metadata": {},
    "created_at": "2026-06-26T10:00:00Z",
    "updated_at": "2026-06-26T10:00:00Z"
  },
  "meta": { "requestId": "req_ij90kl12" }
}
```

#### Error responses

| Scenario | HTTP | `code` | `details` |
| :------- | :--- | :----- | :-------- |
| `animeId` not a valid UUID | 400 | `VALIDATION_ERROR` | `errors[]` on `animeId` |
| No active anime with that `animeId` | 404 | `ANIME_NOT_FOUND` | `{ animeId }` |
| Missing required `number` | 400 | `VALIDATION_ERROR` | `errors[].code: "FIELD_REQUIRED"` on `number` |
| `number` already in use for this anime (active row) | 409 | `CONFLICT` | `{ animeId, number }` |
| `number <= 0` | 400 | `VALIDATION_ERROR` | `errors[]` on `number` |
| `aired_to < aired_from` | 400 | `VALIDATION_ERROR` | `errors[]` on `aired_to` |

---

### 6.4. `PATCH /api/v1/seasons/{id}` — admin update

#### Purpose

Partial update of a season record. Used by the admin editor and by the TMDB/AniList re-import flow. **No optimistic concurrency token** — season metadata is edited rarely and only by admins; last-write-wins is acceptable (see `docs/07-database/Season.md` section 2.4).

#### Method & URL

```
PATCH /api/v1/seasons/{id}
```

#### Headers

| Header | Value |
| :----- | :---- |
| `Authorization` | `Bearer <admin-token>` |
| `Content-Type` | `application/json` |
| `Cache-Control` (response) | none |

#### Path parameters

| Parameter | Type | Required | Description |
| :-------- | :--- | :------- | :---------- |
| `id` | `string` (uuid) | yes | Season surrogate key. |

#### Body schema

```ts
SeasonUpdateRequest: {
  number?: number,
  title?: string | null,
  synopsis?: string | null,
  episode_count?: number | null,
  poster_url?: string | null,
  aired_from?: string | null,
  aired_to?: string | null,
  import_metadata?: Record<string, unknown>,
}
```

#### Response schema

```ts
{
  data: Season,
  meta: { requestId: string }
}
```

#### Success response

HTTP: `200`.

```json
{
  "data": {
    "id": "s3a4b5c6-d7e8-9012-cdef-012345678902",
    "anime_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "number": 3,
    "title": "The Final Season — Part 2 (Corrected)",
    "synopsis": "The final chapter begins.",
    "episode_count": 12,
    "poster_url": "https://img.nexus-anime.app/poster/aot-s3p2.jpg",
    "aired_from": "2023-03-04T00:00:00Z",
    "aired_to": "2023-06-24T00:00:00Z",
    "import_metadata": { "tmdb_season_id": 51236 },
    "created_at": "2026-06-26T10:00:00Z",
    "updated_at": "2026-06-26T11:00:00Z"
  },
  "meta": { "requestId": "req_mn34op56" }
}
```

#### Error responses

| Scenario | HTTP | `code` | `details` |
| :------- | :--- | :----- | :-------- |
| `id` not a valid UUID | 400 | `VALIDATION_ERROR` | `errors[]` on `id` |
| No active season with that `id` | 404 | `SEASON_NOT_FOUND` | `{ id }` |
| `number` conflict with another active season of the same anime | 409 | `CONFLICT` | `{ animeId, number }` |
| `number <= 0` | 400 | `VALIDATION_ERROR` | `errors[]` on `number` |
| `aired_to < aired_from` | 400 | `VALIDATION_ERROR` | `errors[]` on `aired_to` |

---

### 6.5. `DELETE /api/v1/seasons/{id}` — admin soft delete

#### Purpose

Soft-delete a season by setting `deleted_at = now()`. The row is retained to preserve referential integrity with episodes and to make undeletion possible via admin tools.

#### Method & URL

```
DELETE /api/v1/seasons/{id}
```

#### Headers

| Header | Value |
| :----- | :---- |
| `Authorization` | `Bearer <admin-token>` |
| `Cache-Control` (response) | none |

#### Path parameters

| Parameter | Type | Required | Description |
| :-------- | :--- | :------- | :---------- |
| `id` | `string` (uuid) | yes | Season to soft-delete. |

#### Body

Empty.

#### Response schema

```ts
{
  data: { id: string, deleted_at: string },
  meta: { requestId: string }
}
```

#### Success response

HTTP: `200`.

```json
{
  "data": {
    "id": "s3a4b5c6-d7e8-9012-cdef-012345678902",
    "deleted_at": "2026-06-26T12:00:00Z"
  },
  "meta": { "requestId": "req_qr78st90" }
}
```

The soft-delete is idempotent: calling `DELETE` on an already-deleted season returns the current `deleted_at` and `200` rather than `404`.

#### Error responses

| Scenario | HTTP | `code` | `details` |
| :------- | :--- | :----- | :-------- |
| `id` not a valid UUID | 400 | `VALIDATION_ERROR` | `errors[]` |
| No record exists with that `id` (including hard-deleted archival) | 404 | `SEASON_NOT_FOUND` | `{ id }` |

#### Cascade note

Soft-delete does **not** cascade — episodes retain their `season_id` FK; query filters inside episode reads (`WHERE deleted_at IS NULL` on `seasons`) exclude the deleted season from traversal. Episodes of a soft-deleted season remain queryable via their `anime_id`.

---

## 7. Endpoint map reference

| Method | URL | Auth |
| :----- | :-- | :---- |
| `GET` | `/api/v1/anime/{animeId}/seasons` | none |
| `GET` | `/api/v1/seasons/{id}` | none |
| `POST` | `/api/v1/anime/{animeId}/seasons` | bearer + admin |
| `PATCH` | `/api/v1/seasons/{id}` | bearer + admin |
| `DELETE` | `/api/v1/seasons/{id}` | bearer + admin |

---

## 8. Partial unique constraint

The `(anime_id, number)` pair must be unique among active rows. Enforced by the partial unique index `uq_seasons_anime_number`:

```sql
UNIQUE (anime_id, number) WHERE deleted_at IS NULL
```

This means:

- Two active seasons of the same anime cannot share a `number`.
- A soft-deleted season frees its `(anime_id, number)` slot — re-creating a season with the same number succeeds.
- The index also serves the list query (`WHERE anime_id = ? AND deleted_at IS NULL ORDER BY number`), so the constraint and the read path share one index.

---

## 9. Import flow

The catalog importer (`packages/services/importer/`) populates seasons alongside anime. The importer:

1. Looks up an existing season by `(anime_id, number)`.
2. If no match exists, inserts a new row.
3. If a match exists, issues a `PATCH` with the latest upstream payload — skipped when checksums match.

Re-importing a previously deleted season re-inserts — the partial unique index excludes the soft-deleted row, so the INSERT succeeds.

---

## 10. Out-of-scope sections

The following are explicitly **not** covered in this document but are companions to the Seasons resource:

| Topic | Where |
| :---- | :---- |
| Episodes within a season | `docs/06-api/Episodes.md` |
| Parent anime resource | `docs/06-api/Anime.md` |
| User engagement (watch-progress, comments) | `docs/06-api/Watchlists.md`, `Comments.md`, etc. |

---

## 11. Testing checklist

Before landing a change to this surface, verify:

- **Type safety** — `pnpm typecheck` passes. No `any` introduced in handler, serializer, or schema.
- **Build safety** — `pnpm build` succeeds. Handlers compile under Next.js App Router convention.
- **Runtime safety** — happy path, empty list, deleted lookup, admin `403` all return a typed envelope without throwing.
- **Edge cases** — zero results (200, `data: []`), duplicate `number` on create (409), soft-delete idempotency, re-create after delete.
- **Error handling** — no unhandled promise rejections; no leaked stack traces; friendly `message` values.
- **Caching** — reads include the cache headers defined in section 3; mutations invalidate the relevant `@nexus/cache` prefix.
- **Auth** — admin endpoints reject missing / non-admin tokens with 401 / 403 respectively.

---

## 12. Changelog

| Date       | Change                    | Ticket / PR |
| :--------- | :------------------------ | :---------- |
| 2026-06-26 | Initial Seasons endpoint spec | —         |
|            |                           |             |
|            |                           |             |

---

## 13. License & ownership

This specification is under the same license as the Nexus Anime repository. Endpoint contract changes require review from the **Lead API Architect** and two approving engineers. All trademarks and brand assets referenced remain property of their respective owners.
