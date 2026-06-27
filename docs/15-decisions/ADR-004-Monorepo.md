# ADR-004 — Turborepo + pnpm Workspaces for the Monorepo Layout

- **Status:** accepted
- **Deciders:** Tech Lead, Staff Engineer
- **Date:** 2026-04-08
- **Supersedes:** None
- **Superseded by:** None
- **Related:** ADR-001, ADR-005
- **References:** docs/REPOSITORY-DESIGN.md

## Context

The Nexus Anime codebase must share code between the web app (`apps/web`)
and potential future consumers (a mobile app, an admin dashboard, a
partner API). At minimum, the following must be shared:

- **UI components** — buttons, modals, cards, inputs. These are rendered
  in the web app today and will be rendered in any future client.
- **Database schema** — the Drizzle schema, migration files, and
  generated types. Any consumer that touches the database must use the
  same schema.
- **Cache logic** — Redis key schemas, TTLs, feature-flag layouts. A
  mobile app hitting the same Upstash instance must produce the same
  keys.
- **Configuration** — ESLint rules, TypeScript strictness, environment
  variable validation. Every consumer must adhere to the same quality
  bars.

The forces at play were:

- **Single deployable today.** The architecture ADR (ADR-001) commits to
  a single Next.js deployable. The monorepo must be cheap to operate
  when there is only one app.
- **Potential multiple deployables tomorrow.** We may add a React Native
  app, an Expo admin panel, or a Node.js worker for background jobs.
  Adding a new app should not require duplicating code or creating a
  separate repo.
- **Shared types.** TypeScript is strict mode. If two consumers import
  the wrong version of a shared type, we get runtime bugs. The
  monorepo must produce one canonical version of every shared package.
- **CI cost.** Every PR must run lint, typecheck, test, and build. The
  monorepo tool must cache aggressively so we are not re-running
  unchanged packages.

We considered three alternatives:

1. **Single repo, no monorepo tooling.** All code in one `src/` tree,
   one `package.json`, one build. Rejected because there is no way to
   enforce package boundaries — any file can import any other file. The
   shared packages would have no contract, no build pipeline, and no
   version history independent of the app.
2. **Multiple repos (polyrepo).** One repo per package (`nexus-ui`,
   `nexus-db`, `nexus-cache`, `nexus-web`). Rejected because:
   cross-repo changes require coordinated PRs across N repos, which
   is slow and error-prone; version management (dependabot, semver)
   is manual; local development requires cloning and linking N repos.
3. **Nx.** More powerful than Turborepo — generators, cross-cutting
   dependencies, affected-graph analysis. Rejected because that power
   comes with configuration overhead we do not need. Our repo has 3
   packages + 1 app. Nx is designed for 10+ apps/packages with complex
   cross-dependencies. Turborepo is proportional.

## Decision

We use **Turborepo + pnpm workspaces** as the monorepo tooling. The repo
has the canonical Turborepo layout:

```
/
  apps/
    web/          # Next.js app (the deployable)
  packages/
    ui/           # @nexus/ui — shared components + theme tokens
    db/           # @nexus/db — Drizzle schema + migrations
    cache/        # @nexus/cache — Upstash Redis wrapper
    eslint-config # @nexus/eslint-config — shared ESLint rules
  tooling/        # shared build/test configuration (future)
  docs/
  .github/
```

### Package scoping

All shared packages are scoped under `@nexus/*`. This prevents npm
namespace collisions and makes imports self-documenting:

```ts
import { Button } from "@nexus/ui";
import { anime } from "@nexus/db";
import { redis } from "@nexus/cache";
```

New packages must be scoped `@nexus/*` (repo rule §19.3).

### Workspace protocol

Internal dependencies use the `workspace:*` protocol:

```json
{
  "dependencies": {
    "@nexus/ui": "workspace:*",
    "@nexus/db": "workspace:*"
  }
}
```

`workspace:*` tells pnpm to resolve the dependency from the local
workspace, not from npm. This means we publish nothing to npm for
internal consumers — the monorepo is the single source of truth.

### Public API boundaries

Each package must declare a public API in its `package.json`
`exports` field. Consumers import from the package root, not from
internal paths:

```
# Correct
import { Button } from "@nexus/ui";

# Forbidden
import { Button } from "@nexus/ui/src/components/Button";
```

