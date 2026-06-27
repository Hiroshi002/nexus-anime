# Anime

> **Step 7 — Database Design**
> Defines the catalog's master entity — the `anime` table and its many-to-many join tables `anime_genres` and `anime_studios`.

---

## 1. Purpose

`anime` is the **master record** for every show, film, OVA, or special in the catalog. It is the central node of the catalog cluster: seasons, episodes, genres, studios, and all engagement (bookmarks, ratings, comments, history) reference it.

**Design principle:** The table stores **curated, queryable metadata** (titles, status, type, year, ratings) as real columns. Raw upstream payloads (TMDB/AniList) are stored in `import_metadata jsonb` for reprocessing only — business logic never queries JSON.

---

## 2. `anime` Table

### 2.1 Fields

| Column                     | Type            | Constraint                              | Description                                                             |
| -------------------------- | --------------- | --------------------------------------- | ----------------------------------------------------------------------- |
| `id`                       | `uuid`          | `PRIMARY KEY DEFAULT gen_random_uuid()` | Surrogate key.                                                          |
| `slug`                     | `text`          | `NOT NULL`                              | URL-safe identifier (e.g. `attack-on-titan`). Unique among active rows. |
| `title`                    | `text`          | `NOT NULL`                              | Romaji/English title — the primary display name.                        |
| `title_jp`                 | `text`          | nullable                                | Original Japanese title (kanji/kana).                                   |
| `title_synonyms`           | `text[]`        | `NOT NULL DEFAULT '{}'`                 | Alternate titles for search. GIN-indexed.                               |
| `synopsis`                 | `text`          | nullable                                | Short description. Sanitized at render.                                 |
| `status`                   | `text`          | `NOT NULL DEFAULT 'unknown'`            | Airing lifecycle. See §2.3.                                             |
| `type`                     | `text`          | `NOT NULL DEFAULT 'tv'`                 | Format. See §2.4.                                                       |
| `season_year`              | `integer`       | nullable                                | Year of the broadcast season (e.g. 2024).                               |
| `season_name`              | `text`          | nullable                                | Season label: `'spring'`, `'summer'`, `'fall'`, `'winter'`.             |
| `total_episodes`           | `integer`       | nullable                                | Declared episode count; `NULL` if unknown.                              |
| `average_duration_minutes` | `integer`       | nullable                                | Typical runtime per episode.                                            |
| `age_rating`               | `text`          | nullable                                | Content rating. See §2.5.                                               |
| `poster_url`               | `text`          | nullable                                | Primary poster image URL.                                               |
| `cover_url`                | `text`          | nullable                                | Wide banner/cover image URL.                                            |
| `trailer_url`              | `text`          | nullable                                | Promotional trailer URL.                                                |
| `tmdb_id`                  | `integer`       | nullable                                | TMDB external id. Unique among active rows when set.                    |
| `anilist_id`               | `integer`       | nullable                                | AniList external id. Unique among active rows when set.                 |
| `mal_id`                   | `integer`       | nullable                                | MyAnimeList external id (future import source).                         |
| `popularity_score`         | `numeric(8,4)`  | `NOT NULL DEFAULT 0`                    | Computed popularity (trending sort). Updated by a background job.       |
| `average_rating`           | `numeric(3,2)`  | `NOT NULL DEFAULT 0`                    | Mean of all active ratings. Maintained by trigger/application.          |
| `rating_count`             | `integer`       | `NOT NULL DEFAULT 0`                    | Number of active ratings.                                               |
| `view_count`               | `bigint`        | `NOT NULL DEFAULT 0`                    | Total watch-event count. `bigint` — exceeds 2^31 at scale.              |
| `bookmark_count`           | `integer`       | `NOT NULL DEFAULT 0`                    | Denormalized bookmark count for sort/display.                           |
| `published_at`             | `timestamptz`   | nullable                                | When the anime was first released/aired.                                |
| `next_episode_at`          | `timestamptz`   | nullable                                | Expected next episode air time (for airing shows).                      |
| `import_metadata`          | `jsonb`         | `NOT NULL DEFAULT '{}'`                 | Raw upstream payload for reprocessing. GIN-indexed.                     |
| `deleted_at`               | `timestamptz`   | nullable                                | Soft-delete marker.                                                     |
| `created_at`               | `timestamptz`   | `NOT NULL DEFAULT now()`                | —                                                                       |
| `updated_at`               | `timestamptz`   | `NOT NULL DEFAULT now()`                | —                                                                       |
| `version`                  | `integer`       | `NOT NULL DEFAULT 1`                    | Optimistic concurrency — catalog edits are frequent.                    |
| `created_by`               | `uuid` nullable | FK → `users.id`                         | Admin who imported/curated it.                                          |
| `updated_by`               | `uuid` nullable | FK → `users.id`                         | Last curator.                                                           |

### 2.2 Constraints

