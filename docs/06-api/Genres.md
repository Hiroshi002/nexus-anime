# Genres

> **Authoritative endpoint reference** for the `/api/v1/genres` resource. Covers taxonomy browsing, single-genre detail, and admin mutations.

> Ownership: **Lead API Architect**. Last reviewed: 2026-06-26.

---

## 1. Purpose

Genres is a **taxonomy table** — a small, read-heavy, rarely-mutated lookup that powers:

- Catalog filter chips on `/anime` and `/anime/explore`.
- Genre detail pages at `/genres/{slug}`.
- Admin curation of the taxonomy (create, rename, reorder, deactivate).

The table is small (low hundreds of rows at most) and changes infrequently. Reads are **heavily cached**; writes require admin role and invalidate the cache via `@nexus/cache` write-through helpers.

**Schema reference:** The authoritative column list, constraints, indexes, and enum values live in [`docs/07-database/Genres.md`](../07-database/Genres.md). This endpoint document only summarizes field shapes for request/response contract clarity.

---

## 2. Schema (summary)

Endpoint request and response payloads use the shape below. They mirror the columns defined in `docs/07-database/Genres.md` section 2.

```ts
// Response payload shape — used by list and detail endpoints.
Genre {
  slug!: string;           // unique among active rows; URL-safe identifier (e.g. "shonen", "slice-of-life")
  name!: string;           // display label (e.g. "Shonen", "Slice of Life")
  description?: string | null;
  color_hex?: string | null;   // brand accent, "#rrggbb"
  icon?: string | null;        // lucide icon key or emoji shortcode
  sort_order!: number;         // lower = earlier in navigation
  is_active!: boolean;         // false hides from public lists; never hard-deleted in normal flow
  created_at!: string;         // ISO-8601 timestamptz
  updated_at!: string;         // ISO-8601 timestamptz
  deleted_at?: string | null;  // ISO-8601 timestamptz; populated only in extraordinary admin actions
}
```

### 2.1 Constraints

- **Unique (partial):** `slug` is unique where `deleted_at IS NULL`.
- **Unique (partial):** `name` is unique where `deleted_at IS NULL`.
- **Check:** `color_hex` matches `^#[0-9a-fA-F]{6}$` when non-null.
- **Check:** `sort_order >= 0`.

> **Why partial unique, not full unique?** A hard-deleted row frees the slug/name for reuse without a migration. Soft-deactivation (`is_active = false`) preserves history and existing foreign keys. See [API-Standards.md](./API-Standards.md) section on soft-delete policy.

---

## 3. Cache headers

All **read-only** endpoints in this document emit an aggressive cache policy:

```
Cache-Control: public, max-age=86400, stale-while-revalidate=31536000
```

Rationale: taxonomy data changes on a human-curated cadence (not real-time). 24-hour freshness serves subsequent page loads from CDN edge; 1 year of stale-while-revalidate covers the gap while the origin revalidates in the background. Personalized responses are not a concern for this resource — the list is the same for every user.

**Mutation endpoints** (POST, PATCH, DELETE) do not carry cache headers — responses are not cacheable by definition. The handler is responsible for invalidating cached read keys in `@nexus/cache` (`nexus:genres:list`, `nexus:genres:{slug}`).

See [API-Standards.md](./API-Standards.md) section on caching for the full cache key schema.

---

## 4. Endpoints

### 4.1 `GET /api/v1/genres`

List all **active** genres, ordered by `sort_order ASC`, then `name ASC`.

**Query parameters:**

| Param              | Type    | Required | Default | Notes                                      |
| :----------------- | :------ | :------- | :------ | :----------------------------------------- |
| `include_inactive` | boolean | no       | `false` | Admin only. When `true`, returns all rows. |

**Response `data`:**

```ts
{
  items: Genre[];
  total: number;
}
```

**Status codes:**

| Code | Condition                             |
| :--- | :------------------------------------ |
| 200  | Success                               |
| 400  | Invalid query parameter               |
| 401  | `include_inactive=true` without admin |

---

### 4.2 `GET /api/v1/genres/{slug}`

