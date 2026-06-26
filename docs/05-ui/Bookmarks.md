# Bookmarks — Nexus Anime

> **Audience:** Designers, frontend engineers, and QA engineers implementing the authenticated watchlist (display name "Bookmarks") page.

---

## 1. Purpose
Authenticated hub where users view, sort, filter, and manage the anime they have saved to their watchlist.

## 2. User Goals
- See all bookmarked anime at a glance with current watch status.
- Filter by status (want_to_watch, watching, completed, dropped).
- Sort by recent, alphabetical, or status priority.
- Reorder entries via accessible single-pointer controls.
- Remove a bookmark or mark it complete from the card itself.
- Navigate to trending anime when the list is empty.

## 3. Entry Points
- Header navigation link "Bookmarks" (visible only when authenticated).
- Post-action toast "Added to Bookmarks" with deep-link after toggling from `/anime/[slug]`.
- Direct URL `/bookmarks` shared or bookmarked externally.

## 4. Layout Structure
```
┌──────────────────────────────────────────────────────┐
│  Header (sticky)                                     │
│  ┌────────────────────────────────────────────────┐  │
│  │ "Bookmarks"  [count badge]    [sort dropdown]  │  │
│  └────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────┤
│  Filter bar (sticky below header)                    │
│  ┌────────────────────────────────────────────────┐  │
│  │ [All] [Want to Watch] [Watching] [Completed]   │  │
│  │ [Dropped]                                       │  │
│  └────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────┤
│  Grid                                                │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                │
│  │ Card │ │ Card │ │ Card │ │ Card │                │
│  └──────┘ └──────┘ └──────┘ └──────┘                │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                │
│  │ Card │ │ Card │ │ Card │ │ Card │                │
│  └──────┘ └──────┘ └──────┘ └──────┘                │
└──────────────────────────────────────────────────────┘
```

## 5. Component Hierarchy
- `BookmarksPage` (Server Component, auth-gated)
  - `BookmarksHeader`
    - `PageTitle` — "Bookmarks", Space Grotesk 22px, `text-primary`
    - `CountBadge` — Inter 12px, `surface-overlay` bg, `text-secondary`
    - `SortDropdown` — recent / alphabetical / status
  - `FilterBar` (sticky)
    - `FilterChip` × 5 — all / want_to_watch / watching / completed / dropped
  - `BookmarksGrid`
    - `AnimeCard` (one per entry)
      - `StatusBadge` — top-left overlay
      - `OverflowMenu` — "Mark complete", "Remove"
      - `ReorderControls` — up/down buttons (single-pointer a11y)
  - `EmptyState`
    - `EmptyIllustration` — decorative SVG, `surface-raised` bg
    - `EmptyTitle` — "Your watchlist is empty."
    - `EmptySubtitle` — "Browse recommendations."
    - `CTAButton` — "Explore Trending", links to `/trending`

## 6. Desktop Layout (≥1024px)
- Max content width: 1280px, centered.
- Grid: 4 columns at 1024px, 5 columns at 1280px.
- Card aspect ratio: 2:3 (poster), 16px padding, 12px gap.
- Header: title + badge left-aligned, sort dropdown right-aligned (top-right, sticky below header).
- Filter bar: horizontal chip row, 8px gap, sticky below header with `backdrop-blur` and `surface-overlay` bg.
- Section gap: 32px between header, filter, and grid.

## 7. Tablet Layout (768–1023px)
- Grid: 3 columns.
- Card padding: 12px, gap: 8px.
- Filter bar: horizontal scroll with snap points; no wrapping.
- Sort dropdown remains top-right; header row compresses with 24px horizontal padding.
- Section gap: 24px.

## 8. Mobile Layout (<768px)
- Grid: 2 columns, 12px gap, 16px horizontal padding.
- Header stacks: title + badge on first row, sort dropdown full-width on second row.
- Filter bar: horizontal scroll, full-bleed with 16px padding, sticky with `backdrop-blur`.
- Card: status badge 24px, overflow menu always visible (no hover dependency).
- Reorder controls: 32px touch-target buttons, inline below card meta.
- Section gap: 16px.

## 9. Navigation Behavior
- Clicking a card navigates to `/anime/[slug]`.
- Sort and filter changes update query params (`?sort=recent&status=watching`) via `router.replace` to preserve browser history.
- Authenticated gate: unauthenticated visitors are redirected to `/login?next=/bookmarks`.
- Header "Bookmarks" link shows active state on this route.

