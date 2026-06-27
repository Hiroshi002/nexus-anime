# Continue Watching — Nexus Anime

> **Audience:** Authenticated users resuming in-progress episodes. Unauthenticated users are redirected to login.

## 1. Purpose

Show only episodes with partial progress (greater than 5% and less than 95%) so users can quickly resume or restart what they left off.

## 2. User Goals

- Resume an episode at the exact timestamp where they left off
- Restart an episode from the beginning
- See at a glance how much of each episode remains
- Jump from a grouped anime card to its full episode list
- Browse trending when nothing is in progress

## 3. Entry Points

- Home page "Continue Watching" rail (primary entry)
- Sidebar "Continue Watching" link (desktop)
- Profile dropdown → "Continue Watching"
- Direct navigation to `/continue-watching`

## 4. Layout Structure

```
┌──────────────────────────────────────────────────────────┐
│  Continue Watching                        Watch History →│
├──────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐  │
│  │ [thumbnail]  Anime Title                    [v]    │  │
│  │  12:34 / 24:05  Ep 8  ██████░░░░ 62%              │  │
│  │                                    [Resume] [Restart]│ │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ [thumbnail]  Another Title                  [v]    │  │
│  │  03:12 / 24:05  Ep 3  ████░░░░░░ 13%              │  │
│  │                                    [Resume] [Restart]│ │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ [thumbnail]  Third Title                    [v]    │  │
│  │  22:50 / 24:05  Ep 12 █████████░ 94%              │  │
│  │                                    [Resume] [Restart]│ │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

## 5. Component Hierarchy

- `ContinueWatchingPage`
  - `Header`
    - Title "Continue Watching" (Space Grotesk, 22px, `text-primary`)
    - `Link` variant `ghost` — "Watch History →" (`text-secondary`)
  - `ProgressGrid`
    - `AnimeGroup` (repeated, collapsed by default)
      - `ProgressCard`
        - Thumbnail (poster, with timestamp overlay "12:34 / 24:05")
        - Anime title (`text-primary`, Inter 16px)
        - Episode number (`text-secondary`, Inter 14px)
        - Horizontal progress bar (`action-primary-bg` fill)
        - `Button` variant `primary` size `sm` — "Resume"
        - `Button` variant `secondary` size `sm` — "Restart"
      - Accordion toggle (chevron, expands to reveal additional episodes)
  - `EmptyState`
    - Illustration (dark, cinematic)
    - Body text "Nothing to resume. Browse trending." (`text-secondary`)
    - `Button` variant `primary` size `md` — "Browse trending"

## 6. Desktop Layout (≥1024px)

Two-column grid of `ProgressCard` items. Card thumbnail 240×135px (16:9). Timestamp overlay bottom-left, 12px Inter, `text-primary` on semi-transparent `surface-base`. Progress bar 4px height, full card width, `action-primary-bg` fill on `surface-overlay` track. Card padding 16px on `surface-raised`. Section gap 32px. Max-width container 1200px, centered. Header title left, "Watch History →" link right on the same baseline.

## 7. Tablet Layout (768–1023px)

Single-column stack of `ProgressCard` items. Thumbnail scales to full card width (fluid 16:9). Progress bar and buttons remain inline. Card padding 16px. Section gap 24px. Header layout unchanged. Accordion chevron remains top-right.

## 8. Mobile Layout (<768px)

Single-column stack. Thumbnail full-bleed width (fluid 16:9). Title and episode number below thumbnail. Progress bar full width. Buttons stack: "Resume" full-width primary, "Restart" full-width secondary below. Card padding 16px. Section gap 24px. 16px horizontal page padding. Bottom tab bar active indicator on "Home" (since Continue Watching is a home rail, the dedicated page is reached via sidebar/profile dropdown).

## 9. Navigation Behavior

Header uses dark glassmorphism (`surface-raised`, `backdrop-blur`). "Watch History →" link navigates to `/history`. Accordion chevron rotates 180° on expand (spring easing). "Resume" button navigates to `/watch/{animeId}?ep={n}&t={seconds}`. "Restart" button navigates to `/watch/{animeId}?ep={n}&t=0`. Clicking the anime title navigates to `/anime/{animeId}`.

## 10. Scroll Behavior

No infinite scroll — the list is bounded (only in-progress episodes). Full list renders in one payload. Scroll position preserved on back-navigation. Sticky header (glassmorphism) on scroll.

## 11. Motion & Animation

- Entry: cards fade + slide-up (translateY 8px → 0) on mount, 200ms, staggered 50ms per card
- Hover: card lifts 2px with `surface-overlay` background, 150ms
- Accordion: expand/collapse height transition, 250ms, spring easing `cubic-bezier(0.22, 1, 0.36, 1)`
- Button hover: `action-primary-bg` brightens 8%, 150ms
- Chevron rotation: 200ms spring easing

## 12. Loading Experience

Skeleton cards: 4 placeholder cards with animated shimmer on `surface-raised` blocks (thumbnail rect, title line, two button skeletons). Streaming: cards render as data arrives. Skeleton uses `surface-overlay` shimmer gradient.

## 13. Empty States

Centered illustration (dark, cinematic style, 120×120px) + body text "Nothing to resume. Browse trending." (`text-secondary`, Inter 14px) + `Button` variant `primary` size `md` — "Browse trending" (navigates to `/trending`). Background `surface-base`. Empty state shown when no episodes match the 5%–95% progress window.

## 14. Error Handling

- Partial failure: show loaded cards, inline warning banner (`accent-warning`) with "Some items couldn't load" + retry button
- Full failure: error state with `accent-error` icon, message, and `Button` variant `primary` — "Retry"
- Navigation failure: client-side toast (`accent-error`) "Couldn't load episode. Try again."

## 15. SEO Metadata Requirements

- Title: `Continue Watching — Nexus Anime`
- Description: omitted (personalized page)
- OG: omitted
- Canonical: `https://nexus-anime.com/continue-watching`
- Robots: `noindex, nofollow`
- JSON-LD: none (personalized, authenticated-only content)

## 16. Accessibility Requirements

WCAG 2.2 AA for dark theme. Progress bar uses `role="progressbar"` with `aria-valuenow` (current percent), `aria-valuemin="0"`, `aria-valuemax="100"`, and `aria-label="Episode progress: 62%". Accordion uses `aria-expanded`, `aria-controls`, and `aria-label="Toggle episodes for {animeTitle}". Card thumbnail has `alt=""` (decorative, title conveys context). Buttons have descriptive labels ("Resume episode 8 of Attack on Titan", "Restart episode 8"). Focus order: header → cards top-to-bottom → buttons left-to-right. Color contrast ≥4.5:1 for `text-secondary` on `surface-base`. Timestamp overlay contrast ≥4.5:1.

## 17. Future Enhancements

- Swipe-to-dismiss on mobile (remove from continue watching)
- Sort controls (most recent / most progress / alphabetical)
- "Mark as completed" action per episode
- Synced continue-watching rail on home page with real-time progress
- Watch party prompt for episodes near completion
