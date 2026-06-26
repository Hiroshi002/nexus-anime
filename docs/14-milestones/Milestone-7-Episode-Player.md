# M7 — Episode Player

> **Goal:** Deliver the core video playback experience with Cloudflare Stream integration, signed URL issuance, a custom client-island player with full playback controls, progress tracking with resume, auto-next-episode, keyboard shortcuts, and accessibility.
> **Spec version:** 1.0.0 · **Last reviewed:** 2026-06-26 · **Owner:** Engineering

---

## 1. Objective

Implement the Episode Player page (`/watch/{animeSlug}/{episodeNumber}`) as the primary viewing surface for the platform. The player must deliver low-latency video playback via Cloudflare Stream with short-lived signed URLs, a custom client-island player wrapping the Stream SDK with full playback controls (play/pause, seek, volume, quality, speed, fullscreen, theater mode), automatic progress tracking with resume-from-position, auto-next-episode with countdown overlay, keyboard shortcuts, subtitle track support, and comprehensive error/loading states.

This milestone covers the **player UI, client island, signed URL flow, progress persistence, and player-related API routes**. The underlying catalog data (episodes, anime) is delivered in M2. Authentication (M3) gates progress tracking and premium gating. Search (M4) and Homepage (M5) are not required but are common entry points to the player.

Design reference: `docs/05-ui/Episode-Player.md`
API reference: `docs/06-api/Episodes.md`, `docs/06-api/Continue-Watching.md`, `docs/06-api/Watch-History.md`

---

## 2. Scope

### In scope

- `apps/web/src/app/watch/[animeSlug]/[episodeNumber]/page.tsx` — player route (Server Component, `robots: noindex`)
- `apps/web/src/app/watch/[animeSlug]/[episodeNumber]/layout.tsx` — player layout with minimal chrome
- `apps/web/src/app/watch/[animeSlug]/[episodeNumber]/loading.tsx` — 16:9 skeleton loader
- `apps/web/src/app/watch/[animeSlug]/[episodeNumber]/error.tsx` — error boundary with retry
- `apps/web/src/app/watch/[animeSlug]/[episodeNumber]/not-found.tsx` — 404 for missing episodes
- `apps/web/src/components/player/` — `EpisodePlayerPage`, `PlayerTopBar`, `PlayerContainer` (Server Component), `PlayerIsland` (Client Component, dynamic import), `PlayerControls`, `QualitySelector`, `PlaybackSpeedSelector`, `SubtitleSelector`, `UpNextOverlay`, `EpisodeSidebar`, `EpisodeDescription`, `RelatedAnime`
- `apps/web/src/components/player/skeletons/` — `PlayerSkeleton`, `EpisodeCardSkeleton`
- `apps/web/src/components/player/overlays/` — `GeoBlockOverlay`, `PaywallOverlay`, `ErrorOverlay`, `LoadingOverlay`
- `apps/web/src/hooks/` — `usePlayer`, `useProgressHeartbeat`, `useSignedUrl`, `useKeyboardShortcuts`, `usePlaybackSpeed`
- `apps/web/src/actions/` — `saveProgress`, `markEpisodeComplete`, `reportPlaybackError`
- `apps/web/src/lib/services/` — `playerService` (signed URL fetch), `progressService` (heartbeat calls)
- `apps/web/src/lib/player/` — `keyboard-shortcuts.ts`, `player-constants.ts`, `player-utils.ts`
- API route: `apps/web/app/api/v1/episodes/[id]/stream/route.ts` — signed URL issuance
- API route: `apps/web/app/api/v1/watch/progress/route.ts` — progress upsert (POST) and list (GET)
- API route: `apps/web/app/api/v1/watch/progress/[episodeId]/route.ts` — single-episode progress read
- Signed URL generation: 5-minute TTL, geo-restriction enforcement, HLS protocol
- Progress tracking: 10-second heartbeat interval, immediate save on seek, completion marker at 95%+
- Auto-next: 5-second countdown overlay, navigate to next episode on expiry or click
- Resume: seek to saved position on player initialization
- Keyboard shortcuts: Space/k, arrows, m, f, n, p, j/l, 0-9
- Subtitle track support via Cloudflare Stream subtitle overlay
- Error states: expired URL (silent refresh), geo-block, premium paywall, network failure, episode not found
- Loading states: 16:9 skeleton with play icon, smooth transition to player
- Accessibility: WCAG 2.2 AA, ARIA labels, focus trap in fullscreen, keyboard-only operation
- Responsive: desktop (player + sidebar), tablet (full-width player + below sidebar), mobile (stacked, no sidebar)
- SEO: `robots: noindex, nofollow`; canonical points to parent anime detail

