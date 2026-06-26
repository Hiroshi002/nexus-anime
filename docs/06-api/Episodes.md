# Episodes

> **Authoritative endpoint reference** for the `/api/v1/episodes` resource. Covers episode listing, detail reads, admin mutations, and signed-stream issuance.
>
> Ownership: **Lead API Architect**. Last reviewed: 2026-06-26.

---

## 1. Purpose

The Episodes resource is the read and administrative surface for individual watchable units of an anime. It powers:

- **Episode list views** — paginated, filterable, sortable episode lists on anime detail pages and season pages.
- **Episode detail** — single-episode metadata for the video player, including an opaque reference to the Cloudflare Stream video asset.
- **Admin curation** — creation (single or batch), metadata updates, and soft-deletes.
- **Playback authorization** — issuing short-lived, geo-restricted signed Cloudflare Stream URLs (5-minute expiry).

All read endpoints are **edge-cacheable**. Mutation endpoints require admin role and invalidate the cache via `@nexus/cache` write-through helpers.

**Schema reference:** The authoritative column list, constraints, indexes, and enum values live in [`docs/07-database/Episode.md`](../07-database/Episode.md). This endpoint document only summarizes field shapes for request/response contract clarity.

**Playback contract:** This document describes metadata endpoints only. The actual signed-URL issuance flow, signing algorithm, and geo-restriction policy are described in `docs/06-api/Uploads.md`. The response field `video_asset_id` is an opaque identifier — never a playable URL.

---

## 2. Fields & enums (summary)

Endpoint request and response payloads use the schema types below. They mirror the columns defined in `docs/07-database/Episode.md` section 2.

```ts
// Response payload shape — GET /api/v1/episodes/{id}, and items in paginated list.
Episode: {
  id!: string;                        // uuid
  anime_id!: string;                  // uuid — parent anime
  season_id?: string | null;          // uuid — owning season, null for flat shows
  number!: number;                    // integer — per-season sequence (1-based)
  number_explicit?: number | null;    // integer — absolute episode number across all seasons
  title?: string | null;
  synopsis?: string | null;           // sanitized at render
  duration_seconds!: number;          // integer — runtime in seconds
  aired_at?: string | null;          // ISO-8601 timestamptz
  thumbnail_url?: string | null;
  video_asset_id?: string | null;     // opaque Cloudflare Stream asset id — NEVER a playable URL
  video_duration_seconds?: number | null;  // actual encoded duration (may differ from duration_seconds)
  is_filler!: boolean;
  is_premium!: boolean;
  version!: number;                   // optimistic concurrency token
  created_at!: string;                // ISO-8601 timestamptz
  updated_at!: string;                // ISO-8601 timestamptz
}
```

No string enums are defined on this resource. The boolean flags `is_filler` and `is_premium` are described in `docs/07-database/Episode.md` section 2.4.

---

## 3. Cache headers

All **read-only** endpoints in this document emit the same cache policy:

```
Cache-Control: public, max-age=1800, stale-while-revalidate=3600
```

Rationale: episode metadata changes on a human-curated cadence (not real-time), but less frequently than the anime catalog itself — episode lists are longer-lived than catalog search results. 30 minutes freshness serves subsequent page loads from CDN edge; 1 hour of stale-while-revalidate covers the gap while the origin revalidates in the background. Personalized responses (e.g., a user-specific watch-progress sub-field, omitted here for M3+) emit `private` instead.

**Mutation endpoints** (POST, PATCH, DELETE) do not carry cache headers — responses are not cacheable by definition. The handler is responsible for invalidating cached read keys in `@nexus/cache` (`nexus:anime:{animeId}:episodes:*`, `nexus:episodes:{id}:*`).

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
| `EPISODE_NOT_FOUND`  | 404  | `id` lookup miss (no deleted)            |
| `ANIME_NOT_FOUND`    | 404  | `animeId` path param lookup miss         |
| `SEASON_NOT_FOUND`   | 404  | `season_id` filter references missing season |
| `CONFLICT`           | 409  | Version mismatch on PATCH                |
| `RATE_LIMITED`       | 429  | Quota exhausted                          |
| `INTERNAL_ERROR`     | 500  | Unhandled failure                        |

