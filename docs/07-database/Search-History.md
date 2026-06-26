# Search History

> **Step 7 — Database Design**
> Defines the `search_history` table — recent search queries per user.

---

## 1. Purpose

`search_history` records **every search query a user issues**. It powers the "recent searches" dropdown, search analytics, and (future) personalized search suggestions.

**Design principle:** Search history is **append-only, high-volume, and low-value per row**. It grows fast but individual rows are disposable. We optimize for **fast inserts** and **per-user recent lookups**, with aggressive TTL-based retention.

---

## 2. `search_history` Table

### 2.1 Fields

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Surrogate key. |
| `user_id` | `uuid` | `NOT NULL` FK → `users.id` | Searcher. |
| `query` | `text` | `NOT NULL` | The raw query text (trimmed, lowercased at the app layer). |
| `query_normalized` | `text` | `NOT NULL` | Normalized form for dedupe (lowercased, trimmed, collapsed whitespace). |
| `result_count` | `integer` | nullable | Number of results returned (analytics). |
| `clicked_anime_id` | `uuid` | nullable FK → `anime.id` | Which result the user clicked (if any). |
| `source` | `text` | `NOT NULL DEFAULT 'search_bar'` | Where the search originated. See §2.3. |
| `searched_at` | `timestamptz` | `NOT NULL DEFAULT now()` | When the search occurred. |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Insert time. |

### 2.2 Constraints

| Name | Type | Definition |
|------|------|------------|
| `chk_search_history_query_length` | check | `char_length(query) BETWEEN 1 AND 200` |
| `chk_search_history_source_range` | check | `source IN ('search_bar','voice','suggestion','deep_link')` |
| `chk_search_history_result_count_positive` | check | `result_count IS NULL OR result_count >= 0` |

### 2.3 Source Values

| Value | Meaning |
|-------|---------|
| `search_bar` | Typed in the search bar. |
| `voice` | Voice search (future). |
| `suggestion` | Clicked a suggested query. |
| `deep_link` | Search triggered from a deep link. |

### 2.4 Indexes

| Index | Type | Columns | Purpose |
|-------|------|---------|---------|
| `pk_search_history` | btree (unique) | `id` | PK. |
| `idx_search_history_user_searched_at` | btree | `(user_id, searched_at DESC)` | "Recent searches" dropdown (per user). |
| `idx_search_history_user_normalized` | btree | `(user_id, query_normalized)` | Dedupe: "have I searched this exact query recently?" |
| `idx_search_history_searched_at` | btree | `searched_at` | Retention purge scans. |
| `idx_search_history_clicked_anime_id` | btree | `clicked_anime_id` | "Which searches led to this anime?" (analytics). |

### 2.5 Decisions & Rationale

- **Append-only, no `updated_at`:** A search event is immutable. We never update it (except possibly backfilling `clicked_anime_id` when the user clicks a result — see §2.6).
- **No `deleted_at`:** Search history is **hard-deleted** by TTL. Individual rows are low-value; soft-delete would bloat the table. On user erasure, the user's search history is hard-deleted in bulk.
- **`query` vs `query_normalized`:** `query` preserves the user's original casing/spacing for display. `query_normalized` is the dedupe key — two queries that differ only in case are treated as the same for "recent searches" display. The app layer computes `query_normalized` before insert.
- **`result_count` nullable:** Not every search returns a countable result set (e.g. an error or an empty state). We record what we can.
- **`clicked_anime_id` backfilled:** When a user clicks a search result, we update the most recent matching `search_history` row with the `clicked_anime_id`. This closes the loop between search and engagement for analytics. The update is best-effort (no `version` column — last-write-wins is fine here).
- **`source` column:** Distinguishes typed searches from suggestion clicks. Useful for analytics (e.g. "do suggestion clicks convert better?").
- **No `created_by`:** Search history is system-recorded from user actions, not human-edited. The actor is implicit (`user_id`).

### 2.6 Retention

- Search history is retained for **30 days** per user.
- A nightly job `DELETE`s rows where `searched_at < now() - interval '30 days'`.
- The `idx_search_history_searched_at` index makes this a range scan.
- This is shorter than other tables because search history is high-volume and low long-term value.

### 2.7 Privacy

- Search queries may contain **sensitive personal information** (e.g. a user searching for a medical condition, a controversial topic). We treat `search_history` as **PII-adjacent**:
  - Never exposed in any API response except to the owning user.
  - Hard-deleted on account erasure.
  - Short retention limits exposure.
- The `query` column is **not indexed for full-text search** — we don't want to build a searchable index of sensitive queries. The b-tree index on `query_normalized` is for exact-match dedupe only.

### 2.8 Relationship Recap

- `users` 1 — * `search_history` (one-to-many).
- `anime` 1 — * `search_history` (one-to-many; the clicked result, if any).
- On user erasure: **hard-delete** all the user's search history rows.