### Out of scope

- Homepage (M4) — entry point but not required for player functionality
- Anime Detail page (M6) — linked from top bar but implemented separately
- Comments, Ratings, Recommendations (M8+) — may appear below player but not in M7
- Offline playback / download
- Picture-in-Picture (future — browser API, not in M7)
- Chromecast / AirPlay (future)
- Multi-language audio tracks (Cloudflare Stream supports this but UI deferred)
- Server-side ad insertion (SAI)
- Analytics events beyond playback-start and playback-error

---

## 3. Deliverables

| # | Deliverable | Location | Acceptance |
| :-- | :-- | :-- | :-- |
| D1 | Player route page (Server Component) | `apps/web/src/app/watch/[animeSlug]/[episodeNumber]/page.tsx` | Renders `PlayerContainer`; fetches episode metadata server-side; returns 404 for missing episode; `robots: noindex` |
| D2 | `PlayerContainer` (Server Component) | `apps/web/src/components/player/PlayerContainer.tsx` | Fetches signed URL; passes URL + metadata to `PlayerIsland`; handles signed URL error with `ErrorOverlay` |
| D3 | `PlayerIsland` (Client Component, dynamic import) | `apps/web/src/components/player/PlayerIsland.tsx` | Wraps Cloudflare Stream player; manages playback state; emits progress events; handles auto-next |
| D4 | `PlayerControls` | `apps/web/src/components/player/PlayerControls.tsx` | Play/pause, seek bar, volume slider, quality selector, speed selector, fullscreen, theater mode; ARIA labels on all controls |
| D5 | `QualitySelector` | `apps/web/src/components/player/QualitySelector.tsx` | Auto / 1080p / 720p / 480p / 360p; active state visible; keyboard accessible |
| D6 | `PlaybackSpeedSelector` | `apps/web/src/components/player/PlaybackSpeedSelector.tsx` | 0.5x / 0.75x / 1x / 1.25x / 1.5x / 2x; persists across episodes in session |
| D7 | `SubtitleSelector` | `apps/web/src/components/player/SubtitleSelector.tsx` | Lists available subtitle tracks; toggle on/off; keyboard accessible |
| D8 | `UpNextOverlay` | `apps/web/src/components/player/UpNextOverlay.tsx` | Shows next episode thumbnail + title; 5-second countdown; "Next" and "Cancel" buttons; auto-navigates on zero |
| D9 | `PlayerTopBar` | `apps/web/src/components/player/PlayerTopBar.tsx` | Back link to anime detail, anime title, episode number; "Up Next" countdown indicator |
| D10 | `EpisodeSidebar` | `apps/web/src/components/player/EpisodeSidebar.tsx` | Season selector dropdown; scrollable episode list; active episode highlighted; keyboard navigable |
| D11 | `EpisodeDescription` | `apps/web/src/components/player/EpisodeDescription.tsx` | Episode synopsis, metadata (air date, duration), tags |
| D12 | `GeoBlockOverlay` | `apps/web/src/components/player/overlays/GeoBlockOverlay.tsx` | "This episode is not available in your region." with "Back to Anime" button |
| D13 | `PaywallOverlay` | `apps/web/src/components/player/overlays/PaywallOverlay.tsx` | Premium episode paywall with upgrade CTA; shown to free users |
| D14 | `ErrorOverlay` | `apps/web/src/components/player/overlays/ErrorOverlay.tsx` | Generic error message with "Retry" button; "Report a problem" link |
| D15 | `PlayerSkeleton` | `apps/web/src/components/player/skeletons/PlayerSkeleton.tsx` | 16:9 skeleton with play icon; no layout shift when player loads |
| D16 | Signed URL API route | `apps/web/app/api/v1/episodes/[id]/stream/route.ts` | Returns signed URL with 5-minute TTL; enforces auth for premium; geo-restriction; cache `private, no-cache, no-store, must-revalidate` |
| D17 | Progress API route (upsert) | `apps/web/app/api/v1/watch/progress/route.ts` | POST: upsert progress; requires auth; rate-limit 30/60s; Zod validation |
| D18 | Progress API route (read) | `apps/web/app/api/v1/watch/progress/[episodeId]/route.ts` | GET: return progress for single episode; 404 if not found; auth required |
| D19 | `useProgressHeartbeat` hook | `apps/web/src/hooks/useProgressHeartbeat.ts` | Fires every 10s; fires on seek; cleans up on unmount; uses `navigator.sendBeacon` on page hide |
| D20 | `useKeyboardShortcuts` hook | `apps/web/src/hooks/useKeyboardShortcuts.ts` | Maps keyboard events to player actions; respects focus state (disabled in inputs); shows OSD feedback |
| D21 | `saveProgress` Server Action | `apps/web/src/actions/saveProgress.ts` | Zod-validated; requireUser; upsert via progress API; optimistic update on client |
| D22 | `markEpisodeComplete` Server Action | `apps/web/src/actions/markEpisodeComplete.ts` | Sets `is_completed=true`, `progress_pct=100`; navigates to next episode or shows "Series Complete" |
| D23 | `reportPlaybackError` Server Action | `apps/web/src/actions/reportPlaybackError.ts` | Logs client-side playback errors for monitoring; no auth required (anonymous OK); rate-limited |
| D24 | Player utility constants | `apps/web/src/lib/player/player-constants.ts` | Key mappings, speed options, quality options, heartbeat interval, countdown duration |
| D25 | Keyboard shortcut definitions | `apps/web/src/lib/player/keyboard-shortcuts.ts` | Key-to-action map; seek distances; volume step; shortcut labels for OSD |
| D26 | Responsive layout (desktop / tablet / mobile) | `apps/web/src/components/player/` | Desktop: player 2/3 + sidebar 1/3 sticky; Tablet: full-width player + sidebar below; Mobile: stacked, no sidebar, full-width player |
| D27 | SEO metadata + canonical | `apps/web/src/app/watch/[animeSlug]/[episodeNumber]/page.tsx` | `robots: noindex, nofollow`; canonical → anime detail; OG title "{Episode Title} — {Anime Title} \| Nexus Anime" |

