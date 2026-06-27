# Anime

> **Authoritative endpoint reference** for the `/api/v1/anime` resource. Covers catalog browsing, detail reads, genre/studio sub-resources, recommendations, franchise, and admin mutations.
>
> Ownership: **Lead API Architect**. Last reviewed: 2026-06-26.

---

## 1. Purpose

The Anime resource is the central read surface of the Nexus Anime catalog. It powers:

- **Catalog browsing** — paginated, filterable, sortable grid/list views on `/anime` and `/anime/explore`.
- **Detail views** — full metadata for a single anime at `/anime/{id}` and `/anime/slug/{slug}`.
- **Sub-resources** — genres, studios, recommendations, and franchise companions.
- **Admin curation** — creation, updates, and soft-deletes via internal tools.

All read endpoints are **edge-cacheable**. Mutation endpoints require admin role and invalidate the cache via `@nexus/cache` write-through helpers.

**Schema reference:** The authoritative column list, constraints, indexes, and enum values live in [`docs/07-database/Anime.md`](../07-database/Anime.md). This endpoint document only summarizes field shapes for request/response contract clarity.

---

## 2. Fields & enums (summary)

Endpoint request and response payloads use the schema types below. They mirror the columns defined in `docs/07-database/Anime.md` section 2.

```ts
// Response payload shape — GET /api/v1/anime/{id}, and items in paginated list.
Anime: {
  id!: string;                        // uuid
  slug!: string;                      // unique among active rows
  title!: string;                     // romaji/english
  title_jp?: string | null;           // kanji/kana
  title_synonyms!: string[];          // alternates for search
  synopsis?: string | null;
  status!: "unknown" | "upcoming" | "airing" | "finished" | "cancelled";
  type!: "tv" | "movie" | "ova" | "ona" | "special" | "music";
  season_year?: number | null;        // 1917–2100
  season_name?: "spring" | "summer" | "fall" | "winter" | null;
  total_episodes?: number | null;
  average_duration_minutes?: number | null;
  age_rating?: "g" | "pg" | "pg13" | "r" | "r18" | null;
  poster_url?: string | null;
  cover_url?: string | null;
  trailer_url?: string | null;
  tmdb_id?: number | null;            // unique among active rows (partial unique)
  anilist_id?: number | null;         // same
  mal_id?: number | null;             // same
  popularity_score!: number;          // numeric(8,4)
  average_rating!: number;            // numeric(3,2), 0–10
  rating_count!: number;
  view_count!: number;                // bigint
  bookmark_count!: number;
  published_at?: string | null;       // ISO-8601 timestamptz
  created_at!: string;                // ISO-8601 timestamptz
  updated_at!: string;                // ISO-8601 timestamptz
  version!: number;                   // optimistic concurrency token
}
```

String enums (`status`, `type`, `age_rating`, `season_name`) are described in `docs/07-database/Anime.md` sections 2.3–2.5.

---

## 3. Cache headers

All **read-only** endpoints in this document emit the same cache policy:

```
Cache-Control: public, max-age=3600, stale-while-revalidate=86400
```

Rationale: catalog data changes on a human-curated cadence (not real-time). 1 hour freshness serves subsequent page loads from CDN edge; 24 hours of stale-while-revalidate covers the gap while the origin revalidates in the background. Personalized responses (e.g., a user-specific bookmark sub-field, omitted here for M3+) emit `private` instead.

**Mutation endpoints** (POST, PATCH, DELETE) do not carry cache headers — responses are not cacheable by definition. The handler is for invalidating cached read keys in `@nexus/cache` (`nexus:anime:{id}:*`, `nexus:anime:list:*`).

See [API-Standards.md](./API-Standards.md) section on caching for the full cache key schema.

---

## 4. Common error codes

All endpoints in this document share the error envelope and code registry defined in [`Error-Codes.md`](./Error-Codes.md). The codes you will see here:

| Code               | HTTP | Trigger in this resource                |
| :----------------- | :--- | :-------------------------------------- |
| `VALIDATION_ERROR` | 400  | Query/body failed Zod schema            |
| `FIELD_REQUIRED`   | 400  | Nested in `VALIDATION_ERROR.details`    |
| `FIELD_INVALID`    | 400  | Nested in `VALIDATION_ERROR.details`    |
| `UNAUTHORIZED`     | 401  | Missing bearer token on admin endpoints |
| `FORBIDDEN`        | 403  | Non-admin caller on admin endpoints     |
| `ANIME_NOT_FOUND`  | 404  | `id` or `slug` lookup miss (no deleted) |
| `CONFLICT`         | 409  | Version mismatch on PATCH               |
| `RATE_LIMITED`     | 429  | Quota exhausted                         |
| `INTERNAL_ERROR`   | 500  | Unhandled failure                       |

Sub-code naming follows the `*_NOT_FOUND` pattern for each entity. A deleted anime returns `ANIME_NOT_FOUND`, not `410 Gone` — soft-deleted rows are indistinguishable from non-existent rows at the API layer.

---

## 5. Authentication

