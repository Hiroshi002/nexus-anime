# Episode Player — Nexus Anime

> **Audience:** Engineers, Product, Design
> **Milestone:** M4
> **Owner:** Engineering
> **Status:** Draft

---

## 1. Purpose

The Episode Player is the core viewing experience — the most interactive and latency-sensitive page on the platform. It delivers Cloudflare Stream video playback with signed URLs, subtitle tracks, quality selection, playback speed, auto-next-episode, resume-from-position, theater mode, and fullscreen. Every design decision prioritizes uninterrupted playback and seamless episode progression.

## 2. Business Goals

- Maximize watch-time: target average session duration > 45 minutes per visit.
- Drive episode progression: target 60% of completed episodes triggering the next episode automatically.
- Increase premium conversion: premium episodes show a CTA overlay when free users attempt playback.
- Reduce support burden: target < 1% of playback sessions resulting in error reports.

## 3. Functional Requirements

### 3.1 Happy Path
1. User navigates to `/watch/{animeSlug}/{episodeNumber}` from an anime detail page, continue-watching card, or auto-next overlay.
2. System fetches a signed Cloudflare Stream URL (5-minute expiry) and renders the video player.
3. Playback begins automatically (muted autoplay where browser policy allows) or on user click.
4. User interacts with controls: play/pause, seek, volume, quality selector, playback speed, fullscreen, theater mode.
5. System saves playback progress every 10 seconds via `/api/v1/watch/progress`.
6. Episode completes; "Up Next" overlay appears with a 5-second countdown to auto-advance to the next episode.
7. User clicks "Next" or countdown expires; player navigates to the next episode URL without full page reload.

### 3.2 Alternate Flows
1. User is a returning viewer with watch history; player seeks to the saved resume position on load.
2. User switches episodes via the episode sidebar; player loads the new episode with a new signed URL.
3. User enters fullscreen or theater mode; layout adjusts while playback continues uninterrupted.
4. User adjusts playback speed (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x); speed persists across episodes within the session.

### 3.3 Edge Cases
1. Episode not available in user's region — geo-blocked overlay rendered.
2. Video manifest expired (signed URL past 5-minute TTL) — silent refresh of signed URL.
3. Network interruption during playback — player buffers and auto-resumes; progress is saved up to the last checkpoint.
4. Last episode of a series — no "Up Next" overlay; show a "Series Complete" message instead.
5. Premium episode accessed by free user — paywall overlay with upgrade CTA.

## 4. Non-Functional Requirements

- **Performance:** Video start time < 2s; signed URL fetch p95 < 200ms; progress POST p95 < 100ms; no frame drops during quality switching.
- **Availability:** 99.95% — playback failure is the most visible degradation; graceful fallback required.
- **Scalability:** 5,000 concurrent viewers; 100 signed URL issuances per second during peak.
- **Accessibility:** WCAG 2.2 AA; all player controls keyboard-accessible with visible focus rings; ARIA labels on every control; closed captions via subtitle tracks.
- **Localization:** Subtitle tracks support multiple languages; playback speed label localized; error messages externalized.
- **Security:** Signed URLs with 5-minute expiry; geo-restriction enforcement; no unsigned video URLs exposed to the client; progress endpoint requires authentication; rate-limit progress writes.

## 5. User Stories

- As a **viewer**, I want to watch an episode with reliable, low-latency playback so that my viewing experience is uninterrupted.
- As a **viewer**, I want to resume from where I left off so that I do not have to manually seek to my previous position.
- As a **viewer**, I want the next episode to play automatically so that I can binge-watch without manual navigation.
- As a **logged-in user**, I want my progress tracked automatically so that I can resume on any device.
- As a **free user**, I want to see a clear message when an episode requires premium access so that I understand why I cannot watch it.

## 6. Acceptance Criteria

