# Bookmark

> **Step 7 — Database Design**
> Defines the `bookmarks` table — user watchlists / "my list" entries.

---

## 1. Purpose

A `bookmark` represents a user's intent to **save an anime for later** — their personal watchlist. It is the simplest engagement entity: a user either has a show in their list or doesn't, with an optional personal note.

**Design principle:** Bookmarks are **user-owned, set-semantics** data. One active bookmark per (user, show). Soft-delete is enabled so a user can remove and re-add a show without losing history (e.g. re-adding restores the original `created_at` and note).

---

## 2. `bookmarks` Table

### 2.1 Fields

| Column                  | Type            | Constraint                              | Description                                           |
| ----------------------- | --------------- | --------------------------------------- | ----------------------------------------------------- |
| `id`                    | `uuid`          | `PRIMARY KEY DEFAULT gen_random_uuid()` | Surrogate key.                                        |
| `user_id`               | `uuid`          | `NOT NULL` FK → `users.id`              | Owner.                                                |
| `anime_id`              | `uuid`          | `NOT NULL` FK → `anime.id`              | Saved show.                                           |
| `note`                  | `text`          | nullable                                | Personal note (e.g. "watch with Sarah").              |
| `sort_order`            | `integer`       | `NOT NULL DEFAULT 0`                    | Manual ordering within the user's list.               |
| `notify_on_new_episode` | `boolean`       | `NOT NULL DEFAULT true`                 | Opt into notifications for new episodes.              |
| `deleted_at`            | `timestamptz`   | nullable                                | Soft-delete marker (removal from list).               |
| `created_at`            | `timestamptz`   | `NOT NULL DEFAULT now()`                | When first bookmarked.                                |
| `updated_at`            | `timestamptz`   | `NOT NULL DEFAULT now()`                | Last mutation.                                        |
| `created_by`            | `uuid` nullable | FK → `users.id`                         | = `user_id` (self-owned; kept for audit consistency). |
| `updated_by`            | `uuid` nullable | FK → `users.id`                         | Last mutator.                                         |

### 2.2 Constraints

| Name                        | Type           | Definition                                            |
| --------------------------- | -------------- | ----------------------------------------------------- |
| `uq_bookmarks_user_anime`   | partial unique | `UNIQUE (user_id, anime_id) WHERE deleted_at IS NULL` |
| `chk_bookmarks_note_length` | check          | `char_length(note) <= 500`                            |

### 2.3 Indexes

| Index                      | Type                    | Columns                                                                  | Purpose                              |
| -------------------------- | ----------------------- | ------------------------------------------------------------------------ | ------------------------------------ |
| `pk_bookmarks`             | btree (unique)          | `id`                                                                     | PK.                                  |
| `idx_bookmarks_user_id`    | btree                   | `(user_id, sort_order)` `WHERE deleted_at IS NULL`                       | User's watchlist (ordered).          |
| `idx_bookmarks_user_anime` | btree (unique, partial) | `(user_id, anime_id)` `WHERE deleted_at IS NULL`                         | "Is this in my list?" toggle check.  |
| `idx_bookmarks_anime_id`   | btree                   | `anime_id` `WHERE deleted_at IS NULL`                                    | Bookmark count for a show.           |
| `idx_bookmarks_notify`     | btree                   | `(anime_id)` `WHERE notify_on_new_episode = true AND deleted_at IS NULL` | Notification fan-out on new episode. |

### 2.4 Decisions & Rationale

- **Soft-delete with partial unique:** A user removes a show from their list → `deleted_at` is set. They re-add it → a new row is inserted (or the old one restored). The partial unique ensures only **one active** bookmark per (user, show) at a time. This is the standard "re-addable watchlist" pattern.
- **`note` is personal, not public:** A bookmark note is visible only to the owner. It is not sanitized as HTML (plain text only) — DOMPurify is applied at render to prevent XSS.
- **`sort_order` is manual:** Users can reorder their list. An integer column lets the UI implement drag-and-drop without a linked list. Gaps are allowed (we don't require contiguous values).
- **`notify_on_new_episode` defaults true:** Most users want to know when a show they saved gets a new episode. The opt-out is explicit. The `idx_bookmarks_notify` index powers the fan-out query when a new episode is published.
- **No `version` column:** Bookmarks are owned by a single user and updated rarely. Last-write-wins is acceptable; the `audit_log` captures significant changes (note edits, notification opt-out).
- **`created_by`/`updated_by` present:** Bookmarks are user-owned and human-edited, so audit pointers are meaningful. `created_by` always equals `user_id`.

### 2.5 Toggle Semantics

The "Add to List" / "Remove from List" button is a **toggle**:

| State                                   | Action                                                                                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| No active bookmark                      | `INSERT` a new row.                                                                                                                          |
| Active bookmark exists                  | `UPDATE SET deleted_at = now()` (soft-delete).                                                                                               |
| Previously soft-deleted bookmark exists | Either restore it (`deleted_at = NULL`) or insert a new row. We **insert a new row** to keep `created_at` accurate for "date added" display. |

### 2.6 Relationship Recap

- `users` 1 — \* `bookmarks` (one-to-many).
- `anime` 1 — \* `bookmarks` (one-to-many).
- `anime.bookmark_count` is denormalized and maintained on bookmark insert/soft-delete.
