# M4 — Homepage

> **Goal:** Deliver the home feed as the primary discovery and re-entry surface for both anonymous and authenticated users.
> **Spec version:** 1.0.0 · **Last reviewed:** 2026-06-26 · **Owner:** Frontend Lead

---

## 1. Objective

Implement the homepage (`/`) as a Server Component-driven feed that adapts to session state. Anonymous users receive a discovery hub (hero carousel, trending, popular, genre navigation, latest releases). Authenticated users receive a personalized view (continue watching, personalized recommendations, trending, latest). All data rails stream independently via Suspense boundaries so a slow endpoint never blocks the page. The anonymous variant is ISR-cached; the variant is SSR-rendered.

This milestone covers the **UI layer and data wiring only**. The underlying REST endpoints (`/api/v1/anime`, `/api/v1/search/suggest`) and the data-fetching services they depend on are out of scope here — they are delivered in M2. Personalized recommendations in this milestone are **basic** (genre-overlap scoring from a cold-start heuristic). A full collaborative-filtering engine is earmarked for post-M5.

---

## 2. Scope

### In scope

- `apps/web/src/app/page.tsx` — route handler that branches on session state
- `apps/web/src/components/home/` — `HomeShell`, `HeroCarousel`, `FeaturedSlide`, `ContinueWatchingRail`, `ProgressCard`, `TrendingRail`, `PopularRail`, `RecommendedRail`, `GenrePills`, `LatestRail`
- `apps/web/src/hooks/` — `useContinueWatching`, `useTrendingAnime`, `usePopularAnime`, `useRecommendedAnime`, `useLatestAnime`
- `apps/web/src/lib/services/` — thin client-side data-fetching wrappers that call the REST endpoints
- Skeleton components matching the exact dimensions of each rail card
- Empty-state components for continue-watching (no history / all completed)
- Error-boundary fallback per rail ("Couldn't load this section. Retry.")
- Metadata generation (`generateMetadata`) for both anonymous and authenticated variants
- JSON-LD `WebSite` schema injection
- Mobile bottom tab bar (Home / Browse / Watchlist / Profile) — integrated from the navigation system built in M1/M3

### Out of scope

- Search page (M5)
- Anime detail page (M6)
- Watchlist management actions (covered in M4 companion spec — User Profiles, Watchlist, Continue-Watching)
- Video playback (M6)
- Stripe / subscription gating (M5)
- Personalized recommendation engine beyond basic genre-overlap heuristic
- "Because you watched X" rail
- Live activity ticker
- Preview clip on card hover

---

## 3. Deliverables

