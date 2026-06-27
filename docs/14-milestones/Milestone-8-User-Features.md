# M8 — User Features

> **Goal:** Deliver the authenticated user experience: watchlist management, watch history with progress bars, bookmarks with reorder, user profile with avatar and bio, settings panels (account, billing stub, notifications, accessibility), in-app notifications, and the continue-watching list. All mutations use Server Actions with Zod validation; optimistic updates for watchlist toggle; URL-driven state for view modes.
> **Spec version:** 1.0.0 · **Last reviewed:** 2026-06-26 · **Owner:** Engineering

---

## 1. Objective

Implement the full suite of authenticated user-facing features that transform Nexus Anime from a catalog browser into a personalized streaming platform. This milestone covers: watchlist (bookmarks) management with add/remove/reorder and grid/list view toggle, watch history with progress bars, user profile with avatar upload and bio editing, settings panels (account, billing stub, notifications, accessibility preferences), in-app notification delivery, and the continue-watching list that surfaces partially-watched episodes for quick resume.

All mutations use Server Actions with Zod validation and `requireUser`. The watchlist toggle uses optimistic updates for instant feedback. View mode (grid/list) and filter state are URL-driven for shareability. The continue-watching list is the primary entry point to the Episode Player (M7).

Design references: `docs/05-ui/Bookmarks.md`, `docs/05-ui/Continue-Watching.md`, `docs/05-ui/Profile.md`, `docs/05-ui/Settings.md`
API references: `docs/06-api/Bookmarks.md`, `docs/06-api/Continue-Watching.md`, `docs/06-api/Watch-History.md`, `docs/06-api/Notifications.md`

---

## 2. Scope

### In scope

- `apps/web/src/app/watchlist/page.tsx` — watchlist (bookmarks) page with grid/list toggle, sort, filter
- `apps/web/src/app/watchlist/layout.tsx` — watchlist layout with header
- `apps/web/src/app/history/page.tsx` — watch history page with progress bars
- `apps/web/src/app/history/layout.tsx` — history layout
- `apps/web/src/app/continue-watching/page.tsx` — continue-watching list
- `apps/web/src/app/continue-watching/layout.tsx` — continue-watching layout
- `apps/web/src/app/profile/page.tsx` — user profile page
- `apps/web/src/app/profile/layout.tsx` — profile layout
- `apps/web/src/app/profile/edit/page.tsx` — profile edit (or modal)
- `apps/web/src/app/settings/page.tsx` — settings page with tab navigation
- `apps/web/src/app/settings/layout.tsx` — settings layout with sidebar/tab bar
- `apps/web/src/app/notifications/page.tsx` — in-app notifications list
- `apps/web/src/components/watchlist/` — `WatchlistPage`, `WatchlistHeader`, `FilterBar`, `SortDropdown`, `ViewToggle`, `WatchlistGrid`, `WatchlistList`, `AnimeCard`, `StatusBadge`, `OverflowMenu`, `ReorderControls`, `EmptyState`
- `apps/web/src/components/history/` — `HistoryPage`, `HistoryHeader`, `HistoryList`, `HistoryEntry` (thumbnail, progress bar, metadata), `HistoryFilter`, `HistoryEmptyState`
- `apps/web/src/components/continue-watching/` — `ContinueWatchingPage`, `ProgressGrid`, `ProgressCard`, `AnimeGroup`, `ContinueWatchingEmptyState`
- `apps/web/src/components/profile/` — `ProfilePage`, `ProfileHeader`, `AvatarUpload`, `StatsRow`, `AboutSection`, `ActivitySection`, `QuickLinksSection`, `ProfileEditModal`
- `apps/web/src/components/settings/` — `SettingsLayout`, `SettingsSidebar`, `AccountPanel`, `BillingPanel`, `NotificationsPanel`, `AccessibilityPanel`, `DangerZoneSection`, `DeleteAccountModal`
- `apps/web/src/components/notifications/` — `NotificationList`, `NotificationItem`, `NotificationBadge`, `NotificationEmptyState`
- `apps/web/src/hooks/` — `useWatchlist`, `useWatchHistory`, `useContinueWatching`, `useNotifications`, `useProfile`, `useSettings`
- `apps/web/src/actions/` — `addToWatchlist`, `removeFromWatchlist`, `reorderWatchlist`, `updateProfile`, `uploadAvatar`, `updateSettings`, `markNotificationRead`, `clearWatchHistory`
- `apps/web/src/lib/services/` — `watchlistService`, `historyService`, `profileService`, `settingsService`, `notificationService`
- `apps/web/src/lib/` — `watchlist-types.ts`, `settings-types.ts`, `notification-types.ts`
- API route: `apps/web/app/api/v1/users/me/bookmarks/route.ts` — list (GET), add (POST)
- API route: `apps/web/app/api/v1/users/me/bookmarks/[animeId]/route.ts` — update (PATCH), delete (DELETE), check (GET)
- API route: `apps/web/app/api/v1/users/me/watch-history/route.ts` — list (GET)
- API route: `apps/web/app/api/v1/users/me/watch-history/[id]/route.ts` — delete (DELETE)
- API route: `apps/web/app/api/v1/users/me/continue-watching/route.ts` — list (GET), upsert (POST)
- API route: `apps/web/app/api/v1/users/me/continue-watching/[animeId]/route.ts` — heartbeat (PATCH), delete (DELETE)
- API route: `apps/web/app/api/v1/users/me/profile/route.ts` — read (GET), update (PATCH)
- API route: `apps/web/app/api/v1/users/me/avatar/route.ts` — upload (POST)
- API route: `apps/web/app/api/v1/users/me/settings/route.ts` — read (GET), update (PATCH)
- API route: `apps/web/app/api/v1/users/me/notifications/route.ts` — list (GET), mark-read (POST)
- API route: `apps/web/app/api/v1/users/me/notifications/[id]/route.ts` — mark-read (PATCH), delete (DELETE)
- Server Actions with Zod validation for all mutations
- Optimistic updates for watchlist add/remove toggle
- URL-driven state for view mode (grid/list), sort, and filter
- Avatar upload: file picker, client-side preview, 5MB limit, jpeg/png/webp only
- Settings persistence via `users.preferences` JSONB column
- In-app notification creation triggers (new episode for bookmarked anime)
- Continue-watching data fed by M7 progress heartbeat