| Endpoint group                           | Auth required                                      |
| :--------------------------------------- | :------------------------------------------------- |
| GET reads (section 6.1–6.7, 6.9)         | None — public endpoint                             |
| GET `/api/v1/anime/search` (section 6.8) | None — public                                      |
| POST `/api/v1/anime` (section 6.10)      | `Authorization: Bearer <admin-token>` + admin role |
| PATCH `/api/v1/anime/{id}` (6.11)        | Same                                               |
| DELETE `/api/v1/anime/{id}` (6.12)       | Same                                               |

The admin role check follows the policy in [`Authentication.md`](./Authentication.md). Bearer tokens are validated by middleware before the handler runs. A `401 UNAUTHORIZED` reply is returned when the token is absent or invalid; a `403 FORBIDDEN` reply is returned when the token identifies a user who is not in the admin role.

---

## 6. Endpoints

### 6.1. `GET /api/v1/anime` — browse catalog

#### Purpose

Paginated, filterable list endpoint used by the catalog grid and explore pages. Returns a **slim** projection of the Anime schema — fields that carry a material cost at list-view density (full synopsis, version, audit fields) are deliberately omitted. Use the detail endpoint (6.2, 6.3) for the full record.

#### Method & URL

```
GET /api/v1/anime
```

#### Auth

None.

#### Headers

| Header                     | Value                                                |
| :------------------------- | :--------------------------------------------------- |
| `Accept`                   | `application/json`                                   |
| `Cache-Control` (response) | `public, max-age=3600, stale-while-revalidate=86400` |

#### Query parameters

All query parameters are optional. Combining filters is an AND operation across facets; `genres` / `studios` are OR-within-facet (any match within the list).

| Parameter      | Type                         | Default        | Description                                                                                                    |
| :------------- | :--------------------------- | :------------- | :------------------------------------------------------------------------------------------------------------- |
| `q?`           | `string`                     | —              | Free-text search. Shortcut from 6.9; delegates to the same full-text path below.                               |
| `status?`      | `AnimeStatus`                | —              | Filter by lifecycle status. One of `unknown`, `upcoming`, `airing`, `finished`, `cancelled`.                   |
| `type?`        | `AnimeType`                  | —              | Filter by `tv`, `movie`, `ova`, `ona`, `special`, `music`.                                                     |
| `season_year?` | `integer`                    | —              | Broadcast year (e.g. 2024).                                                                                    |
| `season_name?` | `SeasonName`                 | —              | One of `spring`, `summer`, `fall`, `winter`. Useful combined with `season_year`.                               |
| `age_rating?`  | `AgeRating`                  | —              | One of `g`, `pg`, `pg13`, `r`, `r18`. Match exact.                                                             |
| `genres?`      | `string[]` (CSV or repeated) | —              | One or more genre IDs. Anime matching **any** of the supplied genres is included.                              |
| `studios?`     | `string[]` (CSV or repeated) | —              | One or more studio IDs. Anime matching **any** of the supplied studios is included.                            |
| `min_rating?`  | `number`                     | —              | Inclusive lower bound on `average_rating` (0–10). Use `0` to include unrated items; omit to disable.           |
| `sort?`        | `AnimeSort`                  | `"popularity"` | Sort field. See sorting table below.                                                                           |
| `order?`       | `"asc"` \| `"desc"`          | varies by sort | Sort direction. Default is `desc` for `popularity`, `rating`, `published_at`, `created_at`; `asc` for `title`. |
| `cursor?`      | `string`                     | —              | Opaque cursor from `meta.pagination.nextCursor` of the previous page. Omit for the first page.                 |
| `limit?`       | `integer` (1–100)            | `20`           | Page size. Hard cap 100. Values above the cap are clamped.                                                     |

#### Sorting

| `sort` value   | Indexed column                           | Default `order`                                           |
| :------------- | :--------------------------------------- | :-------------------------------------------------------- |
| `popularity`   | `popularity_score DESC`                  | `desc`                                                    |
| `rating`       | `average_rating DESC, rating_count DESC` | `desc` (weighting avoids 5.0 with 1 vote floating to top) |
| `published_at` | `published_at DESC`                      | `desc`                                                    |
| `created_at`   | `created_at DESC`                        | `desc`                                                    |
| `title`        | `title ASC`                              | `asc`                                                     |

All sort columns have `WHERE deleted_at IS NULL` indexes defined in `docs/07-database/Anime.md` section 2.6.

#### Filter semantics detail

- **Empty string query params** are treated as absent (e.g. `?status=` is the same as omitting `status`).
- **Multiple values** for list params can be either comma-separated (`?genres=a,b,c`) or repeated (`?genres=a&genres=b&genres=c`). Both are equivalent.
- **`q` search** — see section 6.9. The catalog shortcut always uses `kind: "quick"` regardless of what the advanced search UI produces; there is no way to switch modes from this endpoint.
- **`min_rating: 0`** is not the same as omitting it: a `0` filter includes items with `average_rating = 0`, whereas omitting the filter includes everything. Be explicit.
- **Combining `season_year` and `season_name`** is permitted and narrows the intersection (e.g., spring 2024).

#### Response schema

```ts
{
  data: AnimeSummary[],
  meta: {
    requestId: string,
    pagination: {
      nextCursor: string | null,
      hasMore: boolean,
    },
  }
}
```

