# Season

> **Step 7 — Database Design**
> Defines the `seasons` table — named groupings of episodes within a show.

---

## 1. Purpose

A `season` groups episodes within a single anime (e.g. _Attack on Titan_ Season 1, Season 2, …). Not every show has seasons — films, OVAs, and some flat series have a single implicit season. The schema supports both: an episode may reference a `season_id` or be orphaned to the show directly.

**Design principle:** Seasons are a **presentation grouping**, not a hard content boundary. They are curated alongside the show and edited rarely. We optimize for ordered listing and fast "episodes of a season" queries.

---

## 2. `seasons` Table

### 2.1 Fields

| Column            | Type            | Constraint                              | Description                                                        |
| ----------------- | --------------- | --------------------------------------- | ------------------------------------------------------------------ |
| `id`              | `uuid`          | `PRIMARY KEY DEFAULT gen_random_uuid()` | Surrogate key.                                                     |
| `anime_id`        | `uuid`          | `NOT NULL` FK → `anime.id`              | Parent show.                                                       |
| `number`          | `integer`       | `NOT NULL`                              | Season number (1-based).                                           |
| `title`           | `text`          | nullable                                | Display title (e.g. `The Final Season`). Falls back to `Season N`. |
| `synopsis`        | `text`          | nullable                                | Short description. Sanitized at render.                            |
| `episode_count`   | `integer`       | nullable                                | Declared episode count for this season.                            |
| `poster_url`      | `text`          | nullable                                | Season-specific poster image URL.                                  |
| `aired_from`      | `timestamptz`   | nullable                                | First episode air date.                                            |
| `aired_to`        | `timestamptz`   | nullable                                | Last episode air date.                                             |
| `import_metadata` | `jsonb`         | `NOT NULL DEFAULT '{}'`                 | Raw upstream payload. GIN-indexed.                                 |
| `deleted_at`      | `timestamptz`   | nullable                                | Soft-delete marker.                                                |
| `created_at`      | `timestamptz`   | `NOT NULL DEFAULT now()`                | —                                                                  |
| `updated_at`      | `timestamptz`   | `NOT NULL DEFAULT now()`                | —                                                                  |
| `created_by`      | `uuid` nullable | FK → `users.id`                         | Curator.                                                           |
| `updated_by`      | `uuid` nullable | FK → `users.id`                         | Last curator.                                                      |

### 2.2 Constraints

| Name                                 | Type           | Definition                                                         |
| ------------------------------------ | -------------- | ------------------------------------------------------------------ |
| `uq_seasons_anime_number`            | partial unique | `UNIQUE (anime_id, number) WHERE deleted_at IS NULL`               |
| `chk_seasons_number_positive`        | check          | `number > 0`                                                       |
| `chk_seasons_episode_count_positive` | check          | `episode_count IS NULL OR episode_count >= 0`                      |
| `chk_seasons_air_range`              | check          | `aired_from IS NULL OR aired_to IS NULL OR aired_to >= aired_from` |

### 2.3 Indexes

| Index                         | Type           | Columns                                         | Purpose                           |
| ----------------------------- | -------------- | ----------------------------------------------- | --------------------------------- |
| `pk_seasons`                  | btree (unique) | `id`                                            | PK.                               |
| `idx_seasons_anime_id`        | btree          | `(anime_id, number)` `WHERE deleted_at IS NULL` | Season list for a show (ordered). |
| `idx_seasons_aired_from`      | btree          | `aired_from` `WHERE deleted_at IS NULL`         | Recently aired seasons.           |
| `idx_seasons_import_metadata` | GIN            | `import_metadata`                               | Reprocessing/debug.               |

### 2.4 Decisions & Rationale

- **`number` is per-show, not global:** Season numbers reset per anime. The unique constraint `(anime_id, number)` enforces this.
- **`title` nullable with fallback:** Many seasons are just "Season 2". A nullable column avoids storing redundant strings; the app layer renders `Season {number}` when `title` is null.
- **`aired_from` / `aired_to` nullable:** Not all seasons have known air dates (undated announcements). The check constraint ensures `aired_to >= aired_from` when both are set.
- **`episode_count` is denormalized:** It mirrors the count of episodes in this season. Maintained by the application when episodes are added/removed. Avoids a `COUNT(*)` on the large `episodes` table for display.
- **Soft-delete enabled:** Removing a season (e.g. a mis-split import) should not orphan its episodes. Soft-delete hides the season while episodes remain queryable via their `anime_id`.
- **No `version` column:** Season metadata is edited rarely and only by admins. Last-write-wins is acceptable; `audit_log` captures changes.

### 2.5 Flat Shows (No Seasons)

A film or OVA may have **no rows** in `seasons`. Its episodes have `season_id = NULL` and are queried directly via `episodes.anime_id`. The application renders a single implicit "season" in the UI. This avoids a dummy "Season 1" row for every movie.

### 2.6 Relationship Recap

- `anime` 1 — \* `seasons` (one-to-many).
- `seasons` 1 — \* `episodes` (one-to-many; see `Episode.md`).
- Every episode's `season_id` (when set) must reference a season of the same `anime_id` — enforced by application logic + trigger (see `Episode.md` §2.7).