The `exports` field is enforced by `@nexus/eslint-config` rule
`nexus/no-internal-import`. Any import that reaches into a package's
`src/` is a CI error.

### Turborepo pipeline

`turbo.json` defines five pipeline tasks:

| Task        | Dependencies | Description                                       |
| ----------- | ------------ | ------------------------------------------------- |
| `build`     | `^build`     | Build this package and all packages it depends on |
| `dev`       | —            | Start dev server (no cache)                       |
| `lint`      | —            | Run ESLint                                        |
| `typecheck` | `^build`     | Run tsc (needs built types from deps)             |
| `test`      | `^build`     | Run vitest (needs built types from deps)          |

Remote caching is enabled via Vercel's Turborepo remote cache (free
tier). Every PR shares a cache with CI and `main`, so an unchanged
package builds in < 5 s.

### Package addition process

Adding a new package requires:

1. Create the directory under `packages/`.
2. Scope it `@nexus/*` with `private: true`.
3. Add `exports` to `package.json`.
4. Add it to `turbo.json` (inherits pipeline defaults).
5. Write an ADR if the package introduces an architectural dependency.

## Consequences

### Positive

- **Shared types across the whole codebase.** A Drizzle schema change
  in `@nexus/db` produces a TypeScript type error in `apps/web` at
  compile time. The type travels through the monorepo with zero
  serialization.
- **Single CI pipeline.** One `turbo run build lint typecheck test`
  command gates every PR. There is no per-package CI configuration.
- **Local development is simple.** `pnpm install` at the root installs
  everything. `pnpm dev` starts all apps and packages in watch mode.
  No `npm link`, no version juggling, no cross-repo PRs.
- **Cheap to add new apps.** When we need a mobile app (`apps/mobile`)
  or an admin panel (`apps/admin`), we create the directory, add the
  shared packages as `workspace:*` dependencies, and start building.
  No code is duplicated, no repo is forked.
- **Cache hit rate.** Turborepo caches per-package outputs. A change
  to `@nexus/cache` does not invalidate the build cache for `@nexus/ui`.
  CI stays fast as the repo grows.

### Negative

- **Cross-package coupling.** A monorepo makes it tempting to reach
  across package boundaries for a quick fix. Without enforcement,
  `@nexus/db` imports from `@nexus/cache` imports from `@nexus/ui`,
  and the dependency graph becomes a tangle.
  **Mitigation:** The `exports` field + `nexus/no-internal-import`
  rule enforces that consumers only use the public API. The ADR
  rule requires us to document new architectural dependencies.
- **Build coupling.** A broken type in `@nexus/db` blocks the build
  of `apps/web` (because `typecheck` depends on `^build`). A single
  broken package can block the entire team.
  **Mitigation:** Remote caching means a package only needs to be
  rebuilt if it or its dependencies change. The "broken type"
  scenario is caught in pre-commit hooks (lint + typecheck in < 10 s)
  before it reaches CI.
- **Repository size.** A monorepo contains all packages and all
  history in one Git repo. As the repo grows, clone times increase.
  For this repo's size (3 packages + 1 app), this is not a problem.
  If the repo exceeds ~500 MB of history, we can migrate to
  Turborepo's `git sparse-checkout` support or split read-only
  submodules.
- **pnpm strictness.** pnpm does not hoist dependencies by default.
  A package that is not declared in `package.json` cannot be
  imported. This is stricter than npm/yarn and catches missing
  dependencies immediately.
  **Mitigation:** This is a feature, not a bug. Engineers learn
  the correct habit of declaring dependencies in the right
  `package.json`. The error message is clear: "ERR*PNPM_MISSING*…".
- **Tooling lock-in.** Turborepo is maintained by Vercel. If Vercel
  discontinues Turborepo or changes pricing, we must migrate.
  **Mitigation:** Turborepo's config (`turbo.json`) is a < 50-line
  JSON file. Migration to Nx or a custom npm-workspace pipeline
  is a few hours of work. The dependency graph is explicit and
  portable.

### Compliance

- All new packages are scoped `@nexus/*` and marked `private: true`.
- Internal imports must use the package name, not internal paths.
  ESLint rule `nexus/no-internal-import` enforces this.
- `turbo run build lint typecheck test` must pass on every PR. The
  five CI gates are non-negotiable (repo rule §28).
- Adding a new package requires an ADR if it introduces an
  architectural dependency, or documentation if it is purely additive.
