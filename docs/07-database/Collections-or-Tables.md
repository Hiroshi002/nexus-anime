# Collections / Tables — Full Inventory

> **Step 7 — Database Design**
> A single reference listing every table, its purpose, row estimate at scale, and the document that defines its fields. "Collections" and "tables" are used interchangeably — we use relational tables throughout.

---

## 1. Table Inventory

| #   | Table               | Cluster    | Purpose                                    | Est. rows at 1M users | Detail doc             |
| --- | ------------------- | ---------- | ------------------------------------------ | --------------------- | ---------------------- |
| 1   | `users`             | Identity   | Platform accounts (Auth.js backed).        | 1M                    | `User.md`              |
| 2   | `user_accounts`     | Identity   | OAuth/credential provider links.           | 1.3M                  | `User.md`              |
| 3   | `user_sessions`     | Identity   | Active session tokens.                     | 3–5M                  | `User.md`              |
| 4   | `anime`             | Catalog    | The show/film master record.               | 100k–200k             | `Anime.md`             |
| 5   | `seasons`           | Catalog    | Named groupings of episodes within a show. | 300k–500k             | `Season.md`            |
| 6   | `episodes`          | Catalog    | Individual watchable units.                | 5M–15M                | `Episode.md`           |
| 7   | `genres`            | Catalog    | Shared taxonomy of genres.                 | ~30                   | `Genre.md`             |
| 8   | `studios`           | Catalog    | Shared taxonomy of studios/producers.      | ~5k                   | `Studio.md`            |
| 9   | `anime_genres`      | Catalog    | Anime ↔ Genre many-to-many.                | 400k–600k             | `Anime.md`             |
| 10  | `anime_studios`     | Catalog    | Anime ↔ Studio many-to-many (with role).   | 200k–400k             | `Anime.md`             |
| 11  | `watch_history`     | Engagement | Append-only log of watch events.           | 500M+                 | `Watch-History.md`     |
| 12  | `continue_watching` | Engagement | Mutable playback cursors.                  | 5–10M                 | `Continue-Watching.md` |
| 13  | `bookmarks`         | Engagement | User watchlist / "my list" entries.        | 10–30M                | `Bookmark.md`          |
| 14  | `comments`          | Engagement | Threaded comments on anime.                | 50–200M               | `Comment.md`           |
| 15  | `ratings`           | Engagement | Numeric ratings + optional reviews.        | 20–80M                | `Rating.md`            |
| 16  | `notifications`     | Operations | In-app (and future push) notifications.    | 100M+                 | `Notification.md`      |
| 17  | `search_history`    | Operations | Recent search queries per user.            | 50–150M               | `Search-History.md`    |
| 18  | `audit_log`         | Operations | Immutable record of sensitive mutations.   | 200M+                 | `Audit-Log.md`         |

> **Row estimates** assume a mature platform (1M users, ~150k anime catalog). M3 launch will be orders of magnitude smaller; the schema is identical.

---

## 2. Cross-Cutting Columns (present on every table)

Per `Database-Overview.md` §4, every table includes these columns. They are **not repeated** in the per-entity field lists to keep those documents focused on domain columns.

| Column       | Type            | Constraint                              | Present on                           |
| ------------ | --------------- | --------------------------------------- | ------------------------------------ |
| `id`         | `uuid`          | `PRIMARY KEY DEFAULT gen_random_uuid()` | all                                  |
| `created_at` | `timestamptz`   | `NOT NULL DEFAULT now()`                | all                                  |
| `updated_at` | `timestamptz`   | `NOT NULL DEFAULT now()` (trigger)      | all                                  |
| `deleted_at` | `timestamptz`   | nullable                                | mutable entities (see §3)            |
| `version`    | `integer`       | `NOT NULL DEFAULT 1`                    | high-contention tables only (see §3) |
| `created_by` | `uuid` nullable | FK → `users.id`                         | business-mutating tables (see §3)    |
| `updated_by` | `uuid` nullable | FK → `users.id`                         | business-mutating tables (see §3)    |

### 2.1 Which tables get `deleted_at`?

Soft-delete is enabled on entities where **recovery or history** matters:

- `users`, `anime`, `seasons`, `episodes`, `studios`, `bookmarks`, `comments`, `ratings`.

**No soft delete** (hard-delete only) on:

