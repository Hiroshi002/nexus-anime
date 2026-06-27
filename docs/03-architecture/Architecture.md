# Architecture — Nexus Anime

> **Audience:** Engineers, reviewers, and AI assistants. This document is the authoritative reference for the software architecture. All implementation must conform to the decisions captured here and in `docs/architecture/adr/`.

---

## 1. Architectural Style

**Layered modular monolith** — a single Next.js App Router application structured into horizontal layers (presentation → application → domain → infrastructure) and vertical feature modules, housed inside a Turborepo monorepo.

### Why this style

| Alternative             | Why rejected                                                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Microservices           | Premature for a small-to-mid team with a single deployable. Adds network latency, operational overhead (service mesh, distributed tracing), and drift risk without clear scaling benefit at current traffic. |
| Monolith without layers | Fast to build, but modules become tightly coupled over time. A change in video playback could silently break authentication. Layers enforce dependency direction and prevent circular imports.               |
| Micro-frontends         | Gives team autonomy per surface, but adds complexity (shared shell, independent deploys, cross-app state). We have one UI surface (`apps/web`) and one team — micro-frontends solve a problem we don't have. |

### Layer diagram

```
┌──────────────────────────────────────────────────────────┐
│  Presentation Layer (Next.js App Router)                 │
│  Server Components · Client Islands · Route Handlers      │
│  Server Actions · Middleware                               │
├──────────────────────────────────────────────────────────┤
│  Application Layer (Services)                             │
│  Auth · Catalog · Watchlist · Payments · Streaming        │
│  Orchestrates domain logic, validates with Zod            │
├──────────────────────────────────────────────────────────┤
│  Domain Layer (Pure business logic)                       │
│  Types · Constants · Validation schemas · Business rules   │
│  No framework or I/O dependencies                          │
├──────────────────────────────────────────────────────────┤
│  Infrastructure Layer (Repositories + External clients)    │
│  @nexus/db (Drizzle + Neon) · @nexus/cache (Upstash)      │
│  TMDB client · AniList client · Stripe SDK · Stream SDK   │
└──────────────────────────────────────────────────────────┘
```

**Dependency rule:** A layer may only depend on the layer directly below it. Presentation → Application → Domain ← Infrastructure (Infrastructure implements Domain interfaces; Domain never imports Infrastructure).

---

## 2. Monorepo Architecture

**Turborepo + pnpm workspaces** — canonical structure per ADR-001.

```
nexus-anime/
├── apps/web/              # Next.js 15 App Router (sole deployable)
├── packages/
│   ├── ui/                # @nexus/ui   — design system, shadcn/ui + theme
│   ├── db/                # @nexus/db   — Drizzle ORM, schema, migrations
│   └── cache/             # @nexus/cache — Redis, rate limiting, feature flags
├── tooling/               # Docker, seed scripts (dev-only, not shipped)
└── docs/                  # Architecture, ADRs, milestones, roadmap
```

### Package boundaries

Each `@nexus/*` package has a **public API surface** exported from its `index.ts`. Internal modules are not importable by consumers.

| Package        | Public API                                         | Internal (private)                                  |
| -------------- | -------------------------------------------------- | --------------------------------------------------- |
| `@nexus/ui`    | Components, hooks, theme tokens                    | Internal Radix primitives, cn() helpers             |
| `@nexus/db`    | `db` client, schema types, repository constructors | Raw Drizzle query implementations, migration runner |
| `@nexus/cache` | Cache helpers, rate limiters, feature flag getters | Redis key construction, connection management       |

### Why Turborepo over Nx

| Criterion         | Turborepo                                      | Nx                                                  |
| ----------------- | ---------------------------------------------- | --------------------------------------------------- |
| Config overhead   | Low — `turbo.json` pipeline defs               | High — generators, targeted deps, workspace config  |
| Caching           | Remote caching free on Vercel                  | Requires Nx Cloud or self-hosted                    |
| Learning curve    | Minimal for pnpm workspace users               | Steeper — task graph, affected commands             |
| Fit for this repo | 3 packages + 1 app — Turborepo is proportional | Better at 10+ apps/packages with cross-cutting deps |

---

## 3. Feature-Based Architecture

