# Genres — Nexus Anime

> **Audience:** Browsing users exploring the catalog by category; no authentication required.

## 1. Purpose

A two-part page that lets users browse the full genre index as glass cards, then drill into a genre detail view showing a filtered anime grid.

## 2. User Goals

- Discover anime by browsing genre categories visually.
- See sample titles inside a genre before committing to the drill-down.
- Filter the catalog by one or more genres simultaneously.
- Navigate cleanly between the index and detail states.

## 3. Entry Points

- **Primary navigation link** — "Genres" tab in the top nav (`/genres`).
- **Genre chip** on anime detail pages (clicking `Action` chip navigates to `/genres?genre=action`).
- **Search empty-state CTA** — "Browse by Genre" button when search returns zero results.
- **Footer link** — Genre index link in the sitemap section.

## 4. Layout Structure

```
┌────────────────────────────────────────────────────┐
│  Header (transparent → solid on scroll)             │
├────────────────────────────────────────────────────┤
│  Breadcrumb:  Home > Genres > Action               │
├────────────────────────────────────────────────────┤
│  Page Title: "Browse by Genre"                     │
│  Subtitle: "30 genres · 12,400+ titles"            │
├────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐│
│ │ ⚔ Action  │ │ 🧭 Adv.  │ │ 🔮 Fantasy│ │ 💕 Rom. ││
│ │ 1,240    │ │ 980      │ │ 1,560    │ │ 870     ││
│ └──────────┘ └──────────┘ └──────────┘ └─────────┘│
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐│
│ │ 🚀 Sci-Fi │ │ 😂 Comedy│ │ 🔪 Thrill.│ │ 🎵 Music││
│ │ 760      │ │ 1,890    │ │ 640      │ │ 320     ││
│ └──────────┘ └──────────┘ └──────────┘ └─────────┘│
│                       ...                          │
├────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────┐   │
│ │ Filter Bar: [Action] [Fantasy] [✕ Clear]     │   │
│ │ Sort: Popularity ▾   View: Grid ▾            │   │
│ └──────────────────────────────────────────────┘   │
├────────────────────────────────────────────────────┤
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐   │
│ │AnimeCard│ │AnimeCard│ │AnimeCard│ │ AnimeCard  │   │
│ └────────┘ └────────┘ └────────┘ └────────────┘   │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐   │
│ │AnimeCard│ │AnimeCard│ │AnimeCard│ │ AnimeCard  │   │
│ └────────┘ └────────┘ └────────┘ └────────────┘   │
├────────────────────────────────────────────────────┤
│  Footer                                            │
└────────────────────────────────────────────────────┘
```

## 5. Component Hierarchy

- `GenresPage` (route: `/genres`)
  - `GenreHeader` — page title + subtitle + breadcrumb
  - `GenreGrid` (index state)
    - `GenreCard` (~30 instances)
      - `GenreIcon` — colored glyph representing the genre
      - `GenreName` — e.g. "Action"
      - `CountBadge` — e.g. "1,240"
      - `ThumbnailReveal` (hover) — 1-2 small poster thumbnails floating beneath card
  - `GenreFilterBar` (detail state)
    - `ActiveGenreChip` (checkbox chip per active genre, removable)
    - `ClearFiltersButton`
    - `SortDropdown` (Popularity / Rating / Newest / A–Z)
    - `ViewToggle` (Grid / List)
  - `AnimeGrid` (detail state — reuses catalog grid pattern)
    - `AnimeCard` (poster + title + rating + progress, lazy-loaded)
  - `PaginationTrigger` — infinite-scroll sentinel

## 6. Desktop Layout

**Breakpoint:** ≥1024px.

- Header: transparent over `surface-base`, transitions to `surface-raised` with backdrop-blur on scroll.
- Page title: Space Grotesk 28px, `text-primary`.
- Subtitle: Inter 14px, `text-secondary`.
- Genre grid: 5–6 columns (depends on viewport width via `repeat(auto-fill, minmax(180px, 16px))` gap).
- Genre card:
  - Padding: 16px.
  - Background: `surface-raised` with `backdrop-blur` (glassmorphism).
  - Border: 1px solid `surface-overlay`.
  - Genre icon: 40px colored circle using genre-mapped gradient tokens (e.g. Action = `action-primary-bg` to `action-accent-bg`).
  - Card radius: 12px.