### Out of scope

- Episode Player (M7) — separate milestone; M8 consumes progress data from M7
- Social features (following, friend activity)
- Public profiles (all profiles are private by default in M8)
- Billing integration (Stripe customer portal link — stub only in M8; full billing in M9)
- Push notifications (Web Push API — future)
- Email notifications (SendGrid integration — future)
- Content moderation for bios (basic profanity filter only)
- Data export / GDPR download (future)
- Watchlist sharing / public watchlists
- Multi-device sync beyond what continue_watching table provides

---

## 3. Deliverables

| #   | Deliverable                                   | Location                                                             | Acceptance                                                                                        |
| :-- | :-------------------------------------------- | :------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------ |
| D1  | Watchlist page (grid/list view, sort, filter) | `apps/web/src/app/watchlist/page.tsx`                                | Renders `WatchlistPage`; reads URL params for view/sort/filter; updates URL on change             |
| D2  | `WatchlistPage` orchestrator                  | `apps/web/src/components/watchlist/WatchlistPage.tsx`                | Composes header, filter bar, sort, view toggle, grid/list, empty state                            |
| D3  | `WatchlistHeader`                             | `apps/web/src/components/watchlist/WatchlistHeader.tsx`              | Page title "Watchlist", count badge with `aria-live`, sort dropdown                               |
| D4  | `FilterBar` (status chips)                    | `apps/web/src/components/watchlist/FilterBar.tsx`                    | 5 filter chips (all/want_to_watch/watching/completed/dropped); `aria-pressed`; sticky on scroll   |
| D5  | `ViewToggle` (grid/list)                      | `apps/web/src/components/watchlist/ViewToggle.tsx`                   | Toggle buttons; active = `primary`; state in URL param `?view=grid`                               |
| D6  | `WatchlistGrid`                               | `apps/web/src/components/watchlist/WatchlistGrid.tsx`                | Responsive grid (4-col desktop, 3-col tablet, 2-col mobile); `AnimeCard` with status badge        |
| D7  | `WatchlistList`                               | `apps/web/src/components/watchlist/WatchlistList.tsx`                | List view with larger cards; thumbnail + metadata + status + overflow menu                        |
| D8  | `AnimeCard` (watchlist variant)               | `apps/web/src/components/watchlist/AnimeCard.tsx`                    | 2:3 aspect ratio; `StatusBadge`; `OverflowMenu` (edit status, remove); `ReorderControls`          |
| D9  | `ReorderControls`                             | `apps/web/src/components/watchlist/ReorderControls.tsx`              | Up/down buttons; `aria-label="Move {title} up/down"`; keyboard accessible                         |
| D10 | `WatchlistEmptyState`                         | `apps/web/src/components/watchlist/EmptyState.tsx`                   | Illustration + "Your watchlist is empty." + "Explore Trending" CTA button                         |
| D11 | Watch history page                            | `apps/web/src/app/history/page.tsx`                                  | Renders `HistoryPage` with list of watched episodes                                               |
| D12 | `HistoryPage` orchestrator                    | `apps/web/src/components/history/HistoryPage.tsx`                    | Composes header, filter, history list, empty state                                                |
| D13 | `HistoryEntry` with progress bar              | `apps/web/src/components/history/HistoryEntry.tsx`                   | Thumbnail, anime title, episode number, progress bar (`role="progressbar"`), watched-at timestamp |
| D14 | `HistoryEmptyState`                           | `apps/web/src/components/history/HistoryEmptyState.tsx`              | Illustration + "No watch history yet." + "Browse trending" CTA                                    |
| D15 | Continue-watching page                        | `apps/web/src/app/continue-watching/page.tsx`                        | Renders `ContinueWatchingPage`                                                                    |
| D16 | `ContinueWatchingPage` orchestrator           | `apps/web/src/components/continue-watching/ContinueWatchingPage.tsx` | Composes header, progress grid, empty state                                                       |
| D17 | `ProgressCard`                                | `apps/web/src/components/continue-watching/ProgressCard.tsx`         | Thumbnail (240×135), progress bar (4px), episode number, "Resume" + "Restart" buttons             |
| D18 | `AnimeGroup` (accordion)                      | `src/components/continue-watching/AnimeGroup.tsx`                    | Groups episodes by anime; collapsed by default; `aria-expanded`, `aria-controls`                  |
| D19 | `ContinueWatchingEmptyState`                  | `src/components/continue-watching/ContinueWatchingEmptyState.tsx`    | Illustration + "Nothing to resume." + "Browse trending" CTA                                       |
| D20 | Profile page                                  | `apps/web/src/app/profile/page.tsx`                                  | Renders `ProfilePage` with stats, bio, activity, quick links                                      |
| D21 | `ProfilePage` orchestrator                    | `apps/web/src/components/profile/ProfilePage.tsx`                    | Composes header, stats, about, activity, quick links, edit modal                                  |
| D22 | `ProfileHeader`                               | `apps/web/src/components/profile/ProfileHeader.tsx`                  | 96px avatar, display name, username, join date, plan badge, Edit button                           |
| D23 | `AvatarUpload`                                | `apps/web/src/components/profile/AvatarUpload.tsx`                   | File picker (jpeg/png/webp, 5MB max); preview; cancel/save; `aria-label="Upload avatar"`          |
| D24 | `StatsRow`                                    | `apps/web/src/components/profile/StatsRow.tsx`                       | 4 `StatBadge` (anime watched, episodes, hours, watchlist count)                                   |
| D25 | `AboutSection`                                | `apps/web/src/components/profile/AboutSection.tsx`                   | Bio text (max 280 chars); Edit bio ghost button; empty state                                      |
| D26 | `ActivitySection`                             | `apps/web/src/components/profile/ActivitySection.tsx`                | Last 5 activities (icon + text + timestamp); empty state                                          |
| D27 | `QuickLinksSection`                           | `apps/web/src/components/profile/QuickLinksSection.tsx`              | Links to /watchlist, /history, /settings                                                          |
| D28 | `ProfileEditModal`                            | `apps/web/src/components/profile/ProfileEditModal.tsx`               | Display name input (max 32), bio textarea (max 280), Cancel/Save; focus trap                      |
| D29 | Settings page with tab navigation             | `apps/web/src/app/settings/page.tsx`                                 | Renders `SettingsLayout`; reads `?tab=` param; default `account`                                  |
| D30 | `SettingsLayout` + `SettingsSidebar`          | `src/components/settings/SettingsLayout.tsx`                         | Desktop: 240px sidebar; Tablet/Mobile: horizontal tab bar; `role="tablist"`                       |
| D31 | `AccountPanel`                                | `src/components/settings/AccountPanel.tsx`                           | Profile section, password section, danger zone                                                    |
| D32 | `BillingPanel` (stub)                         | `src/components/settings/BillingPanel.tsx`                           | Current plan badge, "Manage Subscription" link (Stripe portal stub), billing history placeholder  |
| D33 | `NotificationsPanel`                          | `src/components/settings/NotificationsPanel.tsx`                     | Email preferences, push preferences (disabled), per-anime notification toggle                     |
| D34 | `AccessibilityPanel`                          | `src/components/settings/AccessibilityPanel.tsx`                     | Reduced motion, font size (sm/md/lg radio), high contrast, autoplay, captions default             |
| D35 | `DeleteAccountModal`                          | `src/components/settings/DeleteAccountModal.tsx`                     | Confirmation modal with type-to-confirm; focus trap; ESC closes                                   |
| D36 | Notifications page                            | `apps/web/src/app/notifications/page.tsx`                            | Renders `NotificationList`                                                                        |
| D37 | `NotificationList` + `NotificationItem`       | `src/components/notifications/NotificationList.tsx`                  | List of notifications; unread indicator; mark-read on click; empty state                          |
| D38 | `NotificationBadge`                           | `src/components/notifications/NotificationBadge.tsx`                 | Unread count badge in header/nav; `aria-live="polite"`                                            |
| D39 | Watchlist API routes (CRUD)                   | `apps/web/app/api/v1/users/me/bookmarks/*`                           | GET list, POST add, PATCH update, DELETE remove, GET check; all auth-required; rate-limited       |
| D40 | Watch history API routes                      | `apps/web/app/api/v1/users/me/watch-history/*`                       | GET list, DELETE single; auth-required                                                            |
| D41 | Continue-watching API routes                  | `apps/web/app/api/v1/users/me/continue-watching/*`                   | GET list, POST upsert, PATCH heartbeat, DELETE; auth-required; rate-limited                       |
| D42 | Profile API routes                            | `apps/web/app/api/v1/users/me/profile/*`                             | GET read, PATCH update; auth-required                                                             |
| D43 | Avatar upload API route                       | `apps/web/app/api/v1/users/me/avatar/route.ts`                       | POST; multipart form; 5MB limit; auth-required; returns `avatar_url`                              |
| D44 | Settings API routes                           | `apps/web/app/api/v1/users/me/settings/*`                            | GET read, PATCH update; auth-required; persists to `users.preferences`                            |
| D45 | Notification API routes                       | `apps/web/app/api/v1/users/me/notifications/*`                       | GET list, POST mark-read, PATCH mark-read single, DELETE; auth-required                           |
| D46 | `addToWatchlist` Server Action                | `apps/web/src/actions/addToWatchlist.ts`                             | Zod validation; requireUser; optimistic update; idempotency key                                   |
| D47 | `removeFromWatchlist` Server Action           | `apps/web/src/actions/removeFromWatchlist.ts`                        | Zod validation; requireUser; optimistic update                                                    |
| D48 | `reorderWatchlist` Server Action              | `apps/web/src/actions/reorderWatchlist.ts`                           | Zod validation; requireUser; gap-based sort order                                                 |
| D49 | `updateProfile` Server Action                 | `apps/web/src/actions/updateProfile.ts`                              | Zod validation; requireUser; updates display_name, bio                                            |
| D50 | `uploadAvatar` Server Action                  | `apps/web/src/actions/uploadAvatar.ts`                               | Zod validation; requireUser; file upload to R2/Cloudflare; returns URL                            |
| D51 | `updateSettings` Server Action                | `apps/web/src/actions/updateSettings.ts`                             | Zod validation; requireUser; merges into `users.preferences`                                      |
| D52 | `markNotificationRead` Server Action          | `apps/web/src/actions/markNotificationRead.ts`                       | Zod validation; requireUser; marks single or all as read                                          |
| D53 | `clearWatchHistory` Server Action             | `apps/web/src/actions/clearWatchHistory.ts`                          | Zod validation; requireUser; anonymizes all watch history entries                                 |
| D54 | `useWatchlist` hook                           | `apps/web/src/hooks/useWatchlist.ts`                                 | Fetches watchlist; manages local state for optimistic updates                                     |
| D55 | `useWatchHistory` hook                        | `apps/web/src/hooks/useWatchHistory.ts`                              | Fetches watch history with cursor pagination                                                      |
| D56 | `useContinueWatching` hook                    | `apps/web/src/hooks/useContinueWatching.ts`                          | Fetches continue-watching list                                                                    |
| D57 | `useNotifications` hook                       | `apps/web/src/hooks/useNotifications.ts`                             | Fetches notifications; manages unread count                                                       |
| D58 | `useProfile` hook                             | `apps/web/src/hooks/useProfile.ts`                                   | Fetches current user profile                                                                      |
| D59 | `useSettings` hook                            | `apps/web/src/hooks/useSettings.ts`                                  | Fetches + updates user settings                                                                   |
| D60 | Service wrappers                              | `apps/web/src/lib/services/`                                         | `watchlistService`, `historyService`, `profileService`, `settingsService`, `notificationService`  |

