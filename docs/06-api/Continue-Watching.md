# Continue Watching

> **Authoritative endpoint reference** for the `/api/v1/users/me/continue-watching` resource. Covers the playback-cursor read/write surface powering the "Continue Watching" row and in-player heartbeats.
>
> Ownership: **Lead API Architect**. Last reviewed: 2026-06-26.

---

## 1. Purpose

The Continue Watching resource tracks the **playback cursor** for each user-anime pair. It is:

- **Per-user, per-anime** — one row per `(user_id, anime_id)`, regardless of how many episodes exist.
- **Mutable and high-write** — updated every ~30 s while a video is playing (heartbeat).
- **Real-time** — never cached; the client must always see the latest position.
- **Idempotent** — a heartbeat on the same `(user_id, anime_id)` overwrites the previous row; no duplicates.

It powers:

- **Continue Watching row** — the home-page carousel showing in-progress anime with a progress bar.
- **Resume playback** — jumping directly to the last-watched position and episode.
- **Completion tracking** — marking an anime as finished when the final episode reaches ≥95 % progress.

---

## 2. Schema

Authoritative column definitions, constraints, and indexes live in `docs/07-database/Continue-Watching.md`. Below is a summary for request/response contract clarity.

```ts
ContinueWatching: {
  user_id!: string;            // uuid — FK to users
  anime_id!: string;           // uuid — FK to anime
  episode_id!: string;         // uuid — FK to episodes — the last-watched episode
  position_seconds!: number;   // float — playback offset within the episode (≥ 0)
  duration_seconds!: number;   // float — total duration of the episode at time of heartbeat
  progress_pct!: number;       // float — (position_seconds / duration_seconds) * 100, 0–100
  device!: string;             // enum: "web" | "ios" | "android" | "tv" — which device sent the heartbeat
  is_completed!: boolean;      // true once user finishes the anime (or ≥95 % on final episode)
  version!: number;            // integer — optimistic concurrency token, incremented on every write
  updated_at!: string;         // ISO-8601 timestamptz — last heartbeat or completion mark
}
```

**Unique constraint:** `(user_id, anime_id)` — one cursor per anime per user. Upsert semantics on POST.

**Optimistic concurrency:** `version` is incremented on every write. Clients must send the current `version` on PATCH; a mismatch returns `409 Conflict`.

---

## 3. Endpoints

All endpoints require an authenticated session. Unauthenticated requests receive `401 Unauthorized`.

### 3.1 List in-progress items

```
GET /api/v1/users/me/continue-watching
```

Returns the authenticated user's continue-watching entries, ordered by `updated_at` descending (most recently watched first).

**Query parameters:**

| Parameter      | Type    | Default | Description                                            |
| -------------- | ------- | ------- | ------------------------------------------------------ |
| `cursor`       | string  | —       | Cursor for pagination (see `Pagination.md`)            |
| `limit`        | integer | 20      | Items per page (1–100)                                 |
| `is_completed` | boolean | `false` | Filter: `false` = in-progress only, `true` = completed |

**Response `200`:**

```json
{
  "data": [
    {
      "anime_id": "ani_abc123",
      "anime_title": "Solo Leveling",
      "anime_poster_url": "https://...",
      "episode_id": "epi_def456",
      "episode_number": 8,
      "episode_title": "This Is My Power",
      "position_seconds": 842.5,
      "duration_seconds": 1440.0,
      "progress_pct": 58.51,
      "device": "web",
      "is_completed": false,
      "version": 14,
      "updated_at": "2026-06-26T03:14:22Z"
    }
  ],
  "pagination": {
    "next_cursor": "eyJ1cGRhdGVkX2F0IjoiMjAyNi0wNi0yNlQwMzoxNDoyMloifQ==",
    "has_more": true
  }
}
```

### 3.2 Get single item

```
GET /api/v1/users/me/continue-watching/{animeId}
```

Returns the continue-watching cursor for a specific anime.

**Response `200`:**

