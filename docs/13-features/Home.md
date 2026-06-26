# Home — Nexus Anime

> **Audience:** Engineers implementing the home feed. The authenticated-aware home is the most-visited page on the platform and must perform well for both anonymous discovery and personalized authenticated experiences.
> **Milestone:** M3 / M4 (M3 delivers heuristic-based personalized rails; M4 adds collaborative filtering)
> **Owner:** Engineering
> **Status:** Draft

---

## 1. Purpose

Serve as the primary landing surface after authentication. The home page adapts to session state: anonymous users see a discovery-focused layout (trending, popular, latest), while authenticated users see a personalized layout (continue watching, recommended, trending). The goal is to reduce time-to-first-play for authenticated users and maximize catalog discovery for anonymous visitors.

## 2. Business Goals

- **Engagement:** Increase session depth — every session should surface at least one play-worthy title within 3 seconds. Target: pages-per-session + 20% vs. non-personalized baseline.
- **Retention:** "Continue watching" rail reduces friction to resume. Target: 60% of returning users with in-progress anime click "Resume" within the first session.
- **Conversion:** Anonymous home showcases catalog depth to drive signup. Target: anonymous-to-registered conversion + 10%.
- **Content discovery:** Trending, popular, and latest rails ensure new and niche anime surface alongside mainstream titles. Target: unique anime viewed per session + 15%.
- **Performance:** Home is the first page most users see; LCP directly impacts bounce rate. Target: LCP < 2.0s on 4G.

## 3. Functional Requirements

### 3.1 Happy Path

1. Anonymous visitor navigates to `/`. System renders ISR cached home with hero carousel, trending rail, popular rail, genre pills, and latest rail. User browses and clicks any anime card.
2. Authenticated user navigates to `/`. System renders SSR home with hero personalized to their taste, continue watching rail (most recently watched, progress bars), trending rail, recommended rail, and latest rail. User clicks "Resume" on a continue-watching card and is taken to the next unwatched episode.
3. User clicks "See all →" on any rail. System navigates to the corresponding page (`/trending`, `/popular`, `/latest`, `/recommendations`).
4. User clicks a genre pill. System navigates to `/genres/{genre}` with pre-filtered results.
5. Hero carousel auto-rotates every 8 seconds. User clicks arrow or dot indicator to navigate manually. On last slide, next arrow wraps to first slide.
6. User hovers over an anime card. Card scales slightly and reveals watchlist toggle (authenticated) or nothing (anonymous).

### 3.2 Alternate Flows

1. **Authenticated user with no watch history:** Continue watching rail is replaced with "Start watching" empty-state CTA linking to `/trending`.
2. **Authenticated user who finished all in-progress anime:** Continue watching rail shows "All caught up!" with link to `/latest`.
3. **Partial rail failure:** If one rail fails to load (e.g., trending service timeout), the other rails render normally. Failed rail shows an inline "Couldn't load this section. Retry." message with a retry button.
4. **Hero carousel failure:** If the hero data endpoint fails, render a static featured anime banner (no carousel, no rotation) with a "Watch now" CTA.
5. **Authenticated user on a fresh account:** Personalized rails fall back to trending + popular until the user has at least 5 watch events (heuristic minimum).
6. **Anonymous user clicks "Watch" on hero:** System redirects to `/signup?returnTo=/anime/{id}` — user signs up, returns to anime detail.

### 3.3 Edge Cases

1. **New user with zero history (authenticated):** Personalization engine returns an empty recommendation list. System substitutes trending + popular rails in place of the recommendation rail. Continue watching rail is hidden.
2. **User finished every in-progress anime:** `ContinueWatchingRail` receives an empty list. System renders "All caught up! Browse what's new" CTA linking to `/latest`.
3. **Partial rail failure (one of six rails times out):** Other five rails render normally. The failed rail's slot shows an inline retry card ("Couldn't load this section. Retry."). Does not block the page.
4. **Hero carousel API returns empty list:** Render a static featured anime (configured via `FEATURED_ANIME_ID` env var or admin CMS). No carousel controls shown.
5. **Authenticated user with expired session:** SSR detects no session, falls back to anonymous ISR layout. User sees discovery feed (not a redirect — avoids jarring bounce).
6. **Rail contains anime that has been soft-deleted:** Repository filters `deleted_at IS NULL`. If all rail items are filtered, treat as empty rail (hide or show fallback).
7. **Continue watching cursor is on a region-locked episode:** If the next episode is not available in the user's region system skips to the next available anime in the rail.
8. **User on slow 3G connection:** Suspense boundaries stream individual rails as data arrives. Hero renders immediately (static fallback), each rail shows skeleton until data loads.
9. **Rail contains duplicate anime (e.g., same anime in trending and popular):** Deduplication is NOT applied — seeing the same anime in multiple rails is acceptable (different contexts). However, the continue-watching rail is always de-duplicated against itself.
10. **Authenticated user with 50+ continue-watching entries:** Rail is capped at 20 items. Sorting: most recently updated first.