---

## 4. Prerequisites

Before M8 begins, the following must be complete:

- **M0 — Repository Scaffold:** Turborepo, pnpm workspaces, folder structure, CI pipeline
- **M1 — Project Foundation:** `@nexus/ui` component library with `Button`, `Badge`, `Card`, `Skeleton`, `ErrorBoundary`, `Modal`, `Tabs`, `Toggle`, `Select`, `Slider`, `Textarea`, `Input`, `Avatar`, `ProgressBar` primitives; theme tokens; Tailwind 4
- **M2 — Catalog Foundation:** Anime data layer live; `/api/v1/anime/*` endpoints operational
- **M3 — Auth Complete:** Auth.js v5 session management; `requireUser` helper; `userId` from session available in Server Actions; RBAC with viewer/moderator/admin tiers
- **M7 — Episode Player (recommended):** Continue-watching data is generated by M7 progress heartbeats. M8 can proceed without M7 but the continue-watching list will be empty until M7 is complete. The watchlist and profile features are independent of M7.

---

## 5. Dependencies

### Upstream (must exist before M8 starts)

| Dependency                    | Type     | Source         | Contract                                                                                                                        |
| :---------------------------- | :------- | :------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| `users` table                 | Database | M3             | id, username, email, display_name, avatar_url, bio, role, preferences (JSONB)                                                   |
| `bookmarks` table             | Database | M3             | id, user_id, anime_id, note, sort_order, notify_on_new_episode, deleted_at                                                      |
| `continue_watching` table     | Database | M3             | id, user_id, anime_id, episode_id, position_seconds, duration_seconds, progress_pct, device, is_completed, version              |
| `watch_history` table         | Database | M3             | id, user_id, anime_id, episode_id, watched_at, watch_duration_seconds, completion_pct                                           |
| `notifications` table         | Database | M3             | id, user_id, type, title, body, resource_url, is_read, created_at                                                               |
| Auth.js v5 `requireUser`      | Library  | M3             | Returns `{ user: { id } }` or throws `UNAUTHORIZED`                                                                             |
| `@nexus/ui` components        | Package  | M1             | `Button`, `Badge`, `Card`, `Modal`, `Tabs`, `Toggle`, `Input`, `Textarea`, `Avatar`, `ProgressBar`, `Skeleton`, `ErrorBoundary` |
| `@nexus/cache`                | Package  | M2             | Redis for bookmark list caching (30s TTL), notification caching                                                                 |
| `@nexus/db`                   | Package  | M2             | Drizzle query builder; transaction support                                                                                      |
| Cloudflare R2 (or equivalent) | External | Infrastructure | Avatar image storage; public-read bucket                                                                                        |