```json
{
  "data": {
    "anime_id": "ani_abc123",
    "anime_title": "Solo Leveling",
    "anime_poster_url": "https://...",
    "episode_id": "epi_def456",
    "episode_number": 8,
    "episode_title": "This Is My Power",
    "position_seconds": 842.5,
    "duration_seconds": 1440.0,
    "progress_pct": 58.51,
    "device": "web",
    "is_completed": false,
    "version": 14,
    "updated_at": "2026-06-26T03:14:22Z"
  }
}
```

**Response `404`:** — no cursor exists for this anime.

```json
{
  "error": {
    "message": "No continue-watching entry for this anime.",
    "code": "CONTINUE_WATCHING_NOT_FOUND",
    "details": null
  }
}
```

### 3.3 Upsert cursor

```
POST /api/v1/users/me/continue-watching
```

Creates or replaces the continue-watching cursor for an anime. Used when the user starts watching a new anime or switches episodes within the same anime.

Idempotent per `(user_id, anime_id)` — posting the same anime replaces the row.

**Request body:**

```json
{
  "anime_id": "ani_abc123",
  "episode_id": "epi_def456",
  "position_seconds": 0,
  "duration_seconds": 1440.0,
  "device": "web"
}
```

| Field              | Type   | Required | Validation                                   |
| ------------------ | ------ | -------- | -------------------------------------------- |
| `anime_id`         | string | yes      | Valid uuid, must exist in `anime` table      |
| `episode_id`       | string | yes      | Valid uuid, must belong to `anime_id`        |
| `position_seconds` | number | yes      | ≥ 0, ≤ `duration_seconds`                    |
| `duration_seconds` | number | yes      | > 0                                          |
| `device`           | string | yes      | One of `"web"`, `"ios"`, `"android"`, `"tv"` |

`progress_pct` is computed server-side. `is_completed` is set to `true` if the episode is the final episode and `progress_pct` ≥ 95. `version` starts at 1 on insert, or increments on replace.

**Response `200`:** (upserted, returning the full row)

```json
{
  "data": {
    "anime_id": "ani_abc123",
    "episode_id": "epi_def456",
    "position_seconds": 0,
    "duration_seconds": 1440.0,
    "progress_pct": 0,
    "device": "web",
    "is_completed": false,
    "version": 1,
    "updated_at": "2026-06-26T03:14:22Z"
  }
}
```

**Response `400`:** — validation failure.

```json
{
  "error": {
    "message": "position_seconds must be ≥ 0 and ≤ duration_seconds.",
    "code": "VALIDATION_ERROR",
    "details": { "field": "position_seconds", "value": -5 }
  }
}
```

### 3.4 Update position (heartbeat)

```
PATCH /api/v1/users/me/continue-watching/{animeId}
```

Updates the playback position for an existing cursor. Called by the video player every ~30 s while playing.

Optimistic concurrency: must include `version`. If the server's `version` does not match, returns `409 Conflict`.

**Request body:**

```json
{
  "episode_id": "epi_def456",
  "position_seconds": 842.5,
  "duration_seconds": 1440.0,
  "device": "web",
  "version": 14
}
```

| Field              | Type   | Required | Validation                                   |
| ------------------ | ------ | -------- | -------------------------------------------- |
| `episode_id`       | string | no       | If provided, must belong to `animeId`        |
| `position_seconds` | number | yes      | ≥ 0, ≤ `duration_seconds`                    |
| `duration_seconds` | number | yes      | > 0                                          |
| `device`           | string | no       | One of `"web"`, `"ios"`, `"android"`, `"tv"` |
| `version`          | number | yes      | Must match current row `version`             |

If `episode_id` is omitted, only `position_seconds` is updated on the existing episode.

**Response `200`:**

```json
{
  "data": {
    "anime_id": "ani_abc123",
    "episode_id": "epi_def456",
    "position_seconds": 842.5,
    "duration_seconds": 1440.0,
    "progress_pct": 58.51,
    "device": "web",
    "is_completed": false,
    "version": 15,
    "updated_at": "2026-06-26T03:14:52Z"
  }
}
```

**Response `409`:** — version mismatch.

```json
{
  "error": {
    "message": "Optimistic concurrency conflict. Fetch the latest version and retry.",
    "code": "VERSION_CONFLICT",
    "details": { "expected_version": 14, "current_version": 16 }
  }
}
```

**Response `404`:** — no cursor exists for this anime. Use POST to create one.

