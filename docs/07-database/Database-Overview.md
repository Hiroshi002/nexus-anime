# Database Overview

> **Step 7 — Database Design**
> Lead Backend Architect & Database Engineer
> Status: Design document (no implementation)

## 1. Purpose

This document defines the production-ready database architecture for **Nexus Anime**, a premium anime streaming platform targeting **millions of users**. It is the authoritative reference for schema design, engine selection, and data strategy. All subsequent entity documents (`User.md`, `Anime.md`, …) expand the details introduced here.

This is **documentation only** — no DDL, no application code, no migrations are produced in this step.

---

## 2. Scope

The database owns the **system of record** for:

- **Identity & access** — users, accounts, sessions, roles (Auth.js v5 backed).
- **Catalog** — anime, episodes, seasons, genres, studios, and their relationships.
- **Engagement** — watch history, continue-watching cursors, bookmarks, comments, ratings.
- **Operations** — notifications, search history, audit log.

**Out of scope (separate stores):**

| Concern | Store | Why |
|---------|-------|-----|
| Session cache, rate limits, feature flags | Upstash Redis (`@nexus/cache`) | Sub-millisecond access, TTL-native, fail-open semantics. |
| Full-text / fuzzy search index | Meilisearch / Postgres `tsvector` (see §6) | Search is a derived view, not the system of record. |
| Video blobs & manifests | Cloudflare Stream R2 | Object storage, not relational. |
| Analytics events | ClickHouse / BigQuery (future) | Columnar workload; not yet in M3. |

---

## 3. Recommended Engine

### 3.1 Selection: **PostgreSQL 16+ on Neon**

We standardize on **PostgreSQL** as the sole relational engine, provisioned through **Neon** (serverless Postgres) on Vercel.

### 3.2 Why PostgreSQL

| Requirement | How PostgreSQL satisfies it |
|-------------|----------------------------|
| **Relational integrity** | Foreign keys, check constraints, exclusion constraints, transactional DDL. |
| **Rich types** | `uuid`, `timestamptz`, `text`, `int4`, `jsonb`, arrays, `tsvector`, `citext` (case-insensitive text). |
| **Extensibility** | `pg_trgm` (trigram fuzzy search), `uuid-ossp`/`gen_random_uuid()`, `pgcrypto`, PostGIS (future localization). |
| **Ecosystem** | First-class Drizzle ORM support, Neon serverless, Vercel Postgres connector, mature tooling (`pg_dump`, logical replication). |
| **JSON where relational is overkill** | `jsonb` for semi-structured payloads (TMDB/AniList import metadata, notification payloads) with GIN indexing. |
| **Concurrency** | MVCC, row-level locking, `SELECT … FOR UPDATE` for cursor-style continue-watching updates. |
| **Operational maturity** | Point-in-time recovery, logical replication, `pg_stat_statements`, well-understood vacuuming. |

### 3.3 Why Neon specifically

- **Serverless scaling** — compute scales to zero, autoscales under load. Matches Vercel's serverless/edge model.
- **Branching** — database branches mirror git branches; enables ephemeral preview databases per PR.
- **Scale-to-zero cost control** — fits the M3 milestone budget before the platform has paying users.
- **Native Vercel integration** — env-var wiring, log drain, connection pooling via `@neondatabase/serverless`.

### 3.4 Alternatives Considered

| Alternative | Trade-off | Verdict |
|-------------|-----------|---------|
| **MySQL 8 (PlanetScale)** | Weaker JSON querying, no true `uuid` native type, fewer advanced indexes; PlanetScale's branching is nice but Drizzle's Postgres dialect is more mature. | Rejected — Postgres' `jsonb` + GIN + `pg_trgm` better serve catalog metadata and search. |
| **SQLite (Turso)** | Excellent for edge/local, but lacks concurrent-write scaling, row-level locking, and the operational tooling we need at millions-of-users scale. | Rejected for production; acceptable for local dev only. |
| **MongoDB Atlas** | Document model fits catalog metadata, but sacrifices relational integrity for watch history ↔ user ↔ episode joins, and complicates transactions across engagement writes. | Rejected — our access patterns are strongly relational. |
| **CockroachDB / YugabyteDB** | Distributed SQL, but operational complexity and cost are unjustified pre-product-market fit. | Deferred — revisit at M5+ if multi-region write latency becomes a bottleneck. |
| **DynamoDB** | Serverless, but key-value model forces denormalization and GSIs for every access pattern; expensive at our query diversity. | Rejected. |

### 3.5 Trade-offs of the Postgres-on-Neon choice

| Benefit | Cost |
|---------|------|
| Strong consistency & integrity | Not a global distributed DB — single primary region (read replicas via Neon for read scaling). |
| Serverless scale-to-zero | Cold-start latency on idle compute mitigated by Neon's connection pooling + our app-level pool (`@nexus/db`). |
| Rich types & extensions | Vendor-specific (Neon) — mitigated by sticking to standard Postgres features and Drizzle's dialect abstraction. |
| Branching for previews | Branch schema drift must be managed via migration tooling (see `Migration-Strategy.md`). |

