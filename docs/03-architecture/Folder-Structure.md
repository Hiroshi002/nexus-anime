# Folder Structure — Nexus Anime

> **Audience:** Engineers onboarding to the repository. This document maps every directory to its responsibility and explains the organizational decisions.

---

## 1. Repository Root

```
nexus-anime/
├── apps/                    # Deployable applications
├── packages/                # Shared libraries consumed by apps
├── tooling/                 # Development infrastructure (not shipped)
├── docs/                    # Long-lived design records
├── .github/                 # GitHub automation (workflows, templates)
├── package.json             # Workspace root — scripts, devDeps, packageManager
├── pnpm-workspace.yaml      # Workspace glob declarations
├── turbo.json               # Turborepo pipeline configuration
├── tsconfig.base.json       # Shared TypeScript base config
├── .npmrc                   # pnpm strict-peer-deps, no shamefully-hoist
├── .nvmrc                   # Node 22 LTS pin
├── .env.example             # Environment variable template
├── .editorconfig            # Editor formatting rules
├── .gitattributes           # LF enforcement, merge strategies
├── .gitignore               # Standard Node/Next/Turbo/env ignores
├── prettier.config.js       # Shared Prettier config
├── LICENSE                  # MIT
├── README.md                # Public-facing project overview
├── CLAUDE.md                # AI assistant behavior rules
└── CHANGELOG.md             # Version history
```

### Why this layout

This is the canonical Turborepo shape. Each top-level directory has one responsibility: `apps/` for deployables, `packages/` for shared code, `tooling/` for dev-only infra, `docs/` for design records, `.github/` for GitHub-native automation. Root config files (`tsconfig.base.json`, `prettier.config.js`, `turbo.json`) are shared across the monorepo to prevent drift.

---

## 2. apps/web — Next.js Application

```
apps/web/
├── src/
│   ├── app/                         # App Router — routes, layouts, error boundaries
│   │   ├── (public)/                # Public route group (no auth required)
│   │   │   ├── (catalog)/           # Catalog sub-group (ISR)
│   │   │   │   ├── page.tsx         # Browse / home
│   │   │   │   ├── [id]/            # Anime detail
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── search/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── season/
│   │   │   │   │   └── [seasonId]/
│   │   │   │   │       └── page.tsx
│   │   │   │   └── loading.tsx      # Catalog skeleton
│   │   │   ├── (marketing)/         # Marketing sub-group (static)
│   │   │   │   ├── pricing/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── about/
│   │   │   │       └── page.tsx
│   │   │   └── layout.tsx           # Public shell (header + footer)
│   │   ├── (authenticated)/         # Authenticated route group
│   │   │   ├── watchlist/
│   │   │   │   └── page.tsx
│   │   │   ├── profile/
│   │   │   │   └── page.tsx
│   │   │   ├── settings/
│   │   │   │   └── page.tsx
│   │   │   ├── continue-watching/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx           # Authenticated shell (sidebar + session guard)
│   │   ├── (auth)/                  # Auth route group (no app shell)
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── signup/
│   │   │   │   └── page.tsx
│   │   │   └── verify/
│   │   │       └── [token]/
│   │   │           └── page.tsx
│   │   ├── api/                     # Route Handlers
│   │   │   ├── stripe/
│   │   │   │   └── webhook/
│   │   │   │       └── route.ts
│   │   │   ├── stream/
│   │   │   │   └── webhook/
│   │   │   │       └── route.ts
│   │   │   └── health/
│   │   │       └── route.ts
│   │   ├── dev/                     # Dev-only routes (design showcase)
│   │   │   └── components/
│   │   │       └── page.tsx
│   │   ├── not-found.tsx            # 404 page
│   │   ├── error.tsx                # Root error boundary
│   │   ├── layout.tsx               # Root layout (providers, fonts, metadata)
│   │   └── sitemap.ts               # Auto-generated sitemap
│   ├── features/                    # Feature modules (vertical slices)
│   │   ├── auth/
│   │   │   ├── components/          # LoginForm, SignupForm, OAuthButtons
│   │   │   ├── actions/             # signInAction, signUpAction
│   │   │   └── types.ts
│   │   ├── catalog/
│   │   │   ├── components/          # AnimeCard, AnimeHero, EpisodeList, SearchBar
│   │   │   ├── actions/             # searchAction
│   │   │   └── types.ts
│   │   ├── watchlist/
│   │   │   ├── components/          # WatchlistToggle, WatchlistGrid, WatchlistItem
│   │   │   ├── actions/             # toggleWatchlistAction, reorderAction
│   │   │   └── types.ts
│   │   ├── player/
│   │   │   ├── components/          # PlayerContainer, PlayerIsland, PlayerControls
│   │   │   ├── actions/             # reportProgressAction
│   │   │   └── types.ts
│   │   ├── payments/
│   │   │   ├── components/          # PricingTable, CheckoutForm, PlanBadge
│   │   │   ├── actions/             # createCheckoutAction
│   │   │   └── types.ts
│   │   └── profile/
│   │       ├── components/          # ProfileHeader, AvatarUpload, ViewingHistory
│   │       ├── actions/             # updateProfileAction
│   │       └── types.ts
│   ├── services/                    # Application service layer
│   │   ├── auth.service.ts
│   │   ├── catalog.service.ts
│   │   ├── watchlist.service.ts
│   │   ├── streaming.service.ts
│   │   └── payments.service.ts
│   ├── shared/                      # Cross-feature shared code
│   │   ├── components/              # AppShell, Sidebar, Navbar, Footer, SkipNav
│   │   ├── hooks/                   # useMedia, useIntersectionObserver, useScrollProgress
│   │   ├── lib/                     # formatDate, cn, sanitizeHtml, getBaseUrl
│   │   └── types/                   # ApiEnvelope, Pagination, FeatureFlag, VideoQuality
│   ├── lib/                         # App-level utilities (not shared across features)
│   │   ├── clients/                 # External API clients (TMDB, AniList, Stripe, Stream)
│   │   ├── auth.config.ts           # Auth.js configuration
│   │   ├── middleware.ts            # Next.js middleware (auth redirects, edge headers)
│   │   └── validations/            # Zod schemas for route/action inputs
│   └── styles/                      # Global CSS entry (Tailwind directives)
│       └── globals.css
├── public/                          # Static assets
│   ├── fonts/                       # Self-hosted fonts
│   ├── images/                      # Static images (logo, og-image, placeholders)
│   └── favicon.ico
├── tests/                           # App-level integration tests
│   ├── e2e/                         # Playwright E2E tests
│   └── integration/                 # API route integration tests
├── next.config.ts                   # Next.js config (images, redirects, headers, experimental)
├── tsconfig.json                    # App TypeScript config (extends tsconfig.base.json)
├── tailwind.config.ts               # Tailwind config (extends @nexus/ui theme)
├── package.json                     # App dependencies + scripts
└── vitest.config.ts                 # Unit test config
```

