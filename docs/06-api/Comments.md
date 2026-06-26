# Comments

> **Authoritative endpoint reference** for the `/api/v1/comments` and `/api/v1/anime/{animeId}/comments` resources. Covers threaded comments on anime: creation, editing, deletion, upvoting, and moderator actions (pin, hide).

> Ownership: **Lead API Architect**. Last reviewed: 2026-06-26.

---

## 1. Purpose

Comments are **threaded, user-generated text posts** attached to an anime. They support:

- **Free discussion** — users share opinions, reactions, and commentary about an anime.
- **Spoiler flagging** — authors can mark a comment as containing spoilers; clients render a blur overlay until the user opts in.
- **Moderation** — moderators can pin (surface to top) or hide (suppress from default view) any comment.
- **Soft delete** — deleted comments become `[deleted]` placeholders so thread continuity is preserved.

The resource is **public for reads** (with visibility rules for hidden comments) and **authenticated for writes**. All endpoints enforce the rate limits defined in §5.

**Schema reference:** The authoritative column list, constraints, indexes, and enum values live in [`docs/07-database/Comments.md`](../07-database/Comments.md). This document only summarizes field shapes for request/response contract clarity.

---

## 2. Schema (summary)

Response payloads in this document use the shape below. JSON fields are `camelCase` per [`API-Standards.md`](./API-Standards.md) §5; the underlying columns are `snake_case` (see `docs/07-database/Comments.md` §2).

```ts
// Response payload shape — comment object returned by all read endpoints.
Comment {
  id: string;                        // uuid — surrogate key
  userId: string;                    // uuid — author (FK → users.id)
  animeId: string;                   // uuid — parent anime (FK → anime.id)
  parentCommentId: string | null;    // uuid — self-reference for threading; null = top-level
  body: string;                      // plain text, 1–5000 chars after trim
  isSpoiler: boolean;                // author-flagged at creation; default false
  isPinned: boolean;                 // moderator-only; default false
  isHidden: boolean;                 // moderator-only; default false
  upvotesCount: number;              // denormalized count of active upvotes
  replyCount: number;                // denormalized count of direct child comments
  version: number;                   // integer — optimistic concurrency token, incremented on every write
  deletedAt: string | null;          // ISO-8601 timestamptz; non-null = soft-deleted
  createdAt: string;                 // ISO-8601 timestamptz — immutable
  updatedAt: string;                 // ISO-8601 timestamptz — last mutation
  createdBy: string | null;          // uuid — = userId (self-owned audit pointer)
  updatedBy: string | null;          // uuid — last mutator (author or moderator)
}
```

### 2.1 Field rules

| Field | Constraint | Notes |
| :---- | :--------- | :---- |
| `userId` | `NOT NULL` FK → `users.id` | Resolved from the session; the client cannot set it. |
| `animeId` | `NOT NULL` FK → `anime.id` | Must reference an active anime. |
| `parentCommentId` | nullable FK → `comments.id` | Self-reference. Null = top-level comment. Must reference a comment on the same anime. |
| `body` | `char_length(trim(body)) BETWEEN 1 AND 5000` | Plain text only. Rendered through DOMPurify on the client — never interpreted as HTML. |
| `isSpoiler` | `NOT NULL DEFAULT false` | Set at creation. Cannot be changed after creation (immutable). |
| `isPinned` | `NOT NULL DEFAULT false` | Only a moderator may toggle (see §7.8). |
| `isHidden` | `NOT NULL DEFAULT false` | Only a moderator may toggle (see §7.9). |
| `upvotesCount` | `NOT NULL DEFAULT 0` | Denormalized. Incremented/decremented atomically on upvote toggle. |
| `replyCount` | `NOT NULL DEFAULT 0` | Denormalized. Count of direct children (all states, including soft-deleted). |
| `version` | `NOT NULL DEFAULT 1` | Optimistic concurrency token. Incremented on every successful PATCH. |
| `deletedAt` | nullable | Soft-delete marker. Active comments have `deletedAt = null`. |

### 2.2 Threading rules