Within `apps/web/src/`, code is organized **by feature** (vertical slices), not by technical role. Each feature directory is a self-contained module containing its components, hooks, actions, and types.

```
src/
├── features/
│   ├── auth/          # Login, signup, OAuth, session
│   ├── catalog/       # Anime browse, search, detail, seasons
│   ├── watchlist/     # Save, remove, reorder
│   ├── player/        # Video playback, controls, quality
│   ├── payments/      # Plans, checkout, webhooks
│   └── profile/       # User settings, avatar, history
├── shared/            # Cross-feature utilities
│   ├── components/    # Layout, nav, error boundaries
│   ├── hooks/         # useMedia, useIntersectionObserver
│   ├── lib/           # formatDate, cn, sanitizers
│   └── types/         # ApiEnvelope, Pagination, FeatureFlag
```

### Why feature-based over type-based

| Approach                                            | Strength                                                                          | Weakness                                                                                                 |
| --------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Feature-based** (chosen)                          | Cohesion — everything for "watchlist" is one `cd` away. Easy to delete a feature. | Some duplication (each feature may have its own error boundary). Tolerable at our scale.                 |
| Type-based (`components/`, `hooks/`, `actions/`)    | No duplication. Familiar to Rails-style developers.                               | Low cohesion — a change to watchlist touches 5 directories. Hard to delete a feature cleanly.            |
| Domain-driven design (aggregates, bounded contexts) | Formally correct for complex domains.                                             | Overkill — our domain is a streaming catalog, not financial trading. The ceremony outweighs the benefit. |

### Cross-feature imports rule

A feature module **must not** import from another feature module directly. Shared code goes through `shared/`. This prevents feature coupling and ensures features can be deleted or extracted independently.

```
✅  features/watchlist/components/WatchlistButton.tsx → shared/hooks/useToggle.ts
❌  features/watchlist/components/WatchlistButton.tsx → features/catalog/types/Anime.ts
```

If `WatchlistButton` needs `Anime` types, the type moves to `shared/types/` or the component receives it as a typed prop.

---

## 4. Component Architecture

### Server Components vs Client Components

**Server Components are the default.** A component becomes a Client Component (`"use client"`) only when it needs:

- Event handlers (`onClick`, `onChange`)
- React hooks (`useState`, `useEffect`, `useRef`)
- Browser APIs (`window`, `document`, `IntersectionObserver`)
- Framer Motion animations (only for complex orchestration — CSS transitions for micro-interactions)

### Component categories

| Category    | Rendering               | Examples                                  | Package                  |
| ----------- | ----------------------- | ----------------------------------------- | ------------------------ |
| Primitives  | Server                  | Button, Input, Card, Badge, Dialog        | `@nexus/ui`              |
| Composites  | Server                  | AnimeCard, EpisodeList, SearchBar         | `features/*/components/` |
| Interactive | Client                  | VideoPlayer, WatchlistToggle, ThemeSwitch | `features/*/components/` |
| Layout      | Server                  | AppShell, Sidebar, PageHeader             | `shared/components/`     |
| Islands     | Client (dynamic import) | Player, CommentEditor, PaymentForm        | `features/*/components/` |

### Why Server-first

Server Components reduce the JavaScript sent to the client, improve Time to First Byte (TTFB), and enable direct database/Redis access without API routes. For a streaming platform where catalog pages dominate traffic, SSR/ISR with Server Components is the optimal rendering strategy. Client islands are reserved for interactivity that cannot be achieved server-side.

### Composition over configuration

Components are small and composed. Instead of a monolithic `<AnimePage>` that takes 20 props, we compose:

```tsx
// Server Component — no client JS
export default async function AnimeDetailPage({ params }) {
  const anime = await getAnime(params.id); // cached server fetch
  return (
    <Suspense fallback={<AnimeDetailSkeleton />}>
      <AnimeHero anime={anime} />
      <EpisodeList animeId={anime.id} />
      <Suspense fallback={<ReviewsSkeleton />}>
        <ReviewList animeId={anime.id} />
      </Suspense>
    </Suspense>
  );
}
```

---

## 5. Server-Client Boundary Strategy

The boundary between Server and Client Components is a **deliberate architectural decision**, not an afterthought.

### Colocation rule