- `user_sessions` (expiry-driven), `watch_history` (append-only, anonymize on erasure), `continue_watching` (cursor, recomputed), `notifications` (TTL-driven), `search_history` (TTL-driven), `audit_log` (immutable), `user_accounts` (hard-delete with user).

### 2.2 Which tables get `version`?

Optimistic concurrency on high-contention, frequently-mutated rows:

- `episodes`, `comments`, `ratings`, `continue_watching`, `anime`.

### 2.3 Which tables get `created_by` / `updated_by`?

All tables where a **human actor** is meaningful:

- `users` (self-created or system), `anime`, `seasons`, `episodes`, `comments`, `ratings`, `bookmarks`.

**Not present** on: `watch_history` (system-recorded), `continue_watching` (system-updated), `audit_log` (actor is a dedicated `actor_id` column), `search_history` (system-recorded), `notifications` (system-generated), `user_sessions`, `user_accounts`, `genres`, `studios`, join tables.

---

## 3. Relationship Summary

| Relationship                                        | Type                   | Enforced by      |
| --------------------------------------------------- | ---------------------- | ---------------- |
| `user_accounts.user_id` → `users.id`                | many-to-one            | FK               |
| `user_sessions.user_id` → `users.id`                | many-to-one            | FK               |
| `seasons.anime_id` → `anime.id`                     | many-to-one            | FK               |
| `episodes.anime_id` → `anime.id`                    | many-to-one            | FK               |
| `episodes.season_id` → `seasons.id`                 | many-to-one            | FK               |
| `anime_genres.anime_id` → `anime.id`                | many-to-one            | FK               |
| `anime_genres.genre_id` → `genres.id`               | many-to-one            | FK               |
| `anime_studios.anime_id` → `anime.id`               | many-to-one            | FK               |
| `anime_studios.studio_id` → `studios.id`            | many-to-one            | FK               |
| `watch_history.(user_id, anime_id, episode_id)`     | many-to-one each       | composite FK set |
| `continue_watching.(user_id, anime_id, episode_id)` | many-to-one each       | composite FK set |
| `bookmarks.(user_id, anime_id)`                     | many-to-one each       | composite FK set |
| `comments.(user_id, anime_id)`                      | many-to-one each       | composite FK set |
| `comments.parent_comment_id` → `comments.id`        | self-reference         | FK               |
| `ratings.(user_id, anime_id)`                       | many-to-one each       | composite FK set |
| `notifications.user_id` → `users.id`                | many-to-one            | FK               |
| `search_history.user_id` → `users.id`               | many-to-one            | FK               |
| `audit_log.actor_id` → `users.id`                   | many-to-one (nullable) | FK               |

---

## 4. Unique Constraints (candidate natural keys)

| Table               | Unique expression                 | Type                                                                 | Notes                                         |
| ------------------- | --------------------------------- | -------------------------------------------------------------------- | --------------------------------------------- |
| `users`             | `username`                        | partial unique `WHERE deleted_at IS NULL`                            | Re-usable after soft-delete.                  |
| `users`             | `email`                           | partial unique `WHERE deleted_at IS NULL`                            | Re-usable after soft-delete.                  |
| `user_accounts`     | `(provider, provider_account_id)` | unique                                                               | One account per provider identity.            |
| `user_sessions`     | `session_token_hash`              | unique                                                               | Lookup by token.                              |
| `anime`             | `slug`                            | partial unique `WHERE deleted_at IS NULL`                            | URL-safe identifier.                          |
| `anime`             | `tmdb_id`                         | partial unique `WHERE deleted_at IS NULL AND tmdb_id IS NOT NULL`    | Nullable — not all anime have a TMDB id.      |
| `anime`             | `anilist_id`                      | partial unique `WHERE deleted_at IS NULL AND anilist_id IS NOT NULL` | Same rationale.                               |
| `genres`            | `slug`                            | unique                                                               | Taxonomy key.                                 |
| `studios`           | `slug`                            | unique                                                               | Taxonomy key.                                 |
| `anime_genres`      | `(anime_id, genre_id)`            | unique                                                               | No duplicate genre assignments.               |
| `anime_studios`     | `(anime_id, studio_id, role)`     | unique                                                               | A studio may have multiple roles on one show. |
| `bookmarks`         | `(user_id, anime_id)`             | partial unique `WHERE deleted_at IS NULL`                            | One active bookmark per user/show.            |
| `ratings`           | `(user_id, anime_id)`             | partial unique `WHERE deleted_at IS NULL`                            | One active rating per user/show.              |
| `continue_watching` | `(user_id, anime_id)`             | partial unique `WHERE deleted_at IS NULL`                            | One cursor per user/show.                     |

