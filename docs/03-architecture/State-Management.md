# State Management — Nexus Anime

> **Audience:** Engineers implementing interactive features. This document defines when and how to manage state — server state, client state, and URL state.

---

## 1. State Categories

State in a Next.js App Router application falls into four categories, each with a distinct management strategy.

| Category               | Source                                   | Mutated by                     | Strategy                                     |
| ---------------------- | ---------------------------------------- | ------------------------------ | -------------------------------------------- |
| **Server state**       | Database, Redis, external APIs           | Server Actions, Route Handlers | Server Components + React.cache()            |
| **Client cache state** | Server state mirrored on client          | React Query mutations          | TanStack Query                               |
| **Client UI state**    | Component-local (modals, forms, toggles) | User interactions              | useState / useReducer                        |
| **URL state**          | Query params, hash                       | Navigation                     | next/navigation (useSearchParams, useRouter) |

---

## 2. Server State — Server Components

The majority of state in Nexus Anime lives on the server. Server Components fetch data during rendering and stream HTML to the client. **No client-side cache is needed for initial page data.**

### React.cache() for deduplication

When multiple components in the same request need the same data, `React.cache()` deduplicates the underlying fetch.

```ts
// lib/requests/anime.ts
export const getAnime = React.cache(async (id: string): Promise<AnimeDetail> => {
  // First call in this request hits the DB
  // Subsequent calls in the same request return the cached result
  const cached = await cacheGet(`nexus:anime:${id}:detail`);
  if (cached) return cached;

  const anime = await animeRepository.getDetail(id);
  await cacheSet(`nexus:anime:${id}:detail`, anime, 3600);
  return anime;
});
```

### Revalidation after mutations

Server Actions call `revalidatePath()` or `revalidateTag()` to invalidate Server Component data:

```ts
"use server";
export async function toggleWatchlistAction(animeId: string) {
  await watchlistService.toggle(animeId);
  revalidateTag(`watchlist:${animeId}`);
  revalidatePath("/watchlist");
}
```

### Why Server Components over React Query for initial data

| Criterion          | Server Components             | React Query                             |
| ------------------ | ----------------------------- | --------------------------------------- |
| Initial load JS    | Zero (HTML only)              | React Query + serialized data (~10KB+)  |
| TTFB               | Streaming (progressive)       | Blocked until JS loads + data fetch     |
| SEO                | Full HTML (crawlable)         | Client-only (not crawlable without SSR) |
| Cache invalidation | Built-in (revalidatePath/Tag) | Manual (queryClient.invalidateQueries)  |

**Decision:** Initial page data uses Server Components. React Query is reserved for interactive mutations and client-side revalidation.

---

## 3. Client Cache State — TanStack Query (React Query)

React Query manages **mirrored server state on the client** for interactive features that need:

- Optimistic updates (watchlist toggle before server confirms)
- Polling (watch progress during playback)
- Background revalidation (stale-while-revalidate)

### Scope of React Query usage

React Query is **not** used for initial page loads. It is used for:

| Feature            | Query key                          | When                             | Stale time       |
| ------------------ | ---------------------------------- | -------------------------------- | ---------------- |
| Watchlist          | `["watchlist", userId]`            | After watchlist mutation         | 30s              |
| Watch progress     | `["progress", animeId, episodeId]` | During playback (poll every 30s) | 0 (always fresh) |
| Search suggestions | `["search", query]`                | Debounced keystrokes             | 60s              |

### QueryClient configuration

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 min — data is fresh for 1 min
      gcTime: 5 * 60 * 1000, // 5 min — garbage collection after 5 min
      refetchOnWindowFocus: false, // No refetch on tab switch (reduces noise)
      retry: 2, // Retry failed queries twice
    },
    mutations: {
      retry: 1, // Retry failed mutations once
    },
  },
});
```

### Why TanStack Query over SWR

| Criterion               | TanStack Query                           | SWR                            |
| ----------------------- | ---------------------------------------- | ------------------------------ |
| Optimistic updates      | Built-in `onMutate` + `onError` rollback | Requires manual implementation |
| Devtools                | Official devtools extension              | Community devtools             |
| Server-side integration | Supports SSR/hydration                   | Supported but less ergonomic   |
| Mutation management     | Dedicated mutation hooks                 | Mutations are add-on           |
| Ecosystem               | Broader (React, Vue, Solid, Svelte)      | React only                     |

For our use case (optimistic watchlist updates, mutation retry), TanStack Query's mutation API is more complete than SWR's.

---

## 4. Client UI State — useState / useReducer

Simple, component-local state uses React primitives. **No global state store for UI state.**

### When to use useState

- Modal open/closed state
- Form input values (before submission)
- Toggle switches (theme, quality)
- Dropdown open state

### When to use useReducer

- Complex form state (multi-step checkout)
- State machines (player state: `idle → loading → playing → paused → ended → error`)

### When NOT to use useState

- **Server data mirrored in state** — This is the most common mistake. If data comes from the server, use Server Components or React Query, not `useState` with a `useEffect` fetch.

```tsx
// ❌ Anti-pattern: mirroring server state in useState
const [anime, setAnime] = useState(null);
useEffect(() => {
  fetchAnime(id).then(setAnime);
}, [id]);

