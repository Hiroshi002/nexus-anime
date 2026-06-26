# Pagination

> **Authoritative reference** for every list endpoint in Nexus Anime. Route handlers, Server Actions that return lists, and internal service calls that traverse a network boundary MUST conform to this document.
>
> Companion: [`API-Standards.md`](./API-Standards.md) §15 (summary). This document is the full policy.
>
> Ownership: **Lead API Architect**. Last reviewed: 2026-06-26.

---

## 1. Purpose

This document defines the pagination contract for list endpoints across the Nexus Anime platform. It specifies:

- When to use **cursor** vs **offset** pagination.
- The cursor encoding format.
- The request parameters and response envelope.
- Navigation semantics (forward, backward, first, last).
- Optional HATEOAS `Link` headers.
- Concurrency and indexing requirements.
- Concrete examples for first, middle, last, and empty pages.

Goal: clients can page through any list deterministically without skipped or duplicated items, even while the underlying data is being written to.

---

## 2. Offset vs cursor

| Concern | Offset | Cursor |
| :------ | :----- | :----- |
| Mechanism | `LIMIT n OFFSET m` | `WHERE (sort_col, id) < (last_seen) LIMIT n` |
| Jump to arbitrary page | Yes (`page=k`) | No — sequential only |
| Stable under inserts/deletes | **No** — rows shift, causing skips/duplicates | **Yes** — cursor is a stable position |
| Total count cost | Cheap (`COUNT(*)`) | Expensive — requires separate `COUNT` |
| Backward navigation | Trivial (`page=k-1`) | Requires reversed seek + in-memory flip |
| Use case | Static/admin lists, small fixed datasets | Default for all user-facing growing lists |

**Rule:** cursor pagination is the default. Offset pagination is permitted **only** on admin-only or static endpoints where the result set is bounded and not mutated concurrently by end users.

---

## 3. Cursor pagination (default)

### 3.1 Parameters

| Parameter | Type | Required | Default | Range | Notes |
| :-------- | :--- | :------ | :------ | :---- | :---- |
| `cursor` | string | No | omitted (first page) | — | Base64url-encoded cursor from a prior response. Omit for the first page. |
| `limit` | integer | No | `20` | `1`–`100` | Number of items per page. Clamped to `[1, 100]`; values outside the range return `VALIDATION_ERROR`. |
| `includeTotal` | boolean | No | `false` | — | When `true`, the response includes an exact `total` count. Adds a `COUNT(*)` query — use sparingly. |
| `direction` | string | No | `"forward"` | `"forward"` \| `"backward"` | Navigation direction. See §6. |

All parameters are query-string parameters on `GET` requests. Cursor pagination MUST NOT be combined with offset parameters (`page`, `perPage`).

### 3.2 Cursor format

A cursor is a **base64url-encoded JSON object** (no padding) that encodes the sort key of the last (or first) item on the current page. The cursor is opaque to clients — they MUST treat it as an uninterpreted string and MUST NOT parse or construct it.

Shape of the decoded JSON:

```json
{
  "v": 1,
  "s": "created_at",
  "d": "desc",
  "k": "2026-06-26T14:30:00.000Z",
  "id": "clxkqexample0001"
}
```

| Field | Meaning |
| :---- | :------ |
| `v` | Cursor schema version (currently `1`). |
| `s` | Sort column the cursor was generated against. |
| `d` | Sort direction: `"asc"` or `"desc"`. |
| `k` | Value of the sort column for the boundary item (ISO 8601 for timestamps). |
| `id` | Primary key of the boundary item — tiebreaker for stable ordering. |

Encoding:

```ts
const json = JSON.stringify({ v: 1, s: "created_at", d: "desc", k: "2026-06-26T14:30:00.000Z", id: "clxkqexample0001" });
const cursor = Buffer.from(json, "utf8").toString("base64url");
```

Decoding on the server:

```ts
const json = Buffer.from(cursor, "base64url").toString("utf8");
const parsed = CursorSchema.parse(JSON.parse(json)); // Zod validation
```

A malformed or expired cursor returns `400 Bad Request` with code `INVALID_CURSOR`.

### 3.3 Response shape

```json
{
  "data": {
    "items": [
      { "id": "clxkq001", "title": "...", "createdAt": "2026-06-26T14:30:00.000Z" },
      { "id": "clxkq002", "title": "...", "createdAt": "2026-06-26T12:00:00.000Z" }
    ],
    "pagination": {
      "nextCursor": "eyJ2Ijox...",
      "prevCursor": null,
      "hasMore": true,
      "limit": 20,
      "total": 4821
    }
  }
}
```