### 3.5 Mark completed / remove

```
DELETE /api/v1/users/me/continue-watching/{animeId}
```

Two modes, controlled by the `mode` query parameter:

| Mode     | Query           | Behavior                                                               |
| -------- | --------------- | ---------------------------------------------------------------------- |
| Complete | `mode=complete` | Sets `is_completed = true`, `progress_pct = 100`, increments `version` |
| Remove   | `mode=remove`   | Hard-deletes the row                                                   |

Default: `mode=complete`.

**Response `200`** (complete mode):

```json
{
  "data": {
    "anime_id": "ani_abc123",
    "episode_id": "epi_def456",
    "position_seconds": 1440.0,
    "duration_seconds": 1440.0,
    "progress_pct": 100,
    "device": "web",
    "is_completed": true,
    "version": 16,
    "updated_at": "2026-06-26T03:15:00Z"
  }
}
```

**Response `204`** (remove mode): no body.

**Response `404`:** — no cursor exists for this anime.

---

## 4. Heartbeat semantics

The video player emits a heartbeat (PATCH) every **30 seconds** while actively playing.

| Property        | Value                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------- |
| Interval        | 30 s while playing                                                                             |
| Endpoint        | `PATCH /api/v1/users/me/continue-watching/{animeId}`                                           |
| Idempotency     | Overwrites the same `(user_id, anime_id)` row — no duplicates                                  |
| Resume behavior | On player mount, GET the cursor to seek to `position_seconds`                                  |
| Pause           | Send one final heartbeat on pause, then stop                                                   |
| Seek            | Send a heartbeat immediately after a seek event                                                |
| Episode switch  | POST to upsert with the new `episode_id` and `position_seconds = 0`                            |
| Completion      | When `progress_pct` ≥ 95 on the final episode, server sets `is_completed = true` automatically |

The heartbeat does **not** create a row if one does not exist. The player must POST once when playback begins to create the cursor, then PATCH on each subsequent heartbeat.

---

## 5. Cache policy

**No cache.** Continue-watching data is real-time and user-specific.

| Header          | Value      |
| --------------- | ---------- |
| `Cache-Control` | `no-store` |
| `Pragma`        | `no-cache` |

CDN edge nodes must not cache or serve stale continue-watching data. Every request hits the database.

---

## 6. Rate limit

| Scope    | Limit | Window | Key       |
| -------- | ----- | ------ | --------- |
| Per user | 30    | 60 s   | `user_id` |

Exceeding the limit returns `429 Too Many Requests` with standard rate-limit headers (see `Rate-Limiting.md`).

At one heartbeat every 30 s, a single player emits 2 requests per minute — well within the 30/60 s budget. The headroom accommodates rapid episode switching and initial page loads.

---

## 7. Examples

### Start watching a new anime

```bash
curl -X POST https://api.nexusanime.com/api/v1/users/me/continue-watching \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "anime_id": "ani_abc123",
    "episode_id": "epi_def456",
    "position_seconds": 0,
    "duration_seconds": 1440.0,
    "device": "web"
  }'
```

### Heartbeat at 14:02 into the episode

```bash
curl -X PATCH https://api.nexusanime.com/api/v1/users/me/continue-watching/ani_abc123 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "position_seconds": 842.5,
    "duration_seconds": 1440.0,
    "device": "web",
    "version": 14
  }'
```

### Fetch the continue-watching row for the home page

```bash
curl https://api.nexusanime.com/api/v1/users/me/continue-watching?limit=10 \
  -H "Authorization: Bearer <token>"
```

### Include completed anime

```bash
curl https://api.nexusanime.com/api/v1/users/me/continue-watching?is_completed=true&limit=50 \
  -H "Authorization: Bearer <token>"
```

### Mark an anime as completed

```bash
curl -X DELETE "https://api.nexusanime.com/api/v1/users/me/continue-watching/ani_abc123?mode=complete" \
  -H "Authorization: Bearer <token>"
```

### Remove an anime from continue-watching entirely

```bash
curl -X DELETE "https://api.nexusanime.com/api/v1/users/me/continue-watching/ani_abc123?mode=remove" \
  -H "Authorization: Bearer <token>"
```
