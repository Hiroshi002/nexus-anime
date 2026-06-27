# Entity-Relationship Diagram

> **Step 7 — Database Design**
> This document is the visual map of the relational schema. Field-level detail lives in the per-entity documents; this file shows **entities, relationships, and cardinalities**.

---

## 1. How to Read This Diagram

- **Boxes** = tables. The first row is the primary key; `FK` marks foreign keys.
- **Lines** = relationships. Notation: `||` one, `o{` zero-or-many, `|{` one-or-many.
- **Join tables** (`anime_genres`, `anime_studios`) are shown explicitly — they are real tables with their own PK and timestamps, not just link tables.
- All tables carry the cross-cutting columns from `Database-Overview.md` (`id`, `created_at`, `updated_at`, `deleted_at`, `version`, audit fields) — they are omitted from the diagram for readability but **exist on every table**.

---

## 2. Full Entity-Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ WATCH_HISTORY : records
    USERS ||--o{ CONTINUE_WATCHING : resumes
    USERS ||--o{ BOOKMARKS : saves
    USERS ||--o{ COMMENTS : writes
    USERS ||--o{ RATINGS : gives
    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ SEARCH_HISTORY : issues
    USERS ||--o{ AUDIT_LOG : acts_as
    USERS ||--o{ USER_SESSIONS : owns
    USERS ||--o{ USER_ACCOUNTS : authenticates_via

    ANIME ||--o{ EPISODES : contains
    ANIME ||--o{ SEASONS : organizes
    ANIME ||--o{ ANIME_GENRES : categorized_as
    ANIME ||--o{ ANIME_STUDIOS : produced_by
    ANIME ||--o{ WATCH_HISTORY : watched_in
    ANIME ||--o{ CONTINUE_WATCHING : resumed_in
    ANIME ||--o{ BOOKMARKS : bookmarked_in
    ANIME ||--o{ COMMENTS : commented_on
    ANIME ||--o{ RATINGS : rated_in

    SEASONS ||--o{ EPISODES : groups

    EPISODES ||--o{ WATCH_HISTORY : tracked_in
    EPISODES ||--o{ CONTINUE_WATCHING : cursor_in

    GENRES ||--o{ ANIME_GENRES : labels
    STUDIOS ||--o{ ANIME_STUDIOS : credits

    USERS {
        id uuid PK
        username citext
        email citext
        display_name text
        avatar_url text
        role text
        deleted_at timestamptz
    }

    USER_ACCOUNTS {
        id uuid PK
        user_id uuid FK
        provider text
        provider_account_id text
        access_token_encrypted text
        refresh_token_encrypted text
    }

    USER_SESSIONS {
        id uuid PK
        user_id uuid FK
        expires_at timestamptz
        session_token_hash text
    }

    ANIME {
        id uuid PK
        slug text
        title text
        title_jp text
        synopsis text
        status text
        type text
        season_year integer
        season_name text
        total_episodes integer
        average_duration_minutes integer
        age_rating text
        poster_url text
        cover_url text
        tmdb_id integer
        anilist_id integer
        published_at timestamptz
        deleted_at timestamptz
        version integer
    }

    SEASONS {
        id uuid PK
        anime_id uuid FK
        number integer
        title text
        synopsis text
        episode_count integer
        poster_url text
        aired_from timestamptz
        aired_to timestamptz
        deleted_at timestamptz
    }

    EPISODES {
        id uuid PK
        anime_id uuid FK
        season_id uuid FK
        number integer
        number_explict integer
        title text
        synopsis text
        duration_seconds integer
        aired_at timestamptz
        thumbnail_url text
        video_asset_id text
        deleted_at timestamptz
        version integer
    }

    GENRES {
        id uuid PK
        slug text
        name text
        description text
    }

    STUDIOS {
        id uuid PK
        slug text
        name text
        logo_url text
        deleted_at timestamptz
    }

    ANIME_GENRES {
        id uuid PK
        anime_id uuid FK
        genre_id uuid FK
    }

    ANIME_STUDIOS {
        id uuid PK
        anime_id uuid FK
        studio_id uuid FK
        role text
    }

    WATCH_HISTORY {
        id uuid PK
        user_id uuid FK
        anime_id uuid FK
        episode_id uuid FK
        watched_at timestamptz
        watch_duration_seconds integer
        completion_pct numeric
        device text
    }

    CONTINUE_WATCHING {
        id uuid PK
        user_id uuid FK
        anime_id uuid FK
        episode_id uuid FK
        position_seconds integer
        duration_seconds integer
        updated_at timestamptz
        version integer
    }

    BOOKMARKS {
        id uuid PK
        user_id uuid FK
        anime_id uuid FK
        note text
        deleted_at timestamptz
    }

    COMMENTS {
        id uuid PK
        user_id uuid FK
        anime_id uuid FK
        parent_comment_id uuid FK
        body text
        is_spoiler boolean
        deleted_at timestamptz
        version integer
    }

    RATINGS {
        id uuid PK
        user_id uuid FK
        anime_id uuid FK
        value numeric
        review_title text
        review_body text
        deleted_at timestamptz
        version integer
    }

    NOTIFICATIONS {
        id uuid PK
        user_id uuid FK
        type text
        channel text
        title text
        body text
        payload jsonb
        read_at timestamptz
        sent_at timestamptz
        expires_at timestamptz
    }

    SEARCH_HISTORY {
        id uuid PK
        user_id uuid FK
        query text
        result_count integer
        searched_at timestamptz
    }

    AUDIT_LOG {
        id uuid PK
        actor_id uuid FK
        action text
        resource_type text
        resource_id uuid
        before jsonb
        after jsonb
        ip_address inet
        user_agent text
        created_at timestamptz
    }
```

---

## 3. Relationship Detail

### 3.1 Identity Cluster

| Parent  | Child               | Cardinality | On-delete behavior                                                              |
| ------- | ------------------- | ----------- | ------------------------------------------------------------------------------- |
| `users` | `user_accounts`     | 1 : 0..\*   | Hard-delete accounts when user is hard-deleted (erasure).                       |
| `users` | `user_sessions`     | 1 : 0..\*   | Hard-delete on user hard-delete; expire naturally via `expires_at`.             |
| `users` | `watch_history`     | 1 : 0..\*   | **Preserve** on soft-delete (anonymize); hard-delete on erasure.                |
| `users` | `continue_watching` | 1 : 0..\*   | Cascade hard-delete on user erasure.                                            |
| `users` | `bookmarks`         | 1 : 0..\*   | Cascade hard-delete on user erasure.                                            |
| `users` | `comments`          | 1 : 0..\*   | **Preserve** author label as `[deleted]` on erasure; keep the comment.          |
| `users` | `ratings`           | 1 : 0..\*   | Cascade hard-delete on user erasure.                                            |
| `users` | `notifications`     | 1 : 0..\*   | Cascade hard-delete on user erasure.                                            |
| `users` | `search_history`    | 1 : 0..\*   | Cascade hard-delete on user erasure.                                            |
| `users` | `audit_log`         | 1 : 0..\*   | **Never delete** — audit log is immutable and actor is preserved as a snapshot. |

### 3.2 Catalog Cluster

| Parent    | Child           | Cardinality | Notes                                                            |
| --------- | --------------- | ----------- | ---------------------------------------------------------------- |
| `anime`   | `seasons`       | 1 : 0..\*   | A show may have zero seasons if undated.                         |
| `anime`   | `episodes`      | 1 : 0..\*   | Direct link for flat (non-seasonal) shows.                       |
| `seasons` | `episodes`      | 1 : 0..\*   | Episodes belong to exactly one season.                           |
| `anime`   | `anime_genres`  | 1 : 0..\*   | Many-to-many via join table.                                     |
| `anime`   | `anime_studios` | 1 : 0..\*   | Many-to-many via join table, with `role` (production/licensing). |
| `genres`  | `anime_genres`  | 1 : 0..\*   | Genre is a shared taxonomy.                                      |
| `studios` | `anime_studios` | 1 : 0..\*   | Studio is a shared taxonomy.                                     |

### 3.3 Engagement Cluster

| Parent              | Child               | Cardinality | Notes                                              |
| ------------------- | ------------------- | ----------- | -------------------------------------------------- |
| `users` + `anime`   | `bookmarks`         | 1 : 0..1    | Unique `(user_id, anime_id)` where not deleted.    |
| `users` + `anime`   | `ratings`           | 1 : 0..1    | Unique `(user_id, anime_id)` where not deleted.    |
| `users` + `anime`   | `comments`          | 1 : 0..\*   | Threaded via `parent_comment_id` self-reference.   |
| `users` + `episode` | `watch_history`     | 1 : 0..\*   | Append-only log; one row per watch event.          |
| `users` + `episode` | `continue_watching` | 1 : 0..\*   | One cursor per `(user, anime)` — updated in place. |

### 3.4 Self-Reference

- `comments.parent_comment_id` → `comments.id` — threaded replies. A comment's parent must belong to the same `anime_id` (enforced in application logic + a composite FK pattern).

---

## 4. Entity Groupings

The 20 documents map to four clusters:

| Cluster        | Tables                                                                               | Documents                                                                            |
| -------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| **Identity**   | `users`, `user_accounts`, `user_sessions`                                            | `User.md`                                                                            |
| **Catalog**    | `anime`, `seasons`, `episodes`, `genres`, `studios`, `anime_genres`, `anime_studios` | `Anime.md`, `Season.md`, `Episode.md`, `Genre.md`, `Studio.md`                       |
| **Engagement** | `watch_history`, `continue_watching`, `bookmarks`, `comments`, `ratings`             | `Watch-History.md`, `Continue-Watching.md`, `Bookmark.md`, `Comment.md`, `Rating.md` |
| **Operations** | `notifications`, `search_history`, `audit_log`                                       | `Notification.md`, `Search-History.md`, `Audit-Log.md`                               |

---

## 5. Key Design Decisions (Diagram-Level)

1. **Episodes link to both `anime` and `season`.** The `anime_id` on `episode` is denormalized for query simplicity (most queries are "episodes of a show"); `season_id` provides the precise grouping. A check constraint ensures the season belongs to the same anime.

2. **Join tables are first-class.** `anime_genres` and `anime_studios` have their own `id`, `created_at`, and (where relevant) extra columns (`role` on studios). This avoids the limitations of Postgres' anonymous many-to-many links and lets us index and timestamp associations.

3. **Engagement tables reference `anime` even when they reference `episode`.** This is intentional denormalization: it lets us query "all anime a user has watched" without joining through episodes, and it keeps bookmark/rating/watchlist semantics at the show level while still tracking the specific episode.

4. **`continue_watching` is separate from `watch_history`.** History is an append-only log; continue-watching is a mutable cursor. Separating them avoids locking the log on every playback heartbeat.

5. **`audit_log` references `users` but is immutable.** Even when a user is hard-deleted, the audit row is retained with a denormalized actor snapshot (stored in `before`/`after` JSONB) so the log is never orphaned.