- [ ] Player page renders at `/watch/{animeSlug}/{episodeNumber}` with a Cloudflare Stream player.
- [ ] Signed URL is fetched on page load with 5-minute expiry; player starts playback within 2 seconds.
- [ ] Player controls include: play/pause, seek bar, volume, quality selector, playback speed, fullscreen, theater mode.
- [ ] Subtitle tracks render when available; user can toggle subtitle language.
- [ ] Playback progress is saved every 10 seconds via POST to `/api/v1/watch/progress`.
- [ ] Resume position: if user has watch history for this episode, player seeks to the saved position on load.
- [ ] Auto-next: when an episode ends, "Up Next" overlay appears with a 5-second countdown; auto-advance navigates to the next episode.
- [ ] Last episode: when the final episode of a series ends, a "Series Complete" message replaces the "Up Next" overlay.
- [ ] Signed URL refresh: when the signed URL expires (5 min), the system silently re-fetches a new URL without interrupting playback.
- [ ] Geo-blocked episodes render an overlay: "This episode is not available in your region."
- [ ] Premium episodes accessed by free users render a paywall overlay with upgrade CTA.
- [ ] Keyboard shortcuts work: Space/k (play/pause), arrows (seek/volume), f (fullscreen), m (mute), n (next), p (previous).

## 7. UI Components

| Component | Responsibility | Reusable? | Package |
|-----------|---------------|-----------|---------|
| `EpisodePlayerPage` | Page shell — SSR for signed URL, Suspense boundary | No | `apps/web` |
| `PlayerTopBar` | Back button, anime title, episode number, "Up Next" countdown | Yes | `apps/web` |
| `PlayerContainer` | Server Component — fetches signed URL, renders PlayerIsland | No | `apps/web` |
| `PlayerIsland` | Client Component — Cloudflare Stream embed + custom controls | No | `apps/web` |
| `PlayerControls` | Play/pause, seek, volume, quality, speed, fullscreen, theater | No | `apps/web` |
| `QualitySelector` | Video quality dropdown (auto, 1080p, 720p, 480p, 360p) | Yes | `@nexus/ui` |
| `PlaybackSpeedSelector` | Speed picker (0.5x–2x) | Yes | `@nexus/ui` |
| `SubtitleSelector` | Subtitle track language picker | Yes | `@nexus/ui` |
| `UpNextOverlay` | Next episode countdown with thumbnail and title | Yes | `@nexus/ui` |
| `EpisodeSidebar` | Season selector + scrollable episode list | Yes | `apps/web` |
| `EpisodeDescription` | Episode synopsis, metadata, tags | Yes | `@nexus/ui` |
| `GeoBlockOverlay` | Region-unavailable message | Yes | `@nexus/ui` |
| `PaywallOverlay` | Premium upgrade CTA | Yes | `@nexus/ui` |

## 8. API Dependencies

| Endpoint | Method | Auth Required | Rate Limit | Cache |
|----------|--------|---------------|------------|-------|
| `/api/v1/watch/{episodeId}` | GET | Yes | 30/min per user | No |
| `/api/v1/watch/progress` | POST | Yes | 6/min per user | No |
| `/api/v1/watch/{episodeId}/manifest` | GET | Yes | 10/min per user | No |
| `/api/v1/episodes/{id}` | GET | No | 60/min per IP | 15 min CDN |

`/api/v1/watch/{episodeId}` returns episode metadata plus a signed Cloudflare Stream URL with geo-restriction and 5-minute expiry. Requires authentication; returns 401 for anonymous users on premium content.

`/api/v1/watch/progress` accepts `{ episodeId, positionSeconds, durationSeconds }`. Persists progress; used for resume. Debounced to one write per 10 seconds on the client.

`/api/v1/watch/{episodeId}/manifest` returns the video manifest (quality levels, subtitle tracks, chapter markers) for the client player to configure before playback.

## 9. Database Dependencies