- **Max depth: 3** — top-level (depth 0) → reply (depth 1) → reply-of-reply (depth 2). Depth is counted from the root of the thread.
- A `POST` with `parentCommentId` pointing to a comment already at depth 2 is **flattened**: the new comment is attached as a child of the depth-2 comment's parent (i.e., it becomes a sibling, not a child). This keeps the tree bounded without rejecting the write.
- The `parentCommentId` must reference a comment on the **same anime**. Cross-anime references are rejected with `400 Bad Request`.
- Soft-deleted comments remain in the tree as `[deleted]` placeholders. Their `body` is replaced with the literal string `[deleted]` in responses; all other fields (id, timestamps, replyCount) are preserved.

---

## 3. Constraints & indexes

Mirrors `docs/07-database/Comments.md` §2.2.

| Name | Type | Definition |
| :--- | :--- | :--- |
| `uq_comments_user_anime_body` | partial unique | `UNIQUE (user_id, anime_id, md5(body)) WHERE deleted_at IS NULL AND parent_comment_id IS NULL` — prevents duplicate top-level comments with identical text. |
| `uq_comments_reply_per_user` | partial unique | `UNIQUE (user_id, parent_comment_id) WHERE deleted_at IS NULL AND parent_comment_id IS NOT NULL` — one reply per user per parent. |

Indexes that matter for these endpoints:

| Index | Columns | Serves |
| :---- | :------ | :----- |
| `idx_comments_anime_created` | `(anime_id, is_pinned DESC, created_at DESC) WHERE deleted_at IS NULL` | Top-level list sorted by newest. |
| `idx_comments_anime_upvotes` | `(anime_id, is_pinned DESC, upvotes_count DESC, created_at DESC) WHERE deleted_at IS NULL` | Top-level list sorted by upvotes. |
| `idx_comments_parent` | `(parent_comment_id, created_at ASC) WHERE deleted_at IS NULL` | Reply thread scan. |
| `idx_comments_user` | `(user_id, created_at DESC) WHERE deleted_at IS NULL` | User's comment history. |

---

## 4. Authentication

