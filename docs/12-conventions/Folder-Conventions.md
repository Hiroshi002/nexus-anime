# Folder Conventions — Nexus Anime

> **Audience:** Everyone who creates, moves, or maintains files in this repo.
> **Status:** Accepted. Enforced by ESLint `import/no-restricted-paths` where automated; by code review otherwise. Changes are proposed via PR against this file.
> **Related:** [Coding Standards](./Coding-Standards.md) · [Naming Conventions](./Naming-Conventions.md) · [Git Workflow](./Git-Workflow.md) · [Repository Design §10, §14, §15](../../REPOSITORY-DESIGN.md)

This document specifies **where** code lives and **how** features reach one another. The goal is that a new engineer can locate the source of any import or route in under a minute, and that changes to a feature ripple no further than that feature's own directory.

---

## Guiding Principles

1. **Locality over hierarchy.** Code that changes together lives together. Feature directories own their components, hooks, actions, schemas, and tests end-to-end.
2. **Public surface via barrels.** Each feature exposes a small, deliberate surface through an `index.ts`. Consumers reach for the barrel, not internal files.
3. **No horizontal reach-across.** A feature may not import another feature's internals. Cross-cutting concerns (design system, db, cache) live in `packages/` and can be imported freely.
4. **Small files, small directories.** Target files under 300 lines, hard cap at 400. When a directory crosses ~20 source files without a natural group, consider splitting it into sub-features.

---

## 1. Repository Top-Level

```
.
├── apps/                  # Deployable applications
├── packages/              # Shared, versioned libraries consumed by apps
├── tooling/               # Dev-time infra (docker, seed scripts)
├── docs/                  # Roadmaps, specs, ADRs, conventions, decisions
├── .github/               # Templates, workflows, labels, rules
├── package.json           # Workspace root scripts + devDependencies
├── pnpm-workspace.yaml    # Workspace globs
├── turbo.json             # Build pipeline config
├── tsconfig.base.json     # Shared strict TS base
└── ...configs, licenses
```

Mirrors [Repository Design §10–§28](../../REPOSITORY-DESIGN.md). Work that does not belong in an app, package, or docs belongs in `tooling/` — or, more often, does not belong in this repo at all.

---

## 2. `apps/web/` — the deployable web application

```
apps/web/
├── src/
│   ├── app/                  # App Router: pages, layouts, route handlers, actions
│   ├── components/           # App-level, cross-feature components
│   ├── hooks/                # App-level, cross-feature client hooks
│   ├── lib/                  # App-specific utilities + external-client wrappers
│   ├── actions/              # App-level Server Actions (feature-agnostic mutations)
│   ├── styles/               # Global styles, Tailwind entry, theme imports
│   ├── middleware.ts         # Edge: auth redirects, security headers
│   └── features/<name>/      # Feature-scoped vertical slices (see §3)
├── public/                   # Static assets
├── tests/                    # App-level integration / e2e tests
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
└── package.json
```

### 2.1 `src/app/` — routes and layouts

App Router colocation with route-segment semantics:

```
app/
├── layout.tsx                      # Root layout (globals, providers)
├── page.tsx                        # Home
├── not-found.tsx                   # 401/404 handling
├── error.tsx                       # Error boundary
├── global-error.tsx
├── (marketing)/                    # Route group (no URL prefix)
│   ├── pricing/page.tsx
│   └── about/page.tsx
├── (app)/                          # Authenticated route group
│   ├── dashboard/page.tsx
│   ├── watchlist/page.tsx
│   ├── settings/
│   │   ├── page.tsx
│   │   └── [section]/page.tsx
│   └── anime/[slug]/
│       ├── page.tsx                # Anime detail
│       ├── episode/[episode]/page.tsx
│       └── loading.tsx
└── api/                            # Route handlers (webhooks, external integrations)
    ├── auth/[...nextauth]/route.ts
    ├── webhooks/stripe/route.ts
    └── health/route.ts
```

