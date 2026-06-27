# Continue Watching

> **Step 7 — Database Design**
> Defines the `continue_watching` table — mutable playback cursors for "pick up where you left off."

---

## 1. Purpose

`continue_watching` stores **one cursor per (user, anime)** — the episode and timestamp where a user last stopped watching. It powers the "Continue Watching" row on the home page, the most-engaged surface in the app.

**Design principle:** This is a **mutable, high-contention** table. Multiple devices (phone, TV, laptop) may update the same cursor concurrently. We optimize for **fast upserts** and **conflict-safe writes** using optimistic concurrency (`version`).

---

## 2. `continue_watching` Table

### 2.1 Fields

| Column             | Type           | Constraint                              | Description                                             |
| ------------------ | -------------- | --------------------------------------- | ------------------------------------------------------- |
| `id`               | `uuid`         | `PRIMARY KEY DEFAULT gen_random_uuid()` | Surrogate key.                                          |
| `user_id`          | `uuid`         | `NOT NULL` FK → `users.id`              | Owner.                                                  |
| `anime_id`         | `uuid`         | `NOT NULL` FK → `anime.id`              | Show.                                                   |
| `episode_id`       | `uuid`         | `NOT NULL` FK → `episodes.id`           | Episode to resume.                                      |
| `position_seconds` | `integer`      | `NOT NULL`                              | Playback position in seconds.                           |
| `duration_seconds` | `integer`      | `NOT NULL`                              | Total episode duration at write time (for progress %).  |
| `progress_pct`     | `numeric(5,2)` | `NOT NULL`                              | Derived completion percentage.                          |
| `device`           | `text`         | nullable                                | Device that last updated the cursor.                    |
| `is_completed`     | `boolean`      | `NOT NULL DEFAULT false`                | True when the episode is finished (cursor can advance). |
| `updated_at`       | `timestamptz`  | `NOT NULL DEFAULT now()`                | Last cursor update (frequently mutated).                |
| `created_at`       | `timestamptz`  | `NOT NULL DEFAULT now()`                | First cursor creation.                                  |
| `version`          | `integer`      | `NOT NULL DEFAULT 1`                    | Optimistic concurrency token.                           |

### 2.2 Constraints

| Name                              | Type           | Definition                                                         |
| --------------------------------- | -------------- | ------------------------------------------------------------------ |
| `uq_continue_watching_user_anime` | partial unique | `UNIQUE (user_id, anime_id) WHERE deleted_at IS NULL` — _see note_ |
| `chk_continue_position`           | check          | `position_seconds >= 0 AND position_seconds <= duration_seconds`   |
| `chk_continue_progress`           | check          | `progress_pct BETWEEN 0 AND 100`                                   |
| `chk_continue_device_range`       | check          | `device IS NULL OR device IN ('mobile','tablet','desktop','tv')`   |

> **Note on unique constraint:** This table has **no `deleted_at`** column. The unique constraint is a plain `UNIQUE (user_id, anime_id)` — there is exactly one cursor per user/show, always. See §2.4.

### 2.3 Indexes

| Index                                | Type           | Columns                      | Purpose                                            |
| ------------------------------------ | -------------- | ---------------------------- | -------------------------------------------------- |
| `pk_continue_watching`               | btree (unique) | `id`                         | PK.                                                |
| `idx_continue_watching_user_updated` | btree          | `(user_id, updated_at DESC)` | "Continue Watching" home feed (most recent first). |
| `idx_continue_watching_user_anime`   | btree (unique) | `(user_id, anime_id)`        | Upsert target / "what's my cursor for this show?". |
| `idx_continue_watching_episode_id`   | btree          | `episode_id`                 | Cleanup when an episode is soft-deleted.           |

### 2.4 Decisions & Rationale

- **One row per (user, anime), not per episode:** A user resumes a _show_, not an episode. The cursor points to the latest episode they were watching. This keeps the table small (~10M rows at 1M users × 10 active shows) and the home feed query simple.
- **No `deleted_at`:** The cursor is either present or absent. If a user watches nothing, there's no row. If they finish a show, the row stays (it's their "completed" marker) until they start something else. We don't soft-delete cursors — we overwrite them.
- **`version` for optimistic concurrency:** Two devices updating the same cursor simultaneously is the norm, not an edge case. The write path is:
  1. Read current `version`.
  2. `UPDATE … SET position_seconds = :pos, version = version + 1 WHERE id = :id AND version = :v`.
  3. If 0 rows affected → conflict → re-read and retry (or discard the stale update).
     This avoids `SELECT … FOR UPDATE` locks that would serialize playback heartbeats across devices.
- **`duration_seconds` stored at write time:** Episode duration is immutable, but storing it here lets us compute `progress_pct` without joining to `episodes` on every read. It's a snapshot, not a live reference.
- **`is_completed` flag:** When a user finishes an episode, we mark it complete. The application then advances the cursor to the next episode on the next play. This flag also powers "completed shows" filtering.
- **`updated_at` is the sort key:** The "Continue Watching" feed is ordered by `updated_at DESC` — the show the user most recently touched appears first. This is more intuitive than sorting by anime title.
- **No `created_by`/`updated_by`:** Cursors are system-updated from playback events, not human-edited. The actor is implicit (the session user), and the `audit_log` is not written for every heartbeat (that would be wasteful).

### 2.5 Write Path (Application Contract)

The application updates `continue_watching` on these events:

| Event                           | Action                                                            |
| ------------------------------- | ----------------------------------------------------------------- |
| Playback heartbeat (every ~10s) | Upsert cursor with new `position_seconds`.                        |
| Episode finished                | Set `is_completed = true`, advance to next episode on next play.  |
| User switches show              | Upsert new row (or update existing) for the new show.             |
| Episode soft-deleted            | Clear `episode_id` reference (set to next valid episode or NULL). |

Heartbeats are **debounced** at the client (not more than one per 10 seconds per device) to avoid flooding the table.

### 2.6 Relationship Recap

- `users` 1 — \* `continue_watching` (one-to-many; one row per show).
- `anime` 1 — \* `continue_watching` (one-to-many).
- `episodes` 1 — \* `continue_watching` (one-to-many; the cursor's current episode).
- Derived from `watch_history` — the latest watch event per (user, anime) is the source of truth; `continue_watching` is a materialized cache for fast home-page reads.
