# Data Retention

> **Step 7 — Database Design**
> Defines how long each category of data is kept, how it's purged, and the legal/compliance rationale. This is the operational companion to the soft-delete and anonymization rules in the per-entity documents.

---

## 1. Purpose

A streaming platform at millions-of-users scale **cannot keep everything forever**. Unbounded growth makes queries slower, backups longer, and compliance risk higher. This document defines a **retention schedule** for every table — how long raw data lives, how it's disposed of, and what (if anything) is retained in aggregated form.

This is **documentation only** — the purge jobs and anonymization workflows it describes are implemented in later milestones.

---

## 2. Retention Principles

| Principle | Meaning |
|-----------|---------|
| **Minimize first.** | Collect only what we need, keep it only as long as we need it. |
| **Anonymize before deleting.** | When we dispose of PII, we first sever the link to the person, then keep the statistical value. |
| **Aggregate before purging.** | High-volume raw data (watch events, searches) is rolled up into daily summaries before the raw rows are deleted. |
| **Audit log is sacred.** | The audit log is retained for compliance even when the underlying data is deleted. |
| **Respect the law.** | GDPR (EU), CCPA (California), and other regulations drive minimum and maximum retention periods. |
| **Automate everything.** | Retention is enforced by scheduled jobs, not human memory. |

---

## 3. Retention Schedule

### 3.1 Per-Table Retention

| Table | Raw retention | Disposition after retention | Aggregates retained? | Rationale |
|-------|--------------|----------------------------|----------------------|-----------|
| `users` | Until erasure request | Hard-delete (GDPR) or anonymize. | No. | User data belongs to the user; they can request deletion anytime. |
| `user_accounts` | Life of user | Hard-delete with user. | No. | Credentials are PII; no value after account closure. |
| `user_sessions` | 30 days or until expiry | Hard-delete (whichever first). | No. | Sessions are ephemeral by nature. |
| `anime` | Until catalog removal | Soft-delete → hard-delete after 90 days. | No. | Catalog data is re-importable from upstream. |
| `seasons` | Life of anime | Soft-delete with anime. | No. | Same as anime. |
| `episodes` | Life of anime | Soft-delete with anime. | No. | Same as anime. |
| `genres` | Indefinite | Deactivate, never delete. | N/A | Tiny taxonomy; historical associations must survive. |
| `studios` | Indefinite | Soft-delete (reversible). | N/A | Small taxonomy; historical credits must survive. |
| `anime_genres` / `anime_studios` | Life of anime | Hard-delete with anime. | No. | Associations are re-importable. |
| `watch_history` | **90 days** raw | Anonymize `user_id`, then purge raw rows after 1 year. | **Yes** — daily per-anime view counts, monthly per-user watch time. | Raw events are huge; aggregates preserve analytics. |
| `continue_watching` | Life of user | Hard-delete with user. | No. | Cursors are personal; no value after account closure. |
| `bookmarks` | Life of user (active); 30 days after soft-delete | Hard-delete 30 days after `deleted_at`. | No. | Removed bookmarks have no long-term value. |
| `comments` | Life of user | Soft-delete only; preserved on erasure as `[deleted]`. | No. | Community content outlives the account. |
| `ratings` | Life of user (active); until erasure | Hard-delete on user erasure. | **Yes** — per-anime rating distribution (count per score bucket). | Individual ratings are PII; the distribution is valuable. |
| `notifications` | 90 days | Hard-delete on expiry. | No. | Notifications are ephemeral by nature. |
| `search_history` | 30 days | Hard-delete. | **Yes** — anonymized top-query trends (no user link). | Raw queries are PII-adjacent; trends are valuable. |
| `audit_log` | **7 years** | Partitioned by year; archived to cold storage after 2 years. | No. | Regulatory compliance baseline. |

### 3.2 Retention Summary by Duration

| Duration | Tables |
|----------|--------|
| 30 days | `user_sessions`, `search_history`, `bookmarks` (after soft-delete) |
| 90 days | `watch_history` (raw), `notifications`, `anime` (soft-delete grace) |
| 1 year | `watch_history` (anonymized raw) |
| Life of user | `user_accounts`, `continue_watching`, `comments`, `ratings` (active) |
| 7 years | `audit_log` |
| Indefinite | `genres`, `studios`, `comments` (preserved) |

---

## 4. Disposition Workflows

### 4.1 Anonymization (before deletion)

Used when we want to **keep the statistical value** of data but **remove the link to the person**.

**`watch_history` anonymization:**
1. Set `user_id = NULL` (or a sentinel `00000000-0000-0000-0000-000000000000`).
2. Null out `device`, `os`, `browser`, `country`, `app_version`.
3. Keep `anime_id`, `episode_id`, `watched_at`, `watch_duration_seconds`, `completion_pct`.

**`search_history` anonymization (for trend aggregates):**
1. Strip `user_id` from the aggregate — the trend table stores only `(date, query_normalized, count)`.
2. The raw `search_history` rows are hard-deleted; the anonymized trend survives.