| #   | Deliverable                                  | Location                                                | Acceptance                                                                                                                                                |
| :-- | :------------------------------------------- | :------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Home route page with session-aware branching | `apps/web/src/app/page.tsx`                             | Renders anonymous layout without session; renders authenticated layout with valid session; no `any` types                                                 |
| D2  | `HomeShell` orchestrator component           | `apps/web/src/components/home/HomeShell.tsx`            | Composes all rails; passes session/context to children; exports typed props                                                                               |
| D3  | `HeroCarousel` + `FeaturedSlide`             | `apps/web/src/components/home/HeroCarousel.tsx`         | Auto-rotates every 8s; manual arrows + dots; pause on hover/focus; crossfade 600ms; responsive heights (480/400/320px)                                    |
| D4  | `ContinueWatchingRail` + `ProgressCard`      | `apps/web/src/components/home/ContinueWatchingRail.tsx` | Fetches user progress; renders horizontal progress bar per card; empty state with CTA to `/trending`; hidden when no progress                             |
| D5  | `TrendingRail` with rank overlay             | `apps/web/src/components/home/TrendingRail.tsx`         | Fetches trending anime; renders `AnimeCard` with rank number; "See all" link to `/trending`                                                               |
| D6  | `PopularRail` (anonymous only)               | `apps/web/src/components/home/PopularRail.tsx`          | Fetches popular anime; renders `AnimeCard`; visible only for anonymous users                                                                              |
| D7  | `RecommendedRail` (authenticated only)       | `apps/web/src/components/home/RecommendedRail.tsx`      | Fetches basic recommendations; renders `AnimeCard`; visible only for authenticated users                                                                  |
| D8  | `GenrePills`                                 | `apps/web/src/components/home/GenrePills.tsx`           | Horizontal scroll of 12-16 genre badges; links to `/search?genre=`                                                                                        |
| D9  | `LatestRail`                                 | `apps/web/src/components/home/LatestRail.tsx`           | Fetches latest releases; renders `AnimeCard`; "See all" link to `/latest`                                                                                 |
| D10 | Skeleton loaders per rail                    | `apps/web/src/components/home/skeletons/`               | Dimension-matched skeletons; shimmer animation; no layout shift on hydration                                                                              |
| D11 | Per-rail error fallback                      | `apps/web/src/components/home/RailError.tsx`            | Inline error with retry button; other rails unaffected                                                                                                    |
| D12 | Custom data-fetching hooks                   | `apps/web/src/hooks/`                                   | One hook per rail; typed responses; error state handling; no `any`                                                                                        |
| D13 | Metadata + JSON-LD                           | `apps/web/src/app/page.tsx` (or `layout.tsx`)           | Anonymous: `index, follow`, title "Nexus Anime — Stream the Best Anime". Authenticated: `noindex`, title "Home — Nexus Anime". JSON-LD `WebSite` present. |
| D14 | Mobile bottom tab bar integration            | `apps/web/src/components/navigation/BottomTabBar.tsx`   | Visible <768px; 4 tabs; active state for Home                                                                                                             |

---

## 4. Prerequisites

Before M4 begins, the following must be complete:

- **M0 — Repository Scaffold:** Turborepo, pnpm workspaces, folder structure, CI pipeline
- **M1 — Project Foundation:** `@nexus/ui` component library with `AnimeCard`, `Button`, `Badge`, `Card`, `Skeleton`, `ErrorBoundary` primitives; theme tokens; Tailwind 4 configuration
- **M2 — Catalog Foundation:** Drizzle schema deployed; `/api/v1/anime` endpoints live (list with trending/popular/latest sort, genre filter); `@nexus/cache` Redis layer; error envelope implemented
- **M3 — Auth Complete:** Auth.js v5 session management; `requireUser` / `getSession` helpers; login/logout routes; session context available in Server Components

---

## 5. Dependencies

### Upstream (must exist before M4 starts)

| Dependency                          | Type          | Source       | Contract                                                                                                |
| :---------------------------------- | :------------ | :----------- | :------------------------------------------------------------------------------------------------------ |
| `GET /api/v1/anime`                 | REST endpoint | M2           | Returns `AnimeSummary[]` with cursor pagination; supports `sort=trending\|popular\|latest` query params |
| `GET /api/v1/anime?sort=trending`   | REST endpoint | M2           | Trending list (popularity-weighted, 7-day window)                                                       |
| `GET /api/v1/anime?sort=popular`    | REST endpoint | M2           | All-time popular list                                                                                   |
| `GET /api/v1/anime?sort=latest`     | REST endpoint | M2           | Recently published anime                                                                                |
| `GET /api/v1/anime?genres={id}`     | REST endpoint | M2           | Genre-filtered list (for genre pills)                                                                   |
| `GET /api/v1/watchlist/progress`    | REST endpoint | M3 companion | Continue-watching progress per user (anime_id, episode_id, progress_pct)                                |
| `GET /api/v1/recommendations/basic` | REST endpoint | M3 companion | Basic genre-overlap recommendations per user                                                            |
| Auth.js session helpers             | Library       | M3           | `getSession()` returns `{ userId }` or `null`                                                           |
| `@nexus/ui` primitives              | Package       | M1           | `AnimeCard`, `Button`, `Skeleton`, `ErrorBoundary`, `Badge`                                             |

### Downstream (will consume M4)

| Consumer           | What they need                                                   | Milestone |
| :----------------- | :--------------------------------------------------------------- | :-------- |
| M5 — Search        | `AnimeCard` component, `EmptyState` pattern, skeleton dimensions | M5        |
| M6 — Anime Detail  | `AnimeCard` component, `WatchlistToggle` (shared)                | M6        |
| M7 — Public Launch | Homepage must be production-ready                                | M7        |

