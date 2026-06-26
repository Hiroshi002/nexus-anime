# Watch History — Nexus Anime

> **Audience:** Authenticated users viewing their complete watch history. Unauthenticated users see a login prompt.

## 1. Purpose
Display the user's complete watch history with date grouping, filtering, and resume/replay controls. Authenticated only.

## 2. User Goals
- See everything they have watched, grouped by date
- Resume an in-progress anime or replay a completed one
- Filter history by date range and anime type (TV / Movie / OVA)
- Sort by most recent or oldest
- Clear the entire history in one action

## 3. Entry Points
- Bottom tab bar "History" tab (mobile)
- Sidebar "Watch History" link (desktop)
- Profile dropdown → "Watch History"
- Direct navigation to `/history`

## 4. Layout Structure
```
┌──────────────────────────────────────────────────────────┐
│  Watch History                              [Clear all]  │
│  ┌──────────┐                                              │
│  │ 42 items │  ┌────────────┐  ┌────────────┐            │
│  └──────────┘  │ Date range ▼│  │ Type: All ▼ │  Sort ▼   │
├──────────────────────────────────────────────────────────┤
│  Today                                                     │
│  ┌────────────────────────────────────────────────────┐   │
│  │ [thumb]  Title Name                                │   │
│  │          Ep 8 · ████████░░ 75%    Resume  12:04 PM │   │
│  └────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────┐   │
│  │ [thumb]  Another Title                             │   │
│  │          Movie · ██████████ 100%   Replay  9:30 AM │   │
│  └────────────────────────────────────────────────────┘   │
│  Yesterday                                                 │
│  ┌────────────────────────────────────────────────────┐   │
│  │ ...                                                │   │
│  └────────────────────────────────────────────────────┘   │
│  This week                                                 │
│  ┌────────────────────────────────────────────────────┐   │
│  │ ...                                                │   │
│  └────────────────────────────────────────────────────┘   │
│  Older                                                     │
│  ┌────────────────────────────────────────────────────┐   │
│  │ ...                                                │   │
│  └────────────────────────────────────────────────────┘   │
│                    [Load more]                             │
└──────────────────────────────────────────────────────────┘
```

## 5. Component Hierarchy
- `WatchHistoryPage`
  - `Header`
    - Title "Watch History" (Space Grotesk, 22px)
    - Count badge (`surface-overlay`, `text-secondary`)
    - `Button` variant `ghost` — "Clear all"
  - `FilterBar`
    - Date range select (last 7 / 30 / 90 days / all)
    - Type select (All / TV / Movie / OVA)
    - Sort select (most recent / oldest)
  - `HistoryList`
    - `DateGroup` (repeated)
      - `<h2>` heading ("Today" / "Yesterday" / "This week" / "Older")
      - `HistoryEntry` (repeated)
        - Anime thumbnail (poster, 64×90px)
        - Title (`text-primary`, Inter 16px)
        - Episode number + progress bar
        - `Button` variant `primary` size `sm` — "Resume" or "Replay"
        - Watched timestamp (`text-secondary`, 14px)
  - `ClearHistoryModal`
    - "Clear watch history? This cannot be undone."
    - `Button` variant `secondary` — "Cancel"
    - `Button` variant `primary` — "Clear"

## 6. Desktop Layout
Desktop ≥1024px. Header row on one line: title + count badge left-aligned, filter controls right-aligned. Date-grouped list below with 32px section gap. List items use 16px padding on `surface-raised` cards. Max-width container 960px, centered.

## 7. Tablet Layout
768–1023px. Same layout as desktop but filter bar wraps to two rows if needed. Slightly compact spacing (24px section gap). List items retain full structure.

## 8. Mobile Layout
<768px. Compact list items: thumbnail 48×68px, title single-line truncated, progress bar inline. Controls stacked: full-width filter selects below header. Bottom tab bar active on "History" tab. 16px horizontal padding, 24px section gap.

## 9. Navigation Behavior
Header uses dark glassmorphism (`surface-raised`, `backdrop-blur`). Active state in bottom tab bar uses `action-primary-bg` indicator (2px height) + `text-primary` label. Sidebar link highlights with `action-accent-bg` left border (3px).

## 10. Scroll Behavior
Infinite scroll loads next page on scroll-to-bottom. "Load more" fallback button (`Button` variant `outline` size `md`) when infinite scroll fails or is disabled. Scroll position preserved on back-navigation.

## 11. Motion & Animation
- Entry: list items fade + slide-up (translateY 8px → 0) on mount, 200ms
- Hover: list item card lifts with `surface-overlay` background, 150ms
- Clear modal: backdrop fade 150ms, modal scale 0.95 → 1, 200ms
- Duration scale 50–1000ms, spring easing `cubic-bezier(0.22, 1, 0.36, 1)`

## 12. Loading Experience
Skeleton list items: 6 placeholder rows with animated shimmer on `surface-raised` blocks (thumbnail rect, title line, progress bar). Streaming: date groups render as they arrive, not all at once.

## 13. Empty States
Centered illustration (dark, cinematic style) + heading "You haven't watched anything yet" (`text-primary`, Space Grotesk 22px) + body text (`text-secondary`, Inter 14px) + `Button` variant `primary` size `md` — "Browse trending". Background `surface-base`.

## 14. Error Handling
- Partial failure: show loaded entries, inline warning banner (`accent-warning`) with "Some history couldn't load" + retry button
- Full failure: error state with `accent-error` icon, message, and `Button` variant `primary` — "Retry"
- Clear-all failure: toast notification (`accent-error`) "Couldn't clear history. Try again."

## 15. SEO Metadata Requirements
Noindex. Personal data, authenticated-only page. `<meta name="robots" content="noindex, nofollow">`. No structured data. Title template: "Watch History — Nexus Anime".

## 16. Accessibility Requirements
WCAG 2.2 AA for dark theme. Date groups use `<h2>` headings for screen reader navigation. List items have descriptive aria-labels (e.g., "Attack on Titan, episode 8, 75% watched, 12:04 PM"). Focus management: modal traps focus, returns trigger focus on close. Color contrast ≥4.5:1 for `text-secondary` on `surface-base`.

## 17. Future Enhancements
- Per-entry delete (swipe on mobile, X button on desktop)
- Search within watch history
- Export history as CSV
- Continue-watching carousel synced with history
- Watch streak / stats dashboard
