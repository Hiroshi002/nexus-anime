# M2 — Core Layout

## Objective

Build the application shell, navigation structure, and responsive layout system that every page in Nexus Anime inherits from. This milestone delivers the root layout, route groups, sidebar, header, footer, loading states, error boundaries, and the ISR/SSR strategy for catalog routes. At the end of M2, the application has a functional app shell with navigation, handles loading and error states gracefully, and renders catalog data from the database with proper caching.

## Scope

- Root layout (`apps/web/app/layout.tsx`) — HTML shell, metadata, theme provider, global providers
- Route groups: `(public)`, `(authenticated)`, `(auth)`, `(api)` — logical organization and middleware targeting
- Sidebar navigation — desktop side rail, mobile bottom tab bar, active link detection
- Header — logo, search trigger, theme toggle, user menu slot
- Footer — minimal footer with links (about, terms, privacy)
- Responsive layout system — mobile-first, 6 breakpoints, container queries
- Loading states — `loading.tsx` per route group, skeleton fallbacks, streaming with Suspense
- Error boundaries — `error.tsx` per route group, `not-found.tsx`, global error handler
- API envelope — `{ data }` / `{ error: { message, code, details } }` response shape
- Error code registry — typed `ApiError` with standard error codes
- Database integration — Drizzle ORM setup, `@nexus/db` package, Neon connection
- Cache integration — Upstash Redis setup, `@nexus/cache` package, cache key schema
- Catalog routes — anime detail (`[id]`), season list, episode list with ISR
- Redirects and rewrites in `next.config.ts` for legacy URLs

Out of scope: authentication flows (M3), user profiles (M4), payments (M5), video streaming (M6).

## Deliverables

### D1 — Root Layout and Shell

`apps/web/app/layout.tsx` — the root layout that:
- Sets `<html lang="en" data-theme="midnight">` and applies global CSS
- Wraps the app in `ThemeProvider` (from `@nexus/ui`)
- Renders the sidebar, header, and main content area
- Applies `generateMetadata()` for default SEO (title template, OG description, Twitter card)
- Imports `globals.css` from `@nexus/ui`

### D2 — Route Groups

- `apps/web/app/(public)/` — publicly accessible routes (home, anime detail, search, about, terms)
- `apps/web/app/(authenticated)/` — routes requiring auth (profile, watchlist, continue-watching); empty placeholder until M3
- `apps/web/app/(auth)/` — auth pages (login, signup, verify, forgot-password); empty placeholder until M3
- `apps/web/app/(api)/` — API route handlers (health, webhooks); stub only until M5/M6

### D3 — Navigation Components

- `apps/web/src/components/layout/Sidebar.tsx` — desktop side rail with nav links, collapsible on mobile to bottom tab bar
- `apps/web/src/components/layout/Header.tsx` — top bar with logo, search trigger, theme toggle, user menu slot
- `apps/web/src/components/layout/Footer.tsx` — minimal footer with links
- `apps/web/src/components/layout/MobileTabBar.tsx` — bottom tab bar for mobile (5 items max)
- `apps/web/src/components/layout/NavLink.tsx` — active link detection with `usePathname()`

### D4 — Responsive Layout System

- `apps/web/src/components/layout/Container.tsx` — max-width 1200px, responsive padding
- `apps/web/src/components/layout/Grid.tsx` — 12-column fluid grid wrapper
- `apps/web/src/hooks/useBreakpoint.ts` — hook returning current breakpoint based on `matchMedia`
- CSS container queries enabled via `@container` in component styles

### D5 — Loading States

- `apps/web/app/loading.tsx` — root loading skeleton (sidebar skeleton, header skeleton, content skeleton)
- `apps/web/app/(public)/loading.tsx` — public route loading state
- `apps/web/app/[id]/loading.tsx` — anime detail loading state with poster + metadata skeleton
- `apps/web/src/components/ui/Skeleton.tsx` — re-exported from `@nexus/ui` with app-specific compositions

### D6 — Error Boundaries

- `apps/web/app/error.tsx` — root error boundary with friendly message and "try again" button
- `apps/web/app/not-found.tsx` — 404 page with search suggestion and back-to-home link
- `apps/web/app/(public)/error.tsx` — public route error boundary
- `apps/web/app/[id]/error.tsx` — anime detail error boundary with related anime fallback
- `apps/web/src/components/ui/ErrorBoundary.tsx` — reusable error boundary component (client component)

### D7 — API Envelope and Error Codes