### External services

| Service        | Purpose                                               | Failure mode                                                          |
| :------------- | :---------------------------------------------------- | :-------------------------------------------------------------------- |
| Upstash Redis  | Cache trending/popular/latest responses (TTL 60s)     | Fallback to direct DB query; serve stale if available                 |
| Vercel Edge    | ISR caching for anonymous home (revalidate: 300s)     | First request triggers revalidation; subsequent requests serve cached |
| TMDB / AniList | Source of anime metadata (populated via seed scripts) | Pre-seeded data must be available; no live dependency at runtime      |

---

## 6. Risks

### R1: Mixed ISR/SSR streaming complexity

**Description:** The anonymous home is ISR-cached, but the authenticated home is SSR with personalized data. Branching at the route level while maintaining streaming per-rail introduces a risk of cache-key collisions or accidental leakage of personalized data into the ISR cache.

**Likelihood:** Medium · **Impact:** High (data leakage between users)

**Mitigation:**

- Use `cache()` from React for request dedup inside the ISR route only.
- Never call `requireUser()` inside the ISR branch; session-aware content is gated behind a dynamic function (`cookies().get()`) so Next.js marks the route dynamic.
- Set `Vary: Cookie` on the route via `next.config.ts` middleware or route segment config.
- Integration test: verify that two different users hitting the same URL receive different HTML.

### R2: N+1 query in rail data fetching

**Description:** Each rail makes a separate API call. If the service layer naively fetches full anime records for each list, the homepage could issue 5+ independent DB queries on every request.

**Likelihood:** Medium · **Impact:** Medium (page load latency)

**Mitigation:**

- Use `AnimeSummary` projection (no synopsis, no version) for all rails.
- Batch requests via a shared data-fetching function with React `cache()` so overlapping calls (e.g., trending and popular sharing some anime) deduplicate at the DB level.
- Add a `Promise.allSettled` orchestration layer in `HomeShell` so rails load in parallel.
- Performance budget: TTFB < 800ms on anonymous home with cold cache.

### R3: Hero carousel layout shift on slow connections

**Description:** The hero carousel renders a featured slide with a large backdrop image. On slow 3G connections, the carousel container may render at 0 height before the image loads, causing a layout shift that pushes all rails down.

**Likelihood:** Medium · **Impact:** Medium (Core Web Vitals CLS regression)

**Mitigation:**

- Set explicit `width` and `height` on the `FeaturedSlide` image container; use `aspect-ratio: 16/9` or fixed height per breakpoint.
- Render a solid `surface-base` background as placeholder beneath the image.
- Use `next/image` with `priority={true}` for the first slide and `loading="lazy"` for subsequent slides.
- Skeleton state matches the exact hero height at each breakpoint.

### R4: Continue-watching data freshness

**Description:** The continue-watching rail depends on `watch_progress` data that is updated when a user watches an episode. If the cache is not invalidated on progress update, users see stale progress bars.

**Likelihood:** Low · **Impact:** Low (minor UX inconsistency)

**Mitigation:**

- Invalidate `nexus:watchlist:progress:{userId}` on every progress mutation (Server Action).
- Set short TTL (30s) on progress cache to bound staleness.
- Client-side hook revalidates on focus (visibility change) as a safety net.

### R5: Recommendation cold-start for new users

**Description:** Users with no watch history receive an empty `RecommendedRail`, wasting viewport space.

**Likelihood:** High (all new users) · **Impact:** Low (rail can be hidden)

**Mitigation:**

- Hide `RecommendedRail` when the response array is empty.
- Fall back to trending anime if recommendations return < 4 items (configured in the recommendation service).
- Log cold-start rate to track when the heuristic needs improvement.

---

## 7. Acceptance Criteria

Each criterion is binary pass/fail. All must pass for the milestone to be considered complete.

