# Search

> **Authoritative endpoint reference** for the `/api/v1/search` resource. Covers quick search, advanced structured search, autocomplete, and per-user search history.
>
> Ownership: **Lead API Architect**. Last reviewed: 2026-06-26.

---

## 1. Purpose

The Search resource is the **unified, cross-entity search surface** for Nexus Anime. It provides:

- **Quick search** — a single free-text query against anime, episodes, studios, and users.
- **Advanced search** — structured filtering with facets for power users and catalog exploration.
- **Autocomplete** — prefix-matched suggestions for the header search box and mobile search UI.
- **Search history** — per-user recent searches with individual and bulk deletion.

All search endpoints share a **query normalization pipeline** and a **mixed-type response envelope** so a single query can return anime, episodes, studios, and users in one paginated response.

**Schema reference:** Index strategy and column shapes live in `docs/07-database/Search.md`. This document covers the request/response contract only.

---

## 2. Search architecture

Nexus Anime uses a **two-phase search architecture**. Phase 1 ships in M3; Phase 2 is planned for M5+.

### 2.1. Phase 1 — Postgres `tsvector` + GIN (M3)

The M3 implementation relies entirely on PostgreSQL full-text search:

- A **generated `tsvector` column** (`search_vector`) is maintained on `anime`, `episodes`, `studios`, and `users` tables. The vector is built from title, synonyms, and description columns with weighted ranks (`A` for title, `B` for synonyms, `C` for description).
- A **GIN index** on `search_vector` powers fast `@@` matching.
- Queries use `websearch_to_tsquery` for user-friendly syntax (quoted phrases, `OR`, `-` exclusion).
- **Prefix matching** for autocomplete uses `to_tsquery('simple', 'prefix:*')` against the same GIN index.
- **Ranking** uses `ts_rank_cd(search_vector, query, 32)` — cover density ranking with normalization.

This approach requires **no external service**, keeps the infrastructure simple, and handles the catalog scale of Nexus Anime (tens of thousands of anime, hundreds of thousands of episodes). It is sufficient through M4.

### 2.2. Phase 2 — Meilisearch (M5+)

When the catalog grows beyond what Postgres full-text can serve with acceptable latency (sub-50ms p95 at the API layer), Nexus Anime will introduce **Meilisearch** as the primary search backend:

- Meilisearch runs as a **separate service** (self-hosted on VPS or Meilisearch Cloud).
- Postgres remains the **source of truth**. A change-data-capture (CDC) pipeline — either logical replication or application-level events on mutation — keeps the Meilisearch index in sync.
- The **API contract does not change**. The search handler will delegate to Meilisearch internally; response shape, query parameters, and normalization remain identical.
- Meilisearch provides: typo tolerance, faceted filtering, geo (future), and faster prefix matching at scale.

**Why not Elasticsearch?** Meilisearch offers a materially smaller operational footprint for a team of our size, ships as a single binary, and covers every use case we need through M6. We can always migrate to Elasticsearch later if we outgrow Meilisearch — the API contract insulates clients from that decision.

### 2.3. Fallback behavior

If the search backend (Postgres or Meilisearch) is unreachable:

- Quick search and autocomplete return `503 SERVICE_UNAVAILABLE` with code `SEARCH_BACKEND_UNAVAILABLE`.
- The client should retry with exponential backoff (max 3 attempts) and display a "search is temporarily unavailable" message.
- Advanced search falls back to a simplified `ILIKE` query against `title` only if Postgres is reachable but the GIN path fails. This is a degraded-mode safety net, not a feature.

---

## 3. Query normalization

Every free-text query (`q`, `query.text`, `suggest.q`) passes through the same normalization pipeline before hitting the search backend:

1. **Lowercase** — `q.toLowerCase()`.
2. **Trim** — strip leading/trailing whitespace.
3. **Collapse whitespace** — internal runs of whitespace become a single space.
4. **Strip punctuation** — remove `!@#$%^&*()[]{};:,.<>?/~"'\`` characters. Hyphens within words are preserved (e.g., `attack-on-titan`becomes`attack-on-titan`, not `attackontitan`).
5. **Truncate** — cap at 200 characters after normalization.
6. **Empty-after-normalization** — if the result is an empty string, return `200` with `data: []` (no error).