| Method | URL | Auth | Role |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/anime/{animeId}/comments` | optional | Public read; hidden comments filtered for non-moderators and non-authors. |
| `GET` | `/api/v1/comments/{id}` | optional | Same visibility rules as above. |
| `GET` | `/api/v1/comments/{id}/replies` | optional | Same visibility rules as above. |
| `POST` | `/api/v1/anime/{animeId}/comments` | required | Any authenticated user. |
| `PATCH` | `/api/v1/comments/{id}` | required | Author only (within 24 h window). |
| `DELETE` | `/api/v1/comments/{id}` | required | Author only. |
| `POST` | `/api/v1/comments/{id}/upvote` | required | Any authenticated user (one per user; toggle). |
| `POST` | `/api/v1/comments/{id}/pin` | required | Moderator+. |
| `POST` | `/api/v1/comments/{id}/hide` | required | Moderator+. |

A missing or invalid session on an authenticated endpoint returns `401 Unauthorized`. A valid session without the required role returns `403 Forbidden`.

---

## 5. Rate limiting

All endpoints in this document share the **user-scoped** quota defined in [`Rate-Limiting.md`](./Rate-Limiting.md):

| Scope | Limit | Window |
| :--- | :--- | :--- |
| Authenticated user | 5 requests | 60 seconds |

The bucket key is `nexus:ratelimit:user:{sub}:comments:*`. Standard rate-limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) are emitted on every response. `Retry-After` is sent only on `429`. Clients implement self-throttle logic against the headers per `Rate-Limiting.md` §12.

Unauthenticated `GET` requests are rate-limited by IP instead; see `Rate-Limiting.md` §6.

---

## 6. Caching

Comment state is **public-read, mutation-sensitive**. The cache policy reflects that — reads are briefly fresh, but any mutation requires clients to observe the new state on the next request.

### 6.1 Read endpoints (list, thread, replies)

```
Cache-Control: private, max-age=60, must-revalidate
```

- `private` — the response may vary by user (hidden comments are filtered differently for authors and moderators). Shared caches must not store it.
- `max-age=60` — a moderate freshness window. Comments change more frequently than bookmarks (new votes, new replies, edits); 60 seconds covers rapid repeat reads without a round-trip.
- `must-revalidate` — once stale, the client must revalidate with the origin.

### 6.2 Mutation endpoints (POST, PATCH, DELETE, upvote, pin, hide)

```
Cache-Control: no-store, no-cache, must-revalidate
```

Mutation responses are not cacheable by definition. The handler is responsible for invalidating cached read keys in `@nexus/cache`:

```
nexus:comments:anime:{animeId}:list:*
nexus:comments:{commentId}
nexus:comments:{commentId}:replies:*
```

After a successful mutation, the next `GET` must reflect the new state. The `private, max-age=60` window on reads means a client that mutates and immediately re-reads within 60 seconds **may** see stale data unless the cache key is invalidated — which is why the handler invalidates synchronously before returning.

---

## 7. Endpoints

### 7.1. `GET /api/v1/anime/{animeId}/comments` — list top-level comments

#### Purpose

Paginated list of **top-level** comments on an anime (comments where `parentCommentId` is null). Powers the main comment section on the anime detail page.

#### Method & URL

```
GET /api/v1/anime/{animeId}/comments
```

#### Auth

Optional. Hidden comments are visible only to their author and to moderators.

#### Query parameters

| Parameter | Type | Default | Description |
| :-------- | :--- | :------ | :---------- |
| `sort` | `"createdAt"` \| `"upvotes"` | `"createdAt"` | Sort field. |
| `order` | `"asc"` \| `"desc"` | `"desc"` for both sort values | Sort direction. |
| `cursor` | string | — | Opaque cursor from `data.pagination.nextCursor`. Omit for the first page. |
| `limit` | integer (1–100) | `20` | Page size. Hard cap 100. |

#### Sort semantics

| `sort` value | Indexed order |
| :----------- | :------------ |
| `createdAt` | `is_pinned DESC, created_at DESC, id DESC` |
| `upvotes` | `is_pinned DESC, upvotes_count DESC, created_at DESC, id DESC` |

Pinned comments always appear first regardless of sort choice, per the `is_pinned DESC` leading column.

#### Response schema

```ts
{
  data: {
    items: Comment[],
    pagination: {
      nextCursor: string | null,
      prevCursor: string | null,
      hasMore: boolean,
      limit: number,
      total: number | null  // null when count is not computed (default); computed only on first page when sort = "createdAt"
    }
  }
}
```

#### Error codes

| HTTP | Code | Condition |
| :--- | :--- | :--- |
| `404` | `ANIME_NOT_FOUND` | `animeId` does not reference an active anime. |
| `400` | `INVALID_QUERY` | Unknown `sort` value, or `limit` out of range. |

---

### 7.2. `GET /api/v1/comments/{id}` — single comment with replies

#### Purpose

Fetch a single comment by ID, including its direct replies (depth-limited to 3). Powers opening a thread from a permalink or notification.

#### Method & URL

```
GET /api/v1/comments/{id}
```

#### Auth

Optional. Hidden comments are visible only to their author and to moderators.

#### Path parameters

| Parameter | Type | Description |
| :-------- | :--- | :----------- |
| `id` | uuid | Comment ID. |

#### Response schema

```ts
{
  data: {
    comment: Comment,
    replies: {
      items: Comment[],
      pagination: {
        nextCursor: string | null,
        prevCursor: string | null,
        hasMore: boolean,
        limit: number
      }
    }
  }
}
```

Replies are paginated independently (default `limit=10`). The `replies.items` array is sorted by `created_at ASC` (oldest first) to preserve chronological thread order.

#### Error codes

| HTTP | Code | Condition |
| :--- | :--- | :--- |
| `404` | `COMMENT_NOT_FOUND` | Comment does not exist or is hidden and caller is not the author or a moderator. |

---

### 7.3. `GET /api/v1/comments/{id}/replies` — paginated replies

#### Purpose

Paginated list of direct replies to a comment. Powers "load more" in a thread.

#### Method & URL

```
GET /api/v1/comments/{id}/replies
```

#### Auth

Optional. Hidden comments are visible only to their author and to moderators.

#### Path parameters

| Parameter | Type | Description |
| :-------- | :--- | :----------- |
| `id` | uuid | Parent comment ID. |

#### Query parameters

| Parameter | Type | Default | Description |
| :-------- | :--- | :------ | :---------- |
| `cursor` | string | — | Opaque cursor from `data.pagination.nextCursor`. Omit for the first page. |
| `limit` | integer (1–100) | `10` | Page size. Hard cap 100. |

#### Response schema

```ts
{
  data: {
    items: Comment[],
    pagination: {
      nextCursor: string | null,
      prevCursor: string | null,
      hasMore: boolean,
      limit: number
    }
  }
}
```

Replies are sorted by `created_at ASC`.

#### Error codes

| HTTP | Code | Condition |
| :--- | :--- | :--- |
| `404` | `COMMENT_NOT_FOUND` | Parent comment does not exist or is hidden and caller is not the author or a moderator. |

---

### 7.4. `POST /api/v1/anime/{animeId}/comments` — create comment

#### Purpose

Create a new comment on an anime. Optionally, create a reply to an existing comment (subject to the depth-3 limit; see §2.2).

#### Method & URL

```
POST /api/v1/anime/{animeId}/comments
```

#### Auth

Required.

#### Path parameters

| Parameter | Type | Description |
| :-------- | :--- | :----------- |
| `animeId` | uuid | Target anime. |

#### Request body

```ts
{
  body: string;                  // required, 1–5000 chars after trim
  isSpoiler?: boolean;           // optional, default false
  parentCommentId?: string | null; // optional, uuid of parent comment for threading
}
```

#### Validation rules

| Rule | Error |
| :---- | :---- |
| `body` must be 1–5000 chars after trim | `400 INVALID_BODY` |
| `animeId` must reference an active anime | `404 ANIME_NOT_FOUND` |
| If `parentCommentId` is provided, it must reference a comment on the same anime | `400 PARENT_ANIME_MISMATCH` |
| If `parentCommentId` references a soft-deleted comment | `400 PARENT_DELETED` |
| If the user already has a top-level comment with the same `md5(body)` on this anime | `409 DUPLICATE_COMMENT` |
| If the user already has a reply on the same parent | `409 DUPLICATE_REPLY` |

#### Response schema

```ts
{
  data: {
    comment: Comment
  }
}
```

Status: `201 Created`.

#### Error codes

| HTTP | Code | Condition |
| :--- | :--- | :--- |
| `400` | `INVALID_BODY` | `body` empty, whitespace-only, or exceeds 5000 chars. |
| `400` | `PARENT_ANIME_MISMATCH` | `parentCommentId` references a comment on a different anime. |
| `400` | `PARENT_DELETED` | `parentCommentId` references a soft-deleted comment. |
| `401` | `UNAUTHENTICATED` | Missing or invalid session. |
| `404` | `ANIME_NOT_FOUND` | `animeId` does not reference an active anime. |
| `409` | `DUPLICATE_COMMENT` | Duplicate top-level comment. |
| `409` | `DUPLICATE_REPLY` | Duplicate reply on the same parent. |
| `429` | `RATE_LIMITED` | Rate limit exceeded. |

---

### 7.5. `PATCH /api/v1/comments/{id}` — edit own comment

#### Purpose

Edit the body of a comment authored by the caller. Edits are allowed only within a **24-hour window** from `createdAt`. After 24 hours, the comment is immutable.

#### Method & URL

```
PATCH /api/v1/comments/{id}
```

#### Auth

Required. Author only.

#### Path parameters

| Parameter | Type | Description |
| :-------- | :--- | :----------- |
| `id` | uuid | Comment ID. |

#### Request body

```ts
{
  body: string;       // required, 1–5000 chars after trim
  version: number;    // required — current version for optimistic concurrency
}
```

#### Validation rules

| Rule | Error |
| :---- | :---- |
| Caller must be the author (`userId`) | `403 FORBIDDEN` |
| Comment must not be soft-deleted | `410 GONE` |
| `now - createdAt <= 24h` | `403 EDIT_WINDOW_EXPIRED` |
| `version` must match current `version` | `409 VERSION_CONFLICT` |
| `body` must be 1–5000 chars after trim | `400 INVALID_BODY` |

#### Response schema

```ts
{
  data: {
    comment: Comment  // updated; version incremented by 1
  }
}
```

#### Error codes

| HTTP | Code | Condition |
| :--- | :--- | :--- |
| `400` | `INVALID_BODY` | `body` empty, whitespace-only, or exceeds 5000 chars. |
| `401` | `UNAUTHENTICATED` | Missing or invalid session. |
| `403` | `FORBIDDEN` | Caller is not the author. |
| `403` | `EDIT_WINDOW_EXPIRED` | 24-hour edit window has passed. |
| `404` | `COMMENT_NOT_FOUND` | Comment does not exist. |
| `409` | `VERSION_CONFLICT` | `version` does not match current row version. |
| `410` | `GONE` | Comment is soft-deleted. |
| `429` | `RATE_LIMITED` | Rate limit exceeded. |

---

### 7.6. `DELETE /api/v1/comments/{id}` — delete own comment

#### Purpose

Soft-delete a comment authored by the caller. The comment's `body` is replaced with `[deleted]` and `deletedAt` is set. Replies to the comment are **preserved** (they remain accessible and replyable).

#### Method & URL

```
DELETE /api/v1/comments/{id}
```

#### Auth

Required. Author only.

#### Path parameters

| Parameter | Type | Description |
| :-------- | :--- | :----------- |
| `id` | uuid | Comment ID. |

#### Request body

None.

#### Response schema

```ts
{
  data: {
    comment: Comment  // updated; body = "[deleted]", deletedAt = now
  }
}
```

Status: `200 OK`.

#### Behavior on replies

- Direct replies are **not** deleted. Their `parentCommentId` still points to the deleted comment.
- When a reply's parent is soft-deleted, the client renders the parent as `[deleted]` but the reply remains visible and interactive.
- If the deleted comment is later restored (moderator action, not in M3 scope), replies are still attached.

#### Error codes

| HTTP | Code | Condition |
| :--- | :--- | :--- |
| `401` | `UNAUTHENTICATED` | Missing or invalid session. |
| `403` | `FORBIDDEN` | Caller is not the author. |
| `404` | `COMMENT_NOT_FOUND` | Comment does not exist. |
| `410` | `GONE` | Comment is already soft-deleted. |
| `429` | `RATE_LIMITED` | Rate limit exceeded. |

---

### 7.7. `POST /api/v1/comments/{id}/upvote` — upvote (toggle)

#### Purpose

Cast or revoke an upvote on a comment. Each user may upvote a comment **at most once**. A second call from the same user **toggles** the upvote off.

#### Method & URL

```
POST /api/v1/comments/{id}/upvote
```

#### Auth

Required.

#### Path parameters

| Parameter | Type | Description |
| :-------- | :--- | :----------- |
| `id` | uuid | Comment ID. |

#### Request body

None.

#### Response schema

```ts
{
  data: {
    comment: Comment  // updated; upvotesCount reflects new count
  }
}
```

The response includes the full comment so the client can update the UI in a single round-trip.

#### Toggle semantics

| Prior state | Action | `upvotesCount` delta |
| :---------- | :----- | :------------------- |
| No upvote from this user | Insert upvote row | `+1` |
| Existing upvote from this user | Delete upvote row | `-1` |

The toggle is idempotent-safe: two rapid calls from the same user result in the original state. The handler uses a transaction to keep `upvotesCount` consistent with the upvote rows.

#### Error codes

| HTTP | Code | Condition |
| :--- | :--- | :--- |
| `401` | `UNAUTHENTICATED` | Missing or invalid session. |
| `404` | `COMMENT_NOT_FOUND` | Comment does not exist or is hidden and caller is not the author or a moderator. |
| `410` | `GONE` | Comment is soft-deleted. |
| `429` | `RATE_LIMITED` | Rate limit exceeded. |

---

### 7.8. `POST /api/v1/comments/{id}/pin` — pin comment (moderator+)

#### Purpose

Pin a comment so it appears at the top of the anime's comment list, above all non-pinned comments. A pinned comment is always surfaced first regardless of sort parameter (see §7.1 sort semantics).

#### Method & URL

```
POST /api/v1/comments/{id}/pin
```

#### Auth

Required. Moderator role or higher.

#### Path parameters

| Parameter | Type | Description |
| :-------- | :--- | :----------- |
| `id` | uuid | Comment ID. |

#### Request body

```ts
{
  isPinned: boolean;  // required — true to pin, false to unpin
}
```

#### Response schema

```ts
{
  data: {
    comment: Comment  // updated; isPinned reflects new state
  }
}
```

#### Error codes

| HTTP | Code | Condition |
| :--- | :--- | :--- |
| `401` | `UNAUTHENTICATED` | Missing or invalid session. |
| `403` | `FORBIDDEN` | Caller lacks moderator role. |
| `404` | `COMMENT_NOT_FOUND` | Comment does not exist. |
| `429` | `RATE_LIMITED` | Rate limit exceeded. |

---

### 7.9. `POST /api/v1/comments/{id}/hide` — hide comment (moderator+)

#### Purpose

Hide a comment from the default view. A hidden comment is:

- **Invisible** to unauthenticated users and to non-moderator, non-author users.
- **Visible** to the comment's author (so they can still see their own content) and to moderators (so they can review and unhide).
- **Still countable** — hidden comments contribute to the anime's total comment count, but their `body` is replaced with `[hidden]` for non-privileged viewers.

#### Method & URL

```
POST /api/v1/comments/{id}/hide
```

#### Auth

Required. Moderator role or higher.

#### Path parameters

| Parameter | Type | Description |
| :-------- | :--- | :----------- |
| `id` | uuid | Comment ID. |

#### Request body

```ts
{
  isHidden: boolean;  // required — true to hide, false to unhide
}
```

#### Response schema

```ts
{
  data: {
    comment: Comment  // updated; isHidden reflects new state
  }
}
```

#### Error codes

| HTTP | Code | Condition |
| :--- | :--- | :--- |
| `401` | `UNAUTHENTICATED` | Missing or invalid session. |
| `403` | `FORBIDDEN` | Caller lacks moderator role. |
| `404` | `COMMENT_NOT_FOUND` | Comment does not exist. |
| `429` | `RATE_LIMITED` | Rate limit exceeded. |

---

## 8. Visibility rules summary

| Comment state | Unauthenticated | Author | Moderator | Other authenticated |
| :------------ | :-------------- | :----- | :-------- | :------------------ |
| Active | Full | Full | Full | Full |
| Active + spoiler | Blurred | Full (opt-in) | Full (opt-in) | Blurred |
| Hidden | `[hidden]` | Full | Full | `[hidden]` |
| Soft-deleted | `[deleted]` | `[deleted]` | Full | `[deleted]` |
| Soft-deleted + hidden | `[hidden]` | `[deleted]` | Full | `[hidden]` |

"Full" means the original `body` is returned. "Blurred" means the `body` is returned but the client must render a blur overlay (the `isSpoiler` flag is always set so the client knows to blur). `[hidden]` and `[deleted]` are literal string replacements for the `body` field.

---

## 9. Examples

### 9.1 Create a top-level comment

**Request**

```http
POST /api/v1/anime/42/comments
Authorization: Bearer <token>
Content-Type: application/json