### Downstream (will consume M8)

| Consumer         | What they need                                                                              | Milestone |
| :--------------- | :------------------------------------------------------------------------------------------ | :-------- |
| M9 — Social      | Watchlist data for "friends watched" feature; notification preferences for delivery routing | M9        |
| M10 — Production | Notification delivery pipeline; settings sync monitoring                                    | M10       |

### External services

| Service         | Purpose                                                    | Failure mode                                                                          |
| :-------------- | :--------------------------------------------------------- | :------------------------------------------------------------------------------------ |
| Upstash Redis   | Cache bookmark lists (30s TTL), notification unread counts | Cache miss → direct DB query; serve stale if available                                |
| Postgres (Neon) | All user feature tables                                    | Query timeout → 503; connection pool exhaustion → queue + retry                       |
| Cloudflare R2   | Avatar image storage                                       | Upload failure → retry with exponential backoff; serve default avatar on read failure |
| Vercel Edge     | Rate limiting (10/60s bookmarks, 30/60s continue-watching) | Fail open for reads; 429 with `Retry-After` for writes                                |

---

## 6. Risks

### R1: Optimistic update rollback on server error

**Description:** The watchlist add/remove toggle uses optimistic updates for instant UI feedback. If the Server Action fails after the UI has already updated, the UI must roll back to the previous state. A failed rollback or inconsistent state will confuse users.

**Likelihood:** Medium · **Impact:** Medium (UI shows item in watchlist when server rejected the add)

**Mitigation:**

- `useWatchlist` hook maintains a local `pendingState` that is committed only on Server Action success. On failure, the hook reverts to the server-confirmed state and surfaces a toast notification.
- The Server Action returns a discriminated union `{ data } | { error }`. The hook checks the response before committing the optimistic update.
- Idempotency keys on bookmark POST prevent duplicate entries if the client retries a failed request.
- Test: simulate 500 error on `addToWatchlist`; verify UI reverts and toast appears.