For **prefix matching** (autocomplete), the normalized string is appended with `:*` for tsquery prefix syntax. For **full-text matching**, the string is passed to `websearch_to_tsquery` as-is.

Normalization runs **server-side** in the search handler. Clients should not pre-normalize.

---

## 4. Response shape

All search endpoints return a **mixed-type result array**. Each item carries a `type` discriminator so the client can render the appropriate card component.

### 4.1. Envelope

```ts
{
  data: SearchResult[],
  meta: {
    requestId: string,
    pagination: {
      nextCursor: string | null,
      hasMore: boolean,
    },
    query: string,           // normalized query that was actually searched
    types: {                 // counts per type in this page
      anime: number,
      episode: number,
      studio: number,
      user: number,
    },
  }
}
```

### 4.2. Search result item

```ts
SearchResult:
  | AnimeResult
  | EpisodeResult
  | StudioResult
  | UserResult

// Discriminated by `type`.
AnimeResult: {
  type: "anime",
  id: string,               // uuid
  slug: string,
  title: string,
  title_jp?: string | null,
  status: "unknown" | "upcoming" | "airing" | "finished" | "cancelled",
  type: "tv" | "movie" | "ova" | "ona" | "special" | "music",
  poster_url?: string | null,
  average_rating: number,
  popularity_score: number,
  highlight?: string,       // matched snippet (for advanced search)
}

EpisodeResult: {
  type: "episode",
  id: string,               // uuid
  anime_id: string,
  anime_title: string,
  number: number,            // episode number
  title?: string | null,
  synopsis?: string | null,
  thumbnail_url?: string | null,
  duration_minutes?: number | null,
  aired_at?: string | null, // ISO-8601
  highlight?: string,
}

StudioResult: {
  type: "studio",
  id: string,               // uuid
  slug: string,
  name: string,
  logo_url?: string | null,
  anime_count: number,
  highlight?: string,
}

UserResult: {
  type: "user",
  id: string,               // uuid
  username: string,
  display_name?: string | null,
  avatar_url?: string | null,
}
```

### 4.3. Default type filter

When no `type` query parameter is provided, the search defaults to `type=anime`. To search across all types, pass `type=all` (or omit the parameter and let the client filter client-side — but `type=all` is preferred because it enables cross-type ranking).

Valid `type` values: `anime`, `episode`, `studio`, `user`, `all`.

When `type=all`, results are **interleaved by relevance score** and the `meta.types` breakdown indicates how many of each type appear in the page.

---

## 5. Cache headers

All **read-only** search endpoints emit:

```
Cache-Control: public, max-age=60, stale-while-revalidate=300
```

Rationale: search results are volatile (new anime, new episodes, updated rankings). 60 seconds of freshness keeps repeated searches (pagination, filter tweaks) fast; 5 minutes of stale-while-revalidate covers the gap during revalidation.

**Autocomplete** (`/suggest`) uses the same policy. **Search history** endpoints use `private, max-age=0, must-revalidate` because the response is user-specific.

---

## 6. Rate limiting

Search endpoints are **public and high-traffic**. They enforce a stricter quota than authenticated endpoints:

| Actor       | Limit | Window | Key                 |
| :---------- | :---- | :----- | :------------------ |
| IP (anon)   | 20    | 60s    | `ip:{addr}:search`  |
| User (auth) | 20    | 60s    | `user:{sub}:search` |

The limit is **shared across all search endpoints** — a user who hits `/suggest` 20 times in 60 seconds will be rate-limited on `/search` too. This prevents abuse of autocomplete as a cheap proxy for full search.

Rate-limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) are emitted per the policy in [`Rate-Limiting.md`](./Rate-Limiting.md).

When the limit is exceeded, the endpoint returns `429` with code `RATE_LIMITED`.

---

## 7. Endpoints

