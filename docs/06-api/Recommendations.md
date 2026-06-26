# Recommendations

> **Authoritative endpoint reference** for the `/api/v1/recommendations` resource. Covers personalized recommendations, global trending, similar-anime lookups, and the continue-watching queue.

> Ownership: **Lead API Architect**. Last reviewed: 2026-06-26.

---

## 1. Purpose

The Recommendations resource exposes four read surfaces that share a single response shape:

- **Personalized recommendations** — anime tailored to the current user's watch history and ratings. Falls back to trending when the user has no history.
- **Global trending** — platform-wide popular anime, optionally boosted by the caller's preferences when authenticated.
- **Similar anime** — genre/studio/title overlap for a given anime, powering the "More Like This" shelf on detail pages.
- **Continue watching** — a thin proxy over the user's continue-watching queue, ordered by most recently updated.

All four endpoints return an array of **anime summary objects** annotated with a `reason` field that explains why each item was selected. The client can use `reason` to render a contextual badge ("Because you watched X", "Trending this season").

**Algorithm note:** M3 uses **genre/studio overlap + popularity score** (weighted blend). M5+ adds collaborative filtering on top. The `reason` field is algorithm-aware — it will reflect the actual signal used (e.g. `genre_overlap`, `collaborative`, `trending`, `continue_watching`), so clients that do not care about the reason can ignore it.

**Schema reference:** The anime summary shape mirrors the `anime` table columns defined in [`docs/07-database/Anime.md`](../07-database/Anime.md). This document covers the request/response contract only.

---

## 2. Response shape

All four endpoints return the same envelope and item shape. The top-level `data` is an **array** (not a paginated cursor response) because recommendation shelves are bounded in size.

### 2.1. Envelope

```ts
{
  data: RecommendationItem[],
  meta: {
    requestId: string,
    reason_counts: Record<RecommendationReason, number>,  // histogram of reasons in this response
    generated_at: string,  // ISO-8601 — when the recommendation list was computed (useful for debugging stale cache)
  }
}
```

### 2.2. Recommendation item

```ts
RecommendationItem: {
  type: "anime",                  // discriminator — always "anime" for M3; reserved for future non-anime recs
  id: string,                     // uuid
  slug: string,
  title: string,
  title_jp?: string | null,
  status: "unknown" | "upcoming" | "airing" | "finished" | "cancelled",
  type: "tv" | "movie" | "ova" | "ona" | "special" | "music",
  poster_url?: string | null,
  average_rating: number,
  popularity_score: number,
  reason: RecommendationReason,   // why this item was recommended
  reason_detail?: string,         // optional human-readable detail (e.g. "Because you watched Dandadan")
}
```

### 2.3. Recommendation reason enum

```ts
RecommendationReason:
  | "trending"            // global or seasonal trending
  | "genre_overlap"       // shares genres with user's highly-rated anime
  | "studio_overlap"      // same studio as user's highly-rated anime
  | "continue_watching"   // user's own continue-watching entry
  | "collaborative"       // M5+ — similar users also watched
  | "fallback"            // trending fallback when no personalization signal exists
```

---

## 3. Cache headers

Each endpoint has a tailored TTL. Personalized responses use `private`; public endpoints use `public`.

| Endpoint | Cache-Control |
| :------- | :------------ |
| `GET /api/v1/recommendations` | `private, max-age=300, stale-while-revalidate=600` |
| `GET /api/v1/recommendations/trending` | `public, max-age=300, stale-while-revalidate=600` |
| `GET /api/v1/recommendations/similar/{animeId}` | `public, max-age=3600, stale-while-revalidate=7200` |
| `GET /api/v1/recommendations/continue` | `private, max-age=300, stale-while-revalidate=600` |

Rationale: personalized recs change as the user's history changes — 5 minutes fresh, 10 minutes stale. Similar-anime is expensive to compute and changes rarely — 1 hour fresh, 2 hours stale. Trending sits in between.

Cache keys follow the schema `nexus:recs:{user|global}:{endpoint}:{id?}:{version}` — see [`API-Standards.md`](./API-Standards.md) for the full key convention.

---

## 4. Rate limiting

All four endpoints share a **single rate-limit bucket**. This prevents a client from circumventing the limit by switching between personalized and trending endpoints.

| Actor       | Limit | Window | Key                         |
| :---------- | :---- | :----- | :-------------------------- |
| IP (anon)   | 20    | 60s    | `ip:{addr}:recs`            |
| User (auth) | 20    | 60s    | `user:{sub}:recs`           |

When the limit is exceeded, the endpoint returns `429` with code `RATE_LIMITED`. Standard `X-RateLimit-*` headers are emitted per [`Rate-Limiting.md`](./Rate-Limiting.md).

---

## 5. Common error codes

