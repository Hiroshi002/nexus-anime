# M6 — Anime Detail

> **Goal:** Deliver the anime detail page as the primary catalog surface where users decide to start, continue, or save a series — with rich metadata, episode browsing, watchlist integration, and structured data for search engines.
> **Spec version:** 1.0.0 · **Last reviewed:** 2026-06-26 · **Owner:** Frontend Lead

---

## 1. Objective

Implement the anime detail page (`/anime/slug/{slug}` and `/anime/{id}`) as a Server Component-driven surface that presents full anime metadata, a hero banner with trailer, an action bar (watch, watchlist toggle, trailer, share), a synopsis panel, an episode list with season tabs, related anime carousels, and a reserved reviews placeholder. The page uses ISR with revalidation, streams sub-resources independently via Suspense boundaries, and emits JSON-LD `TVSeries` structured data plus OG metadata for rich social sharing.

This milestone covers the **UI layer and data wiring only**. The underlying REST endpoints (`/api/v1/anime/{id}`, `/api/v1/anime/slug/{slug}`, `/api/v1/anime/{id}/recommendations`, `/api/v1/anime/{id}/franchise`) are delivered in M2. The watchlist toggle depends on the watchlist Server Action from the M4 companion milestone (User Profiles, Watchlist, Continue-Watching). The "Watch S01 E01" action is a navigation link to the video player route (M6 milestone — the route placeholder exists; actual playback is M6).

---

## 2. Scope

### In scope

- `apps/web/src/app/anime/[id]/page.tsx` — detail by ID route (redirects to slug route)
- `apps/web/src/app/anime/slug/[slug]/page.tsx` — detail by slug route (SEO-friendly canonical)
- `apps/web/src/app/anime/slug/[slug]/layout.tsx` — layout with transparent-to-solid header
- `apps/web/src/components/anime-detail/` — `AnimeDetailPage`, `HeroBanner`, `PlayTrailerButton`, `ActionBar`, `WatchlistToggle`, `ContentGrid`, `SynopsisPanel`, `EpisodePanel`, `SeasonSelector`, `EpisodeTable`, `EpisodeRow`, `RelatedSection`, `ReviewsPlaceholder`
- `apps/web/src/hooks/` — `useAnimeDetail`, `useAnimeBySlug`, `useRelatedAnime`, `useFranchiseEntries`
- `apps/web/src/lib/services/` — anime detail service wrappers calling REST endpoints
- Breadcrumb component (`Home > Catalog > {Title}` or `Home > Catalog > Genre > {Title}`)
- JSON-LD `TVSeries` schema injection
- OG metadata generation from banner image
- ISR with `revalidate: 3600` (1 hour) for catalog data; `revalidate: 60` for episode progress
- Trailer embed (muted autoplay with pause button; expandable on click)
- Season tab state (URL-driven via `?season={name}` query param)
- Responsive: desktop 2/3+1/3 grid, tablet single stack, mobile single column with stacked action bar

### Out of scope

- Homepage (M4)
- Search page (M5)
- Video playback (M6 — the "Watch" button navigates to a route placeholder; actual player is a separate effort)
- User reviews and ratings (v1 silent placeholder only)
- Multiple audio/subtitle track selection
- "Jump to next unwatched" floating action
- Personalized "Because you watched X" recommendation row
- Inline trailer preview that expands from the hero CTA (full-screen modal)
- Stripe / subscription gating on the Watch button (M5)

---

## 3. Deliverables

