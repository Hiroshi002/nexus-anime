# M5 — Search

> **Goal:** Deliver a full-featured search experience with debounced query, filterable results grid, cursor-based infinite scroll, and shareable URL-driven filter state.
> **Spec version:** 1.0.0 · **Last reviewed:** 2026-06-26 · **Owner:** Frontend Lead

---

## 1. Objective

Implement the search page (`/search`) as the primary discovery mechanism for users seeking specific anime or exploring the catalog by attributes. The page supports search-as-you-type with 300ms debouncing, a suggestions dropdown (recent searches, trending queries, fuzzy matches), a structured filter panel (genre, year, status, rating), sort controls, and a results grid with cursor-based infinite scroll. All filter state is reflected in the URL query string so searches are shareable and bookmarkable.

This milestone covers the **UI layer and data wiring only**. The underlying search backend (`/api/v1/search`, `/api/v1/search/suggest`, `/api/v1/search/history`) is delivered in M2. The search history feature requires an authenticated session (M3). The advanced search POST endpoint (`POST /api/v1/search`) is consumed by the filter panel.

---

## 2. Scope

### In scope

- `apps/web/src/app/search/page.tsx` — search route with URL-driven filter state
- `apps/web/src/app/search/layout.tsx` — search layout with `SearchHeader`
- `apps/web/src/components/search/` — `SearchPage`, `SearchHeader`, `SearchBar` (lg variant, auto-focus), `RecentSearches`, `TrendingList`, `FuzzySuggest`, `FilterDrawer`, `SortBar`, `ResultCount`, `ResultsGrid`, `AnimeCardSkeleton`, `EmptyState`
- `apps/web/src/hooks/` — `useSearch`, `useSearchSuggestions`, `useSearchHistory`, `useDebounce`
- `apps/web/src/lib/services/` — search service wrappers calling `/api/v1/search`, `/api/v1/search/suggest`, `/api/v1/search/history`
- URL query parameter parsing/serialization for filter state (genre, year, status, sort, order, cursor)
- Cursor-based infinite scroll via IntersectionObserver sentinel
- Search history persistence (authenticated) via Server Actions calling `POST/DELETE /api/v1/search/history`
- Recent searches (anonymous) via `localStorage` (max 5 entries)
- Empty state with 3 alternate query suggestions
- SEO metadata: base `/search` indexable; `/search?q=` noindex for non-alpha/random-symbol queries; `rel="prev"/"next"` on cursor links
- Responsive: desktop filter rail, tablet off-canvas drawer, mobile bottom sheet + full-screen overlay

### Out of scope

- Homepage (M4)
- Anime detail page (M6)
- Voice input (Web Speech API)
- Visual similarity search
- AI-powered natural language queries
- Saved search alerts
- Cross-provider search merge (TMDB + AniList + MyAnimeList unified result)
- Meilisearch migration (Phase 2 of search backend — API contract unchanged)

---

## 3. Deliverables

