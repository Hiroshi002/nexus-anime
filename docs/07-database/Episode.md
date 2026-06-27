# Episode

> **Step 7 — Database Design**
> Defines the `episodes` table — the individual watchable units of a show.

---

## 1. Purpose

An `episode` is the smallest addressable piece of watchable content. Every playback event, continue-watching cursor, and watch-history row references an episode. Episodes are the **highest-volume catalog table** (millions of rows at scale) and the most frequently joined, so this schema is optimized for **read-heavy, append-only** access.

**Design principle:** Episodes are immutable once published. Edits (title corrections, duration fixes) are rare and use optimistic concurrency via `version`. We never delete an episode row — we soft-delete it so watch history stays valid.

---

## 2. `episodes` Table

### 2.1 Fields

| Column                   | Type            | Constraint                              | Description                                                          |
| ------------------------ | --------------- | --------------------------------------- | -------------------------------------------------------------------- |
| `id`                     | `uuid`          | `PRIMARY KEY DEFAULT gen_random_uuid()` | Surrogate key.                                                       |
| `anime_id`               | `uuid`          | `NOT NULL` FK → `anime.id`              | Parent show (denormalized for query simplicity).                     |
| `season_id`              | `uuid`          | nullable FK → `seasons.id`              | Owning season. `NULL` for flat (non-seasonal) shows.                 |
| `number`                 | `integer`       | `NOT NULL`                              | Sequential episode number within the show (1-based).                 |
| `number_explicit`        | `integer`       | nullable                                | Absolute episode number across all seasons (for multi-season shows). |
| `title`                  | `text`          | nullable                                | Episode title.                                                       |
| `synopsis`               | `text`          | nullable                                | Short description. Sanitized at render.                              |
| `duration_seconds`       | `integer`       | `NOT NULL`                              | Runtime in seconds.                                                  |
| `aired_at`               | `timestamptz`   | nullable                                | Original air date.                                                   |
| `thumbnail_url`          | `text`          | nullable                                | Preview thumbnail URL.                                               |
| `video_asset_id`         | `text`          | nullable                                | Cloudflare Stream asset id (or signed-URL key).                      |
| `video_duration_seconds` | `integer`       | nullable                                | Actual encoded duration (may differ from `duration_seconds`).        |
| `is_filler`              | `boolean`       | `NOT NULL DEFAULT false`                | Filler/canon flag (community metadata).                              |
| `is_premium`             | `boolean`       | `NOT NULL DEFAULT false`                | Paywalled until the user's tier grants access.                       |
| `import_metadata`        | `jsonb`         | `NOT NULL DEFAULT '{}'`                 | Raw upstream payload. GIN-indexed.                                   |
| `deleted_at`             | `timestamptz`   | nullable                                | Soft-delete marker.                                                  |
| `created_at`             | `timestamptz`   | `NOT NULL DEFAULT now()`                | —                                                                    |
| `updated_at`             | `timestamptz`   | `NOT NULL DEFAULT now()`                | —                                                                    |
| `version`                | `integer`       | `NOT NULL DEFAULT 1`                    | Optimistic concurrency for metadata edits.                           |
| `created_by`             | `uuid` nullable | FK → `users.id`                         | Curator who imported it.                                             |
| `updated_by`             | `uuid` nullable | FK → `users.id`                         | Last curator.                                                        |

### 2.2 Constraints

| Name                                   | Type           | Definition                                                                                                                             |
| -------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `uq_episodes_anime_number`             | partial unique | `UNIQUE (anime_id, number) WHERE deleted_at IS NULL`                                                                                   |
| `uq_episodes_anime_season_number`      | partial unique | `UNIQUE (anime_id, season_id, number) WHERE deleted_at IS NULL AND season_id IS NOT NULL`                                              |
| `chk_episodes_number_positive`         | check          | `number > 0`                                                                                                                           |
| `chk_episodes_duration_positive`       | check          | `duration_seconds > 0`                                                                                                                 |
| `chk_episodes_video_duration_positive` | check          | `video_duration_seconds IS NULL OR video_duration_seconds > 0`                                                                         |
| `chk_episodes_season_belongs_to_anime` | check          | `season_id IS NULL OR anime_id = (SELECT anime_id FROM seasons WHERE id = season_id)` — _enforced via application + trigger; see §2.7_ |