| # | Deliverable | Location | Acceptance |
| :-- | :-- | :-- | :-- |
| D1 | ID-based detail route with redirect to slug | `apps/web/src/app/anime/[id]/page.tsx` | Fetches anime by ID, redirects to `/anime/slug/{slug}` with 301 |
| D2 | Slug-based detail route | `apps/web/src/app/anime/slug/[slug]/page.tsx` | Fetches anime by slug; renders `AnimeDetailPage`; ISR with `revalidate: 3600` |
| D3 | `AnimeDetailPage` orchestrator | `apps/web/src/components/anime-detail/AnimeDetailPage.tsx` | Composes hero, action bar, content grid, related section, reviews placeholder; manages shared state |
| D4 | `HeroBanner` with parallax backdrop | `src/components/anime-detail/HeroBanner.tsx` | Full-width hero (80vh desktop / 50vh mobile); banner backdrop image; parallax scroll effect; title block (romaji/english/japanese); meta row; genre pills |
| D5 | `PlayTrailerButton` | `src/components/anime-detail/PlayTrailerButton.tsx` | Opens trailer embed; muted autoplay; pause button; expandable to full-screen modal |
| D6 | `ActionBar` | `src/components/anime-detail/ActionBar.tsx` | Primary "Watch S01 E01" button (lg); `WatchlistToggle`; outline "Trailer" button; ghost "Share" button |
| D7 | `WatchlistToggle` | `src/components/anime-detail/WatchlistToggle.tsx` | Toggle button with filled/outline heart icon; Server Action mutation; optimistic update; requires auth (hidden for anonymous) |
| D8 | `ContentGrid` (2/3 + 1/3) | `src/components/anime-detail/ContentGrid.tsx` | Responsive grid: 2/3 synopsis + 1/3 episodes on desktop; single stack on tablet/mobile |
| D9 | `SynopsisPanel` | `src/components/anime-detail/SynopsisPanel.tsx` | Synopsis text; details grid (studio, source, episode count, duration, age rating, season, status) |
| D10 | `EpisodePanel` + `SeasonSelector` + `EpisodeTable` + `EpisodeRow` | `src/components/anime-detail/EpisodePanel.tsx` | Season tabs (URL-driven); episode table with number/title/thumbnail/duration/air date/progress bar; scroll-independent on desktop |
| D11 | `RelatedSection` (Recommendations + Similar) | `src/components/anime-detail/RelatedSection.tsx` | Two carousels: recommendations + similar; horizontal scroll; `AnimeCard` components |
| D12 | `ReviewsPlaceholder` | `src/components/anime-detail/ReviewsPlaceholder.tsx` | Reserved space with "Reviews coming soon" message; non-interactive |
| D13 | Breadcrumb component | `src/components/anime-detail/Breadcrumb.tsx` | `Home > Catalog > {Title}` or genre-based path; structured data `ItemList` |
| D14 | `useAnimeDetail` / `useAnimeBySlug` hooks | `apps/web/src/hooks/` | Fetch anime detail; typed response; error state |
| D15 | `useRelatedAnime` hook | `apps/web/src/hooks/` | Fetch recommendations + similar; cursor pagination |
| D16 | `useFranchiseEntries` hook | `apps/web/src/hooks/` | Fetch franchise relations (prequel/sequel/spinoff) |
| D17 | JSON-LD `TVSeries` schema | `src/components/anime-detail/JsonLd.tsx` | Includes title, description, genre, episode count, rating, duration; validates via Google Rich Results Test |
| D18 | OG metadata + canonical | `src/app/anime/slug/[slug]/page.tsx` | Title `{Romaji Title} — Nexus Anime`; OG from banner; canonical URL; ISR |
| D19 | Season tab URL state | `src/components/anime-detail/SeasonSelector.tsx` | Reads `?season={name}` from URL; updates URL on tab change via `router.replace()`; defaults to current/recent season |
| D20 | Skeleton loaders | `src/components/anime-detail/skeletons/` | Hero skeleton (80vh shimmer); episode row skeleton; dimension-matched; no layout shift |
| D21 | Responsive layout | All components | Desktop: 2/3+1/3 grid; Tablet: single stack; Mobile: single column, stacked action bar |

---

## 4. Prerequisites

Before M6 begins, the following must be complete:

- **M0 — Repository Scaffold:** Turborepo, pnpm workspaces, folder structure, CI pipeline
- **M1 — Project Foundation:** `@nexus/ui` component library with `AnimeCard`, `Button`, `Badge`, `Card`, `Skeleton`, `ErrorBoundary`, `Tabs`, `Toggle` primitives; theme tokens; Tailwind 4
- **M2 — Catalog Foundation:** Anime REST endpoints live — `GET /api/v1/anime/{id}`, `GET /api/v1/anime/slug/{slug}`, `GET /api/v1/anime/{id}/recommendations`, `GET /api/v1/anime/{id}/franchise`, `GET /api/v1/anime/{id}/genres`, `GET /api/v1/anime/{id}/studios`; `@nexus/cache` Redis layer
- **M3 — Auth Complete:** Auth.js v5 session management; `requireUser` helper; watchlist Server Action available (from M4 companion milestone)