- `apps/web/src/lib/api/envelope.ts` — `success(data)` and `error(message, code, details)` helpers
- `apps/web/src/lib/api/errors.ts` — `ApiError` class with `message`, `code`, `details` and standard codes: `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR`, `RATE_LIMITED`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`
- `apps/web/src/lib/api/validate.ts` — Zod validation helper that returns `ApiError` on failure
- `apps/web/src/types/api.ts` — shared `ApiResponse<T>` type used by all route handlers

### D8 — Database Integration

- `packages/db/src/index.ts` — Drizzle ORM client initialization with Neon HTTP pooler
- `packages/db/src/schema/` — initial schema: `anime`, `genres`, `studios`, `seasons`, `episodes`
- `packages/db/src/repositories/anime.ts` — `getAnimeById`, `listAnime` with column selection (no `SELECT *`)
- `packages/db/drizzle.config.ts` — Drizzle Kit config for migrations
- Migration: initial schema migration applied

### D9 — Cache Integration

- `packages/cache/src/index.ts` — Upstash Redis client initialization
- `packages/cache/src/keys.ts` — cache key factory: `nexus:{entity}:{id}:{view}`
- `packages/cache/src/ttl.ts` — TTL constants: 60s (trending), 15min (catalog), 1hr (detail)
- `packages/cache/src/get-or-set.ts` — `getOrSet` helper with graceful degradation (cache miss falls through to DB)

### D10 — Catalog Routes

- `apps/web/app/page.tsx` — home page with trending, popular, new releases sections (SSR)
- `apps/web/app/[id]/page.tsx` — anime detail page with ISR (`revalidate: 3600`)
- `apps/web/app/[id]/season/[seasonId]/page.tsx` — season episode list with ISR (`revalidate: 86400`)
- `apps/web/app/search/page.tsx` — search page with query params (SSR)
- `apps/web/app/api/health/route.ts` — health check endpoint returning `{ status: "ok", uptime }`

### D11 — Redirects and Rewrites

- `next.config.ts` redirects: `/anime/:id` → `/:id`, `/show/:id` → `/:id`
- `next.config.ts` rewrites for TMDB image proxy (if applicable)

### D12 — Architecture Documentation

- `docs/03-architecture/Architecture.md` — full architecture document (16 sections)
- `docs/03-architecture/Routing.md` — route tree, route groups, middleware spec, dynamic routes, loading states
- `docs/03-architecture/` — ADR-001 (modular monolith), ADR-002 (Turborepo over Nx)

## Prerequisites

- M0 (Foundation) is complete: repository structure, CI pipeline, branch protection.
- M1 (Design System) is complete: `@nexus/ui` package with `ThemeProvider`, `Button`, `Card`, `Skeleton`, `Badge` components.
- Neon database project created and connection string available.
- Upstash Redis database created and REST URL/token available.
- Environment variables documented in `.env.example`: `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

## Dependencies

- `@nexus/ui` — ThemeProvider, Skeleton, Button, Card, Badge, Input (for search)
- `@nexus/db` — Drizzle client, schema, repositories
- `@nexus/cache` — Redis client, key factory, TTL constants
- `zod` — for API validation helpers
- `next` — Next.js 16 with App Router

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Neon cold-start latency on first request** | Medium | Medium | Use Neon HTTP pooler (not direct TCP); warm the connection in `generateStaticParams` for ISR routes; add a health check that pings the DB on app start. |
| **Redis cache stampede on popular anime detail** | Medium | High | Use `getOrSet` with a lock or probabilistic early expiration; serve stale data while revalidating (`stale-while-revalidate` header). |
| **ISR revalidation delay after content update** | Medium | Low | `revalidate: 3600` is acceptable for catalog data that changes infrequently; on-demand revalidation via webhook can be added in M5. |
| **Route group naming confusion in App Router** | Low | Medium | Route groups use parentheses and do not affect the URL path; document this clearly in `Routing.md` and add a comment in each `layout.tsx`. |
| **Skeleton loading states cause layout shift (CLS)** | Medium | High | Skeleton dimensions match the real content dimensions exactly; use `Skeleton` component with explicit `width`/`height` or `aspect-ratio` to prevent CLS. |
| **API envelope inconsistency across routes** | Medium | Medium | The `success()` and `error()` helpers in `envelope.ts` are the only way to return responses; ESLint rule or code review enforces their use. |
| **Middleware auth guard blocks public routes** | Medium | High | Middleware matcher explicitly excludes public routes (`_next`, `dev`, `login`, `signup`, `verify`, `pricing`, `about`, `terms`); test all public routes with middleware active. |

## Acceptance Criteria

1. `pnpm dev` starts the application and renders the home page without errors.
2. Home page displays trending, popular, and new releases sections with real data from Neon.
3. `/[id]` route renders anime detail with ISR (`revalidate: 3600`); first request populates the cache, subsequent requests serve from ISR.
4. `/[id]/season/[seasonId]` renders episode list with ISR (`revalidate: 86400`).
5. `/search?q=<query>` returns results from the database.
6. `/api/health` returns `{ data: { status: "ok", uptime: <number> } }`.
7. 404 page renders for unknown routes with a search suggestion.
8. Error boundary renders for thrown errors in route handlers (no white screens).
9. Sidebar renders correctly on desktop (>= 1024px) and bottom tab bar on mobile (< 640px).
10. Active nav link is highlighted based on current route.
11. Theme toggle switches `data-theme` attribute and persists in cookie.
12. Redis cache hit rate > 80% for anime detail after 5 consecutive requests.
13. Database queries use column selection (no `SELECT *` in any repository).
14. All API responses use the `{ data }` / `{ error }` envelope format.
15. `/anime/:id` redirects to `/:id` (301).
16. `pnpm typecheck` passes with no errors.
17. `pnpm build` succeeds with no warnings.
18. `pnpm lint` passes.

