# Latest — Nexus Anime

> **Audience:** Engineers, Product, Design
> **Milestone:** M4
> **Owner:** Product
> **Status:** Draft

---

## 1. Purpose

The Latest page surfaces recently released and upcoming anime episodes in strict chronological order — distinct from Trending, which ranks by engagement-weighted score. Users visit Latest to track what aired this week and discover newly available episodes.

## 2. Business Goals

- Increase session frequency by giving returning users a reason to check back daily or weekly for new content.
- Drive watch-time by surfacing fresh episodes that match the user's genre preferences.
- Improve retention metrics: target 15% of weekly active users visiting the Latest page at least once.
- Support simulcast awareness so premium/licensed content gets immediate visibility on release.

## 3. Functional Requirements

### 3.1 Happy Path
1. User navigates to `/latest` via main nav "Latest" tab.
2. System renders a chronologically sorted grid of recently released episodes (most recent first), grouped into "Recently Released" and "Coming Soon" sections.
3. User applies a season filter (e.g. "Winter 2026") and/or genre filter (e.g. "Action"); the grid re-filters client-side with no full page reload.
4. User scrolls to bottom; infinite-scroll sentinel loads the next batch of 20 episodes.
5. User clicks an episode card to navigate to the Episode Player page.

### 3.2 Alternate Flows
1. User arrives via deep link from a push notification or email digest (`/latest?season=winter-2026&genre=action`); page renders with pre-applied filters.
2. User lands from the Home page "New Releases" section "See All" link; page renders with no filters pre-applied.
3. User clicks a "Watchlist" toggle on a card; the anime is added to or removed from their watchlist without leaving the page.

### 3.3 Edge Cases
1. No episodes released this week — empty state rendered.
2. Future-dated episodes (scheduled but not yet aired) appear in "Coming Soon" with premiere date badge.
3. Simulcast episode released earlier than expected (timestamp in the future); system SHALL clamp display to current date or show "Coming Soon" until air time.
4. Delayed release where `aired_at` is null for an episode that should have aired; system SHALL exclude it from "Recently Released" and show it under a "Delayed" indicator if data is available.

## 4. Non-Functional Requirements

- **Performance:** LCP < 2.0s; API p95 < 200ms; ISR revalidate every 5 minutes.
- **Availability:** 99.9% — Latest page is a primary traffic driver; degradation is highly visible.
- **Scalability:** Support 10k concurrent page views; 200 req/s at the API layer during peak simulcast windows.
- **Accessibility:** WCAG 2.2 AA; keyboard-navigable filter toolbar; screen-reader announcements for filter changes and new content loads.
- **Localization:** Season label externalization (e.g. "Winter 2026" / "Hiver 2026"); RTL-safe layout for filter chips; CJK font stack for anime titles.
- **Security:** No auth required for read; Zod validation on all query parameters; no secrets in ISR cache; rate-limit API at 60 req/min per IP.

## 5. User Stories

- As a **visitor**, I want to see the newest released episodes across all genres so that I can find something to watch right now.
- As a **visitor**, I want to filter by season (e.g. Winter 2026) so that I can browse anime airing in the current season.
- As a **logged-in user**, I want to toggle watchlist status from the Latest page so that I can save anime without navigating away.
- As a **returning user**, I want the page to reflect episodes released since my last visit so that I can pick up where I left off.

## 6. Acceptance Criteria

- [ ] Latest page renders at `/latest` with chronologically sorted episode cards (newest first).
- [ ] "Recently Released" and "Coming Soon" sections are visually distinct with separate headers.
- [ ] Season filter dropdown includes all seasons with released episodes; selecting a season re-filters the grid.
- [ ] Genre filter dropdown includes all active genres (from `genres` table); selecting a genre re-filters the grid.
- [ ] Infinite scroll loads 20 episodes per batch via cursor-based pagination.
- [ ] Watchlist toggle on each card calls Server Action and updates optimistically.
- [ ] Page revalidates every 5 minutes (ISR) so new episodes appear promptly.
- [ ] Empty state renders when zero episodes match the active filters.
- [ ] Future-dated episodes appear only in "Coming Soon" section with a premiere date badge.

## 7. UI Components

| Component | Responsibility | Reusable? | Package |
|-----------|---------------|-----------|---------|
| `LatestPage` | Page shell — layout, Suspense boundaries | No | `apps/web` |
| `LatestToolbar` | Season + genre filter controls, sort toggle | Yes | `@nexus/ui` |
| `LatestEpisodeCard` | Episode card with poster, title, anime name, air date, NewRibbon | Yes | `@nexus/ui` |
| `NewRibbon` | "NEW" overlay badge on recently aired episodes | Yes | `@nexus/ui` |
| `PremiereBadge` | Outline badge showing premiere date for upcoming episodes | Yes | `@nexus/ui` |
| `WatchlistToggle` | Bookmark icon toggle per card | Yes | `@nexus/ui` |
| `LatestSection` | Section wrapper with header ("Recently Released" / "Coming Soon") | Yes | `@nexus/ui` |

## 8. API Dependencies

| Endpoint | Method | Auth Required | Rate Limit | Cache |
|----------|--------|---------------|------------|-------|
| `/api/v1/episodes/latest` | GET | No | 60/min per IP | 5 min ISR |
| `/api/v1/genres` | GET | No | 60/min per IP | 15 min CDN |
| `/api/v1/bookmarks` | POST | Yes | 30/min per user | No |

