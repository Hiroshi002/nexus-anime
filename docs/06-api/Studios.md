# Studios

> **Authoritative endpoint reference** for the `/api/v1/studios` resource. Covers studio browsing, single-studio detail, and admin mutations.

> Ownership: **Lead API Architect**. Last reviewed: 2026-06-26.

---

## 1. Purpose

Studios is a **reference taxonomy** of animation studios, production companies, and licensors. It powers:

- Studio-browse pages at `/studios` and `/studios/{slug}`.
- The "produced by" credits on anime detail pages.
- Admin curation of the studio directory (create, update, deactivate, soft-delete).

The table is small (low hundreds of rows) and changes infrequently. Reads are **heavily cached**; writes require admin role and invalidate the cache via `@nexus/cache` write-through helpers.

**Schema reference:** The authoritative column list, constraints, indexes, and enum values live in [`docs/07-database/Studio.md`](../07-database/Studio.md). This endpoint document only summarizes field shapes for request/response contract clarity.

---

## 2. Schema (summary)

Endpoint request and response payloads use the shape below. They mirror the columns defined in `docs/07-database/Studio.md` section 2.

```ts
// Response payload shape — used by list and detail endpoints.
Studio {
  slug!: string;          // unique among active rows; URL-safe (e.g. "kyoto-animation")
  name!: string;           // display name (e.g. "Kyoto Animation")
  name_jp?: string | null; // original Japanese name (e.g. "京都アニメーション")
  description?: string | null; // short studio bio; sanitized at render
  logo_url?: string | null;    // logo image URL (served via next/image + R2 loader)
  website_url?: string | null; // official website URL
  founded_year?: number | null; // year established; null when unknown
  country?: string | null; // ISO 3166-1 alpha-2 (e.g. "JP")
  sort_order!: number;     // lower = earlier in browse listing
  is_active!: boolean;     // false hides from public lists
  created_at!: string;     // ISO-8601 timestamptz
  updated_at!: string;     // ISO-8601 timestamptz
  deleted_at?: string | null; // ISO-8601 timestamptz; set only on soft-delete
}
```

### 2.1 Constraints

- **Unique (partial):** `slug` is unique where `deleted_at IS NULL`.
- **Unique (partial):** `name` is unique where `deleted_at IS NULL`.
- **Check:** `founded_year BETWEEN 1917 AND 2100` when non-null.
- **Check:** `country ~ '^[A-Z]{2}$'` when non-null.

> **Why partial unique, not full unique?** A soft-deleted row frees the slug/name for reuse without a migration. Soft-deactivation (`is_active = false`) preserves history and existing `anime_studios` credits. See [API-Standards.md](./API-Standards.md) section on soft-delete policy.

---

## 3. Cache headers

All **read-only** endpoints in this document emit an aggressive cache policy:

```
Cache-Control: public, max-age=86400, stale-while-revalidate=31536000
```

Rationale: studio metadata changes on a human-curated cadence (not real-time). 24-hour freshness serves subsequent page loads from CDN edge; 1 year of stale-while-revalidate covers the gap while the origin revalidates in the background. The list is not personalized — it is the same for every caller.

**Mutation endpoints** (POST, PATCH, DELETE) do not carry cache headers — responses are not cacheable by definition. The handler is responsible for invalidating cached read keys in `@nexus/cache` (`nexus:studios:list`, `nexus:studios:{slug}`).

See [API-Standards.md](./API-Standards.md) section on caching for the full cache key schema.

---

## 4. Endpoints

### 4.1 `GET /api/v1/studios`

List active studios with pagination and optional filters.

**Query parameters:**

| Param            | Type    | Required | Default | Notes                                                                |
| :--------------- | :------ | :------- | :------ | :------------------------------------------------------------------- |
| `page`           | number  | no       | `1`     | Offset page number.                                                  |
| `page_size`      | number  | no       | `50`    | Results per page. Max 100.                                           |
| `country`        | string  | no       | —       | Filter by ISO 3166-1 alpha-2 code (e.g. `JP`).                       |
| `is_active`      | boolean | no       | `true`  | Admin only. When `false`, returns only inactive rows. Omit for all.  |
| `include_inactive` | boolean | no       | `false` | Admin only. When `true`, returns both active and inactive rows.    |

**Sorting:** `sort_order ASC`, then `name ASC`.

**Response `data`:**

```ts
{
  items: Studio[];
  total: number;
  page: number;
  page_size: number;
}
```

**Status codes:**

| Code | Condition                                    |
| :--- | :------------------------------------------- |
| 200  | Success                                      |
| 400  | Invalid query parameter                      |
| 401  | `include_inactive=true` / `is_active=false` without admin |

> The pagination contract is defined in [Pagination.md](./Pagination.md).

---

### 4.2 `GET /api/v1/studios/{slug}`

Fetch a single studio by slug.