### 7.1. `GET /api/v1/search` — quick search

#### Purpose

Single free-text query against one or more entity types. The default search surface for the header search box and mobile search.

#### Method & URL

```
GET /api/v1/search?q=...&type=...
```

#### Auth

None.

#### Query parameters

| Parameter | Type                | Default        | Description                                                                         |
| :-------- | :------------------ | :------------- | :---------------------------------------------------------------------------------- |
| `q`       | `string`            | **required**   | Free-text query. Normalized server-side (section 3).                                |
| `type`    | `SearchType`        | `"anime"`      | Entity type to search. One of `anime`, `episode`, `studio`, `user`, `all`.          |
| `sort`    | `SearchSort`        | `"relevance"`  | Sort field. See sorting table below.                                                |
| `order`   | `"asc"` \| `"desc"` | varies by sort | Sort direction.                                                                     |
| `cursor`  | `string`            | —              | Opaque cursor from `meta.pagination.nextCursor`.                                    |
| `limit`   | `integer` (1–50)    | `20`           | Page size. Hard cap 50 (lower than catalog because mixed-type results are heavier). |

#### Sorting

| `sort` value | Meaning                                              | Default `order` |
| :----------- | :--------------------------------------------------- | :-------------- |
| `relevance`  | `ts_rank_cd` score (or Meilisearch relevance)        | `desc`          |
| `popularity` | `popularity_score` (anime) or `anime_count` (studio) | `desc`          |
| `rating`     | `average_rating` (anime)                             | `desc`          |
| `created_at` | Entity creation time                                 | `desc`          |

When `type=all`, relevance is the only meaningful sort. Other sort values applied to `type=all` fall back to `relevance` with a `meta.sortFallback: true` hint.

#### Response schema

See section 4 (shared envelope).

#### Success response example

```http
GET /api/v1/search?q=dandadan&type=anime&limit=2
```

```json
{
  "data": [
    {
      "type": "anime",
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "slug": "dandadan",
      "title": "Dandadan",
      "title_jp": "ダンダダン",
      "status": "airing",
      "type": "tv",
      "poster_url": "https://img.nexus-anime.app/poster/dandadan.jpg",
      "average_rating": 8.42,
      "popularity_score": 912.73
    }
  ],
  "meta": {
    "requestId": "req_9a8b7c6d5e4f",
    "pagination": {
      "nextCursor": null,
      "hasMore": false
    },
    "query": "dandadan",
    "types": { "anime": 1, "episode": 0, "studio": 0, "user": 0 }
  }
}
```

HTTP: `200`

#### Error responses

| Scenario                        | HTTP | `code`                       | `details`             |
| :------------------------------ | :--- | :--------------------------- | :-------------------- |
| `q` missing or empty            | 400  | `VALIDATION_ERROR`           | `errors[]` on `q`     |
| `type` not a valid `SearchType` | 400  | `VALIDATION_ERROR`           | `errors[]` on `type`  |
| `limit` outside 1–50            | 400  | `VALIDATION_ERROR`           | `errors[]` on `limit` |
| Search backend unreachable      | 503  | `SEARCH_BACKEND_UNAVAILABLE` | —                     |

---

### 7.2. `POST /api/v1/search` — advanced search

#### Purpose

Structured search with facets. Used by the advanced search page (`/search/advanced`) where filters arrive incrementally from facet pickers, range sliders, and toggles.

#### Method & URL

```
POST /api/v1/search
```

#### Auth

None.

#### Headers

| Header                     | Value                                            |
| :------------------------- | :----------------------------------------------- |
| `Content-Type`             | `application/json`                               |
| `Cache-Control` (response) | `public, max-age=60, stale-while-revalidate=300` |

#### Body schema