Fetch a single genre by slug.

**Path parameters:**

| Param  | Type   | Required | Notes                     |
| :----- | :----- | :------- | :------------------------ |
| `slug` | string | yes      | URL-safe genre identifier |

**Response `data`:** `Genre`

**Status codes:**

| Code | Condition                     |
| :--- | :---------------------------- |
| 200  | Success                       |
| 404  | Genre not found or not active |

> Inactive genres return 404 to public callers. Admin callers may pass `?include_inactive=true` to fetch any row.

---

### 4.3 `POST /api/v1/genres`

**Admin only.** Create a new genre. Slug and name must be unique among non-deleted rows.

**Request body:**

```ts
{
  slug!: string;           // URL-safe, lowercase, hyphenated
  name!: string;           // display label
  description?: string;
  color_hex?: string;      // "#rrggbb"
  icon?: string;
  sort_order?: number;     // defaults to max+1 when omitted
}
```

**Response `data`:** `Genre` (with generated `created_at`, `updated_at`, `is_active=true`)

**Status codes:**

| Code | Condition                                    |
| :--- | :------------------------------------------- |
| 201  | Created                                      |
| 400  | Validation error (Zod)                       |
| 401  | Unauthenticated                              |
| 403  | Authenticated but not admin                  |
| 409  | Duplicate `slug` or `name` among active rows |

**Side effects:** Cache keys `nexus:genres:list` invalidated on success.

---

### 4.4 `PATCH /api/v1/genres/{slug}`

**Admin only.** Partial update of an existing genre. Setting `is_active = false` **deactivates** the genre — it is never hard-deleted through normal admin flow.

**Path parameters:**

| Param  | Type   | Required | Notes                      |
| :----- | :----- | :------- | :------------------------- |
| `slug` | string | yes      | Slug of the genre to patch |

**Request body (all fields optional):**

```ts
{
  name?: string;
  description?: string;
  color_hex?: string;
  icon?: string;
  sort_order?: number;
  is_active?: boolean;     // false = deactivate
}
```

**Response `data`:** `Genre`

**Status codes:**

| Code | Condition                                   |
| :--- | :------------------------------------------ |
| 200  | Updated                                     |
| 400  | Validation error (Zod)                      |
| 401  | Unauthenticated                             |
| 403  | Not admin                                   |
| 404  | Genre not found                             |
| 409  | New `name` collides with another active row |

**Side effects:** Cache keys `nexus:genres:list` and `nexus:genres:{slug}` invalidated on success.

---

### 4.5 `DELETE /api/v1/genres/{slug}`

**Admin only.** Soft-deletes a genre by setting `is_active = false` and `deleted_at = NOW()`. Reserved for **extraordinary cases** (legal takedown, irreversible taxonomy error). Normal deactivation should use `PATCH` with `is_active = false`.

> **Why so guarded?** Genres have foreign keys across `anime_genres`, `user_genres`, and recommendation tables. Hard deletion would cascade unpredictably. Soft-deactivation preserves referential integrity and allows restoration.

**Path parameters:**

| Param  | Type   | Required | Notes                            |
| :----- | :----- | :------- | :------------------------------- |
| `slug` | string | yes      | Slug of the genre to soft-delete |

**Response:** `204 No Content` on success (no body).

**Status codes:**

| Code | Condition       |
| :--- | :-------------- |
| 204  | Soft-deleted    |
| 401  | Unauthenticated |
| 403  | Not admin       |
| 404  | Genre not found |

**Side effects:** Cache keys `nexus:genres:list` and `nexus:genres:{slug}` invalidated on success.

---

## 5. Examples

### 5.1 List active genres

```http
GET /api/v1/genres HTTP/1.1
Host: app.nexus-anime.com
Accept: application/json
```

