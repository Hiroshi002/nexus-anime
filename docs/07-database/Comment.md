# Comment

> **Step 7 — Database Design**
> Defines the `comments` table — threaded comments on anime.

---

## 1. Purpose

A `comment` is a user-written message attached to an anime. Comments support **threading** (replies to replies), **spoiler marking**, and **soft-delete** (so a parent's children remain visible when the parent is removed).

**Design principle:** Comments are **user-generated content** — they require sanitization, moderation hooks, and careful delete semantics. We optimize for **threaded reads** and **moderation workflows**, not for write throughput.

---

## 2. `comments` Table

### 2.1 Fields

| Column              | Type            | Constraint                              | Description                                          |
| ------------------- | --------------- | --------------------------------------- | ---------------------------------------------------- |
| `id`                | `uuid`          | `PRIMARY KEY DEFAULT gen_random_uuid()` | Surrogate key.                                       |
| `user_id`           | `uuid`          | `NOT NULL` FK → `users.id`              | Author.                                              |
| `anime_id`          | `uuid`          | `NOT NULL` FK → `anime.id`              | Show the comment belongs to.                         |
| `parent_comment_id` | `uuid`          | nullable FK → `comments.id`             | Self-reference for threading. `NULL` = top-level.    |
| `body`              | `text`          | `NOT NULL`                              | Comment text. Sanitized via DOMPurify before render. |
| `is_spoiler`        | `boolean`       | `NOT NULL DEFAULT false`                | Spoiler flag (hidden until revealed).                |
| `is_pinned`         | `boolean`       | `NOT NULL DEFAULT false`                | Pinned to top by a moderator.                        |
| `is_hidden`         | `boolean`       | `NOT NULL DEFAULT false`                | Moderator-hidden (replaced with "[removed]").        |
| `upvote_count`      | `integer`       | `NOT NULL DEFAULT 0`                    | Denormalized upvotes (future voting feature).        |
| `reply_count`       | `integer`       | `NOT NULL DEFAULT 0`                    | Denormalized child count for display.                |
| `deleted_at`        | `timestamptz`   | nullable                                | Soft-delete marker.                                  |
| `created_at`        | `timestamptz`   | `NOT NULL DEFAULT now()`                | —                                                    |
| `updated_at`        | `timestamptz`   | `NOT NULL DEFAULT now()`                | —                                                    |
| `version`           | `integer`       | `NOT NULL DEFAULT 1`                    | Optimistic concurrency for edits.                    |
| `created_by`        | `uuid` nullable | FK → `users.id`                         | = `user_id`.                                         |
| `updated_by`        | `uuid` nullable | FK → `users.id`                         | Last editor (author or moderator).                   |

### 2.2 Constraints

| Name                             | Type  | Definition                                                                                                                                              |
| -------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chk_comments_body_length`       | check | `char_length(body) BETWEEN 1 AND 5000`                                                                                                                  |
| `chk_comments_parent_same_anime` | check | `parent_comment_id IS NULL OR anime_id = (SELECT anime_id FROM comments WHERE id = parent_comment_id)` — _enforced via application + trigger; see §2.7_ |
| `chk_comments_no_self_parent`    | check | `parent_comment_id IS NULL OR parent_comment_id <> id`                                                                                                  |

### 2.3 Indexes

| Index                        | Type           | Columns                                                                                | Purpose                                    |
| ---------------------------- | -------------- | -------------------------------------------------------------------------------------- | ------------------------------------------ |
| `pk_comments`                | btree (unique) | `id`                                                                                   | PK.                                        |
| `idx_comments_anime_created` | btree          | `(anime_id, created_at DESC)` `WHERE deleted_at IS NULL AND parent_comment_id IS NULL` | Top-level comments for a show (paginated). |
| `idx_comments_parent`        | btree          | `(parent_comment_id, created_at ASC)` `WHERE deleted_at IS NULL`                       | Replies to a comment (threaded).           |
| `idx_comments_user_id`       | btree          | `(user_id, created_at DESC)` `WHERE deleted_at IS NULL`                                | User's comment history.                    |
| `idx_comments_is_hidden`     | btree          | `is_hidden` `WHERE is_hidden = true`                                                   | Moderation queue.                          |
| `idx_comments_is_pinned`     | btree          | `(anime_id, is_pinned)` `WHERE is_pinned = true AND deleted_at IS NULL`                | Pinned comments.                           |

### 2.4 Decisions & Rationale

- **Self-referencing threading:** `parent_comment_id` creates a tree. Top-level comments have `parent_comment_id = NULL`. This is the simplest model that supports arbitrary-depth threads. We don't use a nested-set or path-enumeration model because our read pattern is "load top-level, then load replies on demand" — not "load the whole tree at once."
- **Soft-delete preserves threads:** When a comment is deleted, we set `deleted_at` and replace `body` with `[deleted]`. The row stays so its children remain visible and the thread structure is intact. This is the Reddit/Discord convention.
- **`is_hidden` vs `deleted_at`:** `deleted_at` = author removed it. `is_hidden` = moderator hid it (replaced with "[removed by moderator]"). Both hide the body but signal different causes to the UI.
- **`is_spoiler` is user-declared:** The author marks a comment as a spoiler. The UI blurs it until revealed. Moderators can override.
- **`is_pinned` is moderator-only:** Pinned comments float to the top of the comment section. The `idx_comments_is_pinned` index makes this a fast lookup.
- **Denormalized `upvote_count` / `reply_count`:** These are read on every comment render. Computing them via `COUNT(*)` on a 100M-row table per render is unacceptable. They are maintained by the application on vote/reply events and reconciled by a background job.
- **`version` for edits:** Authors can edit their comments. Optimistic concurrency prevents an edit from overwriting a moderator's `is_hidden` change. The `audit_log` captures the before/after body.
- **`body` is plain text, sanitized at render:** We don't store HTML. DOMPurify strips dangerous markup on output. This keeps the stored data clean and the rendering layer in control of presentation.

### 2.5 Threading Rules

| Rule                                                                                                                                  | Enforcement                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| A reply must belong to the same anime as its parent.                                                                                  | Application logic + trigger `trg_comments_parent_same_anime`.                              |
| A comment cannot be its own parent.                                                                                                   | `chk_comments_no_self_parent`.                                                             |
| Maximum thread depth is **application-enforced** (suggested: 4 levels). Deeper replies are flattened to the deepest allowed ancestor. | Application logic — not a DB constraint (depth is a UX choice, not a data integrity rule). |

### 2.6 Moderation Workflow

| Action             | Effect                                                         |
| ------------------ | -------------------------------------------------------------- |
| Author deletes     | `deleted_at = now()`, `body = '[deleted]'`.                    |
| Moderator hides    | `is_hidden = true`, `body = '[removed by moderator]'`.         |
| Moderator restores | `is_hidden = false`, restore original body (from `audit_log`). |
| Moderator pins     | `is_pinned = true`.                                            |

All moderation actions write an `audit_log` row with the moderator as `actor_id`.

### 2.7 Cross-Reference Integrity

The `chk_comments_parent_same_anime` rule ensures a reply's `anime_id` matches its parent's. Since a subquery `CHECK` constraint isn't natively supported, this is enforced by:

1. **Application logic** in the repository (primary defense).
2. **A trigger** `trg_comments_parent_check` that raises on mismatch (defense-in-depth).

### 2.8 Relationship Recap

- `users` 1 — \* `comments` (one-to-many; author).
- `anime` 1 — \* `comments` (one-to-many).
- `comments` self-reference 1 — \* `comments` (threading).
- On user erasure: comments are **preserved** with author label set to `[deleted]`. The `user_id` is anonymized (set to NULL or sentinel) but the comment body stays.