| # | Deliverable | Location | Acceptance |
| :-- | :-- | :-- | :-- |
| D1 | Search route page with URL-driven state | `apps/web/src/app/search/page.tsx` | Reads `searchParams` for filter state; updates URL on filter change via `router.replace`; renders `SearchPage` |
| D2 | `SearchPage` orchestrator | `apps/web/src/components/search/SearchPage.tsx` | Composes `SearchHeader`, `FilterDrawer`, `SortBar`, `ResultCount`, `ResultsGrid`, `EmptyState`; manages shared filter state |
| D3 | `SearchHeader` + `SearchBar` (lg, auto-focus) | `apps/web/src/components/search/SearchHeader.tsx` | Auto-focuses on page load; full-width max 720px; glassmorphism surface |
| D4 | `RecentSearches` (localStorage) | `apps/web/src/components/search/RecentSearches.tsx` | Reads/writes localStorage; max 5 entries; clears on demand; visible only when input is empty |
| D5 | `TrendingList` (Redis-cached) | `apps/web/src/components/search/TrendingList.tsx` | Fetches from `/api/v1/search/suggest?type=trending`; renders clickable trending queries |
| D6 | `FuzzySuggest` (debounced) | `apps/web/src/components/search/FuzzySuggest.tsx` | 300ms debounce; fetches from `/api/v1/search/suggest`; renders matching suggestions; keyboard navigable |
| D7 | `FilterDrawer` (genre, year, status, rating) | `apps/web/src/components/search/FilterDrawer.tsx` | Desktop: 240px sticky rail; Tablet: off-canvas drawer; Mobile: bottom sheet; chip-style genre toggles; range sliders for year/rating |
| D8 | `SortBar` (relevance, rating, popularity, date) | `apps/web/src/components/search/SortBar.tsx` | 4 chip variants; active = `primary`, inactive = `outline`; updates URL param on change |
| D9 | `ResultCount` with aria-live | `apps/web/src/components/search/ResultCount.tsx` | Announces "N results for '{query}'" via `aria-live="polite"` |
| D10 | `ResultsGrid` with cursor-based infinite scroll | `apps/web/src/components/search/ResultsGrid.tsx` | Renders `AnimeCard` × N; IntersectionObserver sentinel at 400px from bottom; loads next 20 via cursor |
| D11 | `AnimeCardSkeleton` × 20 | `apps/web/src/components/search/skeletons/AnimeCardSkeleton.tsx` | Shimmer pulse; identical dimensions to loaded card; no layout shift |
| D12 | `EmptyState` with alternate suggestions | `apps/web/src/components/search/EmptyState.tsx` | Heading "No results for '{query}.'"; 3 suggested query chips; filter-clear note when filters active |
| D13 | `useDebounce` hook | `apps/web/src/hooks/useDebounce.ts` | Generic debounce hook; 300ms default; configurable delay |
| D14 | `useSearch` hook | `apps/web/src/hooks/useSearch.ts` | Fetches search results from `/api/v1/search`; manages cursor pagination state; typed response |
| D15 | `useSearchSuggestions` hook | `apps/web/src/hooks/useSearchSuggestions.ts` | Fetches suggestions from `/api/v1/search/suggest`; debounced; typed response |
| D16 | `useSearchHistory` hook (authenticated) | `apps/web/src/hooks/useSearchHistory.ts` | Fetches history from `/api/v1/search/history`; adds/removes history entries via Server Actions |
| D17 | Search history Server Actions | `apps/web/src/actions/searchHistory.ts` | `addSearchHistory`, `removeSearchHistory`, `clearSearchHistory`; Zod validation; requireUser |
| D18 | URL filter state parser/serializer | `apps/web/src/lib/search-params.ts` | Parses `searchParams` into `SearchFilters` type; serializes `SearchFilters` back to URL params; validates with Zod |
| D19 | SEO metadata + canonical | `apps/web/src/app/search/page.tsx` | Base page: "Search Anime — Nexus Anime"; query pages: `"{query}" Search Results — Nexus Anime`; noindex for non-alpha queries; `rel="prev"/"next"` on cursor links |
| D20 | Responsive layout (desktop / tablet / mobile) | `apps/web/src/components/search/` | Desktop: 6-col grid + sticky filter rail; Tablet: 3-4 col + off-canvas filter; Mobile: single-col cards + bottom sheet filter + full-screen overlay |

---

## 4. Prerequisites

Before M5 begins, the following must be complete:

- **M0 — Repository Scaffold:** Turborepo, pnpm workspaces, folder structure, CI pipeline
- **M1 — Project Foundation:** `@nexus/ui` component library with `SearchBar`, `Button`, `Badge`, `Card`, `Skeleton`, `ErrorBoundary`, `Drawer`/`BottomSheet` primitives; theme tokens; Tailwind 4
- **M2 — Catalog Foundation:** Search backend live — `GET /api/v1/search`, `POST /api/v1/search`, `GET /api/v1/search/suggest`, `GET /api/v1/search/history`, `DELETE /api/v1/search/history/{id}`, `DELETE /api/v1/search/history`; Postgres `tsvector` + GIN index; Redis caching layer
- **M3 — Auth Complete:** Auth.js v5 session management; `requireUser` helper; search history endpoints require bearer token

