# Anime Detail — Nexus Anime

> **Audience:** Engineers, Product, Design
> **Milestone:** M4
> **Owner:** Product
> **Status:** Draft

---

## 1. Purpose

The Anime Detail page is the primary catalog surface where users decide whether to watch, save, or explore a series. It presents a hero banner with key metadata, synopsis, episode list by season, watchlist toggle, trailer, recommendations, and similar titles — all the information a user needs to take action on a single anime.

## 2. Business Goals

- Maximize watch conversion: target 40% of anime detail page visits resulting in a play action (clicking "Watch" or an episode row).
- Increase watchlist saves: target 20% of detail page visits adding the anime to their watchlist.
- Drive catalog depth via recommendations and similar titles — target 10% click-through to a second anime detail page.
- Support SEO acquisition via structured data and indexable detail pages; target 5% of organic traffic landing on detail pages.

## 3. Functional Requirements

### 3.1 Happy Path

1. User navigates to `/anime/{slug}` from a search result, genre page, or recommendation card.
2. System renders hero banner with backdrop image, title (romaji/English/Japanese), metadata row, and genre pills.
3. User clicks "Watch S01 E01" primary button (or "Continue Watching S01 E05" if resumed) to navigate to the Episode Player.
4. User clicks the WatchlistToggle to add or remove the anime from their watchlist.
5. User clicks "Trailer" button to open an inline trailer preview overlay.
6. User selects a season tab in the episode panel to browse episodes for that season.
7. User clicks an episode row to navigate to the Episode Player for that episode.
8. User scrolls to recommendations and similar carousels, clicks an anime card to navigate to another detail page.

### 3.2 Alternate Flows

1. User arrives via a shared deep link (`/anime/attack-on-titan`); page renders at the correct scroll position (top).
2. User is logged in and has prior watch history; the "Watch" button shows "Continue Watching S01 E05" with progress indicator.
3. User is not logged in; the watchlist toggle shows a sign-in prompt instead.
4. User clicks a genre pill on the hero section; navigates to `/genres/{genre-slug}`.

### 3.3 Edge Cases

1. Anime with 0 episodes — episode panel shows empty state with "No episodes available yet."
2. Anime with 50+ seasons (e.g. long-running series like One Piece) — season selector is scrollable with search/filter.
3. Deleted anime (soft-deleted) — returns 404 with generic message.
4. Slug change — old slug redirects via 301 to the new slug.

## 4. Non-Functional Requirements

- **Performance:** LCP < 2.5s; API p95 < 200ms; ISR revalidate every 15 minutes.
- **Availability:** 99.9% — the detail page is the highest-traffic catalog surface.
- **Scalability:** 15k concurrent page views; 300 req/s at the API layer during peak.
- **Accessibility:** WCAG 2.2 AA; hero content keyboard-accessible; episode list with proper `role="list"` and row labels; watchlist toggle with `aria-pressed`.
- **Localization:** Title display respects `title`, `title_jp` preferences; synopsis text externalized for translation; genre pill labels localized.
- **Security:** No auth required for read; watchlist toggle requires session; signed Cloudflare Stream URLs for trailer (short expiry); no PII in ISR cache.

## 5. User Stories

- As a **visitor**, I want to see the synopsis, rating, and trailer so that I can decide whether to watch a series.
- As a **visitor**, I want to browse episodes by season so that I can find a specific episode to watch.
- As a **logged-in user**, I want to add the anime to my watchlist so that I can find it later.
- As a **returning user**, I want to see a "Continue Watching" button so that I can pick up where I left off.
- As a **returning user**, I want to see recommendations and similar titles so that I can discover more anime I might enjoy.

## 6. Acceptance Criteria

- [ ] Page renders at `/anime/{slug}` with hero banner, synopsis, episode list, and recommendation carousels.
- [ ] Hero banner shows: backdrop image, title (romaji, English, Japanese), metadata row (rating, year, season, episode count, status), genre pills.
- [ ] "Watch" button shows "Watch S01 E01" for new users or "Continue Watching S0X E0Y" for users with watch history.
- [ ] Watchlist toggle reflects current state (added/not added) and calls Server Action on click.
- [ ] Season selector tabs allow switching between seasons; episode list updates accordingly.
- [ ] Episode rows show: number, title, thumbnail, duration, air date, and progress bar (if applicable).
- [ ] Recommendations carousel shows at least 6 anime cards; horizontally scrollable.
- [ ] Similar titles carousel shows at least 6 anime cards; horizontally scrollable.
- [ ] Trailer opens in an inline overlay (not a new tab) when Trailer button is clicked.
- [ ] Page revalidates every 15 minutes (ISR).
- [ ] Deleted anime returns 404; slug redirects return 301.

## 7. UI Components