---

## 4. Prerequisites

Before M7 begins, the following must be complete:

- **M0 — Repository Scaffold:** Turborepo, pnpm workspaces, folder structure, CI pipeline
- **M1 — Project Foundation:** `@nexus/ui` component library with `Button`, `Badge`, `Card`, `Skeleton`, `ErrorBoundary`, `Select`, `Slider` primitives; theme tokens; Tailwind 4
- **M2 — Catalog Foundation:** Episode data layer live — `episodes` table populated, `GET /api/v1/anime/{animeId}/episodes` and `GET /api/v1/episodes/{id}` endpoints operational, Cloudflare Stream account configured with video assets uploaded, `video_asset_id` populated for episodes
- **M3 — Auth Complete:** Auth.js v5 session management; `requireUser` helper; premium gating infrastructure (free vs premium episode access)
- **M6 — Anime Detail (recommended):** The player's back-link target; top bar links to anime detail page. M7 can proceed without M6 but the back button must gracefully fall back to `/` if detail page is not yet built.

---

## 5. Dependencies

### Upstream (must exist before M7 starts)

| Dependency | Type | Source | Contract |
| :-- | :-- | :-- | :-- |
| `GET /api/v1/episodes/{id}` | REST endpoint | M2 | Returns full `Episode` record including `video_asset_id`, `is_premium`, `number`, `season_id` |
| `GET /api/v1/anime/{animeId}/episodes` | REST endpoint | M2 | Returns `EpisodeSummary[]` for sidebar; supports `season_id` filter |
| `episodes` table with `video_asset_id` | Database | M2 | Opaque Cloudflare Stream asset ID; used to generate signed URLs |
| Cloudflare Stream account + API | External | Infrastructure | Signed URL API; CORS config for `nexus-anime.com` origin |
| Auth.js v5 session | Library | M3 | `requireUser` for progress tracking; premium gating |
| `@nexus/ui` components | Package | M1 | `Button`, `Badge`, `Skeleton`, `Select`, `Slider`, `ErrorBoundary` |
| `@nexus/cache` | Package | M2 | Redis caching for episode metadata (optional for player) |