| Name                              | Type           | Definition                                                                  |
| --------------------------------- | -------------- | --------------------------------------------------------------------------- |
| `uq_anime_slug`                   | partial unique | `UNIQUE (slug) WHERE deleted_at IS NULL`                                    |
| `uq_anime_tmdb_id`                | partial unique | `UNIQUE (tmdb_id) WHERE deleted_at IS NULL AND tmdb_id IS NOT NULL`         |
| `uq_anime_anilist_id`             | partial unique | `UNIQUE (anilist_id) WHERE deleted_at IS NULL AND anilist_id IS NOT NULL`   |
| `uq_anime_mal_id`                 | partial unique | `UNIQUE (mal_id) WHERE deleted_at IS NULL AND mal_id IS NOT NULL`           |
| `chk_anime_status_range`          | check          | `status IN ('unknown','upcoming','airing','finished','cancelled')`          |
| `chk_anime_type_range`            | check          | `type IN ('tv','movie','ova','ona','special','music')`                      |
| `chk_anime_season_name_range`     | check          | `season_name IS NULL OR season_name IN ('spring','summer','fall','winter')` |
| `chk_anime_age_rating_range`      | check          | `age_rating IS NULL OR age_rating IN ('g','pg','pg13','r','r18')`           |
| `chk_anime_season_year`           | check          | `season_year IS NULL OR season_year BETWEEN 1917 AND 2100`                  |
| `chk_anime_total_episodes`        | check          | `total_episodes IS NULL OR total_episodes >= 0`                             |
| `chk_anime_average_duration`      | check          | `average_duration_minutes IS NULL OR average_duration_minutes > 0`          |
| `chk_anime_popularity_range`      | check          | `popularity_score >= 0`                                                     |
| `chk_anime_average_rating_range`  | check          | `average_rating BETWEEN 0 AND 10`                                           |
| `chk_anime_rating_count_positive` | check          | `rating_count >= 0`                                                         |
| `chk_anime_view_count_positive`   | check          | `view_count >= 0`                                                           |

### 2.3 Status Values

| Value       | Meaning                          |
| ----------- | -------------------------------- |
| `unknown`   | Imported but not yet classified. |
| `upcoming`  | Announced, not yet aired.        |
| `airing`    | Currently releasing episodes.    |
| `finished`  | Completed its run.               |
| `cancelled` | Discontinued before completion.  |

### 2.4 Type Values

| Value     | Meaning                   |
| --------- | ------------------------- |
| `tv`      | Television series.        |
| `movie`   | Feature film.             |
| `ova`     | Original Video Animation. |
| `ona`     | Original Net Animation.   |
| `special` | Special episode.          |
| `music`   | Music video.              |

### 2.5 Age Ratings

| Value  | Meaning                         |
| ------ | ------------------------------- |
| `g`    | All ages.                       |
| `pg`   | Parental guidance.              |
| `pg13` | Suitable for 13+.               |
| `r`    | Restricted (17+ with guardian). |
| `r18`  | Adults only.                    |

### 2.6 Indexes

| Index                       | Type                    | Columns                                                            | Purpose                       |
| --------------------------- | ----------------------- | ------------------------------------------------------------------ | ----------------------------- |
| `pk_anime`                  | btree (unique)          | `id`                                                               | PK lookup.                    |
| `idx_anime_slug`            | btree (unique, partial) | `slug` `WHERE deleted_at IS NULL`                                  | Route `/anime/:slug`.         |
| `idx_anime_status`          | btree                   | `status` `WHERE deleted_at IS NULL`                                | Filter by status.             |
| `idx_anime_type`            | btree                   | `type` `WHERE deleted_at IS NULL`                                  | Filter by type.               |
| `idx_anime_season`          | btree                   | `(season_year, season_name)` `WHERE deleted_at IS NULL`            | Season browsing.              |
| `idx_anime_popularity`      | btree                   | `popularity_score DESC` `WHERE deleted_at IS NULL`                 | Trending sort.                |
| `idx_anime_average_rating`  | btree                   | `average_rating DESC` `WHERE deleted_at IS NULL`                   | Top-rated sort.               |
| `idx_anime_published_at`    | btree                   | `published_at DESC` `WHERE deleted_at IS NULL`                     | New releases.                 |
| `idx_anime_next_episode_at` | btree                   | `next_episode_at` `WHERE status = 'airing' AND deleted_at IS NULL` | "Upcoming episodes" feed.     |
| `idx_anime_title_synonyms`  | GIN                     | `title_synonyms`                                                   | Search over alternate titles. |
| `idx_anime_import_metadata` | GIN                     | `import_metadata`                                                  | Reprocessing/debug queries.   |
| `idx_anime_title_trgm`      | GIN (trigram)           | `title gin_trgm_ops`                                               | Fuzzy title search (future).  |

### 2.7 Decisions & Rationale