**Path parameters:**

| Param  | Type   | Required | Notes                           |
| :----- | :----- | :------- | :------------------------------ |
| `slug` | string | yes      | URL-safe studio identifier      |

**Response `data`:** `Studio`

**Status codes:**

| Code | Condition                                |
| :--- | :--------------------------------------- |
| 200  | Success                                  |
| 404  | Studio not found or not active           |

> Inactive studios return 404 to public callers. Admin callers may pass `?include_inactive=true` to fetch any row.

---

### 4.3 `POST /api/v1/studios`

**Admin only.** Create a new studio. Slug and name must be unique among non-deleted rows.

**Request body:**

```ts
{
  slug!: string;           // URL-safe, lowercase, hyphenated
  name!: string;           // display name
  name_jp?: string;        // original Japanese name
  description?: string;    // sanitized at render
  logo_url?: string;
  website_url?: string;
  founded_year?: number;   // 1917..2100
  country?: string;        // ISO alpha-2, uppercase
  sort_order?: number;     // defaults to 0 when omitted
}
```

**Response `data`:** `Studio` (with generated `created_at`, `updated_at`, `is_active=true`, `deleted_at=null`)

**Status codes:**

| Code | Condition                                    |
| :--- | :------------------------------------------- |
| 201  | Created                                      |
| 400  | Validation error (Zod)                       |
| 401  | Unauthenticated                              |
| 403  | Authenticated but not admin                  |
| 409  | Duplicate `slug` or `name` among active rows |

**Side effects:** Cache key `nexus:studios:list` invalidated on success.

---

### 4.4 `PATCH /api/v1/studios/{slug}`

**Admin only.** Partial update of an existing studio. Setting `is_active = false` **deactivates** the studio — it is never hard-deleted through normal admin flow.

**Path parameters:**

| Param  | Type   | Required | Notes                        |
| :----- | :----- | :------- | :--------------------------- |
| `slug` | string | yes      | Slug of the studio to patch  |

**Request body (all fields optional):**

```ts
{
  name?: string;
  name_jp?: string;
  description?: string;
  logo_url?: string;
  website_url?: string;
  founded_year?: number;
  country?: string;
  sort_order?: number;
  is_active?: boolean;     // false = deactivate
}
```

> To **rename** a studio (change its slug), create a new studio and migrate `anime_studios` credits, then soft-delete the old row. The slug is a public identity — mutating it in place would break inbound links.

**Response `data`:** `Studio`

**Status codes:**

| Code | Condition                                  |
| :--- | :----------------------------------------- |
| 200  | Updated                                    |
| 400  | Validation error (Zod)                     |
| 401  | Unauthenticated                            |
| 403  | Not admin                                  |
| 404  | Studio not found                           |
| 409  | New `name` collides with another active row |

**Side effects:** Cache keys `nexus:studios:list` and `nexus:studios:{slug}` invalidated on success.

---

### 4.5 `DELETE /api/v1/studios/{slug}`

**Admin only.** Soft-deletes a studio by setting `is_active = false` and `deleted_at = NOW()`. Reserved for **extraordinary cases** (legal takedown, irreversible merge). Normal deactivation should use `PATCH` with `is_active = false`.

> **Why so guarded?** Studios have foreign keys across `anime_studios` credits. Hard deletion would orphan historical credits. Soft-delete preserves referential integrity and frees the slug for reuse while retaining the row for audit.

**Path parameters:**

| Param  | Type   | Required | Notes                           |
| :----- | :----- | :------- | :------------------------------ |
| `slug` | string | yes      | Slug of the studio to soft-delete |

**Response:** `204 No Content` on success (no body).

**Status codes:**

| Code | Condition                |
| :--- | :----------------------- |
| 204  | Soft-deleted             |
| 401  | Unauthenticated          |
| 403  | Not admin                |
| 404  | Studio not found         |

**Side effects:** Cache keys `nexus:studios:list` and `nexus:studios:{slug}` invalidated on success.

---

## 5. Examples

### 5.1 List active studios (paginated, filter by country)

```http
GET /api/v1/studios?page=1&page_size=2&country=JP HTTP/1.1
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
        "slug": "toei-animation",
        "name": "Toei Animation",
        "name_jp": "東映アニメーション",
        "description": "One of Japan's largest and oldest animation studios.",
        "logo_url": "https://cdn.nexus-anime.com/studios/toei.png",
        "website_url": "https://www.toei-anim.co.jp/",
        "founded_year": 1948,
        "country": "JP",
        "sort_order": 1,
        "is_active": true,
        "created_at": "2025-01-15T08:00:00Z",
        "updated_at": "2025-01-15T08:00:00Z",
        "deleted_at": null
      },
      {
        "slug": "kyoto-animation",
        "name": "Kyoto Animation",
        "name_jp": "京都アニメーション",
        "description": "Known for detailed art and emotionally driven storytelling.",
        "logo_url": "https://cdn.nexus-anime.com/studios/kyoani.png",
        "website_url": "https://www.kyotoanimation.co.jp/",
        "founded_year": 1981,
        "country": "JP",
        "sort_order": 2,
        "is_active": true,
        "created_at": "2025-01-15T08:00:00Z",
        "updated_at": "2025-01-15T08:00:00Z",
        "deleted_at": null
      }
    ],
    "total": 3,
    "page": 1,
    "page_size": 2
  }
}
```