1. **Anonymous home renders without session:** Navigating to `/` without a valid session cookie returns HTTP 200 with the anonymous layout (hero + trending + popular + genre pills + latest). Verified via `curl` and manual browser test.
2. **Authenticated home renders with session:** Navigating to `/` with a valid session cookie returns the authenticated layout (hero + continue watching + trending + recommended + latest). Verified via login flow and manual browser test.
3. **Hero carousel auto-rotates and pauses:** The hero advances every 8s; pauses on hover and focus; manual arrow and dot navigation works at all three breakpoints (380/768/1440).
4. **Continue watching rail is session-gated:** The rail is absent for anonymous users; present with progress data for authenticated users with history; shows the "browse trending" empty-state CTA for authenticated users with no history.
5. **Per-rail streaming:** Each rail is wrapped in a `Suspense` boundary. Blocking one rail's data does not prevent other rails from rendering. Verified by injecting a 5s delay into the trending endpoint and confirming other rails render immediately.
6. **Per-rail error isolation:** Returning HTTP 500 from the trending endpoint does not affect other rails. The failing rail shows the inline "Couldn't load this section. Retry." message.
7. **ISR caching on anonymous home:** The anonymous `/` route is served from ISR cache with `revalidate: 300s`. Second request within the window is served from cache (verified via response header or timing).
8. **No personalized data in ISR cache:** Two different users hitting `/` receive different HTML (verified by comparing response bodies for different sessions).
9. **Skeleton dimensions match loaded content:** No layout shift when skeletons are replaced with actual cards. Verified via Chrome DevTools Performance panel (CLS = 0).
10. **Metadata correctness:** Anonymous home has `<title>Nexus Anime — Stream the Best Anime</title>` and `robots: index, follow`. Authenticated home has `<title>Home — Nexus Anime</title>` and `robots: noindex`. JSON-LD `WebSite` is present in both.
11. **Mobile bottom tab bar:** Visible at <768px with 4 tabs; "Home" is highlighted; tapping other tabs navigates correctly.
12. **Accessibility baseline:** All interactive elements are keyboard-reachable; `aria-label` on cards includes title + episode count + rating; `aria-live="polite"` announces result counts; `prefers-reduced-motion` disables auto-rotate and fade-in animations.
13. **TypeScript strict compliance:** `pnpm typecheck` passes with zero errors; no `any` types introduced in `apps/web/src/components/home/` or `apps/web/src/hooks/`.
14. **Build passes:** `pnpm build` succeeds; no new lint or type errors.
15. **Responsive at all breakpoints:** Page renders correctly at 380px, 768px, 1024px, and 1440px widths without horizontal overflow or broken layouts.

---

## 8. QA Checklist

### Functional

- [ ] Anonymous home loads with all expected rails
- [ ] Authenticated home loads with continue watching and recommendations
- [ ] Hero carousel auto-rotates, pauses on hover/focus, manual navigation works
- [ ] "See all" links navigate to the correct listing pages
- [ ] Genre pills link to `/search?genre={id}`
- [ ] Continue watching progress bars display correct percentage
- [ ] Empty state CTA links are correct (`/trending`, `/latest`)
- [ ] Per-rail retry button recovers from transient errors
- [ ] Mobile bottom tab bar appears and functions at <768px

### Performance

- [ ] TTFB < 800ms on anonymous home (cold cache, measured via WebPageTest)
- [ ] TTFB < 1200ms on authenticated home (cold cache)
- [ ] LCP < 2.5s (hero image is `priority`)
- [ ] CLS = 0 (no layout shift on hydration)
- [ ] No more than 5 API requests triggered by the homepage load
- [ ] ISR cache hit ratio > 90% after warm-up

### SEO

- [ ] `<title>` correct for anonymous and authenticated variants
- [ ] `robots` meta tag correct for each variant
- [ ] OG image URL present and valid
- [ ] Canonical URL present
- [ ] JSON-LD `WebSchema` validates via Google Rich Results Test

### Accessibility

- [ ] Skip-to-content link is the first focusable element
- [ ] All cards reachable via Tab; Enter activates card link
- [ ] Suggestions dropdown supports arrow keys + Escape
- [ ] `prefers-reduced-motion` disables animations
- [ ] Color contrast meets WCAG 2.2 AA at all breakpoints

