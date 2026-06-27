# Information Architecture — Nexus Anime

> **Audience:** Product designers, UX architects, content strategists, and engineers building page layouts. This document defines the content hierarchy, entity relationships, and content types that the entire UX is built on.

---

## 1. Content Hierarchy

The platform has **three tiers** of content, from most-visited to deepest:

```
Tier 1 — Discovery            Home, Trending, Popular, Latest, Genres, Schedule, Search
Tier 2 — Catalog Detail      Anime Detail, Season Detail, Episode Detail
Tier 3 — Personal            Watch History, Bookmarks, Continue Watching, Profile, Settings
```

**Why this order:** Discovery is the entry point for every visitor — logged-in or not. Catalog detail is the destination of every discovery action. Personal content requires authentication and is visited with intent, not serendipity.

---

## 2. Entity Relationships

### Core entities

```
Anime ──< Episode (one anime has many episodes)
  │
  └──< Season (one anime has many seasons, each has many episodes)
  │
  └──> Genre (many-to-many via anime_genres join table)
  │
  └──> Watchlist (many-to-many via users)
  │
  └──> WatchProgress (one anime has many progress records, one per user)

User ──< Watchlist (one user has many watchlist entries)
  │
  ──< WatchProgress (one user has many progress records)
  │
  ──< Subscription (one user has one active subscription)
  │
  ──< Session (one user has many sessions)
  │
  ──< Notification (one user has many notifications)
```

### Entity attributes (summary)

**Anime:** id, slug, title (romaji, english, japanese), synopsis, coverImage, bannerImage, trailerUrl, episodeCount, rating, status (airing, finished, upcoming), year, season, studios, genres[], episodes[].

**Episode:** id, animeId, number, title, duration, thumbnail, airDate, synopsis, videoUrl (signed).

**User:** id, username, email, avatarUrl, displayName, joinedAt, plan (free | premium).

**WatchlistEntry:** id, userId, animeId, addedAt, sortPosition, status (want_to_watch | watching | completed | dropped).

**WatchProgress:** id, userId, animeId, episodeId, positionSeconds, durationSeconds, updatedAt.

**Notification:** id, userId, type, title, body, linkUrl, read, createdAt.

---

## 3. Content Types

### Catalog content (public, ISR)

| Content type      | Source                    | Update cadence | Cache     |
| ----------------- | ------------------------- | -------------- | --------- |
| Anime metadata    | TMDB + AniList            | Daily sync     | 1hr ISR   |
| Episode list      | TMDB + AniList            | Daily sync     | 24hr ISR  |
| Trending rankings | Internal (watch + rating) | Hourly         | 5min ISR  |
| Popular rankings  | Internal (all-time)       | Daily          | 1hr ISR   |
| Latest releases   | TMDB + AniList            | Daily          | 15min ISR |
| Genre list        | Static TMDB list          | Weekly         | 24hr ISR  |
| Schedule          | TMDB + AniList            | Daily          | 1hr ISR   |

### Personal content (private, SSR)

| Content type      | Source      | Update cadence | Cache    |
| ----------------- | ----------- | -------------- | -------- |
| Watchlist         | Internal DB | Real-time      | No cache |
| Watch history     | Internal DB | Real-time      | No cache |
| Continue watching | Internal DB | Real-time      | No cache |
| Profile           | Internal DB | Real-time      | No cache |
| Settings          | Internal DB | Real-time      | No cache |
| Notifications     | Internal DB | Real-time      | No cache |

### Marketing content (static, SSG)

| Content type | Source       | Update cadence | Cache |
| ------------ | ------------ | -------------- | ----- |
| Landing page | CMS / static | On deploy      | SSG   |
| Pricing      | Static       | On deploy      | SSG   |
| About        | Static       | On deploy      | SSG   |
| Terms        | Static       | On deploy      | SSG   |

---

## 4. Page-to-Entity Mapping

| Page              | Primary entity   | Secondary entities     | Content tier       |
| ----------------- | ---------------- | ---------------------- | ------------------ |
| Landing           | —                | —                      | Marketing          |
| Home              | Anime (ranked)   | Genre                  | Discovery          |
| Trending          | Anime (ranked)   | —                      | Discovery          |
| Popular           | Anime (ranked)   | —                      | Discovery          |
| Latest            | Anime (ranked)   | —                      | Discovery          |
| Genres            | Genre            | Anime                  | Discovery          |
| Schedule          | Episode (by day) | Anime                  | Discovery          |
| Search            | Anime (filtered) | —                      | Discovery          |
| Anime Detail      | Anime            | Episode, Season, Genre | Catalog            |
| Episode Player    | Episode          | Anime, WatchProgress   | Catalog + Personal |
| Watch History     | WatchProgress    | Anime                  | Personal           |
| Bookmarks         | WatchlistEntry   | Anime                  | Personal           |
| Continue Watching | WatchProgress    | Anime                  | Personal           |
| Profile           | User             | —                      | Personal           |
| Settings          | User             | Subscription           | Personal           |
| Notifications     | Notification     | —                      | Personal           |