{
  "body": "The animation quality in episode 12 was absolutely stunning.",
  "isSpoiler": false
}
```

**Response** (`201 Created`)

```json
{
  "data": {
    "comment": {
      "id": "c1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "userId": "u1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "animeId": "42",
      "parentCommentId": null,
      "body": "The animation quality in episode 12 was absolutely stunning.",
      "isSpoiler": false,
      "isPinned": false,
      "isHidden": false,
      "upvotesCount": 0,
      "replyCount": 0,
      "version": 1,
      "deletedAt": null,
      "createdAt": "2026-06-26T10:00:00.000Z",
      "updatedAt": "2026-06-26T10:00:00.000Z",
      "createdBy": "u1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "updatedBy": "u1a2b3c4-d5e6-7890-abcd-ef1234567890"
    }
  }
}
```

### 9.2 Create a reply

**Request**

```http
POST /api/v1/anime/42/comments
Authorization: Bearer <token>
Content-Type: application/json

{
  "body": "Agreed — the sakuga in the final fight was next level.",
  "isSpoiler": false,
  "parentCommentId": "c1a2b3c4-d5e6-7890-abcd-ef1234567890"
}
```

**Response** (`201 Created`)

```json
{
  "data": {
    "comment": {
      "id": "f9e8d7c6-b5a4-3210-fedc-ba0987654321",
      "userId": "u2b3c4d5e-f6a7-8901-bcde-f12345678901",
      "animeId": "42",
      "parentCommentId": "c1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "body": "Agreed — the sakuga in the final fight was next level.",
      "isSpoiler": false,
      "isPinned": false,
      "isHidden": false,
      "upvotesCount": 0,
      "replyCount": 0,
      "version": 1,
      "deletedAt": null,
      "createdAt": "2026-06-26T10:05:00.000Z",
      "updatedAt": "2026-06-26T10:05:00.000Z",
      "createdBy": "u2b3c4d5e-f6a7-8901-bcde-f12345678901",
      "updatedBy": "u2b3c4d5e-f6a7-8901-bcde-f12345678901"
    }
  }
}
```

### 9.3 List top-level comments (sorted by upvotes)

**Request**

```http
GET /api/v1/anime/42/comments?sort=upvotes&limit=2
```

**Response** (`200 OK`)

```json
{
  "data": {
    "items": [
      {
        "id": "c1a2b3c4-d5e6-7890-abcd-ef1234567890",
        "userId": "u1a2b3c4-d5e6-7890-abcd-ef1234567890",
        "animeId": "42",
        "parentCommentId": null,
        "body": "The animation quality in episode 12 was absolutely stunning.",
        "isSpoiler": false,
        "isPinned": true,
        "isHidden": false,
        "upvotesCount": 47,
        "replyCount": 3,
        "version": 1,
        "deletedAt": null,
        "createdAt": "2026-06-26T10:00:00.000Z",
        "updatedAt": "2026-06-26T10:00:00.000Z",
        "createdBy": "u1a2b3c4-d5e6-7890-abcd-ef1234567890",
        "updatedBy": "u1a2b3c4-d5e6-7890-abcd-ef1234567890"
      },
      {
        "id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
        "userId": "u3c4d5e6f-a7b8-9012-cdef-123456789012",
        "animeId": "42",
        "parentCommentId": null,
        "body": "The OST carried this season hard.",
        "isSpoiler": false,
        "isPinned": false,
        "isHidden": false,
        "upvotesCount": 23,
        "replyCount": 1,
        "version": 1,
        "deletedAt": null,
        "createdAt": "2026-06-26T11:00:00.000Z",
        "updatedAt": "2026-06-26T11:00:00.000Z",
        "createdBy": "u3c4d5e6f-a7b8-9012-cdef-123456789012",
        "updatedBy": "u3c4d5e6f-a7b8-9012-cdef-123456789012"
      }
    ],
    "pagination": {
      "nextCursor": "eyJjcmVhdGVkQXQiOiIyMDI2LTA2LTI2VDExOjAwOjAwLjAwMFoiLCJpZCI6ImMxYTJiM2M0LWQ1ZTYtNzg5MC1hYmNkLWVmMTIzNDU2Nzg5MCJ9",
      "prevCursor": null,
      "hasMore": true,
      "limit": 2,
      "total": 156
    }
  }
}
```

### 9.4 Edit a comment (within 24 h)

**Request**

```http
PATCH /api/v1/comments/c1a2b3c4-d5e6-7890-abcd-ef1234567890
Authorization: Bearer <token>
Content-Type: application/json