### Cross-browser

- [ ] Chrome 125+ (latest)
- [ ] Firefox 126+ (latest)
- [ ] Safari 17+ (latest)
- [ ] Edge 125+ (latest)
- [ ] Mobile Safari (iOS 17)
- [ ] Chrome for Android (latest)

---

## 9. Estimated Tasks

| #         | Task                                                                                             | Estimate   | Dependencies          | Notes                                             |
| :-------- | :----------------------------------------------------------------------------------------------- | :--------- | :-------------------- | :------------------------------------------------ |
| T1        | Scaffold `apps/web/src/components/home/` directory structure and barrel exports                  | 0.5d       | M1                    |                                                   |
| T2        | Implement `AnimeCard` rank overlay variant (if not already in `@nexus/ui`)                       | 0.5d       | M1                    | May already exist from M1; verify first           |
| T3        | Implement `HeroCarousel` + `FeaturedSlide` with responsive heights, auto-rotate, manual controls | 2d         | T1, T2                | Includes motion, pause-on-hover, dot indicators   |
| T4        | Implement skeleton components per rail (card-shaped, shimmer)                                    | 1d         | T1                    | Match exact dimensions of `AnimeCard`             |
| T5        | Implement `RailError` fallback component with retry button                                       | 0.5d       | T1                    |                                                   |
| T6        | Implement `useTrendingAnime`, `usePopularAnime`, `useLatestAnime` hooks                          | 1d         | M2 endpoints          | Thin wrappers around `fetch` with typed responses |
| T7        | Implement `useContinueWatching` hook + `ContinueWatchingRail` + `ProgressCard`                   | 1.5d       | M3 companion endpoint | Includes empty-state logic                        |
| T8        | Implement `useRecommendedAnime` hook + `RecommendedRail`                                         | 1d         | M3 companion endpoint | Cold-start fallback logic                         |
| T9        | Implement `GenrePills` with genre list fetch                                                     | 0.5d       | M2 genre endpoint     |                                                   |
| T10       | Implement `HomeShell` orchestrator with parallel `Promise.allSettled` rail loading               | 1d         | T3-T9                 |                                                   |
| T11       | Implement `page.tsx` with session-aware branching (anonymous vs. authenticated)                  | 1d         | T10, M3               |                                                   |
| T12       | Implement `generateMetadata` for both variants + JSON-LD injection                               | 0.5d       | T11                   |                                                   |
| T13       | Integrate mobile bottom tab bar (verify or implement from navigation)                            | 0.5d       | M1 navigation         | May already exist; verify                         |
| T14       | Wire per-rail Suspense boundaries and verify streaming behavior                                  | 0.5d       | T10, T11              |                                                   |
| T15       | Implement empty states (continue watching: no history / all completed)                           | 0.5d       | T7                    |                                                   |
| T16       | Responsive testing + fixes across 4 breakpoints                                                  | 1d         | T11                   |                                                   |
| T17       | Accessibility audit + fixes (keyboard nav, ARIA, reduced-motion)                                 | 1d         | T11                   |                                                   |
| T18       | Performance audit + fixes (CLS, LCP, TTFB)                                                       | 1d         | T11                   |                                                   |
| T19       | Integration tests (per-rail error isolation, session branching)                                  | 1d         | T11                   |                                                   |
| T20       | E2E test (anonymous home, authenticated home, hero rotation)                                     | 1d         | T11                   | Playwright                                        |
| **Total** |                                                                                                  | **~16.5d** |                       | ~3.5 weeks with 1 engineer                        |

---

## 10. Completion Checklist

- [ ] All 14 acceptance criteria pass
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
- [ ] Documentation: component README or Storybook stories for each home component
- [ ] PR reviewed and approved by at least one engineer
- [ ] Branch merged to `main` and CI green post-merge
- [ ] No secrets, API keys, or tokens in code
- [ ] No `any` types or `ts-ignore` comments introduced
- [ ] Monitoring: key data-fetching functions instrumented with error logging