| Table / View | Operation | Index / Query Notes |
|--------------|-----------|---------------------|
| `episodes` | SELECT | Lookup by `id` or `(anime_id, number)`; index on `id` and `(anime_id, number)` |
| `anime` | SELECT (join) | Parent anime metadata for top bar; index on `slug` |
| `seasons` | SELECT (join) | Season data for sidebar; index on `anime_id` |
| `watch_history` | SELECT / UPSERT | Resume position; index on `(user_id, episode_id)` unique; upsert on progress save |
| `video_manifests` | SELECT | Video quality levels, subtitle track URLs; index on `episode_id` |
| `bookmarks` | SELECT | Watchlist presence for sidebar episode rows; index on `(user_id, anime_id)` |

## 10. Edge Cases

1. **Episode geo-blocked:** The signed URL endpoint returns a `GEO_BLOCKED` error code; the player renders a "This episode is not available in your region." overlay with a "Back to Anime" CTA.
2. **Video manifest expired (signed URL past 5-min TTL):** The Client Component detects expiry (either via player error event or proactive timer) and silently re-fetches a new signed URL via a Server Action. Playback is not interrupted — the player handles the URL swap internally.
3. **Network interruption during playback:** The Cloudflare Stream player buffers automatically. Progress is saved up to the last 10-second checkpoint. On reconnection, playback resumes from the last checkpoint. If the network is offline for > 60 seconds, display a "Connection lost. Reconnecting..." overlay.
4. **Last episode of a series:** The "Up Next" overlay is replaced with a "Series Complete" message showing a "Back to Anime" CTA and a recommendations row. No countdown timer.
5. **Concurrent session limit:** If the user is already watching on another device, the system SHALL not block the new session (last-write-wins on progress). A soft warning ("You're watching on another device. Progress may conflict.") is displayed once.
6. **Episode with `video_asset_id` null:** The player renders a "This episode is not yet available." overlay instead of the video player.
7. **Premium episode for free user:** The signed URL endpoint returns a `PREMIUM_REQUIRED` error code; player renders a paywall overlay with "Upgrade to Premium" CTA linking to the subscription page.
8. **Browser blocks autoplay:** Player renders in a paused state with a large centered play button overlay. No error displayed — this is expected browser behavior.
9. **Signed URL fetch fails (server error):** Player renders a skeleton with "Video could not be loaded." and a "Retry" button. Log the episode ID and error at `error` level.

## 11. Error Handling

| Error Condition | User-Facing Message | Recovery Action | Log Level |
|-----------------|---------------------|-----------------|-----------|
| Signed URL fetch 500 | "Video could not be loaded." | "Retry" button | error |
| Signed URL fetch 403 (geo-blocked) | "This episode is not available in your region." | "Back to Anime" CTA | warn |
| Signed URL fetch 402 (premium) | "This episode requires a premium subscription." | "Upgrade" CTA | info |
| Progress POST fails | No user-facing message (silent fail) | Retry on next 10-second interval | warn |
| Playback error (player internal) | "Something went wrong during playback." | "Retry" button + "Report a problem" link | error |
| Network offline > 60s | "Connection lost. Reconnecting..." | Auto-retry; success message "Connected!" | warn |
| Manifest fetch fails | Player renders without quality selector / subtitle tracks | Degraded playback; no user message for cosmetic features | warn |

## 12. Analytics Events

