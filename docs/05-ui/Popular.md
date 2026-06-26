# Popular — Nexus Anime

> **Audience:** Engineers implementing the all-time popular page. Defines the definitive top-ranked anime view.

---

## 1. Purpose

All-time popular anime rankings — different from trending which is recent. This page shows definitive top-ranked anime.

## 2. User Goals

- Discover the highest-rated anime of all time
- Browse by type (TV / Movie / OVA) to narrow the field
- Sort by rating, popularity rank, or release year
- Jump quickly to an anime detail page
- Compare top titles at a glance

## 3. Entry Points

- Header "Browse → Popular"
- Home "All-Time Popular → See all"
- Home "See all" link on Popular rail
- Sidebar "Popular"
- Search result sort=popular
- Social / referral deep link

## 4. Layout Structure

```
┌──────────────────────────────────────────────┐
│ HEADER                                       │
├──────────────────────────────────────────────┤
│ PAGE TITLE + DESCRIPTION                     │
├──────────────────────────────────────────────┤
│ TOOLBAR                                      │
│ [Type: All | TV | Movie | OVA]              │
│ [Sort: Rating | Popularity | Year]           │
├──────────────────────────────────────────────┤
│ LARGE CARD GRID                              │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐│
│ │ #1   │ │ #2   │ │ #3   │ │ #4   │ │ #5   ││
│ │POSTER│ │POSTER│ │POSTER│ │POSTER│ │POSTER││
│ │Title │ │Title │ │Title │ │Title │ │Title ││
│ │Rating│ │Rating│ │Rating│ │Rating│ │Rating││
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘│
├──────────────────────────────────────────────┤
│ LOAD MORE BUTTON                             │
└──────────────────────────────────────────────┘
```

## 5. Component Hierarchy

- `PopularPage`
  - `PageHeader` (title + description, star/trophy icon)
  - `PopularToolbar`
    - `FilterChipGroup` (type: All | TV | Movie | OVA)
    - `SortDropdown` (rating | popularity | year)
  - `PopularGrid`
    - `PopularCard` (wraps `AnimeCard`)
      - `RankBadge` (large rank number, overlay on poster)
      - `AnimeCard` (poster + title + rating)
      - `WatchlistToggle`
  - `LoadMoreButton`

## 6. Desktop Layout (≥1024px)

- Page: max-width 1280px, centered.
- Toolbar: sticky below header, glass backdrop (`surface-overlay` + `backdrop-blur`).
- Grid: 5 columns on ≥1440px, 4 columns on 1024–1439px.
- Card: 16px padding, `surface-raised` background, border-radius 12px.
- Rank badge: Space Grotesk 28px bold, top-left corner of poster, semi-transparent `surface-overlay` background pill.
- Card poster: aspect-ratio 2/3, rounded top.
- Card body: title (Inter 16px semibold, `text-primary`), rating (Inter 14px, `text-secondary`), genre chips.
- Section gap: 32px. Card gap: 16px.

## 7. Tablet Layout (768–1023px)

- Grid: 3 columns on 900–1023px, 2 columns on 768–899px.
- Card: rank badge scales to 22px.
- Toolbar: stacks — type chips on one row, sort dropdown below.
- Card padding remains 16px.

## 8. Mobile Layout (<768px)

- Default: single column list (poster left, meta right) for one-handed reach.
- Optional: horizontal scroll carousel toggle at top of grid (user preference persisted to localStorage).
- Carousel cards: 140px wide, snap-x mandatory, 8px gap.
- Rank badge: 18px, top-left of poster.
- Bottom tab bar: "Popular" tab active (filled star/trophy icon).
- Load more: infinite scroll with "Load more" button fallback.

## 9. Navigation Behavior

Active state: "Popular" highlighted in sidebar and header Browse menu. Header uses `surface-overlay` with subtle bottom border. Page title includes trophy/star icon in `action-accent-bg`.

## 10. Scroll Behavior

Toolbar sticky at top below header. Page scrolls normally. Infinite scroll on mobile (threshold 400px from bottom). "Load more" button on tablet + desktop. Scroll restores position on back-navigation.

## 11. Motion & Animation

- Cards stagger fade-up on first load: 25ms per card, fade-up 250ms, spring easing `cubic-bezier(0.22, 1, 0.36, 1)`.
- Card hover: scale 1.02, shadow elevation, border glow `action-primary-bg` at 40% opacity, 200ms.
- Rank badge: slide-in from left on card mount, 200ms spring.
- Toolbar: glass-on-scroll transition (backdrop-blur fades in, 150ms).
- Load more button: loading spinner fade-in 100ms.
- Duration scale: 50–1000ms. All motion respects `prefers-reduced-motion`.

## 12. Loading Experience

- ISR, `revalidate: 900s` (15 min — all-time data changes slowly).
- Skeleton: 10 placeholder cards (grey blocks matching card shape, shimmer animation).
- Streaming: header + toolbar render immediately, grid streams in.
- Suspense boundary wraps `PopularGrid`.
- Rank badges show immediately on skeleton to preserve layout.

## 13. Empty States

Rare. If filters produce 0 results: illustration + "No anime match these filters. Try a different type." with "Reset filters" `secondary` button. Illustration: empty star/trophy icon at 48px, `text-secondary` color.

## 14. Error Handling

- Partial data: render loaded cards, show "Couldn't load more. Retry." inline below last card.
- Full failure: log to Sentry, show page-level error with "Try again" `primary` button.
- Stale data warning: if data older than 24hr, show "Rankings may be slightly outdated" banner (warning tone, `accent-warning`).

## 15. SEO Metadata Requirements

- Title: `Most Popular Anime of All Time — Nexus Anime`
- Description: `The definitive ranking of the top anime of all time. Filter by TV, movies, or OVA and sort by rating, popularity, or year.`
- OG: `summary_large_image` with default OG image (star/trophy motif).
- Canonical: `https://nexusanime.com/popular`.
- Robots: `index, follow`.
- JSON-LD: `ItemList` schema with top 10 anime, each with `name`, `image`, `aggregateRating`.

## 16. Accessibility Requirements

- WCAG 2.2 AA for dark theme.
- Card contrast: `text-primary` (#ecedf5) on `surface-raised` (#111627) — ratio 14.5:1. `text-secondary` (#a3aac6) on `surface-raised` — ratio 6.2:1 (passes AA for large text).
- Rank badge: `aria-hidden` on number; card-level `aria-label="Rank 1: [Title], Rated 8.9, 12 episodes, genres Action, Fantasy"`.
- Toolbar controls: proper `<button>` / form elements with visible labels.
- Sort dropdown: `aria-label="Sort by"`, announces selected option via `aria-live="polite"`.
- Focus management: visible focus ring `action-primary-bg`, 2px offset.
- Reduced motion: disable stagger, disable scale hover, disable rank slide-in.
- Keyboard: arrow-key navigation between cards in grid.

## 17. Future Enhancements

- Animated rank change indicators (climb/drop arrows, updated weekly).
- Year-decade filter (80s, 90s, 2000s, 2010s, 2020s).
- Personalized popular ("Top anime among users like you").
- Compare mode: select 2–3 cards and view side-by-side stats.
- Export list (shareable image card of top 10).