// ✅ Correct: Server Component fetches, Client Component renders
// Parent (Server): const anime = await getAnime(id);
// Child (Client): <WatchlistToggle isInWatchlist={anime.inWatchlist} />
```

---

## 5. Global Client State — Zustand

Zustand manages a small set of **truly global, non-server UI state** that must survive across routes and component trees without prop drilling.

### Store surfaces

| Store            | State                                       | Why Zustand                                                   |
| ---------------- | ------------------------------------------- | ------------------------------------------------------------- |
| `useUiStore`     | Sidebar open/closed, active theme           | Must survive route transitions. Not server data.              |
| `usePlayerStore` | Current episode, playback position, quality | Complex player state machine shared across player components. |

### Store anatomy

```ts
// shared/stores/ui-store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  sidebarOpen: boolean;
  theme: "dark" | "light";
  toggleSidebar: () => void;
  setTheme: (theme: "dark" | "light") => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: false,
      theme: "dark",
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setTheme: (theme) => set({ theme }),
    }),
    { name: "nexus-ui", partialize: (s) => ({ theme: s.theme }) }, // Persist theme only
  ),
);
```

### Why Zustand over Redux / Context

| Criterion              | Zustand                    | Redux                                    | Context                           |
| ---------------------- | -------------------------- | ---------------------------------------- | --------------------------------- |
| Bundle size            | ~1KB                       | ~7KB (toolkit ~30KB)                     | 0 (built-in)                      |
| Boilerplate            | Minimal (create + setters) | Significant (slices, actions, selectors) | Minimal (provider + hook)         |
| Re-render optimization | Built-in selectors         | Requires reselect                        | Requires memo/manual optimization |
| Persistence middleware | Built-in `persist`         | Requires redux-persist                   | Manual implementation             |
| Devtools               | Built-in                   | Excellent (Redux DevTools)               | None                              |

**Why Zustand:** Our global state is small (sidebar, theme, player). Redux's ceremony is disproportionate. Context causes re-renders on every state change unless carefully memoized. Zustand's selector-based subscriptions re-render only the components that read the changed slice.

**Why Context is not used for global state:** Context is for dependency injection (theme, config), not for mutable state. When Context value changes, all consumers re-render — fine for theme (few consumers), bad for sidebar (many consumers).

---

## 6. URL State — Search Params

Query parameters are the source of truth for filterable/sortable state. This ensures URL sharing works and browser back/forward preserves state.

| Route                                       | Params                           | Managed by                            |
| ------------------------------------------- | -------------------------------- | ------------------------------------- |
| `/search?q=naruto&genre=action&sort=rating` | Search query, genre filter, sort | `useSearchParams()` + `router.push()` |
| `/watchlist?view=grid&sort=recent`          | View mode, sort order            | `useSearchParams()`                   |
| `/settings?tab=notifications`               | Active settings tab              | `useSearchParams()`                   |

### Why URL state over useState for filters

If filters live in `useState`, the URL doesn't update. Users can't share `/search?q=naruto` — they'd share `/search` without the query. URL state makes filters shareable, bookmarkable, and back-button compatible.

---

## 7. Optimistic Updates

For mutations where the server response is expected to succeed, we show the result immediately and rollback on error.

### Implementation with Server Actions + useOptimistic

```tsx
"use client";
export function WatchlistToggle({ animeId, isInWatchlist }: Props) {
  const [optimisticIsInList, toggleOptimistic] = useOptimistic(
    isInWatchlist,
    (current, willAdd: boolean) => willAdd,
  );

  async function handleToggle() {
    const willAdd = !optimisticIsInList;
    toggleOptimistic(willAdd); // Instant UI update
    try {
      await toggleWatchlistAction(animeId); // Server mutation
    } catch {
      // useOptimistic automatically rolls back on re-render
      // Error toast handled by error boundary or action state
    }
  }

  return <Button onClick={handleToggle}>{optimisticIsInList ? "✓ Saved" : "+ Save"}</Button>;
}
```

### Why optimistic updates for watchlist

Adding to a watchlist succeeds 99.9% of the time. Waiting for the server response (200–500ms) makes the UI feel sluggish. Optimistic update gives instant feedback; the rare failure case is handled by rollback + error toast.

**When NOT to use optimistic updates:** Payment mutations (creating a checkout session) — these must fully confirm before proceeding. Incorrectly optimizing a payment is worse than a slow payment.

---

## 8. State Hydration Strategy

When Server Components pass data to Client Components, the data is serialized in the HTML and hydrated on the client. This is automatic in Next.js.

### Avoiding hydration mismatches

- Server and client must render the **same data** on first render.
- Client-only state (sidebar open, theme) should default to server-safe values and mount in a `useEffect`.

```tsx
// ✅ Hydration-safe: default to closed on server, read persisted value on mount
const sidebarOpen = useUiStore((s) => s.sidebarOpen);
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
if (!mounted) return <SidebarPlaceholder />;
return <Sidebar open={sidebarOpen} />;
```

### Why this pattern

If the persisted theme is "dark" but the server renders "light" (no access to localStorage on the server), the hydration mismatch causes a flash. Delaying client-specific rendering until after mount avoids this.

---

## 9. State Management Decision Flowchart

```
Is the data fetched from the server?
├── Yes → Is it needed for the initial page render?
│   ├── Yes → Server Component + React.cache()
│   │        (After mutation: revalidatePath/Tag)
│   └── No  → TanStack Query
│            (After mutation: invalidateQueries)
└── No → Is it shared across multiple components?
    ├── Yes → Is it URL-relevant (filters, tabs)?
    │   ├── Yes → URL state (useSearchParams)
    │   └── No  → Zustand store
    └── No  → useState / useReducer (component-local)
```

This flowchart governs every state decision. If an engineer is unsure which strategy to use, they follow this branch.