```ts
SearchRequest: {
  q?: string,                  // shorthand for query.text
  query?: {
    text?: string,             // free-text; same normalization as q
    type?: SearchType[],       // filter to specific types; ["anime"] by default
    status?: AnimeStatus[],
    animeType?: AnimeType[],
    season_year_min?: number,
    season_year_max?: number,
    season_name?: SeasonName[],
    age_rating?: AgeRating[],
    genres?: string[],         // genre ids — OR-within
    studios?: string[],        // studio ids — OR-within
    min_rating?: number,
    min_popularity?: number,
  },
  sort?: SearchSort,
  order?: "asc" | "desc",
  cursor?: string,
  limit?: number,             // 1–50, default 20
}
```

#### Semantics

- **Either `q` or `query.text` may be provided, not both.** If both are present, `query.text` wins and `q` is ignored.
- **`query.type`** is an array. Results are restricted to the supplied types. An empty array is the same as `["anime"]`.
- **All filters are AND across facets, OR within a facet.** `genres: ["action", "comedy"]` matches anime tagged with either.
- **`season_year_min` / `season_year_max`** form an inclusive range. Either bound may be independently absent.
- **An empty `query` object `{}`** matches everything (subject to `type` filter and pagination). This is not an error.

#### Response schema

See section 4 (shared envelope).

#### Success response example

```http
POST /api/v1/search
Content-Type: application/json

{
  "query": {
    "text": "mecha",
    "type": ["anime"],
    "status": ["airing", "finished"],
    "genres": ["action", "sci-fi"],
    "min_rating": 7
  },
  "sort": "relevance",
  "limit": 10
}
```

```json
{
  "data": [
    {
      "type": "anime",
      "id": "...",
      "slug": "gundam-unicorn",
      "title": "Mobile Suit Gundam Unicorn",
      "status": "finished",
      "type": "ova",
      "poster_url": "https://img.nexus-anime.app/poster/gundam-unicorn.jpg",
      "average_rating": 8.7,
      "popularity_score": 720.5,
      "highlight": "...mecha <em>action</em> at its finest..."
    }
  ],
  "meta": {
    "requestId": "req_abcd1234",
    "pagination": { "nextCursor": "eyJzY29yZSI6IDcyMC41fQ", "hasMore": true },
    "query": "mecha",
    "types": { "anime": 1, "episode": 0, "studio": 0, "user": 0 }
  }
}
```

HTTP: `200`

#### Error responses

| Scenario                                        | HTTP | `code`                       | `details`                             |
| :---------------------------------------------- | :--- | :--------------------------- | :------------------------------------ |
| `Content-Type` not `application/json`           | 415  | `VALIDATION_ERROR`           | —                                     |
| JSON body parse failure                         | 400  | `VALIDATION_ERROR`           | —                                     |
| `query.season_year_min > query.season_year_max` | 400  | `VALIDATION_ERROR`           | `errors[]` on `query.season_year_max` |
| `limit` outside 1–50                            | 400  | `VALIDATION_ERROR`           | `errors[]` on `limit`                 |
| Search backend unreachable                      | 503  | `SEARCH_BACKEND_UNAVAILABLE` | —                                     |

---

### 7.3. `GET /api/v1/search/suggest` — autocomplete

#### Purpose

Prefix-matched suggestions for the search box dropdown. Returns at most 10 results, ranked by relevance. This endpoint is **heavily rate-limited** (shared bucket with section 6) and **cached aggressively**.

#### Method & URL

```
GET /api/v1/search/suggest?q=...
```

#### Auth

None.

#### Query parameters

| Parameter | Type         | Default      | Description                                                                                                       |
| :-------- | :----------- | :----------- | :---------------------------------------------------------------------------------------------------------------- |
| `q`       | `string`     | **required** | Partial query. Prefix matching is applied server-side.                                                            |
| `type`    | `SearchType` | `"anime"`    | Restrict to a single entity type. `all` is not permitted here — the client issues one request per type if needed. |

#### Response schema

```ts
{
  data: Suggestion[],
  meta: {
    requestId: string,
    query: string,           // normalized query
  }
}
```

```ts
Suggestion: {
  type: "anime" | "episode" | "studio" | "user",
  id: string,
  title: string,             // display text (title, name, or username)
  subtitle?: string,         // e.g. anime title for an episode, or "@username" for a user
  poster_url?: string | null,
}
```