**`audit_log` scrubbing (on user erasure):**
1. Retain the audit row (it's the platform's record).
2. Scrub `actor_context` of PII (ip, session id, email).
3. Keep `actor_id` (needed for the audit trail) but it now points to a non-existent user — acceptable for an immutable log.

### 4.2 Aggregation (before purging)

Used for **high-volume tables** where the raw data is too big to keep but the trends are valuable.

**`watch_history` → daily rollup:**
```sql
-- Daily per-anime aggregate (retained indefinitely)
INSERT INTO stats.anime_daily_views (anime_id, date, total_views, unique_viewers, total_minutes)
SELECT anime_id, watched_at::date, COUNT(*), COUNT(DISTINCT user_id), SUM(watch_duration_seconds)/60
FROM watch_history
WHERE watched_at::date = :yesterday
GROUP BY anime_id, watched_at::date;
```
After the rollup, raw rows older than 90 days are purged.

**`search_history` → trend aggregate:**
```sql
INSERT INTO stats.daily_search_trends (date, query_normalized, count)
SELECT searched_at::date, query_normalized, COUNT(*)
FROM search_history
WHERE searched_at::date = :yesterday
GROUP BY searched_at::date, query_normalized;
```

> **Note:** The `stats.*` tables above are illustrative — a separate analytics schema is out of M3 scope but anticipated in M5+.

### 4.3 Hard Deletion

Used when data has **no further value** and **no compliance reason to keep**.

- `DELETE FROM user_sessions WHERE expires_at < now();` — nightly.
- `DELETE FROM search_history WHERE searched_at < now() - interval '30 days';` — nightly.
- `DELETE FROM notifications WHERE expires_at < now();` — nightly.
- `DELETE FROM watch_history WHERE watched_at < now() - interval '1 year' AND user_id IS NULL;` — monthly (anonymized rows only).

All deletes are **batched** (e.g. `DELETE … LIMIT 10000` in a loop) to avoid long-running transactions and table bloat.

### 4.4 Soft-Delete Grace Period

When a user soft-deletes an entity (bookmark, rating, comment), we wait **30 days** before hard-deleting. This gives the user a window to undo the deletion. After 30 days, a job hard-deletes the row.

---

## 5. Compliance Mapping

| Regulation | Requirement | How we satisfy it |
|------------|-------------|-------------------|
| **GDPR (EU)** | Right to erasure (Art. 17). | Hard-delete workflows for all user data; anonymization for statistical data. |
| **GDPR** | Data minimization (Art. 5). | Retention schedules enforce minimum necessary retention. |
| **GDPR** | Storage limitation (Art. 5). | Automated purge jobs enforce maximum retention. |
| **CCPA (California)** | Right to delete. | Same erasure workflows; no sale of personal data (we don't sell data). |
| **COPPA (US)** | Parental consent for <13. | Age gate at signup; accounts <13 require verified parental consent (future). |
| **PCI-DSS** | Card data handling. | We never store raw card data — Stripe handles it. No DB impact. |
| **SOC 2** | Audit trail. | 7-year audit log retention; immutable audit rows. |

---

## 6. Storage Impact

Without retention, storage grows unbounded:

| Table | Annual growth (no retention) | Annual growth (with retention) |
|-------|------------------------------|-------------------------------|
| `watch_history` | ~100 GB/year | ~25 GB (90 days raw) + ~2 GB (aggregates) |
| `audit_log` | ~30 GB/year | ~30 GB/year (7-year retention, archived after 2) |
| `search_history` | ~15 GB/year | ~1.5 GB (30 days) + ~0.5 GB (trends) |
| `notifications` | ~50 GB/year | ~12 GB (90 days) |

Retention reduces **annual storage growth by ~60%** and keeps query performance stable over time.

---

## 7. Implementation Notes (Future)

| Concern | Approach |
|---------|----------|
| **Purge scheduling** | Cron jobs (or a job queue like Inngest/Temporal) run nightly. |
| **Batching** | Deletes are batched in 10k-row chunks with `pg_sleep` between chunks to limit replication lag. |
| **Monitoring** | Alert if a purge job fails or if table growth exceeds forecast. |
| **Testing** | Retention jobs are tested against a clone of production data (Neon branching) before deployment. |
| **Reversibility** | Soft-deleted data is recoverable for 30 days. Hard-deleted data is **not** recoverable — operators must confirm before running hard-delete jobs. |

---

## 8. Relationship to Other Documents

- **Soft-delete columns** are defined per-entity in their respective documents (`User.md`, `Anime.md`, …).
- **Anonymization rules** are defined per-entity; this document schedules when they run.
- **Partitioning** (needed to make purging cheap on huge tables) is defined in `Migration-Strategy.md`.
- **Audit log immutability** is defined in `Audit-Log.md`; this document defines its 7-year retention.