### Downstream (will consume M7)

| Consumer | What they need | Milestone |
| :-- | :-- | :-- |
| M8 — User Features | `useProgressHeartbeat` data feeds Continue Watching; watch history table populated by M7 progress writes | M8 |
| M10 — Production | Signed URL monitoring, playback error tracking, progress write latency dashboards | M10 |

### External services

| Service | Purpose | Failure mode |
| :-- | :-- | :-- |
| Cloudflare Stream | Video delivery via signed HLS URLs | Signed URL failure → `ErrorOverlay` with retry; geo-fallback → `GeoBlockOverlay` |
| Upstash Redis | Cache episode metadata; rate-limit progress writes | Cache miss → direct DB query; Redis down → fail open for reads, 429 for writes |
| Postgres (Neon) | Episode metadata, `continue_watching` table, `watch_history` table | Query timeout → 503 `PROGRESS_BACKEND_UNAVAILABLE` |
| Vercel Edge | Rate limiting (30/60s per user for progress) | Fail open; 429 with `Retry-After` header |

---

## 6. Risks

### R1: Signed URL expiry during playback

**Description:** Cloudflare Stream signed URLs have a 5-minute TTL. If the URL expires mid-playback, the player will stall or throw an error. Network latency or slow initial load may cause the effective window to be shorter.

**Likelihood:** High · **Impact:** High (playback interruption — the most visible degradation)

**Mitigation:**
- Implement a silent refresh mechanism: `useSignedUrl` hook re-fetches a new signed URL 60 seconds before expiry, using the `expires_at` timestamp from the API response.
- The player island listens for `signedUrlExpired` event from the SDK and calls the refresh function without tearing down the player instance.
- Refresh uses `document.hidden` awareness: do not refresh if the tab is backgrounded (the URL will not expire if not actively playing).
- Test: start playback, wait 4 minutes, verify seamless transition to new URL; verify no frame drop.

### R2: Progress heartbeat data loss on page navigation

**Description:** When the user navigates away from the player (e.g., clicks "Next Episode" or closes the tab), the final progress heartbeat may not complete. If the 10-second interval has not fired recently, the user may lose up to 10 seconds of progress data.

**Likelihood:** Medium · **Impact:** Low (minor resume position discrepancy)

**Mitigation:**
- Use `navigator.sendBeacon()` in the `visibilitychange` handler (tab hide / beforeunload) to flush the current progress state. `sendBeacon` is more reliable than `fetch` for page-exit sends.
- On episode switch within the player (sidebar click or auto-next), fire an immediate `POST /api/v1/watch/progress` before navigating.
- The `useProgressHeartbeat` hook fires on `seek` events immediately, so manual seeking is always persisted.
- Acceptable: up to 5 seconds of progress loss on abrupt tab close; not acceptable: loss of entire session progress.

### R3: Cloudflare Stream SDK bundle size

**Description:** The Cloudflare Stream SDK is a client-side JavaScript bundle (~150KB minified). If loaded eagerly, it blocks the critical rendering path and inflates the initial page load, violating the < 2s video start time target.

**Likelihood:** High · **Impact:** Medium (slow initial load on low-end devices and slow networks)

**Mitigation:**
- `PlayerIsland` is loaded via `next/dynamic` with `ssr: false` and a `PlayerSkeleton` fallback. The Stream SDK is never loaded during SSR.
- Preconnect to Cloudflare Stream CDN (`<link rel="preconnect">`) in the player layout to reduce DNS/TLS latency.
- The signed URL fetch happens server-side in `PlayerContainer`; the client only fetches the SDK + the URL from a lightweight API route.
- Measure: SDK load time on 3G throttling; target < 1.5s from page load to SDK ready.

### R4: Geo-restriction accuracy

**Description:** Cloudflare Stream signed URLs enforce geo-restriction based on IP. If the IP geolocation database is inaccurate (e.g., VPN users, corporate proxies), legitimate users may be blocked, or unauthorized users may bypass the restriction.

**Likelihood:** Low · **Impact:** Medium (legitimate users blocked = support tickets; bypass = licensing violation)

**Mitigation:**
- Geo-restriction is a business requirement imposed by licensing; inaccuracy is a known limitation.
- The `GeoBlockOverlay` includes a "Report a problem" link so blocked users can request a review.
- Log geo-block events with the user's country code for manual review; alert if block rate exceeds expected baseline.
- Document: geo-restriction is best-effort; determined VPN users may bypass. This is acceptable per content licensing terms.