---

## 5. Check Constraints (domain rules)

| Table               | Constraint                       | Rule                                                               |
| ------------------- | -------------------------------- | ------------------------------------------------------------------ |
| `users`             | `chk_users_username_format`      | `username ~ '^[a-z0-9_]{3,32}$'`                                   |
| `users`             | `chk_users_role_range`           | `role IN ('viewer', 'moderator', 'admin')`                         |
| `anime`             | `chk_anime_status_range`         | `status IN ('unknown','upcoming','airing','finished','cancelled')` |
| `anime`             | `chk_anime_type_range`           | `type IN ('tv','movie','ova','ona','special','music')`             |
| `anime`             | `chk_anime_age_rating_range`     | `age_rating IN ('g','pg','pg13','r','r18')`                        |
| `anime`             | `chk_anime_season_year`          | `season_year BETWEEN 1917 AND 2100`                                |
| `anime`             | `chk_anime_total_episodes`       | `total_episodes >= 0`                                              |
| `episodes`          | `chk_episodes_number_positive`   | `number > 0`                                                       |
| `episodes`          | `chk_episodes_duration_positive` | `duration_seconds > 0`                                             |
| `seasons`           | `chk_seasons_number_positive`    | `number > 0`                                                       |
| `ratings`           | `chk_ratings_value_range`        | `value BETWEEN 0 AND 10`                                           |
| `watch_history`     | `chk_watch_history_completion`   | `completion_pct BETWEEN 0 AND 100`                                 |
| `continue_watching` | `chk_continue_position`          | `position_seconds >= 0 AND position_seconds <= duration_seconds`   |
| `notifications`     | `chk_notifications_channel`      | `channel IN ('in_app','email','push')`                             |
| `notifications`     | `chk_notifications_type`         | `type IN ('new_episode','reply','system','recommendation')`        |

---

## 6. Storage & Growth Estimates

| Table               | Avg row size | Rows at 1M users | Est. size | Growth driver                   |
| ------------------- | ------------ | ---------------- | --------- | ------------------------------- |
| `users`             | ~400 B       | 1M               | ~400 MB   | signups                         |
| `anime`             | ~2 kB        | 150k             | ~300 MB   | catalog imports                 |
| `episodes`          | ~1.2 kB      | 10M              | ~12 GB    | catalog imports                 |
| `watch_history`     | ~200 B       | 500M             | ~100 GB   | playback events (largest table) |
| `continue_watching` | ~120 B       | 10M              | ~1.2 GB   | active users × shows            |
| `bookmarks`         | ~150 B       | 20M              | ~3 GB     | user engagement                 |
| `comments`          | ~600 B       | 100M             | ~60 GB    | community                       |
| `ratings`           | ~300 B       | 50M              | ~15 GB    | community                       |
| `notifications`     | ~500 B       | 100M             | ~50 GB    | system activity                 |
| `search_history`    | ~120 B       | 100M             | ~12 GB    | search usage                    |
| `audit_log`         | ~1 kB        | 200M             | ~200 GB   | all mutations                   |

> **Implication:** `watch_history` and `audit_log` dominate storage. Both are addressed by the retention and partitioning strategies in `Data-Retention.md` and `Migration-Strategy.md`.

---

## 7. Conventions Recap

- **Engine:** PostgreSQL 16 on Neon.
- **ORM:** Drizzle (`@nexus/db`) — sole access layer.
- **PK:** `uuid`, `gen_random_uuid()`.
- **Timestamps:** `timestamptz`, UTC, `now()` default.
- **Soft delete:** `deleted_at timestamptz` where history/recovery matters.
- **Versioning:** `version integer` on high-contention tables.
- **Enums:** `text` + `CHECK`, not native `ENUM`.
- **JSON:** `jsonb` only for semi-structured/import payloads, GIN-indexed.
- **Naming:** `snake_case`, `idx_`/`uq_`/`chk_` prefixes.

Full rationale for each convention lives in `Database-Overview.md`.