### Why src/ directory

The `src/` directory separates application code from config files at the app root (`next.config.ts`, `package.json`, `tsconfig.json`). Without it, config and source files intermingle, making `.gitignore` rules and mental models harder.

### Why features/ over flat components/

Feature directories put every artifact for a feature in one place. Deleting the `player/` feature is `rm -rf features/player/`. In a flat structure, you hunt through `components/`, `hooks/`, `actions/`, and `types/` to find player-related code.

---

## 3. packages/ui — Design System

```
packages/ui/
├── src/
│   ├── components/              # shadcn/ui-based primitives
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── badge.tsx
│   │   ├── skeleton.tsx
│   │   ├── toast.tsx
│   │   └── ...                  # Each component is one file
│   ├── hooks/                   # Design-system hooks (useMediaQuery, useTheme)
│   ├── styles/                  # Theme tokens, CSS custom properties
│   │   └── theme.ts
│   └── index.ts                 # Public API barrel export
├── package.json                 # name: @nexus/ui, main: src/index.ts
└── tsconfig.json                # Extends tsconfig.base.json
```

### Why one file per component

Small files (under 300 lines) are easier to review, tree-shake, and reason about. A `button.tsx` that exports `Button`, `ButtonVariants`, and `buttonVariants` is self-contained. Colocating the component, its variants, and its types avoids the indirection of `button/`, `button/index.tsx`, `button/variants.ts`.

---

## 4. packages/db — Database

```
packages/db/
├── src/
│   ├── schema/                  # Drizzle table definitions
│   │   ├── users.ts
│   │   ├── accounts.ts         # NextAuth accounts
│   │   ├── sessions.ts         # NextAuth sessions
│   │   ├── anime.ts
│   │   ├── episodes.ts
│   │   ├── genres.ts
│   │   ├── watchlist.ts
│   │   ├── watch-progress.ts
│   │   ├── subscriptions.ts
│   │   └── index.ts            # Re-exports all schemas
│   ├── repositories/            # Data access layer
│   │   ├── anime.repository.ts
│   │   ├── user.repository.ts
│   │   ├── episode.repository.ts
│   │   ├── watchlist.repository.ts
│   │   └── index.ts
│   ├── migrations/              # Drizzle Kit migration files
│   ├── client.ts                # Drizzle client singleton (Neon serverless)
│   └── index.ts                 # Public API
├── drizzle.config.ts            # Drizzle Kit config
├── package.json                 # name: @nexus/db
└── tsconfig.json
```

