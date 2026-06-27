# Ratings

> **Authoritative endpoint reference** for the `/api/v1/ratings` and `/api/v1/anime/{animeId}/ratings` resources. Covers numeric scores, optional reviews, the one-per-user invariant, optimistic-concurrency edits, and helpful-vote toggles.
>
> Ownership: **Lead API Architect**. Last reviewed: 2026-06-26.

---

## 1. Purpose

The Ratings resource lets authenticated users attach a **numeric score (0–10)** to an anime, optionally accompanied by a **review** (title + body). Each user has at most one active rating per anime — changing the value is an `UPDATE`, not a new row.

Ratings power:

- The show's `average_rating` and `rating_count` (denormalized on `anime`, maintained on insert / value-change / soft-delete; reconciled nightly).
- "Top-rated" sort on catalog and search.
- The review section on anime detail pages.

All endpoints besides the public list/get require an authenticated session. Unauthenticated requests receive `401 Unauthorized`.

**Schema reference:** Authoritative column definitions, constraints, and indexes live in [`docs/07-database/Rating.md`](../07-database/Rating.md). This document only summarizes field shapes for request/response clarity.

---

## 2. Fields & constraints (summary)

```ts
// Row shape returned in responses.
Rating: {
  id!: string;                  // uuid
  user_id!: string;             // uuid — FK to users
  anime_id!: string;            // uuid — FK to anime
  value!: number;               // numeric(3,2), 0.00–10.00
  review_title?: string | null; // max 200 chars when non-null
  review_body?: string | null;  // max 10000 chars when non-null
  is_spoiler!: boolean;
  helpful_count!: number;       // integer ≥ 0
  version!: number;             // optimistic concurrency token
  created_at!: string;          // ISO-8601 timestamptz
  updated_at!: string;          // ISO-8601 timestamptz
  deleted_at?: string | null;   // ISO-8601 timestamptz — soft-delete
}

// Public-facing review projection omits internal fields.
RatingPublic: {
  id!: string;
  user_id!: string;
  anime_id!: string;
  value!: number;
  review_title?: string | null;
  review_body?: string | null;
  is_spoiler!: boolean;
  helpful_count!: number;
  created_at!: string;
  updated_at!: string;
}
```

| Constraint            | Definition                                                 |
| --------------------- | ---------------------------------------------------------- |
| Partial unique        | `UNIQUE (user_id, anime_id) WHERE deleted_at IS NULL`      |
| Value range           | `value BETWEEN 0 AND 10`                                   |
| Review title length   | `review_title IS NULL OR char_length(review_title) <= 200` |
| Review body length    | `review_body IS NULL OR char_length(review_body) <= 10000` |
| Review requires value | `review_body IS NULL OR value IS NOT NULL`                 |

`value` is required on create. Review is optional — a valid rating can carry only a number.

---

## 3. Endpoints

All mutation endpoints and the "me" list endpoint require authentication. List and get endpoints are **edge-cacheable**; mutations invalidate via `@nexus/cache` write-through helpers.

### 3.1 List ratings for an anime

```
GET /api/v1/anime/{animeId}/ratings
```

**Query parameters:**

