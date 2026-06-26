# Watch History

> **Step 7 — Database Design**
> Defines the `watch_history` table — an append-only log of every watch event.

---

## 1. Purpose

`watch_history` records **every time a user watches an episode**. It is the foundation of:

- "Continue Watching" (derived — see `Continue-Watching.md`).
- "Recently Watched" user feeds.
- View counts and popularity scoring.
- Personalized recommendations (future).

**Design principle:** This table is **append-only and enormous** — at 1M users it grows to **hundreds of millions of rows**. We optimize for **fast inserts** and **time-scoped reads**, never for updates or deletes (except anonymization on erasure). It is the single most important table for the indexing and retention strategies.

---

## 2. `watch_history` Table

### 2.1 Fields

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Surrogate key. |
| `user_id` | `uuid` | `NOT NULL` FK → `users.id` | Watcher. |
| `anime_id` | `uuid` | `NOT NULL` FK → `anime.id` | Show (denormalized for query simplicity). |
| `episode_id` | `uuid` | `NOT NULL` FK → `episodes.id` | Specific episode watched. |
| `watched_at` | `timestamptz` | `NOT NULL DEFAULT now()` | When the watch event occurred. |
| `watch_duration_seconds` | `integer` | `NOT NULL` | How many seconds the user actually watched. |
| `completion_pct` | `numeric(5,2)` | `NOT NULL` | Percentage of episode completed (0–100). |
| `device` | `text` | nullable | Device category: `'mobile'`, `'tablet'`, `'desktop'`, `'tv'`. |
| `os` | `text` | nullable | Operating system (analytics). |
| `browser` | `text` | nullable | Browser (analytics). |
| `country` | `text` | nullable | Geo country (ISO alpha-2) at watch time. |
| `app_version` | `text` | nullable | Client app version (debugging). |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Insert time (≈ `watched_at`, but explicit). |

### 2.2 Constraints

| Name | Type | Definition |
|------|------|------------|
| `chk_watch_history_completion` | check | `completion_pct BETWEEN 0 AND 100` |
| `chk_watch_history_watch_duration_positive` | check | `watch_duration_seconds >= 0` |
| `chk_watch_history_device_range` | check | `device IS NULL OR device IN ('mobile','tablet','desktop','tv')` |
| `chk_watch_history_country_format` | check | `country IS NULL OR country ~ '^[A-Z]{2}$'` |

### 2.3 Indexes

| Index | Type | Columns | Purpose |
|-------|------|---------|---------|
| `pk_watch_history` | btree (unique) | `id` | PK. |
| `idx_watch_history_user_watched_at` | btree | `(user_id, watched_at DESC)` | "Recently Watched" feed (cursor-paginated). |
| `idx_watch_history_user_anime` | btree | `(user_id, anime_id, watched_at DESC)` | "Have I seen this show?" + per-show history. |
| `idx_watch_history_episode_id` | btree | `episode_id` | Per-episode stats (admin). |
| `idx_watch_history_anime_id_watched_at` | btree | `(anime_id, watched_at DESC)` | Recent activity on a show (admin). |
| `idx_watch_history_watched_at` | btree | `watched_at` | Retention/partition pruning scans. |

### 2.4 Decisions & Rationale

- **Append-only, no `updated_at`:** A watch event is immutable once recorded. There is no `updated_at` because we never update these rows. This simplifies the write path and avoids row-level lock contention.
- **No `deleted_at`:** We never soft-delete watch events. On user erasure (GDPR), we **anonymize** — null out `user_id` (replacing with a sentinel or NULL with a separate `is_anonymized` flag) while keeping the row for aggregate stats. See `Data-Retention.md`.
- **Denormalized `anime_id`:** Almost every query joins "user's watched episodes" with the show. Storing `anime_id` avoids a join to `episodes` for the common case. The episode's `anime_id` is the source of truth; this is a query-time cache.
- **`watched_at` vs `created_at`:** `watched_at` is the client-reported time (when the user actually watched); `created_at` is the server insert time. They usually match, but clock skew and offline buffering can separate them. Both are useful.
- **`completion_pct` as `numeric(5,2)`:** Allows fractional percentages (e.g. 99.5%) for precise "completed" detection. `numeric` avoids float rounding.
- **`device`/`os`/`browser`/`country` nullable:** Analytics fields are best-effort. A row is valid even if these are unknown — we don't reject a watch event because the client didn't report its OS.
- **No `version` column:** Append-only rows are never mutated, so optimistic concurrency is irrelevant.

### 2.5 Volume & Growth

This is the **largest table** in the system. At 1M active users × ~500 watch events/year ≈ **500M rows/year**. This drives three architectural decisions:

1. **Partitioning by `watched_at`** (range, monthly) — see `Migration-Strategy.md`. Old partitions are cheap to drop or archive.
2. **Short retention for raw rows** — raw events older than N months are aggregated into daily rollups and the raw rows are purged (see `Data-Retention.md`).
3. **No secondary indexes beyond the query paths** — every index slows inserts. The six indexes above cover all known access patterns.

### 2.6 Anonymization on Erasure

When a user invokes right-to-erasure:

1. Set `user_id = NULL` and add an `is_anonymized boolean` column (or use a sentinel `00000000-0000-0000-0000-000000000000`).
2. Null out `device`, `os`, `browser`, `country`, `app_version` (they're PII-adjacent).
3. Keep `anime_id`, `episode_id`, `watched_at`, `watch_duration_seconds`, `completion_pct` for aggregate analytics.

This preserves the statistical value of the watch event while severing the link to the person.

### 2.7 Relationship Recap

- `users` 1 — * `watch_history` (one-to-many; anonymizable).
- `anime` 1 — * `watch_history` (one-to-many; denormalized).
- `episodes` 1 — * `watch_history` (one-to-many).
- `watch_history` is the **input** to `continue_watching` (see `Continue-Watching.md`) — a materialized cursor derived from the latest watch event per (user, anime).