- Filter bar: sticky below header when in detail view, `surface-overlay` background, 16px vertical padding.
- Anime grid: 4–6 columns, 32px section gap, 16px card padding.
- Hover thumbnail reveal: 2 thumbnails float 8px below card, fade-in 200ms.

## 7. Tablet Layout

**Breakpoint:** 768–1023px.

- Genre grid: 3–4 columns.
- Anime grid: 3 columns.
- Filter bar: stacks vertically (chips row + sort/view row) if width < 900px.
- Breadcrumb: same style, 14px Inter.
- Card padding remains 16px.

## 8. Mobile Layout

**Breakpoint:** <768px.

- Genre cards: single-column full-width in a vertical stack; icon left, name + count right, horizontal layout.
- Thumbnail reveal: disabled on touch devices; tapping the card navigates directly to detail.
- Anime grid: 2 columns (380px min-safe for readability).
- Header and filter bar: full-width with horizontal scroll for chips.
- Breadcrumb: truncated to current section (shows "> Action" only).
- If a **Bottom Tab Bar** is configured globally, "Genres" tab is the second icon and receives an active highlight dot in `action-primary-bg`.

## 9. Navigation Behavior

- **Index → Detail:** clicking a genre card updates query param (e.g. `?genre=action`) and transitions the view client-side (no full page reload).
- **Active state:** Active genre chip in filter bar is `action-primary-bg` filled, white label, `✕` remove icon.
- **Breadcrumb:** `Home > Genres > Action` rendered between header and content. Each crumb is a link except the last. Separator: `>` in `text-secondary`.
- **Back button:** A `← Back to All Genres` ghost button appears top-left of the filter bar in detail state; clearing filters also returns to index.
- **Multi-genre:** Selecting additional genres appends params (`?genre=action&genre=fantasy`); chip bar grows horizontally with scroll. Each chip is independently removable.
- **URL-driven:** Direct navigation to `/genres?genre=action` renders the detail state on mount without an intermediate index flash.

## 10. Scroll Behavior

- **Genre index:** Standard page scroll. Sticky header (0 → `surface-raised` with `backdrop-blur`) activates after 24px scroll. No virtualization needed; 30 cards render eagerly.
- **Genre detail (anime grid):** Infinite scroll using `IntersectionObserver` sentinel at the bottom of the list. Cursor-based pagination; each batch adds 24 cards. Scroll-to-top behavior preserves filter state.
- **Scroll restoration:** `scrollRestoration: true` so returning via browser back restores previous position within the grid.

## 11. Motion & Animation

- **Genre card entry:** Fade-in + translateY(8px→0); stagger 30ms per card on initial load.
- **Card hover:** Subtle scale 1.02, `surface-overlay` border glow using a 1px `action-primary-bg` 40% opacity ring. Transition: 200ms `cubic-bezier(0.22, 1, 0.36, 1)`.
- **Thumbnail reveal:** On hover, two thumbnails slide up 6px and fade in (opacity 0→1, 250ms, spring easing). The second thumbnail delays 80ms.
- **Filter bar slide:** When entering detail state, filter bar slides down from under the header (0→height, 200ms).
- **Anime grid crossfade:** When filter changes, current cards fade out (150ms) and new cards fade in with stagger (30ms each). Prevents layout shifting by reserving grid height during transition.
- **Duration scale:** micro-interactions 50–100ms, structural transitions 200–400ms, reveal animations up to 1000ms for hero elements.

## 12. Loading Experience

- **Genre index:** Low payload (30 genre cards with counts) — renders within first paint. Skeleton fallback: 12 placeholder rectangles in genre-column layout showing shimmer animation.
- **Genre detail anime grid:**
  - Streaming SSR for first 12 `AnimeCard`s.
  - `<Suspense>` boundary wraps the infinite-scroll grid; skeleton row of 6 card placeholders streams until real data arrives.
  - Posters use `next/image` with `priority` on first 4, lazy-loading for the rest.