Sub-code naming follows the `*_NOT_FOUND` pattern for each entity. A deleted episode returns `EPISODE_NOT_FOUND`, not `410 Gone` — soft-deleted rows are indistinguishable from non-existent rows at the API layer.

---

## 5. Authentication

| Endpoint group                              | Auth required                         |
| :------------------------------------------ | :------------------------------------ |
| GET reads (section 6.1–6.3)                 | None — public endpoint                |
| GET `/api/v1/episodes/{id}/stream` (6.4)    | Valid session or bearer token (user)  |
| POST `/api/v1/anime/{animeId}/episodes` (6.5) | `Authorization: Bearer <admin-token>` + admin role |
| PATCH `/api/v1/episodes/{id}` (6.6)         | Same                                  |
| DELETE `/api/v1/episodes/{id}` (6.7)        | Same                                  |

The admin role check follows the policy in [`Authentication.md`](./Authentication.md). Bearer tokens are validated by middleware before the handler runs. A `401 UNAUTHORIZED` reply is returned when the token is absent or invalid; a `403 FORBIDDEN` reply is returned when the token identifies a user who is not in the admin role.

The **stream endpoint** (6.4) requires a valid user session (Auth.js) or bearer token — it is the authorization boundary for playback. The caller must be authenticated so the server can evaluate geo-restriction and premium-tier access before issuing a signed URL.

---

## 6. Endpoints

### 6.1. `GET /api/v1/anime/{animeId}/episodes` — list episodes

#### Purpose

Paginated, filterable, sortable episode list for an anime. Used by the anime detail page episode index and the season page. Returns a **slim** projection of the Episode schema — fields that carry a material cost at list-view density (full synopsis, version, audit fields) are deliberately omitted. Use the detail endpoint (6.2) for the full record.

#### Method & URL