### R2: Bookmark reorder race condition

**Description:** When a user reorders bookmarks quickly (clicking up/down rapidly), multiple `reorderWatchlist` Server Actions may be in flight simultaneously. The gap-based sort order algorithm may produce incorrect ordering if two requests interleave.

**Likelihood:** Low · **Impact:** Low (minor visual ordering issue)

**Mitigation:**

- Debounce reorder actions: 300ms delay before sending the request; accumulate rapid clicks into a single final reorder.
- The `reorderWatchlist` action uses a transaction: read current sort orders, compute new gap-based values, write all affected rows atomically.
- If the transaction fails due to a serialization conflict (Postgres `SERIALIZABLE`), retry up to 3 times with exponential backoff.
- Test: click reorder 5 times rapidly; verify final order matches the last requested order.

### R3: Avatar upload size and format validation

**Description:** The avatar upload must reject files exceeding 5MB or in unsupported formats. If validation is client-side only, a malicious user could bypass it and upload oversized files to R2, increasing storage costs and potentially causing slow page loads.

**Likelihood:** Medium · **Impact:** Medium (storage cost abuse; large images break layout)

**Mitigation:**

- Validate on both client (instant feedback) and server (Zod: `z.instanceof(File).refine(f => f.size <= 5 * 1024 * 1024)` and MIME type check).
- The avatar upload API route streams the file through a size-checking middleware before writing to R2; abort if size exceeds limit.
- Post-upload, resize the image to 256×256 via Cloudflare Images or a server-side sharp pipeline; store only the resized version.
- Rate limit avatar uploads to 5 per hour per user.

### R4: Settings JSONB merge conflicts

**Description:** User settings are stored in a single `preferences` JSONB column. If two settings updates happen concurrently (e.g., user opens two settings tabs), one update may overwrite the other due to read-modify-write race.

**Likelihood:** Low · **Impact:** Low (minor settings loss; user re-applies)

**Mitigation:**

- Use Postgres `jsonb_patch` or atomic JSONB merge (`||` operator) at the SQL level to avoid read-modify-write.
- The `updateSettings` action accepts a partial settings object and merges it with the existing value using Drizzle's JSONB merge: `sql\`${users.preferences} || ${patch}::jsonb\``.
- Document: settings are last-writer-wins at the field level, not the object level. Concurrent edits to the same field will lose one.

### R5: Continue-watching staleness from M7 dependency

**Description:** The continue-watching list is populated by progress heartbeats from M7. If M7 is delayed or the heartbeat fails, the continue-watching list may show stale progress or miss episodes entirely.

**Likelihood:** Medium (if M7 is not yet complete) · **Impact:** Low (empty or stale list)

**Mitigation:**

- M8 continue-watching UI handles empty state gracefully with a "Nothing to resume" message and CTA.
- The continue-watching page shows `updated_at` timestamp so users can see when data was last refreshed.
- If M7 is not complete, the continue-watching page still renders correctly with empty state; no broken UI.
- The `useContinueWatching` hook refetches on mount and on window focus to catch any missed heartbeats.

### R6: Notification delivery at scale

**Description:** When a new episode airs for a bookmarked anime, the system must create notifications for all users who bookmarked it with `notify_on_new_episode = true`. For popular anime with 100K+ bookmarks, this creates a burst of inserts that may overwhelm the database.

**Likelihood:** Low (in M8; scales in M10) · **Impact:** Medium (notification delay for popular titles)

**Mitigation:**

- M8 creates notifications synchronously for single-user actions (e.g., "episode available"). Bulk notifications (new episode for all bookmarkers) are deferred to a background job queue (M10).
- The `notifications` table is indexed on `(user_id, created_at DESC)` and `(user_id, is_read)` for fast unread count queries.
- For M8, limit bulk notification creation to anime with < 10K bookmarks; larger titles are queued.
- Test: create notification for 100 users; verify < 500ms total insert time.

### R7: URL-driven state synchronization

**Description:** Watchlist view mode (grid/list), sort, and filter state are stored in URL query params. If the URL and internal state drift (e.g., due to browser back/forward navigation), the UI may not reflect the URL.

**Likelihood:** Medium · **Impact:** Low (minor UI inconsistency)

**Mitigation:**

- Single source of truth: `searchParams` from `useSearchParams()`. All filter/view reads derive from URL; all writes call `router.replace()`.
- Zod schema validates URL params; invalid values fall back to defaults.
- Listen for `popstate` events and re-sync state from URL on browser back/forward.
- Integration test: apply filters, click browser back, verify UI matches previous state.

---

## 7. Acceptance Criteria

Each criterion is binary pass/fail. All must pass for the milestone to be considered complete.