A Client Component and its Server Component parent live in the same feature directory. The Server Component fetches data and passes it as serializable props to the Client Component.

```
features/player/
├── PlayerContainer.tsx    # Server — fetches signed URL, passes to island
├── PlayerIsland.tsx       # Client ("use client") — actual player
├── PlayerControls.tsx     # Client — play/pause, quality, fullscreen
└── types.ts               # Shared types for the feature
```

### Data flow across the boundary

1. **Server Component** fetches data (DB, cache, external API) using `React.cache()` for dedup.
2. Data is serialized as JSON-serializable props (no functions, no class instances).
3. **Client Component** receives props, manages interactive state (playback position, UI state).
4. Mutations flow back via **Server Actions** (`"use server"`), not REST endpoints.

### Why Server Actions over REST for mutations

| Criterion               | Server Actions                              | REST API                                       |
| ----------------------- | ------------------------------------------- | ---------------------------------------------- |
| Boilerplate             | Minimal — function + Zod validate           | Route handler + request parse + response shape |
| Type safety             | End-to-end — same TypeScript context        | Broken at the HTTP boundary                    |
| Progressive enhancement | Works without JS (form submission)          | Requires JS                                    |
| Revalidation            | Built-in `revalidatePath` / `revalidateTag` | Manual cache invalidation                      |
| Webhooks                | Not suitable                                | Required for Stripe, Stream callbacks          |

**Decision:** Server Actions for all user-facing mutations. Route Handlers for webhooks, external integrations, and backward-compatible API endpoints.

---

## 6. Repository Pattern

Data access is abstracted behind **repository modules**. A repository encapsulates Drizzle query construction, so application services never write raw queries.

```
packages/db/src/
├── schema/              # Table definitions (users, anime, episodes, watchlist, ...)
├── repositories/
│   ├── anime.repository.ts    # getAnime, searchAnime, getTrending
│   ├── user.repository.ts     # getUser, updateUser, getWatchlist
│   ├── episode.repository.ts  # getEpisodes, getEpisodeByOrder
│   └── watchlist.repository.ts # addToWatchlist, removeFromWatchlist
├── client.ts            # Drizzle client singleton
└── index.ts             # Public API — exports client + types
```

### Why repositories

| Alternative                      | Why rejected                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Direct Drizzle calls in services | Ties service logic to query builder syntax. Hard to test (must mock Drizzle). Hard to swap DB engine.                    |
| Active Record pattern            | Couples data model to persistence. An `Anime` object that can `.save()` itself mixes domain and infrastructure concerns. |
| Query objects / specifications   | Flexible, but adds abstraction layers. Overkill when our queries are straightforward catalog lookups.                    |

### Repository contract

Each repository function returns typed data — never raw Drizzle result objects. If a repository needs to join tables, it returns a composed type, not a Drizzle relational query leak.

```ts
// ✅ Repository returns a clean domain type
export async function getAnimeDetail(id: string): Promise<AnimeDetail | null> { ... }

// ❌ Never leak Drizzle internals
export async function getAnimeDetail(id: string): Promise<typeof animeTable.$inferSelect> { ... }
```

---

## 7. Service Layer

Services orchestrate business logic that spans multiple repositories or external APIs. They sit between Route Handlers/Server Actions and repositories.

```
apps/web/src/
├── services/
│   ├── auth.service.ts       # signUp, signIn, signOut, OAuth callback
│   ├── catalog.service.ts    # getCatalogPage, getAnimeDetail (orchestrates DB + TMDB)
│   ├── watchlist.service.ts  # toggleWatchlist, reorderWatchlist (DB + cache invalidation)
│   ├── streaming.service.ts  # getSignedUrl (DB + Cloudflare Stream API)
│   └── payments.service.ts   # createCheckout, handleWebhook (DB + Stripe API)
```

### Why a service layer

Without services, Server Actions and Route Handlers contain business logic directly — making it un-reusable and un-testable across callers. Services centralize orchestration (multi-repo queries, cache invalidation, external API calls) so both a Server Action and a Route Handler can call the same `toggleWatchlist()` logic.

### Service rules