```
GET /api/v1/anime/{animeId}/episodes
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
| `Cache-Control` (response) | `public, max-age=1800, stale-while-revalidate=3600` |

#### Query parameters

All query parameters are optional. Combining filters is an AND operation across facets.

| Parameter | Type | Default | Description |
| :-------- | :--- | :------ | :---------- |
| `season_id?` | `string` (uuid) | — | Filter to a specific season. Must belong to the anime identified by `animeId` (returns `SEASON_NOT_FOUND` otherwise). |
| `is_filler?` | `boolean` | — | `true` returns only fillers; `false` returns only canon; omit returns all. |
| `is_premium?` | `boolean` | — | `true` returns only premium episodes; `false` returns only free; omit returns all. |
| `sort?` | `EpisodeSort` | `"number"` | Sort field. See sorting table below. |
| `order?` | `"asc"` \| `"desc"` | varies by sort | Sort direction. Default is `asc` for `number` and `number_explicit`; `desc` for `aired_at`. |
| `cursor?` | `string` | — | Opaque cursor from `meta.pagination.nextCursor` of the previous page. Omit for the first page. |
| `limit?` | `integer` (1–100) | `50` | Page size. Hard cap 100. Values above the cap are clamped. |

#### Sorting

| `sort` value | Indexed column | Default `order` |
| :----------- | :------------- | :-------------- |
| `number` | `number ASC` | `asc` |
| `number_explicit` | `number_explicit ASC` | `asc` |
| `aired_at` | `aired_at DESC` | `desc` |

All sort columns have `WHERE deleted_at IS NULL` indexes defined in `docs/07-database/Episode.md` section 2.3.

#### Filter semantics detail

- **Empty string query params** are treated as absent (e.g. `?is_filler=` is the same as omitting `is_filler`).
- **`season_id` validation** — the server verifies the supplied `season_id` points to a season with `anime_id = animeId`. A mismatch returns `SEASON_NOT_FOUND`.
- **Combining `season_id` and `is_filler`** is permitted and narrows the intersection.

#### Response schema

```ts
{
  data: EpisodeSummary[],
  meta: {
    requestId: string,
    pagination: {
      nextCursor: string | null,
      hasMore: boolean,
    },
  }
}
```

`EpisodeSummary` is the trimmed list-view projection:

```ts
EpisodeSummary: {
  id: string,
  anime_id: string,
  season_id?: string | null,
  number: number,
  number_explicit?: number | null,
  title?: string | null,
  duration_seconds: number,
  aired_at?: string | null,
  thumbnail_url?: string | null,
  video_asset_id?: string | null,
  video_duration_seconds?: number | null,
  is_filler: boolean,
  is_premium: boolean,
}
```

#### Success response example

```http
GET /api/v1/anime/a1b2c3d4-e5f6-7890-abcd-ef1234567890/episodes?season_id=s1b2c3d4-e5f6-7890-abcd-ef1234567890&is_filler=false&sort=number&limit=3
```

```json
{
  "data": [
    {
      "id": "e1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "anime_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "season_id": "s1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "number": 1,
      "number_explicit": 1,
      "title": "The Tale of the Princess Kaguya",
      "duration_seconds": 14820,
      "aired_at": "2026-07-05T00:00:00Z",
      "thumbnail_url": "https://img.nexus-anime.app/ep/e1b2c3d4/thumb.jpg",
      "video_asset_id": "cf-stream-asset-abc123",
      "video_duration_seconds": 14820,
      "is_filler": false,
      "is_premium": false
    },
    {
      "id": "e2b2c3d4-e5f6-7890-abcd-ef1234567890",
      "anime_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "season_id": "s1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "number": 2,
      "number_explicit": 2,
      "title": "The Promise",
      "duration_seconds": 2520,
      "aired_at": "2026-07-12T00:00:00Z",
      "thumbnail_url": "https://img.nexus-anime.app/ep/e2b2c3d4/thumb.jpg",
      "video_asset_id": "cf-stream-asset-def456",
      "video_duration_seconds": 2520,
      "is_filler": false,
      "is_premium": false
    },
    {
      "id": "e3b2c3d4-e5f6-7890-abcd-ef1234567890",
      "anime_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "season_id": "s1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "number": 3,
      "number_explicit": 3,
      "title": "The Journey",
      "duration_seconds": 2520,
      "aired_at": "2026-07-19T00:00:00Z",
      "thumbnail_url": "https://img.nexus-anime.app/ep/e3b2c3d4/thumb.jpg",
      "video_asset_id": "cf-stream-asset-ghi789",
      "video_duration_seconds": 2520,
      "is_filler": false,
      "is_premium": false
    }
  ],
  "meta": {
    "requestId": "req_9a8b7c6d5e4f",
    "pagination": {
      "nextCursor": "eyJudW1iZXIiOiAzLCAiaWQiOiJlM2IyYzNkNCJ9",
      "hasMore": true
    }
  }
}
```

HTTP: `200`

#### Error responses

| Scenario | HTTP | `code` | `details` |
| :------- | :--- | :----- | :-------- |
| `animeId` not a valid UUID | 400 | `VALIDATION_ERROR` | `errors[]` on `animeId` |
| No active anime with that `animeId` | 404 | `ANIME_NOT_FOUND` | `{ animeId }` |
| `season_id` does not belong to `animeId` | 404 | `SEASON_NOT_FOUND` | `{ season_id }` |
| `limit` outside 1–100 | 400 | `VALIDATION_ERROR` | `errors[]` on `limit` |
| Malformed `cursor` | 400 | `VALIDATION_ERROR` | `errors[]` on `cursor` |

Any `VALIDATION_ERROR` follows the [`Error-Codes.md`](./Error-Codes.md) shape with `details.errors[]`.

---

### 6.2. `GET /api/v1/episodes/{id}` — single episode

#### Purpose

Fetch the full record for a single episode. Used by the video player hydration and admin editor. Includes the opaque `video_asset_id` reference — the client must exchange this for a signed URL via section 6.4.

#### Method & URL

```
GET /api/v1/episodes/{id}
```

#### Path parameters

| Parameter | Type | Required | Description |
| :-------- | :--- | :------- | :---------- |
| `id` | `string` (uuid) | yes | Episode surrogate key. |

#### Auth

None.

#### Headers

| Header | Value |
| :----- | :---- |
| `Accept` | `application/json` |
| `Cache-Control` (response) | `public, max-age=1800, stale-while-revalidate=3600` |

#### Response schema

```ts
{
  data: Episode,        // Full Episode schema (section 2)
  meta: { requestId: string }
}
```

Returns `EPISODE_NOT_FOUND` if the `id` does not match an active row.

#### Success response example

```http
GET /api/v1/episodes/e1b2c3d4-e5f6-7890-abcd-ef1234567890
```

```json
{
  "data": {
    "id": "e1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "anime_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "season_id": "s1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "number": 1,
    "number_explicit": 1,
    "title": "The Tale of the Princess Kaguya",
    "synopsis": "A bamboo cutter discovers a tiny girl inside a glowing bamboo stalk.",
    "duration_seconds": 14820,
    "aired_at": "2026-07-05T00:00:00Z",
    "thumbnail_url": "https://img.nexus-anime.app/ep/e1b2c3d4/thumb.jpg",
    "video_asset_id": "cf-stream-asset-abc123",
    "video_duration_seconds": 14820,
    "is_filler": false,
    "is_premium": false,
    "version": 1,
    "created_at": "2025-11-12T08:00:00Z",
    "updated_at": "2025-11-12T08:00:00Z"
  },
  "meta": { "requestId": "req_abcd1234" }
}
```

HTTP: `200`

#### Error responses

| Scenario | HTTP | `code` | `details` |
| :------- | :--- | :----- | :-------- |
| `id` not a valid UUID | 400 | `VALIDATION_ERROR` | `errors[]` on `id` |
| No active episode with that `id` | 404 | `EPISODE_NOT_FOUND` | `{ id }` |

**Playback note:** The response contains `video_asset_id` only. The client must call `GET /api/v1/episodes/{id}/stream` (section 6.4) to obtain a signed, time-limited playback URL. The `video_asset_id` is never a playable URL and must not be used directly in a `<video>` element.

---

### 6.3. `GET /api/v1/episodes/{id}/stream` — issue signed playback URL

#### Purpose

Issue a short-lived, geo-restricted signed Cloudflare Stream URL for a specific episode. The signed URL is returned alongside metadata needed by the player (expiry, CDN edge, content-type). Actual signing and access-control policy are described in `docs/06-api/Uploads.md`.

#### Method & URL

```
GET /api/v1/episodes/{id}/stream
```

#### Path parameters

| Parameter | Type | Required | Description |
| :-------- | :--- | :------- | :---------- |
| `id` | `string` (uuid) | yes | Episode surrogate key. |

#### Auth

Valid session cookie or `Authorization: Bearer <token>`. Required — this endpoint is the authorization boundary for playback. The server evaluates the caller's tier (free vs premium) and geolocation before issuing a signed URL.

#### Headers

| Header | Value |
| :----- | :---- |
| `Accept` | `application/json` |
| `Cache-Control` (response) | `private, no-cache, no-store, must-revalidate` |

The response is **never cached at the edge** — each call mints a fresh signed URL with a new expiry.

#### Response schema

```ts
{
  data: {
    episode_id: string,               // echo back the episode id
    signed_url: string,               // Cloudflare Stream signed URL (5-minute expiry)
    expires_at: string,               // ISO-8601 — when the signed_url becomes invalid
    geo_restriction: {
      allowed_countries: string[],    // ISO-3166-1 alpha-2 country codes; empty = no restriction
      blocked_countries: string[],    // explicitly blocked (sanctions, licensing)
    },
    playback_protocol: "hls" | "dash",
    drm?: {                           // future — M5+ DRM integration
      type: "widevine" | "fairplay",
      license_url: string,
    },
  },
  meta: { requestId: string }
}
```

#### Success response example

```http
GET /api/v1/episodes/e1b2c3d4-e5f6-7890-abcd-ef1234567890/stream
```

```json
{
  "data": {
    "episode_id": "e1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "signed_url": "https://stream.nexus-anime.app/abc123/playlist.m3u8?token=eyJhbGciOiJIUzI1NiIs...&exp=1719399600",
    "expires_at": "2026-06-26T10:05:00Z",
    "geo_restriction": {
      "allowed_countries": ["US", "CA", "GB", "JP"],
      "blocked_countries": ["KP", "IR", "SY"]
    },
    "playback_protocol": "hls"
  },
  "meta": { "requestId": "req_stream_abc123" }
}
```

HTTP: `200`

#### Error responses

| Scenario | HTTP | `code` | `details` |
| :------- | :--- | :----- | :-------- |
| `id` not a valid UUID | 400 | `VALIDATION_ERROR` | `errors[]` on `id` |
| No active episode with that `id` | 404 | `EPISODE_NOT_FOUND` | `{ id }` |
| Episode has no `video_asset_id` | 404 | `EPISODE_NOT_FOUND` | `{ id, reason: "no_video_asset" }` |
| Caller not authenticated | 401 | `UNAUTHORIZED` | — |
| Caller tier insufficient for premium episode | 402 | `PAYMENT_REQUIRED` | `{ required_tier: "premium" }` |
| Caller geolocation blocked by licensing | 403 | `FORBIDDEN` | `{ reason: "geo_blocked", country: "XX" }` |
| Cloudflare Stream signing service unreachable | 502 | `UPSTREAM_ERROR` | — |

#### Expiry & re-request policy

- Signed URLs are valid for **5 minutes** from issuance.
- The client **must not** cache the signed URL beyond its `expires_at`. The `Cache-Control: private, no-cache, no-store, must-revalidate` header enforces this.
- If the URL expires mid-playback, the player should re-call this endpoint to obtain a fresh URL. The server rate-limits this endpoint per user (see `Rate-Limiting.md`) to prevent abuse.
- A signed URL is **single-use per issuance** — two requests for the same episode produce different tokens with independent expiry windows.

---

### 6.4. `POST /api/v1/anime/{animeId}/episodes` — admin create (single or batch)

#### Purpose

Create one or more episode records for an anime. Used by the admin curation UI and by the TMDB/AniList import flow. Supports both single-episode creation and batch creation via the `episodes[]` array.

#### Method & URL

```
POST /api/v1/anime/{animeId}/episodes
```

#### Path parameters

| Parameter | Type | Required | Description |
| :-------- | :--- | :------- | :---------- |
| `animeId` | `string` (uuid) | yes | Parent anime surrogate key. |

#### Auth

`Authorization: Bearer <admin-token>` + admin role.

#### Headers

| Header | Value |
| :----- | :---- |
| `Authorization` | `Bearer <admin-token>` |
| `Content-Type` | `application/json` |
| `Cache-Control` (response) | none (response not cacheable) |

#### Body schema

The body accepts either a single episode object or a batch wrapper. Both shapes are validated by Zod.

```ts
// Single-episode form:
EpisodeCreateRequest: {
  season_id?: string,                   // uuid — must belong to animeId
  number!: number,                      // positive integer
  number_explicit?: number,             // positive integer
  title?: string,
  synopsis?: string,                    // sanitized server-side
  duration_seconds!: number,            // positive integer
  aired_at?: string,                    // ISO-8601
  thumbnail_url?: string,
  video_asset_id?: string,              // opaque — see Uploads.md
  video_duration_seconds?: number,      // positive integer or null
  is_filler?: boolean,                  // default false
  is_premium?: boolean,                 // default false
}