---

## 4. Cross-Cutting Design Decisions

These decisions apply to **every table** unless an entity document explicitly overrides them. Centralizing them here avoids repeating the same rationale 20 times.

### 4.1 Primary Keys

- **All tables use `uuid` primary keys** (`gen_random_uuid()`), **not** auto-increment integers.
- **Rationale:**
  - Prevents ID enumeration (security — an attacker can't guess the next user/anime by incrementing).
  - Enables safe client-side ID generation and offline-first patterns.
  - Simplifies future horizontal sharding / multi-region merge (no sequence collisions).
  - Safe across Neon branching (no sequence state to diverge).
- **Natural keys** (e.g. `(user_id, anime_id)` for a bookmark) are expressed as **unique constraints**, not primary keys — they remain stable even if business rules evolve.

### 4.2 Timestamps

Every table carries:

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `created_at` | `timestamptz` | `now()` | Insertion time (immutable). |
| `updated_at` | `timestamptz` | `now()` (via trigger) | Last mutation time. |

- We use **`timestamptz`** (timestamp with time zone), never `timestamp`. Stored as UTC; the application layer renders in the user's locale.
- `updated_at` is maintained by a **single shared trigger function** (`touch_updated_at()`) to avoid drift across tables.

### 4.3 Soft Deletes

- Mutable entities carry a **`deleted_at timestamptz`** column (nullable).
- A row is "deleted" when `deleted_at IS NOT NULL`.
- **Rationale:** supports account recovery, audit trails, and safe cascades without destroying history.
- **Unique constraints must account for soft deletes** — e.g. a partial unique index `WHERE deleted_at IS NULL` so a user can re-register a previously-deleted handle.
- **Hard deletes** are reserved for:
  - GDPR/CCPA right-to-erasure requests (see `Data-Retention.md`).
  - Truly ephemeral data (expired sessions, old search history past retention).
- **Cascade rule:** soft-deleting a parent (e.g. an anime) does **not** hard-delete children; children remain queryable for historical engagement. Referential integrity is preserved because the parent row still exists.

### 4.4 Audit Fields

Writeable tables that mutate business state include:

| Column | Type | Purpose |
|--------|------|---------|
| `created_by` | `uuid` (nullable, FK → `users.id`) | Who created it (nullable for system-generated rows). |
| `updated_by` | `uuid` (nullable, FK → `users.id`) | Who last mutated it. |

These are **application-populated** (from the Auth.js session), not trigger-maintained, because "who" is a domain concept. The `audit_log` table (see `Audit-Log.md`) captures the full before/after, timestamp, and actor for every sensitive mutation — `created_by`/`updated_by` are convenience pointers on the row itself.

### 4.5 Versioning (Optimistic Concurrency)

- High-contention tables (episodes, comments, ratings, continue-watching) carry a **`version integer NOT NULL DEFAULT 1`** column.
- Updates increment `version` and include `WHERE id = :id AND version = :expected_version`.
- On a version mismatch, the application returns `409 Conflict` and the client retries with fresh state.
- **Rationale:** avoids lost updates without pessimistic locks — critical for continue-watching cursors that multiple devices may update concurrently.

### 4.6 Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Tables | `snake_case`, plural | `anime`, `watch_history`, `anime_genres` |
| Columns | `snake_case` | `created_at`, `poster_url` |
| Primary key | always `id` | `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` |
| Foreign keys | `{entity}_id` | `user_id`, `anime_id`, `episode_id` |
| Join tables | `{a}_{b}` alphabetical | `anime_genres`, `anime_studios` |
| Indexes | `idx_{table}_{cols}` | `idx_watch_history_user_id_created_at` |
| Unique constraints | `uq_{table}_{cols}` | `uq_bookmarks_user_id_anime_id` |
| Check constraints | `chk_{table}_{rule}` | `chk_ratings_value_range` |

### 4.7 Data Type Defaults

| Domain | Type | Notes |
|--------|------|-------|
| Primary/Foreign key | `uuid` | `gen_random_uuid()` (pg13+ built-in). |
| Short text (titles, names) | `text` | Postgres `text` ≈ `varchar` with no length penalty; add a `CHECK(char_length <= N)` where business rules require it. |
| Long text (descriptions, comments) | `text` | Validated by Zod at the API boundary. |
| Slugs | `text` | Unique, URL-safe, indexed. |
| URLs | `text` | Validated by Zod (`z.string().url()`); not `varchar(2048)` (URLs have no practical fixed max). |
| Counts / small ints | `integer` | `int4` is sufficient; `bigint` only for counters that may exceed 2^31 (view counts). |
| Large counters | `bigint` | View counts, watch minutes aggregates. |
| Ratings / decimals | `numeric(3,2)` | Exact decimal, avoids float rounding. |
| Booleans | `boolean` | With `NOT NULL DEFAULT false/true`; never nullable booleans. |
| Timestamps | `timestamptz` | Always UTC. |
| Semi-structured JSON | `jsonb` | Never `json` (no indexing); `jsonb` is indexable via GIN. |
| Case-insensitive identifiers | `citext` (extension) | Emails, usernames — avoids `lower()` gymnastics and unique-index pitfalls. |
| Arrays | `text[]` / `integer[]` | Only when a GIN index backs them; otherwise normalize to a join table. |

### 4.8 Enum Handling

- **Prefer `text` + `CHECK` constraints** over Postgres `ENUM` types for domain values that may evolve (e.g. `anime_status: 'airing' | 'finished' | 'upcoming'`).
- **Rationale:** adding a value to a Postgres `ENUM` requires an `ALTER TYPE` that locks the table; a `CHECK` constraint can be `DROP`/`ADD` in a single transaction without a full rewrite.
- **Exception:** truly static, performance-critical enums (e.g. notification delivery channel) may use a native `ENUM` — documented case-by-case.
- All enum values are also encoded as **Zod enums** in `@nexus/db` so the application and database agree on a single source of truth.

### 4.9 JSONB Usage Rules

`jsonb` is permitted **only** for:

1. **Imported upstream metadata** (TMDB/AniList raw payloads) — kept for reprocessing/debugging, not queried for business logic.
2. **Notification payloads** — variable shape per notification type.
3. **Audit log `before`/`after` snapshots** — the diff target.

`jsonb` is **not** a substitute for normalized columns. Any field that appears in a `WHERE`, `ORDER BY`, or join condition must be a real column with an index.

---

## 5. Access Layer

- **Drizzle ORM** (`@nexus/db`) is the **only** database access layer. No raw SQL in application code, except inside migration files or repository modules.
- **Connection pooling:** Neon's built-in pooler + a thin app-level pool. Serverless functions use the `@neondatabase/serverless` driver; long-lived processes use `pg`.
- **Read replicas:** read-heavy catalog queries (anime detail, episode list) may target a Neon read-replica via a separate Drizzle instance; writes always hit the primary.
- **Query rules:**
  - Select only needed columns — no `SELECT *`.
  - Cursor-based pagination for infinite scroll (watch history, comments).
  - Transactions for multi-statement writes (e.g. appending watch history + updating continue-watching + incrementing view count).

---

## 6. Search Strategy (Boundary Note)

Relational queries use B-tree and GIN indexes (see `Indexing-Strategy.md`). **Full-text and fuzzy search** (anime titles, studio names) is a derived concern:

- **Primary:** Postgres `tsvector` + GIN for title/description search — zero extra infrastructure, good enough for M3.
- **Future:** Meilisearch for typo-tolerant, ranked search — the `anime` table publishes changes to the search index via an outbox/CDC pattern (not in M3 scope).

This document set owns the relational schema; search-index population is an application-layer concern documented in `docs/architecture/Caching-Strategy.md` and the future search ADR.

---

## 7. Scalability & Milestones

| Phase | Scale | Strategy |
|-------|-------|----------|
| **M3 (current)** | < 100k users, single region | Single Neon primary, read replica optional, soft deletes + indexes. |
| **M4–M5** | 100k–1M users | Read replicas for catalog, connection pooling tuned, materialized views for trending aggregates. |
| **M6+** | 1M+ users | Evaluate sharding by `user_id` hash for engagement tables (watch history, bookmarks); multi-region read replicas; columnar offload for analytics. |

The schema is designed so that **no column changes are required** to move from M3 to M6 — only physical partitioning and index additions.

---

## 8. Security & Compliance

- **No secrets in the database** — API keys, Stripe tokens, and OAuth credentials live in Vault/Env, never in tables.
- **PII minimization** — store only what's needed; `email` is `citext` and unique; `username` is the public identifier.
- **Encryption at rest** — Neon provides this by default; application-level encryption for highly sensitive fields (e.g. government ID, if ever required) via `pgcrypto`.
- **Row-level security (RLS)** — considered but **not enabled by default**; the application enforces ownership via `WHERE user_id = :me` in Drizzle. RLS may be layered on at M5+ as a defense-in-depth measure.
- **GDPR/CCPA** — right-to-erasure implemented via hard-delete workflows in `Data-Retention.md`; soft deletes alone do not satisfy erasure.

---

## 9. How to Read This Document Set

1. Start here (overview, engine, cross-cutting rules).
2. `Entity-Relationship-Diagram.md` — the visual map of tables and relationships.
3. `Collections-or-Tables.md` — the full table inventory in one place.
4. Per-entity docs (`User.md` … `Audit-Log.md`) — field-level detail.
5. `Indexing-Strategy.md`, `Data-Retention.md`, `Migration-Strategy.md` — operational concerns.

Every decision in the per-entity docs traces back to a rule in this overview. If you find a contradiction, this overview wins and the entity doc should be corrected.
