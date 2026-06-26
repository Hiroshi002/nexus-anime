# Search — Nexus Anime

> **Audience:** Browsing and returning viewers seeking specific anime or discovery via exploration.

## 1. Purpose

Full search experience with 300ms debounced query, trending/recent/fuzzy suggestions dropdown, filterable results grid, and infinite-scroll ranking.

## 2. User Goals

- Find a specific anime by title within 300ms of typing.
- Discover related anime via trending queries and fuzzy suggestions.
- Refine results with year, genre, status, and rating filters.
- Sort by relevance, rating, popularity, or release date.
- Navigate results quickly via ranked card grid.

## 3. Entry Points

- `SearchBar` in the global `Header` (persistent on every page).
- Direct URL navigation to `/search?q=<query>`.
- Empty-state popular/trending links on `Home`.
- `WatchlistToggle` empty-state CTA on `Watchlist`.

## 4. Layout Structure

```
┌──────────────────────────────────────────────────────────┐
│  Header (SearchBar md+, icon-sm                          │
├──────────────────────────────────────────────────────────┤
│ �──────────────────────────────────────────────────────┐ │
│ │  Search Input (lg) — auto-focus on page load        │ │
│ │  ├─ Recent Searches (localStorage)                   │ │
│ │  ├─ Trending Queries                                 │ │
│ │  └─ Fuzzy Suggest Matches                            │ │
│ └──────────────────────────────────────────────────────┘ │
├────────────┬─────────────────────────────────────────────�
│  Filter    │  Sort Chips │ Result Count                  │
│  Drawer    ├─────────────────────────────────────────────┤
│            │  ┌─────┐ �─────┐ ┌─────┐                    │
│  Year      │  │ #1  │ │ #2  │ │ #3  │  AnimeCard grid    │
│  Genre     │  └─────� └─────┘ └─────┘                    │
│  Status    │  �─────┐ ┌─────┐ �─────┐                    │
│  Rating    │  │ #4  │ │ #5  │ │ #6  │                    │
│            │  └─────┘ └─────� └─────┘                    │
│            │         ... infinite scroll                  │
├────────────┴─────────────────────────────────────────────┤
│  Footer                                                │
└──────────────────────────────────────────────────────────┘
```

## 5. Component Hierarchy

```
SearchPage
├── SearchHeader
│   └── SearchBar (variant lg, auto-focus)
│       ├── RecentSearches (localStorage, max 5)
│       ├── TrendingList (Redis-cached, TTL 60s)
│       └── FuzzySuggest (debounce 300ms)
├── FilterDrawer (Year | Genre | Status | Rating)
├── SortBar (relevance | rating | popularity | date)
├── ResultCount (aria-live polite)
└── ResultsGrid
    ├── AnimeCard × N (with rank number)
    └── AnimeCardSkeleton × 20 (loading)
└── EmptyState (3 alternate query suggestions)
```

## 6. Desktop Layout (≥1024px)

- `SearchBar` full-width in header, max-width 720px, centered, glassmorphism surface (`surface-raised`, `backdrop-blur-md`, 1px border `text-secondary/20`).
- Suggestions dropdown: 5-rounded card, max-height 360px, scrollable, positioned absolute below input.
- Left rail filter drawer: 240px, sticky, chip-style genre toggles, range sliders for year/rating.
- Results grid: 6 columns @ 1440px+, 5 columns @ 1024–1439px.
- Card: 16px padding, poster 3:4, rank badge top-left, title in Inter 16px `text-primary`, rating in `action-accent-bg` pill.
- Sort bar sits between filter and count; 4 chip variants (active = `primary`, inactive = `outline`).
- Section gap 32px, tile gap 24px.

## 7. Tablet Layout (768–1023px)

- Header `SearchBar` collapses into icon trigger; click expands full-width overlay.
- Filter drawer becomes an off-canvas left drawer (overlay mode, swipe-open).
- Results grid: 3–4 columns depending on width.
- Sort chips wrap into a horizontally scrollable row, no wrapping on a second line.
- Active filter pills visible as a chip bar above the grid.

## 8. Mobile Layout (<768px)