// Batch form:
EpisodeBatchCreateRequest: {
  episodes!: EpisodeCreateRequest[],    // 1–500 items per call
}
```

`id`, `version`, `created_at`, `updated_at`, `created_by`, `updated_by` are managed by the database and are **not** accepted on the request.

#### Batch semantics

- Maximum **500 episodes per call**. Larger imports must paginate.
- All episodes in a single batch must belong to the same `animeId` (the path parameter).
- The operation is **atomic** — either all episodes are created or none are (single DB transaction).
- Duplicate `number` values within the same `season_id` in the batch are rejected with `409 CONFLICT`.

#### Response schema

```ts
// Single form:
{
  data: Episode,
  meta: { requestId: string }
}

// Batch form:
{
  data: Episode[],                      // created episodes, in request order
  meta: {
    requestId: string,
    count: number,
  }
}
```

#### Success response — single

HTTP: `201`. `Location: /api/v1/episodes/{id}`.

```json
{
  "data": {
    "id": "e4b2c3d4-e5f6-7890-abcd-ef1234567890",
    "anime_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "season_id": "s1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "number": 4,
    "number_explicit": 4,
    "title": "The Reunion",
    "synopsis": null,
    "duration_seconds": 2520,
    "aired_at": "2026-07-26T00:00:00Z",
    "thumbnail_url": null,
    "video_asset_id": null,
    "video_duration_seconds": null,
    "is_filler": false,
    "is_premium": false,
    "version": 1,
    "created_at": "2026-06-26T10:00:00Z",
    "updated_at": "2026-06-26T10:00:00Z"
  },
  "meta": { "requestId": "req_7b8c9d0e" }
}
```

#### Success response — batch

HTTP: `201`. No `Location` header (multiple resources).

```json
{
  "data": [
    {
      "id": "e5b2c3d4-e5f6-7890-abcd-ef1234567890",
      "anime_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "season_id": "s1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "number": 5,
      "number_explicit": 5,
      "title": "The Storm",
      "duration_seconds": 2520,
      "is_filler": false,
      "is_premium": false,
      "version": 1,
      "created_at": "2026-06-26T10:00:00Z",
      "updated_at": "2026-06-26T10:00:00Z"
    },
    {
      "id": "e6b2c3d4-e5f6-7890-abcd-ef1234567890",
      "anime_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "season_id": "s1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "number": 6,
      "number_explicit": 6,
      "title": "The Calm",
      "duration_seconds": 2520,
      "is_filler": true,
      "is_premium": false,
      "version": 1,
      "created_at": "2026-06-26T10:00:00Z",
      "updated_at": "2026-06-26T10:00:00Z"
    }
  ],
  "meta": {
    "requestId": "req_8c9d0e1f",
    "count": 2
  }
}
```

#### Error responses

| Scenario | HTTP | `code` | `details` |
| :------- | :--- | :----- | :-------- |
| `animeId` not a valid UUID | 400 | `VALIDATION_ERROR` | `errors[]` on `animeId` |
| No active anime with that `animeId` | 404 | `ANIME_NOT_FOUND` | `{ animeId }` |
| `season_id` does not belong to `animeId` | 404 | `SEASON_NOT_FOUND` | `{ season_id }` |
| Missing required `number` or `duration_seconds` | 400 | `VALIDATION_ERROR` | `errors[].code: "FIELD_REQUIRED"` |
| `number` or `duration_seconds` not positive | 400 | `VALIDATION_ERROR` | `errors[].code: "FIELD_INVALID"` |
| Duplicate `(anime_id, number)` in active data | 409 | `CONFLICT` | `{ number }` |
| Duplicate `(anime_id, season_id, number)` in active data | 409 | `CONFLICT` | `{ season_id, number }` |
| Batch exceeds 500 items | 400 | `VALIDATION_ERROR` | `errors[]` on `episodes` |
| Any item in batch fails validation | 400 | `VALIDATION_ERROR` | `errors[]` with item index |

---

### 6.5. `PATCH /api/v1/episodes/{id}` — admin update

#### Purpose

Partial update of an episode record. Used by the admin editor and by the TMDB/AniList re-import flow. **Optimistic concurrency enforced via `version`.**

#### Method & URL

```
PATCH /api/v1/episodes/{id}
```

#### Path parameters

| Parameter | Type | Required | Description |
| :-------- | :--- | :------- | :---------- |
| `id` | `string` (uuid) | yes | Episode surrogate key. |

#### Auth

`Authorization: Bearer <admin-token>` + admin role.

#### Headers

| Header | Value |
| :----- | :---- |
| `Authorization` | `Bearer <admin-token>` |
| `Content-Type` | `application/json` |
| `If-Match` | `"<version>"` (strong recommended; see below) |
| `Cache-Control` (response) | none |

#### Optimistic concurrency

`PATCH` uses the `version` column to prevent lost updates:

- The client reads a record (e.g., via `GET /api/v1/episodes/{id}`), holding `version: 1`.
- The client issues `PATCH /api/v1/episodes/{id}` with version indicator.
- If another writer has since bumped the version, the request **fails** with `409 CONFLICT` and the current record's version in `details.currentVersion`.
- On success, the server increments `version` and returns the updated record.

**Version transmission options** (in precedence order):

1. **`If-Match` header** with strong ETag: `If-Match: "1"`. Preferred when the client has read the record recently.
2. **`version` field in the body**: `{ "version": 1, ...updates }`. Convenient when the read is embedded in the form state.
3. **No version provided**: rejected with `400 VALIDATION_ERROR` on the field `version`. We **require** a version on every admin PATCH — silent no-version writes are a footgun.

#### Body schema

```ts
EpisodeUpdateRequest: {
  version!: number,                    // required for optimistic concurrency
  season_id?: string | null,           // uuid — must belong to anime_id
  number?: number,                     // positive integer
  number_explicit?: number | null,     // positive integer
  title?: string | null,
  synopsis?: string | null,
  duration_seconds?: number,           // positive integer
  aired_at?: string | null,             // ISO-8601
  thumbnail_url?: string | null,
  video_asset_id?: string | null,       // opaque — see Uploads.md
  video_duration_seconds?: number | null,  // positive integer or null
  is_filler?: boolean,
  is_premium?: boolean,
}
```

#### Response schema

Same as 6.2 `GET /api/v1/episodes/{id}` with the updated `version`.

#### Success response

HTTP: `200`.

```json
{
  "data": {
    "id": "e4b2c3d4-e5f6-7890-abcd-ef1234567890",
    "anime_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "season_id": "s1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "number": 4,
    "number_explicit": 4,
    "title": "The Reunion (Director's Cut)",
    "synopsis": "A longer cut of the reunion scene.",
    "duration_seconds": 2880,
    "aired_at": "2026-07-26T00:00:00Z",
    "thumbnail_url": null,
    "video_asset_id": null,
    "video_duration_seconds": null,
    "is_filler": false,
    "is_premium": false,
    "version": 2,
    "created_at": "2026-06-26T10:00:00Z",
    "updated_at": "2026-06-26T11:00:00Z"
  },
  "meta": { "requestId": "req_8c9d0e1f" }
}
```

#### Error responses

| Scenario | HTTP | `code` | `details` |
| :------- | :--- | :----- | :-------- |
| `id` not a valid UUID | 400 | `VALIDATION_ERROR` | `errors[]` on `id` |
| No active episode with that `id` | 404 | `EPISODE_NOT_FOUND` | `{ id }` |
| No `version` provided (missing header **and** body field) | 400 | `VALIDATION_ERROR` | `errors[].code: "FIELD_REQUIRED"` on `version` |
| `version` mismatch (record has version 2, request says 1) | 409 | `CONFLICT` | `{ currentVersion: 2 }` |
| `season_id` does not belong to episode's `anime_id` | 404 | `SEASON_NOT_FOUND` | `{ season_id }` |
| New `number` conflicts with existing active episode | 409 | `CONFLICT` | `{ number }` |

#### Retry guidance for clients

On `409 CONFLICT`, the client should:

1. Re-fetch the current record via `GET /api/v1/episodes/{id}`.
2. Present the user with the current state and re-apply the intended edits.
3. Re-issue the PATCH with the new `version`.

Do not blindly replay the original PATCH body.

---

### 6.6. `DELETE /api/v1/episodes/{id}` — admin soft-delete

#### Purpose

Soft-delete an episode record by setting `deleted_at = now()`. The row is retained to preserve referential integrity with historical watch-history data and to make undeletion possible via admin tools.

#### Method & URL

```
DELETE /api/v1/episodes/{id}
```

#### Path parameters

| Parameter | Type | Required | Description |
| :-------- | :--- | :------- | :---------- |
| `id` | `string` (uuid) | yes | Episode to soft-delete. |

#### Auth

`Authorization: Bearer <admin-token>` + admin role.

#### Headers

| Header | Value |
| :----- | :---- |
| `Authorization` | `Bearer <admin-token>` |
| `Cache-Control` (response) | none |

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
    "id": "e4b2c3d4-e5f6-7890-abcd-ef1234567890",
    "deleted_at": "2026-06-26T11:00:00Z"
  },
  "meta": { "requestId": "req_9d0e1f2a" }
}
```

