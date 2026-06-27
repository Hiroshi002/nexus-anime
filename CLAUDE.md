# CLAUDE.md — Nexus Anime

Engineering instructions for AI-assisted development. Read this before writing or editing code in this repository. It is the source of truth for how Claude should operate here.

## Project Overview

Nexus Anime is a premium anime streaming platform — a dark, cinematic portal built for gaming-crossover and anime fans. The deployable product is a Next.js 16 (App Router) web application in `apps/web`, backed by a modular TypeScript monorepo of shared packages (`@nexus/ui`, `@nexus/db`, `@nexus/cache`, `@nexus/eslint-config`). We are milestone-driven: M0–M2 (scaffold, design system, catalog foundation) are complete; M3 (auth) is in progress. See `README.md` and `docs/milestones/master-roadmap.md` for the current phase.

## Mission

Engineering goals, in priority order:

- **Maintainability** — code must be readable to a new engineer within 30 minutes. Prefer small files, clear names, and boring solutions.
- **Performance** — streaming is latency-sensitive. Favor SSR/ISR, dynamic imports, image optimization, and query optimization. Measure before optimizing.
- **Security** — we handle OAuth credentials, Stripe tokens, and signed video URLs. No secrets in code, no unsanitized user content, no client-side tokens.
- **Scalability** — the modular monolith (ADR-001) is designed for extraction. Do not prematurely distribute, but do respect package boundaries so extraction is cheap later.
- **Readability** — TypeScript strict mode, no `any`, no `ts-ignore`. Code reviews should catch logic, not decipher types.

## AI Behavior

Claude must:

- **Think before coding.** Read the relevant file and its neighbors before editing. If a file is unfamiliar, read it — do not infer from file name alone.
- **Prefer modifying existing code** over creating new files. New files are justified only when the new code has a distinct responsibility not already owned by an existing module.
- **Avoid unnecessary new files.** If a one-line change suffices, do not scaffold a module.
- **Explain important decisions** — a one-line comment on _why_ (not _what_) when the rationale is non-obvious.
- **Keep responses concise.** One paragraph for explanations; bullet points for changes; no preamble.
- **Ask one question** if requirements are ambiguous. Do not guess.
- **Never guess.** If the architecture, schema, or API contract is unclear, read the relevant doc or ask.

## Workflow

Every implementation must follow this sequence:

1. **Understand task** — restate the request in one sentence if it could be interpreted multiple ways.
2. **Read related files** — the file to edit, its tests, the module it imports from, the route handler that calls it.
3. **Review architecture** — check `docs/architecture/adr/` for any ADR that constrains the design; check `docs/REPOSITORY-DESIGN.md` for repo-wide conventions.
4. **Produce implementation plan** — list the files to change, the order, and the contract (types, route shape, DB migration).
5. **Wait if planning only** — if the user asked for a plan, stop here.
6. **Implement requested scope only** — no unrelated refactors, no "while I'm here" changes.
7. **Self-review** — re-read the diff as if reviewing a colleague's PR. Check types, edge cases, error paths.
8. **Explain changes** — one paragraph: what changed, why, and where to verify.

Never implement unrelated features.

## Architecture Rules

Architecture is authoritative. Claude must never invent architecture.

Reference documentation under `/docs`. Priority order (highest first):

1. `docs/architecture/adr/` — ADRs govern structural decisions. A new ADR is required to depart from an accepted ADR.
2. `docs/database.md` (or `packages/db/src/schema/*`) — schema, migrations, dialects.
3. `docs/api.md` (or `apps/web/app/api/**`) — route contracts, envelope shape, error codes.
4. `docs/auth.md` — Auth.js config, providers, middleware, session shape.
5. `docs/cache.md` — Redis usage, key schema, TTLs, feature-flag layout.
6. `docs/deployment.md` — Vercel config, env vars, edge headers.

Layered modular monolith (ADR-001):

```
Edge (Cloudflare + Vercel)
  → Next.js App Router (Server Components + client islands)
    → Route Handlers / Server Actions
      → Services → Repositories → @nexus/db (Drizzle + Neon)
                                  @nexus/cache (Upstash Redis)
```

API response envelope: `{ data }` for success, `{ error: { message, code, details } }` for failure. Use this everywhere — no ad-hoc error shapes.

## TypeScript Rules

