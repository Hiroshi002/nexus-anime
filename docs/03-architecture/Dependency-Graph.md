# Dependency Graph — Nexus Anime

> **Audience:** Engineers understanding module relationships and import rules. This document maps the dependency graph, enforceable boundaries, and import rules.

---

## 1. Package Dependency Graph

```
                    ┌──────────────┐
                    │   apps/web   │   Next.js application (deployable)
                    └──┬──┬──┬──┬─┘
                       │  │  │  │
            ┌──────────┘  │  │  └──────────┐
            │             │  │             │
            ▼             ▼  ▼             ▼
     ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐
     │ @nexus/ui  │ │ @nexus/db│ │@nexus/   │ │ @nexus/          │
     │            │ │          │ │ cache     │ │ config-eslint    │
     └────────────┘ └──────────┘ └──────────┘ └──────────────────┘
            │             │          │                  │
            │             │          │                  │
            ▼             ▼          ▼                  ▼
     External deps   Drizzle +   Upstash          eslint +
     (Radix, CVA,   Neon +       Redis           typescript-eslint
      tailwind-merge,  Zod
      lucide-react)
```

### Dependency rules (enforced by package boundaries)

| Package                | May depend on                                               | May NOT depend on                                                    |
| ---------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| `apps/web`             | All `@nexus/*` packages                                     | Nothing below this level can import from `apps/web`                  |
| `@nexus/ui`            | External UI deps (Radix, CVA, tailwind-merge, lucide-react) | `@nexus/db`, `@nexus/cache` — UI must be data-agnostic               |
| `@nexus/db`            | Drizzle, Neon, Zod                                          | `@nexus/ui`, `@nexus/cache` — DB must not know about UI or cache     |
| `@nexus/cache`         | Upstash Redis                                               | `@nexus/ui`, `@nexus/db` — Cache must not know about UI or DB schema |
| `@nexus/eslint-config` | ESLint, typescript-eslint                                   | All `@nexus/*` — lint config must not import application code        |

### Why these rules

- **`@nexus/ui` never depends on `@nexus/db`:** UI components receive data as props — they don't fetch data. If a Button needed to import a database type, it would be tightly coupled to our schema and unusable as a standalone design system.
- **`@nexus/db` never depends on `@nexus/cache`:** The database layer is the lowest data authority. Cache sits above it (application decides to check cache before DB). If DB depended on cache, it would create a circular dependency (cache depends on DB for data, DB depends on cache for lookups).
- **`@nexus/cache` never depends on `@nexus/db`:** Cache stores serialized data (JSON strings), not typed DB records. It doesn't need to know the schema.

---

## 2. Application-Level Dependency Graph

Within `apps/web/src/`, dependencies flow downward through the layers:

```
┌───────────────────────────────────────────────────────────┐
│  app/ (Next.js App Router)                                │
│  Routes, layouts, error boundaries, loading states         │
│  Imports: features/, shared/, services/                    │
├───────────────────────────────────────────────────────────┤
│  features/ (Feature modules)                               │
│  Components, actions, hooks, types per feature             │
│  Imports: shared/, services/ (via actions)                 │
│  NEVER imports: other features/                            │
├───────────────────────────────────────────────────────────┤
│  services/ (Application services)                          │
│  Business logic, orchestration                             │
│  Imports: @nexus/db, @nexus/cache, lib/clients/           │
│  NEVER imports: features/, app/                            │
├───────────────────────────────────────────────────────────┤
│  shared/ (Cross-feature shared)                            │
│  Components, hooks, lib, types                             │
│  Imports: @nexus/ui (for shared components only)           │
│  NEVER imports: features/, services/                       │
├───────────────────────────────────────────────────────────┤
│  lib/ (App-level utilities)                                │
│  External API clients, auth config, middleware,            │
│  Zod schemas                                               │
│  Imports: @nexus/db, @nexus/cache (for auth config)       │
│  NEVER imports: features/, services/, shared/              │
└───────────────────────────────────────────────────────────┘
```

### Enforced import rules

| From            | Can import                                               | Cannot import                       | Why                                                   |
| --------------- | -------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------- |
| `app/`          | `features/`, `shared/`, `services/`, `lib/`              | —                                   | Routes compose features and shared layout             |
| `features/<a>/` | `shared/`, `services/` (via actions), `lib/validations/` | `features/<b>/` (other features)    | Prevents feature coupling                             |
| `services/`     | `@nexus/db`, `@nexus/cache`, `lib/clients/`              | `features/`, `app/`, `shared/`      | Services are infrastructure-adjacent, not UI-adjacent |
| `shared/`       | `@nexus/ui`                                              | `features/`, `services/`            | Shared code is lowest-common-denominator              |
| `lib/`          | `@nexus/db`, `@nexus/cache`, external deps               | `features/`, `services/`, `shared/` | Utilities are leaf nodes                              |

---

## 3. External Dependency Map

### Production dependencies