The soft-delete is idempotent: calling `DELETE` on an already-deleted record returns the current `deleted_at` and `200` rather than `404`.

#### Error responses

| Scenario | HTTP | `code` | `details` |
| :------- | :--- | :----- | :-------- |
| `id` not a valid UUID | 400 | `VALIDATION_ERROR` | `errors[]` |
| No record exists with that `id` (including hard-deleted archival) | 404 | `EPISODE_NOT_FOUND` | `{ id }` |

#### Cascade note

Soft-delete does **not** cascade — watch-history and watch-progress tables retain the episode FK; query filters inside reads (`WHERE deleted_at IS NULL` on `episodes`) exclude the deleted row from listings and detail endpoints automatically.

---

## 7. Endpoint map reference

| Method | URL | Auth |
| :----- | :-- | :---- |
| `GET` | `/api/v1/anime/{animeId}/episodes` | none |
| `GET` | `/api/v1/episodes/{id}` | none |
| `GET` | `/api/v1/episodes/{id}/stream` | session or bearer (user) |
| `POST` | `/api/v1/anime/{animeId}/episodes` | bearer + admin |
| `PATCH` | `/api/v1/episodes/{id}` | bearer + admin |
| `DELETE` | `/api/v1/episodes/{id}` | bearer + admin |

