# Audit Log

> **Step 7 — Database Design**
> Defines the `audit_log` table — an immutable record of every sensitive mutation in the system.

---

## 1. Purpose

`audit_log` is the **system of record for who did what, when, and what changed**. It captures every security-sensitive or business-critical mutation: role changes, email changes, account link/unlink, comment moderation, rating value changes, bookmark imports, and any action an admin performs.

**Design principle:** The audit log is **append-only, immutable, and never updated or deleted** (except by legal hold / legal deletion workflows). It is the last line of defense for compliance, incident investigation, and dispute resolution.

---

## 2. `audit_log` Table

### 2.1 Fields

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Surrogate key. |
| `actor_id` | `uuid` | nullable FK → `users.id` | Who performed the action. `NULL` for system actions. |
| `actor_context` | `jsonb` | `NOT NULL DEFAULT '{}'` | Snapshot of actor state (role, ip, session id) at action time. |
| `action` | `text` | `NOT NULL` | Verb + resource. See §2.3. |
| `resource_type` | `text` | `NOT NULL` | The entity type affected. See §2.4. |
| `resource_id` | `uuid` | nullable | The affected entity's id. `NULL` for actions without a single target. |
| `before` | `jsonb` | nullable | Snapshot of the entity before the change. |
| `after` | `jsonb` | nullable | Snapshot of the entity after the change. |
| `metadata` | `jsonb` | `NOT NULL DEFAULT '{}'` | Extra context (reason, source, correlation id). |
| `ip_address` | `inet` | nullable | Source IP of the actor. |
| `user_agent` | `text` | nullable | Client UA of the actor. |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | When the action occurred. |

### 2.2 Constraints

| Name | Type | Definition |
|------|------|------------|
| `chk_audit_log_action_format` | check | `action ~ '^[a-z]+\.[a-z_]+$'` (e.g. `user.role_change`) |
| `chk_audit_log_resource_type_range` | check | `resource_type IN ('user','user_account','anime','episode','season','comment','rating','bookmark','notification','studio','genre')` |
| `chk_audit_log_before_after_not_both_null` | check | `before IS NOT NULL OR after IS NOT NULL` |

### 2.3 Action Format

Actions follow the `{resource}.{verb}` convention:

| Action | Meaning |
|--------|---------|
| `user.create` | Account created. |
| `user.role_change` | Role modified. |
| `user.email_change` | Email modified. |
| `user.soft_delete` / `user.restore` | Soft-deleted / restored. |
| `user.hard_delete` | GDPR erasure. |
| `user_account.link` / `user_account.unlink` | OAuth/credential linked/unlinked. |
| `anime.create` / `anime.update` / `anime.soft_delete` / `anime.restore` | Catalog mutations. |
| `episode.create` / `episode.update` / `episode.soft_delete` | Episode mutations. |
| `comment.create` / `comment.update` / `comment.soft_delete` / `comment.hide` / `comment.pin` | Comment lifecycle + moderation. |
| `rating.create` / `rating.update` / `rating.soft_delete` | Rating lifecycle. |
| `bookmark.create` / `bookmark.update` / `bookmark.soft_delete` | Bookmark lifecycle. |
| `notification.create` | Notification dispatched. |
| `system.export` / `system.import` | Bulk operations. |

### 2.4 Resource Types

| Value | Entity |
|-------|--------|
| `user` | `users` |
| `user_account` | `user_accounts` |
| `anime` | `anime` |
| `episode` | `episodes` |
| `season` | `seasons` |
| `comment` | `comments` |
| `rating` | `ratings` |
| `bookmark` | `bookmarks` |
| `notification` | `notifications` |
| `studio` | `studios` |
| `genre` | `genres` |

### 2.5 Indexes

