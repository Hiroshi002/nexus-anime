# Rating

> **Step 7 — Database Design**
> Defines the `ratings` table — numeric ratings and optional reviews for anime.

---

## 1. Purpose

A `rating` is a user's **numeric score** (0–10) for an anime, optionally accompanied by a **review** (title + body). Ratings power the show's `average_rating` and `rating_count` (denormalized on `anime`), the "top-rated" sort, and the review section on anime detail pages.

**Design principle:** Ratings are **user-owned, mutable, and unique per (user, show)**. A user can change their rating at any time — this is an update, not a new row. Soft-delete is enabled so a user can remove their rating without losing the history of having rated.

---

## 2. `ratings` Table

### 2.1 Fields

| Column          | Type            | Constraint                              | Description                                |
| --------------- | --------------- | --------------------------------------- | ------------------------------------------ |
| `id`            | `uuid`          | `PRIMARY KEY DEFAULT gen_random_uuid()` | Surrogate key.                             |
| `user_id`       | `uuid`          | `NOT NULL` FK → `users.id`              | Rater.                                     |
| `anime_id`      | `uuid`          | `NOT NULL` FK → `anime.id`              | Show being rated.                          |
| `value`         | `numeric(3,2)`  | `NOT NULL`                              | Score, 0.00–10.00.                         |
| `review_title`  | `text`          | nullable                                | Optional review headline.                  |
| `review_body`   | `text`          | nullable                                | Optional review text. Sanitized at render. |
| `is_spoiler`    | `boolean`       | `NOT NULL DEFAULT false`                | Spoiler flag on the review.                |
| `helpful_count` | `integer`       | `NOT NULL DEFAULT 0`                    | Denormalized "helpful" votes (future).     |
| `deleted_at`    | `timestamptz`   | nullable                                | Soft-delete marker (rating removed).       |
| `created_at`    | `timestamptz`   | `NOT NULL DEFAULT now()`                | When first rated.                          |
| `updated_at`    | `timestamptz`   | `NOT NULL DEFAULT now()`                | Last value/review change.                  |
| `version`       | `integer`       | `NOT NULL DEFAULT 1`                    | Optimistic concurrency for edits.          |
| `created_by`    | `uuid` nullable | FK → `users.id`                         | = `user_id`.                               |
| `updated_by`    | `uuid` nullable | FK → `users.id`                         | Last editor.                               |

### 2.2 Constraints

| Name                                | Type           | Definition                                                 |
| ----------------------------------- | -------------- | ---------------------------------------------------------- |
| `uq_ratings_user_anime`             | partial unique | `UNIQUE (user_id, anime_id) WHERE deleted_at IS NULL`      |
| `chk_ratings_value_range`           | check          | `value BETWEEN 0 AND 10`                                   |
| `chk_ratings_review_title_length`   | check          | `review_title IS NULL OR char_length(review_title) <= 200` |
| `chk_ratings_review_body_length`    | check          | `review_body IS NULL OR char_length(review_body) <= 10000` |
| `chk_ratings_review_requires_value` | check          | `review_body IS NULL OR value IS NOT NULL`                 |

### 2.3 Indexes

| Index                       | Type                    | Columns                                                  | Purpose                               |
| --------------------------- | ----------------------- | -------------------------------------------------------- | ------------------------------------- |
| `pk_ratings`                | btree (unique)          | `id`                                                     | PK.                                   |
| `idx_ratings_user_id`       | btree                   | `(user_id, updated_at DESC)` `WHERE deleted_at IS NULL`  | User's ratings/reviews.               |
| `idx_ratings_user_anime`    | btree (unique, partial) | `(user_id, anime_id)` `WHERE deleted_at IS NULL`         | "What did I rate this show?"          |
| `idx_ratings_anime_id`      | btree                   | `(anime_id, value DESC)` `WHERE deleted_at IS NULL`      | Reviews for a show (sorted by score). |
| `idx_ratings_anime_created` | btree                   | `(anime_id, created_at DESC)` `WHERE deleted_at IS NULL` | Recent ratings for a show.            |

### 2.4 Decisions & Rationale

- **`numeric(3,2)` for `value`:** Scores like `8.50` or `9.75` are common in anime communities. `numeric` is exact (no float rounding), and `(3,2)` allows up to `99.99` — the check constraint clamps it to `0–10`. We don't use `decimal` (it's a synonym in Postgres) — `numeric` is the canonical name.
- **One active rating per (user, show):** The partial unique constraint enforces this. A user changing their score does an `UPDATE`, not an `INSERT`. This keeps `anime.rating_count` accurate (it's a count of non-deleted rows).
- **Soft-delete on removal:** When a user removes their rating, we set `deleted_at`. This decrements `anime.rating_count` and removes the value from `anime.average_rating`. The row is retained for audit and potential re-activation.
- **`version` for edits:** A user may edit their score or review. Optimistic concurrency prevents a stale update from overwriting a newer one. The `audit_log` captures value changes (they affect the show's average).
- **Review is optional:** A rating can be just a number (`review_title` and `review_body` both NULL). The `chk_ratings_review_requires_value` constraint ensures a review is always attached to a score (you can't review without rating).
- **`is_spoiler` on the review:** Reviews may contain spoilers. The UI blurs them until revealed. Moderators can override.
- **Denormalized `helpful_count`:** Future "was this review helpful?" voting. Maintained by application, reconciled by background job.
- **No `is_pinned`:** Unlike comments, reviews are not pinned — they're sorted by score or recency. A "featured review" concept would be a separate curation feature.

### 2.5 Average Rating Maintenance

`anime.average_rating` and `anime.rating_count` are **denormalized aggregates**. They are maintained by the application on every rating insert/update/delete:

| Event                | Effect on `anime`                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| New rating inserted  | `rating_count += 1`, `average_rating = (old_avg * old_count + value) / new_count`                     |
| Rating value updated | `average_rating = (old_avg * count - old_value + new_value) / count`                                  |
| Rating soft-deleted  | `rating_count -= 1`, `average_rating = (old_avg * old_count - value) / new_count` (or 0 if count = 0) |

A **background reconciliation job** recomputes these from the source of truth (`ratings` table) nightly to correct any drift. This is the standard "denormalize + reconcile" pattern.

### 2.6 Relationship Recap

- `users` 1 — \* `ratings` (one-to-many).
- `anime` 1 — \* `ratings` (one-to-many).
- `anime.average_rating` and `anime.rating_count` are derived from this table.
- On user erasure: ratings are **hard-deleted** (they're anonymous-ish scores; keeping them would skew averages). The `anime` aggregates are recomputed.
