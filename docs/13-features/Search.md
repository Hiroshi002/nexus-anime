# Search — Nexus Anime

> **Audience:** Engineers, Product, Design
> **Milestone:** M3
> **Owner:** Engineering
> **Status:** Draft

---

## 1. Purpose

Full-text search with 300ms debounced input, fuzzy autocomplete suggestions, recent/trending query display, multi-facet filter drawer, sort options, and infinite-scroll ranked results. Search is the primary intent-driven discovery mechanism — users who know what they want (or can describe it) use Search to find it fast.

## 2. Business Goals

- Reduce zero-result rate to < 5% through fuzzy matching and suggestion fallbacks.
- Increase search-to-watch conversion: target 30% of search sessions ending with a play action.
- Drive engagement via trending queries — surface popular anime to undecided users.
- Improve retention by persisting recent searches so returning users resume discovery instantly.

## 3. Functional Requirements

### 3.1 Happy Path
1. User clicks the search bar in the global header; input auto-focuses and the suggestions dropdown opens showing recent searches and trending queries.
2. User types a query; after 300ms debounce, the suggestions dropdown updates with fuzzy-matched anime titles.
3. User presses Enter or clicks a suggestion; the page navigates to `/search?q=<query>` and renders a ranked results grid.
4. User opens the filter drawer, selects genre, year range, status, and rating filters; results re-fetch with applied filters.
5. User selects a sort option (relevance, rating, popularity, release date); results re-sort.
6. User scrolls to load more results via infinite scroll (20 per batch).

### 3.2 Alternate Flows
1. User arrives via direct URL `/search?q=attack+on+titan&genre=action&sort=rating`; page renders with query, filters, and sort pre-applied.
2. User clicks a trending query chip on the Home page empty state; navigates to `/search?q=<trending>`.
3. User types a special character or non-Latin script (CJK, Cyrillic); the system normalizes and fuzzily matches database entries.
4. User clears the search input; suggestions dropdown reverts to recent searches and trending queries.

### 3.3 Edge Cases
1. Special characters in query (`<script>`, SQL-like strings); sanitized before rendering and query execution.
2. Empty results for a valid query; three alternate query suggestions offered.
3. Very common query (e.g. "anime") returning 10,000+ results; cursor pagination limits response size.
4. XSS risk in rendering user-typed query text in the UI; all query strings sanitized before rendering.

## 4. Non-Functional Requirements

- **Performance:** Suggestions API p95 < 100ms; results API p95 < 200ms; debounce 300ms on input.
- **Availability:** 99.9% — search is a critical navigation path; fallback to `ILIKE` if full-text index is degraded.
- **Scalability:** 200 req/s at peak for suggestions; 50 req/s for full search results.
- **Accessibility:** WCAG 2.2 AA; combobox pattern for search input with `aria-expanded`, `aria-activedescendant`; keyboard arrow navigation within suggestions.
- **Localization:** Query normalization is language-agnostic; CJK tokenization supported via `simple` or `custom` Postgres dictionary; UI strings externalized.
- **Security:** Zod validation on all input; rate limit suggestions at 30 req/min per user; CSP prevents inline script injection from user queries.

## 5. User Stories

- As a **visitor**, I want to find a specific anime by typing its title so that I can start watching quickly.
- As a **visitor**, I want to see fuzzy suggestions as I type so that I can correct typos without retyping.
- As a **visitor**, I want to see trending queries so that I can discover popular anime I might not know about.
- As a **returning user**, I want to see my recent searches so that I can re-run a previous query without retyping.
- As a **logged-in user**, I want to filter results by genre, year, and rating so that I can narrow results to my preferences.

## 6. Acceptance Criteria

- [ ] Search bar is present in the global header on every page; auto-focuses on click.
- [ ] Typing triggers 300ms debounce; suggestions dropdown renders fuzzy-matched titles after debounce.
- [ ] Suggestions dropdown shows: recent searches (from localStorage, max 5), trending queries (from Redis), and fuzzy matches.
- [ ] Pressing Enter or clicking a suggestion navigates to `/search?q=<query>` with ranked results.
- [ ] Filter drawer offers: Year (range), Genre (multi-select chips), Status (airing/finished/upcoming), Rating (range slider).
- [ ] Sort options: Relevance, Rating, Popularity, Release Date — default is Relevance.
- [ ] Infinite scroll loads 20 results per batch via cursor-based pagination.
- [ ] URL reflects `q`, `genre`, `year`, `status`, `sort`, and `cursor` params (shareable, bookmarkable).
- [ ] Empty result state shows three alternative query suggestions.
- [ ] Recent searches persist in localStorage across sessions; individual entries deletable.
- [ ] User-typed query text is sanitized (no raw HTML rendering) to prevent XSS.