---

## 8. Out-of-scope sections

The following are explicitly **not** covered in this document but are companions to the Episodes resource:

| Topic | Where |
| :---- | :---- |
| Season grouping & navigation | `docs/06-api/Seasons.md` |
| Cloudflare Stream signing algorithm & upload flow | `docs/06-api/Uploads.md` |
| User watch history & continue-watching | `docs/06-api/Watch-History.md` and `Continue-Watching.md` |
| Episode comments | `docs/06-api/Comments.md` |
| Subtitle tracks & preview thumbnails | Future milestone (section 9) |

---

## 9. Future milestones

### 9.1. Episode subtitle tracks (M5+)

A `episode_subtitles` table will store per-episode subtitle metadata:

```ts
EpisodeSubtitle: {
  id: string,                  // uuid
  episode_id: string,          // FK → episodes.id
  language_code: string,       // ISO-639-1 (e.g. "en", "ja")
  label: string,               // display label (e.g. "English", "日本語")
  format: "vtt" | "ass",
  url: string,                 // signed URL to subtitle file
  is_default: boolean,
  created_at: string,
}
```

The `GET /api/v1/episodes/{id}` response will gain an optional `subtitles?: EpisodeSubtitle[]` field when subtitles are available. The client player uses this to render subtitle track selectors.