| Field | Type | Notes |
| :---- | :--- | :---- |
| `data.items` | array | Page of results. Empty array `[]` when no results. |
| `data.pagination.nextCursor` | string \| null | Pass as `cursor` to fetch the next page. `null` when no next page. |
| `data.pagination.prevCursor` | string \| null | Pass as `cursor` with `direction=backward` to fetch the previous page. `null` when on the first page. |
| `data.pagination.hasMore` | boolean | `true` when `nextCursor` is non-null. Convenience flag. |
| `data.pagination.limit` | integer | The effective limit used (echoed back). |
| `data.pagination.total` | integer \| null | Exact total count — **only present when `includeTotal=true`**. `null` otherwise. |

The `data` key follows the standard envelope (see `API-Standards.md` §4). Errors use the standard error envelope.

### 4. How to navigate

#### Forward (default)

1. First request: `GET /api/v1/anime?limit=20` (no cursor).
2. Read `data.pagination.nextCursor`.
3. Next request: `GET /api/v1/anime?limit=20&cursor=eyJ2Ijox...`
4. Repeat until `hasMore === false` (or `nextCursor === null`).

#### Backward

1. From any page, read `data.pagination.prevCursor`.
2. Request: `GET /api/v1/anime?limit=20&cursor=<prevCursor>&direction=backward`.
3. The server seeks in the reverse sort order and flips the result so `items` is returned in the canonical (forward) order.

`direction=backward` MUST be used with a `prevCursor`. Using `direction=backward` without a cursor, or with a `nextCursor`, returns `INVALID_CURSOR`.

#### First page

Omit `cursor` (or explicitly pass `direction=forward` with no cursor). The response's `prevCursor` is always `null`.

#### Last page

There is no "jump to last page" operation. The last page is reached by following `nextCursor` until `hasMore === false`. On the last page, `nextCursor` is `null` and `prevCursor` is non-null (unless the entire result set fits in one page).

### 5. HATEOAS links (optional)

Endpoints MAY return a `Link` header in RFC 5988 format for machine-driven crawlers:

```
Link: </api/v1/anime?limit=20&cursor=eyJ2Ijox...>; rel="next",
      </api/v1/anime?limit=20&cursor=eyJwcmV2...>; rel="prev"
```

- `rel="next"` is present only when `hasMore` is `true`.
- `rel="prev"` is present only when not on the first page.
- The `Link` header is optional; clients SHOULD prefer the body `pagination` object.

`Link` is exposed via `Access-Control-Expose-Headers` (see `API-Standards.md` §16).

---

## 6. Offset pagination (admin-only)

Offset pagination is restricted to admin-only or static endpoints where:

- The result set is bounded (e.g. audit logs for a fixed date range, config listings).
- The data is not concurrently mutated by end users during pagination.
- The endpoint is gated behind an admin role.

### 6.1 Parameters

| Parameter | Type | Required | Default | Range | Notes |
| :-------- | :--- | :------ | :------ | :---- | :---- |
| `page` | integer | No | `1` | `≥ 1` | Page number (1-indexed). |
| `perPage` | integer | No | `20` | `1`–`100` | Items per page. Clamped like `limit`. |

Offset endpoints MUST NOT accept `cursor`, `direction`, or `includeTotal`.

### 6.2 Response shape

```json
{
  "data": {
    "items": [ ... ],
    "pagination": {
      "page": 3,
      "perPage": 20,
      "total": 4821,
      "totalPages": 241,
      "hasNext": true,
      "hasPrev": true
    }
  }
}
```

| Field | Type | Notes |
| :---- | :--- | :---- |
| `data.pagination.page` | integer | Current page (echoed). |
| `data.pagination.perPage` | integer | Effective perPage (echoed). |
| `data.pagination.total` | integer | Exact total count (always present for offset). |
| `data.pagination.totalPages` | integer | `ceil(total / perPage)`. |
| `data.pagination.hasNext` | boolean | `page < totalPages`. |
| `data.pagination.hasPrev` | boolean | `page > 1`. |

---

## 7. Empty results

An empty page is **not** an error. The response returns `200 OK` with an empty `items` array:

```json
{
  "data": {
    "items": [],
    "pagination": {
      "nextCursor": null,
      "prevCursor": null,
      "hasMore": false,
      "limit": 20,
      "total": 0
    }
  }
}
```