## 7. UI Components

| Component | Responsibility | Reusable? | Package |
|-----------|---------------|-----------|---------|
| `SearchPage` | Page shell for `/search` route with Suspense boundary | No | `apps/web` |
| `SearchBar` | Global header search input with combobox, suggestions dropdown | Yes | `@nexus/ui` |
| `SuggestionsDropdown` | Recent, trending, fuzzy suggestion list | Yes | `@nexus/ui` |
| `FilterDrawer` | Year, genre, status, rating filter panel | Yes | `@nexus/ui` |
| `SortBar` | Sort chip row (relevance, rating, popularity, date) | Yes | `@nexus/ui` |
| `ResultCount` | "N results for '{query}'" with `aria-live` | Yes | `@nexus/ui` |
| `SearchAnimeCard` | Result card with rank number, poster, title, rating | Yes | `@nexus/ui` |
| `EmptySearchState` | Zero-results illustration with alternative suggestions | Yes | `@nexus/ui` |
| `InfiniteScrollSentinel` | IntersectionObserver-based pagination trigger | Yes | `@nexus/ui` |

## 8. API Dependencies

| Endpoint | Method | Auth Required | Rate Limit | Cache |
|----------|--------|---------------|------------|-------|
| `/api/v1/search?q=&filters=&sort=&cursor=` | GET | No | 60/min per IP | No (dynamic results) |
| `/api/v1/search/suggestions?q=` | GET | No | 30/min per IP | 60s Redis |

`/api/v1/search` accepts: `q` (string), `genre` (comma-separated slugs), `year` (range `2020-2026`), `status` (comma-separated), `rating` (range `0-10`), `sort` (relevance|rating|popularity|date), `cursor` (opaque), `limit` (default 20, max 50).

`/api/v1/search/suggestions` accepts: `q` (string, prefix). Returns up to 8 suggestion objects with `type` (anime|episode), `title`, `slug`, and `poster_url`.

## 9. Database Dependencies

| Table / View | Operation | Index / Query Notes |
|--------------|-----------|---------------------|
| `anime` | SELECT | GIN index on `search_vector` (tsvector) for full-text matching; `websearch_to_tsquery` for query parsing; `ts_rank_cd` for relevance ranking |
| `anime` | SELECT | Btree index on `average_rating DESC`, `popularity_score DESC`, `published_at DESC` for sort options |
| `anime_genres` | SELECT (join) | Genre filter; index on `genre_id`, `anime_id` |
| `genres` | SELECT (join) | Genre slug resolution; index on `slug` |
| `episodes` | SELECT (optional) | Episode-level search via GIN index on `search_vector` |
| `search_history` | SELECT / DELETE | Per-user recent searches (if server-side); localStorage is the M3 default |

## 10. Edge Cases

1. **Special characters in query:** Characters like `<`, `>`, `"`, `'`, `&` SHALL be sanitized via DOMPurify before rendering in the UI and stripped before `websearch_to_tsquery` parsing. No raw HTML rendering of user input.
2. **Empty query string:** Suggestions dropdown shows recent searches and trending queries; results page returns 400 or redirects to an empty state.
3. **Very common query ("anime", "action"):** Returns thousands of matches; relevance ranking is critical. Cursor pagination ensures bounded response sizes. System SHALL NOT return unbounded result arrays.
4. **CJK query with no dictionary:** `websearch_to_tsquery('simple', ...)` handles CJK by bigram tokenization; results may be less precise than language-specific dictionaries. Phase 2 (Meilisearch) improves this.
5. **Trending queries cache miss:** If Redis is unreachable, trending section is omitted from suggestions dropdown; recent searches still render. Fail open, do not block the dropdown.
6. **Rate limit exceeded on suggestions:** Return HTTP 429; client shows a toast "Search is busy. Please wait a moment." and disables auto-suggest for 60 seconds.
7. **Race condition on rapid typing:** Debounce at 300ms ensures only the latest query is dispatched; prior in-flight requests are cancelled via `AbortController`.
8. **Query matches only deleted/soft-deleted anime:** Results exclude `deleted_at IS NOT NULL` rows; user sees zero results.