`AnimeSummary` is the trimmed list-view projection:

```ts
AnimeSummary: {
  id: string,
  slug: string,
  title: string,
  title_jp?: string | null,
  status: AnimeStatus,
  type: AnimeType,
  season_year?: number | null,
  season_name?: SeasonName | null,
  total_episodes?: number | null,
  age_rating?: AgeRating | null,
  poster_url?: string | null,
  trailer_url?: string | null,
  average_rating: number,
  rating_count: number,
  popularity_score: number,
}
```

#### Success response example

```http
GET /api/v1/anime?status=airing&type=tv&season_year=2026&season_name=summer&min_rating=7&sort=rating&limit=3
```

```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "slug": "dandadan",
      "title": "Dandadan",
      "title_jp": "ダンダダン",
      "status": "airing",
      "type": "tv",
      "season_year": 2026,
      "season_name": "summer",
      "total_episodes": 12,
      "age_rating": "pg13",
      "poster_url": "https://img.nexus-anime.app/poster/dandadan.jpg",
      "trailer_url": "https://stream.nexus-anime.app/trailer/dandadan.m3u8",
      "average_rating": 8.42,
      "rating_count": 12840,
      "popularity_score": 912.73
    }
  ],
  "meta": {
    "requestId": "req_9a8b7c6d5e4f",
    "pagination": {
      "nextCursor": "eyJzY29yZSI6IDkxMi43MywgImlkIjoiYTFiMmMzZDQifQ",
      "hasMore": true
    }
  }
}
```

HTTP: `200`

#### Error responses

| Scenario                               | HTTP | `code`             | `details`                               |
| :------------------------------------- | :--- | :----------------- | :-------------------------------------- |
| Invalid enum in `status`, `type`, etc. | 400  | `VALIDATION_ERROR` | `errors[]` with `code: "FIELD_INVALID"` |
| `limit` outside 1–100                  | 400  | `VALIDATION_ERROR` | `errors[]` on `limit`                   |
| `min_rating` outside 0–10              | 400  | `VALIDATION_ERROR` | `errors[]` on `min_rating`              |
| `season_year` outside 1917–2100        | 400  | `VALIDATION_ERROR` | `errors[]` on `season_year`             |
| Malformed `cursor`                     | 400  | `VALIDATION_ERROR` | `errors[]` on `cursor`                  |

Any `VALIDATION_ERROR` follows the [`Error-Codes.md`](./Error-Codes.md) shape with `details.errors[]`.

---

### 6.2. `GET /api/v1/anime/{id}` — detail by ID

#### Purpose

Fetch the full record for a single anime. Used by the detail page and admin editor hydration.

#### Method & URL

```
GET /api/v1/anime/{id}
```

#### Path parameters

| Parameter | Type            | Required | Description                           |
| :-------- | :-------------- | :------- | :------------------------------------ |
| `id`      | `string` (uuid) | yes      | Surrogate key from the `anime` table. |

#### Auth

None.

#### Headers

| Header                     | Value                                                |
| :------------------------- | :--------------------------------------------------- |
| `Accept`                   | `application/json`                                   |
| `Cache-Control` (response) | `public, max-age=3600, stale-while-revalidate=86400` |

#### Response schema

```ts
{
  data: Anime,        // Full Anime schema (section 2)
  meta: { requestId: string }
}
```

Returns `ANIME_NOT_FOUND` if the `id` does not match an active row.

#### Success response example

```http
GET /api/v1/anime/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "slug": "dandadan",
    "title": "Dandadan",
    "title_jp": "ダンダダン",
    "title_synonyms": ["Dandadan", "DAN DA DAN"],
    "synopsis": "A high-school girl who believes in ghosts and a nerd who believes in aliens team up — and their rivals are real.",
    "status": "airing",
    "type": "tv",
    "season_year": 2026,
    "season_name": "summer",
    "total_episodes": 12,
    "average_duration_minutes": 24,
    "age_rating": "pg13",
    "poster_url": "https://img.nexus-anime.app/poster/dandadan.jpg",
    "cover_url": "https://img.nexus-anime.app/cover/dandadan.jpg",
    "trailer_url": "https://stream.nexus-anime.app/trailer/dandadan.m3u8",
    "tmdb_id": 275863,
    "anilist_id": 184182,
    "mal_id": null,
    "popularity_score": 912.73,
    "average_rating": 8.42,
    "rating_count": 12840,
    "view_count": 284190,
    "bookmark_count": 98210,
    "published_at": "2026-07-05T00:00:00Z",
    "created_at": "2025-11-12T08:00:00Z",
    "updated_at": "2026-06-25T14:22:00Z",
    "version": 4
  },
  "meta": { "requestId": "req_abcd1234" }
}
```

HTTP: `200`

#### Error responses

| Scenario                       | HTTP | `code`             | `details`          |
| :----------------------------- | :--- | :----------------- | :----------------- |
| `id` not a valid UUID          | 400  | `VALIDATION_ERROR` | `errors[]` on `id` |
| No active anime with that `id` | 404  | `ANIME_NOT_FOUND`  | `{ id }`           |

---