| Index | Type | Columns | Purpose |
|-------|------|---------|---------|
| `pk_audit_log` | btree (unique) | `id` | PK. |
| `idx_audit_log_actor_created` | btree | `(actor_id, created_at DESC)` | "What did this user do?" |
| `idx_audit_log_resource` | btree | `(resource_type, resource_id, created_at DESC)` | "History of this entity." |
| `idx_audit_log_action` | btree | `(action, created_at DESC)` | "All role changes." |
| `idx_audit_log_created_at` | btree | `created_at` | Retention/partition scans. |
| `idx_audit_log_metadata` | GIN | `metadata` | Lookup by correlation id or arbitrary key. |

### 2.6 Decisions & Rationale

- **Append-only, no `updated_at`, no `deleted_at`:** Audit rows are **immutable**. We never update or delete them in the normal course of business. This is the defining property of an audit log — if it can be changed, it's not auditable.
- **`actor_id` nullable:** Some actions are system-initiated (e.g. a scheduled job that soft-deletes expired sessions). `actor_id = NULL` signals "system actor." The `actor_context` column captures what we know.
- **`actor_context` snapshot:** We store a JSON snapshot of the actor's role, ip, and session id **at the time of the action**. This is critical — if an admin is later demoted, the audit log still shows they had admin rights when they performed the action.
- **`before` / `after` snapshots:** The full before/after state of the changed entity, as JSON. This lets investigators reconstruct what changed without querying the live table (which may have changed since). For large entities, we store only the **changed fields** to save space.
- **`resource_id` nullable:** Some actions (e.g. `system.import` of 1000 anime) don't have a single target. `resource_id` is NULL; `metadata` carries the bulk details.
- **`ip_address` as `inet`:** Native IP type supports range queries (e.g. "all actions from this /24") for incident investigation.
- **`metadata` for correlation:** A `correlation_id` in `metadata` links the audit row to the request log, the API response, and any related audit rows. This is the glue for distributed tracing.
- **No `version` column:** Audit rows are never mutated, so optimistic concurrency is irrelevant.

### 2.7 What Gets Audited

| Always audited | Never audited |
|----------------|---------------|
| Role changes, email changes, account link/unlink | Read operations (viewing a page, listing anime) |
| Soft-delete / restore of user-owned entities | Watch history inserts (too high-volume; sampled if needed) |
| Comment moderation (hide, pin, delete) | Search history inserts (too high-volume) |
| Rating value changes (affects aggregates) | Playback heartbeats |
| Admin catalog edits | Cache reads/writes |
| GDPR erasure events | |

The line is **security-sensitive or aggregate-affecting mutations**. High-volume, low-risk events (watch history, search) are excluded to keep the audit log manageable.

### 2.8 Immutability Enforcement

Immutability is enforced at **three layers**:

1. **Application:** The audit repository exposes only an `insert` method — no `update` or `delete`.
2. **Database:** A trigger `trg_audit_log_immutable` raises an exception on `UPDATE` or `DELETE`.
3. **Access control:** The database user used by the application has `INSERT` but not `UPDATE`/`DELETE` on `audit_log`. A separate admin user (used only by migrations and legal-hold workflows) can delete under strict controls.

### 2.9 Retention

- Audit logs are retained for **7 years** (regulatory compliance baseline).
- They are **partitioned by `created_at`** (range, yearly) for cheap archival of old partitions.
- Legal-hold workflows may extend retention for specific `actor_id` or `resource_id` values.
- See `Data-Retention.md` for the full retention schedule.

### 2.10 Relationship Recap

- `users` 1 — * `audit_log` (one-to-many; as actor).
- `audit_log` references many entity types via `resource_type` + `resource_id` — but these are **not** foreign keys. The audit log must survive the deletion of the referenced entity, so we can't enforce FK constraints. The `resource_id` is a logical pointer, not a database constraint.
- On user erasure: **audit rows are preserved**. The `actor_id` is retained (it's needed for the audit trail), but `actor_context` is scrubbed of PII (ip, session id) per GDPR. The action history is not the user's data — it's the platform's record.