- `SearchBar` full-width, height 48px in header, bottom tab-bar offset respected.
- Filter opens as a bottom sheet (drag-down dismiss, 80vh max-height).
- Results grid: single column cards (poster left, metadata right) to preserve readability.
- Sticky sort pill row below the header while scrolling.
- Bottom tab bar remains visible; search overlay is full-screen (90vh).

## 9. Navigation Behavior

- Focus state: input ring `action-primary-bg` at 2px, `surface-overlay` background.
- Typing triggers debounce (300ms) then dropdown slides down.
- Enter key submits current query → route to `/search?q=` with full-page result.
- Arrow-key navigation within suggestions moves highlight; Escape closes dropdown.
- After page load from a direct `/search?q=` URL, input retains value, dropdown closes, results render immediately.

## 10. Scroll Behavior

- Suggestions dropdown: max-height 360px, vertical scroll, does not page-scroll.
- Results grid: cursor-based infinite scroll; load next 20 when sentinel is 400px from bottom.
- Page-header-to-sort-bar sticky offset once user scrolls past search input.
- Genre chip bar remains sticky horizontally when scrolled vertically.

## 11. Motion & Animation

- Suggestions enter: slide-down 120ms + fade-in, spring `cubic-bezier(0.22, 1, 0.36, 1)`.
- Result cards stagger: delay = index × 30ms, total 300ms, same spring easing.
- Filter drawer overlay fade: 200ms ease-out, slide-in 250ms spring.
- Active sort chip background transition: 150ms ease-in-out.
- Duration scale 50–1000ms as defined in tokens; all animations honor prefers-reduced-motion.

## 12. Loading Experience

- 20 `AnimeCardSkeleton` rendered in results grid while search is in flight.
- Each skeleton: shimmer pulse over `surface-raised` placeholder (poster block, two title lines, rating pill).
- No layout shift between skeleton and loaded card — identical dimensions.
- After filter change, existing results stay visible until new data arrives (avoid full-blank flash).

## 13. Empty States

- Heading: `No results for "{query}".`
- Subtext: `Try one of these instead:`
- Three suggested queries rendered as clickable chips (`secondary` button variant), sourced from trending or related terms.
- If user has filters active, additional note: `Clearing filters may show more results.` with a ghost-button CTA.

## 14. Error Handling

- **Partial failure:** If suggestions API fails, dropdown shows recent searches only; toast banner: `Suggestions unavailable. Showing recent searches.`
- **Full failure:** If results API fails, grid shows error card with retry button (`primary` variant): `Couldn't load results. Try again.`
- **Retry:** Exponential backoff (1s → 2s → 4s), max 3 attempts then surface manual retry.
- User input remains intact on error; no data loss on retry.

## 15. SEO Metadata Requirements

- Base `/search` page: `Search Anime — Nexus Anime`, meta description `Search and discover anime on Nexus Anime.`, indexable.
- Query pages `/search?q=<query>`: title `"{query}" Search Results — Nexus Anime`. Noindex when query starts with non-alpha characters or matches low-quality patterns (e.g., single character, random symbols). Canonical URL includes sanitized `q` param.
- Paginated results: `rel="prev"` / `rel="next"` on cursor links.

## 16. Accessibility Requirements

- WCAG 2.2 AA contrast on dark theme: all text/background pairs meet 4.5:1 minimum.
- Search input: `role="combobox"`, `aria-expanded="true"` when dropdown open, `aria-activedescendant` pointing at highlighted suggestion.
- Results count: `aria-live="polite"` region announcing `"N results for '{query}'"`.
- Suggestion list: `role="listbox"`, each option `role="option"` with `aria-selected`.
- Filters: labeled fieldsets with chip-group roles, slider inputs with `aria-valuemin`/`aria-valuemax` announcements.
- Focus order: input → suggestions → filters → sort → results → footer; trap focus within bottom sheet on mobile.
- Keyboard: arrows, Enter, Escape, Tab nav fully operational without mouse.

## 17. Future Enhancements

- Voice input via Web Speech API (mobile search entry).
- Visual similarity search: upload poster, find similar art style.
- AI-powered natural language queries (`shows like hunter x hunter but darker`).
- Saved search alerts: notify when matching anime added to catalog.
- Cross-provider search merge (TMDB + AniList + MyAnimeList unified result).