## 4. Non-Functional Requirements

- **Performance:** Full page render (all rails populated) p95 < 500ms server-side. LCP < 2.0s on 4G. FID < 100ms.
- **Availability:** 99.9% for home page. Partial degradation (individual rail failure) is acceptable.
- **Scalability:** 100k monthly visitors by end of M3; 1M by M5. ISR (anonymous) absorbs most traffic; SSR is only for authenticated users (~30% of traffic).
- **Accessibility:** WCAG 2.2 AA. Hero carousel is keyboard-navigable. All cards have descriptive `aria-label`. Reduced motion disables auto-rotate and stagger animations.
- **Localization:** All user-facing strings externalized. Anime titles displayed in user's locale (falls back to romaji if no locale match).
- **Security:** No sensitive data in ISR props. Authenticated rails are never cached. CSRF tokens present on any inline forms (watchlist toggle).

## 5. User Stories

- As a **visitor**, I want to see trending and popular anime immediately so that I can decide what to watch without signing up.
- As a **logged-in user**, I want to resume my anime from the home page so that I do not have to search for where I left off.
- As a **logged-in user**, I want to see anime recommended for my taste so that I discover new titles without browsing the entire catalog.
- As a **returning user**, I want the home page to reflect my latest watch progress so that I always see fresh content.
- As a **new user**, I want to see a curated selection of anime so that I feel the catalog has depth and variety worth signing up for.

## 6. Acceptance Criteria

- [ ] Anonymous user sees hero carousel, trending, popular, genre pills, and latest rails.
- [ ] Authenticated user sees hero, continue watching, trending, recommended, and latest rails.
- [ ] Continue watching rail shows progress bars and "Resume" buttons for in-progress anime.
- [ ] Clicking "See all →" on any rail navigates to the corresponding page.
- [ ] Hero auto-rotates every 8 seconds; manual arrows and dots work; wraps around.
- [ ] Partial rail failure renders other rails normally with inline retry for the failed rail.
- [ ] Authenticated user with no history sees trending + popular in place of continue watching + recommendations.
- [ ] Page passes `pnpm typecheck` with strict mode.
- [ ] LCP < 2.0s on simulated 4G in Lighthouse.
- [ ] ISR cache for anonymous home revalidates every 300 seconds.
- [ ] All interactive elements are keyboard-accessible; focus ring visible.
- [ ] `prefers-reduced-motion` disables auto-rotate and stagger animations.

## 7. UI Components

| Component | Responsibility | Reusable? | Package |
|-----------|---------------|-----------|---------|
| `HomeShell` | Page layout branching (anonymous vs. authenticated) | No | `apps/web` |
| `HeroCarousel` | Auto-rotating featured anime slides with manual controls | Yes | `apps/web` |
| `FeaturedSlide` | Single hero slide (backdrop, title, meta, CTAs) | Yes | `apps/web` |
| `ContinueWatchingRail` | Horizontal rail of in-progress anime with progress bars | No | `apps/web` |
| `ProgressCard` | Thumbnail + title + progress bar + "Resume" button | Yes | `apps/web` |
| `TrendingRail` | Horizontal rail of trending anime with rank numbers | No | `apps/web` |
| `PopularRail` | Horizontal rail of popular anime | No | `apps/web` |
| `RecommendedRail` | Horizontal rail of personalized recommendations | No | `apps/web` |
| `LatestRail` | Horizontal rail of recently released anime | No | `apps/web` |
| `GenrePills` | Horizontal scrollable row of genre filter badges | Yes | `apps/web` |
| `AnimeCard` | Poster + title + meta, used inside rails | Yes | `@nexus/ui` |
| `RailHeader` | Rail title + "See all →" link | Yes | `@nexus/ui` |
| `RailSkeleton` | Placeholder skeleton matching rail layout | Yes | `@nexus/ui` |
| `HeroSkeleton` | Placeholder skeleton for hero section | Yes | `@nexus/ui` |