## 11. Error Handling

| Error Condition | User-Facing Message | Recovery Action | Log Level |
|-----------------|---------------------|-----------------|-----------|
| Search API 500 | "Something went wrong searching." | Retry button (primary) | error |
| Suggestions API fails | Dropdown shows recent searches only | Toast: "Suggestions unavailable. Showing recent searches." | warn |
| Search API 503 (backend down) | "Search is temporarily unavailable." | Auto-retry with exponential backoff (1s, 2s, 4s) | warn |
| Rate limit (429) on suggestions | "Search is busy. Please wait a moment." | Disable auto-suggest for 60s | warn |
| Zero results | "No results for '{query}'." with 3 alternative suggestion chips | User clicks an alternative or clears filters | info |
| Network offline | "You appear to be offline." | Show cached recent searches if available | warn |

## 12. Analytics Events

| Event Name | Trigger | Properties | Surface |
|------------|---------|------------|---------|
| `search_query_submitted` | Enter pressed or suggestion clicked | `{ query, source: "input" | "suggestion" | "trending" | "recent", result_count }` | Client |
| `search_suggestion_shown` | Suggestions dropdown rendered | `{ query_prefix, suggestion_count, has_trending, has_recent }` | Client |
| `search_suggestion_clicked` | Suggestion item clicked | `{ query, suggestion_type: "anime" | "episode" | "trending" | "recent", position }` | Client |
| `search_filter_applied` | Filter drawer value changed | `{ filter_type: "genre" | "year" | "status" | "rating", filter_value }` | Client |
| `search_sort_changed` | Sort chip selected | `{ sort_value }` | Client |
| `search_result_clicked` | Result card clicked | `{ query, anime_id, position, sort }` | Client |
| `search_zero_results` | Results API returns empty array | `{ query, filters }` | Client |

## 13. Security Considerations

- **XSS prevention:** All user-typed query strings MUST be sanitized via DOMPurify before rendering in the UI. Never use `dangerouslySetInnerHTML` with raw query text.
- **SQL injection:** `websearch_to_tsquery` with parameterized Drizzle queries prevents injection. No raw SQL string interpolation.
- **Rate limiting:** Suggestions endpoint at 30 req/min per user; search results at 60 req/min per IP. Prevents automated scraping and abuse.
- **OWASP A03 (Injection):** Zod validation on `q`, `genre`, `year`, `status`, `sort`, `cursor` — reject malformed values with 400.
- **OWASP A07 (Identification and Authentication Failures):** Search is public (no auth required), but watchlist-related actions on result cards require a valid session.
- **CSP:** `connect-src` must allow API endpoints; `script-src` MUST NOT allow inline scripts from user query rendering.
- **Information disclosure:** Error responses SHALL NOT include DB query text, stack traces, or internal field names. Use typed `ApiError` envelope.

## 14. Performance Requirements

- **Suggestions API p95** < 100ms via GIN index on `search_vector` with prefix matching.
- **Results API p95** < 200ms; DB query p95 < 80ms for full-text search with joins.
- **LCP** < 2.5s on 4G for search results page; first 4 anime card images use `next/image` with `priority`.
- **FID** < 100ms; filter interactions are client-side state changes followed by server re-fetch.
- **Debounce** 300ms on input; no API call fires until debounce completes.
- **Cache:** No ISR for search results (dynamic, user-specific). Suggestions cached in Redis for 60s.
- **Rendering strategy:** SSR for search results page (dynamic content). `<Suspense>` boundary wraps the results grid; filter bar renders immediately. Streaming SSR for progressive result rendering.
- **Bundle-size budget:** < 35 KB client JS for the search route (includes filter drawer, sort bar, and infinite scroll logic).

## 15. Future Improvements

1. Meilisearch or Algolia integration for typo-tolerant, faceted search at scale (Phase 2, M5+).
2. Voice input via Web Speech API for mobile search entry.
3. Visual similarity search — upload a poster image to find anime with similar art style.
4. AI-powered natural language queries (e.g. "shows like Hunter x Hunter but darker").
5. Saved search alerts — notify the user when a matching anime is added to the catalog.
6. Cross-provider search merge — unified results from TMDB, AniList, and MyAnimeList.
7. Search result snippets with highlighted matching text in titles and descriptions.
