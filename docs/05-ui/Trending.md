# Trending — Nexus Anime

> **Audience:** Engineers implementing the trending page. Defines the trending rankings view.

---

## 1. Purpose

Show anime ranked by recent popularity (7-day or 30-day window). Help users discover what the community is watching _right now_.

## 2. User Goals

- Find out what's popular this week
- Surface hidden gems climbing the trending list
- Browse with filters (TV / movies / airing)
- Jump to anime detail quickly

## 3. Entry Points

- Header "Browse → Trending"
- Home "Trending This Week → See all"
- Home "See all" link on Trending rail
- Sidebar "Trending"
- Search result sort=trending
- Social / referral deep link

## 4. Layout Structure

```
┌──────────────────────────────────────────────┐
│ HEADER                                       │
├──────────────────────────────────────────────┤
│ PAGE TITLE + DESCRIPTION                     │
├──────────────────────────────────────────────┤
│ TOOLBAR                                      │
│ [Time window: 7 days | 30 days]             │
│ [Type: All | TV | Movies | OVA]             │
│ [Status: All | Airing | Finished]            │
│ [Sort: Rank | Change | Rating]               │
├──────────────────────────────────────────────┤
│ RANKED LIST                                  │
│ #1  [Thumbnail]  Title meta + genres Watch  │
│ #2  [Thumbnail]  Title meta + genres Watch  │
│ ...                                          │
│ #50 [Thumbnail]  Title meta + genres Watch  │
├──────────────────────────────────────────────┤
│ LOAD MORE BUTTON                             │
└──────────────────────────────────────────────┘
```

## 5. Component Hierarchy

- `TrendingPage`
  - `PageHeader` (title + description)
  - `TrendingToolbar`
    - `SegmentedControl` (time window)
    - `FilterChipGroup` (type, status)
    - `SortDropdown` (rank / change / rating)
  - `TrendingList`
    - `TrendingRow`
      - `RankBadge` (number + up/down/flat indicator)
      - `AnimeCardHorizontal` (thumbnail + title + meta)
      - `TrendingActions` (Watch, Watchlist)
  - `LoadMoreButton`

## 6. Desktop Layout (≥1024px)

- Page: max-width 1100px, centered.
- Toolbar: sticky below header, glass backdrop.
- List: each row is 120px thumbnail + text body + actions column (200px).
- Rank number: 40px space, Space Grotesk 24px bold.
- Up/down/flat chevron up-right of rank.

## 7. Tablet Layout (768–1029px)

- Toolbar: stacks on narrow width.
- Rows use 100px thumbnails, no actions column inline.
- Actions in overflow menu on each row (three-dot).

## 8. Mobile Layout (<768px)

- Toolbar: pill-row at top, horizontally scrollable.
- Each row: 72px thumbnail + stacked title/meta, tap-to-open detail.
- "Watch" button removed from row (tap card → detail → Watch there).
- Infinite scroll replaces "Load more" button (with "Load more" as fallback).

## 9. Navigation Behavior

Active state: "Trending" highlighted in sidebar / header Browse menu.

## 10. Scroll Behavior

Toolbar sticky at top below header. Page scrolls normally. Infinite scroll on mobile, "Load more" on tablet+desktop.

## 11. Motion & Animation

- Rows stagger fade-in on first load, 30ms per row, fade-up 300ms.
- Toolbar: sticky transition glass-on-scroll.
- Hover row: background color shift to `surface-raised`, 150ms.
- Up/down chevron: bounce animation on initial mount (500ms spring) to indicate movement.

## 12. Loading Experience

- ISR, `revalidate: 300s`.
- Skeleton: 10 placeholder rows (grey blocks matching row shape).
- Streaming: header + toolbar render immediately, list streams in.
- Suspense boundary wraps list.

## 13. Empty States

Rare. If filters produce 0 results: "No anime match these filters. Try a wider time window or different type." with "Reset filters" button.

## 14. Error Handling

- Partial data: render what's loaded, show "Couldn't load the rest. Retry." inline.
- Full failure: log to Sentry, show page-level error with "Try again" button.
- Stale data warning: if data older than 1hr, show "Trending data may be stale" banner.

## 15. SEO Metadata Requirements

- Title: `Trending Anime This Week — Nexus Anime`
- Description: `Discover what anime everyone is watching this week. Ranked by community activity.`
- OG: `summary_large_image` with default OG image.
- Canonical: `https://nexusanime.com/trending`.
- Robots: `index, follow`.

## 16. Accessibility Requirements

- Toolbar controls are proper `<button>` / form elements with visible labels.
- "Time window: 7 days" announcement via `aria-label`.
- Rows are `<a>` with `aria-label="Rank 1: [Anime title], Rated 8.7, 24 episodes, genres Action, Fantasy"`.
- Keyboard navigable list.
- Rank indicator `aria-hidden` to avoid reading numbers; read info via parent row label.
- Reduced motion: disable stagger, disable bounce chevron.

## 17. Future Enhancements

- Animated rank change indicators (climb/drop).
- Per-day stats sparkline per anime.
- Compare two anime feature.
- Personalized trending ("Trending among users like you").
