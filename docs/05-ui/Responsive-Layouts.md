# Responsive Layouts — Nexus Anime

> **Audience:** Frontend engineers, UI designers, and QA testers implementing or verifying cross-page responsive behavior.

---

## 1. Purpose

Define the breakpoint system, layout transformations, and responsive patterns that every page in Nexus Anime follows to deliver a consistent experience from 320px mobile to 1600px+ wide desktop.

## 2. User Goals

- Browse and consume content comfortably on any device without pinch-zoom or horizontal scroll.
- Maintain access to primary navigation and playback controls regardless of viewport.
- Experience no layout shift when navigating between pages at any breakpoint.
- Interact with touch-friendly targets on mobile and tablet.

## 3. Entry Points

- `apps/web/src/app/**` — every route in the App Router.
- `apps/web/src/components/**` — shared layout shells (header, sidebar, tab bar).
- `apps/web/src/styles/tokens.css` — design-token breakpoint values and spacing scales.
- `apps/web/tailwind.config.ts` — Tailwind breakpoint mapping and container-query plugin config.

## 4. Layout Structure

```
┌──────────────────────────────────────────────────────────┐
│  Header (persistent; transforms at 768px)                │
├────────────┬──────────────────────────────┬──────────────┤
│  Sidebar   │                              │  Right Rail  │
│  (desktop  │       Main Content Area      │  (player,    │
│   only)    │                              │   related)   │
├────────────┴──────────────────────────────┴──────────────┤
│  Bottom Tab Bar (< 768px, authenticated only)            │
└──────────────────────────────────────────────────────────┘
```

## 5. Component Hierarchy

- `RootLayout`
  - `Header` (desktop nav → hamburger at < 768px)
    - `Logo`
    - `DesktopNav` (hidden < 768px)
    - `SearchBar`
    - `UserMenu`
    - `MobileMenuTrigger` (visible < 768px)
  - `Sidebar` (authenticated pages; hidden < 768px, becomes drawer)
    - `SidebarNav`
  - `Main` (route content)
  - `RightRail` (detail/player pages; collapses below content < 768px)
  - `BottomTabBar` (visible < 768px when authenticated)
    - `TabHome`
    - `TabBrowse`
    - `TabWatchlist`
    - `TabProfile`

## 6. Desktop Layout (≥1024px)

- Container max-width: `1280px` (default), `1600px` for wide (≥ 1440px).
- Sidebar: persistent, 240px fixed, left of content.
- Header: full horizontal nav, search bar, user menu visible.
- Catalog grids: 3 columns (1024–1439px), 4 columns (≥ 1440px).
- Hero banner: 480px height, full-bleed background.
- Rails: horizontal carousels with arrow controls and scroll snapping.
- Detail pages: 2/3 (content) + 1/3 (right rail) split.
- Player: sidebar-right for related queue (320px).
- Typography: hero 48px, page title 28px, body 14px.

## 7. Tablet Layout (768–1023px)

- Container: fluid, padded 24px each side.
- Sidebar: collapsed into off-canvas drawer, triggered by hamburger.
- Header: hamburger replaces desktop nav; search collapses to icon.
- Catalog grids: 2 columns.
- Hero banner: 400px height.
- Rails: horizontal carousels remain but with larger touch targets.
- Detail pages: single column; right rail stacks below content.
- Player: right rail collapses below the player; controls remain full.
- Episode table: remains a table but with horizontal scroll affordance.
- Typography: hero 36px, page title 24px, body 14px.
- Swipe gestures: supported for carousels and drawer open/close.

## 8. Mobile Layout (< 768px)

- Container: fluid, padded 16px each side.
- Sidebar: hidden entirely; drawer overlay from hamburger.
- Bottom tab bar: visible for authenticated users (Home / Browse / Watchlist / Profile).
- Catalog grids: 1 column (list) or 2 columns (card grid, user-toggleable).
- Hero banner: 320px height, reduced imagery complexity.
- Rails: stacked vertical lists instead of horizontal carousels.
- Detail pages: single column, all sections stacked.
- Player: controls simplified; swipe left/right for seek, swipe up/down for volume.
- Episode table: becomes a card list (one card per episode).
- Settings: sidebar tabs become top horizontal tab bar.
- Auth pages: centered card, max-width 440px, no layout shift.
- Typography: hero 28px, page title 22px, body 14px (no shrinking).

## 9. Navigation Behavior