| Event Name | Trigger | Properties | Surface |
|------------|---------|------------|---------|
| `episode_play_start` | Playback begins (after buffer) | `{ anime_id, episode_id, is_resume, quality, speed }` | Client |
| `episode_play_pause` | User pauses playback | `{ anime_id, episode_id, position_seconds }` | Client |
| `episode_play_seek` | User seeks to a position | `{ anime_id, episode_id, from_seconds, to_seconds }` | Client |
| `episode_quality_change` | Quality selector value changed | `{ anime_id, episode_id, from_quality, to_quality }` | Client |
| `episode_speed_change` | Playback speed changed | `{ anime_id, episode_id, from_speed, to_speed }` | Client |
| `episode_progress_save` | Progress POST succeeds | `{ anime_id, episode_id, position_seconds, duration_seconds, percent_complete }` | Server |
| `episode_complete` | Playback reaches end of episode | `{ anime_id, episode_id, duration_seconds }` | Client |
| `episode_auto_next` | Auto-next countdown completes | `{ anime_id, from_episode_id, to_episode_id }` | Client |
| `episode_up_next_cancel` | User cancels auto-next countdown | `{ anime_id, episode_id }` | Client |
| `episode_playback_error` | Player encounters an error | `{ anime_id, episode_id, error_code, position_seconds }` | Client |
| `episode_subtitle_toggle` | Subtitle track selected or disabled | `{ anime_id, episode_id, subtitle_language }` | Client |

## 13. Security Considerations

- **Signed URLs:** Cloudflare Stream signed URLs with 5-minute expiry prevent unauthorized sharing. The signing key is server-side only; never exposed to the client.
- **Geo-restriction:** Enforced server-side during signed URL generation; the client cannot bypass geo-blocks by modifying the URL.
- **Authentication:** `/api/v1/watch/{episodeId}` and `/api/v1/watch/progress` require valid session; unsigned requests return 401.
- **Rate limiting:** Signed URL endpoint at 30 req/min per user; progress endpoint at 6 req/min per user (debounced). Prevents signed URL scraping.
- **No video URL in DOM:** The signed URL is passed directly to the Cloudflare Stream player SDK; it SHALL NOT be rendered in a visible DOM attribute or `src` tag that can be inspected.
- **Progress validation:** Server validates `positionSeconds` and `durationSeconds` are within expected ranges (0 < position <= duration + 10s tolerance for overshoot).
- **CSP:** `media-src` and `frame-src` allow only Cloudflare Stream domains; `connect-src` allows API endpoints.
- **OWASP A01 (Broken Access Control):** Users can only write progress for their own sessions; `user_id` is taken from the session, not the request body.
- **OWASP A07 (Identification and Authentication Failures):** Session tokens validated on every playback and progress endpoint.
- **Concurrent playback abuse:** Monitor for unusual patterns (e.g., single user watching 10+ episodes simultaneously); flag for review.

## 14. Performance Requirements

- **Video start time** < 2s from page load to first frame (signed URL fetch + player initialization).
- **Signed URL fetch p95** < 200ms; DB query for episode and video manifest p95 < 50ms.
- **Progress POST p95** < 100ms; fire-and-forget on the client (do not block playback).
- **LCP** < 2.5s (player island is the LCP element).
- **FID** < 50ms for player controls (keyboard shortcuts and button clicks).
- **Rendering strategy:** SSR for the page shell (signed URL fetch happens server-side); Client Component for the player island. `<Suspense>` boundary wraps the player; skeleton renders while signed URL resolves.
- **Bundle-size budget:** < 60 KB client JS for the player route (includes Cloudflare Stream SDK, custom controls, sidebar, analytics). The Stream SDK is loaded via `next/dynamic` to keep the initial bundle small.
- **No frame drops during quality switches:** Cloudflare Stream handles adaptive bitrate; client SHALL NOT force re-initialization on quality change.

## 15. Future Improvements

1. Skip intro / outro markers rendered as chapter segments on the seek bar with a "Skip Intro" button.
2. Watch-party mode with synchronized playback and real-time chat.
3. Subtitle style customization (font family, size, background opacity, color).
4. Picture-in-Picture persistence when navigating back to the anime detail page.
5. Auto-quality ABR ladder based on measured bandwidth (Cloudflare Stream built-in).
6. Double-tap to seek (10s forward/back) on mobile, similar to YouTube's gesture.
7. Episode download for offline viewing (premium feature, DRM-protected).
8. Multi-angle Playback for select content (dual-audio, commentary tracks).
9. Playback analytics dashboard for content team (drop-off points, rewatch segments).