## 10. Scroll Behavior
- Header and filter bar remain sticky with `position: sticky; top: 0` and `z-index: 20`.
- Grid uses infinite scroll with cursor-based pagination (IntersectionObserver, 200px root margin).
- On filter or sort change, scroll position resets to top smoothly (`scrollIntoView({ behavior: 'smooth' })`).
- Scroll container has `scroll-padding-top` equal to combined sticky height (~120px desktop, ~160px mobile).

## 11. Motion & Animation
- Card entrance: fade-in + 8px upward translate, 200ms, spring easing `cubic-bezier(0.22, 1, 0.36, 1)`, stagger 40ms per card.
- Filter/sort change: crossfade 150ms; no layout shift.
- Reorder: card translates vertically 250ms spring easing; siblings shift 200ms.
- Status badge color change: 150ms ease-out.
- Empty state illustration: subtle float animation, 3s loop, ease-in-out.
- All motion respects `prefers-reduced-motion: reduce` — replace with instant opacity swap.

## 12. Loading Experience
- Page-level: `React.Suspense` boundary with skeleton matching final layout (header skeleton, filter chip row, 8-card grid skeleton).
- Skeleton cards: poster aspect ratio placeholder (`surface-raised` bg), two text lines (16px, 12px) shimmering.
- Sort/filter change: inline spinner inside the grid area (no full-page reload); previous grid remains visible until new data arrives.
- Infinite scroll: skeleton card appended at grid bottom while next page loads.

## 13. Empty States
- **No bookmarks at all:** illustration of empty bookmark ribbon, title "Your watchlist is empty.", subtitle "Browse recommendations.", CTA "Explore Trending" → `/trending`. Background: `surface-base`, card surface: `surface-raised`.
- **Filter returns zero:** illustration of empty filter, title "No anime match this filter.", subtitle "Try a different status.", secondary CTA "Clear filters" → resets `status` param.
- **Search within bookmarks (future):** illustration of empty search, title "No results found.", subtitle "Try a different search term."

## 14. Error Handling
- Grid fetch failure: inline error card with message "Could not load bookmarks." and retry button; preserves header and filter bar.
- Network error during sort/filter: toast notification "Failed to update. Please try again."; UI reverts to previous state.
- Auth session expired: redirect to `/login` with toast "Session expired. Please sign in again."
- Image fallback: poster images use `next/image` with fallback placeholder (`surface-raised` bg, anime icon SVG).

## 15. SEO Metadata Requirements
- `<title>`: `My Bookmarks — Nexus Anime`
- `<meta name="description">`: `Manage your anime watchlist on Nexus Anime — track what you want to watch, what you're watching, and what you've completed.`
- `robots`: `noindex` (personalized data, not for crawlers).
- `og:title`: `My Bookmarks — Nexus Anime`
- `og:type`: `website`
- `og:description`: `Your personal anime watchlist on Nexus Anime.`
- Canonical: `https://nexus-anime.com/bookmarks` (only when served; noindex means crawlers rarely hit it).
- JSON-LD: not applicable (personal page, no structured data benefit).

## 16. Accessibility Requirements
- Page landmark: `<main>` with `aria-labelledby` pointing to "Bookmarks" heading.
- Count badge: live region `aria-live="polite"` announces "X bookmarks" on load and after add/remove.
- Filter chips: `role="group"` with `aria-label="Filter by status"`; active chip has `aria-pressed="true"`.
- Sort dropdown: `aria-label="Sort bookmarks"`; announces selected option via live region.
- AnimeCard: `article` with `aria-label="{title} — {status}"`; card link is the primary focus target.
- Status badge: decorative `aria-hidden="true"` inside card; status conveyed via card label.
- Overflow menu: `aria-label="More actions for {title}"`; menu items are `menuitem` with focus trap.
- Reorder buttons: `aria-label="Move {title} up"` / `aria-label="Move {title} down"`; single-pointer alternative satisfies WCAG 2.2 2.5.7 (Dragging Movements).
- Keyboard navigation: Tab through cards, Enter opens detail, Arrow keys navigate grid (roving tabindex), `r` key opens reorder mode with visible focus indicator.
- Focus visible: 2px `action-primary-bg` outline, 2px offset, on all interactive elements.
- Color contrast: `text-primary` on `surface-base` ≥ 15:1; `text-secondary` on `surface-raised` ≥ 4.5:1.

## 17. Future Enhancements
- Drag-and-drop reorder with pointer-based fallback (WCAG 2.2 2.5.7 compliance already covered by up/down buttons).
- Bulk select mode: multi-edit status or remove.
- Search within bookmarks (client-side fuzzy filter).
- Custom user-defined collections (e.g., "Rewatch", "Favorites").
- Export bookmarks as CSV or sync to AniList/MyAnimeList.
