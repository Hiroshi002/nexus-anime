# Home — Nexus Anime

> **Audience:** Engineers implementing the home feed. The authenticated-aware home is the most-visited page on the platform.

---

## 1. Purpose

Surface personalized and trending content to the user based on their session state. For anonymous users, behave as a discovery hub. For logged-in users, prioritize "continue watching" and personalized recommendations.

## 2. User Goals

- **Anonymous:** Discover what to watch, browse trending, decide if the catalog has their anime.
- **Logged-in:** Resume watching immediately, discover new anime aligned with taste, manage watchlist proximity.

## 3. Entry Points

- Logo click in header
- Logo click in sidebar
- Redirect after login
- Browser home bookmark
- Push notification deep link

## 4. Layout Structure

### Anonymous Home

```
┌──────────────────────────────────────────────┐
│ HEADER (public)                              │
├──────────────────────────────────────────────┤
│ HERO CAROUSEL (featured anime, auto-rotate)  │
├──────────────────────────────────────────────┤
│ TRENDING THIS WEEK        See all →          │
│ [AnimeCard] [AnimeCard] [AnimeCard] (...)    │
├──────────────────────────────────────────────┤
│ POPULAR ALL TIME          See all →          │
├──────────────────────────────────────────────┤
│ GENRE QUICK LINKS (pill row)                 │
├──────────────────────────────────────────────┤
│ LATEST RELEASES           See all →          │
├──────────────────────────────────────────────┤
│ FOOTER                                       │
└──────────────────────────────────────────────┘
```

### Authenticated Home

```
┌────────────────────┬─────────────────────────┐
│ SIDEBAR            │ HEADER                  │
├────────────────────┼─────────────────────────┤
│                    │ HERO (featured or rec.) │
│                    ├─────────────────────────┤
│                    │ CONTINUE WATCHING       │
│                    │ [ProgressCard] [...]   │
│                    ├─────────────────────────┤
│                    │ TRENDING                │
│                    ├─────────────────────────┤
│                    │ RECOMMENDED FOR YOU     │
│                    ├─────────────────────────┤
│                    │ LATEST                  │
│                    ├─────────────────────────┤
│                    │ FOOTER                  │
└────────────────────┴─────────────────────────┘
```

## 5. Component Hierarchy

- `HomeShell`
  - `HeroCarousel` (auto-rotating featured cards)
    - `FeaturedSlide` (banner backdrop + meta + Watch Now / Watchlist CTA)
  - `ContinueWatchingRail` (authenticated only)
    - `ProgressCard` (thumbnail + title + progress bar + "Resume" button)
  - `TrendingRail`
    - `AnimeCard` with rank number overlay
  - `PopularRail` (anonymous only — surface popular instead of trending to widen discovery)
  - `RecommendedRail` (authenticated only)
    - `AnimeCard`
  - `GenrePills` (horizontal scroll of genre badges)
  - `LatestRail`
    - `AnimeCard`

## 6. Desktop Layout (≥1024px)

- Hero carousel: full-width (max 1400px container), 480px height, auto-rotate every 8s with manual arrows + dot indicators.
- Rails: 6 visible cards, horizontal scroll with fade edges, "See all →" button top-right.
- Continue Watching rail: 5 visible cards with horizontal progress bar below each thumbnail.
- Genre pills: horizontal scroll, 12-16 pills, 32px height each.

## 7. Tablet Layout (768–1023px)

- Hero: 400px height.
- Rails: 4 visible cards.
- Continue Watching: 4 visible cards.

## 8. Mobile Layout (<768px)

- Hero: 320px height, manual swipe only (no auto-rotate).
- Rails: 1.5 visible cards (peek), vertical stack.
- Continue Watching: vertical stack with full-width progress cards.
- Genre pills: 2-row wrap instead of horizontal scroll.
- Bottom tab bar visible: Home | Browse | Watchlist | Profile (mobile-only).

## 9. Navigation Behavior

Sticky header as defined in Navigation. Active state: "Home" highlighted in sidebar.

## 10. Scroll Behavior

- Hero: fixed position within viewport on scroll, content scrolls over.
- Rails: horizontal-only scroll, doesn't consume vertical scroll.
- Page: standard vertical scroll.
- Scroll restoration: Next.js restores scroll on browser back/forward.
- Infinite scroll: not applicable — each rail is a self-contained carousel.

## 11. Motion & Animation

- Hero slide transition: crossfade 600ms ease-in-out.
- Hero slide entry: title fade-up 500ms spring, subtitle stagger 100ms, CTA stagger 200ms.
- Rail cards: fade-in on scroll 400ms spring, stagger 60ms per card.
- Hover on cards: scale 1.03 + shadow-md elevation + title underline highlight, 200ms spring.
- Progress card hover: play icon overlay fade-in 150ms.
- Auto-rotate pause on hover or focus.

## 12. Loading Experience

- Page uses ISR (anonymous) with `revalidate: 300s`.
- SSR for authenticated.
- Streaming: hero renders immediately with sailor hero, rails stream in via `Suspense` boundary + skeleton.
- Skeleton: hero placeholder (480px dark block), rail placeholders (6 card-shaped skeletons in a row).

## 13. Empty States

- **Continue Watching (authenticated, no history):** Render empty illustration + "Nothing to resume — browse trending" CTA → `/trending`.
- **Continue Watching (authenticated, all completed):** Show "All caught up! Browse what's new" CTA → `/latest`.
- **Rails empty (rare):** Hide the rail entirely, no empty state for a single rail.

## 14. Error Handling

- If one rail fails, others still render. Failed rail shows "Couldn't load this section. Retry." inline with a retry button.
- If hero fails, render static featured image from featured anime with no carousel.
- Root error boundary catches fatal errors.

## 15. SEO Metadata Requirements

- Anonymous home title: `Nexus Anime — Stream the Best Anime`
- Authenticated home title: `Home — Nexus Anime`
- Description: `Stream thousands of anime episodes in HD. Discover new favorites, track your watchlist, and pick up where you left off.`
- OG image: `/og/home.jpg`.
- Canonical: `https://nexusanime.com/`.
- Robots: `index, follow` for anonymous, `noindex` for authenticated.
- JSON-LD: `WebSite` schema.

## 16. Accessibility Requirements

- Skip-to-content link as first focused element.
- Hero carousel: `role="region"`, `aria-label="Featured anime"`; pause button with `aria-label="Pause auto-rotation"`; dot indicators are buttons with `aria-label="Go to slide N"`.
- "See all →" links have `aria-label="See all trending anime"` etc.
- Rail scrolling: arrow buttons keyboard-accessible.
- Cards are `<a>` with descriptive `aria-label` including title + episode count + rating.
- Reduced motion: no carousel auto-rotate, no fade-in-on-scroll, no hover scale.

## 17. Future Enhancements

- Personalized hero (one featured anime aligned with taste).
- "Because you watched X" rail.
- Live activity ticker ("5,200 people watching right now").
- Preview clip on card hover (15s muted trailer).
- Quick-add watchlist button on card hover.