| Parameter  | Type    | Default     | Description                                                                                                                                                                     |
| :--------- | :------ | :---------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cursor`   | string  | —           | Cursor for pagination (see `Pagination.md`)                                                                                                                                     |
| `limit`    | integer | 20          | Items per page (1–100)                                                                                                                                                          |
| `sort`     | string  | `"helpful"` | Sort key: `"helpful"` sorts by `helpful_count DESC, created_at DESC`; `"recent"` sorts by `created_at DESC`; `"highest"` sorts by `value DESC`; `"lowest"` sorts by `value ASC` |
| `minValue` | number  | —           | Filter: ratings with `value >= minValue` (0–10)                                                                                                                                 |
| `maxValue` | number  | —           | Filter: ratings with `value <= maxValue` (0–10)                                                                                                                                 |

`minValue`/`maxValue` are combined with the partial-index scan on `(anime_id, value)`; they do not disable the sort, the sort column chooses the index.

**Response `200`:**

```json
{
  "data": [
    {
      "id": "rat_01HXG",
      "user_id": "usr_abc",
      "anime_id": "ani_def",
      "value": 9.25,
      "review_title": "Peak fiction",
      "review_body": "The finale recontextualized every earlier episode…",
      "is_spoiler": false,
      "helpful_count": 42,
      "created_at": "2026-06-20T11:00:00Z",
      "updated_at": "2026-06-20T11:00:00Z"
    }
  ],
  "pagination": {
    "next_cursor": "eyJoZWxwZnVsX2NvdW50Ijo0MiwiY3JlYXRlZF9hdCI6IjIwMjYtMDYtMjBUMTE6MDA6MDBaIiwiaWQiOiJyYXRfMDFYWEcifQ==",
    "has_more": true
  }
}
```

**Response `404`:** — `ANIME_NOT_FOUND` if the anime id is unknown or not published.

**Response `400`:** — `VALIDATION_ERROR` on invalid `sort` / `minValue` > `maxValue` / out-of-range limit.

### 3.2 List the current user's ratings

```
GET /api/v1/users/me/ratings
```

**Query parameters:**

| Parameter        | Type    | Default     | Description                                                                                                    |
| :--------------- | :------ | :---------- | :------------------------------------------------------------------------------------------------------------- |
| `cursor`         | string  | —           | Cursor for pagination                                                                                          |
| `limit`          | integer | 20          | Items per page (1–100)                                                                                         |
| `sort`           | string  | `"updated"` | `"updated"` (updated_at DESC), `"created"` (created_at DESC), `"highest"` (value DESC), `"lowest"` (value ASC) |
| `includeDeleted` | boolean | `false`     | When `true`, includes soft-deleted ratings                                                                     |

When the caller is not the owner of the resource (i.e. they are asking for another user's ratings), this endpoint returns `403 Forbidden`. The `/me` prefix is an ownership contract.

**Response `200`:** — paginated list shaped like §3.1.

### 3.3 Get a single rating

```
GET /api/v1/ratings/{id}
```

**Response `200`:**

```json
{
  "data": {
    "id": "rat_01HXG",
    "user_id": "usr_abc",
    "anime_id": "ani_def",
    "value": 9.25,
    "review_title": "Peak fiction",
    "review_body": "The finale recontextualized every earlier episode…",
    "is_spoiler": false,
    "helpful_count": 42,
    "version": 3,
    "created_at": "2026-06-20T11:00:00Z",
    "updated_at": "2026-06-21T02:14:22Z"
  }
}
```

Deletes (`deleted_at` non-null) return `404` to the public; the owning user can read their own soft-deleted row via `/users/me/ratings?includeDeleted=true`.

**Response `404`:** — `NOT_FOUND`.

### 3.4 Create a rating

```
POST /api/v1/anime/{animeId}/ratings
```

One active rating per `(user_id, anime_id)`. If the caller already has a non-deleted row for this anime, the endpoint returns `409` with code `DUPLICATE_RATING`. A soft-deleted row is **not** re-activated by this endpoint — clients that want to restore a deleted rating do so by `PATCH`-ing the existing row (see §3.5).

**Request body:**

| Field          | Type    | Required | Validation                  |
| :------------- | :------ | :------- | :-------------------------- |
| `value`        | number  | yes      | 0.00–10.00, numeric(3,2)    |
| `review_title` | string  | no       | 1–200 chars when non-null   |
| `review_body`  | string  | no       | 1–10000 chars when non-null |
| `is_spoiler`   | boolean | no       | default `false`             |

`version` starts at `1`. `helpful_count` starts at `0`.

**Response `201`:** — full row (shaped like §3.3). The server updates `anime.rating_count` and `anime.average_rating` atomically in the same transaction.

```json
{
  "data": {
    "id": "rat_01HXG",
    "user_id": "usr_abc",
    "anime_id": "ani_def",
    "value": 9.25,
    "review_title": "Peak fiction",
    "review_body": null,
    "is_spoiler": false,
    "helpful_count": 0,
    "version": 1,
    "created_at": "2026-06-26T03:14:22Z",
    "updated_at": "2026-06-26T03:14:22Z"
  }
}
```

**Response `400`:** — `VALIDATION_ERROR`. Examples: `value` out of range, `review_body` supplied without `value`, `review_title` > 200 chars, `review_body` > 10000 chars.

**Response `404`:** — `ANIME_NOT_FOUND` if `{animeId}` does not exist.

**Response `409`:** — `DUPLICATE_RATING`.

```json
{
  "error": {
    "message": "You have already rated this anime.",
    "code": "DUPLICATE_RATING",
    "details": { "anime_id": "ani_def" }
  }
}
```

### 3.5 Update own rating

```
PATCH /api/v1/ratings/{id}
```

Caller must be the rating's owner (`ratings.user_id = current_user.id`), else `403`. The body **must** include `version` for optimistic concurrency; a mismatch returns `409` with code `CONFLICT`.

**Request body** (all fields optional except `version`; omit a field to leave it unchanged):

| Field          | Type         | Required | Validation                        |
| :------------- | :----------- | :------- | :-------------------------------- |
| `version`      | integer      | yes      | Must match current row `version`  |
| `value`        | number       | no       | 0.00–10.00                        |
| `review_title` | string\|null | no       | 1–200 chars, or `null` to clear   |
| `review_body`  | string\|null | no       | 1–10000 chars, or `null` to clear |
| `is_spoiler`   | boolean      | no       | —                                 |

If `review_body` is cleared (set to null), `review_title` is also cleared server-side — an empty review is never stored. If `value` is updated, `anime.average_rating` is recalculated in the same transaction. On any successful write, `version` is incremented.

**Response `200`:** — full updated row.

```json
{
  "data": {
    "id": "rat_01HXG",
    "user_id": "usr_abc",
    "anime_id": "ani_def",
    "value": 9.5,
    "review_title": "Peak fiction",
    "review_body": "Updated: the soundtrack grew on me even more.",
    "is_spoiler": false,
    "helpful_count": 42,
    "version": 4,
    "created_at": "2026-06-20T11:00:00Z",
    "updated_at": "2026-06-26T03:18:00Z"
  }
}
```

**Response `400`:** — `VALIDATION_ERROR` (e.g. `value` out of range; `review_body` provided but `value` absent).

**Response `403`:** — `FORBIDDEN` if caller is not the owner.

**Response `404`:** — `NOT_FOUND`.

**Response `409`:** — `CONFLICT` with version-mismatch details.

```json
{
  "error": {
    "message": "Optimistic concurrency conflict. Fetch the latest rating and retry.",
    "code": "CONFLICT",
    "details": { "expected_version": 3, "current_version": 4 }
  }
}
```

### 3.6 Delete own rating (soft delete)

```
DELETE /api/v1/ratings/{id}
```

Caller must be the owner (`403` otherwise). Sets `deleted_at = now()`, decrements `anime.rating_count`, and recomputes `anime.average_rating` in the same transaction. The row is retained for audit and possible re-activation via PATCH on the (now soft-deleted) id.

**Response `204`:** — empty body.

**Response `404`:** — `NOT_FOUND`.

### 3.7 Toggle helpful vote

```
POST /api/v1/ratings/{id}/helpful
```

Idempotent per `(rating_id, user_id)` — at most one helpful vote per user per rating. The body carries an explicit intent so the same endpoint produces a deterministic toggle-off:

| Field       | Type    | Required           | Description                                     |
| :---------- | :------ | :----------------- | :---------------------------------------------- |
| `rating_id` | string  | yes (body or path) | Must match `{id}` in the path                   |
| `value`     | boolean | yes                | `true` = mark helpful; `false` = remove helpful |

If `value` is `true` and the user has already voted, the request is a no-op `200` (no double-increment). If `value` is `false` and the user has not voted, it is also a no-op `200`.

`helpful_count` is denormalized and reconciled nightly by background job.

**Response `200`:**

```json
{
  "data": {
    "rating_id": "rat_01HXG",
    "user_id": "usr_abc",
    "helpful_count": 43,
    "voted": true
  }
}
```

When `value` is `false`, `voted` is `false` and `helpful_count` is decremented (floored at 0).

**Response `404`:** — `NOT_FOUND` if the rating does not exist or is soft-deleted.

---

## 4. Average rating maintenance

`anime.average_rating` and `anime.rating_count` are denormalized aggregates maintained in the same transaction as the rating mutation:

| Event               | Effect on `anime`                                                                                     |
| :------------------ | :---------------------------------------------------------------------------------------------------- |
| Insert rating       | `rating_count += 1`, `average_rating = (old_avg * old_count + value) / new_count`                     |
| Update rating value | `average_rating = (old_avg * count - old_value + new_value) / count`                                  |
| Soft-delete rating  | `rating_count -= 1`, `average_rating = (old_avg * old_count - value) / new_count` (or 0 if count = 0) |

A nightly background job recomputes these from `ratings` to correct any drift (reconcile pattern).

---

## 5. Cache policy

| Endpoint                      | Cache-Control                                    | Invalidation                                               |
| :---------------------------- | :----------------------------------------------- | :--------------------------------------------------------- |
| `GET /anime/{id}/ratings`     | `public, max-age=60, stale-while-revalidate=300` | Anime-dependent tag `nexus:anime:{id}:ratings`             |
| `GET /users/me/ratings`       | `private, no-store`                              | —                                                          |
| `GET /ratings/{id}`           | `public, max-age=60, stale-while-revalidate=300` | Tag `nexus:ratings:{id}`                                   |
| Mutations (POST/PATCH/DELETE) | `no-store`                                       | Invalidate dependent tags via `@nexus/cache` write-through |

---

## 6. Rate limit

| Scope    | Limit | Window | Key       |
| :------- | :---- | :----- | :-------- |
| Per user | 10    | 60 s   | `user_id` |

Applies to all POST/PATCH/DELETE endpoints on this resource. The list/get endpoints share the global per-IP / per-user quota defined in `Rate-Limiting.md`. Exceeding the limit returns `429` with code `RATE_LIMITED` and standard rate-limit headers.

The 10/60 budget is sized for review-bursts (a user writing several reviews in a short window) while preventing scripted mass-rating abuse. The `helpful` toggle does **not** count against this budget — it has its own 30/60 per-user budget reserved for voting surfaces.

---

## 7. Validation summary

| Rule                                         | Error code         | Field           |
| :------------------------------------------- | :----------------- | :-------------- |
| `value` required                             | `FIELD_REQUIRED`   | `value`         |
| `value` between 0 and 10                     | `FIELD_INVALID`    | `value`         |
| `review_body` requires `value`               | `VALIDATION_ERROR` | `review_body`   |
| `review_title` length ≤ 200                  | `VALIDATION_ERROR` | `review_title`  |
| `review_body` length ≤ 10000                 | `VALIDATION_ERROR` | `review_body`   |
| One active rating per (user, anime)          | `DUPLICATE_RATING` | `value` (whole) |
| `version` must match on PATCH                | `CONFLICT`         | `version`       |
| Cannot rate an unknown anime                 | `ANIME_NOT_FOUND`  | `animeId` path  |
| Cannot modify a rating owned by another user | `FORBIDDEN`        | —               |

---

## 8. Examples

### Score an anime (no review)

```bash
curl -X POST https://api.nexusanime.com/api/v1/anime/ani_def/ratings \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"value": 8.75}'
```

### Score + review

```bash
curl -X POST https://api.nexusanime.com/api/v1/anime/ani_def/ratings \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "value": 9.25,
    "review_title": "Peak fiction",
    "review_body": "The finale recontextualized every earlier episode.",
    "is_spoiler": false
  }'
```

### Edit own rating with optimistic concurrency

```bash
curl -X PATCH https://api.nexusanime.com/api/v1/ratings/rat_01HXG \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"version": 3, "value": 9.50, "review_body": "Grew on me."}'
```

### Remove review text but keep score

```bash
curl -X PATCH https://api.nexusanime.com/api/v1/ratings/rat_01HXG \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"version": 4, "review_title": null, "review_body": null}'
```

### Toggle helpful on

```bash
curl -X POST https://api.nexusanime.com/api/v1/ratings/rat_01HXG/helpful \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"rating_id": "rat_01HXG", "value": true}'
```

### List ratings for an anime, most helpful first

```bash
curl "https://api.nexusanime.com/api/v1/anime/ani_def/ratings?sort=helpful&limit=20"
```

### Hide-then-refresh — tricky cursor case

Because the sort index is `(helpful_count DESC, created_at DESC)`, a rating that just received a vote will move up in the next page; clients that paginate with a cursor will see it on the next fetch without duplication, per the cursor-stability contract in `Pagination.md`.