#### Success response example

```http
GET /api/v1/search/suggest?q=dand&type=anime
```

```json
{
  "data": [
    {
      "type": "anime",
      "id": "a1b2c3d4-...",
      "title": "Dandadan",
      "poster_url": "https://img.nexus-anime.app/poster/dandadan.jpg"
    },
    {
      "type": "anime",
      "id": "f8e7d6c5-...",
      "title": "Dandadan Season 2",
      "subtitle": "Sequel to Dandadan",
      "poster_url": "https://img.nexus-anime.app/poster/dandadan-s2.jpg"
    }
  ],
  "meta": {
    "requestId": "req_suggest_1234",
    "query": "dand"
  }
}
```

HTTP: `200`

#### Error responses

| Scenario                   | HTTP | `code`                       | `details`            |
| :------------------------- | :--- | :--------------------------- | :------------------- |
| `q` missing or empty       | 400  | `VALIDATION_ERROR`           | `errors[]` on `q`    |
| `type` is `all` or invalid | 400  | `VALIDATION_ERROR`           | `errors[]` on `type` |
| Search backend unreachable | 503  | `SEARCH_BACKEND_UNAVAILABLE` | —                    |

---

### 7.4. `GET /api/v1/search/history` — user's recent searches

#### Purpose

Returns the authenticated user's most recent search queries, newest-first. Used by the search page "recent searches" panel.

#### Method & URL

```
GET /api/v1/search/history
```

#### Auth

**Required.** `Authorization: Bearer <token>`. Returns `401 UNAUTHORIZED` when the token is absent or invalid.

#### Query parameters

| Parameter | Type             | Default | Description                          |
| :-------- | :--------------- | :------ | :----------------------------------- |
| `limit`   | `integer` (1–50) | `20`    | Number of recent searches to return. |

#### Response schema

```ts
{
  data: SearchHistoryEntry[],
  meta: {
    requestId: string,
  }
}
```

```ts
SearchHistoryEntry: {
  id: string,               // uuid — used for DELETE targeting
  query: string,            // the raw query the user submitted (pre-normalization)
  type: SearchType,         // entity type filter used
  created_at: string,       // ISO-8601
}
```

#### Success response example

```http
GET /api/v1/search/history?limit=3
Authorization: Bearer <token>
```

```json
{
  "data": [
    {
      "id": "h1",
      "query": "dandadan",
      "type": "anime",
      "created_at": "2026-06-26T10:15:00Z"
    },
    {
      "id": "h2",
      "query": "attack on titan",
      "type": "anime",
      "created_at": "2026-06-26T09:42:00Z"
    },
    {
      "id": "h3",
      "query": "studio ghibli",
      "type": "studio",
      "created_at": "2026-06-25T18:30:00Z"
    }
  ],
  "meta": { "requestId": "req_history_5678" }
}
```

HTTP: `200`

#### Error responses

| Scenario              | HTTP | `code`             | `details`             |
| :-------------------- | :--- | :----------------- | :-------------------- |
| Missing/invalid token | 401  | `UNAUTHORIZED`     | —                     |
| `limit` outside 1–50  | 400  | `VALIDATION_ERROR` | `errors[]` on `limit` |

---

### 7.5. `DELETE /api/v1/search/history/{id}` — delete one history entry

#### Purpose

Delete a single search history entry by its `id`.

#### Method & URL

```
DELETE /api/v1/search/history/{id}
```

#### Auth

**Required.** The entry must belong to the authenticated user. Returns `404` for entries owned by another user (to avoid leaking existence).

#### Path parameters

| Parameter | Type            | Required | Description                                 |
| :-------- | :-------------- | :------- | :------------------------------------------ |
| `id`      | `string` (uuid) | yes      | Entry ID from `GET /api/v1/search/history`. |

#### Response schema

```ts
{
  data: { deleted: true, id: string },
  meta: { requestId: string }
}
```

#### Success response

HTTP: `200`