```http
HTTP/1.1 200 OK
Cache-Control: public, max-age=86400, stale-while-revalidate=31536000
Content-Type: application/json

{
  "data": {
    "items": [
      {
        "slug": "action",
        "name": "Action",
        "description": "Fast-paced series with combat and chase sequences.",
        "color_hex": "#e11d48",
        "icon": "swords",
        "sort_order": 1,
        "is_active": true,
        "created_at": "2025-01-15T08:00:00Z",
        "updated_at": "2025-01-15T08:00:00Z",
        "deleted_at": null
      },
      {
        "slug": "shonen",
        "name": "Shonen",
        "description": "Targeted at teen male audiences; adventure and growth themes.",
        "color_hex": "#f59e0b",
        "icon": "flame",
        "sort_order": 2,
        "is_active": true,
        "created_at": "2025-01-15T08:00:00Z",
        "updated_at": "2025-01-15T08:00:00Z",
        "deleted_at": null
      }
    ],
    "total": 2
  }
}
```

### 5.2 Single genre detail

```http
GET /api/v1/genres/shonen HTTP/1.1
Host: app.nexus-anime.com
Accept: application/json
```

```http
HTTP/1.1 200 OK
Cache-Control: public, max-age=86400, stale-while-revalidate=31536000
Content-Type: application/json

{
  "data": {
    "slug": "shonen",
    "name": "Shonen",
    "description": "Targeted at teen male audiences; adventure and growth themes.",
    "color_hex": "#f59e0b",
    "icon": "flame",
    "sort_order": 2,
    "is_active": true,
    "created_at": "2025-01-15T08:00:00Z",
    "updated_at": "2025-01-15T08:00:00Z",
    "deleted_at": null
  }
}
```

### 5.3 Admin create

```http
POST /api/v1/genres HTTP/1.1
Host: app.nexus-anime.com
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "slug": "isekai",
  "name": "Isekai",
  "description": "Protagonists transported to a parallel world.",
  "color_hex": "#8b5cf6",
  "icon": "sparkles",
  "sort_order": 15
}
```

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "data": {
    "slug": "isekai",
    "name": "Isekai",
    "description": "Protagonists transported to a parallel world.",
    "color_hex": "#8b5cf6",
    "icon": "sparkles",
    "sort_order": 15,
    "is_active": true,
    "created_at": "2026-06-26T10:30:00Z",
    "updated_at": "2026-06-26T10:30:00Z",
    "deleted_at": null
  }
}
```

### 5.4 Admin deactivate (preferred)

```http
PATCH /api/v1/genres/isekai HTTP/1.1
Host: app.nexus-anime.com
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "is_active": false
}
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": {
    "slug": "isekai",
    "name": "Isekai",
    "is_active": false,
    "updated_at": "2026-06-26T10:35:00Z",
    "deleted_at": null
  }
}
```

### 5.5 Admin soft-delete (extraordinary only)

```http
DELETE /api/v1/genres/isekai HTTP/1.1
Host: app.nexus-anime.com
Authorization: Bearer <admin_token>
```

```http
HTTP/1.1 204 No Content
```

---

## 6. Error responses

All endpoints in this document use the standard error envelope defined in [Error-Codes.md](./Error-Codes.md). Common codes for this resource:

| HTTP | `code`               | Condition                                |
| :--- | :------------------- | :--------------------------------------- |
| 400  | `VALIDATION_ERROR`   | Zod rejected the request body            |
| 401  | `UNAUTHENTICATED`    | Missing or expired session               |
| 403  | `FORBIDDEN`          | Non-admin attempted a mutation           |
| 404  | `RESOURCE_NOT_FOUND` | Slug does not match an active genre      |
| 409  | `DUPLICATE_RESOURCE` | Slug or name collides with an active row |

---

## 7. Cross-references

| Concern                  | Document                                                                     |
| :----------------------- | :--------------------------------------------------------------------------- |
| Cache key schema         | [API-Standards.md](./API-Standards.md)                                       |
| Error code registry      | [Error-Codes.md](./Error-Codes.md)                                           |
| Pagination contract      | [Pagination.md](./Pagination.md) (not used here — list is small and unpaged) |
| Rate-limit quotas        | [Rate-Limiting.md](./Rate-Limiting.md)                                       |
| Database schema          | [Genres.md](../07-database/Genres.md)                                        |
| Anime ↔ Genre join table | [Anime.md](./Anime.md) section on sub-resources                              |
