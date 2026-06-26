# Migration Strategy

> **Step 7 — Database Design**
> Defines how schema changes are versioned, applied, and rolled back safely in production. This is the operational companion to the schema definitions in the per-entity documents.

---

## 1. Purpose

Schema migrations are the **highest-risk operational action** in a production database. A bad migration can lock tables, corrupt data, or take the application down. This document defines a **safe, repeatable migration process** that protects our users' data and our uptime.

This is **documentation only** — the migration tooling (Drizzle Kit, migration files) is implemented in later milestones.

---

## 2. Guiding Principles

| Principle | Meaning |
|-----------|---------|
| **Migrations are immutable.** | Once a migration is applied to production, it is never edited. If it needs to change, write a new migration. |
| **Every migration is reversible.** | Every `UP` has a corresponding `DOWN` — except for data-transforming migrations, which are explicitly marked irreversible. |
| **No breaking changes without a transition.** | Column renames and type changes use a multi-migration transition (add → backfill → switch → drop). |
| **Migrations are applied, not reset.** | We never `DROP` and recreate the database in production. We migrate forward. |
| **Lock time is measured.** | Every migration is tested for lock duration before production. Long-running DDL is split or scheduled. |
| **Backups precede migrations.** | A verified backup (or Neon point-in-time recovery point) exists before any production migration. |

---

## 3. Migration Tooling

| Tool | Role |
|------|------|
| **Drizzle Kit** | Generates migration SQL from schema diffs (`drizzle-kit generate`). |
| **Drizzle ORM migrator** | Applies migrations (`drizzle-orm/migrator`). |
| **Neon branching** | Creates an ephemeral copy of production to test migrations before applying. |
| **pg_dump / pg_restore** | Full backups for disaster recovery (Neon handles PITR natively). |

We use **Drizzle Kit's generated SQL migrations**, not hand-written SQL, as the default. Hand-written SQL is permitted only for:

- Data backfills (transforming existing rows).
- Index creation `CONCURRENTLY` (Drizzle Kit doesn't generate `CONCURRENTLY`).
- Partitioning operations.

---

## 4. Migration File Convention

```
packages/db/src/migrations/
  0000_init.sql
  0001_add_anime_slug_index.sql
  0002_add_user_preferences.sql
  ...
  meta/
    _journal.json   # Drizzle's migration ledger
```

- Files are **zero-padded, sequentially numbered**, with a short descriptive slug.
- Each file contains **one logical change** (one table, one index, one column) — not a batch of unrelated changes.
- The `meta/_journal.json` ledger records which migrations have been applied. It is the source of truth for migration state.

---

## 5. The Migration Lifecycle

### 5.1 Development

1. Edit the Drizzle schema (`packages/db/src/schema/*.ts`).
2. Generate the migration: `pnpm db:generate`.
3. Review the generated SQL by eye — **never apply a migration you haven't read**.
4. Apply locally: `pnpm db:migrate`.
5. Test the application against the new schema.
6. Commit the migration file and the updated schema together.

### 5.2 Review

- Migrations are reviewed in PR like any other code.
- Reviewer checks: correctness of SQL, lock implications, reversibility, index necessity.
- Large migrations (> 100ms estimated lock time on production-sized data) require a **migration plan** in the PR description.

### 5.3 Staging

1. Apply the migration to a **staging database** (a Neon branch of production).
2. Run the application's test suite against staging.
3. Run `EXPLAIN ANALYZE` on hot queries to confirm no regression.
4. Measure lock duration with `pg_locks` monitoring.

### 5.4 Production

1. **Backup:** Confirm a recent PITR point exists (Neon does this automatically).
2. **Apply:** Run `pnpm db:migrate` against production (or use a CI job).
3. **Verify:** Check the application's health endpoints and error rates.
4. **Monitor:** Watch `pg_stat_activity` for blocked queries for 15 minutes post-migration.
5. **Rollback plan:** If something goes wrong, apply the `DOWN` migration (or restore from PITR).

---

## 6. Safe Migration Patterns

These patterns prevent downtime and data loss. Every migration in our codebase follows one of these.

### 6.1 Adding a Column (Safe)

```sql
-- Add nullable column (no table rewrite, instant)
ALTER TABLE anime ADD COLUMN trailer_url text;

-- Add column with default (Postgres 11+ is fast — no rewrite)
ALTER TABLE anime ADD COLUMN is_premium boolean NOT NULL DEFAULT false;
```

**Why safe:** Adding a nullable column or a column with a default is a metadata-only change in modern Postgres — no table rewrite, no long lock.

### 6.2 Adding an Index (Safe, with care)

```sql
-- Safe: doesn't lock the table for writes
CREATE INDEX CONCURRENTLY idx_anime_trailer_url ON anime (trailer_url);
```

**Why safe:** `CONCURRENTLY` builds the index without locking writes. **Caveat:** it can't run inside a transaction and is slower than a standard build. We run it outside the migration transaction if needed.

### 6.3 Renaming a Column (Multi-step, Safe)

A rename is **not** a single `ALTER TABLE RENAME` in production — it's a transition:

| Step | Migration | Effect |
|------|-----------|--------|
| 1 | Add new column `new_col`, keep `old_col`. | Both exist. |
| 2 | Backfill `new_col` from `old_col`. | Data is duplicated. |
| 3 | Deploy app code that writes to both columns. | App is dual-write. |
| 4 | Deploy app code that reads from `new_col`. | App is switched. |
| 5 | Drop `old_col`. | Old column removed. |

Each step is a separate migration, with deploys between them. This avoids any moment where the app and schema disagree.

### 6.4 Changing a Column Type (Multi-step, Safe)

Same pattern as rename: add a new column, backfill with a transform, switch the app, drop the old column. A direct `ALTER TABLE ALTER COLUMN TYPE` rewrites the whole table and locks it — unacceptable on a 100M-row table.

### 6.5 Dropping a Column (Safe, with care)

```sql
-- Step 1: stop writing to the column in app code (deploy).
-- Step 2: drop the column.
ALTER TABLE anime DROP COLUMN old_column;
```

**Why safe:** Dropping a column is a metadata-only change (the data stays on disk until the next `VACUUM`, but the column is invisible instantly). We stop writing first so no new data is lost.

### 6.6 Dropping a Table (Safe, with care)

```sql
-- Step 1: stop using the table in app code (deploy).
-- Step 2: rename the table (quarantine, don't drop yet).
ALTER TABLE old_table RENAME TO zombie_old_table;
-- Step 3: wait 30 days, then drop.
DROP TABLE zombie_old_table;
```

**Why safe:** Renaming instead of dropping gives us a 30-day window to recover if we discover a dependency we missed. The `zombie_` prefix makes it clear the table is deprecated.

### 6.7 Data Backfill (Risky — batched)

```sql
-- Backfill in batches to avoid long transactions
UPDATE anime SET slug = generate_slug(title) WHERE slug IS NULL AND id > :last_id ORDER BY id LIMIT 1000;
```

Run in a loop (application or script) until all rows are backfilled. Each batch is a short transaction that doesn't lock the table for long.

---

## 7. Dangerous Patterns (Forbidden)

| Pattern | Why forbidden | Safe alternative |
|---------|---------------|------------------|
| `ALTER TABLE … ALTER COLUMN TYPE` directly. | Rewrites whole table, long lock. | Multi-step add → backfill → switch → drop. |
| `CREATE INDEX` (without `CONCURRENTLY`). | Locks writes for the duration of the build. | `CREATE INDEX CONCURRENTLY`. |
| `DROP COLUMN` while app still writes to it. | Data loss. | Stop writing first, then drop. |
| `TRUNCATE` in a migration. | Destroys data, can't be rolled back easily. | Use only in test/seed migrations. |
| Editing an applied migration file. | Diverges production state from the file. | Write a new migration. |
| `VACUUM FULL` in a migration. | Rewrites the table, exclusive lock. | Run `VACUUM FULL` as a separate maintenance operation, not in a migration. |

---

## 8. Partitioning Strategy (Future)

When a table grows too large for efficient querying or purging, we **partition** it. Partitioning is a physical reorganization — the logical schema (and queries) stay the same.

### 8.1 Tables That Will Need Partitioning

| Table | Partition key | Strategy | When |
|-------|--------------|----------|------|
| `watch_history` | `watched_at` | Range (monthly) | > 50M rows (M5+). |
| `audit_log` | `created_at` | Range (yearly) | > 100M rows (M5+). |
| `notifications` | `created_at` | Range (monthly) | > 100M rows (M6+). |
| `search_history` | `searched_at` | Range (monthly) | > 100M rows (M6+). |

### 8.2 Partitioning Approach

1. Create a new partitioned table with the same schema.
2. Migrate data in batches from the old table.
3. Rename tables atomically (`ALTER TABLE … RENAME`).
4. Update the application to write to the new table (it already does — the name is the same).
5. Drop the old table after verification.

This is a **major migration** — it gets its own runbook, not a routine migration.

### 8.3 Why We Don't Partition Now

Partitioning adds complexity (query planning, index management, cross-partition queries). At M3 scale (< 100k users), a single table with good indexes is simpler and faster. We partition only when the data volume justifies it.

---

## 9. Rollback Strategy

| Scenario | Rollback |
|----------|----------|
| Migration fails mid-apply. | Postgres DDL is transactional — the failed statement rolls back. Fix the migration and retry. |
| Migration succeeds but app errors. | Apply the `DOWN` migration (if reversible) or restore from PITR. |
| Data corruption discovered later. | Restore from PITR to a point before the migration, then re-apply a fixed migration. |
| App and schema out of sync. | Roll back the app deploy first (instant), then decide on the migration. |

**PITR (Point-in-Time Recovery)** is our ultimate safety net. Neon supports PITR with a configurable retention window (default 7 days, extendable). We can restore the entire database to any second within that window.

---

## 10. Neon Branching for Migration Testing

Neon's branching feature lets us test migrations against a **copy of production data** without risk:

1. Create a branch from production: `neon branches create --name test/migration-foo`.
2. Apply the migration to the branch.
3. Run the application's test suite against the branch.
4. Measure lock duration and query performance.
5. If everything passes, apply to production.
6. Delete the branch.

This is our **standard pre-production validation** for any migration that touches a large table.

---

## 11. Migration Checklist

Before applying any migration to production, confirm:

- [ ] The migration SQL has been reviewed by a second engineer.
- [ ] The `DOWN` migration exists and has been tested locally.
- [ ] Lock implications are understood (measured on a production-sized dataset via Neon branch).
- [ ] A PITR point exists (Neon handles this automatically).
- [ ] The application code that depends on the schema change is already deployed (for additive changes) or will be deployed immediately after (for breaking changes).
- [ ] A rollback plan is documented in the PR.
- [ ] The migration is added to the migration ledger (`meta/_journal.json`).

---

## 12. Relationship to Other Documents

- **Schema definitions** (tables, columns, constraints) live in the per-entity documents and `Collections-or-Tables.md`.
- **Index changes** follow the rules in `Indexing-Strategy.md` (especially `CONCURRENTLY`).
- **Retention-driven purges** (deleting old rows) are defined in `Data-Retention.md` — they are **not** migrations, but they use the same batched-delete patterns.
- **Soft-delete columns** (`deleted_at`) are additive and safe — they follow the "adding a column" pattern in §6.1.