Query parameters for `/api/v1/episodes/latest`: `season` (e.g. `winter-2026`), `genre` (slug), `cursor` (opaque), `limit` (default 20, max 50).

## 9. Database Dependencies

| Table / View | Operation | Index / Query Notes |
|--------------|-----------|---------------------|
| `episodes` | SELECT | Index on `aired_at DESC` for chronological sort; filtered by `aired_at <= now()` for released, `aired_at > now()` for upcoming |
| `anime` | SELECT (join) | Joined via `anime_id` for title, poster, slug |
| `anime_genres` | SELECT (join) | Joined for genre filtering; index on `genre_id` |
| `genres` | SELECT | Filter dropdown data; index on `slug`, `is_active` |
| `release_schedule` | SELECT | Upcoming episode airdates; index on `airs_at` |
| `bookmarks` | SELECT / INSERT | Watchlist state per user; index on `(user_id, anime_id)` |

## 10. Edge Cases

1. **No episodes this week:** Render empty-state illustration with message "No new episodes this week. Check back soon!" and a CTA to browse the catalog.
2. **Future-dated episode with `aired_at` in the future:** Display in "Coming Soon" section only; do not show in "Recently Released."
3. **Simulcast vs. delayed release:** Episodes with `aired_at` set but `video_asset_id` null (no stream available yet) SHALL show a "Not yet available" badge instead of a play button.
4. **Episode with null `aired_at`:** Exclude from chronological sort; log a warning for data quality review.
5. **Season filter with zero results:** Render genre-appropriate empty state with "No episodes found for Winter 2026 in Action. Try a different filter."
6. **Cursor pagination gap:** If an episode is soft-deleted between cursor fetches, the system SHALL return the next valid episode without skipping a visible entry.
7. **Very long genre/season combination:** Response exceeding 500 episodes SHALL paginate correctly via cursor; no unbounded arrays returned to the client.

## 11. Error Handling

| Error Condition | User-Facing Message | Recovery Action | Log Level |
|-----------------|---------------------|-----------------|-----------|
| Episodes API 500 | "Something went wrong loading new episodes." | Retry button (primary) | error |
| Episodes API 503 | "Episodes are temporarily unavailable." | Auto-retry with exponential backoff (1s, 2s, 4s) | warn |
| Genre filter fetch fails | Genre dropdown renders empty; no genre filter available | Show toast: "Could not load genre filters." | warn |
| Watchlist toggle fails | Revert optimistic update; show toast "Could not update watchlist." | User can retry manually | error |
| Network offline | "You appear to be offline. Check your connection." | Disable infinite scroll; show cached ISR content | warn |

## 12. Analytics Events

| Event Name | Trigger | Properties | Surface |
|------------|---------|------------|---------|
| `latest_page_view` | Page mount | `{ season_filter, genre_filter }` | Client |
| `latest_episode_click` | Episode card clicked | `{ anime_id, episode_id, section: "recently_released" | "coming_soon" }` | Client |
| `latest_filter_change` | Filter dropdown value changed | `{ filter_type: "season" | "genre", filter_value }` | Client |
| `latest_watchlist_toggle` | Watchlist icon clicked | `{ anime_id, action: "add" | "remove" }` | Client |
| `latest_infinite_scroll` | Next batch loaded | `{ cursor_position, batch_size }` | Client |

## 13. Security Considerations

- Zod validation on all query parameters (`season`, `genre`, `cursor`, `limit`) — reject malformed input with 400.
- Rate limit `/api/v1/episodes/latest` at 60 req/min per IP to prevent scraping.
- No PII exposed on the Latest page (public, no auth required).
- ISR cache Contains no user-specific data; watchlist state fetched client-side after hydration.
- CSP: `img-src` must allow poster URLs from Cloudflare R2 / TMDB image hosts.
- SQL injection mitigated via Drizzle parameterized queries; no raw SQL in route handlers.
- OWASP A01 (Broken Access Control): watchlist mutation requires valid session; unauthorized POST returns 401.

## 14. Performance Requirements

- **LCP** < 2.0s on 4G connection; hero poster images use `next/image` with `priority` on first 4 cards.
- **FID** < 100ms; filter interactions are client-side after initial fetch.
- **API p95** < 200ms for `/api/v1/episodes/latest`; DB query p95 < 50ms via `aired_at DESC` index.
- **Cache hit ratio** > 95% for ISR-served pages during normal traffic.
- **Rendering strategy:** ISR with `revalidate = 300` (5 minutes). Streaming SSR for first paint; `<Suspense>` boundary per section ("Recently Released" renders first, "Coming Soon" streams in).
- **Bundle-size budget:** < 25 KB client JS for the Latest route (excluding shared layout).

## 15. Future Improvements

1. Day-of-week grouping within "Recently Released" for easier tracking of weekly airing schedules.
2. Push notification subscription per anime title for premiere reminders from "Coming Soon."
3. Personalized "Recommended New" section based on watch history and genre preferences.
4. Calendar-view toggle for upcoming premiere dates, integrated with the Schedule page.
5. Real-time update via SSE when a new episode is added during an active session, avoiding the 5-min ISR delay.