## 8. API Dependencies

| Endpoint | Method | Auth Required | Rate Limit | Cache |
|----------|--------|---------------|------------|-------|
| `/api/home/feed` | GET | No (anonymous ISR) | 100/min per IP | ISR 300s |
| `/api/home/continue-watching` | GET | Yes | 60/min per user | None (SSR) |
| `/api/anime/trending` | GET | No | 100/min per IP | ISR 300s |
| `/api/anime/popular` | GET | No | 100/min per IP | ISR 900s |
| `/api/anime/latest` | GET | No | 100/min per IP | ISR 300s |
| `/api/recommendations` | GET | Yes | 60/min per user | None (SSR) |
| `/api/home/hero` | GET | No | 100/min per IP | ISR 300s |

## 9. Database Dependencies

| Table / View | Operation | Index / Query Notes |
|--------------|-----------|---------------------|
| `anime` | SELECT | Indexed on `id`, `trending_score`, `popularity_score`, `release_date` |
| `episodes` | SELECT | Indexed on `(anime_id, episode_number)` for next-episode lookup |
| `watch_history` | SELECT | Indexed on `(user_id, updated_at)` for continue-watching query |
| `watchlist` | SELECT | Indexed on `user_id` for personalized recommendation input |
| `users` | SELECT | `id` for session lookup |

## 10. Edge Cases

1. **New user with zero history (authenticated):** Personalization engine returns empty recommendations. System substitutes trending + popular in place of the recommendation rail. Continue watching rail is hidden. User sees a discovery-heavy layout identical to anonymous but with personalized hero.
2. **User finished every in-progress anime:** `watch_history` query returns no rows with `progress_pct > 0 AND progress_pct < 100`. Continue watching rail is hidden. System renders "All caught up! Browse what's new" CTA linking to `/latest`.
3. **Partial rail failure (one of six rails times out):** Other five rails render normally. The failed rail's slot shows an inline retry card ("Couldn't load this section. Retry."). Does not block the page. Error is logged to Sentry with rail context.
4. **Hero carousel API returns empty list:** Render a static featured anime (configured via `FEATURED_ANIME_ID` env var or admin CMS). No carousel controls shown. Logged as a warning.
5. **Authenticated user with expired session:** SSR detects no session, falls back to anonymous ISR layout. User sees discovery feed (not a redirect — avoids jarring bounce). Client-side `useEffect` silently refreshes session state.
6. **Rail contains anime that has been soft-deleted:** Repository filters `deleted_at IS NULL`. If all rail items are filtered, treat as empty rail (hide the section). If some items remain, render only the valid ones.
7. **Continue watching cursor is on a region-locked episode:** Geo-check via `x-geo-country` header. If the next episode is not available in the user's region, skip to the next anime in the rail. Log the skip event.
8. **User on slow 3G connection:** Suspense boundaries stream individual rails as data arrives. Hero renders immediately (static fallback), each rail shows skeleton until data loads. No layout shift (skeletons match real dimensions).
9. **Rail contains duplicate anime (e.g., same anime in trending and popular):** Deduplication is NOT applied — seeing the same anime in multiple rails is acceptable (different contexts). However, the continue-watching rail is always de-duplicated against itself.
10. **Authenticated user with 50+ continue-watching entries:** Rail is capped at 20 items. Sorting: most recently updated first. "See all →" links to `/watch-history` for the full list.
11. **Anonymous user clicks "Watch" on hero slide:** System redirects to `/signup?returnTo=/anime/{id}`. After signup, user is returned to the anime detail page.
12. **ISR cache invalidation after new episode release:** `/api/anime/latest` ISR revalidates every 300s. New episodes appear within 5 minutes of database insert without manual purge.

## 11. Error Handling