| Package                    | Version | Purpose                                | License            |
| -------------------------- | ------- | -------------------------------------- | ------------------ |
| `next`                     | 15.x    | Framework (App Router, SSR, ISR)       | MIT                |
| `react`                    | 19.x    | UI library                             | MIT                |
| `drizzle-orm`              | latest  | Type-safe SQL query builder            | Apache-2.0         |
| `@neondatabase/serverless` | latest  | Neon Postgres driver                   | MIT                |
| `@upstash/redis`           | latest  | Upstash Redis client                   | MIT                |
| `next-auth`                | v5 beta | Authentication                         | ISC                |
| `zod`                      | latest  | Schema validation                      | MIT                |
| `stripe`                   | latest  | Payment processing                     | MIT                |
| `@radix-ui/*`              | latest  | Accessible primitives (via shadcn/ui)  | MIT                |
| `class-variance-authority` | latest  | Component variant styling              | MIT                |
| `tailwind-merge`           | latest  | Tailwind class dedup                   | MIT                |
| `lucide-react`             | latest  | Icon library                           | ISC                |
| `framer-motion`            | latest  | Animation (complex orchestration only) | MIT                |
| `@tanstack/react-query`    | latest  | Client-side data cache                 | MIT                |
| `zustand`                  | latest  | Minimal global state                   | MIT                |
| `dompurify`                | latest  | HTML sanitization                      | Apache-2.0/MPL-2.0 |
| `pino`                     | latest  | Structured logging                     | MIT                |

### Why these dependencies, specifically

Every production dependency was evaluated against three criteria:

1. **Is it actively maintained?** (commits in the last 6 months, responsive maintainer)
2. **Is it the standard choice in the ecosystem?** (reduces onboarding time, more Stack Overflow answers)
3. **Is the bundle size proportional to its value?** (Framer Motion is 30KB but we reserve it for complex orchestration — not every animation)

### Dependencies we explicitly avoid

| Package             | Why avoided                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `moment`            | 70KB; dead; use `Intl` or `date-fns`                                                                                           |
| `lodash`            | 70KB full; individual imports are tree-shakeable but `lodash-es` still pulls more than needed; use native Array/Object methods |
| `axios`             | Adds interceptors and transforms we don't need; `fetch` is native in Next.js                                                   |
| `redux`             | Overkill for our state surface; Zustand is 1KB vs 7KB+                                                                         |
| `styled-components` | -runtime CSS-in-JS adds ~15KB; Tailwind 4 is our styling system                                                                |
| `react-helmet`      | Deprecated in App Router; use Metadata API                                                                                     |

---

## 4. Feature Dependency Matrix

Which features depend on which services, repositories, and external APIs:

| Feature   | Services            | Repositories                                                 | External APIs              | Cache                          |
| --------- | ------------------- | ------------------------------------------------------------ | -------------------------- | ------------------------------ |
| auth      | `auth.service`      | `user.repository`, `session.repository`                      | Google OAuth, GitHub OAuth | —                              |
| catalog   | `catalog.service`   | `anime.repository`, `episode.repository`, `genre.repository` | TMDB, AniList              | Redis (anime, trending, genre) |
| watchlist | `watchlist.service` | `watchlist.repository`                                       | —                          | Redis (watchlist)              |
| player    | `streaming.service` | `watch-progress.repository`                                  | Cloudflare Stream          | —                              |
| payments  | `payments.service`  | `subscription.repository`                                    | Stripe                     | —                              |
| profile   | `auth.service`      | `user.repository`, `watch-progress.repository`               | —                          | —                              |

### Why this table matters

When planning a change to `anime.repository`, this table shows exactly which features are affected: `catalog`. When changing `user.repository`, two features are affected: `auth` and `profile`. The matrix prevents "I didn't realize that change would break X" surprises.

---

## 5. Circular Dependency Prevention

### ESLint import boundaries

Circular dependencies are prevented by ESLint rules configured in `@nexus/eslint-config`:

```ts
// eslint-plugin-boundaries (or custom rule)
{
  "rules": {
    "boundaries/element-types": ["error", {
      "default": "allow",
      "rules": [
        { "from": "features", "disallow": ["features"], "message": "Features must not import from other features" },
        { "from": "services", "disallow": ["features", "shared"], "message": "Services must not import from features or shared" },
        { "from": "shared", "disallow": ["features", "services"], "message": "Shared must not import from features or services" },
      ]
    }]
  }
}
```

### Why ESLint enforcement over convention alone

Convention ("don't import from other features") works until someone is in a hurry. ESLint enforces at CI time — there's no way to merge a PR that violates the boundary. This is defense-in-depth for architecture rules.

---

## 6. Dependency Update Strategy

| Strategy         | Tool          | Frequency                              | Risk                               |
| ---------------- | ------------- | -------------------------------------- | ---------------------------------- |
| Security patches | Dependabot    | Immediate (auto-merge for patch-level) | Low — patch-level only             |
| Minor updates    | Dependabot    | Weekly PRs                             | Medium — reviewed before merge     |
| Major updates    | Manual        | Quarterly or when needed               | High — requires migration, testing |
| Lockfile refresh | `pnpm update` | Monthly                                | Low — catches transitive updates   |

### Why auto-merge for security patches

A critical CVE in `drizzle-orm` or `next-auth` should be patched immediately, not wait for a human review. Dependabot auto-merges patch-level updates (e.g., 1.2.3 → 1.2.4) only after CI passes. Major/minor updates (1.2.3 → 2.0.0) always require human review.

---

## 7. Turborepo Pipeline Dependencies

```json
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**"]
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### Task dependency explanation

- `build` depends on `^build` (all dependencies' builds must complete first). This ensures `@nexus/ui` is built before `apps/web` builds.
- `lint` and `typecheck` depend on `^build` because they need the built `.d.ts` files from dependencies.
- `test` depends on `build` (the app must be built before integration tests run).
- `dev` has no cache and is persistent (long-running dev server).

### Why Turborepo pipeline deps

Without pipeline deps, `apps/web` might try to build before `@nexus/ui` is ready, causing "cannot find module @nexus/ui" errors. Turborepo's `dependsOn` resolves the correct build order automatically.