All endpoints in this document share the error envelope and code registry defined in [`Error-Codes.md`](./Error-Codes.md). The codes you will see here:

| Code                 | HTTP | Trigger in this resource              |
| :------------------- | :--- | :------------------------------------ |
| `VALIDATION_ERROR`   | 400  | Query/body failed Zod schema         |
| `FIELD_REQUIRED`     | 400  | Nested in `VALIDATION_ERROR.details`  |
| `FIELD_INVALID`      | 400  | Nested in `VALIDATION_ERROR.details`  |
| `UNAUTHORIZED`       | 401  | Missing/invalid bearer token on auth-required endpoints |
| `ANIME_NOT_FOUND`    | 404  | `animeId` lookup miss on `/similar/{animeId}` |
| `RATE_LIMITED`       | 429  | Quota exhausted                       |
| `INTERNAL_ERROR`     | 500  | Unhandled failure                     |

---

## 6. Endpoints

### 6.1. `GET /api/v1/recommendations` — personalized recommendations

#### Purpose

Returns a ranked list of anime personalized for the current user. The ranking is derived from the user's watch history, ratings, and bookmarks. When the user has **no history** (new account, no watch activity), the endpoint returns trending anime with `reason: "fallback"` — the HTTP status is still `200`, not an error.

#### Method & URL

```
GET /api/v1/recommendations
```

#### Auth

**Required.** `Authorization: Bearer <token>`. Returns `401 UNAUTHORIZED` when the token is absent or invalid.

#### Headers

| Header | Value |
| :----- | :---- |
| `Accept` | `application/json` |
| `Cache-Control` (response) | `private, max-age=300, stale-while-revalidate=600` |

#### Query parameters

| Parameter | Type | Default | Description |
| :-------- | :--- | :------ | :---------- |
| `limit` | `integer` (1–25) | `10` | Number of recommendations to return. Hard cap 25. |

#### Response schema

See section 2 (shared envelope).

#### Success response example

```http
GET /api/v1/recommendations?limit=3
Authorization: Bearer <token>
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
      "popularity_score": 912.73,
      "reason": "genre_overlap",
      "reason_detail": "Because you watched Cyberpunk: Edgerunners"
    },
    {
      "type": "anime",
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "slug": "chainsaw-man",
      "title": "Chainsaw Man",
      "title_jp": "チェンソーマン",
      "status": "finished",
      "type": "tv",
      "poster_url": "https://img.nexus-anime.app/poster/chainsaw-man.jpg",
      "average_rating": 8.15,
      "popularity_score": 1024.50,
      "reason": "studio_overlap",
      "reason_detail": "From MAPPA, the studio of Jujutsu Kaisen"
    },
    {
      "type": "anime",
      "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "slug": "frieren-beyond-journeys-end",
      "title": "Frieren: Beyond Journey's End",
      "title_jp": "葬送のフリーレン",
      "status": "finished",
      "type": "tv",
      "poster_url": "https://img.nexus-anime.app/poster/frieren.jpg",
      "average_rating": 9.10,
      "popularity_score": 1450.20,
      "reason": "trending"
    }
  ],
  "meta": {
    "requestId": "req_recs_abc123",
    "reason_counts": {
      "genre_overlap": 1,
      "studio_overlap": 1,
      "trending": 1,
      "continue_watching": 0,
      "collaborative": 0,
      "fallback": 0
    },
    "generated_at": "2026-06-26T10:30:00Z"
  }
}
```

HTTP: `200`

#### Error responses

| Scenario | HTTP | `code` | `details` |
| :------- | :--- | :----- | :-------- |
| Missing/invalid token | 401 | `UNAUTHORIZED` | — |
| `limit` outside 1–25 | 400 | `VALIDATION_ERROR` | `errors[]` on `limit` |

---

### 6.2. `GET /api/v1/recommendations/trending` — global trending

#### Purpose

Returns the platform-wide trending anime, ranked by a blend of `popularity_score`, recent view velocity, and rating count. When the caller is authenticated, the list is **boosted** by the user's preferred genres — items matching the user's top genres float to the top, but the list is never empty due to personalization.

#### Method & URL

```
GET /api/v1/recommendations/trending
```

#### Auth

**Optional.** When a valid bearer token is provided, the response is genre-boosted. When absent or invalid, the response is the global trending list with no personalization.

#### Headers

| Header | Value |
| :----- | :---- |
| `Accept` | `application/json` |
| `Cache-Control` (response) | `public, max-age=300, stale-while-revalidate=600` |

#### Query parameters

| Parameter | Type | Default | Description |
| :-------- | :--- | :------ | :---------- |
| `limit` | `integer` (1–25) | `10` | Number of recommendations to return. Hard cap 25. |
| `season?` | `"spring"` \| `"summer"` \| `"fall"` \| `"winter"` | current season | Restrict to a specific broadcast season. Defaults to the current season at the server's locale. |
| `year?` | `integer` (1917–2100) | current year | Broadcast year. Must be supplied alongside `season`; ignored otherwise. |

