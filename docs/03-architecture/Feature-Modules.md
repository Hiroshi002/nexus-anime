# Feature Modules — Nexus Anime

> **Audience:** Engineers implementing or extending features. This document defines the feature module contract — structure, boundaries, and cross-feature interaction rules.

---

## 1. Feature Module Anatomy

Every feature module follows the same structure. Consistency means a developer can navigate any feature without learning a unique layout.

```
features/<name>/
├── components/        # UI components for this feature
│   ├── <Component>.tsx          # Server or Client component
│   └── <Component>.test.tsx     # Colocated test
├── actions/           # Server Actions (mutations)
│   └── <action>.ts
├── hooks/             # Client hooks (optional, only if feature has interactive state)
│   └── use<Name>.ts
├── types.ts           # Feature-specific types, Zod schemas
└── constants.ts       # Feature-specific constants (optional)
```

### Why this shape

- **components/** contains all UI — no splitting into `server/` and `client/` subdirectories. The `"use client"` directive at the top of a file makes the boundary explicit at the component level, not the directory level. This keeps related components (a server parent and its client island) next to each other.
- **actions/** is separate from components because Server Actions are server-only and may be called from multiple components within the feature.
- **hooks/** is optional. Not every feature has interactive client state. If a hook is shared across features, it moves to `shared/hooks/`.
- **types.ts** is one file per feature. If it grows beyond 150 lines, the feature may be doing too much and should be split.

---

## 2. Feature Catalog

### auth

**Responsibility:** User authentication — login, signup, OAuth, email verification, session management.

| Component | Rendering | Purpose |
|-----------|-----------|---------|
| LoginForm | Client | Email/password form with validation |
| SignupForm | Client | Registration form with password strength |
| OAuthButtons | Client | Google/GitHub OAuth buttons |
| EmailVerification | Server | Verify email token, show success/failure |
| SessionIndicator | Client | Show logged-in state, avatar |

| Action | Purpose |
|--------|---------|
| signInAction | Credential sign-in with Zod validation |
| signUpAction | Create account + send verification email |
| signOutAction | Clear session |

**Hooks:** None (session state managed by Auth.js).

**Dependencies:** `next-auth`, `@nexus/db` (users, accounts, sessions tables).

---

### catalog

**Responsibility:** Anime browsing, search, detail pages, season navigation, trending/popular rankings.

| Component | Rendering | Purpose |
|-----------|-----------|---------|
| AnimeCard | Server | Thumbnail card for browse/search results |
| AnimeHero | Server | Large hero section on detail page |
| EpisodeList | Server (Suspense) | Episode list for an anime |
| SeasonSelector | Client | Season navigation tabs |
| SearchBar | Client | Search input with debounced suggestions |
| SearchResults | Server | Search result grid |
| TrendingCarousel | Server (ISR) | Trending anime carousel |
| GenreGrid | Server (ISR) | Genre-based browse grid |

| Action | Purpose |
|--------|---------|
| searchAction | Server Action for search (fallback) |

**Hooks:** `useSearch` (debounced search input).

**Dependencies:** `@nexus/db`, `@nexus/cache`, TMDB client, AniList client.

---

### watchlist

**Responsibility:** Save/remove anime to personal watchlist, reorder, and display watchlist page.

| Component | Rendering | Purpose |
|-----------|-----------|---------|
| WatchlistToggle | Client | Add/remove button (optimistic update) |
| WatchlistGrid | Server | Watchlist page grid |
| WatchlistItem | Server | Single watchlist entry card |
| EmptyWatchlist | Server | Empty state illustration |

| Action | Purpose |
|--------|---------|
| toggleWatchlistAction | Add or remove anime from watchlist |
| reorderWatchlistAction | Update sort position |

**Hooks:** `useWatchlist` (React Query for optimistic updates, cache invalidation).

**Dependencies:** `@nexus/db`, `@nexus/cache` (invalidation).

---

### player

**Responsibility:** Video playback, quality selection, progress tracking, continue-watching.

| Component | Rendering | Purpose |
|-----------|-----------|---------|
| PlayerContainer | Server | Fetches signed URL, passes to island |
| PlayerIsland | Client (dynamic) | Video player (lazy-loaded) |
| PlayerControls | Client | Play/pause, quality, fullscreen, seek |
| ProgressBar | Client | Playback progress bar |
| QualitySelector | Client | Quality/resolution selector |

| Action | Purpose |
|--------|---------|
| reportProgressAction | Update watch progress on server |

**Hooks:** `usePlayback` (player state), `useProgressTracker` (periodic progress reports).

**Dependencies:** `@nexus/db` (watch-progress), Cloudflare Stream client.

---

### payments

**Responsibility:** Subscription plans, Stripe checkout, webhook handling, billing status.

| Component | Rendering | Purpose |
|-----------|-----------|---------|
| PricingTable | Server | Plan comparison table |
| CheckoutForm | Client (dynamic) | Stripe Elements checkout |
| PlanBadge | Server | Current plan indicator |
| BillingHistory | Server | Past invoices |

| Action | Purpose |
|--------|---------|
| createCheckoutAction | Create Stripe Checkout Session |
| manageSubscriptionAction | Create Stripe Customer Portal Session |

**Hooks:** None (checkout is a redirect flow, not inline state).

**Dependencies:** `@nexus/db` (subscriptions), Stripe SDK.

---

### profile

**Responsibility:** User profile display, settings, avatar upload, viewing history.

| Component | Rendering | Purpose |
|-----------|-----------|---------|
| ProfileHeader | Server | Avatar, username, join date |
| AvatarUpload | Client | Avatar image upload |
| SettingsForm | Client | Update display name, email preferences |
| ViewingHistory | Server (paginated) | Continue-watching / watch history |

| Action | Purpose |
|--------|---------|
| updateProfileAction | Update profile fields |
| uploadAvatarAction | Upload avatar to R2 |

**Hooks:** None (forms use `useActionState`).

**Dependencies:** `@nexus/db` (users, watch-progress).

---

## 3. Cross-Feature Interaction Rules

### Rule 1: No direct feature-to-feature imports

```
❌  features/watchlist/components/WatchlistToggle.tsx
      → import { Anime } from features/catalog/types.ts

✅  features/watchlist/components/WatchlistToggle.tsx
      → import { Anime } from shared/types/Anime.ts
```

**Why:** Direct imports create hidden coupling. If `catalog` is refactored, `watchlist` breaks silently. Shared types in `shared/types/` make the dependency explicit and owned by the shared layer.

### Rule 2: Feature components receive data via props

A feature component does not fetch its own data unless it is the top-level page component. Intermediate components receive data as props from their parent.

```
❌  <AnimeCard id="123" />           // Card fetches anime by id internally
✅  <AnimeCard anime={animeData} />  // Parent fetches, card renders
```

**Why:** Prop-driven components are testable (pass mock data), composable (reuse in different contexts), and avoid N+1 fetches (the parent can batch fetch).

**Exception:** Client Components with React Query may fetch data internally for interactive features (e.g., optimistic watchlist updates). This is acceptable because the client cache is the source of truth for interactive state, and the query key makes the dependency discoverable.

### Rule 3: Shared hooks are promoted, not duplicated

If a hook is used in two or more features, it moves to `shared/hooks/`. If it's used in one feature, it stays in that feature's `hooks/`.

### Rule 4: Actions may call services, not other actions

Server Actions are thin wrappers — they validate input with Zod, call a service function, and revalidate the cache. They never call other actions directly. If two actions share logic, the logic goes into a service.

```
❌  toggleWatchlistAction → reorderWatchlistAction    (action calls action)
✅  toggleWatchlistAction → watchlistService.toggle() (action calls service)
```

---

## 4. Feature Lifecycle

### Adding a feature

1. Create `features/<name>/` with the standard structure.
2. Define types in `types.ts` first (type-driven development).
3. Implement repositories in `@nexus/db` if new tables are needed.
4. Implement service in `services/<name>.service.ts`.
5. Build Server Components, then Client Components.
6. Add Server Actions for mutations.
7. Register route in `app/` with appropriate route group.

### Removing a feature

1. Delete `features/<name>/`.
2. Remove route from `app/`.
3. Remove service from `services/`.
4. Remove repositories and schema tables from `@nexus/db` (via migration with deprecation period).
5. Remove any shared types that were only used by this feature.

**Why feature-based pays off here:** Deletion is `rm -rf` plus targeted cleanups. In a type-based structure, deletion requires searching every directory for files related to the feature.

### Extracting a feature (future)

If a feature needs independent deployment (e.g., the player becomes a microservice):

1. Move `features/player/` and `services/streaming.service.ts` to a new `apps/player-api/` or standalone package.
2. Replace service calls with HTTP API calls.
3. Write an ADR documenting the extraction rationale.

This is the extraction strategy promised by ADR-001.
