# Indexing Strategy

> **Step 7 — Database Design**
> Defines the indexing philosophy, the full index inventory, and the rules for adding or removing indexes. This is the operational companion to the per-entity documents (which list each table's indexes).

---

## 1. Purpose

Indexes are the difference between a schema that works at 10k rows and one that works at 100M. This document explains **why** each index exists, **how** we choose what to index, and **what rules** govern index changes. It is the single source of truth for the database's indexing posture.

---

## 2. Indexing Philosophy

### 2.1 Core Principles

| Principle | Meaning |
|-----------|---------|
| **Index the query, not the table.** | Every index must serve a documented query pattern. If no query uses an index, it's wasted write overhead. |
| **Write cost is real.** | Every index slows `INSERT`/`UPDATE`/`DELETE` on its table. Our largest tables (`watch_history`, `audit_log`) are write-heavy — they get the fewest indexes. |
| **Prefer composite over single-column.** | A composite index on `(a, b)` serves queries on `(a)` and `(a, b)` — two indexes for the price of one. |
| **Partial indexes for soft-deleted data.** | `WHERE deleted_at IS NULL` indexes are smaller, faster, and match our query patterns (we almost never query deleted rows). |
| **Unique constraints are indexes.** | A `UNIQUE` constraint creates a unique B-tree index — it enforces integrity *and* speeds lookups. We use partial unique indexes to handle soft-delete correctly. |
| **Measure before adding.** | New indexes require evidence: a slow query from `pg_stat_statements`, an `EXPLAIN` plan showing a sequential scan, or a documented access pattern from a new feature. |

### 2.2 Anti-Patterns We Avoid

| Anti-pattern | Why we avoid it |
|--------------|-----------------|
| Indexing every column. | Bloats the table, slows writes, confuses the planner. |
| Redundant indexes (e.g. `(a)` when `(a, b)` exists). | The `(a)` index is never used — the composite serves it. |
| Indexing low-cardinality columns alone (e.g. `is_active`). | A boolean index is rarely selective enough; it's only useful as a leading column in a partial index or as part of a composite. |
| Full-text indexes on PII (search queries). | We don't build searchable indexes over sensitive data. |
| `SELECT *` that bypasses indexes. | Covered indexes only help when the query selects indexed columns. |

---

## 3. Index Types We Use

| Type | Use case | Example |
|------|----------|---------|
| **B-tree** (default) | Equality and range queries on scalar columns. | `(user_id, created_at DESC)` |
| **GIN** | `jsonb`, `text[]`, `tsvector`, trigram lookups. | `USING GIN (payload)` |
| **GiST** | Range types, geometric data (future). | Not currently used. |
| **Hash** | Equality-only, when B-tree ordering is unnecessary. | Rarely — B-tree is almost as fast and more flexible. |
| **BRIN** | Very large, naturally ordered tables (time-series). | Future: on `watch_history.watched_at` after partitioning. |

We **do not** use bitmap, GIN fastupdate, or other exotic configurations without a documented need.

---

## 4. Full Index Inventory

The table below consolidates every index from the per-entity documents. It is the **authoritative index list** — if an index isn't here, it doesn't exist.

### 4.1 Identity Cluster

| Table | Index | Type | Columns | Serves |
|-------|-------|------|---------|--------|
| `users` | `pk_users` | btree (unique) | `id` | PK lookup |
| `users` | `idx_users_username` | btree (unique, partial) | `username` `WHERE deleted_at IS NULL` | Login by username |
| `users` | `idx_users_email` | btree (unique, partial) | `email` `WHERE deleted_at IS NULL` | Login by email |
| `users` | `idx_users_last_login_at` | btree | `last_login_at` | Admin queries, churn |
| `users` | `idx_users_preferences` | GIN | `preferences` | Pref key lookup |
| `user_accounts` | `pk_user_accounts` | btree (unique) | `id` | PK |
| `user_accounts` | `idx_user_accounts_user_id` | btree | `user_id` | List user's accounts |
| `user_accounts` | `idx_user_accounts_provider_lookup` | btree (unique) | `(provider, provider_account_id)` | Auth.js sign-in |
| `user_sessions` | `pk_user_sessions` | btree (unique) | `id` | PK |
| `user_sessions` | `idx_user_sessions_token_lookup` | btree (unique) | `session_token_hash` | Session validation |
| `user_sessions` | `idx_user_sessions_user_id` | btree | `user_id` | List user's sessions |
| `user_sessions` | `idx_user_sessions_expires_at` | btree | `expires_at` | Expired-session purge |

### 4.2 Catalog Cluster

| Table | Index | Type | Columns | Serves |
|-------|-------|------|---------|--------|
| `anime` | `pk_anime` | btree (unique) | `id` | PK |
| `anime` | `idx_anime_slug` | btree (unique, partial) | `slug` `WHERE deleted_at IS NULL` | Route `/anime/:slug` |
| `anime` | `idx_anime_status` | btree (partial) | `status` `WHERE deleted_at IS NULL` | Filter by status |
| `anime` | `idx_anime_type` | btree (partial) | `type` `WHERE deleted_at IS NULL` | Filter by type |
| `anime` | `idx_anime_season` | btree (partial) | `(season_year, season_name)` `WHERE deleted_at IS NULL` | Season browsing |
| `anime` | `idx_anime_popularity` | btree (partial) | `popularity_score DESC` `WHERE deleted_at IS NULL` | Trending sort |
| `anime` | `idx_anime_average_rating` | btree (partial) | `average_rating DESC` `WHERE deleted_at IS NULL` | Top-rated sort |
| `anime` | `idx_anime_published_at` | btree (partial) | `published_at DESC` `WHERE deleted_at IS NULL` | New releases |
| `anime` | `idx_anime_next_episode_at` | btree (partial) | `next_episode_at` `WHERE status='airing' AND deleted_at IS NULL` | Upcoming episodes |
| `anime` | `idx_anime_title_synonyms` | GIN | `title_synonyms` | Alt-title search |
| `anime` | `idx_anime_import_metadata` | GIN | `import_metadata` | Reprocessing |
| `anime` | `idx_anime_title_trgm` | GIN (trigram) | `title gin_trgm_ops` | Fuzzy title search |
| `seasons` | `pk_seasons` | btree (unique) | `id` | PK |
| `seasons` | `idx_seasons_anime_id` | btree (partial) | `(anime_id, number)` `WHERE deleted_at IS NULL` | Season list |
| `seasons` | `idx_seasons_aired_from` | btree (partial) | `aired_from` `WHERE deleted_at IS NULL` | Recently aired |
| `seasons` | `idx_seasons_import_metadata` | GIN | `import_metadata` | Reprocessing |
| `episodes` | `pk_episodes` | btree (unique) | `id` | PK |
| `episodes` | `idx_episodes_anime_id` | btree (partial) | `(anime_id, number)` `WHERE deleted_at IS NULL` | Episode list |
| `episodes` | `idx_episodes_season_id` | btree (partial) | `(season_id, number)` `WHERE deleted_at IS NULL` | Season episode list |
| `episodes` | `idx_episodes_aired_at` | btree (partial) | `aired_at` `WHERE deleted_at IS NULL` | Recently aired |
| `episodes` | `idx_episodes_anime_id_aired_at` | btree (partial) | `(anime_id, aired_at)` `WHERE deleted_at IS NULL` | Next-episode lookup |
| `episodes` | `idx_episodes_video_asset_id` | btree | `video_asset_id` `WHERE video_asset_id IS NOT NULL` | Playback resolution |
| `episodes` | `idx_episodes_import_metadata` | GIN | `import_metadata` | Reprocessing |
| `genres` | `pk_genres` | btree (unique) | `id` | PK |
| `genres` | `idx_genres_slug` | btree (unique) | `slug` | Route `/genres/:slug` |
| `genres` | `idx_genres_sort_order` | btree | `sort_order` | Ordered listing |
| `genres` | `idx_genres_active` | btree (partial) | `is_active` `WHERE is_active = true` | Browse active |
| `studios` | `pk_studios` | btree (unique) | `id` | PK |
| `studios` | `idx_studios_slug` | btree (unique, partial) | `slug` `WHERE deleted_at IS NULL` | Route `/studios/:slug` |
| `studios` | `idx_studios_name` | btree (unique, partial) | `name` `WHERE deleted_at IS NULL` | Name dedupe |
| `studios` | `idx_studios_sort_order` | btree | `sort_order` | Ordered listing |
| `studios` | `idx_studios_active` | btree (partial) | `is_active` `WHERE is_active = true` | Browse active |
| `studios` | `idx_studios_country` | btree (partial) | `country` `WHERE country IS NOT NULL` | Filter by country |
| `anime_genres` | `pk_anime_genres` | btree (unique) | `id` | PK |
| `anime_genres` | `idx_anime_genres_anime_id` | btree | `anime_id` | List genres of show |
| `anime_genres` | `idx_anime_genres_genre_id` | btree | `genre_id` | List shows in genre |
| `anime_studios` | `pk_anime_studios` | btree (unique) | `id` | PK |
| `anime_studios` | `idx_anime_studios_anime_id` | btree | `anime_id` | List studios of show |
| `anime_studios` | `idx_anime_studios_studio_id` | btree | `studio_id` | List shows by studio |

### 4.3 Engagement Cluster

| Table | Index | Type | Columns | Serves |
|-------|-------|------|---------|--------|
| `watch_history` | `pk_watch_history` | btree (unique) | `id` | PK |
| `watch_history` | `idx_watch_history_user_watched_at` | btree | `(user_id, watched_at DESC)` | Recently Watched |
| `watch_history` | `idx_watch_history_user_anime` | btree | `(user_id, anime_id, watched_at DESC)` | Per-show history |
| `watch_history` | `idx_watch_history_episode_id` | btree | `episode_id` | Per-episode stats |
| `watch_history` | `idx_watch_history_anime_id_watched_at` | btree | `(anime_id, watched_at DESC)` | Recent show activity |
| `watch_history` | `idx_watch_history_watched_at` | btree | `watched_at` | Retention/partition scans |
| `continue_watching` | `pk_continue_watching` | btree (unique) | `id` | PK |
| `continue_watching` | `idx_continue_watching_user_updated` | btree | `(user_id, updated_at DESC)` | Home feed |
| `continue_watching` | `idx_continue_watching_user_anime` | btree (unique) | `(user_id, anime_id)` | Upsert target |
| `continue_watching` | `idx_continue_watching_episode_id` | btree | `episode_id` | Episode cleanup |
| `bookmarks` | `pk_bookmarks` | btree (unique) | `id` | PK |
| `bookmarks` | `idx_bookmarks_user_id` | btree (partial) | `(user_id, sort_order)` `WHERE deleted_at IS NULL` | Watchlist |
| `bookmarks` | `idx_bookmarks_user_anime` | btree (unique, partial) | `(user_id, anime_id)` `WHERE deleted_at IS NULL` | Toggle check |
| `bookmarks` | `idx_bookmarks_anime_id` | btree (partial) | `anime_id` `WHERE deleted_at IS NULL` | Bookmark count |
| `bookmarks` | `idx_bookmarks_notify` | btree (partial) | `(anime_id)` `WHERE notify_on_new_episode=true AND deleted_at IS NULL` | Notification fan-out |
| `comments` | `pk_comments` | btree (unique) | `id` | PK |
| `comments` | `idx_comments_anime_created` | btree (partial) | `(anime_id, created_at DESC)` `WHERE deleted_at IS NULL AND parent_comment_id IS NULL` | Top-level comments |
| `comments` | `idx_comments_parent` | btree (partial) | `(parent_comment_id, created_at ASC)` `WHERE deleted_at IS NULL` | Replies |
| `comments` | `idx_comments_user_id` | btree (partial) | `(user_id, created_at DESC)` `WHERE deleted_at IS NULL` | User's comments |
| `comments` | `idx_comments_is_hidden` | btree (partial) | `is_hidden` `WHERE is_hidden = true` | Moderation queue |
| `comments` | `idx_comments_is_pinned` | btree (partial) | `(anime_id, is_pinned)` `WHERE is_pinned = true AND deleted_at IS NULL` | Pinned comments |
| `ratings` | `pk_ratings` | btree (unique) | `id` | PK |
| `ratings` | `idx_ratings_user_id` | btree (partial) | `(user_id, updated_at DESC)` `WHERE deleted_at IS NULL` | User's ratings |
| `ratings` | `idx_ratings_user_anime` | btree (unique, partial) | `(user_id, anime_id)` `WHERE deleted_at IS NULL` | "My rating?" |
| `ratings` | `idx_ratings_anime_id` | btree (partial) | `(anime_id, value DESC)` `WHERE deleted_at IS NULL` | Reviews by score |
| `ratings` | `idx_ratings_anime_created` | btree (partial) | `(anime_id, created_at DESC)` `WHERE deleted_at IS NULL` | Recent ratings |

### 4.4 Operations Cluster

| Table | Index | Type | Columns | Serves |
|-------|-------|------|---------|--------|
| `notifications` | `pk_notifications` | btree (unique) | `id` | PK |
| `notifications` | `idx_notifications_user_created` | btree | `(user_id, created_at DESC)` | Inbox feed |
| `notifications` | `idx_notifications_user_unread` | btree (partial) | `(user_id, created_at DESC)` `WHERE is_read = false` | Unread + badge |
| `notifications` | `idx_notifications_expires_at` | btree (partial) | `expires_at` `WHERE expires_at IS NOT NULL` | TTL purge |
| `notifications` | `idx_notifications_type` | btree (partial) | `(user_id, type)` `WHERE is_read = false` | Unread by type |
| `notifications` | `idx_notifications_payload` | GIN | `payload` | Payload key lookup |
| `search_history` | `pk_search_history` | btree (unique) | `id` | PK |
| `search_history` | `idx_search_history_user_searched_at` | btree | `(user_id, searched_at DESC)` | Recent searches |
| `search_history` | `idx_search_history_user_normalized` | btree | `(user_id, query_normalized)` | Dedupe |
| `search_history` | `idx_search_history_searched_at` | btree | `searched_at` | Retention purge |
| `search_history` | `idx_search_history_clicked_anime_id` | btree | `clicked_anime_id` | Search-to-click analytics |
| `audit_log` | `pk_audit_log` | btree (unique) | `id` | PK |
| `audit_log` | `idx_audit_log_actor_created` | btree | `(actor_id, created_at DESC)` | Actor history |
| `audit_log` | `idx_audit_log_resource` | btree | `(resource_type, resource_id, created_at DESC)` | Entity history |
| `audit_log` | `idx_audit_log_action` | btree | `(action, created_at DESC)` | Action type history |
| `audit_log` | `idx_audit_log_created_at` | btree | `created_at` | Retention/partition scans |
| `audit_log` | `idx_audit_log_metadata` | GIN | `metadata` | Correlation id lookup |

---

## 5. Index Maintenance

### 5.1 Bloat Monitoring

Postgres indexes bloat over time as rows are updated or deleted. We monitor with:

- `pg_stat_user_indexes` — scan counts, tuples read vs. returned (low ratio = unused index).
- `pgstattuple` extension — physical bloat percentage.

**Action thresholds:**

| Metric | Threshold | Action |
|--------|-----------|--------|
| Index unused (0 scans in 30 days) | Investigate before dropping — may be seasonal. |
| Bloat > 30% | `REINDEX CONCURRENTLY` during low-traffic window. |
| Index size > 2× table size | Review for redundancy. |

### 5.2 Concurrent Index Creation

All new indexes in production are created `CONCURRENTLY`:

```sql
CREATE INDEX CONCURRENTLY idx_episodes_new ON episodes (new_column);
```

This avoids locking the table for writes during creation. It is slower and can't run inside a transaction, but it's safe for live tables.

### 5.3 Dropping Indexes

An index is dropped only when:

1. No query uses it (verified via `pg_stat_user_indexes` over a 30-day window).
2. It's redundant with another index.
3. A migration explicitly replaces it.

Dropping is instant and non-blocking (`DROP INDEX CONCURRENTLY`).

---

## 6. Query Optimization Patterns

### 6.1 Cursor-Based Pagination

All infinite-scroll feeds (watch history, comments, bookmarks, notifications) use **keyset pagination**, not `OFFSET`:

```sql
-- Good: keyset
SELECT * FROM watch_history
WHERE user_id = :me AND watched_at < :cursor
ORDER BY watched_at DESC
LIMIT 20;

-- Bad: OFFSET (slow at high offsets)
SELECT * FROM watch_history
WHERE user_id = :me
ORDER BY watched_at DESC
LIMIT 20 OFFSET 100000;
```

The composite indexes `(user_id, watched_at DESC)` are designed for keyset pagination — the cursor is the last seen `watched_at`.

### 6.2 Covering Indexes

When a query selects only indexed columns, Postgres can satisfy it from the index alone (an "index-only scan"), avoiding the heap fetch. We don't design indexes purely for coverage (that's premature optimization), but we **notice** when an existing index covers a hot query and rely on it.