#### Response schema

See section 2 (shared envelope). Items carry `reason: "trending"`.

#### Success response example

```http
GET /api/v1/recommendations/trending?limit=2&season=summer&year=2026
Authorization: Bearer <token>
```

```json
{
  "data": [
    {
      "type": "anime",
      "id": "d4e5f6a7-b8c9-0123-defa-234567890123",
      "slug": "dandadan-season-2",
      "title": "Dandadan Season 2",
      "title_jp": "ダンダダン 第2期",
      "status": "upcoming",
      "type": "tv",
      "poster_url": "https://img.nexus-anime.app/poster/dandadan-s2.jpg",
      "average_rating": 0,
      "popularity_score": 2100.80,
      "reason": "trending"
    }
  ],
  "meta": {
    "requestId": "req_trending_def456",
    "reason_counts": { "trending": 1 },
    "generated_at": "2026-06-26T10:30:00Z"
  }
}
```

HTTP: `200`

#### Error responses

| Scenario | HTTP | `code` | `details` |
| :------- | :--- | :----- | :-------- |
| `season` supplied without `year` | 400 | `VALIDATION_ERROR` | `errors[]` on `year` |
| `limit` outside 1–25 | 400 | `VALIDATION_ERROR` | `errors[]` on `limit` |

---

### 6.3. `GET /api/v1/recommendations/similar/{animeId}` — similar anime

#### Purpose

Returns anime that share genres, studios, or thematic tags with the given anime. Used by the "More Like This" shelf on the anime detail page. Results are ranked by overlap count, then by `popularity_score` as a tiebreaker.

#### Method & URL

```
GET /api/v1/recommendations/similar/{animeId}
```

#### Auth

**None.** Public endpoint.

#### Headers

| Header | Value |
| :----- | :---- |
| `Accept` | `application/json` |
| `Cache-Control` (response) | `public, max-age=3600, stale-while-revalidate=7200` |

#### Path parameters

| Parameter | Type | Required | Description |
| :-------- | :--- | :------- | :---------- |
| `animeId` | `string` (uuid) | yes | The source anime. Must reference a non-deleted anime. |

#### Query parameters

| Parameter | Type | Default | Description |
| :-------- | :--- | :------ | :---------- |
| `limit` | `integer` (1–25) | `10` | Number of similar anime to return. Hard cap 25. |

#### Response schema

See section 2 (shared envelope). Items carry `reason: "genre_overlap"` or `reason: "studio_overlap"`.

#### Success response example

```http
GET /api/v1/recommendations/similar/a1b2c3d4-e5f6-7890-abcd-ef1234567890?limit=2
```

```json
{
  "data": [
    {
      "type": "anime",
      "id": "e5f6a7b8-c9d0-1234-efab-345678901234",
      "slug": "cyberpunk-edgerunners",
      "title": "Cyberpunk: Edgerunners",
      "title_jp": "サイバーパンク エッグランナーズ",
      "status": "finished",
      "type": "ona",
      "poster_url": "https://img.nexus-anime.app/poster/edgerunners.jpg",
      "average_rating": 8.60,
      "popularity_score": 1320.45,
      "reason": "genre_overlap",
      "reason_detail": "Shares genres: action, sci-fi, cyberpunk"
    }
  ],
  "meta": {
    "requestId": "req_similar_ghi789",
    "reason_counts": { "genre_overlap": 1, "studio_overlap": 0 },
    "generated_at": "2026-06-26T10:30:00Z"
  }
}
```

HTTP: `200`

#### Error responses

| Scenario | HTTP | `code` | `details` |
| :------- | :--- | :----- | :-------- |
| `animeId` not a valid UUID | 400 | `VALIDATION_ERROR` | `errors[]` on `animeId` |
| `animeId` references a deleted or unknown anime | 404 | `ANIME_NOT_FOUND` | `{ animeId }` |
| `limit` outside 1–25 | 400 | `VALIDATION_ERROR` | `errors[]` on `limit` |

---

### 6.4. `GET /api/v1/recommendations/continue` — continue watching

#### Purpose

A thin proxy over the authenticated user's **continue-watching queue**. Returns anime summaries for entries where the user has watched at least one episode but has not completed the series, ordered by `updated_at` descending (most recently watched first). Each item carries `reason: "continue_watching"`.

This endpoint exists so the home page's "Continue Watching" shelf can be rendered from a single REST call without the client needing to know the continue-watching table schema.

#### Method & URL

```
GET /api/v1/recommendations/continue
```

#### Auth