{
  "body": "The animation quality in episode 12 was absolutely stunning. Updated: the directing deserves credit too.",
  "version": 1
}
```

**Response** (`200 OK`)

```json
{
  "data": {
    "comment": {
      "id": "c1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "userId": "u1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "animeId": "42",
      "parentCommentId": null,
      "body": "The animation quality in episode 12 was absolutely stunning. Updated: the directing deserves credit too.",
      "isSpoiler": false,
      "isPinned": true,
      "isHidden": false,
      "upvotesCount": 47,
      "replyCount": 3,
      "version": 2,
      "deletedAt": null,
      "createdAt": "2026-06-26T10:00:00.000Z",
      "updatedAt": "2026-06-26T10:30:00.000Z",
      "createdBy": "u1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "updatedBy": "u1a2b3c4-d5e6-7890-abcd-ef1234567890"
    }
  }
}
```

### 9.5 Soft-delete a comment

**Request**

```http
DELETE /api/v1/comments/c1a2b3c4-d5e6-7890-abcd-ef1234567890
Authorization: Bearer <token>
```

**Response** (`200 OK`)

```json
{
  "data": {
    "comment": {
      "id": "c1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "userId": "u1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "animeId": "42",
      "parentCommentId": null,
      "body": "[deleted]",
      "isSpoiler": false,
      "isPinned": false,
      "isHidden": false,
      "upvotesCount": 0,
      "replyCount": 3,
      "version": 3,
      "deletedAt": "2026-06-26T12:00:00.000Z",
      "createdAt": "2026-06-26T10:00:00.000Z",
      "updatedAt": "2026-06-26T12:00:00.000Z",
      "createdBy": "u1a2b3c4-d5e6-7890-abcd-ef1234567890",
      "updatedBy": "u1a2b3c4-d5e6-7890-abcd-ef1234567890"
    }
  }
}
```

Note: `isPinned` is reset to `false` on soft-delete (a pinned deleted comment would clutter the top of the list). Replies are preserved.

### 9.6 Upvote toggle

**First call (cast upvote)**

```http
POST /api/v1/comments/a1b2c3d4-e5f6-7890-1234-567890abcdef/upvote
Authorization: Bearer <token>
```

**Response** (`200 OK`)

```json
{
  "data": {
    "comment": {
      "id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
      "upvotesCount": 24,
      "...": "/* other fields unchanged */"
    }
  }
}
```

**Second call (revoke upvote)**

```http
POST /api/v1/comments/a1b2c3d4-e5f6-7890-1234-567890abcdef/upvote
Authorization: Bearer <token>
```

**Response** (`200 OK`)

```json
{
  "data": {
    "comment": {
      "id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
      "upvotesCount": 23,
      "...": "/* other fields unchanged */"
    }
  }
}
```

### 9.7 Moderator hides a comment

**Request**

```http
POST /api/v1/comments/a1b2c3d4-e5f6-7890-1234-567890abcdef/hide
Authorization: Bearer <moderator-token>
Content-Type: application/json

{
  "isHidden": true
}
```

**Response** (`200 OK`)

```json
{
  "data": {
    "comment": {
      "id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
      "userId": "u3c4d5e6f-a7b8-9012-cdef-123456789012",
      "isHidden": true,
      "...": "/* other fields unchanged */"
    }
  }
}
```

Subsequent `GET` by a non-privileged user returns `body: "[hidden]"`. The author and moderators still see the original `body`.

---

## 10. Related documents

- [`API-Standards.md`](./API-Standards.md) — envelope shape, `camelCase` convention, error format.
- [`Rate-Limiting.md`](./Rate-Limiting.md) — rate-limit headers, bucket strategy, self-throttle logic.
- [`Error-Codes.md`](./Error-Codes.md) — canonical error code registry.
- [`docs/07-database/Comments.md`](../07-database/Comments.md) — authoritative schema, constraints, indexes, migration notes.