---

## 5. Dependencies

### Upstream (must exist before M6 starts)

| Dependency | Type | Source | Contract |
| :-- | :-- | :-- | :-- |
| `GET /api/v1/anime/{id}` | REST endpoint | M2 | Returns full `Anime` record with all metadata fields |
| `GET /api/v1/anime/slug/{slug}` | REST endpoint | M2 | Returns full `Anime` record; 404 on missing slug |
| `GET /api/v1/anime/{id}/recommendations?cursor=&limit=10` | REST endpoint | M2 | Returns `AnimeSummary[]` with cursor pagination |
| `GET /api/v1/anime/{id}/franchise` | REST endpoint | M2 | Returns franchise relations (prequel/sequel/spinoff/side_story/parent) |
| `GET /api/v1/anime/{id}/genres` | REST endpoint | M2 | Returns genre list for the anime |
| `GET /api/v1/anime/{id}/studios` | REST endpoint | M2 | Returns studio list with role (production/licensing/music/animation) |
| `GET /api/v1/watchlist/status?animeId={id}` | REST endpoint | M4 companion | Returns watchlist entry status for authenticated user |
| `POST/DELETE /api/v1/watchlist` | Server Action | M4 companion | Toggle watchlist entry; Zod validation; requireUser |
| `AnimeCard` component | Package | M1 | Reused for related carousels |
| Auth.js session helpers | Library | M3 | `getSession()` for watchlist toggle visibility |

### Downstream (will consume M6)

| Consumer | What they need | Milestone |
| :-- | :-- | :-- |
| M7 — Public Launch | Anime detail must be production-ready | M7 |

### External services

| Service | Purpose | Failure mode |
| :-- | :-- | :-- |
| Upstash Redis | Cache anime detail (TTL 3600s), recommendations (TTL 3600s) | Fallback to direct DB query; serve stale if available |
| TMDB / AniList | Source of anime metadata, banner images, trailer URLs | Pre-seeded data must be available; no live dependency at runtime |
| Vercel Edge | ISR caching (revalidate: 3600s) | First request triggers revalidation; subsequent requests serve cached |
| Cloudflare R2 / Image CDN | Serve banner backdrop and poster images | Fallback to gradient placeholder on image load failure |

---

## 6. Risks

### R1: ISR revalidation staleness for episode progress

**Description:** The anime detail page is ISR-cached for 1 hour. If a user watches an episode and then visits the detail page, the episode progress bar may show stale data from the cache.

**Likelihood:** Medium · **Impact:** Medium (stale progress indication)

**Mitigation:**
- Episode progress is fetched separately via a short-TTL (60s) request or a Server Action, not part of the ISR cache.
- The main anime metadata (title, synopsis, episodes list) is ISR-cached; the progress overlay is a client-side fetch on mount.
- Alternatively, use `revalidateTag` on the anime detail cache when a progress mutation occurs.
- Acceptable: up to 60s staleness for progress bars; not acceptable: stale title or episode list.

### R2: Slug collision and redirect handling

**Description:** Anime titles may not be unique (e.g., "Death Note" TV series vs. movie). If the slug generation is naive, two records could share a slug, causing 404s or wrong-page renders.

**Likelihood:** Low · **Impact:** High (wrong anime displayed)

**Mitigation:**
- Slug generation in the importer appends a year suffix for ambiguous titles (e.g., `death-note-2006`).
- The `GET /api/v1/anime/slug/{slug}` endpoint returns 404 with a `ANIME_NOT_FOUND` error code; the page renders a not-found UI.
- The ID-to-slug redirect (D1) always uses the canonical slug from the database.
- Integration test: verify that every anime in the database has a unique slug.

### R3: Hero banner image load failure

**Description:** The hero banner relies on a large backdrop image from TMDB/R2. If the image fails to load (broken URL, CDN outage), the hero area may render as a broken image or empty space.

**Likelihood:** Medium · **Impact:** Medium (visual degradation)

**Mitigation:**
- `next/image` with a fallback gradient built from `surface-base` to `surface-overlay`.
- The `HeroBanner` component renders the gradient as a background layer beneath the image; if the image fails, the gradient remains visible.
- Set explicit dimensions (80vh desktop / 50vh mobile) so the container does not collapse to 0.
- Error monitoring: log image load failures to track broken URLs.