### R5: Playback speed persistence across episodes

**Description:** The feature spec requires playback speed to persist across episodes within a session. If the state is lost on episode navigation (auto-next or sidebar click), the user must repeatedly reset speed.

**Likelihood:** Medium · **Impact:** Low (minor UX friction)

**Mitigation:**
- Store playback speed in a session-level `usePlaybackSpeed` hook that wraps the player island. The hook reads from `sessionStorage` on mount (default 1x) and writes on every speed change.
- On auto-next, the `PlayerIsland` component is unmounted and remounted with the new episode; the `usePlaybackSpeed` hook persists via `sessionStorage` and applies the saved speed to the new player instance.
- Test: set speed to 1.5x, trigger auto-next, verify new episode plays at 1.5x.

### R6: Keyboard shortcut conflicts with browser defaults

**Description:** Some keyboard shortcuts (e.g., Space scrolls pages, F opens find-in-page) may conflict with browser defaults. If the player does not properly prevent default behavior, users may experience unexpected page navigation.

**Likelihood:** Medium · **Impact:** Low (annoying but not breaking)

**Mitigation:**
- `useKeyboardShortcuts` hook calls `event.preventDefault()` only when the player is focused or fullscreen, and the key is in the shortcut map.
- Shortcuts are disabled when focus is in an input, textarea, or contenteditable element (detected via `document.activeElement.tagName`).
- The shortcut overlay (OSD) shows the action name and key, providing visual feedback that the shortcut was recognized.
- Test: type in a search input while player is loaded; verify Space scrolls the page, not toggles play.

### R7: Progress write contention on shared devices

**Description:** On shared devices, if two users watch the same episode concurrently, the `continue_watching` row may experience write contention. The `version` field provides optimistic concurrency, but a `VERSION_CONFLICT` (409) response may cause progress loss.

**Likelihood:** Low · **Impact:** Low (edge case — shared devices are uncommon for streaming)

**Mitigation:**
- The `PATCH /api/v1/users/me/continue-watching/{animeId}` endpoint requires `version`. On 409, the client re-fetches the latest progress and merges (server-wins for position).
- Heartbeat interval (10s) is long enough to minimize contention; concurrent writes are unlikely in practice.
- Document: shared-device concurrent playback is not a supported use case; last writer wins.

---

## 7. Acceptance Criteria

Each criterion is binary pass/fail. All must pass for the milestone to be considered complete.