### 6.3. `GET /api/v1/anime/slug/{slug}` — detail by slug

#### Purpose

Same as 6.2 but keyed by the unique `slug` column instead of the surrogate `id`. Used by SEO-friendly detail URLs (`/anime/slug/{slug}`).

#### Method & URL

```
GET /api/v1/anime/slug/{slug}
```

#### Path parameters

| Parameter | Type     | Required | Description                                                                        |
| :-------- | :------- | :------- | :--------------------------------------------------------------------------------- |
| `slug`    | `string` | yes      | URL-safe slug (e.g. `attack-on-titan`). Unicode letters, digits, and hyphens only. |

#### Auth

None.

#### Headers

| Header                     | Value                                                |
| :------------------------- | :--------------------------------------------------- |
| `Accept`                   | `application/json`                                   |
| `Cache-Control` (response) | `public, max-age=3600, stale-while-revalidate=86400` |

#### Response schema

Same as 6.2.

#### Success response example

```http
GET /api/v1/anime/slug/dandadan
```

Response body is structurally identical to 6.2.

#### Error responses

| Scenario                         | HTTP | `code`             | `details`            |
| :------------------------------- | :--- | :----------------- | :------------------- |
| `slug` empty or non-conforming   | 400  | `VALIDATION_ERROR` | `errors[]` on `slug` |
| No active anime with that `slug` | 404  | `ANIME_NOT_FOUND`  | `{ slug }`           |

**Behavioral note**: When a slug changes (e.g., post-import correction), the old slug becomes available for reuse once the row is updated. The detail page should re-fetch using the canonical slug discovered from the redirecting response body, not cache the old mapping indefinitely. To support legacy inbound links, the application tracks a separate `anime_slug_redirect` table (out of scope for this document).

---

### 6.4. `GET /api/v1/anime/{id}/genres` — genres for an anime

#### Purpose

List the genres associated with an anime. Joins `anime_genres` → `genres`.

#### Method & URL

```
GET /api/v1/anime/{id}/genres
```

#### Path parameters

| Parameter | Type            | Required | Description          |
| :-------- | :-------------- | :------- | :------------------- |
| `id`      | `string` (uuid) | yes      | Anime surrogate key. |

#### Auth

None.

#### Response schema

```ts
{
  data: Array<{
    id: string,            // genre uuid
    slug: string,          // genre slug (e.g. "action")
    name: string,          // display name (e.g. "Action")
    description?: string | null,
    is_adult?: boolean,
  }>,
  meta: { requestId: string }
}
```

#### Success response example

```json
{
  "data": [
    { "id": "g1", "slug": "action", "name": "Action", "description": "", "is_adult": false },
    {
      "id": "g2",
      "slug": "supernatural",
      "name": "Supernatural",
      "description": "",
      "is_adult": false
    }
  ],
  "meta": { "requestId": "req_5f6a7b8c" }
}
```

HTTP: `200`. Empty `data` array (`[]`) when the anime has zero genres — still `200`, not `404`.

#### Error responses

| Scenario                       | HTTP | `code`             | `details`  |
| :----------------------------- | :--- | :----------------- | :--------- |
| `id` not a valid UUID          | 400  | `VALIDATION_ERROR` | `errors[]` |
| No active anime with that `id` | 404  | `ANIME_NOT_FOUND`  | `{ id }`   |

---

### 6.5. `GET /api/v1/anime/{id}/studios` — studios for an anime

#### Purpose

List the studios associated with an anime, including their role. Joins `anime_studios` → `studios`.

#### Method & URL

```
GET /api/v1/anime/{id}/studios
```

#### Path parameters

| Parameter | Type            | Required | Description          |
| :-------- | :-------------- | :------- | :------------------- |
| `id`      | `string` (uuid) | yes      | Anime surrogate key. |

#### Auth

None.

#### Response schema

```ts
{
  data: Array<{
    id: string,            // studio uuid
    slug: string,
    name: string,
    role: "production" | "licensing" | "music" | "animation",
  }>,
  meta: { requestId: string }
}
```

A studio may appear multiple times for the same anime with different roles (this is the intended use of the `role` column in `anime_studios`). Clients should group by studio and display role badges.

#### Success response example

```json
{
  "data": [
    { "id": "s1", "slug": "bones", "name": "Bones", "role": "production" },
    { "id": "s1", "slug": "bones", "name": "Bones", "role": "licensing" }
  ],
  "meta": { "requestId": "req_6a7b8c9d" }
}
```

HTTP: `200`. Empty array is `200`.

#### Error responses

Same pattern as section 6.4.

---

### 6.6. `GET /api/v1/anime/{id}/recommendations` — recommendations

#### Purpose

List recommended anime for a given source anime. Backed by the system's recommendation data (M4 recommendation engine — currently returns a curated pool of popular same-genre titles).

#### Method & URL

```
GET /api/v1/anime/{id}/recommendations
```

#### Path parameters

| Parameter | Type            | Required | Description   |
| :-------- | :-------------- | :------- | :------------ |
| `id`      | `string` (uuid) | yes      | Source anime. |

#### Query parameters