1. **Watchlist page loads:** Navigating to `/watchlist` (authenticated) renders the watchlist with the user's bookmarked anime in grid view by default; count badge shows correct number.
2. **Add to watchlist:** Clicking "Add to Watchlist" on an anime card (or via Server Action) adds the anime to the watchlist; UI updates optimistically; item appears in the list.
3. **Remove from watchlist:** Clicking "Remove" in the anime's overflow menu removes it; UI updates optimistically; item disappears from the list.
4. **Optimistic update rollback:** If the Server Action fails (simulated 500), the UI reverts to the previous state and a toast notification appears with the error message.
5. **Watchlist filter by status:** Clicking a filter chip (e.g., "watching") filters the list to only show anime with that status; URL updates with `?status=watching`; filter persists on reload.
6. **Watchlist sort:** Changing sort (recent/alphabetical/status) reorders the list; URL updates with `?sort=alphabetical`; sort persists on reload.
7. **Watchlist view toggle:** Clicking the view toggle switches between grid and list view; URL updates with `?view=list`; view persists on reload.
8. **Watchlist reorder:** In reorder mode, clicking up/down moves the item; sort order persists to the backend; order survives page reload.
9. **Watchlist empty state:** When the user has no bookmarks, the empty state renders with illustration, message, and "Explore Trending" CTA button.
10. **Watch history page loads:** Navigating to `/history` renders the user's watch history with progress bars; entries sorted by `watched_at` descending.
11. **Watch history progress bar:** Each history entry shows a progress bar with `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`; width matches `completion_pct`.
12. **Watch history empty state:** When the user has no watch history, the empty state renders with illustration and "Browse trending" CTA.
13. **Clear watch history:** Clicking "Clear History" opens a confirmation modal; confirming anonymizes all watch history entries; list becomes empty.
14. **Continue-watching page loads:** Navigating to `/continue-watching` renders the list of partially-watched episodes (>5% and <95% progress).
15. **Continue-watching progress card:** Each card shows thumbnail, progress bar, episode number, "Resume" button (links to `/watch/{animeId}?ep={n}&t={seconds}`), and "Restart" button (links to `?t=0`).
16. **Continue-watching accordion:** Episodes are grouped by anime; groups are collapsed by default; clicking expands to show episode cards; `aria-expanded` reflects state.
17. **Continue-watching empty state:** When no episodes are in progress, the empty state renders with illustration and "Browse trending" CTA.
18. **Profile page loads:** Navigating to `/profile` renders the user's profile with avatar, display name, username, join date, plan badge, stats, bio, activity, and quick links.
19. **Profile stats:** Stats row shows 4 metrics: anime watched (count from watch_history), episodes (count), hours (sum of watch_duration_seconds / 3600), watchlist count (from bookmarks).
20. **Profile edit modal:** Clicking Edit opens a modal with display name input (max 32 chars) and bio textarea (max 280 chars); character count shown with `aria-live="polite"`; Save persists changes; Cancel discards.
21. **Avatar upload:** Clicking avatar opens file picker; selecting a jpeg/png/webp file (< 5MB) shows preview; Save uploads to server; avatar updates on page; oversized/unsupported files show error.
22. **Settings page loads:** Navigating to `/settings` renders the settings page with 4 tabs; default tab is `account`; URL reflects `?tab=account`.
23. **Settings tab navigation:** Clicking a tab switches the panel; URL updates; unsaved changes trigger a toast warning when switching tabs.
24. **Accessibility settings persist:** Toggling reduced motion, font size, high contrast, autoplay, and captions default persists to backend; settings survive page reload.
25. **Delete account modal:** Clicking "Delete Account" opens a confirmation modal requiring typed confirmation; focus trap active; ESC closes modal.
26. **Notifications page loads:** Navigating to `/notifications` renders the notification list; unread notifications have a visual indicator; unread count badge updates.
27. **Mark notification read:** Clicking a notification marks it as read (visual indicator removed); navigating to the notification's `resource_url`; unread count decrements.
28. **Mark all notifications read:** Clicking "Mark all as read" marks all notifications as read; unread count becomes zero; badge hides.
29. **Notification badge in header:** The header shows a notification badge with unread count; count updates in real-time (polling every 30s or on focus); `aria-live="polite"`.
30. **URL-driven state survives reload:** All URL-driven state (watchlist view/sort/filter, settings tab) survives page reload and incognito open.
31. **TypeScript strict compliance:** `pnpm typecheck` passes; no `any` types in `apps/web/src/components/watchlist/`, `history/`, `continue-watching/`, `profile/`, `settings/`, `notifications/`, or `apps/web/src/actions/`.
32. **Build passes:** `pnpm build` succeeds; no new lint or type errors.
33. **Rate limit enforcement:** Exceeding 10 bookmark requests per 60 seconds returns 429; exceeding 30 continue-watching requests per 60 seconds returns 429.

---

## 8. QA Checklist

### Functional

- [ ] Watchlist page renders with user's bookmarks in grid view
- [ ] Add to watchlist works; item appears; optimistic update commits on success
- [ ] Remove from watchlist works; item disappears; optimistic update commits on success
- [ ] Optimistic update rolls back on server error; toast appears
- [ ] Filter by status works; URL updates; persists on reload
- [ ] Sort works; URL updates; persists on reload
- [ ] View toggle (grid/list) works; URL updates; persists on reload
- [ ] Reorder works; order persists on reload
- [ ] Empty state renders with CTA when no bookmarks
- [ ] Watch history page renders with progress bars
- [ ] Progress bar shows correct percentage; ARIA attributes present
- [ ] Watch history empty state renders with CTA
- [ ] Clear watch history works; confirmation modal; list empties
- [ ] Continue-watching page renders with progress cards
- [ ] "Resume" button links to correct episode with timestamp
- [ ] "Restart" button links to episode at t=0
- [ ] Anime group accordion expands/collapses; ARIA attributes present
- [ ] Continue-watching empty state renders with CTA
- [ ] Profile page renders with all sections (header, stats, bio, activity, quick links)
- [ ] Profile edit modal opens; saves changes; cancels without saving
- [ ] Avatar upload accepts valid files; rejects oversized/unsupported; updates avatar
- [ ] Settings page renders with 4 tabs; default is account
- [ ] Tab navigation works; URL updates; unsaved changes warning
- [ ] Accessibility settings persist across reloads
- [ ] Delete account modal requires typed confirmation; ESC closes
- [ ] Notifications page renders; unread indicator visible
- [ ] Clicking notification marks as read; navigates to resource URL
- [ ] "Mark all as read" works; badge hides
- [ ] Notification badge in header shows correct count; updates on focus
- [ ] URL-driven state survives reload and incognito open

