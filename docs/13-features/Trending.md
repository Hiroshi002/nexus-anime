# Trending — Nexus Anime

> **Audience:** Engineers implementing the trending page. Defines the trending rankings view, ranking algorithm, and time-window filtering.
> **Milestone:** M3
> **Owner:** Engineering
> **Status:** Draft

---

## 1. Purpose

Show anime ranked by recent popularity over configurable time windows (today, this week, all-time). Trending helps users discover what the community is watching *right now* and surfaces climbing titles that may not appear in all-time popular rankings. This is distinct from "popular" which is all-time — trending is time-bound and more dynamic.

## 2. Business Goals

- **Engagement:** Trending is the second-most-visited page after home. Target: 25% of sessions visit `/trending`.
- **Discovery:** Surface new and climbing anime that are not in the all-time top 100. Target: 30% of trending titles are outside the all-time top 100.
- **Freshness:** ISR with 5-minute revalidate ensures the list reflects near-real-time community activity. Target: new trending data visible within 5 minutes of a spike.
- **Trust:** Transparent ranking formula builds user confidence in the list. Target: ranking explanation page (future) reduces "why is this here?" support tickets.

## 3. Functional Requirements

### 3.1 Happy Path

1. Visitor navigates to `/trending`. System renders the trending page with the default time window (7 days) and default type filter (All).
2. The ranked list shows anime ordered by trending score, with rank numbers, up/down/flat indicators, and metadata (title, genres, episode count, rating).
3. User changes the time window to "Today". System re-fetches data with `?window=today` and re-renders the list.
4. User changes the type filter to "TV". System re-fetches with `?type=tv` and re-renders.
5. User changes the sort to "Change". System re-sorts the already-fetched list client-side by rank change (no API call).
6. User clicks an anime card. System navigates to `/anime/{id}`.
7. User clicks "Watch" on a trending row. System navigates to `/anime/{id}/episode/1` (or the next unwatched episode for authenticated users).
8. User clicks the watchlist toggle on a row. System adds/remove the anime from the user's watchlist (authenticated only; anonymous users see a "Sign up to save" tooltip).

### 3.2 Alternate Flows

1. **Filter produces zero results:** System shows an empty state: "No anime match these filters. Try a wider time window or different type." with a "Reset filters" button.
2. **Sort by "Change" with no prior baseline:** If the user sorts by change on the first load, the API returns `change: 0` for all items. Indicators show flat (—) for all rows.
3. **Time window "Today" with insufficient data:** If fewer than 10 anime have engagement data for the current day, the system shows a hint: "Not enough data for today? Check the 7-day window."
4. **Authenticated user clicks "Watch" on an anime they have already started:** System navigates to the next unwatched episode (based on `watch_history`), not episode 1.
5. **Anonymous user clicks watchlist toggle:** System shows a tooltip: "Sign up to save your watchlist" with a "Sign up" link.

### 3.3 Edge Cases