| Parameter | Type             | Default | Description    |
| :-------- | :--------------- | :------ | :------------- |
| `cursor?` | `string`         | —       | Opaque cursor. |
| `limit?`  | `integer` (1–50) | `10`    | Page size.     |

#### Auth

None.

#### Response schema

Uses the standard cursor pagination envelope and `AnimeSummary` projection (mirrors the list endpoint shape).

```ts
{
  data: AnimeSummary[],
  meta: {
    requestId: string,
    pagination: { nextCursor: string | null, hasMore: boolean },
  }
}
```

#### Error responses

| Scenario                       | HTTP | `code`             | `details`  |
| :----------------------------- | :--- | :----------------- | :--------- |
| `id` not a valid UUID          | 400  | `VALIDATION_ERROR` | `errors[]` |
| No active anime with that `id` | 404  | `ANIME_NOT_FOUND`  | `{ id }`   |

---

### 6.7. `GET /api/v1/anime/{id}/franchise` — franchise

#### Purpose

Returns other anime in the same franchise — other seasons of the same series, spin-offs, and side-stories. Backed by the `franchise` / `franchise_entries` relation (introduced in M4).

#### Method & URL

```
GET /api/v1/anime/{id}/franchise
```

#### Path parameters

| Parameter | Type            | Required | Description      |
| :-------- | :-------------- | :------- | :--------------- |
| `id`      | `string` (uuid) | yes      | Reference anime. |

#### Response schema

```ts
{
  data: Array<{
    id: string,
    slug: string,
    title: string,
    type: AnimeType,
    status: AnimeStatus,
    season_year?: number | null,
    season_name?: SeasonName | null,
    relation: "prequel" | "sequel" | "spinoff" | "side_story" | "parent",
    poster_url?: string | null,
    average_rating: number,
  }>,
  meta: { requestId: string }
}
```

The result is **not paginated** — franchise sets are bounded in size (typically < 30 entries) and the client renders a lateral strip. When the franchise is incomplete or unknown, returns `200` with `data: []`.

#### Error responses

| Scenario                       | HTTP | `code`             | `details`  |
| :----------------------------- | :--- | :----------------- | :--------- |
| `id` not a valid UUID          | 400  | `VALIDATION_ERROR` | `errors[]` |
| No active anime with that `id` | 404  | `ANIME_NOT_FOUND`  | `{ id }`   |

---

### 6.8. Advanced search

The advanced search UI uses a **structured search** contract. The shortcut form (section 6.1 `?q=`) is the fast path for the header search box.

#### 6.8.1. `POST /api/v1/anime/search` — structured search

##### Purpose

Accept a structured query with the same filters as `GET /api/v1/anime` but expressed as a JSON body instead of query params. Required for advanced UI where filters arrive incrementally (facet picker, range sliders for year/rating, user-assembled genre lists), and the URL would become unwieldy.

##### Method & URL

```
POST /api/v1/anime/search
```

##### Auth

None.

##### Headers

| Header                     | Value                                                |
| :------------------------- | :--------------------------------------------------- |
| `Content-Type`             | `application/json`                                   |
| `Cache-Control` (response) | `public, max-age=3600, stale-while-revalidate=86400` |

##### Body schema

```ts
AnimeSearchRequest: {
  q?: string,                         // quick search (kind: "quick")
  query?: {                           // structured query — takes precedence over q
    kind: "quick" | "advanced",
    text?: string,                    // freeform against title + synonyms + full-text
    status?: AnimeStatus[],
    type?: AnimeType[],
    season_year_min?: number,
    season_year_max?: number,
    season_name?: SeasonName[],
    age_rating?: AgeRating[],
    genres?: string[],                // genre ids — OR-within
    studios?: string[],               // studio ids — OR-within
    min_rating?: number,
    min_popularity?: number,
  },
  sort?: AnimeSort,                   // same enum as GET
  order?: "asc" | "desc",
  cursor?: string,
  limit?: number,                    // 1–100, default 20
}
```

##### Semantics

- **Either `q` or `query` may be provided, not both.** If both are present, `query` wins and `q` is ignored. A client that only has a single search input sends `q` directly; the advanced UI builds `query`.
- **`query.text`** performs a full-text search over `title`, `title_jp`, `title_synonyms`, and a `tsvector` column when available (planned for M6 Search milestone). Pre-M6, the implementation falls back to a trigram search against these columns.
- **`query.status` / `query.type`** are multi-value (array). An anime matching **any** supplied value is included. An empty array is the same as omitting the field.
- **`query.season_year_min` / `query.season_year_max`** form an inclusive range on `season_year`. Either bound may be independently absent (e.g., min-only = 2024 and later).
- **Sorting & pagination** are identical to `GET /api/v1/anime`.

##### Response schema

Same envelope as `GET /api/v1/anime` (section 6.1): `data: AnimeSummary[]`, paginated.

##### Success example

```http
POST /api/v1/anime/search
Content-Type: application/json

{
  "query": {
    "status": ["airing", "upcoming"],
    "type": ["tv"],
    "season_year_min": 2025,
    "season_name": ["summer", "fall"],
    "genres": ["g1", "g2"],
    "min_rating": 7
  },
  "sort": "rating",
  "order": "desc",
  "limit": 20
}
```

