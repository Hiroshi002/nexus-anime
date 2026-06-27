# Nexus Anime

Premium anime streaming platform with console-grade UI polish — a dark, cinematic portal built for gaming crossover and anime fans.

**Status:** Milestone 2 complete (Catalog foundation — DB, cache, API envelope, error boundaries)
**Roadmap:** [`docs/master-roadmap.md`](docs/master-roadmap.md)
**M1 Spec:** [`docs/milestone-1-project-foundation.md`](docs/milestone-1-project-foundation.md)

## Stack

| Layer          | Technology                                    |
| -------------- | --------------------------------------------- |
| Framework      | Next.js 16 (App Router) · React 19            |
| Language       | TypeScript (strict)                           |
| Monorepo       | pnpm workspaces · Turborepo                   |
| UI             | Tailwind CSS 4 · `@nexus/ui` design system    |
| Database (S2+) | PostgreSQL · Drizzle ORM · Neon (`@nexus/db`) |
| Cache (S2+)    | Upstash Redis (`@nexus/cache`)                |
| Auth (S4+)     | Auth.js v5                                    |
| Payments (S5+) | Stripe                                        |
| Video (S6+)    | Cloudflare Stream                             |
| Hosting        | Vercel Pro                                    |

## Repository structure

```
apps/web            Next.js application (deployable)
packages/ui         Design system primitives
packages/db         Drizzle schema, client, dialects (@nexus/db)
packages/cache      Redis cache, rate limiting, feature flags (@nexus/cache)
packages/config-*   Shared ESLint, TypeScript, Tailwind configs
tooling/docker      Local Postgres, Redis, Mailpit
tooling/scripts     Seed scripts (admin, anime, catalog)
docs/               Roadmap, sprint plans, ADRs, milestone specs
```

## Prerequisites

- Node.js 22 LTS (see `.nvmrc`)
- pnpm 9.x
- Docker (optional, for local Postgres/Redis/Mailpit)

## Quick start

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example apps/web/.env.local

# Start local backing services (optional until S2)
pnpm docker:up

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Design system showcase: [http://localhost:3000/dev/components](http://localhost:3000/dev/components).

## Scripts

| Command             | Description                          |
| ------------------- | ------------------------------------ |
| `pnpm dev`          | Start dev server (Turborepo)         |
| `pnpm build`        | Production build (all packages)      |
| `pnpm lint`         | ESLint across workspace              |
| `pnpm typecheck`    | TypeScript check                     |
| `pnpm test`         | Vitest unit tests                    |
| `pnpm format`       | Prettier format                      |
| `pnpm format:check` | Prettier check                       |
| `pnpm clean`        | Clean build artifacts                |
| `pnpm docker:up`    | Start Docker services                |
| `pnpm docker:down`  | Stop Docker services                 |
| `pnpm docker:reset` | Reset Docker services (wipe volumes) |
| `pnpm docker:logs`  | Tail Docker service logs             |

## Architecture

Layered modular monolith — see [ADR-001](docs/architecture/adr/001-modular-monolith-nextjs.md).

```
Edge (Cloudflare + Vercel)
  → Next.js App Router (Server Components + client islands)
    → Route handlers / Server Actions
      → Services → Repositories → @nexus/db (Drizzle + Neon)
                                  @nexus/cache (Upstash Redis)
```

API responses use a standard envelope: `{ data }` / `{ error: { message, code, details } }`.

## Milestone progress

| ID  | Milestone                                                      | Status      |
| --- | -------------------------------------------------------------- | ----------- |
| M0  | Repository scaffold                                            | ✅          |
| M1  | Design system in code                                          | ✅          |
| M2  | Catalog foundation (DB, cache, API envelope, error boundaries) | ✅          |
| M3  | Auth complete                                                  | In progress |
| M4  | User profiles, watchlist, continue-watching                    | Planned     |

## Repository conventions

The repository's branch strategy, workflow, versioning, folder structure, and process rules are defined in [`docs/REPOSITORY-DESIGN.md`](docs/REPOSITORY-DESIGN.md). Read it before creating branches, PRs, or issues.

## License

See [LICENSE](LICENSE).