1. **Ties in ranking:** Two anime have the same trending score. Tie-breaker: higher view count wins. If still tied, alphabetical by romaji title. Deterministic ordering is guaranteed.
2. **New entries with sparse data:** An anime added 2 days ago with 500 views ranks above an anime with 10,000 views over 7 days. The ranking formula normalizes by time window — rate matters more than absolute volume. This is expected behavior.
3. **Time-zone boundaries:** The "today" window uses UTC. A user in UTC+14 sees "today" starting before the calendar date in their locale. The system uses UTC consistently; the UI displays "UTC" next to the "Today" option.
4. **Concurrent requests causing ISR cache miss:** If two requests arrive during revalidation, one serves stale data while the other triggers revalidation. Both succeed. No 500 errors.
5. **Stale data warning:** If the cached data is older than 10 minutes (e.g., revalidation failed), show a banner: "Trending data may be slightly outdated." Logged as a warning.
6. **Genre filter with no trending anime:** If the user filters by a niche genre (e.g., "Mecha") and no mecha anime are trending in the selected window, show the empty state with a suggestion to try a wider window or different genre.
7. **Rapid filter changes:** User changes the time window twice within 1 second. System cancels the first request (AbortController) and only fetches for the second value. No race condition rendering stale data.
8. **Very large rank numbers (e.g., #500):** Rank badge font size scales down for 3+ digit numbers to prevent overflow. Row layout remains stable.

## 4. Non-Functional Requirements

- **Performance:** Initial page render p95 < 300ms (ISR). Filter change p95 < 200ms (client-side fetch with SWR). LCP < 2.0s.
- **Availability:** 99.9%. ISR serves stale data if the origin is unreachable.
- **Scalability:** 100k monthly visitors. Trending query is served from ISR cache; origin load is minimal.
- **Accessibility:** WCAG 2.2 AA. Toolbar controls are proper form elements with visible labels. Rows are `<a>` with descriptive `aria-label`. Rank indicator `aria-hidden` (info conveyed via row label).
- **Localization:** Anime titles displayed in user's locale. Time window labels externalized.
- **Security:** No user input beyond query parameters. Rate-limited API. No sensitive data in the response.

## 5. User Stories

- As a **visitor**, I want to see what anime are trending this week so that I can discover what the community is watching right now.
- As a **visitor**, I want to filter trending by type (TV, Movie, OVA) so that I can narrow the list to my preferred format.
- As a **visitor**, I want to switch between time windows (today, week, all-time) so that I can see different trending perspectives.
- As a **visitor**, I want to see rank change indicators so that I can spot anime that are climbing or falling.
- As a **logged-in user**, I want to add an anime to my watchlist directly from the trending page so that I do not have to navigate to the detail page.

## 6. Acceptance Criteria

- [ ] Default view shows 7-day trending with all types, sorted by rank.
- [ ] Time window selector switches between Today / This Week / All-Time and re-fetches data.
- [ ] Type filter switches between All / TV / Movie / OVA and re-fetches data.
- [ ] Sort by Rank / Change / Rating works; Change and Rating are client-side sorts (no refetch).
- [ ] Each row shows rank number, up/down/flat indicator, thumbnail, title, genres, episode count, rating.
- [ ] Tie-breaking is deterministic (views → alphabetical).
- [ ] Empty state shows when filters produce 0 results, with a "Reset filters" button.
- [ ] ISR revalidates every 300 seconds (5 minutes).
- [ ] Stale data warning appears if cached data is older than 10 minutes.
- [ ] Page passes `pnpm typecheck` with strict mode.
- [ ] All interactive elements are keyboard-accessible.
- [ ] `prefers-reduced-motion` disables stagger and bounce animations.

## 7. UI Components

| Component | Responsibility | Reusable? | Package |
|-----------|---------------|-----------|---------|
| `TrendingPage` | Page shell with header, toolbar, and list | No | `apps/web` |
| `TrendingToolbar` | Sticky toolbar containing filter and sort controls | No | `apps/web` |
| `SegmentedControl` | Single-select control for time window | Yes | `@nexus/ui` |
| `FilterChipGroup` | Multi-select chip group for type filter | Yes | `@nexus/ui` |
| `SortDropdown` | Dropdown for sort options | Yes | `@nexus/ui` |
| `TrendingList` | Vertical list of trending rows with stagger animation | No | `apps/web` |
| `TrendingRow` | Single row: rank + indicator + thumbnail + meta + actions | No | `apps/web` |
| `RankBadge` | Large rank number with up/down/flat chevron | Yes | `@nexus/ui` |
| `AnimeCardHorizontal` | Compact horizontal anime card (thumbnail + meta) | Yes | `@nexus/ui` |
| `TrendingActions` | Watch button + watchlist toggle for each row | Yes | `apps/web` |
| `LoadMoreButton` | Client-side pagination trigger | Yes | `@nexus/ui` |
| `TrendingSkeleton` | Placeholder skeleton matching row layout | Yes | `@nexus/ui` |
| `EmptyState` | Illustration + message for zero-results state | Yes | `@nexus/ui` |

## 8. API Dependencies

| Endpoint | Method | Auth Required | Rate Limit | Cache |
|----------|--------|---------------|------------|-------|
| `/api/anime/trending` | GET | No | 100/min per IP | ISR 300s |
| `/api/anime/{id}/watchlist` | POST / DELETE | Yes | 30/min per user | None |

Query parameters for `/api/anime/trending`:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `window` | `today` \| `week` \| `all` | `week` | Time window for trending calculation |
| `type` | `all` \| `tv` \| `movie` \| `ova` | `all` | Anime type filter |
| `sort` | `rank` \| `change` \| `rating` | `rank` | Sort order |
| `limit` | integer (1-50) | `20` | Page size |
| `cursor` | string | — | Cursor for pagination |

## 9. Database Dependencies

| Table / View | Operation | Index / Query Notes |
|--------------|-----------|---------------------|
| `anime` | SELECT | Indexed on `id`; `trending_score_7d`, `trending_score_30d` materialized columns |
| `watch_history` | SELECT (aggregate) | Indexed on `(anime_id, created_at)` for time-windowed view counts |
| `watchlist` | SELECT (aggregate) | Indexed on `(anime_id, created_at)` for time-windowed add counts |
| `trending_materialized_view` | SELECT | Materialized view refreshed every 5 minutes; indexed on `(window_type, score DESC)` |

## 10. Edge Cases

1. **Ties in ranking:** Two anime have the exact same trending score (to 4 decimal places). Tie-breaker chain: (1) higher total view count in the window, (2) higher watchlist-add count, (3) alphabetical by romaji title. Deterministic ordering is guaranteed for pagination consistency.
2. **New entries with sparse data:** An anime added 2 days ago with 500 views in the 7-day window has a higher per-day rate than a 6-day-old anime with 2,000 views. The formula normalizes by the window, so the new anime ranks higher. This is expected — the UI shows the rank change indicator (up arrow) to signal the climb.
3. **Time-zone boundaries:** The "today" window resets at UTC midnight. A user in UTC+14 sees "today" start before their local calendar date. The system uses UTC consistently; the UI displays a small "UTC" label next to the "Today" option in the tooltip.
4. **Concurrent requests during ISR revalidation:** Two requests arrive during the 5-minute revalidation window. One serves stale data (the previous cache), the other triggers revalidation. Both succeed. No 500 errors. The stale-while-revalidate pattern is handled by Next.js ISR.
5. **Stale data warning:** If revalidation fails (e.g., DB timeout), the cached data may be up to 10 minutes old. System shows a warning banner: "Trending data may be slightly outdated." Logged as a warning. The page still renders.
6. **Genre filter with no trending anime:** User filters by a niche genre (e.g., "Mecha") where no anime are trending in the selected window. System shows the empty state: "No trending mecha anime this week. Try a wider window or browse all genres." with a "Reset filters" button.
7. **Rapid filter changes:** User changes the time window from "week" to "today" then to "all" within 1 second. System cancels in-flight requests (AbortController) and only fetches for the final value ("all"). No race condition rendering stale data.
8. **Very large rank numbers (e.g., #500):** Rank badge font size scales down for 3+ digits to prevent overflow. Row layout remains stable. Rank numbers are always visible (no truncation).
9. **Anime soft-deleted from catalog:** The trending query filters `deleted_at IS NULL`. If a trending anime is soft-deleted, it disappears from the next revalidated list. No broken links.
10. **Watchlist toggle on anonymous session:** Anonymous user clicks the watchlist heart icon. System shows a tooltip: "Sign up to save your watchlist" with a "Sign up" link. No API call is made.

## 11. Error Handling

| Error Condition | User-Facing Message | Recovery Action | Log Level |
|-----------------|---------------------|-----------------|-----------|
| Trending API failure (origin) | ISR serves stale cached data | Stale data warning banner shown | warn |
| Trending API failure (client refresh) | "Couldn't load trending. Retry." | Inline retry button | warn |
| Filter produces 0 results | "No anime match these filters." | "Reset filters" button | info |
| Watchlist toggle failure | "Couldn't update watchlist. Try again." | Revert toggle state, show toast | warn |
| Stale cache (> 10 min) | "Trending data may be slightly outdated." | Page still renders | warn |
| Invalid query parameter | Default value used | Silent fallback | info |

## 12. Analytics Events

| Event Name | Trigger | Properties | Surface |
|------------|---------|------------|---------|
| `trending_page_view` | Page loads | `{ window, type, sort }` | Server |
| `trending_filter_change` | User changes filter | `{ filter: 'window' | 'type' | 'sort', value }` | Client |
| `trending_row_click` | User clicks an anime row | `{ anime_id, rank, window }` | Client |
| `trending_watch_click` | User clicks "Watch" on a row | `{ anime_id, rank }` | Client |
| `trending_watchlist_toggle` | User toggles watchlist | `{ anime_id, action: 'add' | 'remove' }` | Client |
| `trending_load_more` | User clicks "Load more" | `{ page, window }` | Client |
| `trending_rank_explanation_view` | User clicks "Why is this ranked?" (future) | `{ anime_id, rank }` | Client |

## 13. Security Considerations

- **No injection vectors:** All query parameters are validated with Zod. The `window` parameter is restricted to a whitelist (`today`, `week`, `all`). The `type` parameter is restricted to (`all`, `tv`, `movie`, `ova`).
- **Rate limiting:** `/api/anime/trending` is rate-limited to 100 requests/minute per IP. Watchlist mutations are rate-limited per user ID.
- **No sensitive data in response:** The trending response includes only public anime metadata (title, genres, rating, episode count). No user-specific data.
- **Watchlist mutation requires auth:** POST/DELETE `/api/anime/{id}/watchlist` requires a valid session. CSRF protection via Auth.js double-submit.
- **Cursor-based pagination prevents enumeration:** Cursors are opaque (base64-encoded timestamp + ID). No offset-based enumeration of the full catalog.

## 14. Performance Requirements

- **Initial page render (ISR):** p95 < 300ms (served from cache).
- **Filter change (client fetch):** p95 < 200ms (indexed materialized view query).
- **LCP:** < 2.0s on 4G.
- **FID:** < 100ms.
- **CLS:** < 0.1 (skeleton placeholders match row dimensions).
- **Rendering strategy:** ISR with 300s revalidate. Materialized view refreshed every 5 minutes via a cron job or trigger.
- **DB query:** Trending list query < 50ms (indexed materialized view scan).
- **Bundle-size budget:** Trending page client JS < 50kB gzipped (toolbar, row interactions, animations).
- **Cache hit ratio:** > 95% (ISR absorbs most traffic; origin only serves revalidation requests).

## 15. Future Improvements

1. **Personalized trending** — "Trending among users like you" using collaborative filtering on watch history overlap.
2. **Per-day stats sparkline** — Mini chart in each row showing view count over the time window.
3. **Compare two anime** — Select two rows and view side-by-side stats (rating, views, watchlist adds).
4. **Ranking explanation tooltip** — Click on a rank to see the score breakdown (views 40%, watchlist 30%, completion 20%, rating 10%).
5. **Real-time trending** — WebSocket or SSE push for live rank changes (M5+ infrastructure).
6. **Trending by genre** — Dedicated trending view per genre (e.g., "Trending Action Anime").
7. **Historical trending** — View what was trending last month, last year.
8. **Trending notifications** — Notify users when an anime on their watchlist enters the top 10.
