# Uploads

> **Authoritative endpoint reference** for the `/api/v1/uploads` resource. Covers media uploads (avatar, poster, cover, video) and presigned-URL direct uploads to Cloudflare R2.

> Ownership: **Lead API Architect**. Last reviewed: 2026-06-26.

---

## 1. Purpose

The Uploads resource handles **media ingestion** for the platform:

- **Avatar** — user profile picture.
- **Poster / Cover** — anime catalog artwork.
- **Video** — episode playback files ingested into Cloudflare Stream.

There is **no standalone `uploads` table**. Media is stored as URLs on existing rows (`avatar_url` on `users`, `poster_url` / `cover_url` on `anime`) or as opaque asset IDs (`video_asset_id` on `episodes`). The upload endpoints are a write-through layer that validates, scans, stores, and returns the resulting URL or ID — the caller is responsible for persisting the returned value to the owning row.

---

## 2. Storage backends

| Media type | Backend              | Container / bucket        | Notes                              |
| :--------- | :------------------- | :------------------------ | :--------------------------------- |
| Avatar     | Cloudflare R2        | `nexus-avatars`           | Public read, PNG / JPEG / WebP     |
| Poster     | Cloudflare R2        | `nexus-posters`           | Public read, PNG / JPEG / WebP     |
| Cover      | Cloudflare R2        | `nexus-covers`            | Public read, PNG / JPEG / WebP     |
| Video      | Cloudflare Stream    | —                         | Returns `video_asset_id` for player |

R2 buckets are fronted by a CDN with a long TTL on immutable keys. Stream assets use signed-URL playback with a 5-minute expiry (see `docs/auth.md` section on signed URLs).

---

## 3. File validation

All upload endpoints enforce the same validation pipeline. Validation short-circuits in the order listed — the first failure wins.

### 3.1 Pipeline order

1. **MIME type** — must match the endpoint's allowlist.
2. **File size** — must not exceed the endpoint's cap.
3. **Image dimensions** — checked only on image uploads.
4. **Virus scan** — ClamAV (M5+); skipped in M3–M4 with a TODO marker.

### 3.2 Per-endpoint constraints

| Endpoint                         | MIME allowlist                              | Max size | Max dimensions (px) |
| :------------------------------- | :------------------------------------------ | :------- | :------------------ |
| `POST /uploads/avatar`             | `image/png`, `image/jpeg`, `image/webp`     | 5 MB     | 2048 × 2048         |
| `POST /uploads/poster`            | `image/png`, `image/jpeg`, `image/webp`     | 10 MB    | 4096 × 6000         |
| `POST /uploads/cover`             | `image/png`, `image/jpeg`, `image/webp`     | 10 MB    | 4096 × 6000         |
| `POST /uploads/video`             | `video/mp4`, `video/webm`, `video/quicktime` | 2 GB     | —                   |

### 3.3 Error codes

| Condition                     | `error.code`          | HTTP |
| :---------------------------- | :-------------------- | :--- |
| MIME not in allowlist         | `INVALID_MEDIA_TYPE`  | 413  |
| File exceeds max size         | `MEDIA_TOO_LARGE`     | 413  |
| Image exceeds max dimensions  | `MEDIA_TOO_LARGE`     | 413  |
| Virus scan positive          | `MEDIA_REJECTED`      | 422  |
| Scan unavailable (M5+ only)   | `INTERNAL`            | 500  |

`INVALID_MEDIA_TYPE` and `MEDIA_TOO_LARGE` both return HTTP 413 for consistency with the existing error-code registry. The `details` field includes `{ field, allowed, received }` for type errors and `{ field, maxBytes, receivedBytes }` for size errors.

---

## 4. Rate limit

Upload endpoints share a single rate-limit rule:

| Rule   | Limit | Window | Scope        |
| :----- | :---- | :----- | :----------- |
| Upload | 5     | 300 s  | Per user ID  |

Unauthenticated callers (only relevant for the avatar endpoint, which requires auth — so this is a no-op in practice) fall back to per-IP scoping. See `Rate-Limiting.md` for the token-bucket algorithm and header semantics.

The rule name is `uploads`. The bucket key is `nexus:ratelimit:uploads:{actor}` where `actor` is `user:{sub}` or `ip:{addr}`.