---

## 5. Dependencies

### Upstream (must exist before M5 starts)

| Dependency | Type | Source | Contract |
| :-- | :-- | :-- | :-- |
| `GET /api/v1/search?q=&type=&sort=&order=&cursor=&limit=` | REST endpoint | M2 | Returns `SearchResult[]` with cursor pagination; supports all filter params |
| `POST /api/v1/search` | REST endpoint | M2 | Advanced search with structured body (`SearchRequest`); AND across facets, OR within facet |
| `GET /api/v1/search/suggest?q=&type=` | REST endpoint | M2 | Returns max 10 `Suggestion[]`; `all` not permitted |
| `GET /api/v1/search/history?limit=` | REST endpoint | M2 | Returns `SearchHistoryEntry[]` for authenticated user; bearer required |
| `DELETE /api/v1/search/history/{id}` | REST endpoint | M2 | Deletes single history entry; bearer required |
| `DELETE /api/v1/search/history` | REST endpoint | M2 | Bulk delete; bearer required |
| `AnimeCard` component | Package | M1 | Reused for results grid |
| Auth.js session helpers | Library | M3 | `requireUser` for history mutations |
| `@nexus/cache` | Package | M2 | Redis caching for trending queries (TTL 60s) |

### Downstream (will consume M5)

| Consumer | What they need | Milestone |
| :-- | :-- | :-- |
| M6 — Anime Detail | `AnimeCard` component (shared), `EmptyState` pattern | M6 |
| M7 — Public Launch | Search must be production-ready | M7 |

### External services

| Service | Purpose | Failure mode |
| :-- | :-- | :-- |
| Upstash Redis | Cache search results (TTL 60s), trending queries (TTL 60s), history (no cache) | Fallback to direct DB query; serve stale if available |
| Postgres (Neon) | `tsvector` search with GIN index | Query timeout → 503 `SEARCH_BACKEND_UNAVAILABLE` |
| Vercel Edge | Rate limiting (20/60s per IP/user) | Fail open for reads; 429 with `Retry-After` header |

---

## 6. Risks

### R1: URL-driven filter state synchronization

**Description:** Filter state must be reflected in the URL for shareability. If the URL and internal state drift (e.g., due to race conditions between filter changes and navigation), users may share links that do not reproduce the original search.

**Likelihood:** Medium · **Impact:** Medium (broken share links)

**Mitigation:**
- Use a single source of truth: `searchParams` from `useSearchParams()`. All filter reads derive from URL; all filter writes call `router.replace()` with the full serialized state.
- Serialize filters via a Zod schema (`SearchFiltersSchema`) so invalid URL params fall back to defaults.
- Integration test: copy URL from a filtered search, open in incognito, verify identical results and active filter chips.

### R2: Infinite scroll cursor staleness

**Description:** Cursor-based pagination relies on a stable result set. If the underlying data changes between cursor fetches (e.g., new anime indexed), the cursor may skip or duplicate entries.

**Likelihood:** Low · **Impact:** Low (occasional duplicate or missed result)

**Mitigation:**
- Cursors are based on sort-key values (e.g., `popularity_score:id`), not offsets. This is stable under inserts.
- The search backend must guarantee cursor stability for the sort field used.
- Deduplicate results client-side by `id` as a safety net.
- Acceptable: minor duplicates on very active catalog updates; not acceptable: infinite loop or crash.

### R3: Debounce race condition on suggestions

**Description:** If the user types quickly, multiple suggestion requests may be in flight. A slow early request may resolve after a fast later request, causing stale suggestions to appear.

**Likelihood:** Medium · **Impact:** Low (flickering suggestions)