- **Filter change:** Immediate chip state update; grid area shows a gentle opacity transition rather than full skeleton to avoid flicker.
- **Hydration:** Use `use()` with `React.cache()` for request deduplication; no duplicate fetches for identical genre queries.

## 13. Empty States

- **Filter yields zero results:**
  - Illustration: empty grid icon in `action-accent-bg` tint (80px).
  - Message: `text-primary` — "No anime match these filters."
  - CTA: `secondary` button, label "Clear all filters", resets to index.
- **Empty genre index (should never happen at runtime, but defensively):**
  - Message in `text-secondary`: "Genre data is loading. Check back shortly."
  - Retry button (`outline` variant).
- **Empty genre detail:** If genre exists but has 0 anime, show soft note "No titles in this genre yet" with `primary` button linking back to genre index.

## 14. Error Handling

- **Partial failure (genre count fails, icons succeed):**
  - Show genre cards without count badges; display "—" placeholder in badge spot.
  - Console log; no blocking UI.
- **Full failure (genre index fetch fails):**
  - Render retry card: `accent-error` bordered card with error message and `primary` "Retry" button.
  - Skeleton remains visible behind to preserve layout.
- **Anime grid fetch fails in detail:**
  - Show error toast (`accent-error` border) inside the anime grid area.
  - Keep active chips visible so user can adjust filters without losing context.
  - Inline `ghost` "Retry" button inside the empty-state slot.
- **Image load fail on AnimeCard:** Fall back to a gradient placeholder with genre-mapped color and overlayed title text.

## 15. SEO Metadata Requirements

- **Title:** `Browse Anime by Genre — Nexus Anime`
- **Description:** "Explore 30+ anime genres from Action to Slice of Life. Browse, filter, and find your next watch on Nexus Anime, the premium dark-mode anime streaming portal."
- **Open Graph:** Shared with canonical catalog card — 1200×630px, `surface-base` background, genre icon grid Nexus mark, title in Space Grotesk.
- **Canonical:** `https://nexus-anime.vercel.app/genres`
- **Robots:** `index, follow` (genre index is public, content-rich).
- **JSON-LD:** `ItemList` schema listing top 10 genres with URL, name, and numberOfItems.

## 16. Accessibility Requirements

- **WCAG 2.2 AA** compliance on dark theme.
- **Color contrast:**
  - `text-primary` (#ecedf5) on `surface-base` (#0a0e1a): ratio 15.4:1 — exceeds AA.
  - `text-secondary` (#a3aac6) on `surface-base`: ratio 5.7:1 — passes AA for large text and WCAG AA Normal for body at 14px+.
  - Count badge text inside `action-primary-bg` circle: use `text-primary` for ≥4.5:1.
- **ARIA labels:**
  - Genre cards: `aria-label="Browse Action genre, 1,240 titles"`.
  - Active filter chips with remove: `aria-label="Remove Action filter"`.
  - Filter bar: `role="group"`, `aria-label="Active genre filters"`.
  - Pagination sentinel: `aria-label="Loading more anime"`, `aria-live="polite"`.
- **Focus management:**
  - Visible focus ring: `action-primary-bg`, 2px, offset 2px, on all interactive elements.
  - Tab order: left-to-right within genre grid, then filter chips, then sort dropdown, then anime cards.
  - On filter change, announce via `aria-live="polite"` region: "Showing anime for Action and Fantasy, 340 results."
- **Reduced motion:** `prefers-reduced-motion: reduce` disables thumbnail reveal animation and grid crossfade; content instant swap.

## 17. Future Enhancements

- **Genre detail landing pages:** Persistent per-genre landing with curated hero banner, editorial description, and "Staff Picks" row.
- **Genre-based recommendations:** "Because you watched Action" horizontal rail at the bottom of the genre detail.
- **Genre map visualization:** Force-directed node graph showing genre overlap (e.g. Action ↔ Thriller) as an alternate view mode.
- **Collaborative filtering:** "Users who like Fantasy also enjoyed Sci-Fi" insight chip in filter bar.
- **Custom genre collections:** Let authenticated users build personal genre collections (e.g. "Shonen essentials") and share via permalink.