| Component         | Responsibility                                               | Reusable? | Package     |
| ----------------- | ------------------------------------------------------------ | --------- | ----------- |
| `AnimeDetailPage` | Page shell with Suspense boundaries per section              | No        | `apps/web`  |
| `HeroBanner`      | Full-width backdrop + title block + metadata + genre pills   | Yes       | `@nexus/ui` |
| `ActionBar`       | Watch, Watchlist, Trailer, Share buttons                     | Yes       | `@nexus/ui` |
| `WatchlistToggle` | Bookmark toggle with `aria-pressed`                          | Yes       | `@nexus/ui` |
| `SynopsisPanel`   | Synopsis text + detailed metadata grid                       | Yes       | `@nexus/ui` |
| `EpisodePanel`    | Season selector tabs + episode table                         | Yes       | `@nexus/ui` |
| `SeasonSelector`  | Tab bar for season switching                                 | Yes       | `@nexus/ui` |
| `EpisodeTable`    | Scrollable list of episode rows                              | Yes       | `@nexus/ui` |
| `EpisodeRow`      | Single episode: number, title, thumbnail, duration, progress | Yes       | `@nexus/ui` |
| `AnimeCard`       | Poster + title + rating — reused from catalog in carousels   | Yes       | `@nexus/ui` |
| `RelatedCarousel` | Horizontally scrollable anime card row with header           | Yes       | `@nexus/ui` |
| `TrailerOverlay`  | Inline video player overlay for trailer playback             | No        | `apps/web`  |

## 8. API Dependencies

| Endpoint                                 | Method | Auth Required | Rate Limit      | Cache      |
| ---------------------------------------- | ------ | ------------- | --------------- | ---------- |
| `/api/v1/anime/{slug}`                   | GET    | No            | 60/min per IP   | 15 min ISR |
| `/api/v1/anime/{slug}/episodes?season=1` | GET    | No            | 60/min per IP   | 15 min ISR |
| `/api/v1/anime/{slug}/recommendations`   | GET    | No            | 60/min per IP   | 15 min ISR |
| `/api/v1/bookmarks`                      | POST   | Yes           | 30/min per user | No         |
| `/api/v1/watch-history`                  | GET    | Yes           | 30/min per user | No         |

`/api/v1/anime/{slug}` returns full anime metadata including hero data, synopsis, and genre list.

`/api/v1/anime/{slug}/episodes?season=1` returns a paginated episode list for the selected season.

`/api/v1/anime/{slug}/recommendations` returns up to 12 recommended anime based on collaborative filtering or editorial curation.

## 9. Database Dependencies

| Table / View      | Operation       | Index / Query Notes                                                                   |
| ----------------- | --------------- | ------------------------------------------------------------------------------------- |
| `anime`           | SELECT          | Lookup by `slug`; index on `slug` (unique); filtered by `deleted_at IS NULL`          |
| `anime_genres`    | SELECT (join)   | Genre list for the anime; index on `anime_id`                                         |
| `genres`          | SELECT (join)   | Genre names and slugs for pill display; index on `id`                                 |
| `seasons`         | SELECT          | Season list for the anime; index on `anime_id`, ordered by `number`                   |
| `episodes`        | SELECT          | Episodes per season; index on `(season_id, number)`; filtered by `deleted_at IS NULL` |
| `bookmarks`       | SELECT / INSERT | Watchlist state; index on `(user_id, anime_id)`                                       |
| `watch_history`   | SELECT          | Resume position for "Continue Watching"; index on `(user_id, anime_id)`               |
| `recommendations` | SELECT          | Pre-computed recommendation pairs; index on `source_anime_id`                         |

## 10. Edge Cases

1. **Anime with 0 episodes:** Episode panel renders empty state: "No episodes available yet. Check back later." The "Watch" button is hidden; only Watchlist and Trailer buttons remain.
2. **Anime with 50+ seasons:** Season selector becomes a scrollable dropdown with a search/filter input. Default tab shows the most recent season with aired episodes.
3. **Deleted anime (soft-deleted with `deleted_at`):** API returns 404; page renders a "This anime is no longer available." message with a CTA to browse the catalog. No structured data emitted.
4. **Slug change:** A redirect mapping table (or `slug` history) ensures `/anime/old-slug` returns HTTP 301 to `/anime/new-slug`. Old slug SHALL NOT render a duplicate page.
5. **Synopsis is null:** Render muted placeholder text "No synopsis available." in `text-secondary`.
6. **Trailer URL is null:** Trailer button is hidden entirely rather than disabled.
7. **Recommendations API returns empty:** Recommendations carousel is omitted from the page; "Similar" carousel still renders if data is available.
8. **Episode with `video_asset_id` null:** Episode row renders but the play button is replaced with a "Not yet available" label; row is not clickable.
9. **Concurrent watchlist toggle clicks:** Server Action uses optimistic concurrency (`version` column) to prevent duplicate entries; if conflict, return current state without error.