1. **Player page loads:** Navigating to `/watch/{animeSlug}/{episodeNumber}` renders the player page with a 16:9 skeleton, then loads the Cloudflare Stream player within 2 seconds on a 4G connection.
2. **Signed URL issuance:** `GET /api/v1/episodes/{id}/stream` returns a signed URL with 5-minute `expires_at`, `playback_protocol: "hls"`, and geo-restriction fields; response is `private, no-cache, no-store, must-revalidate`.
3. **Signed URL requires auth for premium:** Free episodes return signed URLs without auth; premium episodes return 401 for unauthenticated requests and 403 for free-tier authenticated users.
4. **Playback controls functional:** Play/pause, seek bar (draggable), volume slider (0-100%), quality selector (auto/1080p/720p/480p/360p), speed selector (0.5x-2x), fullscreen toggle, and theater mode toggle all work.
5. **Progress tracking (heartbeat):** While playing, `POST /api/v1/watch/progress` fires every 10 seconds (±2s tolerance); `position_seconds` increments correctly; `progress_pct` is computed server-side.
6. **Progress tracking (seek):** Dragging the seek bar triggers an immediate progress save; `position_seconds` matches the seek target.
7. **Progress flush on navigate:** Clicking a sidebar episode link fires a final progress save before navigation; `sendBeacon` fires on `visibilitychange` (tab hide).
8. **Resume from position:** Returning to an episode with saved progress (> 5% and < 95%) seeks the player to the saved `position_seconds` on load; playback begins from that point.
9. **Auto-next episode:** When an episode ends (position >= 95% of duration), `UpNextOverlay` appears with a 5-second countdown; on zero, the player navigates to the next episode URL without full page reload.
10. **Last episode handling:** When the final episode of a series ends, `UpNextOverlay` does not appear; a "Series Complete" message is shown instead.
11. **Signed URL silent refresh:** When the signed URL approaches expiry (60s before), a new URL is fetched; playback continues without interruption; no user-visible error.
12. **Geo-block overlay:** If the episode is geo-restricted for the user's region, `GeoBlockOverlay` renders with message "This episode is not available in your region." and a "Back to Anime" button.
13. **Premium paywall:** If the episode is premium and the user is free-tier, `PaywallOverlay` renders with upgrade CTA; the player does not load.
14. **Error overlay with retry:** On network failure or SDK error, `ErrorOverlay` renders with "Video could not be loaded." message and a "Retry" button; clicking retry re-fetches the signed URL and reinitializes the player.
15. **Loading skeleton:** While the signed URL is fetching, a `PlayerSkeleton` with 16:9 aspect ratio and play icon renders; no layout shift when the player loads (CLS = 0).
16. **Keyboard shortcuts:** Space/k toggles play/pause; Left/Right seeks ±10s; Up/Down adjusts volume ±10%; m toggles mute; f toggles fullscreen; n triggers next episode; p triggers previous episode; j/l decreases/increases speed; 0-9 seeks to percentage.
17. **Keyboard shortcuts respect input focus:** When focus is in an input or textarea, keyboard shortcuts are disabled (browser default behavior preserved).
18. **Keyboard shortcut OSD:** Pressing a valid shortcut shows a brief on-screen display (OSD) with the action name (e.g., "Play", "Seek +10s", "Mute").
19. **Subtitle tracks:** If the episode has subtitle tracks, `SubtitleSelector` lists available languages; selecting a track enables subtitles; default is off.
20. **Episode sidebar:** `EpisodeSidebar` lists all episodes for the anime, grouped by season; clicking an episode navigates to that episode; current episode is visually highlighted.
21. **Responsive layout:** Desktop (≥1024px): player 2/3 width + sidebar 1/3 sticky. Tablet (768–1023px): player full-width + sidebar below. Mobile (<768px): player full-width, no sidebar (episode switch via prev/next buttons only).
22. **Accessibility — ARIA:** All player controls have `aria-label`; seek bar has `role="slider"` with `aria-valuenow/min/max`; volume has `role="slider"`; fullscreen button has `aria-pressed`.
23. **Accessibility — Focus trap:** In fullscreen mode, Tab cycles within the player controls; Escape exits fullscreen.
24. **Accessibility — Keyboard-only:** All player functions (play, pause, seek, quality, speed, fullscreen, episode switch) are achievable via keyboard alone.
25. **SEO:** Player page returns `robots: noindex, nofollow`; canonical URL points to the parent anime detail page.
26. **Error boundary:** If the player island throws during rendering, the route's `error.tsx` boundary catches it and renders `ErrorOverlay` with retry, preserving the page URL.
27. **404 for missing episode:** Navigating to a non-existent episode number returns a 404 page (not a player error).
28. **TypeScript strict compliance:** `pnpm typecheck` passes; no `any` types in `apps/web/src/components/player/`, `apps/web/src/hooks/`, or `apps/web/src/actions/`.
29. **Build passes:** `pnpm build` succeeds; no new lint or type errors.
30. **Rate limit on progress:** Exceeding 30 progress writes per 60 seconds returns 429 with `Retry-After` header; the client backs off and retries.

---

## 8. QA Checklist

### Functional

