# Profiles

## Why is there no `profiles` table?

Nexus stores profile data directly on the `users` row — there is no separate `profiles` table and no `profileId` foreign key. This is intentional: almost every page renders a user's name, avatar, or preferences, so a join or a second round-trip on the hot path would be wasted latency for no benefit. See [`Users.md`](./Users.md) for the full endpoint reference and the `users` schema.

The trade-off: a profile update is a PATCH on the users row, not an insert on a sidecar table. That keeps reads fast and keeps the auth flow simple.

---

## Field reference

All profile-related columns live on `users`.

| Field             | Type      | Nullable | Notes                                                        |
| ----------------- | --------- | -------- | ------------------------------------------------------------ |
| `username`        | text      | no       | Unique slug, 3-30 chars, `[a-z0-9_-]`. Used in public URLs.  |
| `display_name`    | text      | yes      | 3-50 chars. Shown in UI; falls back to `username` if null.  |
| `avatar_url`      | text      | yes      | HTTPS only, max 1024 chars. Allowed: PNG, WebP, JPEG.       |
| `bio`             | text      | yes      | Max 500 chars. Plain text — no HTML, no mentions.           |
| `preferences`     | jsonb     | yes      | User settings. Schema below.                                |
| `role`            | text      | no       | One of `viewer`, `moderator`, `admin`. Defaults to `viewer`.  |

Not listed here but also on the row: `id`, `email`, `email_verified`, `created_at`, `updated_at`, `deleted_at`. See [`Users.md`](./Users.md).

---

## `preferences` JSONB schema

Strict — adding a new key requires a migration. Existing keys are never renamed without a deprecation period.

```ts
type UserPreferences = {
  theme: "dark" | "light" | "system";        // default: "dark"
  language: "en-US" | "ja-JP";               // default: "en-US"
  playback_quality: "auto" | "sd" | "hd" | "uhd"; // default: "auto"
  autoplay: boolean;                         // default: true
  subtitles: "off" | "en" | "ja";            // default: "off"
  notifications: boolean;                    // default: true
  mature_content: boolean;                   // default: false
};
```

Keys not in this list are rejected by the Zod validator on PATCH. Unknown keys in an existing row are tolerated but never surfaced to the client.

---

## Public vs authenticated shape

**Public** (any caller, including unauthenticated):

```json
{
  "data": {
    "id": "usr_...",
    "username": "ashketchum",
    "display_name": "Ash",
    "avatar_url": "https://...",
    "bio": "Gotta catch 'em all"
  }
}
```

**Authenticated owner** (the session user viewing their own profile):

```json
{
  "data": {
    "id": "usr_...",
    "username": "ashketchum",
    "display_name": "Ash",
    "avatar_url": "https://...",
    "bio": "Gotta catch 'em all",
    "email": "ash@example.com",
    "preferences": { "theme": "dark", ... }
  }
}
```

**Authenticated viewing someone else** — same shape as public.

`role` is never returned outside of admin callers. `email` is only returned to the owner. `preferences` is only returned to the owner.

---

## Update restrictions

Profile updates go through `PATCH /api/users/me`. Validation rules:

- `display_name` — 3 to 50 characters. Trimmed; leading/trailing whitespace is stripped before check.
- `avatar_url` — must start with `https://`, max 1024 characters, path ends in `.png`, `.jpg`, `.jpeg`, or `.webp` (case-insensitive). A future milestone will accept Nexus-hosted keys; today only absolute HTTPS URLs are allowed.
- `bio` — max 500 characters. Plain text only. Returned as-is from the database; rendered with DOMPurify on the client for any future rich.
- `preferences` — full replacement is **not** allowed. Only the keys you send are merged onto the existing row. Sending an unknown key is a 400.

All fields are optional. An empty PATCH returns the current profile unmodified.

---

## Endpoints

See [`Users.md`](./Users.md):

- `GET /api/users/{id}` — public profile
- `PATCH /api/users/me` — update the authenticated user's profile
- `GET /api/users/me/preferences` — full preferences object
- `PATCH /api/users/me/preferences` — partial preference merge

---

## Future milestones

- **Custom profile themes** (M5): user-selectable accent colors and background styles, stored inside `preferences` as a `theme_overrides` block. Requires a design-system extension.
- **Achievement badges** (M5): a new `user_achievements` table and a `badges` JSONB array on the public profile shape. Not on the `users` table itself — this is a legitimately separate access pattern.
- **Profile moderation** (M6): `/api/admin/users/{id}/moderate` for moderators to hide an avatar or bio pending review. Adds a `moderation_status` column to `users`.
