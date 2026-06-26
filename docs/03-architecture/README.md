# Software Architecture — Nexus Anime

> Step 4 documentation. Complete software architecture design before implementation.

## Documents

| # | Document | Purpose |
|---|----------|---------|
| 1 | [Architecture.md](Architecture.md) | Architectural style, layered monolith, feature-based design, component architecture, Server/Client boundary, repository pattern, service layer, API abstraction, route groups, Suspense strategy, error boundaries, SEO, i18n readiness, a11y, future backend/mobile |
| 2 | [Folder-Structure.md](Folder-Structure.md) | Every directory mapped to its responsibility, with rationale |
| 3 | [Feature-Modules.md](Feature-Modules.md) | Feature module contract, all 6 features cataloged, cross-feature rules, lifecycle |
| 4 | [Routing.md](Routing.md) | Route architecture, route groups, middleware, dynamic routes, navigation, API routes |
| 5 | [Rendering-Strategy.md](Rendering-Strategy.md) | SSG/ISR/SSR/CSR per route, component rendering, streaming, image optimization, metadata |
| 6 | [State-Management.md](State-Management.md) | 4 state categories, Server Components vs React Query vs Zustand vs URL state, optimistic updates |
| 7 | [API-Layer.md](API-Layer.md) | Server Actions vs Route Handlers, envelope format, error codes, external clients, rate limiting |
| 8 | [Authentication-Architecture.md](Authentication-Architecture.md) | Auth.js v5, providers, sessions, OAuth flow, RBAC, password security, email verification |
| 9 | [Caching-Strategy.md](Caching-Strategy.md) | 4 cache layers, Redis key schema, TTLs, invalidation, SWR, feature flags |
| 10 | [Error-Handling.md](Error-Handling.md) | Error hierarchy, serialization, boundaries by layer, validation errors, upstream handling |
| 11 | [Logging.md](Logging.md) | Pino structured logging, log levels, request correlation, audit trail, what not to log |
| 12 | [Performance.md](Performance.md) | CWV targets, rendering perf, data fetching perf, asset perf, JS budgets, measurement |
| 13 | [Scalability.md](Scalability.md) | Traffic/data/team/feature scaling, extraction strategy, geographic scaling, cost estimates |
| 14 | [Security-Architecture.md](Security-Architecture.md) | Threat model, defense-in-depth, input/output validation, CSP, video security, payment security |
| 15 | [Dependency-Graph.md](Dependency-Graph.md) | Package deps, import rules, feature dependency matrix, circular dep prevention, Turborepo pipeline |

## Design Principles

Every architectural decision in this directory follows these principles (in priority order):

1. **Maintainability** — readable to a new engineer in 30 minutes
2. **Performance** — streaming platform; latency is existential
3. **Security** — OAuth, Stripe, signed video URLs
4. **Scalability** — architecture accommodates growth without restructuring
5. **Readability** — TypeScript strict, no `any`, no `ts-ignore`

## Relationship to ADRs

Architecture Decision Records (`docs/architecture/adr/`) capture *why* a decision was made. These documents describe *what* the architecture is and *how* to implement it. If a decision here conflicts with an ADR, the ADR wins until a new ADR is written.