## QA Checklist

- [ ] Home page loads in under 2s on simulated slow 4G (Lighthouse).
- [ ] Anime detail page renders with poster, metadata, synopsis, and episode count.
- [ ] Search returns results for a known anime title.
- [ ] 404 page renders for `/nonexistent-route`.
- [ ] Error boundary renders when a route handler throws (test with a temporary `throw new Error()`).
- [ ] Sidebar collapses to bottom tab bar at < 640px.
- [ ] Header search input is focusable and submits on Enter.
- [ ] Theme toggle persists across page reloads (check cookie).
- [ ] ISR cache headers are present in response (`X-Nextjs-Cache: HIT` after second request).
- [ ] Redis keys follow the `nexus:{entity}:{id}:{view}` schema.
- [ ] Graceful degradation works: stop Redis → app still serves from DB (no errors).
- [ ] Graceful degradation works: stop Neon → app shows error boundary (no white screen).
- [ ] No `SELECT *` queries in `packages/db/src/repositories/`.
- [ ] No `any` types in `apps/web/src/`.
- [ ] No `ts-ignore` comments in `apps/web/src/`.
- [ ] `pnpm test` passes (if tests exist for envelope, errors, repositories).
- [ ] Mobile layout verified at 380px width (no horizontal scroll).
- [ ] Tablet layout verified at 768px width.
- [ ] Desktop layout verified at 1440px width.

## Estimated Tasks

| # | Task | Estimate | Owner | Dependencies |
|---|------|----------|-------|--------------|
| T1 | Set up `@nexus/db` package: Drizzle client, Neon connection, schema definition | 3h | Backend | M0 complete |
| T2 | Set up `@nexus/cache` package: Redis client, key factory, TTL constants, `getOrSet` | 2h | Backend | M0 complete |
| T3 | Write initial Drizzle migration and apply to Neon | 1.5h | Backend | T1 |
| T4 | Implement `envelope.ts`, `errors.ts`, `validate.ts`, and `api.ts` types | 2h | Full-stack | None |
| T5 | Implement root layout with ThemeProvider, sidebar, header, footer | 3h | Frontend | M1 complete |
| T6 | Implement route groups: `(public)`, `(authenticated)`, `(auth)`, `(api)` | 1h | Frontend | T5 |
| T7 | Implement Sidebar, Header, Footer, MobileTabBar, NavLink components | 4h | Frontend | M1 complete |
| T8 | Implement Container, Grid, useBreakpoint hook | 1.5h | Frontend | M1 complete |
| T9 | Implement loading states: root `loading.tsx`, route-specific skeletons | 2h | Frontend | T5, M1 complete |
| T10 | Implement error boundaries: root `error.tsx`, `not-found.tsx`, route-specific | 2h | Frontend | T5, M1 complete |
| T11 | Implement home page with trending/popular/new sections | 3h | Frontend | T1, T2, T5 |
| T12 | Implement anime detail page (`/[id]`) with ISR | 3h | Frontend | T1, T2, T11 |
| T13 | Implement season episode list (`/[id]/season/[seasonId]`) with ISR | 2h | Frontend | T1, T2, T12 |
| T14 | Implement search page with query params | 2h | Frontend | T1, T2 |
| T15 | Implement `/api/health` route handler | 0.5h | Backend | T4 |
| T16 | Configure redirects and rewrites in `next.config.ts` | 0.5h | Frontend | None |
| T17 | Write `docs/03-architecture/Architecture.md` and `Routing.md` | 4h | Docs | T5–T16 |
| T18 | QA pass: responsive, error states, cache degradation, CLS audit | 3h | QA | T11–T16 |
| T19 | Final typecheck, lint, build verification | 1h | Full-stack | T18 |

**Total estimate: ~40 engineer-hours** (approximately 1 week for a full-stack engineer, or 2 days for a frontend + backend pair).

## Completion Checklist

- [ ] All deliverables (D1–D12) are present in the repository.
- [ ] All acceptance criteria (1–18) are met.
- [ ] QA checklist is fully checked off.
- [ ] Home page renders with real data from Neon.
- [ ] Anime detail and season pages render with ISR.
- [ ] Search returns results from the database.
- [ ] Error boundaries and loading states render correctly.
- [ ] Sidebar and header render correctly on mobile and desktop.
- [ ] Redis cache is operational and keys follow the schema.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build` all pass.
- [ ] Architecture documentation is complete and cross-references are valid.
- [ ] Milestone marked complete in GitHub Projects board.
- [ ] Branch `feature/m2-core-layout` deleted after merge.