---

## 5. Authentication & authorization

| Endpoint                         | Auth required | Role     |
| :------------------------------- | :------------ | :------- |
| `POST /uploads/avatar`             | Yes           | Any authenticated user |
| `POST /uploads/poster`            | Yes           | `admin`  |
| `POST /uploads/cover`             | Yes           | `admin`  |
| `POST /uploads/video`             | Yes           | `admin`  |
| `POST /uploads/presigned-url`     | Yes           | `admin`  |
| `GET /uploads/presigned-url/{token}` | No (webhook) | —        |

The presigned-URL confirmation endpoint is called by the R2 webhook infrastructure, not by the browser. It authenticates via a shared secret in the `x-r2-signature` header — not a user session.

---

## 6. Endpoints

### 6.1 `POST /api/v1/uploads/avatar`

Upload the authenticated user's avatar. Returns the public URL. The caller must persist the returned `url` to `users.avatar_url` via `PATCH /api/v1/users/me`.

**Request:**

- Content-Type: `multipart/form-data`
- Field: `file` (the image file)

**Response `200`:**

```json
{
  "data": {
    "url": "https://cdn.nexus-anime.app/avatars/usr_abc123.png",
    "width": 512,
    "height": 512,
    "bytes": 24576
  },
  "meta": { "requestId": "req_..." }
}
```

**Example:**

```bash
curl -X POST https://nexus-anime.app/api/v1/uploads/avatar \
  -H "Cookie: authjs-session=..." \
  -F "file=@avatar.png"
```

---

### 6.2 `POST /api/v1/uploads/poster`

Admin-only. Upload an anime poster image. Returns the public URL. The caller must persist the returned `url` to `anime.poster_url`.

**Request:**

- Content-Type: `multipart/form-data`
- Field: `file`

**Response `200`:**

```json
{
  "data": {
    "url": "https://cdn.nexus-anime.app/posters/12345.png",
    "width": 1080,
    "height": 1600,
    "bytes": 524288
  },
  "meta": { "requestId": "req_..." }
}
```

**Example:**

```bash
curl -X POST https://nexus-anime.app/api/v1/uploads/poster \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@poster.png"
```

---

### 6.3 `POST /api/v1/uploads/cover`

Admin-only. Upload an anime cover/banner image. Returns the public URL. The caller must persist the returned `url` to `anime.cover_url`.

**Request:**

- Content-Type: `multipart/form-data`
- Field: `file`

**Response `200`:**

```json
{
  "data": {
    "url": "https://cdn.nexus-anime.app/covers/12345.png",
    "width": 1920,
    "height": 1080,
    "bytes": 1048576
  },
  "meta": { "requestId": "req_..." }
}
```

**Example:**

```bash
curl -X POST https://nexus-anime.app/api/v1/uploads/cover \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@cover.png"
```

---

### 6.4 `POST /api/v1/uploads/video`

Admin-only. Upload a video file to Cloudflare Stream. Returns a `video_asset_id` that the caller must persist to `episodes.video_asset_id`.

**Request:**

- Content-Type: `multipart/form-data`
- Field: `file`

**Response `200`:**

```json
{
  "data": {
    "video_asset_id": "stream_abc123def456",
    "duration_seconds": 1420,
    "bytes": 157286400,
    "status": "ready"
  },
  "meta": { "requestId": "req_..." }
}
```

`status` is one of `processing`, `ready`, `failed`. Poll `GET /api/v1/uploads/video/{video_asset_id}` (admin only) to check processing status.

**Example:**

```bash
curl -X POST https://nexus-anime.app/api/v1/uploads/video \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@episode-01.mp4"
```

---

### 6.5 `POST /api/v1/uploads/presigned-url`

Admin-only. Issue a presigned R2 URL for direct browser upload. The browser PUTs the file directly to R2; the upload endpoint is bypassed for the actual bytes.

**Request (JSON body):**

```json
{
  "contentType": "image/png",
  "size": 524288,
  "filename": "poster.png"
}
```

| Field       | Type   | Required | Notes                                              |
| :---------- | :----- | :------- | :------------------------------------------------- |
| `contentType` | string | yes      | Must match the allowlist of the target endpoint.   |
| `size`        | number | yes      | Bytes. Must not exceed the target endpoint's cap.  |
| `filename`    | string | yes      | Original filename. Used as the R2 key prefix.     |