**Required.** `Authorization: Bearer <token>`. Returns `401 UNAUTHORIZED` when the token is absent or invalid.

#### Headers

| Header | Value |
| :----- | :---- |
| `Accept` | `application/json` |
| `Cache-Control` (response) | `private, max-age=300, stale-while-revalidate=600` |

#### Query parameters

| Parameter | Type | Default | Description |
| :-------- | :--- | :------ | :---------- |
| `limit` | `integer` (1–25) | `10` | Number of entries to return. Hard cap 25. |

#### Response schema

See section 2 (shared envelope). Items carry `reason: "continue_watching"`. The `reason_detail` field includes the episode progress (e.g. `"Episode 3 of 12"`).

#### Success response example

```http
GET /api/v1/recommendations/continue?limit=2
Authorization: Bearer <token>
```

```json
{
  "data": [
    {
      "type": "anime",
      "id": "f6a7b8c9-d0e1-2345-fabc-456789012345",
      "slug": "one-piece",
      "title": "One Piece",
      "title_jp": "ワンピース",
      "status": "airing",
      "type": "tv",
      "poster_url": "https://img.nexus-anime.app/poster/one-piece.jpg",
      "average_rating": 8.95,
      "popularity_score": 3200.10,
      "reason": "continue_watching",
      "reason_detail": "Episode 1089 of ??"
    }
  ],
  "meta": {
    "requestId": "req_continue_jkl012",
    "reason_counts": { "continue_watching": 1 },
    "generated_at": "2026-06-26T10:30:00Z"
  }
}
```

HTTP: `200`

#### Empty response

When the user has no in-progress anime, the endpoint returns `200` with `data: []`. This is not an error.

```json
{
  "data": [],
  "meta": {
    "requestId": "req_continue_empty",
    "reason_counts": {},
    "generated_at": "2026-06-26T10:30:00Z"
  }
}
```

#### Error responses

| Scenario | HTTP | `code` | `details` |
| :------- | :--- | :----- | :-------- |
| Missing/invalid token | 401 | `UNAUTHORIZED` | — |
| `limit` outside 1–25 | 400 | `VALIDATION_ERROR` | `errors[]` on `limit` |

---

## 7. Endpoint map

| Method | URL | Auth | Cache TTL | Rate limit |
| :----- | :-- | :---- | :--------- | :--------- |
| `GET` | `/api/v1/recommendations` | bearer | 300s private | 20/60s per user/IP (shared) |
| `GET` | `/api/v1/recommendations/trending` | optional | 300s public | 20/60s per user/IP (shared) |
| `GET` | `/api/v1/recommendations/similar/{animeId}` | none | 3600s public | 20/60s per user/IP (shared) |
| `GET` | `/api/v1/recommendations/continue` | bearer | 300s private | 20/60s per user/IP (shared) |

---

## 8. Implementation notes

### 8.1. Algorithm (M3)

The M3 recommendation engine uses a **weighted blend**:

1. **Genre overlap** — for each anime in the catalog, count how many genres overlap with the user's top-5 most-watched genres. Weight: 0.5.
2. **Studio overlap** — same computation but for studios. Weight: 0.2.
3. **Popularity score** — normalized `popularity_score` (z-score across the catalog). Weight: 0.3.

The final score is `0.5 * genre_overlap + 0.2 * studio_overlap + 0.3 * popularity_z`. Items already in the user's watchlist or completed list are excluded.

### 8.2. Fallback behavior

- Personalized endpoint with no history → trending results with `reason: "fallback"`.
- Similar endpoint with no overlap → return top-5 popular anime in the same `type` (tv/movie/ova) with `reason: "trending"`.
- Continue-watching with no entries → empty array, HTTP 200.

### 8.3. Cache invalidation

- Personalized recs are invalidated when the user's watchlist or watch-progress changes (write-through via `@nexus/cache`).
- Trending is invalidated on a fixed 5-minute TTL; no explicit invalidation.
- Similar is invalidated when the source anime's genre/studio relationships change (rare; TTL-bound).
- Continue-watching is invalidated when the user's watch-progress changes.

### 8.4. Telemetry

Each response includes `meta.generated_at` and `meta.reason_counts`. Log these — they are the primary signal for detecting a broken recommendation pipeline. If `reason_counts.fallback` dominates personalized responses, the user-history lookup is failing.

---

## 9. Changelog

| Date       | Change                   | Ticket / PR    |
| :--------- | :----------------------- | :------------- |
| 2026-06-26 | Initial recommendations spec | —              |
|            |                          |                |
|            |                          |                |

---

## 10. License & ownership

This specification is under the same license as the Nexus Anime repository. API contract changes require review from the **Lead API Architect** and two approving engineers. All trademarks and brand assets referenced remain property of their respective owners — this document is an engineering contract, not a license for redistribution.
