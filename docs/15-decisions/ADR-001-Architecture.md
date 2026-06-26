# ADR-001 — Layered Modular Monolith as the System Architecture

- **Status:** accepted
- **Deciders:** Tech Lead, Staff Engineer
- **Date:** 2026-04-10
- **Supersedes:** None
- **Superseded by:** None
- **Related:** ADR-002, ADR-004, ADR-005
- **References:** docs/03-architecture/Architecture.md, docs/REPOSITORY-DESIGN.md

## Context

Nexus Anime is a streaming platform built by a small-to-mid team (3–8
engineers) targeting a single deployable web application in the near term, with
a possible native mobile client in the longer term. The product surface is
catalog browsing, video playback, watchlist management, and user profiles — a
bounded domain with well-understood entities and no exotic consistency
requirements.

We needed an architecture that would let the team move quickly in the first
milestones (M0–M2: scaffold, design system, catalog foundation) without
accumulating coupling that would slow us down in M3 (auth) and beyond. The
forces at play were:

- **Team size.** With 3–8 engineers, coordination overhead is the dominant
  cost. Microservices multiply the number of deployment units, CI pipelines,
  and failure modes each engineer must hold in their head.
- **Single deployable.** There is one UI surface today (`apps/web`). A
  distributed architecture solves a problem we do not have.
- **Domain complexity.** This is a streaming catalog, not a financial
  trading platform. The domain is well-understood, the entities are few, and
  the invariants are simple (a watchlist entry either exists or it does not).
- **Future extraction.** The team may want to extract a service or add a
  mobile client after M5. The architecture must make extraction cheap when the
  time comes — it must not require it today.

We considered three alternatives:

1. **Microservices.** Separate services for catalog, user, video, and
   payments. Rejected because operational overhead (service mesh, distributed
   tracing, per-service CI) is premature for a single-product team at this
   scale. Network latency between services would also hurt page-load
   performance for catalog pages that need data from multiple domains.
2. **Monolith without layers.** A single `app/` folder with no layering
   rules. Rejected because it leads to tight coupling over time — a change in
   video playback could silently break authentication. Without enforced
   dependency direction, circular imports accumulate and the codebase becomes
   a big ball of mud within 12–18 months.
3. **Micro-frontends.** Multiple frontend apps (catalog, video, user)
   composed at runtime. Rejected because we have one UI surface and one team.
   Micro-frontends solve organizational scaling problems (independent deploy
   teams, technology heterogeneity) that we do not have.

## Decision

We use a **layered modular monolith** as the overarching system architecture.
The application is a single Next.js App Router project housed inside a
Turborepo monorepo. Code is organized into horizontal layers and vertical
feature modules.

### Layers

The application has four layers with a strict dependency rule:

```
Presentation (components, pages)
  → Application (Server Actions, Route Handlers, services)
    → Domain (types, validation, business rules)
      ← Infrastructure (repositories, external API clients, cache)
```

- A layer may only depend on the layer directly below it.
- Infrastructure implements Domain interfaces; Domain never imports
  Infrastructure. This inversion keeps business rules free of I/O concerns.
- The Presentation layer never imports Infrastructure directly.

### Feature modules

Within each layer, code is organized by feature (vertical slices), not by
technical role. A feature module for `watchlist` contains its components,
actions, services, and repositories in one directory tree. Cross-feature
imports are forbidden — shared code goes through `shared/`.

### Server Components as the default

Server Components are the default rendering mode. A component becomes a
Client Component (`"use client"`) only when it needs event handlers, React
hooks, browser APIs, or Framer Motion for complex orchestration. CSS
transitions handle micro-interactions.

### Repository and service patterns

Data access goes through a **Repository** layer that wraps Drizzle queries
and returns typed data — raw Drizzle result objects never leak out of the
repository. **Services** orchestrate business logic that spans multiple
repositories or external APIs. Services contain no framework imports (`next/`,
`next-auth`) so they are testable and reusable across Server Actions and
Route Handlers.

### External API abstraction

Every external integration (TMDB, AniList, Stripe, Cloudflare Stream) is
wrapped in a dedicated client module that exports typed functions, validates
responses with Zod, handles retries with exponential backoff, and logs
structured errors. Upstream API shapes never leak into application logic.

## Consequences

### Positive

- **Simple deployment.** One Vercel deployment, one set of environment
  variables, one CI pipeline. An engineer can reason about the entire
  system without context-switching between repos.
- **Shared types.** `@nexus/ui`, `@nexus/db`, and `@nexus/cache` are shared
  packages consumed by the app. A schema change in `@nexus/db` surfaces as
  a TypeScript error in the app at compile time, not at runtime.
- **Clear dependency direction.** The layer rule prevents circular imports
  and makes it obvious where a new feature belongs. A new engineer can
  locate any file within 30 seconds by following the layer and feature
  conventions.
- **Future extraction.** Services are the seam. Today they call
  repositories; tomorrow they can call HTTP clients. The service interface
  stays the same; only the implementation changes. This is why the
  service layer exists — it is the application's protection against
  infrastructure changes.
- **Mobile-ready API.** Route Handlers provide REST endpoints from day one.
  When a mobile client arrives, it consumes the same services the web app
  uses, through the same envelope format, with the same Zod validation.

### Negative

- **Risk of tight coupling.** A monolith makes it easy to reach across
  boundaries. A developer can import a repository from a component, or
  write business logic in a Server Action, without a physical barrier
  stopping them.
  **Mitigation:** ESLint rules in `@nexus/eslint-config` enforce layer
  boundaries and the cross-feature import ban. CI rejects violations.
- **Single point of failure.** A bug in any module can affect the entire
  application. There is no process isolation.
  **Mitigation:** Suspense boundaries and route-level error boundaries
  contain failures. A broken watchlist component does not break video
  playback.
- **Scaling ceiling.** At very high traffic (millions of concurrent
  viewers), a single monolith may need to be split. We accept this risk
  because we are orders of magnitude away from that scale today, and
  premature splitting is worse than measured extraction later.
- **Turborepo build time.** As the repo grows, Turborepo build times
  increase. Remote caching (free on Vercel) mitigates this for CI, but
  local development may slow down.
  **Mitigation:** We keep the package count low (currently 3 packages + 1
  app) and add packages only when there is a clear consumer on both sides
  of the boundary.

### Compliance

- `pnpm typecheck` must pass with no `any` introduced.
- ESLint rule `nexus/no-feature-import` enforces the cross-feature import ban.
- ESLint rule `nexus/layer-boundary` enforces the layer dependency rule.
- Every new architectural decision requires an ADR (repo rule §19.7).