## 11. Error Handling

| Error Condition                | User-Facing Message                                               | Recovery Action                                | Log Level |
| ------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------- | --------- |
| Anime API 404                  | "This anime doesn't exist or has been removed."                   | CTA "Browse catalog"                           | info      |
| Anime API 500                  | "Something went wrong loading this page."                         | Retry button (primary)                         | error     |
| Episodes API fails             | Episode panel shows: "Could not load episodes." with inline retry | Inline "Retry" button                          | error     |
| Recommendations API fails      | Carousel omitted from page                                        | No user-facing message; log for monitoring     | warn      |
| Watchlist toggle fails         | Revert optimistic update; toast "Could not update watchlist."     | User can retry                                 | error     |
| Trailer overlay playback error | "Trailer could not be loaded." with close button                  | Close overlay; episode list remains accessible | warn      |

## 12. Analytics Events

| Event Name                   | Trigger                                       | Properties                                                | Surface     |
| ---------------------------- | --------------------------------------------- | --------------------------------------------------------- | ----------- | ---------------- | ----------- | ------ |
| `anime_detail_view`          | Page mount                                    | `{ anime_id, slug, referrer: "search"                     | "genre"     | "recommendation" | "direct" }` | Client |
| `anime_watch_click`          | "Watch" or "Continue Watching" button clicked | `{ anime_id, episode_id, is_resume }`                     | Client      |
| `anime_watchlist_toggle`     | Watchlist icon clicked                        | `{ anime_id, action: "add"                                | "remove" }` | Client           |
| `anime_trailer_click`        | Trailer button clicked                        | `{ anime_id }`                                            | Client      |
| `anime_episode_click`        | Episode row clicked                           | `{ anime_id, episode_id, season_number, episode_number }` | Client      |
| `anime_season_change`        | Season tab switched                           | `{ anime_id, season_number }`                             | Client      |
| `anime_recommendation_click` | Recommendation card clicked                   | `{ source_anime_id, target_anime_id, position }`          | Client      |
| `anime_similar_click`        | Similar title card clicked                    | `{ source_anime_id, target_anime_id, position }`          | Client      |

## 13. Security Considerations

- **Slug injection:** Validate `slug` parameter against `[a-z0-9-]+` pattern via Zod; reject malformed values with 400.
- **Watchlist auth:** Watchlist toggle POST requires valid session; return 401 for unauthenticated requests.
- **Signed trailer URLs:** Cloudflare Stream signed URLs with short expiry (5 minutes); never expose unsigned URLs.
- **No PII in ISR:** Watch history and watchlist state are fetched client-side after hydration; ISR cache contains only public data.
- **CSP:** `img-src` allows Cloudflare R2 and TMDB image hosts; `media-src` allows Cloudflare Stream domain for trailer.
- **Synopsis sanitization:** Synopsis text (user-editable by admins) is sanitized via DOMPurify before rendering to prevent stored XSS.
- **OWASP A01 (Broken Access Control):** Watchlist and watch-history endpoints enforce session ownership; one user cannot read another user's watchlist.
- **SQL injection:** Drizzle parameterized queries on slug lookup; no raw SQL.

## 14. Performance Requirements

- **LCP** < 2.5s on 4G; hero backdrop image uses `next/image` with `priority` and `sizes` attribute.
- **FID** < 100ms; interactive buttons (Watch, Watchlist, Trailer) hydrate within 100ms.
- **API p95** < 200ms for anime detail; < 150ms for episodes; < 200ms for recommendations.
- **DB query p95** < 50ms for slug lookup; < 80ms for episodes with season join; < 100ms for recommendations.
- **ISR** revalidate = 900 (15 minutes); anime metadata changes infrequently.
- **Rendering strategy:** ISR for anime detail page. Streaming SSR: hero banner and synopsis render first, then episodes and recommendations stream in via `<Suspense>` boundaries.
- **Bundle-size budget:** < 40 KB client JS for the anime detail route (includes season tabs, episode table, carousel, watchlist toggle, trailer overlay).

## 15. Future Improvements

1. Inline trailer preview that expands from the hero CTA into a full-width video overlay without page navigation.
2. User reviews and ratings — replace the v1 silent placeholder with an interactive review section.
3. "Jump to next unwatched" floating action button on the episode panel for returning users.
4. Multiple audio/subtitle track selection in the episode row (language badges).
5. Personalized "Because you watched X" recommendation row replacing the generic recommendations.
6. Franchise navigation — "Part of the Attack on Titan franchise" with a timeline view of related entries.
7. Social proof indicators — "1,240 people are watching this season" real-time viewer count.