### 5.2 Single studio detail

```http
GET /api/v1/studios/kyoto-animation HTTP/1.1
Host: app.nexus-anime.com
Accept: application/json
```

```http
HTTP/1.1 200 OK
Cache-Control: public, max-age=86400, stale-while-revalidate=31536000
Content-Type: application/json

{
  "data": {
    "slug": "kyoto-animation",
    "name": "Kyoto Animation",
    "name_jp": "京都アニメーション",
    "description": "Known for detailed art and emotionally driven storytelling.",
    "logo_url": "https://cdn.nexus-anime.com/studios/kyoani.png",
    "website_url": "https://www.kyotoanimation.co.jp/",
    "founded_year": 1981,
    "country": "JP",
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
POST /api/v1/studios HTTP/1.1
Host: app.nexus-anime.com
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "slug": "mappa",
  "name": "MAPPA",
  "name_jp": "株式会社MAPPA",
  "description": "Founded by Masao Maruyama; known for ambitious, high-energy productions.",
  "logo_url": "https://cdn.nexus-anime.com/studios/mappa.png",
  "website_url": "https://www.mappa.co.jp/",
  "founded_year": 2011,
  "country": "JP",
  "sort_order": 6
}
```

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "data": {
    "slug": "mappa",
    "name": "MAPPA",
    "name_jp": "株式会社MAPPA",
    "description": "Founded by Masao Maruyama; known for ambitious, high-energy productions.",
    "logo_url": "https://cdn.nexus-anime.com/studios/mappa.png",
    "website_url": "https://www.mappa.co.jp/",
    "founded_year": 2011,
    "country": "JP",
    "sort_order": 6,
    "is_active": true,
    "created_at": "2026-06-26T10:30:00Z",
    "updated_at": "2026-06-26T10:30:00Z",
    "deleted_at": null
  }
}
```

### 5.4 Admin update

```http
PATCH /api/v1/studios/mappa HTTP/1.1
Host: app.nexus-anime.com
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "description": "Studio founded by Masao Maruyama in 2011.",
  "logo_url": "https://cdn.nexus-anime.com/studios/mappa-v2.png"
}
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": {
    "slug": "mappa",
    "name": "MAPPA",
    "name_jp": "株式会社MAPPA",
    "description": "Studio founded by Masao Maruyama in 2011.",
    "logo_url": "https://cdn.nexus-anime.com/studios/mappa-v2.png",
    "website_url": "https://www.mappa.co.jp/",
    "founded_year": 2011,
    "country": "JP",
    "sort_order": 6,
    "is_active": true,
    "created_at": "2026-06-26T10:30:00Z",
    "updated_at": "2026-06-26T10:35:00Z",
    "deleted_at": null
  }
}
```

### 5.5 Admin soft-delete (extraordinary only)

```http
DELETE /api/v1/studios/mappa HTTP/1.1
Host: app.nexus-anime.com
Authorization: Bearer <admin_token>
```

```http
HTTP/1.1 204 No Content
```

---

## 6. Error responses

All endpoints in this document use the standard error envelope defined in [Error-Codes.md](./Error-Codes.md). Common codes for this resource:

| HTTP | `code`                   | Condition                                  |
| :--- | :----------------------- | :----------------------------------------- |
| 400  | `VALIDATION_ERROR`       | Zod rejected the request body              |
| 401  | `UNAUTHENTICATED`        | Missing or expired session                 |
| 403  | `FORBIDDEN`              | Non-admin attempted a mutation             |
| 404  | `RESOURCE_NOT_FOUND`     | Slug does not match an active studio       |
| 409  | `DUPLICATE_RESOURCE`     | Slug or name collides with an active row   |

---

## 7. Cross-references

| Concern                   | Document                                             |
| :------------------------ | :--------------------------------------------------- |
| Authoritative schema      | [Studio.md](../07-database/Studio.md)                |
| Cache key schema          | [API-Standards.md](./API-Standards.md)               |
| Error code registry       | [Error-Codes.md](./Error-Codes.md)                   |
| Pagination contract       | [Pagination.md](./Pagination.md)                     |
| Rate-limit quotas         | [Rate-Limiting.md](./Rate-Limiting.md)              |
| Anime ↔ Studio join       | [Anime.md](./Anime.md) section on sub-resources      |