**Mitigation:**
- Use `useRef` + `AbortController` in `useSearchSuggestions` to cancel in-flight requests when a new debounced value arrives.
- The hook returns `data` only for the latest request ID; stale responses are discarded.
- Test: type "nar", wait 100ms, type "naruto"; verify only "naruto" suggestions appear.

### R4: Search history write failure

**Description:** Authenticated users expect their search history to persist. If the `POST /api/v1/search/history` call fails silently, users lose history without feedback.

**Likelihood:** Low · **Impact:** Low (minor UX degradation)

**Mitigation:**
- Server Action returns `{ error: { message, code } }` on failure; the hook surfaces this to a toast notification.
- History writes are best-effort: a failure does not block the search itself.
- Log history write failures for monitoring; alert if error rate exceeds 5%.

### R5: Mobile bottom sheet focus trap

**Description:** On mobile, the filter opens as a bottom sheet. If focus is not trapped within the sheet, keyboard users may tab to elements behind the overlay, causing confusion.

**Likelihood:** Medium · **Impact:** Medium (accessibility failure on mobile)

**Mitigation:**
- Use `@nexus/ui` `BottomSheet` primitive with built-in focus trap (or implement via `focus-trap-react`).
- Verify: Tab cycles within the sheet; Escape closes the sheet and returns focus to the filter trigger.
- Test with VoiceOver (iOS) and TalkBack (Android).

### R6: SEO noindex false positives

**Description:** The noindex rule for non-alpha queries must not accidentally noindex legitimate searches (e.g., Japanese titles typed in romaji that start with numbers like "91 Days").

**Likelihood:** Low · **Impact:** Medium (legitimate pages not indexed)

**Mitigation:**
- Noindex rule: queries starting with non-alphanumeric characters (e.g., `!`, `@`, `#`). Queries starting with digits are still indexed.
- Canonical URL includes sanitized `q` param; empty `q` canonical is just `/search`.
- Integration test: verify `91 Days` is indexed; verify `@#$%` is noindex.

---

## 7. Acceptance Criteria

Each criterion is binary pass/fail. All must pass for the milestone to be considered complete.

1. **Search page loads with empty state:** Navigating to `/search` without query params renders the search input (auto-focused) with trending queries and (if authenticated) recent searches visible in the dropdown.
2. **Search-as-you-type with debounce:** Typing in the input triggers suggestions after 300ms of inactivity; rapid typing does not fire intermediate requests; suggestions dropdown shows recent + trending + fuzzy matches.
3. **Enter key submits full search:** Pressing Enter navigates to `/search?q={query}` and renders the results grid with matching anime.
4. **Filter panel reflects URL state:** Navigating to `/search?q=naruto&genres=action&year=2023&sort=rating` sets the filter panel chips/sliders to match; changing a filter updates the URL via `router.replace()`.
5. **Shareable search URLs:** Copying the URL from a filtered search and opening it in an incognito window reproduces the same results and active filter state.
6. **Cursor-based infinite scroll:** Scrolling to 400px from the bottom of the results grid loads the next 20 results; the sentinel triggers exactly once per page; no duplicate entries.
7. **Sort changes re-sort results:** Clicking a sort chip (e.g., "rating" → "popularity") re-fetches results with the new sort order; URL updates; cursor resets.
8. **Empty state with suggestions:** A query with zero results renders the empty state with 3 alternate query suggestions; clicking a suggestion triggers a new search.
9. **Filter-clear note in empty state:** When filters are active and results are empty, the empty state shows "Clearing filters may show more results." with a ghost-button CTA.
10. **Search history (authenticated):** Authenticated users see their recent searches (from API) in the dropdown; clicking a history item triggers that search; deleting a history item removes it from the list and the backend.
11. **Recent searches (anonymous):** Anonymous users see up to 5 recent searches from localStorage; clicking a recent item triggers that search; clearing removes them from localStorage.
12. **Loading skeletons:** While results are loading, 20 `AnimeCardSkeleton` components render in the grid; dimensions match loaded cards; no layout shift.
13. **Error handling with retry:** If the search API returns 5xx, the grid shows an error card with a retry button; exponential backoff (1s, 2s, 4s) with max 3 attempts; user input is preserved.
14. **Suggestions failure fallback:** If the suggestions API fails, the dropdown shows recent searches only; a toast banner announces "Suggestions unavailable. Showing recent searches."
15. **SEO metadata:** Base `/search` has title "Search Anime — Nexus Anime" and is indexable. `/search?q=naruto` has title `"naruto" Search Results — Nexus Anime`. `/search?q=@#$` is noindex. Canonical URLs include sanitized `q` param.
16. **Accessibility:** Input has `role="combobox"`, `aria-expanded`, `aria-activedescendant`. Results count uses `aria-live="polite"`. Suggestion list uses `role="listbox"` with `role="option"`. Bottom sheet traps focus on mobile. All interactions work via keyboard alone.
17. **Responsive layout:** Desktop (≥1024px): 6-col grid + 240px sticky filter rail. Tablet (768–1023px): 3-4 col grid + off-canvas filter. Mobile (<768px): single-col cards + bottom sheet filter + full-screen overlay.
18. **TypeScript strict compliance:** `pnpm typecheck` passes; no `any` types in `apps/web/src/components/search/` or `apps/web/src/hooks/`.
19. **Build passes:** `pnpm build` succeeds; no new lint or type errors.
20. **Rate limit handling:** When the API returns 429, the UI surfaces a friendly "Too many requests. Please wait X seconds." message with the `Retry-After` value.