### R4: Trailer embed autoplay blocked by browser

**Description:** Modern browsers block video autoplay with sound. If the trailer embed includes audio, autoplay may silently fail, and the user sees a static play button instead of the expected muted autoplay.

**Likelihood:** Medium · **Impact:** Low (user must click play manually)

**Mitigation:**
- Trailer embed is explicitly muted (`muted` attribute) and has `playsinline` for mobile.
- If autoplay fails (detected via `onPlay` event not firing within 2s), fall back to showing the play button overlay — this is the expected behavior.
- Never attempt to unmute programmatically; that violates browser autoplay policies.

### R5: Season tab URL state and ISR cache variation

**Description:** If the season tab state is stored in the URL (`?season=fall-2023`), the ISR cache must vary by this parameter to serve the correct default tab. Otherwise, all users see the same season tab regardless of URL.

**Likelihood:** Low · **Impact:** Medium (incorrect default tab)

**Mitigation:**
- The slug route uses `generateStaticParams` with a `dynamic` segment; ISR caches per-slug, not per-query-string.
- Season tab state is read client-side from `useSearchParams()` after hydration, not during SSR/ISR.
- The server renders the page without season context; the client hydrates and reads the URL to set the active tab.
- This means the initial HTML always shows the default season (current/recent), and the client corrects it if a different season is in the URL. This is a minor hydration mismatch but acceptable for a non-critical UI state.

### R6: Watchlist toggle race condition

**Description:** If the user clicks the watchlist toggle rapidly, two mutations may be in flight simultaneously, potentially causing the toggle to flip-flop or show stale state.

**Likelihood:** Low · **Impact:** Low (visual flicker)

**Mitigation:**
- Disable the toggle while a mutation is in flight (optimistic update + loading state).
- Server Action is idempotent: calling `POST /api/v1/watchlist` twice with the same anime ID toggles twice, but the UI state is locked during the first request.
- Use `useTransition` or a local `isPending` state to prevent double-clicks.

---

## 7. Acceptance Criteria

Each criterion is binary pass/fail. All must pass for the milestone to be considered complete.

1. **Slug route renders full anime detail:** Navigating to `/anime/slug/{valid-slug}` returns HTTP 200 with the full anime detail page (hero, action bar, synopsis, episodes, related carousels).
2. **ID route redirects to slug:** Navigating to `/anime/{valid-id}` returns HTTP 301 redirect to `/anime/slug/{canonical-slug}`.
3. **404 for invalid slug:** Navigating to `/anime/slug/nonexistent-slug-12345` returns HTTP 404 with a friendly not-found UI.
4. **Hero banner renders with parallax:** The hero displays the banner backdrop image with a subtle parallax effect on scroll; title block (romaji/english/japanese), meta row, and genre pills are visible.
5. **Trailer play button works:** Clicking the play button opens the trailer embed; video autoplays muted; pause button is visible and functional; expanding to full-screen modal works.
6. **Action bar buttons render correctly:** "Watch S01 E01" primary button (lg), `WatchlistToggle` (hidden for anonymous, visible for authenticated), "Trailer" outline button, "Share" ghost button.
7. **Watchlist toggle works (authenticated):** Clicking the heart icon toggles the watchlist state; optimistic update reflects immediately; Server Action persists to backend; toggle is disabled during mutation.
8. **Watchlist toggle hidden (anonymous):** The watchlist toggle is not rendered for anonymous users; no mutation is attempted.
9. **ContentGrid responsive layout:** Desktop (≥1024px): 2/3 synopsis + 1/3 episodes. Tablet (768–1023px): single stack. Mobile (<768px): single column, stacked action bar.
10. **Episode list with season tabs:** Season tabs switch between seasons; episode rows show number, title, thumbnail, duration, air date, and progress bar; desktop episode list scrolls independently.
11. **Season tab URL state:** Clicking a season tab updates the URL via `router.replace(?season={name})`; reloading the page restores the correct season tab.
12. **Related carousels render:** Recommendations and Similar carousels render with `AnimeCard` components; horizontal scroll works; empty carousels are hidden.
13. **Reviews placeholder renders:** "Reviews coming soon" message is visible in the reserved space; no interactive elements.
14. **Breadcrumb navigation:** Breadcrumb shows `Home > Catalog > {Title}` (or genre path); each segment is a clickable link.
15. **JSON-LD structured data:** `TVSeries` schema is present in the page `<head`; includes title, description, genre, episode count, rating, and duration; validates via Google Rich Results Test.
16. **OG metadata:** Page title is `{Romaji Title} — Nexus Anime`; OG image is the banner backdrop; canonical URL is `/anime/slug/{slug}`.
17. **ISR caching:** The slug route is ISR-cached with `revalidate: 3600s`; second request within the window is served from cache.
18. **Suspense boundaries per section:** Hero, synopsis, episodes, and related carousels are each wrapped in a Suspense boundary; blocking one section's data does not prevent others from rendering.
19. **Skeleton dimensions match loaded content:** No layout shift when skeletons are replaced with actual content. CLS = 0.
20. **Banner image fallback:** When the banner image fails to load, a gradient fallback is visible; the hero container maintains its height.
21. **TypeScript strict compliance:** `pnpm typecheck` passes; no `any` types in `apps/web/src/components/anime-detail/` or `apps/web/src/hooks/`.
22. **Build passes:** `pnpm build` succeeds; no new lint or type errors.
23. **Accessibility:** Muted autoplay trailer has pause button; episode list is a proper list with descriptive row labels; color contrast meets WCAG 2.2 AA; keyboard navigation works for all interactive elements.