- **`slug` as the public identifier:** URLs are stable even if the title changes. A show renamed in translation keeps its old slug (or we issue a redirect row — out of scope here).
- **Denormalized counters (`average_rating`, `rating_count`, `view_count`, `bookmark_count`):** These are read far more than written. Computing them on every list query via aggregate joins would be catastrophic at scale. They are maintained by the application on the relevant mutation (rating added/removed, watch event, bookmark toggle) and are **eventually consistent** — a background reconciliation job corrects drift.
- **`popularity_score` is computed, not raw:** A single sortable number lets us power a "trending" feed without multi-column `ORDER BY`. The score blends recent views, ratings, and recency; the formula lives in a background job, not the schema.
- **`title_synonyms` as `text[]` + GIN:** Alternate titles are a bounded list per anime (usually < 10). An array with GIN is simpler than a join table and supports `@>` / `ANY()` search. We only do this because a GIN index backs it.
- **`import_metadata` is `jsonb`, not normalized:** Upstream payloads are heterogeneous and evolve. We store them for reprocessing and debugging but never build business logic on them. Any field that becomes a first-class query target gets promoted to a real column.
- **`version` column:** Catalog metadata is edited frequently by curators and import jobs. Optimistic concurrency prevents two import runs from clobbering each other.
- **Partial unique on external ids:** `tmdb_id`/`anilist_id` are nullable (not every anime exists on every source) and must be unique only among active rows. A partial unique index handles both.

---

## 3. `anime_genres` Table (Join)

Many-to-many between `anime` and `genres`. A show has many genres; a genre labels many shows.

### 3.1 Fields

| Column       | Type          | Constraint                              | Description                                 |
| ------------ | ------------- | --------------------------------------- | ------------------------------------------- |
| `id`         | `uuid`        | `PRIMARY KEY DEFAULT gen_random_uuid()` | Surrogate PK (join tables are first-class). |
| `anime_id`   | `uuid`        | `NOT NULL` FK → `anime.id`              | —                                           |
| `genre_id`   | `uuid`        | `NOT NULL` FK → `genres.id`             | —                                           |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()`                | —                                           |

### 3.2 Constraints

| Name              | Type   | Definition                    |
| ----------------- | ------ | ----------------------------- |
| `uq_anime_genres` | unique | `UNIQUE (anime_id, genre_id)` |

### 3.3 Indexes

| Index                       | Type           | Columns    | Purpose                |
| --------------------------- | -------------- | ---------- | ---------------------- |
| `pk_anime_genres`           | btree (unique) | `id`       | PK.                    |
| `idx_anime_genres_anime_id` | btree          | `anime_id` | List genres of a show. |
| `idx_anime_genres_genre_id` | btree          | `genre_id` | List shows in a genre. |

### 3.4 Decisions

- **Surrogate PK on the join table:** Lets us timestamp the association and reference it from `audit_log`. A composite PK `(anime_id, genre_id)` would be more compact but less flexible for auditing.
- **No `deleted_at`:** Genre associations are hard-replaced on re-import rather than soft-deleted — they are a property of the show, not a user-owned record.

---

## 4. `anime_studios` Table (Join)

Many-to-many between `anime` and `studios`, with a `role` distinguishing the studio's involvement.

### 4.1 Fields

| Column       | Type          | Constraint                              | Description |
| ------------ | ------------- | --------------------------------------- | ----------- |
| `id`         | `uuid`        | `PRIMARY KEY DEFAULT gen_random_uuid()` | —           |
| `anime_id`   | `uuid`        | `NOT NULL` FK → `anime.id`              | —           |
| `studio_id`  | `uuid`        | `NOT NULL` FK → `studios.id`            | —           |
| `role`       | `text`        | `NOT NULL DEFAULT 'production'`         | See §4.3.   |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()`                | —           |

### 4.2 Constraints

| Name                           | Type   | Definition                                               |
| ------------------------------ | ------ | -------------------------------------------------------- |
| `uq_anime_studios`             | unique | `UNIQUE (anime_id, studio_id, role)`                     |
| `chk_anime_studios_role_range` | check  | `role IN ('production','licensing','music','animation')` |

### 4.3 Role Values

| Value        | Meaning                         |
| ------------ | ------------------------------- |
| `production` | Primary production studio.      |
| `licensing`  | Holds distribution rights.      |
| `music`      | Music production.               |
| `animation`  | Animation work (co-production). |

### 4.4 Indexes

| Index                         | Type           | Columns     | Purpose                 |
| ----------------------------- | -------------- | ----------- | ----------------------- |
| `pk_anime_studios`            | btree (unique) | `id`        | PK.                     |
| `idx_anime_studios_anime_id`  | btree          | `anime_id`  | List studios of a show. |
| `idx_anime_studios_studio_id` | btree          | `studio_id` | List shows by a studio. |

### 4.5 Decisions

- **`role` column:** A studio may appear multiple times for one show in different roles (e.g. production + licensing). The unique constraint includes `role` to permit this.
- **No `deleted_at`:** Same rationale as `anime_genres` — associations are replaced on re-import.