---

## 5. URL-to-Entity Mapping

| URL pattern               | Entity              | Lookup                     |
| ------------------------- | ------------------- | -------------------------- |
| `/`                       | Home feed           | Trending + genres          |
| `/trending`               | Anime list          | Trending ranking           |
| `/popular`                | Anime list          | Popular ranking            |
| `/latest`                 | Anime list          | Latest releases            |
| `/genres`                 | Genre list          | Static genre list          |
| `/genres/:slug`           | Genre + Anime[]     | Genre filter               |
| `/schedule`               | Episode[] by day    | Weekly schedule            |
| `/search?q=`              | Anime[]             | Search query               |
| `/anime/:slug`            | Anime               | Slug lookup                |
| `/anime/:slug/season/:n`  | Season + Episode[]  | Season lookup              |
| `/anime/:slug/episode/:n` | Episode             | Episode lookup             |
| `/watchlist`              | WatchlistEntry[]    | User filter                |
| `/history`                | WatchProgress[]     | User filter                |
| `/continue`               | WatchProgress[]     | User filter, non-completed |
| `/profile`                | User                | Session user               |
| `/settings`               | User + Subscription | Session user               |
| `/notifications`          | Notification[]      | User filter                |

**Why slugs, not UUIDs in public URLs:** Slugs are human-readable, SEO-friendly, and stable. UUIDs are used internally for joins. Both lookups are supported — slug for public routes, UUID for internal references.

---

## 6. Content Priority by Page Region

Every page has a **visual hierarchy** that maps to content priority:

### Catalog pages (Home, Trending, Popular, Latest, Genres, Search)

1. **Hero / Featured** — 1 featured anime, large banner, autoplay trailer muted
2. **Primary grid** — ranked anime cards, poster + title + rating
3. **Secondary rail** — sidebar or below-fold carousels (related, upcoming)
4. **Tertiary** — metadata, footer links

### Detail pages (Anime Detail, Season Detail)

1. **Hero banner** — full-width backdrop, title, meta, primary actions (Watch / Add to Watchlist)
2. **Synopsis + meta** — synopsis, studios, genres, rating, episode count
3. **Episode list** — numbered list with thumbnails, durations, progress bars
4. **Related** — recommendations, similar anime

### Personal pages (Watch History, Bookmarks, Continue Watching)

1. **Header** — page title, count, sort/filter controls
2. **Grid / List** — entries with metadata and actions
3. **Empty state** — illustration + CTA when no entries

---

## 7. Content States

Every entity has a **state machine** that the UI must reflect:

### Anime state

```
unknown → loading → loaded
                     ↓
              error (network / not found)
```

### WatchlistEntry state

```
want_to_watch → watching → completed
                    ↓
                 dropped
```

### WatchProgress state

```
unstarted → in_progress → completed
```

### User session state

```
anonymous → authenticating → authenticated
                 ↓
             error (invalid credentials)
```

### Notification state

```
unread → read
```

---

## 8. Content Operations

| Operation              | Entity         | Auth required | Optimistic?               |
| ---------------------- | -------------- | ------------- | ------------------------- |
| View catalog           | Anime          | No            | —                         |
| View detail            | Anime          | No            | —                         |
| Search                 | Anime          | No            | —                         |
| Add to watchlist       | WatchlistEntry | Yes           | Yes                       |
| Remove from watchlist  | WatchlistEntry | Yes           | Yes                       |
| Reorder watchlist      | WatchlistEntry | Yes           | Yes                       |
| Update watch progress  | WatchProgress  | Yes           | No (server-authoritative) |
| Update profile         | User           | Yes           | No                        |
| Upload avatar          | User           | Yes           | No                        |
| Mark notification read | Notification   | Yes           | Yes                       |

---

## 9. Content Constraints

- **Title length:** Truncate at 40 characters in cards, full in detail views.
- **Synopsis length:** Truncate at 160 characters in cards, full with "Read more" toggle in detail.
- **Rating display:** Show one decimal (e.g. 8.7). Hide if no ratings exist.
- **Episode count:** Show "12 episodes" for finished, "12 / 24 eps" for airing.
- **Air date:** Show relative time ("2 days ago") for recent, absolute date ("Jan 15, 2026") for older.
- **Duration:** Show "24:05" format, or "24 min" in cards.

---

## 10. Future Enhancements

- **Collections** — curated editorial lists (e.g. "Best of 2025", "Hidden Gems").
- **Reviews** — user-written reviews on anime detail.
- **Recommendations** — personalized "Because you watched X" carousels.
- **Multi-language content** — localized synopses and titles.
- **Content warnings** — per-episode content notes.