### Why schema/ and repositories/ separation

Schema files define *what the data looks like* (table structure, column types, relations). Repository files define *how to query it* (find, create, update, delete). Separating them means a schema change (adding a column) doesn't require touching query logic, and a query optimization doesn't risk altering the schema definition.

---

## 5. packages/cache — Redis

```
packages/cache/
├── src/
│   ├── redis.ts                 # Upstash Redis client singleton
│   ├── cache.ts                 # get, set, del with typed key schema
│   ├── rate-limit.ts            # Sliding-window rate limiter
│   ├── feature-flags.ts         # Feature flag evaluation (Redis-backed, safe default)
│   └── index.ts                 # Public API
├── package.json                 # name: @nexus/cache
└── tsconfig.json
```

### Why cache is a package, not an app utility

Cache is consumable by any future app (admin API, background worker) and must share the same key schema and TTL constants. Making it a package enforces a single Redis key contract across the monorepo.

---

## 6. tooling/ — Development Infrastructure

```
tooling/
├── docker/
│   └── docker-compose.yml       # Postgres 16, Redis 7, Mailpit
└── scripts/
    ├── seed-admin.ts             # Create admin user + roles
    ├── seed-anime.ts             # Seed anime catalog from TMDB
    └── seed-catalog.ts           # Seed genres, tags, relations
```

### Why tooling/ is not under apps/ or packages/

These are dev-time utilities — Docker Compose for local services, seed scripts for database population. They are not imported by any application code, not deployed, and not versioned as libraries. Keeping them under `tooling/` makes the boundary explicit: `apps/` + `packages/` are what we ship; `tooling/` is what we use to develop.

---

## 7. docs/ — Design Records

```
docs/
├── README.md                    # Docs index
├── REPOSITORY-DESIGN.md         # Repo constitution (28 deliverables)
├── master-roadmap.md            # M0–M7 milestone table
├── 01-project/                  # Step 1 docs (if present)
├── 02-design/                   # Step 2 docs (if present)
├── 03-architecture/             # Step 4 docs (this directory)
│   ├── Architecture.md
│   ├── Folder-Structure.md
│   ├── Feature-Modules.md
│   ├── Routing.md
│   ├── Rendering-Strategy.md
│   ├── State-Management.md
│   ├── API-Layer.md
│   ├── Authentication-Architecture.md
│   ├── Caching-Strategy.md
│   ├── Error-Handling.md
│   ├── Logging.md
│   ├── Performance.md
│   ├── Scalability.md
│   ├── Security-Architecture.md
│   └── Dependency-Graph.md
├── architecture/
│   └── adr/                     # Architecture Decision Records
│       ├── 000-record-architecture-decisions.md
│       └── 001-modular-monolith-nextjs.md
├── milestones/                  # Per-milestone specifications
│   ├── milestone-0-repository-scaffold.md
│   └── milestone-1-project-foundation.md
└── sprints/                     # Optional sprint plans
```

### Why numbered prefixes (01-, 02-, 03-)

Numbered prefixes ensure the directory sorts in step order, making the documentation journey discoverable: Step 1 (project) → Step 2 (design) → Step 3 (…) → Step 4 (architecture). Without prefixes, directories sort alphabetically, which breaks the reading order.

---

## 8. File naming conventions

| Artifact | Convention | Example |
|----------|-----------|---------|
| Components | PascalCase | `AnimeCard.tsx`, `PlayerControls.tsx` |
| Hooks | camelCase with `use` prefix | `useWatchlist.ts`, `useIntersectionObserver.ts` |
| Actions | camelCase with `Action` suffix | `toggleWatchlistAction.ts` |
| Services | camelCase with `.service` suffix | `catalog.service.ts` |
| Repositories | camelCase with `.repository` suffix | `anime.repository.ts` |
| Types | `types.ts` (one per feature) | `features/catalog/types.ts` |
| Zod schemas | camelCase with `Schema` suffix | `searchInputSchema` |
| Test files | Colocated with `.test.ts(x)` | `AnimeCard.test.tsx` |
| Route files | Next.js convention | `page.tsx`, `layout.tsx`, `error.tsx`, `loading.tsx` |

### Why these conventions

Consistent naming means a developer can predict where a file lives and what it contains without reading it. `catalog.service.ts` is clearly a service; `toggleWatchlistAction.ts` is clearly a Server Action. The conventions eliminate guesswork.
