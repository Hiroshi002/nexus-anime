# Watch History

> **Authoritative endpoint reference** for the `/api/v1/users/me/watch-history` resource. Covers the append-only watch-event log — the source of truth for "Recently Watched", view counts, and the input that derives `continue_watching` state.
>
> Ownership: **Lead API Architect**. Last reviewed: 2026-06-26.

---

## 1. Purpose

`watch_history` records **every episode-level watch event** a user produces. It is:

- **Append-only** — rows are inserted once, never updated.
- **High-write** — the single highest-write table in the system; optimize for insert throughput and time-scoped reads.
- **Personal + analytics** — powers the user's "Recently Watched" feed and the platform's aggregate view counts, popularity scoring, and (future) recommendations.

It powers:

- **Recently Watched feed** — a cursor-paginated, reverse-chronological list of the user's watch events.
- **Episode view counts** — denominator for popularity ranking.
- **Continue Watching derivation** — the latest event per `(user_id, anime_id)` is the source for `continue_watching` (see `Continue-Watching.md`).
- **GDPR erasure** — on account deletion, rows are anonymized, never hard-deleted (see [Section 5](#5-on-account-deletion-anonymize-don't-delete)).

---

## 2. Schema

Authoritative column definitions, constraints, and indexes live in `docs/07-database/Watch-History.md`. Below is a summary for request/response contract clarity.

### 2.1 Read shape (response)

```ts
WatchHistoryEntry: {
  id!: string;                       // uuid — surrogate key
  user_id!: string;                  // uuid — FK to users (null after anonymization)
  anime_id!: string;                 // uuid — FK to anime (denormalized)
  episode_id!: string;               // uuid — FK to episodes
  watched_at!: string;               // ISO-8601 timestamptz — client-reported watch time
  watch_duration_seconds!: number;   // integer ≥ 0
  completion_pct!: number;           // numeric(5,2), 0–100
  device!: string | null;            // "mobile" | "tablet" | "desktop" | "tv" | null
  os!: string | null;             // e.g. "iOS", "Android", "Windows" — analytics
  browser!: string | null;          // e.g. "Chrome", "Safari" — analytics
  country!: string | null;          // ISO alpha-2, e.g. "US" — analytics
  app_version!: string | null;      // client build version — debugging
  created_at!: string;               // ISO-8601 timestamptz — server insert time
}
```

### 2.2 Write shape (POST request body)

```ts
WatchHistoryWrite: {
  anime_id!: string;                 // uuid — must exist in anime
  episode_id!: string;               // uuid — must belong to anime_id
  watched_at?: string;               // ISO-8601 — defaults to server now() if omitted
  watch_duration_seconds!: number;   // ≥ 0
  completion_pct!: number;           // 0–100
  device?: string;                   // "mobile" | "tablet" | "desktop" | "tv"
  os?: string;
  browser?: string;
  country?: string;                  // ISO alpha-2
  app_version?: string;
  event_id?: string;                 // uuid — client-supplied idempotency key
}
```

### 2.3 Constraints (summary)

- `completion_pct` must be between `0` and `100`.
- `watch_duration_seconds` must be `>= 0`.
- `device` must be one of `mobile`, `tablet`, `desktop`, `tv` if provided.
- `country` must match `^[A-Z]{2}$` if provided.
- `event_id`, when provided, creates a unique dedupe key — duplicate inserts are no-ops (see [Section 4](#4-append-only-no-updated_at-no-version)).

---

## 3. Endpoints

All endpoints require an authenticated session. Unauthenticated requests receive `401 Unauthorized`.

### 3.1 List watch history

```
GET /api/v1/users/me/watch-history
```

Returns the authenticated user's watch history, ordered by `watched_at` descending (most recently watched first).

**Query parameters:**

| Parameter    | Type    | Default    | Description                                          |
| ------------ | ------- | ---------- | ---------------------------------------------------- |
| `cursor`     | string  | —          | Cursor for pagination (see `Pagination.md`)          |
| `limit`      | integer | 20         | Items per page (1–100)                               |
| `anime_id`   | string  | —          | Filter to a specific anime                            |
| `from`       | string  | —          | Inclusive lower bound on `watched_at` (ISO-8601)    |
| `to`         | string  | —          | Inclusive upper bound on `watched_at` (ISO-8601)    |

**Response `200`:**

```json
{
  "data": [
    {
      "id": "wh_abc123def456",
      "user_id": "usr_abc123",
      "anime_id": "ani_abc123",
      "anime_title": "Solo Leveling",
      "episode_id": "epi_def456",
      "episode_number": 8,
      "episode_title": "This Is My Power",
      "watched_at": "2026-06-26T03:14:22Z",
      "watch_duration_seconds": 1380,
      "completion_pct": 95.83,
      "device": "web",
      "os": "Windows",
      "browser": "Chrome",
      "country": "US",
      "app_version": "1.4.2",
      "created_at": "2026-06-26T03:14:25Z"
    }
  ],
  "pagination": {
    "next_cursor": "eyJ3YXRjaGVkX2F0IjoiMjAyNi0wNi0yNlQwMzoxNDoyMloiCI6IndoX2FiYzEyM2RlZjQ1NiJ9",
    "has_more": true
  }
}
```

**Response `400`:** invalid query param.

**Response `401`:** unauthenticated.

### 3.2 Record a watch event

```
POST /api/v1/users/me/watch-history
```

Appends a new watch event. **Idempotent** — if `event_id` is supplied and already exists, the existing row is returned with `200` and no duplicate is created.

Called by the client after watching an episode (or once per session for long episodes), not on every heartbeat. See `Continue-Watching.md` for heartbeat/position tracking.

**Request body:**

```json
{
  "anime_id": "ani_abc123",
  "episode_id": "epi_def456",
  "watched_at": "2026-06-26T03:14:22Z",
  "watch_duration_seconds": 1380,
  "completion_pct": 95.83,
  "device": "web",
  "os": "Windows",
  "browser": "Chrome",
  "country": "US",
  "app_version": "1.4.2",
  "event_id": "evt_uuid_from_client"
}
```

| Field                    | Type   | Required | Validation                                      |
| ------------------------ | ------ | -------- | ----------------------------------------------- |
| `anime_id`               | string | yes      | Valid uuid, must exist in `anime` table         |
| `episode_id`             | string | yes      | Valid uuid, must belong to `anime_id`           |
| `watched_at`             | string | no       | ISO-8601; defaults to server `now()`            |
| `watch_duration_seconds` | number | yes      | ≥ 0                                             |
| `completion_pct`         | number | yes      | 0–100                                           |
| `device`                 | string | no       | One of `"mobile"`, `"tablet"`, `"desktop"`, `"tv"` |
| `os`                     | string | no       | —                                               |
| `browser`                | string | no       | —                                               |
| `country`                | string | no       | ISO alpha-2                                     |
| `app_version`            | string | no       | —                                               |
| `event_id`               | string | no       | Client-supplied uuid for idempotency           |

`user_id` is always the authenticated session user — never client-supplied.

**Response `201`:** created.

```json
{
  "data": {
    "id": "wh_abc123def456",
    "user_id": "usr_abc123",
    "anime_id": "ani_abc123",
    "episode_id": "epi_def456",
    "watched_at": "2026-06-26T03:14:22Z",
    "watch_duration_seconds": 1380,
    "completion_pct": 95.83,
    "device": "web",
    "os": "Windows",
    "browser": "Chrome",
    "country": "US",
    "app_version": "1.4.2",
    "created_at": "2026-06-26T03:14:25Z"
  }
}
```

**Response `200`:** idempotent replay (duplicate `event_id`). Shape is identical to `201`.

**Response `400`:** validation error.

```json
{
  "error": {
    "message": "watch_duration_seconds must be >= 0.",
    "code": "VALIDATION_ERROR",
    "details": { "field": "watch_duration_seconds" }
  }
}
```

**Response `401`:** unauthenticated.

**Response `404`:** `anime_id` or `episode_id` does not exist, or `episode_id` does not belong to `anime_id`.

### 3.3 Delete one entry

```
DELETE /api/v1/users/me/watch-history/{id}
```

Deletes a single watch-history entry. **Users may only delete their own rows.** Rows belonging to other users return `404` (no existence leak).

This **hard-deletes** the row. This is the *only* delete path that removes a row; anonymization on account deletion is a separate flow (see [Section 5](#5-on-account-deletion-anonymize-don't-delete)).

**Path parameter:** `id` — the watch-history entry uuid.

**Response `204`:** deleted. No body.

**Response `404`:** row does not exist or is not owned by the session user.

### 3.4 Bulk delete (GDPR right-to-erasure)

```
DELETE /api/v1/users/me/watch-history
```

**Anonymizes** (not deletes) all watch-history rows for the authenticated user. Implemented as a single bulk UPDATE inside a transaction.

This endpoint exists to satisfy **right-to-erasure** requests under GDPR / CCPA. It does **not** hard-delete rows — aggregate analytics are preserved. See [Section 5](#5-on-account-deletion-anonymize-don't-delete) and `docs/07-database/Data-Retention.md`.

**Query parameters:**

| Parameter   | Type    | Default | Description                               |
| ----------- | ------- | ------- | ----------------------------------------- |
| `confirm`   | boolean | —       | **Required.** Must be `true` to execute.  |

Without `confirm=true`, the endpoint returns `400` — defense against accidental invocation.

**Response `200`:**

```json
{
  "data": {
    "anonymized_count": 487
  }
}
```

**Response `400`:** missing or `confirm=false`.

```json
{
  "error": {
    "message": "Bulk anonymization requires confirm=true.",
    "code": "CONFIRMATION_REQUIRED",
    "details": null
  }
}
```

**Response `401`:** unauthenticated.

---

## 4. Append-only semantics

This table is **immutable-on-insert**. There is no `updated_at` column, no `version` column, and no in-place UPDATE on a single row (except anonymization on erasure).

- No optimistic concurrency — there is nothing to conflict on.
- No soft-delete (`deleted_at`) — hard-delete is GDPR-anonymization, not row removal.
- The only mutation is the bulk anonymization in [Section 5](#5-on-account-deletion-anonymize-don't-delete) and the row-level hard-delete in [Section 3.3](#33-delete-one-entry).

---

## 5. On account deletion: anonymize, don't delete

When a user invokes right-to-erasure (via `DELETE /api/v1/users/me/watch-history` or the broader account-erasure flow), the system:

1. Sets `user_id = NULL`.
2. Nulls out `device`, `os`, `browser`, `country`, `app_version`.
3. Retains `anime_id`, `episode_id`, `watched_at`, `watch_duration_seconds`, `completion_pct`, `created_at` for aggregate statistics.
4. Adds or sets an `is_anonymized boolean` flag so analytics queries can distinguish rows.

This preserves the statistical value of watch events (view counts, completion distributions, trending) while severing the link to the individual user.

Implement as a single transactional bulk UPDATE. Do **not** iterate row-by-row from application code.

See `docs/07-database/Data-Retention.md` for the rollup + raw-row purge flow.

---

## 6. Rate limit

| Scope          | Limit   | Window | Key                    |
| -------------- | ------- | ------ | ---------------------- |
| Per user       | 30      | 60 s   | `user_id`              |

POST (30/60 s) covers the common case of one event per completed episode, plus replays. Heavy clients (e.g., a sync importing history in bulk) should request a higher limit via a scoped API key. Exceeding the limit returns `429 Too Many Requests` with standard rate-limit headers (see `Rate-Limiting.md`).

GET is not rate-limited by this table's budget but is still subject to the global per-user rate limit.

---

## 7. Retention

| Phase       | Duration   | Action                                                  |
| ----------- | ---------- | ------------------------------------------------------- |
| Raw rows    | 90 days    | Kept as-is; served by GET / watch-history.              |
| Aggregated  | Indefinite | After 90 days, aggregated into daily rollups (anime_id, country, device, completion bucket). Raw rows are deleted by a partition-drop or batch-purge job. |
| Anonymized  | Indefinite | Anonymized rows (user_id = NULL) are never purged — they are already PII-free. |

Aggregation is **lossy by design**: the rollup keeps `COUNT`, `AVG(completion_pct)`, `AVG(watch_duration_seconds)`, and `device/country` distribution, but loses per-user detail. After 90 days, per-user history older than that window is no longer accessible through the API.

See `docs/07-database/Data-Retention.md` for the job specification.

---

## 8. Cache policy

| Header            | Value       |
| ----------------- | ----------- |
| `Cache-Control`   | `private, no-store` |
| `Pragma`          | `no-cache`  |

Watch history is user-specific and must never be served from a shared cache. Authenticated GET responses carry `private` to allow the browser to cache for the session (e.g., back-navigation), but `no-store` is acceptable if freshness is preferred — behavior is at the API route's discretion.

---

## 9. Examples

### Record a watch event

```bash
curl -X POST https://api.nexusanime.com/api/v1/users/me/watch-history \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "anime_id": "ani_abc123",
    "episode_id": "epi_def456",
    "watched_at": "2026-06-26T03:14:22Z",
    "watch_duration_seconds": 1380,
    "completion_pct": 95.83,
    "device": "web",
    "os": "Windows",
    "browser": "Chrome",
    "country": "US",
    "app_version": "1.4.2",
    "event_id": "evt_12345678-1234-1234-1234-123456789012"
  }'
```

### Idempotent replay

Submitting the same `event_id` a second time returns `200` with the original row — no duplicate is created.

```bash
curl -X POST https://api.nexusanime.com/api/v1/users/me/watch-history \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "anime_id": "ani_abc123",
    "episode_id": "epi_def456",
    "watched_at": "2026-06-26T03:14:22Z",
    "watch_duration_seconds": 1380,
    "completion_pct": 95.83,
    "device": "web",
    "event_id": "evt_12345678-1234-1234-1234-123456789012"
  }'
```

### List most recent 20

```bash
curl "https://api.nexusanime.com/api/v1/users/me/watch-history?limit=20" \
  -H "Authorization: Bearer <token>"
```

### List filtered by anime, scoped by date range

```bash
curl "https://api.nexusanime.com/api/v1/users/me/watch-history?anime_id=ani_abc123&from=2026-06-01T00:00:00Z&to=2026-06-30T23:59:59Z&limit=100" \
  -H "Authorization: Bearer <token>"
```

### Delete one entry

```bash
curl -X DELETE "https://api.nexusanime.com/api/v1/users/me/watch-history/wh_abc123def456" \
  -H "Authorization: Bearer <token>"
```

### Bulk anonymization (GDPR)

```bash
curl -X DELETE "https://api.nexusanime.com/api/v1/users/me/watch-history?confirm=true" \
  -H "Authorization: Bearer <token>"
```

Response:

```json
{
  "data": {
    "anonymized_count": 487
  }
}
```