- [ ] Player page renders at `/watch/{animeSlug}/{episodeNumber}` with skeleton → player transition
- [ ] Signed URL is fetched server-side; player starts within 2s on 4G
- [ ] Play/pause toggles correctly via button click and Space/k key
- [ ] Seek bar is draggable; position updates in real-time; time display is accurate
- [ ] Volume slider adjusts volume; mute toggle works; mute state persists across episodes
- [ ] Quality selector changes video quality; "auto" selection works
- [ ] Speed selector changes playback speed; speed persists across episodes in session
- [ ] Fullscreen toggle works; focus trap activates in fullscreen
- [ ] Theater mode expands player width; layout adjusts correctly
- [ ] Progress heartbeat fires every 10s; `position_seconds` increments
- [ ] Progress save fires on seek; position matches seek target
- [ ] Progress flush fires on `visibilitychange` (tab hide) via `sendBeacon`
- [ ] Resume: returning to a watched episode seeks to saved position
- [ ] Auto-next: overlay appears at episode end; countdown reaches zero; navigates to next episode
- [ ] Last episode: "Series Complete" shown instead of auto-next
- [ ] Signed URL refresh: new URL fetched 60s before expiry; no playback interruption
- [ ] Geo-block overlay renders for restricted regions; "Back to Anime" button works
- [ ] Paywall overlay renders for premium episodes accessed by free users
- [ ] Error overlay with retry recovers from transient failures
- [ ] Loading skeleton renders with correct 16:9 dimensions; no CLS
- [ ] Subtitle selector lists available tracks; selection enables subtitles
- [ ] Episode sidebar lists all episodes; current episode highlighted; click navigates
- [ ] Keyboard shortcuts all work as specified
- [ ] Keyboard shortcuts disabled when focus is in input/textarea
- [ ] OSD feedback appears on shortcut activation
- [ ] 404 page renders for non-existent episode
- [ ] Error boundary catches player island crash; renders ErrorOverlay

### Performance

- [ ] Video start time < 2s on 4G throttling (p95)
- [ ] Signed URL fetch < 200ms (p95)
- [ ] Progress POST < 100ms (p95)
- [ ] SDK dynamic import does not block initial page render
- [ ] No layout shift between skeleton and loaded player (CLS = 0)
- [ ] Preconnect to Cloudflare Stream CDN present in `<head>`
- [ ] Memory leak test: navigate to player, watch 60s, navigate away; verify no lingering event listeners or timers

### Accessibility

- [ ] All controls have `aria-label`
- [ ] Seek bar has `role="slider"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- [ ] Volume slider has `role="slider"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- [ ] Fullscreen button has `aria-pressed`
- [ ] Focus trap in fullscreen mode
- [ ] Escape exits fullscreen and returns focus
- [ ] All player functions achievable via keyboard alone
- [ ] `prefers-reduced-motion` disables OSD animations
- [ ] Color contrast meets WCAG 2.2 AA on all controls

### Cross-browser

- [ ] Chrome 125+ (latest)
- [ ] Firefox 126+ (latest)
- [ ] Safari 17+ (latest) — verify HLS playback via Cloudflare Stream
- [ ] Edge 125+ (latest)
- [ ] Mobile Safari (iOS 17)
- [ ] Chrome for Android (latest)

### Security

- [ ] Signed URLs are short-lived (5 min) and cannot be replayed after expiry
- [ ] Geo-restriction is enforced on the signed URL
- [ ] No unsigned `video_asset_id` is exposed in client responses
- [ ] Progress endpoint requires authentication; userId from session, not body
- [ ] Rate limiting active on progress writes (30/60s)
- [ ] Playback error reporting is rate-limited

---

## 9. Estimated Tasks