- Route groups (`(marketing)`, `(app)`) partition the tree without URL cost — use them to scope layouts, not just for tidying.
- Layouts at the app level carry root chrome (nav, footer, providers, analytics). Feature-level layouts live inside `features/<name>/`.
- `api/` is reserved for non-UI consumers. Mutations triggered from the UI use Server Actions in `actions/` or `features/<name>/actions.ts`.

### 2.2 `src/components/` — app-wide, cross-feature UI

Components here are **genuinely shared across multiple features** and not specific to any one domain:

```
components/
├── layout/
│   ├── MainNav.tsx
│   ├── Footer.tsx
│   └── AppShell.tsx
├── ui/                             # Re-exported @nexus/ui components (thin wrappers)
│   ├── index.ts
│   └── Card.tsx
├── skeletons/                      # Loading skeletons
│   ├── CarouselSkeleton.tsx
│   ├── DetailSkeleton.tsx
│   └── index.ts
├── error/
│   ├── ErrorBoundary.tsx
│   └── ApiErrorView.tsx
└── analytics/
    └── Pixel.tsx
```

A component qualifies as "shared" when **two or more features** import it. If it touches only one feature, it lives inside that feature.

### 2.3 `src/hooks/` — app-wide client hooks

Globally relevant client hooks (React context consumers, browser-API adapters, cross-cutting behavior):

```
hooks/
├── use-media-query.ts              # Responsive breakpoints
├── use-scroll-to-top.ts
├── use-keyboard-shortcut.ts
└── use-local-storage.ts
```

Feature-specific hooks stay in the feature (see §3).

### 2.4 `src/lib/` — app-specific utilities

Pure utilities, configuration, and **typed wrappers over external services**. This is the "edge adapter" layer — it does not contain business rules, only translation between an outside protocol and the app's types.

```
lib/
├── auth/
│   ├── session.ts                  # reads/validates the session
│   ├── actions.ts                  # sign-in / sign-out helpers
│   └── guards.ts                   # requireUser, requireRole
├── anime/
│   ├── service.ts                  # calls into @nexus/db + @nexus/cache
│   └── tmdb.ts                     # TMDB API client + Zod responses
├── stripe/
│   ├── client.ts
│   └── webhooks.ts                 # webhook signature verification
├── cloudflare/
│   └── stream.ts                   # signed URL generation
├── image/
│   └── loader.ts                   # next/image loader for Cloudflare R2 / TMDB
├── http.ts                         # shared fetch, ApiError helpers, envelope
├── cn.ts                           # clsx + tailwind-merge helper
└── format.ts                       # domain-formatting helpers (duration, date)
```

`lib/` is allowed to import from `packages/` (@nexus/db, @nexus/cache, @nexus/ui) but **not from `features/`**. Features import from `lib/`, never the reverse.

### 2.5 `src/actions/` — app-wide Server Actions

Migrations that are too broad for a single feature but not quite `lib/` helpers — typically app-level auth mutations:

```
actions/
├── auth.ts
└── session.ts
```

When an action needs domain logic from a feature, it delegates to the feature's own `actions.ts` rather than duplicating logic.

### 2.6 `src/styles/` — global styling entry

```
styles/
└── globals.css       # Tailwind entry + theme tokens, minimal global overrides
```

Avoid growing this — every non-trivial style belongs in a component or a `@nexus/ui` theme token.

---

## 3. `src/features/<name>/` — feature-based vertical slices

Each feature is a self-contained directory owning **everything** specific to its domain: server components, client components, hooks, actions, schemas, types, and tests. Features are the primary organizing unit of the app.

### 3.1 Feature template

