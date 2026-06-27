# Anime Detail — Nexus Anime

> **Audience:** Product, design, and engineering teams implementing or reviewing the anime detail page.

## 1. Purpose

The anime detail page is the most important catalog surface in Nexus Anime — it is the primary destination where a user decides whether to start, continue, or save a series.

## 2. User Goals

- Decide whether to watch the series based on synopsis, rating, and trailer
- Jump directly into the next unwatched episode (continue watching)
- Browse and select a specific episode from a season
- Add or remove the series from their watchlist
- Discover related or similar titles

## 3. Entry Points

- Search result card (`AnimeCard`) from the home or search page
- `AnimeCard` in a recommendation or similar carousel
- Continue watching `ProgressCard` on the home page
- Direct shared link or external deep link
- Watchlist entry on the user's library page

## 4. Layout Structure

```
┌──────────────────────────────────────────────────────────┐
│ HERO (full-width, 80vh desktop / 50vh mobile)            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ banner backdrop  ·  play trailer CTA overlay       │  │
│  │ romaji title (28px) · english · japanese           │  │
│  │ meta row · genre pills                             │  │
│  └────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│ ACTION BAR                                               │
│  [Watch S01 E01]  [WatchlistToggle]  [Trailer]  [Share]  │
├───────────────────────────────────────┬──────────────────┤
│ 2/3 — SYNOPSIS + META                 │ 1/3 — EPISODES   │
│  synopsis text                        │  season selector │
│  details grid (studio, source, etc.)  │  episode table   │
├───────────────────────────────────────┴──────────────────┤
│ RELATED CAROUSELS                                        │
│  ┌─ Recommendations ──────────────────────────────────┐  │
│  │  AnimeCard · AnimeCard · AnimeCard · ...           │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌─ Similar ──────────────────────────────────────────┐  │
│  │  AnimeCard · AnimeCard · AnimeCard · ...           │  │
│  └────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│ REVIEWS (v1 silent placeholder — reserved space)         │
└──────────────────────────────────────────────────────────┘
```

## 5. Component Hierarchy

- `AnimeDetailPage`
  - `Header` (transparent over hero, solid on scroll)
  - `HeroBanner`
    - banner backdrop image
    - `PlayTrailerButton` overlay
    - title block (romaji / english / japanese)
    - meta row (rating, year, season, episode count, status)
    - genre pills
  - `ActionBar`
    - `Button` primary `lg` "Watch S01 E01"
    - `WatchlistToggle`
    - `Button` outline "Trailer"
    - `Button` ghost "Share" (future)
  - `ContentGrid` (2/3 + 1/3 split)
    - `SynopsisPanel`
      - synopsis text
      - details grid
    - `EpisodePanel`
      - `SeasonSelector` tabs
      - `EpisodeTable`
        - `EpisodeRow` (number / title / thumbnail / duration / air date / progress bar)
  - `RelatedSection`
    - `AnimeCard` carousel — Recommendations
    - `AnimeCard` carousel — Similar
  - `ReviewsPlaceholder` (reserved, non-interactive in v1)

## 6. Desktop Layout

Viewport ≥1024px. Hero is full-width at 80vh. Below the action bar, a 2/3 + 1/3 sidebar-right grid: synopsis and meta on the left, episode list and watchlist on the right. Related carousels sit at the bottom, each a horizontally scrollable row of `AnimeCard` components. Section gap is 32px; card padding is 16px on an 8px grid.

## 7. Tablet Layout

Viewport 768–1023px. Hero is slightly shorter than desktop. The 2/3 + 1/3 grid collapses to a single stacked column: synopsis first, then episode list. Related carousels remain horizontal but show fewer cards per viewport. Typography scales to 22px page title.

## 8. Mobile Layout

Viewport <768px. Hero is 50vh. All sections stack vertically in a single column. The action bar wraps or stacks small buttons (`sm` / `md`). Episode rows become tappable list items. A bottom tab bar may overlay the viewport on scroll; content reserves bottom padding so the last carousel is not obscured.

## 9. Navigation Behavior

The header is transparent over the hero backdrop and transitions to a solid `surface-raised` background on scroll. A back button or breadcrumb (e.g., Home > Catalog > {Title}) is present in the header for upstream navigation. Deep links restore scroll position and open the correct season tab.

## 10. Scroll Behavior

The hero uses a subtle parallax effect on the banner backdrop. The header transitions from transparent to solid after scrolling past the hero. The episode list scrolls independently within its right-rail container on desktop so the synopsis remains visible. On mobile, the page scrolls as one column.

## 11. Motion & Animation

Hero content fades and slides in on load. Banner parallax responds to scroll position. Episode rows lift and show a border highlight on hover. Duration scale runs from 50ms (micro-feedback) to 1000ms (hero entrance), using the spring easing `cubic-bezier(0.22, 1, 0.36, 1)` for entrance and layout transitions.

## 12. Loading Experience

A hero skeleton with a shimmer placeholder renders while the banner and metadata load. Episode list shows skeleton rows matching the table shape. Each async section (synopsis, episodes, related) is wrapped in its own Suspense boundary so partial content renders without blocking the whole page.

## 13. Empty States

When a synopsis is unavailable, show a muted "No synopsis available" message in `text-secondary`. When no episodes are available, render an empty state in the episode panel with a clear label and, where applicable, an expected release hint.

## 14. Error Handling

If the banner image fails to load, fall back to a gradient built from `surface-base` to `surface-overlay`. If the episode list partially fails, render the rows that loaded and show an inline retry control for the failed slice. No unhandled promise rejections reach the user — every async boundary has a friendly fallback.

## 15. SEO Metadata Requirements

Dynamic page title follows `{Romaji Title} — Nexus Anime`. The OG image is generated from the banner backdrop. A JSON-LD `TVSeries` schema includes title, description, genre, episode count, and rating. A canonical URL is emitted to prevent duplicate-content issues across shared links.

## 16. Accessibility Requirements

Targets WCAG 2.2 AA for the dark theme. Color contrast meets ratio against `surface-base` and `surface-raised`. Hero video, when present, is muted autoplay with an explicit pause button. The episode list is a proper list with descriptive row labels. Interactive elements have ARIA labels, and focus order follows the visual layout.

## 17. Future Enhancements

- Inline trailer preview that expands from the hero CTA
- User reviews and ratings (replace the v1 placeholder)
- Multiple audio/subtitle track selection in the episode row
- "Jump to next unwatched" floating action on the episode panel
- Personalized "Because you watched X" recommendation row