---

## 8. QA Checklist

### Functional

- [ ] Search page renders at `/search` with auto-focused input
- [ ] Suggestions dropdown appears after 300ms debounce
- [ ] Enter key navigates to `/search?q={query}`
- [ ] Filter panel applies filters and updates URL
- [ ] URL filter state survives page reload and incognito open
- [ ] Infinite scroll loads next page when sentinel is 400px from bottom
- [ ] Sort chips re-sort results and update URL
- [ ] Empty state renders with 3 suggestions when no results
- [ ] Filter-clear note appears when filters active + no results
- [ ] Authenticated: search history shows, adds, deletes correctly
- [ ] Anonymous: recent searches persist in localStorage, max 5
- [ ] Loading skeletons render with correct dimensions
- [ ] Error state with retry button recovers from transient failures
- [ ] Suggestions API failure falls back to recent searches with toast

### Performance

- [ ] Debounce prevents more than 1 request per 300ms of typing
- [ ] Suggestions response < 300ms p95 (cached by Redis)
- [ ] Search results response < 500ms p95 (cached by Redis for repeated queries)
- [ ] No layout shift between skeleton and loaded cards (CLS = 0)
- [ ] IntersectionObserver sentinel does not fire more than once per scroll position
- [ ] URL serialization/deserialization adds < 10ms overhead

### SEO

- [ ] Base `/search` page indexable with correct title
- [ ] Query pages have correct dynamic title
- [ ] Non-alpha queries are noindex
- [ ] Canonical URLs present and correct
- [ ] `rel="prev"/"next"` on paginated links

### Accessibility

- [ ] `role="combobox"` with `aria-expanded` and `aria-activedescendant`
- [ ] `aria-live="polite"` on result count
- [ ] `role="listbox"` and `role="option"` on suggestions
- [ ] Focus trap in mobile bottom sheet
- [ ] Escape closes dropdown and bottom sheet
- [ ] Arrow keys navigate suggestions
- [ ] `prefers-reduced-motion` disables animations
- [ ] Color contrast meets WCAG 2.2 AA

### Cross-browser

- [ ] Chrome 125+ (latest)
- [ ] Firefox 126+ (latest)
- [ ] Safari 17+ (latest)
- [ ] Edge 125+ (latest)
- [ ] Mobile Safari (iOS 17)
- [ ] Chrome for Android (latest)

---

## 9. Estimated Tasks

