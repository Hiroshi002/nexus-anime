# ADR-002 — Server-First State with Targeted Client Stores

- **Status:** accepted
- **Deciders:** Tech Lead, Senior Frontend Engineer
- **Date:** 2026-04-17
- **Supersedes:** None
- **Superseded by:** None
- **Related:** ADR-001
- **References:** docs/03-architecture/State-Management.md, docs/03-architecture/Rendering-Strategy.md

## Context

Next.js App Router gives us two fundamentally different execution
environments: the server (where we have direct access to the database and
Redis) and the client (where we have browser APIs and interactivity). State
management decisions must respect this boundary. A naive approach — "use
React Query for everything" or "use Zustand for everything" — wastes the
platform's strengths or ignores its constraints.

We needed a strategy for four categories of state:

1. **Server state.** Catalog listings, anime details, episode metadata.
   This data is fetched from the database or Redis and rendered to HTML on
   the server.
2. **Client cache.** Data fetched from the client after initial render,
   usually in response to a user action (adding to watchlist, submitting a
   comment).
3. **Client UI state.** Sidebar open/closed, current theme, video player
   state. This is transient and local to the browser.
4. **URL state.** Search queries, sort order, filter selections. This state
   must survive navigation and be shareable via URL.

The forces at play were:

- **Performance.** Streaming platforms are sensitive to Time to First Byte
  (TTFB) and hydration cost. Every kilobyte of client JS we ship is time
  added to interactive.
- **SEO.** Catalog pages must be crawlable. Client-only rendering of
  catalog content is unacceptable.
- **Complexity.** The team cannot afford to learn five state management
  tools. Each tool must have a clear, narrow responsibility.
- **Optimism.** Watchlist add/remove is a 99.9%-success mutation that
  should feel instant.

We considered two alternatives:

1. **Universal React Query.** Use `@tanstack/react-query` for all state
   including server-fetched data. Rejected because it forces the client to
   refetch data the server already has, adds 10–15 KB to the JS bundle,
   and produces worse TTFB (client must download, parse, and execute
   hydration code before it can display content).
2. **Single global store.** Use Zustand for everything. Rejected because
   Zustand is an in-memory client store — it cannot hold state across
   page transitions, it is invisible to the server, and it requires JS
   to render anything. A Zustand-only approach would regress us to a
   client-rendered SPA.

## Decision

We use **four distinct tools, each owning one category of state.** There is
no overlap: a piece of state has exactly one correct home.

| Category | Tool | Where it runs |
|---|---|---|
| Server state | Server Components + `React.cache()` | Server |
| Client cache | TanStack Query (`@tanstack/react-query`) | Client |
| Client UI | Zustand (two stores: `useUiStore`, `usePlayerStore`) | Client |
| URL state | `next/navigation` (`useSearchParams`, `useRouter`) | Client (URL is the source of truth) |

### Server state

Server Components fetch data directly from repositories (which may hit
Redis or the database) and render it to HTML. `React.cache()` deduplicates
requests within a single render pass. Cache invalidation uses
`revalidatePath` and `revalidateTag` — no client-side invalidation needed.

Server state is the default. If data can be fetched on the server, it
should be. Client-side fetching is the exception, justified only when the
data depends on a user action or changes too frequently for ISR.

### Client cache (TanStack Query)

TanStack Query is used exclusively for data that the client fetches in
response to a user action. Typical uses:

- Watchlist queries (key: `["watchlist", userId]`, stale 30 s).
- Watch progress mutations (stale 0 — always refetch after mutation).
- Search suggestions (key: `["search", query]`, stale 60 s).

We chose TanStack Query over SWR because:

- Built-in `onMutate` + `onError` optimistic rollback (SWR requires manual
  implementation).
- Official DevTools for debugging.
- Multi-framework ecosystem (if we add React Native later, the same mental
  model applies).

Defaults: `staleTime: 60s`, `gcTime: 5min`, `refetchOnWindowFocus: false`,
`retry: 2` with exponential backoff.

### Client UI (Zustand)

Zustand holds two global stores:

- `useUiStore`: sidebar open/closed, current theme, modal stack.
- `usePlayerStore`: current episode, playback position, quality setting.

We chose Zustand over Redux (ceremony disproportionate to our needs),
Context (re-renders on every state change unless carefully memoized),
and Jotai/Recoil (extra abstraction without benefit for our two-store
use case). Zustand's selector-based subscriptions re-render only the
components that read the changed slice.

We explicitly forbid using Zustand for pure UI state that is local to a
single component — that belongs in `useState` or `useReducer`.

### URL state

Filterable and sortable state (search query, genre filter, sort order)
lives in the URL query string. `useSearchParams` is the source of truth;
components read from it, not from a parallel `useState`. This makes
filters shareable (`/search?q=naruto&sort=rating`), bookmarkable, and
back-button compatible.

### Optimistic updates

High-success-rate mutations (watchlist add/remove, episode progress tick)
use `useOptimistic` on the client for instant UI feedback, with a Server
Action as the source of truth. Payment mutations are **never** optimistic
— they must fully confirm before proceeding.

### Hydration strategy

Client-specific state (theme from localStorage, playback position) defaults
to a server-safe value during SSR and hydrates in `useEffect` to avoid
hydration mismatch flashes.

## Consequences

### Positive

- **Minimal client JS.** Server Components ship zero JS for catalog
  pages. The client bundle only includes TanStack Query, Zustand (~1 KB),
  and the components that actually need them.
- **Clear separation of concerns.** Every state category has one tool and
  one home. A new engineer can look at a piece of state and know
  immediately where it lives and how it is invalidated.
- **SEO-friendly.** Catalog pages render as full HTML on the server.
  Crawlers see content without executing JavaScript.
- **Optimistic where it matters.** Watchlist updates feel instant without
  sacrificing correctness — the Server Action is the source of truth and
  the optimistic update rolls back on error.

### Negative

- **Multiple tools to learn.** An engineer working on a feature that
  involves server rendering, a mutation, and a filter must understand
  Server Components, TanStack Query, and URL state. This is a real
  cognitive cost.
  **Mitigation:** The decision table above is the cheat sheet. Each tool
  has a narrow scope; an engineer rarely needs to use more than one or
  two in a single feature.
- **Hydration complexity.** Theme and playback position require careful
  hydration handling to avoid flashes. This adds boilerplate to every
  client component that reads client-specific state.
  **Mitigation:** A `useClientOnlyValue` hook in `apps/web/src/hooks/`
  encapsulates the pattern. Components call it instead of implementing
  hydration logic themselves.
- **TanStack Query is overkill for some uses.** A simple `fetch` in a
  Server Action would suffice for some client-initiated queries. Adding
  TanStack Query for those cases adds bundle size and complexity.
  **Mitigation:** We reserve TanStack Query for queries that benefit from
  caching, retries, or optimistic updates. One-off fetches use `fetch`
  directly.
- **Zustand stores are global mutable state.** If a component mutates
  the store outside of an action, we lose traceability.
  **Mitigation:** All store mutations happen through named actions
  (`uiStore.actions.openSidebar()`). Direct property assignment is
  forbidden by ESLint rule `nexus/zustand-no-direct-mutation`.

### Compliance

- `pnpm typecheck` must pass. TanStack Query responses are typed via
  `z.infer` schemas; no `any` leaks.
- Zustand stores are limited to two (`useUiStore`, `usePlayerStore`).
  Adding a third store requires an ADR.
- URL state must be read via `useSearchParams`, not mirrored in
  `useState`. ESLint rule `nexus/no-url-state-mirror` enforces this.
- Payment mutations must not use `useOptimistic`.
