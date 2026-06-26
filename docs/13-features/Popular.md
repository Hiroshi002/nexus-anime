# Popular — Nexus Anime

> **Audience:** Engineers implementing the all-time popular page. Defines the definitive top-ranked anime view with sorting and genre filtering.
> **Milestone:** M3
> **Owner:** Engineering
> **Status:** Draft

---

## 1. Purpose

Show all-time popular anime ranked by rating, popularity, or view count. Unlike trending (which is time-bound), popular is the definitive "best of all time" list. This page serves users looking for proven, high-quality anime and helps new users discover the catalog's strongest entries.

## 2. Business Goals

- **Trust:** All-time rankings signal catalog quality to new visitors. Target: 40% of new signups browse `/popular` before their first session.
- **Discovery:** Users use popular to find highly-rated anime they missed. Target: 20% of sessions visit `/popular`.
- **Engagement:** Sorting by different dimensions (rating, popularity, year) keeps the page fresh for returning users. Target: average session duration on `/popular` > 90s.
- **Content quality signal:** Minimum rating threshold (100+ ratings) ensures the list reflects genuine quality, not one-person 5-star ratings. > 95% of listed anime have a statistically significant rating.

## 3. Functional Requirements

### 3.1 Happy Path

1. Visitor navigates to `/popular`. System renders the popular page with default sort (rating) and no genre filter.
2. The grid shows anime ordered by rating (highest first), with rank numbers overlaid on posters, titles, and metadata.
3. User changes sort to "Popularity". System re-fetches with `?sort=popularity` and re-renders the grid.
4. User changes sort to "Year". System re-fetches with `?sort=year` and re-renders.
5. User filters by genre "Action". System re-fetches with `?genre=action` and re-renders.
6. User clicks an anime card. System navigates to `/anime/{id}`.
7. User clicks the watchlist toggle on a card. System adds/removes the anime from the user's watchlist (authenticated only).
8. User clicks "Load more" at the bottom. System fetches the next page and appends cards to the grid.

### 3.2 Alternate Flows

1. **Genre filter produces fewer than 12 results:** Grid shows all results without padding. "Load more" button is hidden (no next page).
2. **Sort by "Year" with genre filter:** Results are sorted by release year (newest first) within the genre. Secondary sort by rating.
3. **Authenticated user clicks watchlist toggle on an anime already in watchlist:** System removes it from the watchlist and updates the UI (heart icon unfills).
4. **Anonymous user clicks watchlist toggle:** System shows a tooltip: "Sign up to save your watchlist" with a "Sign up" link.
5. **User on mobile switches to carousel view:** User taps the carousel toggle icon. Grid switches to a horizontal snap-scroll carousel. Preference is persisted to `localStorage`.

### 3.3 Edge Cases

1. **Minimum rating threshold:** Anime with fewer than 100 ratings are excluded from the popular list. This prevents one-person 5-star ratings from appearing. The threshold is a constant (`MIN_POPULARITY_RATINGS = 100`) and is not user-configurable.
2. **Genre with no popular entries:** User filters by a niche genre (e.g., "Slice of Life") where no anime meet the minimum rating threshold. System shows the empty state: "No popular anime in this genre yet. Browse all genres." with a "Reset filters" button.
3. **Ties in rating:** Two anime have the same rating (e.g., 8.7). Tie-breaker: higher number of ratings wins (more statistically significant). If still tied, higher view count. If still tied, alphabetical by romaji title.
4. **Sort by "Year" with anime from the same year:** Many anime released in the same year. Secondary sort by rating (descending) ensures a meaningful order within the year.
5. **Anime with no rating:** Anime with `rating_count = 0` are excluded from the popular list entirely. They appear in `/latest` instead.
6. **Soft-deleted anime:** The query filters `deleted_at IS NULL`. If a popular anime is soft-deleted, it disappears from the next revalidated list. No broken links.
7. **ISR cache invalidation:** ISR revalidates every 15 minutes. New anime meeting the threshold appear within 15 minutes of their rating count crossing 100.
8. **Very large page number (e.g., page 50):** Cursor-based pagination prevents deep-page performance issues. If a user manually enters a page cursor that doesn't exist, the API returns an empty result and the system shows the empty state.
9. **Genre filter + sort combination:** All sort options are available with genre filtering. The API applies genre filter first, then sorts the filtered results. No sort is disabled by genre.

