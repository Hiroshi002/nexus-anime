# Episode Player — Nexus Anime

> **Audience:** Developers implementing or extending the video playback experience.

## 1. Purpose
Video player page — the most interactive page on the platform.

## 2. User Goals
- Watch the selected episode with reliable, low-latency playback.
- Control playback (seek, volume, quality, speed, fullscreen, PiP).
- Track progress automatically and resume on return.
- Advance to the next episode with minimal friction.
- Browse other episodes or related titles without leaving the player.

## 3. Entry Points
- Episode list row on the parent Anime Detail page.
- "Continue Watching" progress card on Home.
- "Up Next" overlay at the end of an episode.
- Deep link shared externally (episode slug in URL).

## 4. Layout Structure
```
┌──────────────────────────────────────────────────────────┐
│  ←  Anime Title  ·  S01E03  │  Next in 5s ▶ S01E04    │  ← Top Bar
├──────────────────────────────┬───────────────────────────┤
│                              │  ┌─────────────────────┐  │
│                              │  │  Season  ▾  1       │  │
│        Player Island         │  ├─────────────────────┤  │
│        (2/3 width)           │  │  ▶ S01E01  23:40   │  │
│                              │  │    S01E02  23:40   │  │
│                              │  │  ● S01E03  23:40   │  │  ← Sidebar
│                              │  │    S01E04  23:40   │  │    (1/3)
│                              │  │    S01E05  23:40   │  │
│                              │  │         ···          │  │
│                              │  └─────────────────────┘  │
├──────────────────────────────┴───────────────────────────┤
│  Synopsis  ·  Episode Title  ·  Related Anime Cards     │  ← Below
└──────────────────────────────────────────────────────────┘
```

## 5. Component Hierarchy
- `EpisodePlayerPage` (Server Component, route handler)
  - `PlayerTopBar` — back button, anime title, episode number, "Up next" countdown
  - `PlayerContainer` (Server Component) — fetches signed URL, renders `PlayerIsland`
    - `PlayerIsland` (Client Component) — Cloudflare Stream + custom controls
  - `EpisodeSidebar` — season selector + scrollable episode list
  - `EpisodeDescription` — synopsis, metadata, tags
  - `RelatedAnime` — horizontal `AnimeCard` row

## 6. Desktop Layout
Breakpoint ≥ 1024px. Player island occupies 2/3 width on the left; `EpisodeSidebar` occupies 1/3 width on the right, sticky while scrolling. Below the player, `EpisodeDescription` and `RelatedAnime` span full width with 32px section gap. Card padding 16px. Top bar spans full width above both columns.

## 7. Tablet Layout
Breakpoint 768–1023px. Player island renders full width. `EpisodeSidebar` collapses into a below-player section (full width, max-height 320px, internal scroll). `RelatedAnime` becomes a horizontally scrollable row with 16px gap.

## 8. Mobile Layout
Breakpoint < 768px. Player island full width at top. `EpisodeSidebar` renders below the player as a vertical list. `EpisodeDescription` and `RelatedAnime` stack vertically. No bottom tab bar on this route — the top bar provides navigation and the player is the primary surface.

## 9. Navigation Behavior
- **Back button** in top bar returns to the parent Anime Detail page.
- **Anime title** in top bar links to the parent Anime Detail page.
- **Episode number** (e.g. S01E03) is static text in the top bar.
- **"Up next"** countdown in top bar links to the next episode; clicking jumps immediately.
- **Sidebar episode rows** navigate to the clicked episode (client-side router push).

## 10. Scroll Behavior
On desktop ≥ 1024px, `EpisodeSidebar` is sticky (`position: sticky; top: 64px`) and scrolls internally; the main page scrolls for `EpisodeDescription` and `RelatedAnime`. On tablet and mobile, the page scrolls naturally and the sidebar scrolls internally up to its max-height.

## 11. Motion & Animation
- Player controls fade in on play, fade out after 3s of inactivity; duration 200ms, ease `cubic-bezier(0.22, 1, 0.36, 1)`.
- "Next episode" countdown overlay scales from 0.95 → 1.0 on mount; duration 300ms, spring easing.
- Sidebar active episode row background transitions 150ms.
- All interactive surfaces use the 8px grid for spacing and the design-system spring easing `cubic-bezier(0.22, 1, 0.36, 1)` for motion.

## 12. Loading Experience
`PlayerContainer` (Server Component) fetches the signed Cloudflare Stream URL. While loading, render a skeleton matching the 16:9 player aspect ratio with a centered play icon on `surface-raised`. Once the URL resolves, hydrate `PlayerIsland` (Client Component). Signed URL TTL is 5 minutes; re-fetch on expiry via a silent server action.

## 13. Empty States
When the video is unavailable (geo-blocked, removed, or signed-URL fetch failed), render a centered overlay on `surface-overlay` with `text-primary`: "This episode is not available in your region." Include a `primary` button labeled "Back to Anime" linking to the parent detail page.

## 14. Error Handling
On playback error, display a full-player overlay with `accent-error` border, `text-primary` message "Video could not be loaded.", a `primary` button labeled "Retry", and an `outline` text link labeled "Report a problem". Report link opens a prefilled GitHub issue or support form. Log the error server-side with the episode ID and signed-URL expiry.

## 15. SEO Metadata Requirements
Player pages use `robots: noindex, nofollow` via the `metadata` export. The `canonical` URL points to the parent Anime Detail page. Open Graph title follows the pattern "{Episode Title} — {Anime Title} | Nexus Anime". No structured data is emitted for episode-player routes.

## 16. Accessibility Requirements
WCAG 2.2 AA for the dark theme. All controls are keyboard-accessible with visible focus rings using `action-primary-bg`. Focus trap is active when the player is fullscreen. Every control has an ARIA label (e.g. "Play", "Seek forward 10 seconds", "Volume 80%"). Keyboard shortcuts:

| Key | Action |
|-----|--------|
| Space / k | Play / Pause |
| ← | Seek back 10s |
| → | Seek forward 10s |
| ↑ | Volume up 10% |
| ↓ | Volume down 10% |
| m | Mute toggle |
| f | Fullscreen toggle |
| n | Next episode |
| p | Previous episode |
| j | Decrease playback speed |
| l | Increase playback speed |
| 0–9 | Seek to 0%–90% |

## 17. Future Enhancements
- Skip intro / outro markers rendered as chapter segments on the seek bar.
- Watch-party mode with synchronized playback and chat.
- Subtitle style customization (font, size, background opacity).
- Picture-in-Picture persistence when navigating back to the detail page.
- Auto-quality based on measured bandwidth (ABR ladder in Cloudflare Stream).