**Response `200`:**

```json
{
  "data": {
    "uploadUrl": "https://r2.cloudflarestorage.com/nexus-posters/...",
    "fields": { "key": "posters/abc123.png", "AWSAccessKeyId": "...", "policy": "...", "signature": "..." },
    "token": "upload_xyz789",
    "expiresAt": "2026-06-26T00:05:00Z"
  },
  "meta": { "requestId": "req_..." }
}
```

- `uploadUrl` — PUT the file here.
- `fields` — include as form fields in the PUT.
- `token` — pass to `GET /api/v1/uploads/presigned-url/{token}` after the PUT succeeds.
- `expiresAt` — presigned URL expires in **300 seconds**.

**Example:**

```bash
curl -X POST https://nexus-anime.app/api/v1/uploads/presigned-url \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contentType":"image/png","size":524288,"filename":"poster.png"}'
```

---

### 6.6 `GET /api/v1/uploads/presigned-url/{token}`

Confirm a direct-to-R2 upload is complete. Called by the R2 webhook after the browser PUT succeeds. Not intended for browser-side polling.

**Auth:** Shared secret in `x-r2-signature` header (not a user session).

**Response `200`:**

```json
{
  "data": {
    "token": "upload_xyz789",
    "status": "complete",
    "url": "https://cdn.nexus-anime.app/posters/abc123.png",
    "bytes": 524288
  },
  "meta": { "requestId": "req_..." }
}
```

`status` is one of `complete`, `expired`, `rejected`.

---

## 7. Key schema

R2 object keys follow a deterministic pattern so they are guessable only by an attacker who knows the bucket name and the UUID — and the buckets are not listed publicly.

| Bucket         | Key pattern                    |
| :------------- | :----------------------------- |
| `nexus-avatars` | `avatars/{userId}.{ext}`       |
| `nexus-posters` | `posters/{animeId}-{random}.{ext}` |
| `nexus-covers`  | `covers/{animeId}-{random}.{ext}`  |

`ext` is derived from the validated MIME type, never from the client-supplied filename. `random` is a `crypto.randomUUID()` suffix to prevent overwrites on retry.

---

## 8. Client upload flow (direct-to-R2)

For large files (poster, cover, video), the client should use the presigned-URL flow to avoid proxying bytes through the Next.js server:

```
1. Client → POST /api/v1/uploads/presigned-url { contentType, size, filename }
2. Server validates constraints, returns uploadUrl + fields + token (300s TTL)
3. Client → PUT uploadUrl (multipart/form-data with fields)
4. R2 webhook → GET /api/v1/uploads/presigned-url/{token} (server-to-server)
5. Server marks token complete, returns final URL
6. Client → PATCH /api/v1/users/me (or anime admin endpoint) with the returned URL
```

For avatars (small, 5 MB cap), the direct `POST /api/v1/uploads/avatar` multipart endpoint is simpler and preferred.

---

## 9. Error examples

**MIME type rejected:**

```json
{
  "error": {
    "message": "Unsupported media type",
    "code": "INVALID_MEDIA_TYPE",
    "details": { "field": "file", "allowed": ["image/png","image/jpeg","image/webp"], "received": "image/gif" }
  },
  "meta": { "requestId": "req_..." }
}
```

**File too large:**

```json
{
  "error": {
    "message": "File exceeds maximum allowed size",
    "code": "MEDIA_TOO_LARGE",
    "details": { "field": "file", "maxBytes": 5242880, "receivedBytes": 7340032 }
  },
  "meta": { "requestId": "req_..." }
}
```

**Rate limit exceeded:**

```json
{
  "error": {
    "message": "Rate limit exceeded, retry after 5 minutes",
    "code": "RATE_LIMITED",
    "details": { "rule": "uploads", "retryAfter": 247 }
  },
  "meta": { "requestId": "req_..." }
}
```

Response headers include `Retry-After` and the standard `X-RateLimit-*` headers per `Rate-Limiting.md`.

---

## 10. Changelog

| Date       | Change              | Ticket / PR |
| :--------- | :------------------ | :---------- |
| 2026-06-26 | Initial uploads spec | —           |
|            |                     |             |
|            |                     |             |