### Performance

- [ ] Watchlist page loads < 500ms (p95) with 50 bookmarks
- [ ] Optimistic update renders in < 100ms (no perceived lag)
- [ ] Avatar upload completes < 3s for 2MB file on 4G
- [ ] Notification list loads < 300ms (p95) with 100 notifications
- [ ] Settings PATCH < 200ms (p95)
- [ ] Watchlist reorder debounce prevents more than 1 request per 300ms

### Accessibility

- [ ] Count badge uses `aria-live="polite"`
- [ ] Filter chips use `role="group"` with `aria-pressed`
- [ ] Cards use `article` with `aria-label`
- [ ] Reorder buttons have `aria-label="Move {title} up/down"`
- [ ] Progress bars use `role="progressbar"` with `aria-valuenow/min/max`
- [ ] Accordion uses `aria-expanded` and `aria-controls`
- [ ] Modal has focus trap; ESC closes; focus returns to trigger
- [ ] All form inputs have `<label>` elements
- [ ] Toggles use `role="switch"` with `aria-checked`
- [ ] `prefers-reduced-motion` disables animations
- [ ] Color contrast meets WCAG 2.2 AA

### Cross-browser

- [ ] Chrome 125+ (latest)
- [ ] Firefox 126+ (latest)
- [ ] Safari 17+ (latest)
- [ ] Edge 125+ (latest)
- [ ] Mobile Safari (iOS 17)
- [ ] Chrome for Android (latest)

### Security