For offset pagination, `total: 0`, `totalPages: 0`, `hasNext: false`, `hasPrev: false`.

A client that requests a cursor pointing at a now-deleted or filtered-out item receives `INVALID_CURSOR` (400) — not an empty page. The client should reset to the first page.

---

## 8. Concurrency considerations

A cursor snapshot is taken at query time. Writes that occur during pagination (inserts, deletes, updates to the sort column) are handled as follows:

- **Inserts at the sort boundary** are invisible to the current cursor position — they appear on a subsequent page or a fresh first-page request. No duplicates.
- **Deletes** of items already passed by the cursor are invisible — the cursor position is stable. The next page may have fewer items than `limit` if rows were deleted; this is signaled by `hasMore: false` when the seek exhausts rows.
- **Updates to the sort column** of an already-returned item may cause it to reappear on a later page or disappear from its original position. Treat cursor pagination as **eventually consistent across page boundaries** — acceptable for feeds and watchlists, not for financial ledgers (use offset + transaction snapshot for those).
- **Isolation:** cursor queries run in `READ COMMITTED` by default. If an endpoint requires a stable snapshot across multiple pages, it MUST document the use of `REPEATABLE READ` or an explicit transaction.

---

## 9. Implementation notes

### 9.1 Indexing

Every cursor-paginated query MUST have a composite index on `(sort_column, id)` to support the seek. The default sort is `created_at DESC, id DESC`:

```sql
CREATE INDEX idx_anime_created_id ON anime (created_at DESC, id DESC);
```

For ascending sorts, the index column order must match. The `id` tiebreaker guarantees deterministic ordering when `sort_column` values are equal.

### 9.2 Seek query pattern

Forward seek (default `created_at DESC`):

```sql
SELECT * FROM anime
WHERE (created_at, id) < ($last_created_at, $last_id)
ORDER BY created_at DESC, id DESC
LIMIT $limit + 1;
```

The `+1` over-fetch detects `hasMore` without a separate count. If the query returns `limit + 1` rows, drop the last row and set `hasMore: true`; the dropped row's key becomes `nextCursor`.

### 9.3 Total count

`total` is an **exact** `COUNT(*)` when `includeTotal=true`. It is not estimated. Because `COUNT(*)` scans the index, it is gated behind `includeTotal` to avoid paying the cost on every page. Cache the total in Redis with a short TTL (60s) for hot endpoints.

### 9.4 Validation

All parameters are validated with Zod before hitting the database:

```ts
const CursorParams = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  includeTotal: z.coerce.boolean().default(false),
  direction: z.enum(["forward", "backward"]).default("forward"),
});
```

---

## 10. Examples

Assume a list of 47 items sorted by `created_at DESC`, `limit=10`.

### 10.1 First page

Request:

```
GET /api/v1/anime?limit=10
```

Response:

```json
{
  "data": {
    "items": [
      { "id": "a47", "createdAt": "2026-06-26T14:30:00.000Z" },
      { "id": "a46", "createdAt": "2026-06-26T13:00:00.000Z" },
      { "id": "a45", "createdAt": "2026-06-26T11:00:00.000Z" },
      { "id": "a44", "createdAt": "2026-06-25T22:00:00.000Z" },
      { "id": "a43", "createdAt": "2026-06-25T20:00:00.000Z" },
      { "id": "a42", "createdAt": "2026-06-25T18:00:00.000Z" },
      { "id": "a41", "createdAt": "2026-06-25T16:00:00.000Z" },
      { "id": "a40", "createdAt": "2026-06-25T14:00:00.000Z" },
      { "id": "a39", "createdAt": "2026-06-25T12:00:00.000Z" },
      { "id": "a38", "createdAt": "2026-06-25T10:00:00.000Z" }
    ],
    "pagination": {
      "nextCursor": "eyJ2IjoxLCJzIjoiY3JlYXRlZF9hdCIsImQiOiJkZXNjIiwiayI6IjIwMjYtMDYtMjVUMTA6MDA6MDAuMDAwWiIsImlkIjoiYzM4In0",
      "prevCursor": null,
      "hasMore": true,
      "limit": 10,
      "total": null
    }
  }
}
```

`prevCursor` is `null` — this is the first page. `total` is `null` because `includeTotal` was not requested.

### 10.2 Middle page

Request:

```
GET /api/v1/anime?limit=10&cursor=eyJ2IjoxLCJzIjoiY3JlYXRlZF9hdCIsImQiOiJkZXNjIiwiayI6IjIwMjYtMDYtMjVUMTA6MDA6MDAuMDAwWiIsImlkIjoiYzM4In0
```

Response:

```json
{
  "data": {
    "items": [
      { "id": "a37", "createdAt": "2026-06-25T08:00:00.000Z" },
      { "id": "a36", "createdAt": "2026-06-25T06:00:00.000Z" },
      { "id": "a35", "createdAt": "2026-06-25T04:00:00.000Z" },
      { "id": "a34", "createdAt": "2026-06-25T02:00:00.000Z" },
      { "id": "a33", "createdAt": "2026-06-24T23:00:00.000Z" },
      { "id": "a32", "createdAt": "2026-06-24T21:00:00.000Z" },
      { "id": "a31", "createdAt": "2026-06-24T19:00:00.000Z" },
      { "id": "a30", "createdAt": "2026-06-24T17:00:00.000Z" },
      { "id": "a29", "createdAt": "2026-06-24T15:00:00.000Z" },
      { "id": "a28", "createdAt": "2026-06-24T13:00:00.000Z" }
    ],
    "pagination": {
      "nextCursor": "eyJ2IjoxLCJzIjoiY3JlYXRlZF9hdCIsImQiOiJkZXNjIiwiayI6IjIwMjYtMDYtMjRUMTM6MDA6MDAuMDAwWiIsImlkIjoiYTI4In0",
      "prevCursor": "eyJ2IjoxLCJzIjoiY3JlYXRlZF9hdCIsImQiOiJhc2MiLCJrIjoiMjAyNi0wNi0yNVQxMDowMDowMC4wMDBaIiwiaWQiOiJhMzgifQ",
      "hasMore": true,
      "limit": 10,
      "total": null
    }
  }
}
```

Both `nextCursor` and `prevCursor` are present. The `prevCursor` encodes `direction: "asc"` — the server uses it to seek backward.

### 10.3 Last page

Request:

```
GET /api/v1/anime?limit=10&cursor=<last-nextCursor>
```

Response (only 7 items remain):

```json
{
  "data": {
    "items": [
      { "id": "a07", "createdAt": "2026-06-20T04:00:00.000Z" },
      { "id": "a06", "createdAt": "2026-06-20T02:00:00.000Z" },
      { "id": "a05", "createdAt": "2026-06-20T00:00:00.000Z" },
      { "id": "a04", "createdAt": "2026-06-19T22:00:00.000Z" },
      { "id": "a03", "createdAt": "2026-06-19T20:00:00.000Z" },
      { "id": "a02", "createdAt": "2026-06-19T18:00:00.000Z" },
      { "id": "a01", "createdAt": "2026-06-19T16:00:00.000Z" }
    ],
    "pagination": {
      "nextCursor": null,
      "prevCursor": "eyJ2IjoxLCJzIjoiY3JlYXRlZF9hdCIsImQiOiJhc2MiLCJrIjoiMjAyNi0wNi0yMFQwNDowMDowMC4wMDBaIiwiaWQiOiJhMDcifQ",
      "hasMore": false,
      "limit": 10,
      "total": null
    }
  }
}
```

`nextCursor` is `null` and `hasMore` is `false` — the client stops paging.

### 10.4 Empty result

Request (e.g. a user with no watchlist entries):

```
GET /api/v1/watchlist?limit=20
```

Response:

```json
{
  "data": {
    "items": [],
    "pagination": {
      "nextCursor": null,
      "prevCursor": null,
      "hasMore": false,
      "limit": 20,
      "total": 0
    }
  }
}
```

### 10.5 With total count

Request:

```
GET /api/v1/anime?limit=10&includeTotal=true
```

Response includes `total`:

```json
{
  "data": {
    "items": [ ... ],
    "pagination": {
      "nextCursor": "...",
      "prevCursor": null,
      "hasMore": true,
      "limit": 10,
      "total": 47
    }
  }
}
```

### 10.6 Offset pagination (admin)

Request:

```
GET /api/v1/admin/audit-logs?page=3&perPage=20
```

Response:

```json
{
  "data": {
    "items": [ ... ],
    "pagination": {
      "page": 3,
      "perPage": 20,
      "total": 4821,
      "totalPages": 241,
      "hasNext": true,
      "hasPrev": true
    }
  }
}
```