1. **Pure orchestration** — services call repositories and external clients; they do not contain HTTP concerns (request parsing, response shaping).
2. **Zod validation at the boundary** — services validate inputs with Zod schemas; callers may trust the service or validate themselves.
3. **No framework imports** — services never import `next/` or `next-auth`. Framework-specific code stays in actions/route handlers.

---

## 8. API Abstraction for External Services

External APIs (TMDB, AniList, Stripe, Cloudflare Stream) are accessed through **typed client modules** with retry logic, rate limiting, and response validation.

```
apps/web/src/lib/clients/
├── tmdb.client.ts       # TMDB REST client (movie/TV metadata)
├── anilist.client.ts    # AniList GraphQL client (anime metadata)
├── stripe.client.ts     # Stripe SDK wrapper (checkout, webhooks)
└── stream.client.ts     # Cloudflare Stream client (signed URLs)
```

### Contract

Each client module:

- Exports typed functions (no raw `fetch` calls in services).
- Validates responses with Zod before returning (never trust upstream shape).
- Handles retries with exponential backoff for transient failures.
- Logs structured errors for observability.

### Why abstract external APIs

Without abstraction, TMDB response shapes leak into application logic. If TMDB v4 changes their API, we update one module instead of hunting through the codebase. The validation step catches upstream contract drift at the boundary, not at render time.

---

## 9. Route Groups

Next.js Route Groups organize pages by shared layout concerns without affecting the URL path.

```
app/
├── (public)/              # No auth required
│   ├── (catalog)/         # ISR — anime browse, search, detail
│   │   ├── page.tsx
│   │   └── [id]/
│   │       └── page.tsx
│   ├── (marketing)/       # Static — landing, about, pricing
│   │   └── pricing/
│   │       └── page.tsx
│   └── layout.tsx         # Public shell (header, footer, no auth guard)
├── (authenticated)/       # Auth required (middleware redirect)
│   ├── watchlist/
│   │   └── page.tsx
│   ├── profile/
│   │   └── page.tsx
│   └── layout.tsx         # Authenticated shell (sidebar, session guard)
├── (auth)/                # Auth pages (no app shell)
│   ├── login/
│   │   └── page.tsx
│   └── signup/
│       └── page.tsx
├── api/                   # Route handlers (webhooks, health checks)
│   ├── stripe/
│   │   └── webhook/
│   │       └── route.ts
│   └── health/
│       └── route.ts
└── layout.tsx             # Root layout (providers, fonts, metadata)
```

### Why Route Groups

| Alternative                 | Why rejected                                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Flat route structure        | All pages share one layout. Authenticated and public pages need different shells (sidebar vs. marketing header).                 |
| Middleware-only auth checks | Middleware can redirect, but cannot inject different layouts. Route Groups give both layout switching and middleware-based auth. |
| Separate apps               | Overkill — the admin-vs-public split is a layout concern, not a deploy concern.                                                  |

---

## 10. Loading & Suspense Strategy

### Suspense boundaries

Every async Server Component is wrapped in a `<Suspense>` with a meaningful skeleton. **Never block the entire page on one slow fetch.**

```tsx
// ✅ Progressive loading — hero renders fast, reviews stream in
<Suspense fallback={<AnimeHeroSkeleton />}>
  <AnimeHero anime={anime} />
</Suspense>
<Suspense fallback={<EpisodeListSkeleton />}>
  <EpisodeList animeId={anime.id} />
</Suspense>
<Suspense fallback={<ReviewsSkeleton />}>
  <ReviewList animeId={anime.id} />
</Suspense>
```

### Loading states hierarchy

1. **Route-level** — `loading.tsx` in each route segment provides instant navigation feedback (Next.js streaming).
2. **Component-level** — `<Suspense>` with skeleton for async components.
3. **Action-level** — `useActionState` with pending UI for Server Action mutations (optimistic updates where appropriate).

### Streaming

Next.js streams HTML progressively. Slow data sources (TMDB, AniList) do not block fast ones (local DB, Redis cache). The viewer sees the hero immediately, and secondary content streams in as it resolves.

---

## 11. Error Boundaries

### Hierarchy

```
Root error boundary (app/error.tsx)
  ├── (public) error boundary
  │   ├── (catalog) error boundary — anime-specific errors
  │   └── (marketing) error boundary
  ├── (authenticated) error boundary — session errors
  └── (auth) error boundary — OAuth errors
```