- Strict mode is required. `tsconfig.base.json` sets `"strict": true` — do not relax it.
- No `any`. If a type is unknown, narrow it or use `unknown` with a type guard.
- No `ts-ignore`. If a third-party type is wrong, write a module augmentation or a typed wrapper.
- No implicit `any` in function params, returns, or module-level bindings.
- Reusable types live in `packages/*/src/types.ts` or alongside their consumer if truly local. Do not duplicate types across modules.
- Prefer discriminated unions for state machines (e.g. `VideoStatus`, `AuthState`, `WatchlistEntry`).
- Zod schemas are the single source of truth for runtime validation — derive TypeScript types from them with `z.infer`, do not hand-write a parallel interface.

## React Rules

Prefer:

- **Server Components** — default to `"use client"` only when the component uses state, effects, or browser APIs.
- **Server Actions** — for all mutations (form submissions, watchlist toggles, profile updates). Validate with Zod inside the action.
- **Suspense** — wrap async Server Components with `<Suspense>` and a meaningful skeleton; never block the entire page on one slow fetch.
- **Streaming** — use `React.cache()` for request dedup and `use()` for promise unwrapping where appropriate.
- **Custom Hooks** — extract reusable client logic (e.g. `useContinueWatching`, `useWatchlist`) into hooks under `apps/web/src/hooks/`.
- **Composition** — prefer small components composed together over large prop-heavy components.

Avoid:

- **Prop drilling** — if a prop passes through more than two levels, use context or colocate state.
- **Duplicated state** — do not mirror server state in `useState`; use TanStack Query or Server Components.
- **Unnecessary client components** — a component that only renders static markup must not be a client component.

## Next.js Rules

- App Router only. No `pages/` directory.
- Route Handlers for REST endpoints and webhooks (`apps/web/app/api/**`).
- Dynamic imports (`next/dynamic` or `React.lazy`) for heavy client components (video player, charting, rich text).
- Image Optimization via `next/image` or the Image Loader for Cloudflare R2 / TMDB images. Always set `width`, `height`, and `sizes`.
- Metadata API for every page — `generateMetadata` for dynamic routes, `metadata` for static ones.
- Static rendering by default; ISR where data changes on a known cadence; SSR only for personalized or real-time data.
- Middleware (`apps/web/src/middleware.ts`) for auth redirects and edge headers — keep it thin, no database calls.

## Styling Rules

Theme: **Wuthering Waves inspired** — dark, premium, glassmorphism, smooth animation, modern, mobile-first.

- Tailwind CSS 4 only. Do not introduce CSS-in-JS, styled-components, or global stylesheets.
- `@nexus/ui` is the source of truth for components, tokens, and theme. Do not reimplement buttons, modals, inputs, cards — extend them.
- Glassmorphism: `backdrop-blur`, semi-transparent surfaces, subtle borders. Use the theme tokens in `@nexus/ui`, not raw Tailwind classes.
- Animations: CSS transitions for micro-interactions; Framer Motion only for complex orchestration (page transitions, video player chrome).
- Mobile-first: design for 380px, then scale up. Test at 380, 768, 1024, 1440.
- Do not redesign existing UI unless explicitly requested. Polish, do not pivot.

## Database Rules

- Prisma (or Drizzle — see `packages/db`) is the only database access layer. No raw SQL in application code unless in a migration or a repository module.
- Write safe migrations: no column drops without a prior deprecation migration; no table renames without a view or alias transition.
- Avoid N+1 queries — use Drizzle's query builder with joins or Prisma's `include` / `select` deliberately.
- Prefer transactions for multi-statement writes (e.g. watchlist + watch-progress).
- Never delete production data automatically. Soft-delete via `deletedAt` timestamp; hard-delete only via an explicit admin tool or migration.
- Index foreign keys, columns used in `where`, and columns used in `orderBy`. Review the migration diff for missing indexes.

## Redis Rules

- Redis is **cache only**. Business logic must never depend on cache being warm.
- Cache key schema: `nexus:{entity}:{id}:{view}` (e.g. `nexus:anime:1234:detail`). Use `@nexus/cache` helpers, not raw `SET`/`GET`.
- TTLs: short (60s) for volatile data (trending, session), longer (15min) for catalog, explicit invalidation on mutation.
- Feature flags live in Redis but must have a safe default (off) when Redis is unreachable.
- Rate limiting uses Redis; a failed Redis call must not crash the request — fail open for reads, fail closed for writes only when security requires.

## API Rules