Response matches `GET /api/v1/anime` shape.

##### Error responses

Same as `GET /api/v1/anime`, with additional:

| Scenario                                        | HTTP | `code`                                 | `details`                                                                                                     |
| :---------------------------------------------- | :--- | :------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| `Content-Type` not `application/json`           | 415  | `VALIDATION_ERROR` (per API-Standards) | —                                                                                                             |
| JSON body parse failure                         | 400  | `VALIDATION_ERROR`                     | Plain schema error, not nested                                                                                |
| `query.season_year_min > query.season_year_max` | 400  | `VALIDATION_ERROR`                     | `errors[]` on `query.season_year_max`                                                                         |
| `query` is an empty object `{}`                 | 200  | —                                      | Matches everything; no validation error. (List handling rules still apply — 200 with paginated default sort.) |

#### 6.8.2. `GET /api/v1/anime?q=` — search shortcut

The `q` query parameter on `GET /api/v1/anime` (section 6.1) is a shortcut that delegates to the same path as:

```json
{ "q": "<value>" }
```

sent to `POST /api/v1/anime/search`. There is no behavioral difference. Both resolve to `kind: "quick"` and perform full-text matching. The shortcut exists because the header search box is a `<form method="GET">` and cannot issue a POST from plain HTML.

---

### 6.9. Endpoint map reference

| Method   | URL                                  | Auth           |
| :------- | :----------------------------------- | :------------- |
| `GET`    | `/api/v1/anime`                      | none           |
| `GET`    | `/api/v1/anime/{id}`                 | none           |
| `GET`    | `/api/v1/anime/slug/{slug}`          | none           |
| `GET`    | `/api/v1/anime/{id}/genres`          | none           |
| `GET`    | `/api/v1/anime/{id}/studios`         | none           |
| `GET`    | `/api/v1/anime/{id}/recommendations` | none           |
| `GET`    | `/api/v1/anime/{id}/franchise`       | none           |
| `POST`   | `/api/v1/anime/search`               | none           |
| `POST`   | `/api/v1/anime`                      | bearer + admin |
| `PATCH`  | `/api/v1/anime/{id}`                 | bearer + admin |
| `DELETE` | `/api/v1/anime/{id}`                 | bearer + admin |

---

## 7. Admin endpoints

All admin endpoints require `Authorization: Bearer <token>` with an admin-role user. Errors `UNAUTHORIZED` (401, missing/invalid token) and `FORBIDDEN` (403, valid non-admin user) follow [`Authentication.md`](./Authentication.md).

### 7.1. `POST /api/v1/anime` — create

#### Purpose

Create a new anime record. Used admin curation UI and by the TMDB/AniList import flow.

#### Method & URL

```
POST /api/v1/anime
```

#### Headers

| Header                     | Value                         |
| :------------------------- | :---------------------------- |
| `Authorization`            | `Bearer <admin-token>`        |
| `Content-Type`             | `application/json`            |
| `Cache-Control` (response) | none (response not cacheable) |

#### Body schema

```ts
AnimeCreateRequest: {
  slug!: string,                       // unique among active rows
  title!: string,
  title_jp?: string,
  title_synonyms?: string[],
  synopsis?: string,
  status?: AnimeStatus,                // defaults to "unknown"
  type?: AnimeType,                    // defaults to "tv"
  season_year?: number,
  season_name?: SeasonName,
  total_episodes?: number,
  average_duration_minutes?: number,
  age_rating?: AgeRating,
  poster_url?: string,
  cover_url?: string,
  trailer_url?: string,
  tmdb_id?: number,                    // unique among active rows (enforced by DB)
  anilist_id?: number,
  mal_id?: number,
  published_at?: string,               // ISO-8601
  import_metadata?: Record<string, unknown>,
}
```

`version`, `id`, `popularity_score`, `average_rating`, `rating_count`, `view_count`, `bookmark_count`, `created_at`, `updated_at` are managed by the database and are **not** accepted on the request.

#### Response schema

```ts
{
  data: Anime,
  meta: { requestId: string }
}
```

#### Success response

HTTP: `201`. `Location: /api/v1/anime/{id}`.

```json
{
  "data": {
    "id": "f8d9e0a1-b2c3-4567-8def-0123456789ab",
    "slug": "my-new-show",
    "title": "My New Show",
    "title_jp": null,
    "title_synonyms": [],
    "synopsis": null,
    "status": "unknown",
    "type": "tv",
    "season_year": null,
    "season_name": null,
    "total_episodes": null,
    "average_duration_minutes": null,
    "age_rating": null,
    "poster_url": null,
    "cover_url": null,
    "trailer_url": null,
    "tmdb_id": null,
    "anilist_id": null,
    "mal_id": null,
    "popularity_score": 0,
    "average_rating": 0,
    "rating_count": 0,
    "view_count": 0,
    "bookmark_count": 0,
    "published_at": null,
    "created_at": "2026-0610:00:00Z",
    "updated_at": "2026-06-26T10:00:00Z",
    "version": 1
  },
  "meta": { "requestId": "req_7b8c9d0e" }
}
```

#### Error responses