## 4. Non-Functional Requirements

- **Performance:** Initial page render p95 < 300ms (ISR). Filter/sort change p95 < 200ms. LCP < 2.0s.
- **Availability:** 99.9%. ISR serves stale data if the origin is unreachable.
- **Scalability:** 100k monthly visitors. Popular query is served from ISR cache; origin load is minimal.
- **Accessibility:** WCAG 2.2 AA. Cards have descriptive `aria-label`. Rank badge `aria-hidden`. Toolbar controls are proper form elements with visible labels.
- **Localization:** Anime titles displayed in user's locale. Sort labels externalized.
- **Security:** No user input beyond query parameters. Rate-limited API. No sensitive data in the response.

## 5. User Stories

- As a **visitor**, I want to see the highest-rated anime of all time so that I can find quality titles to watch.
- As a **visitor**, I want to sort by rating, popularity, or year so that I can explore the catalog from different angles.
- As a **visitor**, I want to filter by genre so that I can find the best anime in my favorite genre.
- As a **new user**, I want to browse the top 100 anime so that I can start my watchlist with proven titles.
- As a **logged-in user**, I want to add anime to my watchlist directly from the popular page so that I do not have to navigate to each detail page.

## 6. Acceptance Criteria

- [ ] Default view shows all-type, sorted by rating, with no genre filter.
- [ ] Sort options (Rating, Popularity, Year) re-fetch data and re-render the grid.
- [ ] Genre filter re-fetches data and re-renders the grid.
- [ ] Anime with fewer than 100 ratings are excluded from the list.
- [ ] Tie-breaking is deterministic (rating count → view count → alphabetical).
- [ ] Empty state shows when genre filter produces no qualifying anime, with a "Reset filters" button.
- [ ] ISR revalidates every 900 seconds (15 minutes).
- [ ] "Load more" button fetches the next page and appends cards.
- [ ] Mobile view switches between grid and carousel (toggle persisted to `localStorage`).
- [ ] Page passes `pnpm typecheck` with strict mode.
- [ ] All interactive elements are keyboard-accessible.
- [ ] `prefers-reduced-motion` disables stagger and scale animations.

## 7. UI Components

| Component | Responsibility | Reusable? | Package |
|-----------|---------------|-----------|---------|
| `PopularPage` | Page shell with header, toolbar, and grid | No | `apps/web` |
| `PopularToolbar` | Sticky toolbar containing filter and sort controls | No | `apps/web` |
| `FilterChipGroup` | Chip group for genre filter | Yes | `@nexus/ui` |
| `SortDropdown` | Dropdown for sort options | Yes | `@nexus/ui` |
| `PopularGrid` | Responsive card grid with stagger animation | No | `apps/web` |
| `PopularCard` | Card with rank badge, poster, title, rating, watchlist toggle | No | `apps/web` |
| `RankBadge` | Large rank number overlay on poster | Yes | `@nexus/ui` |
| `AnimeCard` | Base card component (poster + title + meta) | Yes | `@nexus/ui` |
| `WatchlistToggle` | Heart icon toggle for watchlist add/remove | Yes | `@nexus/ui` |
| `LoadMoreButton` | Client-side pagination trigger | Yes | `@nexus/ui` |
| `PopularSkeleton` | Placeholder skeleton matching card grid | Yes | `@nexus/ui` |
| `EmptyState` | Illustration + message for zero-results state | Yes | `@nexus/ui` |
| `CarouselToggle` | Icon button to switch between grid and carousel on mobile | Yes | `@nexus/ui` |
| `PopularCarousel` | Horizontal snap-scroll carousel variant for mobile | No | `apps/web` |