```json
{
  "data": { "deleted": true, "id": "h1" },
  "meta": { "requestId": "req_del_1234" }
}
```

#### Error responses

| Scenario                               | HTTP | `code`                    | `details`          |
| :------------------------------------- | :--- | :------------------------ | :----------------- |
| Missing/invalid token                  | 401  | `UNAUTHORIZED`            | —                  |
| `id` not a valid UUID                  | 400  | `VALIDATION_ERROR`        | `errors[]` on `id` |
| Entry not found or not owned by caller | 404  | `HISTORY_ENTRY_NOT_FOUND` | `{ id }`           |

---

### 7.6. `DELETE /api/v1/search/history` — clear all search history

#### Purpose

Bulk-delete every search history entry for the authenticated user.

#### Method & URL

```
DELETE /api/v1/search/history
```

#### Auth

**Required.**

#### Response schema

```ts
{
  data: { deleted: number },
  meta: { requestId: string }
}
```

#### Success response

HTTP: `200`

```json
{
  "data": { "deleted": 42 },
  "meta": { "requestId": "req_clear_1234" }
}
```

#### Error responses

| Scenario              | HTTP | `code`         | `details` |
| :-------------------- | :--- | :------------- | :-------- |
| Missing/invalid token | 401  | `UNAUTHORIZED` | —         |

---

## 8. Endpoint map

| Method   | URL                           | Auth   | Rate limit                   |
| :------- | :---------------------------- | :----- | :--------------------------- |
| `GET`    | `/api/v1/search`              | none   | 20/60s per user/IP           |
| `POST`   | `/api/v1/search`              | none   | 20/60s per user/IP           |
| `GET`    | `/api/v1/search/suggest`      | none   | 20/60s per user/IP (shared)  |
| `GET`    | `/api/v1/search/history`      | bearer | standard authenticated quota |
| `DELETE` | `/api/v1/search/history/{id}` | bearer | standard authenticated quota |
| `DELETE` | `/api/v1/search/history`      | bearer | standard authenticated quota |

---

## 9. Common error codes

All endpoints in this document share the error envelope and code registry defined in [`Error-Codes.md`](./Error-Codes.md). The codes you will see here:

| Code                         | HTTP | Trigger in this resource                  |
| :--------------------------- | :--- | :---------------------------------------- |
| `VALIDATION_ERROR`           | 400  | Query/body failed Zod schema              |
| `FIELD_REQUIRED`             | 400  | Nested in `VALIDATION_ERROR.details`      |
| `FIELD_INVALID`              | 400  | Nested in `VALIDATION_ERROR.details`      |
| `UNAUTHORIZED`               | 401  | Missing/invalid bearer token on history   |
| `RATE_LIMITED`               | 429  | Quota exhausted                           |
| `SEARCH_BACKEND_UNAVAILABLE` | 503  | Postgres or Meilisearch unreachable       |
| `HISTORY_ENTRY_NOT_FOUND`    | 404  | `id` lookup miss or owned by another user |

---

## 10. Implementation notes

### 10.1. Search history storage

Search history is stored in a `search_history` table in Postgres (see `docs/07-database/Search.md`). Entries are **not** written for autocomplete requests — only for explicit searches (`GET /api/v1/search` and `POST /api/v1/search`). This prevents the history from being polluted by every keystroke.

### 10.2. Deduplication

When a user repeats a search, the existing row's `created_at` is updated rather than inserting a duplicate. This keeps the history list bounded and useful.

### 10.3. History cap

Each user is capped at **200** history entries. When the cap is exceeded, the oldest entries are pruned on write. The `limit` query parameter on `GET /api/v1/search/history` controls how many are returned, but the server never stores more than 200 per user.

### 10.4. Cross-type ranking

When `type=all`, results from different entity types are ranked by a **normalized relevance score** (0–1) computed per-type and then merged. Anime and episodes use `ts_rank_cd`; studios and users use a similar rank. The merge preserves relative ordering within each type while interleaving by score. This is a best-effort approach — if cross-type ranking quality becomes a problem, we will introduce a unified relevance model in Phase 2.