### 2.3 Indexes

| Index                            | Type           | Columns                                             | Purpose                                   |
| -------------------------------- | -------------- | --------------------------------------------------- | ----------------------------------------- |
| `pk_episodes`                    | btree (unique) | `id`                                                | PK lookup.                                |
| `idx_episodes_anime_id`          | btree          | `(anime_id, number)` `WHERE deleted_at IS NULL`     | Episode list for a show (ordered).        |
| `idx_episodes_season_id`         | btree          | `(season_id, number)` `WHERE deleted_at IS NULL`    | Episode list for a season.                |
| `idx_episodes_aired_at`          | btree          | `aired_at` `WHERE deleted_at IS NULL`               | Recently aired feed.                      |
| `idx_episodes_anime_id_aired_at` | btree          | `(anime_id, aired_at)` `WHERE deleted_at IS NULL`   | "Next episode" lookup.                    |
| `idx_episodes_video_asset_id`    | btree          | `video_asset_id` `WHERE video_asset_id IS NOT NULL` | Resolve a playback request to an episode. |
| `idx_episodes_import_metadata`   | GIN            | `import_metadata`                                   | Reprocessing/debug.                       |

### 2.4 Decisions & Rationale

- **Dual parent (`anime_id` + `season_id`):** Most queries are "episodes of a show" — `anime_id` avoids a join to `seasons`. `season_id` provides precise grouping for seasonal shows. The check constraint (§2.7) guarantees they agree.
- **`number` vs `number_explicit`:** `number` is the per-season sequence (resets each season); `number_explicit` is the absolute count across the whole show. Both are useful for different UIs; storing both avoids runtime computation.
- **`duration_seconds` as integer:** Sub-second precision is unnecessary for display and cursor math. Integer arithmetic is exact and compact.
- **`video_asset_id` is opaque text:** Cloudflare Stream asset ids are provider-specific strings. We don't parse them; we pass them to the signed-URL service. Storing the id (not the signed URL) lets us regenerate short-lived URLs on demand.
- **`is_filler` / `is_premium` as booleans:** Community-sourced filler flags and paywall status are first-class display concerns — real columns, not JSON.
- **`version` column:** Metadata corrections (wrong title, wrong duration) happen often during catalog onboarding. Optimistic concurrency prevents an import job from overwriting a curator's fix.
- **Soft delete preserves history:** A user's watch history references an episode by `id`. Hard-deleting the episode would orphan that history. Soft-delete keeps the row queryable for historical joins while hiding it from the catalog.

### 2.5 Volume & Growth

At 150k anime × ~70 episodes average ≈ **10.5M rows**. This is the largest catalog table. The indexing strategy (§2.3) targets the two dominant access patterns:

1. **"Episodes of a show"** — `idx_episodes_anime_id`.
2. **"Resolve a video asset to an episode"** — `idx_episodes_video_asset_id`.

### 2.6 Partitioning (Future)

When `episodes` exceeds ~50M rows (M6+), partition by `anime_id` hash or range. The schema requires no column changes — only physical repartitioning (see `Migration-Strategy.md`).

### 2.7 Cross-Reference Integrity

The `chk_episodes_season_belongs_to_anime` rule ensures `season_id` (when set) points to a season of the same `anime_id`. A subquery `CHECK` constraint is not natively supported in Postgres, so this is enforced by:

1. **Application logic** in the repository (primary defense).
2. **A trigger** `trg_episodes_season_check` that raises on mismatch (defense-in-depth).

This keeps the invariant without sacrificing the denormalized `anime_id`.
