# Notification

> **Step 7 — Database Design**
> Defines the `notifications` table — in-app (and future push/email) notifications.

---

## 1. Purpose

A `notification` is a **system-generated message** delivered to a user — a new episode alert, a reply to their comment, a system announcement, or a recommendation. Notifications are the **in-app inbox**; they may also be the source for future push/email delivery.

**Design principle:** Notifications are **append-only, TTL-driven, and polymorphic**. They are never updated (except `read_at`), never soft-deleted, and expire naturally. The payload shape varies by type, so we use `jsonb`.

---

## 2. `notifications` Table

### 2.1 Fields

| Column       | Type          | Constraint                              | Description                                             |
| ------------ | ------------- | --------------------------------------- | ------------------------------------------------------- |
| `id`         | `uuid`        | `PRIMARY KEY DEFAULT gen_random_uuid()` | Surrogate key.                                          |
| `user_id`    | `uuid`        | `NOT NULL` FK → `users.id`              | Recipient.                                              |
| `type`       | `text`        | `NOT NULL`                              | Notification type. See §2.3.                            |
| `channel`    | `text`        | `NOT NULL DEFAULT 'in_app'`             | Delivery channel. See §2.4.                             |
| `priority`   | `text`        | `NOT NULL DEFAULT 'normal'`             | `'low'`, `'normal'`, `'high'`.                          |
| `title`      | `text`        | `NOT NULL`                              | Short headline.                                         |
| `body`       | `text`        | nullable                                | Longer message text.                                    |
| `image_url`  | `text`        | nullable                                | Thumbnail/illustration URL.                             |
| `action_url` | `text`        | nullable                                | Deep link when tapped (e.g. `/anime/:slug`).            |
| `payload`    | `jsonb`       | `NOT NULL DEFAULT '{}'`                 | Type-specific data. GIN-indexed.                        |
| `is_read`    | `boolean`     | `NOT NULL DEFAULT false`                | Read flag (denormalized for fast filtering).            |
| `read_at`    | `timestamptz` | nullable                                | When the user read it.                                  |
| `sent_at`    | `timestamptz` | nullable                                | When it was dispatched to the channel (for push/email). |
| `expires_at` | `timestamptz` | nullable                                | When it should no longer be shown.                      |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()`                | Creation time.                                          |

### 2.2 Constraints

| Name                                      | Type  | Definition                                                                |
| ----------------------------------------- | ----- | ------------------------------------------------------------------------- |
| `chk_notifications_type_range`            | check | `type IN ('new_episode','reply','system','recommendation','achievement')` |
| `chk_notifications_channel_range`         | check | `channel IN ('in_app','email','push')`                                    |
| `chk_notifications_priority_range`        | check | `priority IN ('low','normal','high')`                                     |
| `chk_notifications_read_requires_read_at` | check | `is_read = false OR read_at IS NOT NULL`                                  |
| `chk_notifications_sent_before_read`      | check | `sent_at IS NULL OR read_at IS NULL OR read_at >= sent_at`                |

### 2.3 Type Values

| Value            | Meaning                                | Example `payload`                                               |
| ---------------- | -------------------------------------- | --------------------------------------------------------------- |
| `new_episode`    | A bookmarked show got a new episode.   | `{"anime_id": "...", "episode_id": "...", "episode_number": 5}` |
| `reply`          | Someone replied to the user's comment. | `{"anime_id": "...", "comment_id": "...", "replier_id": "..."}` |
| `system`         | Platform announcement.                 | `{"announcement_id": "..."}`                                    |
| `recommendation` | Personalized show suggestion.          | `{"anime_id": "...", "reason": "because you watched X"}`        |
| `achievement`    | Badge/milestone unlocked (future).     | `{"achievement_id": "..."}`                                     |

### 2.4 Channel Values

| Value    | Meaning                                                                |
| -------- | ---------------------------------------------------------------------- |
| `in_app` | Stored in DB, shown in the in-app inbox.                               |
| `email`  | Sent via email (future — requires `sent_at` tracking).                 |
| `push`   | Push notification (future — requires device tokens, stored elsewhere). |

> **M3 scope:** only `in_app` is implemented. `email` and `push` are future channels; the column is pre-provisioned so the schema doesn't change when they arrive.

### 2.5 Indexes

| Index                            | Type           | Columns                                              | Purpose                                                      |
| -------------------------------- | -------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| `pk_notifications`               | btree (unique) | `id`                                                 | PK.                                                          |
| `idx_notifications_user_created` | btree          | `(user_id, created_at DESC)`                         | Inbox feed (paginated).                                      |
| `idx_notifications_user_unread`  | btree          | `(user_id, created_at DESC)` `WHERE is_read = false` | Unread notifications + badge count.                          |
| `idx_notifications_expires_at`   | btree          | `expires_at` `WHERE expires_at IS NOT NULL`          | TTL purge job.                                               |
| `idx_notifications_type`         | btree          | `(user_id, type)` `WHERE is_read = false`            | "Any unread new_episode alerts?"                             |
| `idx_notifications_payload`      | GIN            | `payload`                                            | Lookup by payload key (e.g. all notifications for an anime). |

### 2.6 Decisions & Rationale

- **Append-only, no `updated_at`:** A notification is created once. The only mutation is setting `read_at` / `is_read` — we don't need a full `updated_at` for that, and omitting it reduces write overhead on the common "mark as read" path.
- **No `deleted_at`:** Notifications are **hard-deleted** when they expire or when the user clears them. They are ephemeral by nature; soft-delete would bloat the table. The `expires_at` column drives a TTL purge job.
- **`payload` as `jsonb`:** Different notification types carry different data. A polymorphic `jsonb` column avoids a wide table with many nullable columns or a separate table per type. GIN indexing keeps payload-key lookups fast.
- **`is_read` denormalized + `read_at`:** `is_read` is a boolean for fast filtering ("show me unread"). `read_at` is the timestamp for "when did I read this?" Both are useful; the check constraint keeps them consistent.
- **`expires_at` is nullable:** Not all notifications expire (e.g. a system announcement may be permanent). The purge job only touches rows where `expires_at IS NOT NULL AND expires_at < now()`.
- **`action_url` is a deep link:** Tapping a notification navigates the user to the relevant screen. Storing the URL (not just the entity id) decouples the notification from the routing layer — if routes change, old notifications still work or can be re-resolved.
- **No `created_by`:** Notifications are system-generated. The actor is implicit (the system), and the `audit_log` is not written for every notification (that would be wasteful).

### 2.7 Fan-Out Pattern

When a new episode is published:

1. Query `bookmarks` for users who have `notify_on_new_episode = true` for the anime (uses `idx_bookmarks_notify`).
2. `INSERT` a `new_episode` notification for each user.
3. This is a **fan-out write** — potentially millions of inserts for a popular show. It is done asynchronously by a background job, not in the request path.

### 2.8 Retention

- In-app notifications are retained for **90 days** by default (`expires_at = created_at + 90 days`).
- System announcements may have a longer or NULL expiry.
- A nightly job purges expired rows. See `Data-Retention.md`.

### 2.9 Relationship Recap

- `users` 1 — \* `notifications` (one-to-many).
- `payload` may reference `anime`, `episodes`, `comments`, `users` — but these are **not** foreign keys. The payload is a snapshot, not a live reference. If the referenced entity is deleted, the notification still renders (with a fallback like "this anime is no longer available").
