# Studio

> **Step 7 — Database Design**
> Defines the `studios` taxonomy table — a shared, curated list of animation studios and producers.

---

## 1. Purpose

`studios` is a **reference taxonomy** of animation studios, production companies, and licensors (Kyoto Animation, MAPPA, Toei, …). It powers studio-browse pages and the "produced by" credits on anime detail pages. Like genres, it is **admin-curated**, not user-generated.

**Design principle:** Studios are a small, read-heavy taxonomy. We optimize for stable slugs, logo display, and fast lookups. Soft-delete is enabled because a studio may be merged or renamed, and we want to preserve historical credits.

---

## 2. `studios` Table

### 2.1 Fields

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Surrogate key. |
| `slug` | `text` | `NOT NULL` | URL-safe key (e.g. `kyoto-animation`). Unique among active rows. |
| `name` | `text` | `NOT NULL` | Display name (e.g. `Kyoto Animation`). |
| `name_jp` | `text` | nullable | Original Japanese name (e.g. `京都アニメーション`). |
| `description` | `text` | nullable | Short studio bio. Sanitized at render. |
| `logo_url` | `text` | nullable | Logo image URL. |
| `website_url` | `text` | nullable | Official website. |
| `founded_year` | `integer` | nullable | Year the studio was established. |
| `country` | `text` | nullable | ISO 3166-1 alpha-2 country code (e.g. `JP`). |
| `sort_order` | `integer` | `NOT NULL DEFAULT 0` | Manual ordering for studio browse. |
| `is_active` | `boolean` | `NOT NULL DEFAULT true` | Hide from browse without deleting. |
| `deleted_at` | `timestamptz` | nullable | Soft-delete marker. |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | — |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | — |

### 2.2 Constraints

| Name | Type | Definition |
|------|------|------------|
| `uq_studios_slug` | partial unique | `UNIQUE (slug) WHERE deleted_at IS NULL` |
| `uq_studios_name` | partial unique | `UNIQUE (name) WHERE deleted_at IS NULL` |
| `chk_studios_founded_year` | check | `founded_year IS NULL OR founded_year BETWEEN 1917 AND 2100` |
| `chk_studios_country_format` | check | `country IS NULL OR country ~ '^[A-Z]{2}$'` |

### 2.3 Indexes

| Index | Type | Columns | Purpose |
|-------|------|---------|---------|
| `pk_studios` | btree (unique) | `id` | PK. |
| `idx_studios_slug` | btree (unique, partial) | `slug` `WHERE deleted_at IS NULL` | Route `/studios/:slug`. |
| `idx_studios_name` | btree (unique, partial) | `name` `WHERE deleted_at IS NULL` | Name lookup / dedupe. |
| `idx_studios_sort_order` | btree | `sort_order` | Ordered studio listing. |
| `idx_studios_active` | btree | `is_active` `WHERE is_active = true` | Browse only active studios. |
| `idx_studios_country` | btree | `country` `WHERE country IS NOT NULL` | Filter by country. |

### 2.4 Decisions & Rationale

- **Soft-delete enabled (unlike genres):** Studios are more likely to be merged, renamed, or deprecated than genres. Soft-delete lets us retire a studio while preserving its historical `anime_studios` credits. A partial unique on `slug`/`name` frees the slug for reuse after soft-delete.
- **`name_jp` column:** Many studios are best known by their Japanese name. Storing it avoids transliteration at render time and supports bilingual UI.
- **`country` as ISO alpha-2:** A 2-letter code is compact, indexable, and standard. We don't need a full country table — the list is small and the code is self-documenting.
- **`founded_year` nullable:** Not all studios have a well-known founding year. We don't guess.
- **`logo_url` is a plain URL, not a foreign key:** Images are served via `next/image` + Cloudflare R2 loader. We don't need a separate media table for a single optional image per studio.
- **No `version` column:** Studio metadata is edited rarely and only by admins. Last-write-wins is acceptable; `audit_log` captures changes.

### 2.5 Relationship Recap

- `studios` 1 — * `anime_studios` * — 1 `anime` (many-to-many via join table; see `Anime.md` §4).
- A studio with existing `anime_studios` rows **must not** be hard-deleted — soft-delete or deactivate instead.

### 2.6 Seed Data (Illustrative)

The initial seed is ~200–500 studios (the active anime industry). Example:

| slug | name | name_jp | country | founded_year |
|------|------|---------|---------|--------------|
| `kyoto-animation` | Kyoto Animation | `京都アニメーション` | JP | 1981 |
| `mappa` | MAPPA | `株式会社MAPPA` | JP | 2011 |
| `ufotable` | ufotable | `ユーフォーテーブル` | JP | 2000 |
| `toei-animation` | Toei Animation | `東映アニメーション` | JP | 1948 |
| `wit-studio` | WIT STUDIO | `ウィットスタジオ` | JP | 2012 |
| `bones` | Bones | `ボンズ` | JP | 1998 |

> The full seed list lives in `tooling/scripts/seed-studios.ts` (future implementation).