| Element        | Desktop (≥1024px)          | Tablet (768–1023px) | Mobile (< 768px)                    |
| -------------- | -------------------------- | ------------------- | ----------------------------------- |
| Primary nav    | Horizontal links in header | Hamburger → drawer  | Hamburger → drawer + bottom tab bar |
| Sidebar        | Persistent 240px           | Drawer (overlay)    | Drawer (overlay)                    |
| Search         | Full text input            | Icon → expandable   | Icon → full-screen overlay          |
| User menu      | Avatar dropdown            | Avatar dropdown     | Avatar → full-screen menu           |
| Bottom tab bar | Hidden                     | Hidden              | Visible (authenticated only)        |

- Tab bar items: Home, Browse, Watchlist, Profile — each with icon and label.
- Active state uses `--color-accent` token background pill.
- Tab bar hides on auth, player, and error routes.

## 10. Scroll Behavior

- Header: remains pinned with `backdrop-blur` and subtle bottom border on scroll.
- Rails: horizontal scroll-snap with `scroll-snap-type: x mandatory`.
- Main content: native vertical scroll; no nested scroll containers except rails.
- Player page: no body scroll when player is in fullscreen.
- Drawer open: body scroll locked (`overflow: hidden`).
- Scroll-to-top: floating action button appears after 600px scroll on catalog pages.

## 11. Motion & Animation

- Drawer open/close: 200ms ease-out slide.
- Tab bar tab switch: 150ms crossfade.
- Carousel scroll: native momentum; programmatic scroll uses `smooth`.
- Hero parallax: disabled on mobile (performance).
- Page transitions: 100ms fade (instant feel; no skeleton delay for cached routes).
- Reduced motion: all animations disabled when `prefers-reduced-motion: reduce` is set.

## 12. Loading Experience

- Hero: LQIP placeholder (blurred 20px thumbnail) while full image loads.
- Catalog grids: skeleton cards matching final card dimensions (no layout shift).
- Rails: horizontal skeleton row (6 placeholder cards).
- Detail pages: hero skeleton + two-column skeleton below.
- Player: poster image placeholder until stream manifest loads.
- All skeletons use `--color-surface-elevated` with subtle shimmer.

## 13. Empty States

- Watchlist empty: illustration + "Start adding anime" CTA.
- History empty: illustration + "Your watch history appears here."
- Search empty: "No results for {query}" with suggestion chips.
- Error states: inline retry button; full-page error for route-level failures.
- Empty state typography: page title 22px, body 14px, muted color `--color-text-muted`.

## 14. Error Handling

- Route-level error: full-page fallback with "Go Home" and "Retry" actions.
- Component-level error: error boundary showing section-level fallback; rest of page intact.
- Network failure: toast notification with retry; cached data shown if available.
- Player error: overlay on player with retry and "Report" link.
- All error messages: user-friendly, no stack traces, no technical codes exposed.

## 15. SEO Metadata Requirements

- `<title>`: "{Page Title} — Nexus Anime" (max 60 chars).
- `<meta name="description">`: unique per page (max 155 chars).
- OG tags: `og:title`, `og:description`, `og:image` (1200x630), `og:url`, `og:type`.
- Canonical: self-referencing `<link rel="canonical">` on every page.
- Robots: `index, follow` on public pages; `noindex` on personal pages (Watchlist, History, Settings).
- JSON-LD: `ItemList` on catalog grids; `Episode` on episode lists; `VideoObject` on player pages.
- Alternate: `hreflang` not required (single-language launch).

## 16. Accessibility Requirements

- Touch targets: minimum 44x44px on mobile (WCAG 2.5.8).
- Card tap area: entire card is tappable on mobile (not just the title link).
- Carousel arrows: 44px hit area on mobile; visible focus ring on all interactive elements.
- No horizontal scroll on mobile except carousels (which have arrow affordance and scroll indicators).
- Pinch-to-zoom disabled on the player page (prevents accidental zoom during playback).
- Pinch-to-zoom enabled on detail pages (anime artwork zoom).
- Focus order: logical DOM order; skip-to-content link on every page.
- Color contrast: all text meets WCAG AA (4.5:1 body, 3:1 large text).
- Reduced motion: respected globally; no parallax, no shimmer, no transitions when set.
- Screen readers: rails announced as regions with labels; carousel position announced ("3 of 12").

## 17. Future Enhancements

- Container queries on all card components for true component-level responsiveness (decouples card layout from viewport).
- Adaptive streaming quality selector that adjusts visible quality options by viewport and connection.
- Landscape mobile layout for player (side-by-side controls in landscape orientation).
- Customizable grid density toggle (compact / comfortable / spacious) persisted to user preferences.
- Foldable device support (dual-screen layout for catalog grids on foldables).