| Error Condition | User-Facing Message | Recovery Action | Log Level |
|-----------------|---------------------|-----------------|-----------|
| Hero API failure | Static featured banner (no carousel) | Render fallback | warn |
| Single rail API failure | "Couldn't load this section. Retry." | Inline retry button | warn |
| All rails API failure | Page-level error with "Try again" button | Full page retry | error |
| Session expired (SSR) | Anonymous layout rendered | Silent fallback, no user action | info |
| Personalization service timeout | Trending + popular substituted | Render fallback rails | warn |
| Continue watching query timeout | Rail hidden | Render other rails | warn |

## 12. Analytics Events

| Event Name | Trigger | Properties | Surface |
|------------|---------|------------|---------|
| `home_page_view` | Page loads | `{ is_authenticated, rail_count }` | Server |
| `home_hero_click` | User clicks hero CTA | `{ anime_id, action: 'watch' | 'watchlist', slide_index }` | Client |
| `home_hero_slide_view` | Hero slide visible for > 2s | `{ anime_id, slide_index }` | Client |
| `home_rail_see_all_click` | User clicks "See all →" | `{ rail_type: 'trending' | 'popular' | 'latest' | 'recommended' | 'continue' }` | Client |
| `home_rail_card_click` | User clicks anime card in rail | `{ anime_id, rail_type, position }` | Client |
| `home_continue_resume_click` | User clicks "Resume" on continue watching | `{ anime_id, episode_id, progress_pct }` | Client |
| `home_genre_pill_click` | User clicks genre pill | `{ genre_slug }` | Client |
| `home_rail_retry` | User clicks retry on failed rail | `{ rail_type }` | Client |
| `home_signup_ct_click` | Anonymous user clicks signup CTA | `{ source: 'hero' | 'rail' | 'genre' }` | Client |

## 13. Security Considerations

- **No sensitive data in ISR props:** Anonymous home is cached at the edge; no user-specific data in the ISR response. Authenticated rails are fetched client-side or via SSR.
- **Session token not exposed to client:** Session cookie is `HttpOnly`; client-side code reads session state only via NextAuth's `useSession()` (which gets data from a secure `/api/auth/session` endpoint).
- **Watchlist toggle CSRF protection:** Inline watchlist toggle (authenticated) is a Server Action with CSRF token validation.
- **Rate limiting per authenticated user:** `/api/home/continue-watching` and `/api/recommendations` are rate-limited per user ID to prevent abuse.
- **Geo data not trusted for auth:** `x-geo-country` header is used for content recommendations only, not for authentication or authorization decisions.

## 14. Performance Requirements

- **LCP:** < 2.0s on simulated 4G (hero image loads eagerly as LCP candidate).
- **FID:** < 100ms (no long tasks blocking the main thread during hydration).
- **CLS:** < 0.1 (skeleton placeholders match final dimensions; no layout shift on rail load).
- **Server render time:** p95 < 500ms for authenticated SSR (all rails populated).
- **ISR revalidate:** 300s for anonymous home; stale-while-revalidate at edge.
- **Rendering strategy:** ISR for anonymous (cached at edge, revalidates every 300s). SSR for authenticated (personalized per request). Suspense boundaries stream individual rails.
- **Bundle-size budget:** Home page client JS < 80kB gzipped (hero carousel + rail scroll logic + card interactions).

## 15. Future Improvements

1. **Collaborative filtering recommendations** — Replace heuristic-based recommendations with a collaborative filtering model trained on watch history and watchlist overlap.
2. **Personalized hero** — Select the hero featured anime from the user's recommendation pool instead of a global featured set.
3. **"Because you watched X" rail** — Item-to-item similarity rail showing anime similar to a specific recently watched title.
4. **Live activity ticker** — Real-time counter ("5,200 people watching right now") using Server-Sent Events or a lightweight polling mechanism.
5. **Preview clip on card hover** — 15-second muted trailer auto-plays on hover (desktop only) to increase engagement.
6. **Quick-add watchlist button on card hover** — One-click watchlist toggle without navigating to detail page.
7. **A/B testable rail ordering** — Allow product to reorder rails per user cohort without code deployment.
8. **Offline continue-watching sync** — Queue watch-progress updates locally and sync when connectivity returns.