---

## 8. QA Checklist

### Functional

- [ ] Slug route renders full anime detail for valid slug
- [ ] ID route redirects to slug route with 301
- [ ] Invalid slug returns 404 with friendly UI
- [ ] Hero banner displays with parallax effect
- [ ] Trailer play button opens embed; autoplay muted works; pause button functional
- [ ] Action bar buttons render and function correctly
- [ ] Watchlist toggle works for authenticated users; hidden for anonymous
- [ ] ContentGrid renders with correct responsive layout
- [ ] Episode list renders with season tabs; switching seasons works
- [ ] Season tab state reflected in URL and survives reload
- [ ] Related carousels render and scroll horizontally
- [ ] Reviews placeholder renders as non-interactive
- [ ] Breadcrumb navigation renders and links correctly
- [ ] JSON-LD validates via Google Rich Results Test
- [ ] OG metadata present and correct
- [ ] ISR caching works (second request served from cache)
- [ ] Suspense boundaries allow partial rendering
- [ ] Banner image fallback works on load failure

### Performance

- [ ] Hero image uses `next/image` with `priority={true}` for LCP
- [ ] TTFB < 800ms on ISR-cached request
- [ ] LCP < 2.5s
- [ ] CLS = 0 (no layout shift on hydration)
- [ ] Episode list scroll is independent on desktop (no jank)
- [ ] Related carousels use lazy loading for off-screen images

### SEO

- [ ] Page title follows `{Romaji Title} — Nexus Anime` format
- [ ] OG image URL present and valid
- [ ] Canonical URL present and correct
- [ ] JSON-LD `TVSeries` validates
- [ ] Breadcrumb `ItemList` structured data present

### Accessibility

- [ ] Muted autoplay trailer has explicit pause button
- [ ] Episode list is a proper list with descriptive row labels
- [ ] All interactive elements keyboard-reachable
- [ ] Color contrast meets WCAG 2.2 AA
- [ ] `prefers-reduced-motion` disables parallax and entrance animations
- [ ] Focus order follows visual layout

### Cross-browser

- [ ] Chrome 125+ (latest)
- [ ] Firefox 126+ (latest)
- [ ] Safari 17+ (latest)
- [ ] Edge 125+ (latest)
- [ ] Mobile Safari (iOS 17)
- [ ] Chrome for Android (latest)

---

## 9. Estimated Tasks