### Rules

1. Each feature route has its own `error.tsx` that catches feature-specific errors (e.g., `AnimeNotFoundError`, `VideoUnavailableError`).
2. Error boundaries use the API envelope format: `{ error: { message, code, details } }`.
3. Error UIs are Client Components (they need `reset()` for retry).
4. Never leak stack traces to the client. The `message` is user-friendly; `code` is machine-readable; `details` are structured (field-level validation errors).

---

## 12. SEO Architecture

- **Metadata API** on every route: `generateMetadata()` for dynamic routes (`/anime/[id]`), static `metadata` export for fixed routes.
- **Open Graph + Twitter Cards** generated from anime metadata (title, description, cover image).
- **Structured data** (JSON-LD) for `Movie`, `TVEpisode`, `VideoObject` schemas on anime/episode pages.
- **Sitemap** via `app/sitemap.ts` (auto-generated from catalog).
- **Robots** via `app/robots.ts` (block `/api/`, `/profile/`, `/watchlist/`).
- **Canonical URLs** on all pages to prevent duplicate content.

### Why Metadata API over react-helmet

| Alternative          | Why rejected                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------- |
| react-helmet         | Client-side — metadata is not available to crawlers on SSR. Deprecated in Next.js App Router. |
| Manual `<head>` tags | Not streaming-compatible. Metadata API handles dedup and streaming.                           |

---

## 13. Internationalization Readiness

**Not implemented in M0–M3.** Architecture is i18n-ready:

- All user-facing strings extracted to a `shared/lib/strings.ts` constants file (future: locale dictionary).
- Date/number formatting via `Intl` APIs (locale-aware today, no refactor later).
- Route structure compatible with `[locale]` prefix if needed: `app/[locale]/(public)/...`.
- `@nexus/ui` components accept string props (no hardcoded English inside components).

### Why defer i18n

No non-English markets are planned before M7. Extracting strings now is cheap; implementing locale routing, translation pipelines, and RTL support is expensive. The architecture accommodates i18n without paying for it yet.

---

## 14. Accessibility Architecture

- **WCAG 2.1 AA** as the conformance target.
- `@nexus/ui` primitives use Radix UI — accessible by default (keyboard nav, ARIA, focus management).
- Framer Motion animations respect `prefers-reduced-motion`.
- Color contrast enforced by Tailwind theme tokens (no raw color classes).
- Images always have `alt` text (Next.js `next/image` enforces `alt`).
- Forms use associated labels, error messages linked via `aria-describedby`.
- Skip-navigation link in root layout.

### Why WCAG 2.1 AA, not AAA

AAA requires 7:1 contrast ratio, which conflicts with the dark glassmorphism aesthetic (semi-transparent surfaces on dark backgrounds). AA (4.5:1) is achievable with our palette and is the industry standard for commercial products.

---

## 15. Future Backend Integration

The architecture accommodates a future separate backend without restructuring:

| Today (M0–M4)                                           | Future (M6+)                                                      |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| Server Components → Services → Repositories → @nexus/db | Same services call HTTP API instead of repositories               |
| External APIs called from Next.js server                | External APIs called from backend, proxied to Next.js             |
| Drizzle ORM in @nexus/db                                | Drizzle migrates to backend service; @nexus/db becomes API client |

**Migration path:** Services are the seam. Today they call repositories; tomorrow they call API clients. The service interface stays the same; only the implementation changes. This is why the service layer exists — it is the application's protection against infrastructure changes.

---

## 16. Future Mobile App Compatibility

- API envelope format (`{ data }` / `{ error }`) is JSON-native and consumable by any client (React Native, Flutter, Swift).
- Server Actions are **not available to mobile** — mobile will use Route Handlers (`/api/*`). This is why mutations have dual entry points: Server Actions for web, Route Handlers for API consumers.
- Shared `@nexus/ui` is web-only; mobile has its own component library. Shared logic (validation, types, business rules) lives in a future `@nexus/core` package if extraction is justified.

### Why design for mobile now

The API envelope and Route Handler contracts are cheap to establish now and expensive to retrofit later. We do not build mobile features prematurely — we ensure the server-side contracts don't assume a browser client.