```
features/auth/
├── index.ts                            # public barrel
├── components/
│   ├── LoginForm.tsx
│   ├── OAuthButtons.tsx
│   └── AuthCard.tsx
├── hooks/
│   └── use-session.ts
├── actions/
│   ├── login.ts
│   ├── signup.ts
│   └── logout.ts
├── schemas/
│   └── auth-schema.ts                  # input Zod schemas
├── types/
│   └── auth-types.ts
├── lib/
│   └── redirects.ts                    # auth redirect resolution
├── routes/
│   ├── login/page.tsx                  # app-router pages for this feature
│   ├── signup/page.tsx
│   └── forgot-password/page.tsx
└── __tests__/ or *.test.ts(x)          # tests colocated with the source
```

### 3.2 Feature roster (current + planned)

| Feature | Domain |
|---------|--------|
| `auth` | Auth.js v5 config, sessions, login, OAuth |
| `catalog` | Anime detail, season/episode, genres, search |
| `watchlist` | Watchlist, continue-watching, activity |
| `video` | Signed playback, player chrome, progress |
| `profile` | User profile, settings, billing info |
| `payments` | Stripe subscriptions, checkout, webhooks |
| `notifications` | In-app notices, email preferences |
| `social` | Comments, reviews, follows |

Each feature has a spec in `docs/milestones/` and a corresponding label in `.github/labels.yml`.

### 3.3 Feature directory rules

- **Every feature has an `index.ts` barrel** (see §7). The barrel is the only public entry point.
- **Hooks, components, actions, schemas, and types** live in their respective subdirectories by kind — not in a flat `src/` list inside the feature.
- **Routes** that serve the feature live in `feature/routes/` (or, when shared by multiple features, in `app/`). The rule: put the route directory closest to the feature that owns its content, and hoist to `app/` only when more than one feature renders the route.
- **Tests** are colocated — see §8.

### 3.4 Cross-feature rules  (R, the most important section)

A feature may **never** import another feature directly. This is the backbone of the modular monolith — it keeps features extractable as packages later without re-plumbing.

Allowed import graph:

```
     @nexus/ui  ←─────────────┐
     @nexus/db  ←─────────┐   │
     @nexus/cache  ←─────┐ │   │
                          │ │   │
     ┌─────────────┐      │ │   │
     │ feature/auth │ ──►──┼─┼──► packages/*
     └─────────────┘      │ │   (always OK)
                          │ │
     ┌────────────────────┼─┼──────────┐
     │ feature/catalog    │ │          │
     │  components/       │ │          │
     │  hooks/            │ │          ▼
     │  actions/    ──────►│ │        lib/*
     │  schemas/          │
     │  types/            │
     └────────────────────┘
             │
             │ (catalog imports auth) → FORBIDDEN
             ▼
     For cross-feature use, lift the shared piece into
     components/, hooks/, lib/, or packages/.
```

**How to share stuff between features:**

| Pattern | When | Where to put it |
|---------|------|-----------------|
| A shared component | Used by ≥2 features | `components/` |
| A shared hook | Same | `hooks/` |
| Shared logic / formatting | Same | `lib/` |
| Shared types or Zod schemas used across features | Same | `packages/` (e.g. a `domain` package when one materializes, or extracted into a shared type file in the meantime) |
| Shared UI primitive or token | Same | `@nexus/ui` |

When in doubt: if two features need it, it's not a feature concern, it's an app or package concern.

---

## 4. `packages/` — shared libraries

```
packages/
├── ui/                         # @nexus/ui        — design system
│   ├── src/
│   │   ├── components/         # shadcn/ui-based primitives
│   │   ├── hooks/
│   │   ├── styles/             # Tailwind tokens, @theme
│   │   └── lib/
│   ├── package.json            # name: @nexus/ui
│   └── tsconfig.json
├── db/                         # @nexus/db        — Drizzle schema + client
│   ├── src/
│   │   ├── schema/             # per-domain table files (anime.ts, user.ts, ...)
│   │   ├── migrations/
│   │   ├── client.ts
│   │   └── lib/                # helpers (eq wrappers, pagination)
│   ├── package.json            # name: @nexus/db
│   └── tsconfig.json
├── cache/                      # @nexus/cache     — Redis
│   ├── src/
│   │   ├── index.ts            # re-exports helpers
│   │   ├── keys.ts
│   │   ├── client.ts
│   │   ├── rate-limit.ts
│   │   └── feature-flags.ts
│   └── package.json            # name: @nexus/cache
└── config-eslint/              # @nexus/eslint-config
    ├── index.js
    └── package.json            # name: @nexus/eslint-config
```