### 9.2. Episode preview thumbnails (M5+)

A `episode_thumbnails` table will store per-episode preview thumbnail strips (for hover-scrub previews):

```ts
EpisodeThumbnail: {
  id: string,                  // uuid
  episode_id: string,          // FK → episodes.id
  interval_seconds: number,    // e.g. 10 — one thumb every 10s
  sprite_url: string,          // signed URL to sprite sheet
  width: number,               // per-frame width
  height: number,              // per-frame height
  frame_count: number,
  created_at: string,
}
```

The `GET /api/v1/episodes/{id}` response will gain an optional `preview_thumbnails?: EpisodeThumbnail` field. The client player uses this to render hover-scrub preview thumbnails.

---

## 10. Testing checklist

Before landing a change to this surface, verify:

- **Type safety** — `pnpm typecheck` passes. No `any` introduced in handler, serializer, or schema.
- **Build safety** — `pnpm build` succeeds. Handlers compile under Next.js App Router convention.
- **Runtime safety** — happy path, empty list, deleted lookup, admin `403`, stream `401` all return a typed envelope without throwing.
- **Edge cases** — zero results (200, `data: []`), `limit: 0` clamped, `season_id` mismatch, batch duplicate `number`, version mismatch retry, double-delete idempotency, stream re-request after expiry.
- **Error handling** — no unhandled promise rejections; no leaked stack traces; friendly `message` values.
- **Caching** — reads include the cache headers defined in section 3; stream endpoint emits `private, no-cache, no-store, must-revalidate`; mutations invalidate the relevant `@nexus/cache` prefix.
- **Auth** — admin endpoints reject missing / non-admin tokens with 401 / 403 respectively; stream endpoint rejects unauthenticated callers with 401.
- **Video asset opacity** — no endpoint in this document returns a playable URL. `video_asset_id` is always opaque.

---

## 11. Changelog

| Date       | Change                      | Ticket / PR |
| :--------- | :-------------------------- | :---------- |
| 2026-06-26 | Initial Episodes endpoint spec | —         |
|            |                             |             |
|            |                             |             |

---

## 12. License & ownership

This specification is under the same license as the Nexus Anime repository. Endpoint contract changes require review from the **Lead API Architect** and two approving engineers. All trademarks and brand assets referenced remain property of their respective owners.