- [ ] All endpoints require authentication; userId from session, not body
- [ ] Avatar upload validates file type and size server-side
- [ ] Bookmark rate limiting active (10/60s)
- [ ] Continue-watching rate limiting active (30/60s)
- [ ] Settings update validates all fields via Zod (no arbitrary JSONB writes)
- [ ] No user data leaked across users (A user cannot see B's bookmarks)
- [ ] No secrets, API keys, or tokens in code

---

## 9. Estimated Tasks

| #         | Task                                                                                                                      | Estimate    | Dependencies           | Notes                                                                     |
| :-------- | :------------------------------------------------------------------------------------------------------------------------ | :---------- | :--------------------- | :------------------------------------------------------------------------ |
| T1        | Scaffold `apps/web/src/components/` directories (watchlist, history, continue-watching, profile, settings, notifications) | 0.5d        | M1                     |                                                                           |
| T2        | Implement type definitions (`watchlist-types.ts`, `settings-types.ts`, `notification-types.ts`)                           | 0.5d        | —                      |                                                                           |
| T3        | Implement `watchlistService`                                                                                              | 0.5d        | M3 bookmarks table     |                                                                           |
| T4        | Implement `historyService`                                                                                                | 0.5d        | M3 watch_history table |                                                                           |
| T5        | Implement `profileService`                                                                                                | 0.5d        | M3 users table         |                                                                           |
| T6        | Implement `settingsService`                                                                                               | 0.5d        | M3 users.preferences   | JSONB merge logic                                                         |
| T7        | Implement `notificationService`                                                                                           | 0.5d        | M3 notifications table |                                                                           |
| T8        | Implement bookmark API routes (list, add, update, remove, check)                                                          | 2d          | T3, M3 auth            | Rate-limited; idempotency keys                                            |
| T9        | Implement watch history API routes (list, delete)                                                                         | 1d          | T4, M3 auth            |                                                                           |
| T10       | Implement continue-watching API routes (list, upsert, heartbeat, delete)                                                  | 1.5d        | M3 auth                | Rate-limited; version conflict handling                                   |
| T11       | Implement profile API routes (read, update)                                                                               | 1d          | T5, M3 auth            |                                                                           |
| T12       | Implement avatar upload API route                                                                                         | 1.5d        | M3 auth, R2            | Multipart form; size validation                                           |
| T13       | Implement settings API routes (read, update)                                                                              | 1d          | T6, M3 auth            | JSONB merge                                                               |
| T14       | Implement notification API routes (list, mark-read, delete)                                                               | 1d          | T7, M3 auth            |                                                                           |
| T15       | Implement `addToWatchlist` Server Action                                                                                  | 0.5d        | T8, M3 auth            | Zod; optimistic update support                                            |
| T16       | Implement `removeFromWatchlist` Server Action                                                                             | 0.5d        | T8, M3 auth            | Zod; optimistic update support                                            |
| T17       | Implement `reorderWatchlist` Server Action                                                                                | 1d          | T8, M3 auth            | Transaction; gap-based sort                                               |
| T18       | Implement `updateProfile` Server Action                                                                                   | 0.5d        | T11, M3 auth           | Zod; max 32/280 chars                                                     |
| T19       | Implement `uploadAvatar` Server Action                                                                                    | 1d          | T12, M3 auth           | File validation; R2 upload                                                |
| T20       | Implement `updateSettings` Server Action                                                                                  | 0.5d        | T13, M3 auth           | JSONB merge; Zod                                                          |
| T21       | Implement `markNotificationRead` Server Action                                                                            | 0.5d        | T14, M3 auth           | Single or bulk                                                            |
| T22       | Implement `clearWatchHistory` Server Action                                                                               | 0.5d        | T9, M3 auth            | Anonymize; not hard-delete                                                |
| T23       | Implement `useWatchlist` hook with optimistic updates                                                                     | 1.5d        | T15, T16               | Local state management                                                    |
| T24       | Implement `useWatchHistory` hook                                                                                          | 0.5d        | T9                     | Cursor pagination                                                         |
| T25       | Implement `useContinueWatching` hook                                                                                      | 0.5d        | T10                    | Refetch on focus                                                          |
| T26       | Implement `useNotifications` hook                                                                                         | 0.5d        | T14                    | Polling; unread count                                                     |
| T27       | Implement `useProfile` hook                                                                                               | 0.5d        | T11                    |                                                                           |
| T28       | Implement `useSettings` hook                                                                                              | 0.5d        | T13                    |                                                                           |
| T29       | Implement `WatchlistPage` + `WatchlistHeader` + `FilterBar` + `SortDropdown` + `ViewToggle`                               | 1.5d        | T23                    | URL-driven state                                                          |
| T30       | Implement `WatchlistGrid` + `WatchlistList` + `AnimeCard` + `StatusBadge` + `OverflowMenu`                                | 2d          | T29                    |                                                                           |
| T31       | Implement `ReorderControls`                                                                                               | 0.5d        | T17                    |                                                                           |
| T32       | Implement `WatchlistEmptyState`                                                                                           | 0.25d       | —                      |                                                                           |
| T33       | Implement `HistoryPage` + `HistoryHeader` + `HistoryList` + `HistoryEntry`                                                | 1.5d        | T24                    | Progress bars                                                             |
| T34       | Implement `HistoryEmptyState`                                                                                             | 0.25d       | —                      |                                                                           |
| T35       | Implement `ContinueWatchingPage` + `ProgressGrid` + `ProgressCard` + `AnimeGroup`                                         | 1.5d        | T25                    | Accordion                                                                 |
| T36       | Implement `ContinueWatchingEmptyState`                                                                                    | 0.25d       | —                      |                                                                           |
| T37       | Implement `ProfilePage` + `ProfileHeader` + `StatsRow` + `AboutSection` + `ActivitySection` + `QuickLinksSection`         | 2d          | T27                    |                                                                           |
| T38       | Implement `AvatarUpload`                                                                                                  | 1d          | T19                    | File picker; preview                                                      |
| T39       | Implement `ProfileEditModal`                                                                                              | 1d          | T18                    | Focus trap; char count                                                    |
| T40       | Implement `SettingsLayout` + `SettingsSidebar`                                                                            | 1d          | —                      | Responsive tabs                                                           |
| T41       | Implement `AccountPanel`                                                                                                  | 1d          | T39                    | Reuses profile edit                                                       |
| T42       | Implement `BillingPanel` (stub)                                                                                           | 0.5d        | —                      | Static placeholder                                                        |
| T43       | Implement `NotificationsPanel`                                                                                            | 1d          | T20                    | Toggle switches                                                           |
| T44       | Implement `AccessibilityPanel`                                                                                            | 1d          | T20                    | Reduced motion, font size, etc.                                           |
| T45       | Implement `DangerZoneSection` + `DeleteAccountModal`                                                                      | 1d          | M3 auth                | Type-to-confirm                                                           |
| T46       | Implement `NotificationList` + `NotificationItem` + `NotificationBadge`                                                   | 1d          | T26                    |                                                                           |
| T47       | Implement `NotificationEmptyState`                                                                                        | 0.25d       | —                      |                                                                           |
| T48       | Implement URL-driven state parser/serializer for watchlist                                                                | 0.5d        | T29                    | Zod schema                                                                |
| T49       | Implement page layouts and responsive CSS                                                                                 | 1.5d        | T29-T47                |                                                                           |
| T50       | Implement loading skeletons for all pages                                                                                 | 1d          | M1 `Skeleton`          |                                                                           |
| T51       | Implement error boundaries for all pages                                                                                  | 1d          | M1 `ErrorBoundary`     |                                                                           |
| T52       | Implement SEO metadata for all pages                                                                                      | 0.5d        | —                      |                                                                           |
| T53       | Accessibility audit + fixes                                                                                               | 2d          | T29-T47                | Focus trap, ARIA, keyboard                                                |
| T54       | Performance audit + fixes                                                                                                 | 1d          | T29-T47                |                                                                           |
| T55       | Integration tests (Server Actions, optimistic updates, reorder)                                                           | 2.5d        | T15-T22                |                                                                           |
| T56       | E2E tests (watchlist flow, profile edit, settings, notifications)                                                         | 2d          | T29-T47                | Playwright                                                                |
| **Total** |                                                                                                                           | **~47.25d** |                        | ~7-8 weeks with 1 engineer; parallelizable across 2 engineers to ~4 weeks |

---

## 10. Completion Checklist

- [ ] All 33 acceptance criteria pass
- [ ] All QA checklist items verified
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm build` succeeds
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (unit + integration)
- [ ] E2E tests pass in CI
- [ ] Performance budget met (watchlist < 500ms, optimistic update < 100ms, avatar upload < 3s)
- [ ] Accessibility audit passed (axe-core or Lighthouse)
- [ ] Responsive verified at 380/768/1024/1440
- [ ] Cross-browser verified (Chrome, Firefox, Safari, Edge, Mobile Safari, Chrome Android)
- [ ] Optimistic update rollback tested (simulated server error)
- [ ] Bookmark reorder tested (rapid clicks; final order correct)
- [ ] Avatar upload rejects oversized/unsupported files server-side
- [ ] Settings JSONB merge handles concurrent updates correctly
- [ ] Continue-watching empty state renders when M7 not yet complete
- [ ] URL-driven state survives reload and incognito
- [ ] Rate limiting verified on bookmarks and continue-watching endpoints
- [ ] No user data leaked across users (authorization tested)
- [ ] No secrets, API keys, or tokens in code
- [ ] No `any` types or `ts-ignore` comments introduced
- [ ] Monitoring: Server Action errors instrumented with logging
- [ ] PR reviewed and approved by at least one engineer
- [ ] Branch merged to `main` and CI green post-merge