### 4.1 Package rules

- All packages are scoped `@nexus/*`. A new feature that crosses app boundaries becomes a new `@nexus/*` package — do not nest it inside an existing package.
- Each package exposes a **single barrel** (`src/index.ts` or the package root) as its public API. Internal files under `src/lib/`, `src/internal/`, or prefixed `_` are not imported outside the package.
- Packages may import each other only via declared `package.json` dependencies. `@nexus/db` may import `@nexus/cache` if both agree — but cycles are rejected by both the package manager and review.

### 4.2 When to create a new package

Create a new `@nexus/*` package when:
- The code is consumed by **two or more apps** (today, just `web`; second app e.g. `admin`).
- The code is a **stable standalone library** with its own backward-compatibility needs (e.g. `@nexus/ui`).
- The code must ship its own API contract that other features are forbidden to bypass.

Do not package a feature's logic that only `apps/web/` uses — keep it in `features/`.

---

## 5. `tooling/` — dev-time infrastructure

Not shipped, not bundled, not part of the public API.

```
tooling/
├── docker/
│   ├── docker-compose.yml      # Postgres + Redis + Mailpit
│   ├── Dockerfile (later)
│   └── .dockerignore
└── scripts/
    ├── seed-admin.ts
    ├── seed-anime.ts
    ├── seed-catalog.ts
    ├── migrate.ts
    └── reset-db.ts
```

Run scripts with `pnpm tsx tooling/scripts/<name>.ts`. Scripts are allowed to import `@nexus/*` packages directly. They must **not** be imported by app or package code — they are entry points, not libraries.

---

## 6. `docs/` — documentation

```
docs/
├── README.md                   # docs index + how to author specs
├── master-roadmap.md           # Milestone table
├── REPOSITORY-DESIGN.md        # "repo constitution"
├── api.md                      # route contracts, envelope, error codes
├── auth.md                     # Auth.js config, session shape, middleware
├── cache.md                    # Redis keys, TTLs, feature-flag layout
├── database.md                 # schema, migrations, dialects
├── deployment.md               # Vercel config, edge headers, env vars
├── architecture/
│   └── adr/
│       ├── 000-record-architecture-decisions.md
│       ├── 001-modular-monolith-nextjs.md
│       └── NNN-<title>.md
├── milestones/
│   ├── milestone-0-repository-scaffold.md
│   ├── milestone-1-project-foundation.md
│   └── milestone-N-<title>.md
├── decisions/
│   └── <decision-log>/         # (optional) narrative decision docs
└── 12-conventions/             # ← this directory
    ├── Coding-Standards.md
    ├── Naming-Conventions.md
    ├── Folder-Conventions.md
    └── Git-Workflow.md
```

### 6.1 Docs living in code

- Code-root configuration files (`tsconfig.base.json`, `turbo.json`, `prettier.config.js`) are self-documenting where practical; long-form rationale lives in `docs/` with source links.
- Every ADR in `architecture/adr/` has an immutable status. Changes arrive as new ADRs with a link back.
- Each spec in `milestones/` is the success criteria for that milestone.

### 6.2 Docs in `12-conventions/`

The `12-conventions/` directory is reserved for the conventions suite:
- `Coding-Standards.md`
- `Naming-Conventions.md`
- `Folder-Conventions.md` (this file)
- `Git-Workflow.md`

The leading `12-` prefix is an ordinal sort key so that convention docs sort stably in `docs/` listings; all four files carry the prefix implicitly by virtue of living in `12-conventions/`.