### 6.3 Avoiding N+1

The service layer uses Drizzle's query builder with joins or batched `WHERE id IN (...)` to avoid N+1 queries. Indexes on foreign keys (`user_id`, `anime_id`, `episode_id`) make these joins and batched lookups fast.

### 6.4 Materialized Views for Aggregates

Expensive aggregates (e.g. "trending this week") are computed by background jobs and stored in **materialized views** or denormalized columns on `anime`. We don't compute them on every request. The `anime.popularity_score` and `anime.average_rating` columns are the primary examples.

---

## 7. Adding a New Index — Checklist

Before adding any index, confirm:

- [ ] A documented query pattern needs it (link to the feature or slow query).
- [ ] `EXPLAIN ANALYZE` shows a sequential scan or high cost without it.
- [ ] No existing index already serves the query.
- [ ] The write-cost is acceptable for the table's volume.
- [ ] It's created `CONCURRENTLY` in production.
- [ ] It's added to this document's inventory.

---

## 8. Index Budget

As a rough operational guardrail, we target **≤ 8 indexes per table** (excluding the PK). Tables that exceed this are flagged for review — either some indexes are unused, or the table's access patterns need consolidation. The current maximum is `anime` at 12 indexes (excluding PK), which exceeds the guideline; it is justified by the catalog's many access patterns (slug, status, type, season, popularity, rating, published date, next episode, plus GIN indexes on synonyms, metadata, and trigram). We will review `anime`'s index usage after launch and consolidate any that prove unused.
