# Latest — Nexus Anime

> **Audience:** Viewers looking for newly released and upcoming anime

## 1. Purpose

Newest releases — airing episodes, recently finished, and upcoming premieres curated in one view.

## 2. User Goals

- Discover newly released episodes and recently finished series
- Browse upcoming anime with premiere dates
- Filter and sort by status to narrow results
- Quickly add titles to their watchlist

## 3. Entry Points

- "Latest" tab in the main navigation
- Deep link from push notification or email digest
- Home page "New Releases" section "See All" link
- Direct URL `/latest`

## 4. Layout Structure

```
┌─────────────────────────────────────────────────┐
│  Header                                         │
├─────────────────────────────────────────────────┤
│  Toolbar: [Status Filter] [Sort]                │
├─────────────────────────────────────────────────┤
│  ┬─ Recently Released ─────────────────────────┐ │
│  │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │ │
│  │ │ NEW  │ │ NEW  │ │ NEW  │ │ NEW  │       │ │
│  │ │Card  │ │Card  │ │Card  │ │Card  │       │ │
│  │ └──────┘ └──────┘ └──────┘ └──────┘       │ │
│  │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │ │
│  │ │ NEW  │ │ NEW  │ │ NEW  │ │ NEW  │       │ │
│  │ │Card  │ │Card  │ │Card  │ │Card  │       │ │
│  │ └──────┘ └──────┘ └──────┘ └──────┘       │ │
│  └─────────────────────────────────────────────┘ │
│  ┬─ Coming Soon ──────────────────────────────┐ │
│  │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │ │
│  │ │Badge │ │Badge │ │Badge │ │Badge │       │ │
│  │ │Card  │ │Card  │ │Card  │ │Card  │       │ │
│  │ └──────┘ └──────┘ └──────┘ └──────┘       │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## 5. Component Hierarchy

- `LatestPage`
  - `Header`
  - `Toolbar`
    - `StatusFilter` (airing / finished / upcoming)
    - `SortSelect` (newest / oldest)
  - `Section` — "Recently Released"
    - `AnimeCard` with `NewRibbon` overlay
  - `Section` — "Coming Soon"
    - `AnimeCard` with `Badge` (outline variant) showing premiere date
  - `WatchlistToggle` (per card, ghost variant, `sm`)

## 6. Desktop Layout

≥1024px. 5-column grid of `AnimeCard` components. Card padding 16px, grid gap 24px, section gap 32px. `NewRibbon` positioned top-left on poster with `action-accent-bg` background. "Coming Soon" cards show outline badge using `action-primary-bg` border and `text-primary` label with premiere date below title.

## 7. Tablet Layout

768–1023px. 3-column grid. Grid gap 16px, section gap 24px. Cards maintain aspect ratio; `NewRibbon` scales to 80% font size. Toolbar stacks label above controls at <900px.

## 8. Mobile Layout

<768px. Single column, full-width cards in a horizontal scrollable row per section. Bottom tab bar active state on "Latest" tab with `action-primary-bg` indicator. Card padding 16px, vertical gap 12px between cards, 32px between sections.

## 9. Navigation Behavior

"Latest" nav item shows `action-primary-bg` underline when active. Page header uses Space Grotesk 22px `text-primary` on `surface-base`. Scroll position preserved on back navigation via Next.js scroll restoration.

## 10. Scroll Behavior

Infinite scroll with intersection observer. Next batch fetched when last card enters viewport. Cursor-based pagination, 20 items per page. Scroll-to-top button fades in after 600px scroll offset (opacity transition 150ms).

## 11. Motion & Animation

- Card entry: staggered fade-up (translateY 12px → 0, opacity 0 → 1), 200ms duration, spring easing `cubic-bezier(0.22, 1, 0.36, 1)`, 30ms stagger per card
- `NewRibbon`: scale-in from 0 → 1, 150ms, spring easing
- Hover: card lifts 4px with `surface-overlay` shadow, 100ms, spring easing; poster dims to 80% brightness
- `WatchlistToggle`: icon scales 1 → 1.2 → 1, 300ms, spring easing
- Section entrance: title slides in from left 8px, 250ms, spring easing
- `SearchBar` expand: width transition 200ms, spring easing

## 12. Loading Experience

- Initial: 10 skeleton `AnimeCard` shells (pulsing `surface-raised` blocks at 1200ms cycle)
- Streaming: `Suspense` boundary per section — "Recently Released" renders first, "Coming Soon" streams in after
- Skeleton poster area: 2:3 aspect ratio box, `surface-raised` base with shimmer gradient
- Skeleton text: two lines, 60%/40% width, `surface-raised`

## 13. Empty States

- No results: illustration (magnifying glass over empty shelf), `text-secondary` message "No anime found for this filter.", `Button` (primary, `md`) "Clear Filters"
- Empty "Coming Soon": `text-secondary` message "No upcoming premieres scheduled yet." — no CTA

## 14. Error Handling

- Partial failure: failed section shows `accent-error` banner with "Could not load [section name]" and retry `Button` (outline, `sm`); other sections remain visible
- Full failure: full-page error with illustration, `accent-error` message "Something went wrong", retry `Button` (primary, `md`)
- Retry: re-fetches data via Server Action; preserves current filter/sort state

## 15. SEO Metadata Requirements

- **Title:** `New Releases & Upcoming Anime — Nexus Anime`
- **Description:** `Browse the newest anime releases, currently airing series, and upcoming premieres on Nexus Anime.`
- **OG Image:** branded collage of 4 latest posters, 1200×630px
- **Canonical:** `https://nexusanime.com/latest`
- **Robots:** `index, follow`
- **JSON-LD:** `CollectionPage` schema with `name`, `description`, `url`

## 16. Accessibility Requirements

- WCAG 2.2 AA: `text-primary` on `surface-base` ratio ≥ 7:1; `action-primary-bg` on `surface-base` ratio ≥ 4.5:1
- `NewRibbon`: `aria-label="New release"` on poster overlay
- `StatusFilter`: `role="radiogroup"` with `aria-label="Filter by status"`
- Card grid: `role="list"`, each `AnimeCard` has `role="listitem"` with `aria-label` including title and rating
- Focus management: tab order flows toolbar → section titles → cards; visible focus ring using `action-primary-bg` with 2px offset
- Skip-to-content link hidden until focused
- `WatchlistToggle`: `aria-pressed` state, `aria-label="Add [title] to watchlist"`

## 17. Future Enhancements

- Day-of-week grouping within "Recently Released" for easier tracking
- Notification bell per "Coming Soon" title for premiere reminders
- Filter by genre tags alongside status
- Personalized "Recommended New" section based on watch history
- Calendar view toggle for upcoming premiere dates