- Validate all input with Zod — request params, query string, body, and response shape.
- Validate output with Zod before returning from route handlers and Server Actions. Never trust the database or upstream API to return the shape you expect.
- Handle errors explicitly — a typed `ApiError` with `message`, `code`, `details`. No leaking stack traces to the client.
- Return typed responses: `NextResponse.json({ data })` or `NextResponse.json({ error: { message, code, details } })`.
- Never expose secrets, API keys, tokens, or internal URLs in any response.
- TMDB and AniList API keys live only on the server. Client receives data, never credentials.

## Security Rules

- Validate all external input — user content, upstream API responses, webhook payloads.
- Sanitize user-generated content (comments, profile bios) before rendering. Use DOMPurify for HTML, plain text for everything else.
- Never expose: API keys, secrets, tokens, internal URLs, database connection strings, Redis URLs.
- Auth.js v5 for session management. Credential provider for email/password; OAuth for Google/GitHub. No custom auth.
- Stripe handles card data — we never touch raw PANs.
- Cloudflare Stream signed URLs with short expiry (5 minutes) for video playback.
- Edge security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy) applied via `next.config.ts` and middleware.
- Zod validation on every boundary — client, route handler, Server Action, webhook.

## Performance Rules

Prefer:

- SSR for personalized pages (home, profile, watchlist).
- ISR for catalog pages (anime detail, season, episode list) with `revalidate` tuned to data change cadence.
- Lazy loading via `next/dynamic` for heavy client islands (video player, comment editor).
- Memoization (`useMemo`, `useCallback`, `React.memo`) only when profiling shows a bottleneck — not preemptively.
- Query optimization — select only needed columns, paginate with cursor-based pagination for infinite scroll, avoid `SELECT *`.
- Cache expensive operations — TMDB/AniList responses in Redis, static assets via Cloudflare, images via `next/image` + R2 loader.

Avoid premature optimization. Measure with Lighthouse, WebPageTest, or Vercel Analytics before adding complexity.

## File Organization

Prefer:

- Small files — target under 300 lines, hard cap at 400. Extract helpers, types, and constants when a file grows.
- Reusable utilities in `packages/*/src/lib/` or `apps/web/src/lib/`.
- Feature-based organization within `apps/web/src/`:
  ```
  apps/web/src/
    app/            # routes
    components/     # feature-scoped UI (anime/, auth/, video/)
    hooks/          # client hooks
    lib/            # shared utilities
    actions/        # Server Actions
    types/          # shared TS types
  ```
- Clear folder structure — a new engineer should guess correctly where a file lives.

Avoid files larger than 300–400 lines when practical. When a file exceeds the cap, split by responsibility, not by line count.

## Git Rules

- `main` is the only long-lived branch. Short-lived branches: `<type>/<milestone>-<slug>` where type ∈ `feature|bugfix|chore|docs|refactor|hotfix|release`, milestone ∈ `m0..mN`, slug ≤ 30 chars kebab-case.
- Conventional Commits: `feat:` (minor), `fix:` (patch), `BREAKING CHANGE` (major), `!` for breaking.
- Before large changes: summarize the implementation plan in the PR description.
- After changes: summarize modified files and why.
- Never rewrite git history (`rebase -i`, `amend`, `force-push`) on shared branches.
- Never delete user code without explicit permission.
- Squash-and-merge for PRs; delete the branch post-merge.

## Testing Checklist

Before finishing a task, verify:

- **Type safety** — `pnpm typecheck` passes; no `any` introduced.
- **Build safety** — `pnpm build` succeeds; no new TypeScript or lint errors.
- **Runtime safety** — happy-path, error path, and empty state all render without throwing.
- **Edge cases** — empty arrays, null upstream responses, expired sessions, network failures.
- **Error handling** — no unhandled promise rejections; no swallowed errors; user-facing messages are friendly.

## Completion Rules

Every completed task must include:

- **Summary** — one paragraph of what was built.
- **Files changed** — list of added/modified/deleted files.
- **Why changes were made** — the user request or bug that motivated the change.
- **Potential risks** — what could go wrong (migration side effects, new API surface, performance regression).
- **Next recommended task** — what the user should pick up next, if it is not obvious.

## Stop Conditions

Claude must stop and ask the user when:

- Requirements conflict (e.g. "add real-time updates" vs "no WebSockets in M3").
- Architecture is unclear (no ADR covers the decision, no doc specifies the contract).
- Security implications exist (new OAuth provider, new payment flow, new webhook).
- More than one implementation strategy is equally valid (SQL vs NoSQL, Redux vs Zustand, REST vs GraphQL).

Never assume. Ask one clarifying question and wait.