## 8. API Dependencies

| Endpoint | Method | Auth Required | Rate Limit | Cache |
|----------|--------|---------------|------------|-------|
| `/api/anime/popular` | GET | No | 100/min per IP | ISR 900s |
| `/api/anime/{id}/watchlist` | POST / DELETE | Yes | 30/min per user | None |

Query parameters for `/api/anime/popular`:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sort` | `rating` \| `popularity` \| `year` | `rating` | Sort dimension |
| `genre` | string (slug) | — | Genre filter (omitted = all genres) |
| `limit` | integer (1-50) | `20` | Page size |
| `cursor` | string | — | Cursor for pagination |

## 9. Database Dependencies

| Table / View | Operation | Index / Query Notes |
|--------------|-----------|---------------------|
| `anime` | SELECT | Composite index on `(rating_count, rating DESC)` for rating sort; `(rating_count, popularity_score DESC)` for popularity sort; `(rating_count, release_year DESC)` for year sort |
| `anime_genres` | SELECT | Indexed on `genre_id` for genre filter join |
| `genres` | SELECT | Indexed on `slug` for genre lookup |
| `watchlist` | INSERT / DELETE | Indexed on `user_id` for watchlist state check |

## 10. Edge Cases

1. **Minimum rating threshold (100 ratings):** Anime with 99 ratings are excluded even if their average rating is 9.5. This prevents statistically insignificant ratings from appearing. The threshold is documented in the API response meta (`{ meta: { min_ratings_threshold: 100 } }`).
2. **Genre with no popular entries:** User filters by a niche genre where no anime have 100+ ratings. System shows the empty state: "No popular anime in this genre yet. Browse all genres." with a "Reset filters" button. Suggestions: link to `/genres/{genre}` for all anime in that genre (not just popular).
3. **Ties in rating:** Two anime have the same rating (e.g., 8.7). Tie-breaker chain: (1) higher `rating_count` (more statistically significant), (2) higher `view_count`, (3) alphabetical by romaji title. Deterministic ordering is guaranteed.
4. **Sort by "Year" with same-year anime:** Many anime released in the same year. Secondary sort by rating (descending) ensures meaningful order within the year.
5. **Anime with no rating:** Anime with `rating_count = 0` are excluded from the popular list entirely. They appear in `/latest` instead. The API does not return them.
6. **Soft-deleted anime:** The query filters `deleted_at IS NULL`. If a popular anime is soft-deleted, it disappears from the next revalidated list. No broken links. The rank numbers of remaining anime shift accordingly.
7. **ISR cache invalidation:** ISR revalidates every 15 minutes. New anime meeting the 100-rating threshold appear within 15 minutes. A background job could trigger targeted purge (future improvement).
8. **Very large page number (e.g., page 50):** Cursor-based pagination prevents deep-page performance issues. If a user manually enters a non-existent cursor, the API returns an empty result and the system shows the empty state.
9. **Genre filter + sort combination:** All sort options are available with genre filtering. The API applies genre filter first (via `anime_genres` join), then sorts the filtered results. No sort is disabled by genre.
10. **Watchlist toggle on anonymous session:** Anonymous user clicks the watchlist heart icon. System shows a tooltip: "Sign up to save your watchlist" with a "Sign up" link. No API call is made. The toggle state reverts.
11. **Carousel mode on mobile:** User toggles to carousel view. Cards are 140px wide, snap-x mandatory, 8px gap. Rank badge scales to 18px. Toggle state persists across page reloads via `localStorage`.
12. **Genre with exactly 1 qualifying anime:** Grid shows a single card centered (or left-aligned on mobile). "Load more" button is hidden. Empty state is NOT shown (there is a valid result).

## 11. Error Handling

| Error Condition | User-Facing Message | Recovery Action | Log Level |
|-----------------|---------------------|-----------------|-----------|
| Popular API failure (origin) | ISR serves stale cached data | Page renders with stale data | warn |
| Popular API failure (client refresh) | "Couldn't load popular anime. Retry." | Inline retry button | warn |
| Genre filter produces 0 results | "No popular anime in this genre yet." | "Reset filters" button | info |
| Watchlist toggle failure | "Couldn't update watchlist. Try again." | Revert toggle state, show toast | warn |
| Invalid sort parameter | Default sort (rating) used | Silent fallback | info |
| Invalid genre slug | All-genre filter applied | Silent fallback | info |

## 12. Analytics Events

| Event Name | Trigger | Properties | Surface |
|------------|---------|------------|---------|
| `popular_page_view` | Page loads | `{ sort, genre }` | Server |
| `popular_sort_change` | User changes sort | `{ sort: 'rating' | 'popularity' | 'year' }` | Client |
| `popular_genre_filter` | User changes genre filter | `{ genre }` | Client |
| `popular_card_click` | User clicks an anime card | `{ anime_id, rank, sort }` | Client |
| `popular_watchlist_toggle` | User toggles watchlist | `{ anime_id, action: 'add' | 'remove' }` | Client |
| `popular_load_more` | User clicks "Load more" | `{ page, sort, genre }` | Client |
| `popular_carousel_toggle` | User toggles carousel mode on mobile | `{ mode: 'grid' | 'carousel' }` | Client |

## 13. Security Considerations

- **No injection vectors:** All query parameters are validated with Zod. The `sort` parameter is restricted to a whitelist (`rating`, `popularity`, `year`). The `genre` parameter is validated against the `genres` table.
- **Rate limiting:** `/api/anime/popular` is rate-limited to 100 requests/minute per IP. Watchlist mutations are rate-limited per user ID.
- **No sensitive data in response:** The popular response includes only public anime metadata (title, poster, rating, genre names). No user-specific data.
- **Watchlist mutation requires auth:** POST/DELETE `/api/anime/{id}/watchlist` requires a valid session. CSRF protection via Auth.js double-submit.
- **Cursor-based pagination prevents enumeration:** Cursors are opaque (base64-encoded timestamp + ID). No offset-based enumeration of the full catalog.
- **Minimum rating threshold prevents gaming:** Anime must have 100+ ratings to appear, preventing users from creating fake accounts to rate their own submitted anime.

## 14. Performance Requirements

- **Initial page render (ISR):** p95 < 300ms (served from cache).
- **Filter/sort change (client fetch):** p95 < 200ms (indexed query on `anime` table).
- **LCP:** < 2.0s on 4G.
- **FID:** < 100ms.
- **CLS:** < 0.1 (skeleton placeholders match card dimensions; rank badges show immediately on skeleton).
- **Rendering strategy:** ISR with 900s (15 min) revalidate. All-time data changes slowly; 15-minute freshness is sufficient.
- **DB query:** Popular list query < 50ms (composite index scan on `anime` table).
- **Bundle-size budget:** Popular page client JS < 50kB gzipped (toolbar, card interactions, animations).
- **Cache hit ratio:** > 95% (ISR absorbs most traffic; origin only serves revalidation requests).

## 15. Future Improvements

1. **Animated rank change indicators** — Show climb/drop arrows updated weekly to signal movement in the all-time list.
2. **Year-decade filter** — Filter by decade (80s, 90s, 2000s, 2010s, 2020s) to explore era-specific popular anime.
3. **Personalized popular** — "Top anime among users like you" using collaborative filtering.
4. **Compare mode** — Select 2–3 cards and view side-by-side stats (rating, views, episodes, genres).
5. **Export list** — Shareable image card of top 10 (social media friendly).
6. **Minimum rating threshold config** — Allow admins to adjust the threshold via CMS (e.g., raise to 500 for a "Top 100" list).
7. **Popular by studio** — Filter popular anime by studio (e.g., "Popular by Kyoto Animation").
8. **Historical popular snapshots** — View what was popular last year, 5 years ago (requires periodic snapshot table).