| Scenario                           | HTTP | `code`             | `details`        |
| :--------------------------------- | :--- | :----------------- | :--------------- |
| Missing required `slug` or `title` | 400  | `VALIDATION_ERROR` | `errors[]`       |
| `slug` already in use (active row) | 409  | `CONFLICT`         | `{ slug }`       |
| `tmdb_id` conflict                 | 409  | `CONFLICT`         | `{ tmdb_id }`    |
| `anilist_id` conflict              | 409  | `CONFLICT`         | `{ anilist_id }` |
| Enum/range validation failure      | 400  | `VALIDATION_ERROR` | standard shape   |

---

### 7.2. `PATCH /api/v1/anime/{id}` — update

#### Purpose

Partial update of an anime record. Used by the admin editor and by the TMDB/AniList re-import flow. **Optimistic concurrency enforced via `version`.**

#### Method & URL

```
PATCH /api/v1/anime/{id}
```

#### Headers

| Header                     | Value                                         |
| :------------------------- | :-------------------------------------------- |
| `Authorization`            | `Bearer <admin-token>`                        |
| `Content-Type`             | `application/json`                            |
| `If-Match`                 | `"<version>"` (strong recommended; see below) |
| `Cache-Control` (response) | none                                          |

#### Optimistic concurrency

`PATCH` uses the `version` column to prevent lost updates:

- The client reads a record (e.g., via `GET /api/v1/anime/{id}`), holding `version: 4`.
- The client issues `PATCH /api/v1/anime/{id}` with version indicator.
- If another writer has since bumped the version, the request **fails** with `409 CONFLICT` and the current record's version in `details.currentVersion`.
- On success, the server increments `version` and returns the updated record.

**Version transmission options** (in precedence order):

1. **`If-Match` header** with strong ETag: `If-Match: "4"`. Preferred when the client has read the record recently.
2. **`version` field in the body**: `{ "version": 4, ...updates }`. Convenient when the read is embedded in the form state.
3. **No version provided**: rejected with `400 VALIDATION_ERROR` on the field `version`. We **require** a version on every admin PATCH — silent no-version writes are a footgun.

Change to: clients **must always** supply the `version` — either via header or body — or receive a `400`.

#### Body schema

```ts
AnimeUpdateRequest: {
  version!: number,              // required for optimistic concurrency
  slug?: string,
  title?: string,
  title_jp?: string | null,
  title_synonyms?: string[],
  synopsis?: string | null,
  status?: AnimeStatus,
  type?: AnimeType,
  season_year?: number | null,
  season_name?: SeasonName | null,
  total_episodes?: number | null,
  average_duration_minutes?: number | null,
  age_rating?: AgeRating | null,
  poster_url?: string | null,
  cover_url?: string | null,
  trailer_url?: string | null,
  tmdb_id?: number | null,
  anilist_id?: number | null,
  mal_id?: number | null,
  published_at?: string | null,
  import_metadata?: Record<string, unknown>,
}
```

#### Response schema

Same as 6.2 `GET /api/v1/anime/{id}` with the updated `version`.

#### Success response

HTTP: `200`.

```json
{
  "data": {
    "id": "f8d9e0a1-b2c3-4567-8def-0123456789ab",
    "slug": "my-new-show",
    "title": "My New Show (Corrected)",
    "version": 5,
    ...
  },
  "meta": { "requestId": "req_8c9d0e1f" }
}
```

#### Error responses

| Scenario                                                  | HTTP | `code`             | `details`                                      |
| :-------------------------------------------------------- | :--- | :----------------- | :--------------------------------------------- |
| `id` not a valid UUID                                     | 400  | `VALIDATION_ERROR` | `errors[]` on `id`                             |
| No `version` provided (missing header **and** body field) | 400  | `VALIDATION_ERROR` | `errors[].code: "FIELD_REQUIRED"` on `version` |
| `version` mismatch (record has version 5, request says 4) | 409  | `CONFLICT`         | `{ currentVersion: 5 }`                        |
| No active anime with that `id`                            | 404  | `ANIME_NOT_FOUND`  | `{ id }`                                       |
| `slug` conflict with another active row                   | 409  | `CONFLICT`         | `{ slug }`                                     |
| `tmdb_id` conflict                                        | 409  | `CONFLICT`         | `{ tmdb_id }`                                  |

#### Retry guidance for clients

On `409 CONFLICT`, the client should:

1. Re-fetch the current record via `GET /api/v1/anime/{id}`.
2. Present the user with the current state and re-apply the intended edits.
3. Re-issue the PATCH with the new `version`.

Do not blindly replay the original PATCH body.

---

### 7.3. `DELETE /api/v1/anime/{id}` — soft-delete

#### Purpose

Soft-delete an anime record by setting `deleted_at = now()`. The row is retained to preserve referential integrity with historical engagement data (ratings, comments, watch history) and to make undeletion possible via admin tools.

#### Method & URL

```
DELETE /api/v1/anime/{id}
```

#### Headers

| Header                     | Value                  |
| :------------------------- | :--------------------- |
| `Authorization`            | `Bearer <admin-token>` |
| `Cache-Control` (response) | none                   |

#### Path parameters