| # | Task | Estimate | Dependencies | Notes |
| :-- | :-- | :-- | :-- | :-- |
| T1 | Scaffold `apps/web/src/components/anime-detail/` directory structure and barrel exports | 0.5d | M1 | |
| T2 | Implement `useAnimeDetail` / `useAnimeBySlug` hooks | 1d | M2 anime endpoints | Typed responses; error state |
| T3 | Implement `useRelatedAnime` hook | 0.5d | M2 recommendations endpoint | Cursor pagination |
| T4 | Implement `useFranchiseEntries` hook | 0.5d | M2 franchise endpoint | |
| T5 | Implement `HeroBanner` with parallax backdrop | 2d | M1 `next/image` | Responsive heights; gradient fallback |
| T6 | Implement `PlayTrailerButton` with muted autoplay + expand | 1.5d | M1 `Button`, `Modal` | Browser autoplay policy handling |
| T7 | Implement `ActionBar` with all buttons | 1d | M1 `Button`, T6 | Responsive stacking on mobile |
| T8 | Implement `WatchlistToggle` with optimistic update | 1d | M4 companion Server Action | Disable during mutation |
| T9 | Implement `ContentGrid` (responsive 2/3 + 1/3) | 0.5d | M1 grid utilities | |
| T10 | Implement `SynopsisPanel` with details grid | 1d | T2 | Studio, source, episode count, etc. |
| T11 | Implement `EpisodePanel` + `SeasonSelector` + `EpisodeTable` + `EpisodeRow` | 2d | T2, M2 episode data | URL-driven season state; independent scroll on desktop |
| T12 | Implement `RelatedSection` with two carousels | 1d | T3, `AnimeCard` | Horizontal scroll; hide on empty |
| T13 | Implement `ReviewsPlaceholder` | 0.25d | — | Static message only |
| T14 | Implement `Breadcrumb` component | 0.5d | — | Home > Catalog > {Title} |
| T15 | Implement skeleton loaders (hero, episode rows) | 1d | M1 `Skeleton` | Dimension-matched; shimmer |
| T16 | Implement `AnimeDetailPage` orchestrator | 1d | T5-T14 | Suspense boundaries per section |
| T17 | Implement ID route with redirect to slug | 0.5d | T2 | 301 redirect |
| T18 | Implement slug route with ISR | 1d | T16, T19 | `revalidate: 3600`; `generateMetadata` |
| T19 | Implement `generateMetadata` + OG + canonical | 0.5d | T2 | Dynamic title, OG image |
| T20 | Implement JSON-LD `TVSeries` schema | 0.5d | T2 | Google Rich Results validated |
| T21 | Implement `JsonLd` component (structured data injection) | 0.25d | — | Reusable pattern |
| T22 | Responsive testing + fixes across 4 breakpoints | 1.5d | T18 | |
| T23 | Accessibility audit + fixes | 1d | T18 | Keyboard nav, ARIA, reduced-motion |
| T24 | Performance audit + fixes (LCP, CLS, TTFB) | 1d | T18 | |
| T25 | Integration tests (ID redirect, 404, watchlist toggle, season tabs) | 1.5d | T18 | |
| T26 | E2E tests (detail page load, trailer, episode navigation) | 1d | T18 | Playwright |
| **Total** | | **~23.5d** | | ~4.5-5 weeks with 1 engineer |

---

## 10. Completion Checklist

- [ ] All 23 acceptance criteria pass
- [ ] All QA checklist items verified
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm build` succeeds
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (unit + integration)
- [ ] E2E tests pass in CI
- [ ] Performance budget met (TTFB, LCP, CLS)
- [ ] Accessibility audit passed (axe-core or Lighthouse)
- [ ] Responsive verified at 380/768/1024/1440
- [ ] Cross-browser verified (Chrome, Firefox, Safari, Edge)
- [ ] JSON-LD validates via Google Rich Results Test
- [ ] OG metadata verified (title, image, canonical)
- [ ] ISR caching works (second request served from cache)
- [ ] ID-to-slug redirect returns 301
- [ ] Invalid slug returns 404
- [ ] Watchlist toggle works for authenticated; hidden for anonymous
- [ ] Season tab URL state survives reload
- [ ] Banner image fallback works on load failure
- [ ] Documentation: component README or Storybook stories for anime detail components
- [ ] PR reviewed and approved by at least one engineer
- [ ] Branch merged to `main` and CI green post-merge
- [ ] No secrets, API keys, or tokens in code
- [ ] No `any` types or `ts-ignore` comments introduced
- [ ] Monitoring: data-fetching functions instrumented with error logging
