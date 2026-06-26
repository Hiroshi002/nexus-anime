# Genre

> **Step 7 — Database Design**
> Defines the `genres` taxonomy table — a shared, curated list of content categories.

---

## 1. Purpose

`genres` is a **reference taxonomy**: a small, stable list of content categories (Action, Romance, Mecha, …) used to classify anime and power genre-browse pages. It is **not** user-generated — only admins curate it.

**Design principle:** Taxonomies are small, read-heavy, and change rarely. We optimize for fast lookups and stable slugs, not for high write throughput.

---

## 2. `genres` Table

### 2.1 Fields

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Surrogate key. |
| `slug` | `text` | `NOT NULL` | URL-safe key (e.g. `mecha`). Unique. |
| `name` | `text` | `NOT NULL` | Display name (e.g. `Mecha`). |
| `description` | `text` | nullable | Short explanation of the genre. |
| `color_hex` | `text` | nullable | UI accent color for the genre chip (e.g. `#FF4F8B`). Validated as hex. |
| `icon` | `text` | nullable | Optional icon key (maps to an icon set in `@nexus/ui`). |
| `sort_order` | `integer` | `NOT NULL DEFAULT 0` | Manual ordering for genre browse. |
| `is_active` | `boolean` | `NOT NULL DEFAULT true` | Hide from browse without deleting. |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | — |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | — |

### 2.2 Constraints

| Name | Type | Definition |
|------|------|------------|
| `uq_genres_slug` | unique | `UNIQUE (slug)` |
| `uq_genres_name` | unique | `UNIQUE (name)` |
| `chk_genres_color_hex_format` | check | `color_hex IS NULL OR color_hex ~ '^#[0-9A-Fa-f]{6}$'` |

### 2.3 Indexes

| Index | Type | Columns | Purpose |
|-------|------|---------|---------|
| `pk_genres` | btree (unique) | `id` | PK. |
| `idx_genres_slug` | btree (unique) | `slug` | Route `/genres/:slug`. |
| `idx_genres_sort_order` | btree | `sort_order` | Ordered genre listing. |
| `idx_genres_active` | btree | `is_active` `WHERE is_active = true` | Browse only active genres. |

### 2.4 Decisions & Rationale

- **No `deleted_at`:** Genres are never deleted — they are deactivated via `is_active`. A genre with existing anime associations must remain queryable for those shows' metadata. Deactivation hides it from browse without breaking history.
- **`slug` + `name` both unique:** `slug` is the URL key; `name` is the display label. Both must be unique to avoid ambiguity in routing and UI.
- **`color_hex` validated by check:** Keeps the UI contract (a 6-digit hex) at the DB layer as defense-in-depth; the Zod schema is the primary validator.
- **`sort_order` is manual, not auto:** Taxonomy ordering is a product decision (e.g. "Action" first), not alphabetical. An integer column lets admins reorder without renaming.
- **No `version` column:** Genres are edited rarely and only by admins — last-write-wins is acceptable; the `audit_log` captures who changed what.

### 2.5 Seed Data (Illustrative)

The initial seed is ~25–30 genres aligned with AniList/TMDB taxonomies. Example:

| slug | name | color_hex |
|------|------|-----------|
| `action` | Action | `#E63946` |
| `adventure` | Adventure | `#F4A261` |
| `comedy` | Comedy | `#FFD166` |
| `drama` | Drama | `#6A4C93` |
| `fantasy` | Fantasy | `#2A9D8F` |
| `mecha` | Mecha | '#457B9D' |
| `romance` | Romance | '#F4A3B6' |
| `sci-fi` | Sci-Fi | '#4CC9F0' |
| `slice-of-life` | Slice of Life | '#B5E48C` |
| `sports` | Sports | '#F77F00` |
| `thriller` | Thriller | '#240046` |
| `music` | Music | '#B5179E' |

> The full seed list lives in `tooling/scripts/seed-genres.ts` (future implementation). This document defines the schema only.

### 2.6 Relationship Recap

- `genres` 1 — * `anime_genres` * — 1 `anime` (many-to-many via join table; see `Anime.md` §3).
- A genre with existing `anime_genrows` rows **must not** be hard-deleted — the join table's FK would break. Deactivate instead.