| Parameter | Type            | Required | Description           |
| :-------- | :-------------- | :------- | :-------------------- |
| `id`      | `string` (uuid) | yes      | Anime to soft-delete. |

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
    "id": "f8d9e0a1-b2c3-4567-8def-0123456789ab",
    "deleted_at": "2026-06-26T11:00:00Z"
  },
  "meta": { "requestId": "req_9d0e1f2a" }
}
```

The soft-delete is idempotent: calling `DELETE` on an already-deleted record returns the current `deleted_at` and `200` rather than `404`.

#### Error responses

| Scenario                                                          | HTTP | `code`             | `details`  |
| :---------------------------------------------------------------- | :--- | :----------------- | :--------- |
| `id` not a valid UUID                                             | 400  | `VALIDATION_ERROR` | `errors[]` |
| No record exists with that `id` (including hard-deleted archival) | 404  | `ANIME_NOT_FOUND`  | `{ id }`   |

#### Cascade note

Soft-delete does **not** cascade — engagement tables retain the anime FK; query filters inside reads (`WHERE deleted_at IS NULL` on `anime`) exclude the deleted row from listings and detail endpoints automatically. The join tables (`anime_genres`, `anime_studios`) are unchanged; their rows become invisible to traversal because the parent `anime` row is filtered out.

---

## 8. Import flow & the `tmdb_id` / `anilist_id` / `mal_id` unique constraint

The catalog is primarily populated by the **TMDB + AniList importer** (`packages/services/importer/`). The importer's contract is reflected here because endpoints 7.1 (`POST`) and 7.2 (`PATCH`) are how the importer writes.

### 8.1. Insert-or-update semantics

On each run, the importer:

1. Looks up an existing anime by `tmdb_id` (preferred) or `anilist_id` or `mal_id`.
2. If no match exists, inserts a new row versioned at `1`.
3. If a match exists, issues a `PATCH` with the latest upstream payload — **if** the upstream payload has actually changed (skipped when checksums match, to avoid pointless `version` bumps).

This relies on the three **partial unique indexes** (`uq_anime_tmdb_id`, `uq_anime_anilist_id`, `uq_anime_mal_id`) only fire among non-deleted rows. Re-importing a previously deleted anime (e.g., a show that was deleted in error) re-inserts — the partial index excludes the soft-deleted row, so the INSERT succeeds.

### 8.2. Idempotency

The import flow is keyed on the external source ID, not on user input. The importer **must not** rely on an idempotency key header — instead it does its own pre-lookup. Re-running the same import twice on a row with identical payload is a no-op (no `version` increment, no `updated_at` change).

### 8.3. `version` semantics across import runs

External import updates bump `version`. This is intentional — the importer is a "writer" just like the admin editor, and concurrent use of the admin editor on the same anime during an import run is a **conflict** that must surface via the version check. The importer's retry semantics wait for an admin editor commit before re-applying, typically by slating the import for the next scheduled window.

If two import sources (TMDB and AniList) reconcile the same anime concurrently, the second writer receives `409 CONFLICT` and retries, picking up the latest `version` from the first writer.

---

## 9. Out-of-scope sections

The following are explicitly **not** covered in this document but are companions to the Anime resource:

| Topic                                                       | Where                                                          |
| :---------------------------------------------------------- | :------------------------------------------------------------- |
| Seasons & episodes (per-anime children)                     | `docs/06-api/Seasons.md` and `docs/06-api/Episodes.md`         |
| Genres, studios master lists                                | `docs/06-api/Genres.md` and `docs/06-api/Studios.md`           |
| User engagement (bookmark, rating, watch-history, comments) | `docs/06-api/Watchlists.md`, `Ratings.md`, `Comments.md`, etc. |
| Recommendation engine internals                             | Architecture ADR, `packages/services/recommender/`             |
| Full-text search with `tsvector`                            | `docs/06-api/Search.md` (M6)                                   |

---

## 10. Testing checklist

Before landing a change to this surface, verify:

- **Type safety** — `pnpm typecheck` passes. No `any` introduces in handler, serializer, or schema.
- **Build safety** — `pnpm build` succeeds. Handlers compile under Next.js App Router convention.
- **Runtime safety** — happy path, empty list, deleted lookup, admin `403` all return a typed envelope without throwing.
- **Edge cases** — zero results (200,data: []`), `limit: 0`clamped,`min_rating: 10.1` rejected, double-delete idempotency, version mismatch retry.
- **Error handling** — no unhandled promise rejections; no leaked stack traces; friendly `message` values.
- **Caching** — reads include the cache headers defined in section 3; mutations invalidate the relevant `@nexus/cache` prefix.
- **Auth** — admin endpoints reject missing / non-admin tokens with 401 / 403 respectively.

---

## 11. Changelog

| Date       | Change                      | Ticket / PR |
| :--------- | :-------------------------- | :---------- |
| 2026-06-26 | Initial Anime endpoint spec | —           |
|            |                             |             |
|            |                             |             |

---

## 12. License & ownership

This specification is under the same license as the Nexus Anime repository. Endpoint contract changes require review from the **Lead API Architect** and two approving engineers. All trademarks and brand assets referenced remain property of their respective owners.