---

## 7. Barrel Exports (`index.ts`)

### 7.1 One barrel per feature, one per package

Every feature and every package exposes a **single** `index.ts` at its root. Features import from the barrel; they never reach past it into `components/`, `hooks/`, etc.

```ts
// features/auth/index.ts
export { LoginForm } from "./components/LoginForm";
export { OAuthButtons } from "./components/OAuthButtons";
export { useSession } from "./hooks/use-session";
export { login, signup } from "./actions";          // re-namespaced
export type { AuthSession } from "./types/auth-types";
```

```ts
// Consumer
import { LoginForm, useSession } from "@/features/auth";
```

### 7.2 Rules

- The barrel lists every **public** consumer it exports. If the consumer doesn't appear in the barrel, it's not part of the public API — and consumers may not reach past it.
- **Default exports are forbidden** in barrel files. Barrel consumers should use named imports so they survive a rename.
- **Only export what is consumed.** Don't "pre-export" every file in the barrel speculatively. Exports are API surface — treat them like one.
- Imports from `../lib/` or `../packages/*` are fine inside the barrel. Imports from another feature are not, even through a barrel.

### 7.3 No barrel re-exports of barrels  (P)

Avoid chains of barrel re-re-export (a barrel that mostly re-exports another barrel). It confuses readers and bundlers. One hop, then stop.

---

## 8. Test Colocation

### 8.1 Default: colocate with source  (P)

Tests live next to the code they cover, using `<source>.test.ts` naming:

```
features/catalog/
├── components/
│   ├── AnimeCard.tsx
│   └── AnimeCard.test.tsx
├── hooks/
│   └── useAnime.ts
│   └── useAnime.test.ts
├── actions/
│   └── watchlist.ts
│   └── watchlist.test.ts
└── ...
```

Benefits: refactoring moves source and test together; finding tests is effortless; distantly-located tests are forgotten tests.

### 8.2 When to use `tests/` directories  (P)

When test fixtures, vitest global setup helpers, and integration scenarios grow large enough to crowd the source directory, nest them in a `tests/` directory **at the same level as, not inside,** the source:

```
features/catalog/
├── components/
├── hooks/
└── tests/
    ├── fixtures/                     # shared mock data
    ├── integration/
    │   └── watchlist-flow.test.ts
    └── unit/
        └── useAnime.test.ts
```

Mirror the `src/` subdirectory layout inside `tests/` so file names stay guessable.

### 8.3 App-level tests

Integration and end-to-end tests (Playwright scenarios, auth flows, payment flows) live in `apps/web/tests/` or a sibling `e2e/` at the app root:

```
apps/web/
└── e2e/
    ├── auth.login.spec.ts
    ├── watchlist.add.spec.ts
    └── playback.start.spec.ts
```

---

## 9. Anti-Patterns

| Anti-pattern | Fix |
|--------------|-----|
| `features/auth/.../CatalogCard.tsx` (a component from another feature) | Move it to `features/catalog/components/` or `components/`. |
| `import { x } from "@/features/catalog/components/CatalogCard"` inside `features/auth/` | Import from `@/features/auth` via barrel, or lift shared UI to `components/`. |
| `src/index.ts` files that re-barrel every sibling file | Export only what is actually consumed. |
| A `util.ts` / `helper.ts` in 8 namespaces | One `lib/cn.ts`, `lib/format.ts`, `lib/http.ts` — not one `helpers.ts` per feature. |
| A `src/components/` file with a feature-specific name (`WatchlistButton`) | Move it into `features/watchlist/components/`. |
| A feature directory with 30+ files at a single level | Split into sub-features. |
| `apps/web/tests/` inside `features/` | Move to `features/<name>/tests/` or `apps/web/tests/` as appropriate. |

When in doubt, the test is: **if I delete this feature's directory, does it break anything outside this feature?** If yes, the code is misplaced.