| # | Task | Estimate | Dependencies | Notes |
| :-- | :-- | :-- | :-- | :-- |
| T1 | Scaffold `apps/web/src/components/player/` directory structure and barrel exports | 0.5d | M1 | |
| T2 | Implement `player-constants.ts` (key mappings, speed/quality options, heartbeat interval) | 0.25d | — | |
| T3 | Implement `keyboard-shortcuts.ts` (key-to-action map, seek distances, labels) | 0.5d | T2 | |
| T4 | Implement `player-utils.ts` (format time, calculate progress, etc.) | 0.25d | — | |
| T5 | Implement `PlayerSkeleton` (16:9, play icon, shimmer) | 0.5d | M1 `Skeleton` | |
| T6 | Implement `PlayerContainer` (Server Component — fetch signed URL + episode metadata) | 1.5d | M2 episode API, T5 | |
| T7 | Implement `useSignedUrl` hook (fetch + auto-refresh 60s before expiry) | 1d | T6 | |
| T8 | Implement `useProgressHeartbeat` hook (10s interval, sendBeacon on hide) | 1d | M3 auth | |
| T9 | Implement `useKeyboardShortcuts` hook (key map, preventDefault, OSD events) | 1d | T2, T3 | |
| T10 | Implement `usePlaybackSpeed` hook (sessionStorage persistence) | 0.5d | — | |
| T11 | Implement `PlayerIsland` (client island — Cloudflare Stream SDK + state management) | 3d | T7, T8, T9, T10 | Most complex task; SDK integration |
| T12 | Implement `PlayerControls` (play/pause, seek, volume, fullscreen, theater) | 2d | T11 | |
| T13 | Implement `QualitySelector` | 0.5d | T11, T12 | |
| T14 | Implement `PlaybackSpeedSelector` | 0.5d | T10, T12 | |
| T15 | Implement `SubtitleSelector` | 0.5d | T11 | Cloudflare Stream subtitle API |
| T16 | Implement `UpNextOverlay` (countdown, auto-navigate) | 1d | T11 | |
| T17 | Implement `PlayerTopBar` (back link, title, episode number) | 0.5d | — | |
| T18 | Implement `EpisodeSidebar` (season selector, episode list) | 1.5d | M2 episodes API | |
| T19 | Implement `EpisodeDescription` (synopsis, metadata, tags) | 0.5d | — | |
| T20 | Implement `GeoBlockOverlay` | 0.25d | — | |
| T21 | Implement `PaywallOverlay` | 0.25d | M3 premium gating | |
| T22 | Implement `ErrorOverlay` with retry | 0.5d | — | |
| T23 | Implement `ErrorBoundary` (`error.tsx`) | 0.5d | T22 | |
| T24 | Implement `not-found.tsx` for missing episodes | 0.25d | — | |
| T25 | Implement `loading.tsx` (skeleton) | 0.25d | T5 | |
| T26 | Implement signed URL API route (`/api/v1/episodes/[id]/stream`) | 1.5d | Cloudflare Stream API, M3 auth | |
| T27 | Implement progress upsert API route (`POST /api/v1/watch/progress`) | 1d | M3 auth, continue_watching table | |
| T28 | Implement progress read API route (`GET /api/v1/watch/progress/[episodeId]`) | 0.5d | M3 auth | |
| T29 | Implement `saveProgress` Server Action | 0.5d | T27, M3 auth | |
| T30 | Implement `markEpisodeComplete` Server Action | 0.5d | T27, T28 | |
| T31 | Implement `reportPlaybackError` Server Action | 0.5d | — | Rate-limited, anonymous OK |
| T32 | Implement `playerService` (signed URL fetch wrapper) | 0.5d | T26 | |
| T33 | Implement `progressService` (heartbeat + save wrappers) | 0.5d | T27, T28 | |
| T34 | Implement page layout + responsive CSS (desktop/tablet/mobile) | 1.5d | T6, T11, T18 | |
| T35 | Implement SEO metadata + canonical | 0.5d | — | |
| T36 | Accessibility audit + fixes (ARIA, focus trap, keyboard) | 1.5d | T11, T12 | |
| T37 | Performance audit + fixes (SDK load, CLS, heartbeat) | 1d | T11 | |
| T38 | Integration tests (signed URL flow, progress save, auto-next) | 2d | T11, T26, T27 | |
| T39 | E2E tests (full playback flow, keyboard shortcuts, error recovery) | 1.5d | T11 | Playwright |
| **Total** | | **~30.25d** | | ~5-6 weeks with 1 engineer |

---

## 10. Completion Checklist

- [ ] All 30 acceptance criteria pass
- [ ] All QA checklist items verified
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm build` succeeds
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (unit + integration)
- [ ] E2E tests pass in CI
- [ ] Performance budget met (video start < 2s, signed URL < 200ms, progress POST < 100ms)
- [ ] Accessibility audit passed (axe-core or Lighthouse)
- [ ] Responsive verified at 380/768/1024/1440
- [ ] Cross-browser verified (Chrome, Firefox, Safari, Edge, Mobile Safari, Chrome Android)
- [ ] Signed URL refresh tested (no interruption at 4:00 mark)
- [ ] Progress flush on tab hide verified via network tab
- [ ] Geo-block and paywall overlays tested
- [ ] Keyboard shortcuts all functional and respect input focus
- [ ] Error boundary catches and recovers from player crashes
- [ ] Rate limiting verified on progress endpoint
- [ ] No secrets, API keys, or tokens in code
- [ ] No `any` types or `ts-ignore` comments introduced
- [ ] Monitoring: playback errors and progress write failures instrumented with logging
- [ ] Cloudflare Stream signed URL monitoring dashboard active
- [ ] PR reviewed and approved by at least one engineer
- [ ] Branch merged to `main` and CI green post-merge