| # | Task | Estimate | Dependencies | Notes |
| :-- | :-- | :-- | :-- | :-- |
| T1 | Scaffold `apps/web/src/components/search/` directory structure and barrel exports | 0.5d | M1 | |
| T2 | Implement `useDebounce` hook | 0.25d | — | Generic utility |
| T3 | Implement `useSearch` hook with cursor pagination | 1d | M2 search endpoint | Manages cursor state, accumulates results |
| T4 | Implement `useSearchSuggestions` hook with AbortController | 0.5d | M2 suggest endpoint | Cancels stale requests |
| T5 | Implement `useSearchHistory` hook + Server Actions | 1d | M2 history endpoints, M3 auth | Zod validation, requireUser |
| T6 | Implement `SearchBar` (lg variant, auto-focus) | 0.5d | M1 `SearchBar` primitive | Extend if needed |
| T7 | Implement `RecentSearches` (localStorage) | 0.5d | — | Max 5, clear-on-demand |
| T8 | Implement `TrendingList` | 0.5d | T4 | Fetches trending queries |
| T9 | Implement `FuzzySuggest` with keyboard navigation | 1d | T4 | Arrow keys, Enter, Escape |
| T10 | Implement `FilterDrawer` (responsive: rail / off-canvas / bottom sheet) | 2d | M1 `Drawer`/`BottomSheet` | Genre chips, year range, status, rating |
| T11 | Implement `SortBar` | 0.5d | M1 `Button` chip variant | 4 sort options |
| T12 | Implement `ResultCount` with aria-live | 0.25d | — | |
| T13 | Implement `ResultsGrid` with IntersectionObserver infinite scroll | 1.5d | T3, `AnimeCard` | Sentinel at 400px, load next 20 |
| T14 | Implement `AnimeCardSkeleton` × 20 | 0.5d | M1 `Skeleton` | Shimmer, dimension-matched |
| T15 | Implement `EmptyState` with suggestions | 0.5d | — | 3 query chips, filter-clear note |
| T16 | Implement `SearchPage` orchestrator | 1d | T6-T15 | Shared filter state management |
| T17 | Implement `page.tsx` with URL-driven state | 1d | T16, T18 | `searchParams` → filters → URL sync |
| T18 | Implement `search-params.ts` (Zod schema + serializer) | 0.5d | — | `SearchFiltersSchema` |
| T19 | Implement `SearchHeader` layout | 0.25d | T6 | |
| T20 | Implement SEO metadata + canonical | 0.5d | T17 | Title, robots, rel prev/next |
| T21 | Responsive testing + fixes across 4 breakpoints | 1d | T17 | |
| T22 | Accessibility audit + fixes | 1d | T17 | Focus trap, ARIA, keyboard |
| T23 | Performance audit + fixes | 0.5d | T17 | Debounce, CLS, infinite scroll |
| T24 | Integration tests (URL sync, cursor pagination, history) | 1.5d | T17 | |
| T25 | E2E tests (search flow, filter flow, infinite scroll) | 1d | T17 | Playwright |
| **Total** | | **~18.25d** | | ~3.5-4 weeks with 1 engineer |

---

## 10. Completion Checklist

- [ ] All 20 acceptance criteria pass
- [ ] All QA checklist items verified
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm build` succeeds
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (unit + integration)
- [ ] E2E tests pass in CI
- [ ] Performance budget met (debounce, CLS, response times)
- [ ] Accessibility audit passed (axe-core or Lighthouse)
- [ ] Responsive verified at 380/768/1024/1440
- [ ] Cross-browser verified (Chrome, Firefox, Safari, Edge)
- [ ] URL filter state survives reload and incognito
- [ ] SEO metadata verified (title, robots, canonical, prev/next)
- [ ] Documentation: component README or Storybook stories for search components
- [ ] PR reviewed and approved by at least one engineer
- [ ] Branch merged to `main` and CI green post-merge
- [ ] No secrets, API keys, or tokens in code
- [ ] No `any` types or `ts-ignore` comments introduced
- [ ] Monitoring: search API calls instrumented with error logging
