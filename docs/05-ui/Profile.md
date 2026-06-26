# Profile — Nexus Anime

> **Audience:** Authenticated users viewing their own profile. Public-ish within the platform (only visible to the user themselves in v1).

---

## 1. Purpose
Surface an authenticated user's profile with stats, recent activity, and quick access to their watchlist, history, and settings.

## 2. User Goals
- See their profile summary (avatar, display name, username, join date, plan)
- View personal stats at a glance (anime watched, episodes, hours, watchlist)
- Edit display name and bio inline
- Upload or change their avatar via crop flow
- Jump quickly to their full watchlist, history, and settings

## 3. Entry Points
- Profile dropdown in the top navigation → "My Profile"
- Bottom tab bar "Profile" tab (mobile, authenticated state)
- Sidebar "Profile" link (desktop, authenticated state)
- Direct navigation to `/profile`

## 4. Layout Structure
```
┌──────────────────────────────────────────────────────────────┐
│  Profile                                                     │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐  │
│  │  [96px avatar]   Display Name          [Edit]          │  │
│  │                  @username                              │  │
│  │                  Joined · Month YYYY        [Plan]      │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌──────────┐ ┬──────────┬ ┌──────────┐ ┌──────────┐       │
│  │ Anime    │ │ Episodes │ │ Hours    │ │ Watchlist│       │
│  │ 142      │ │ 2,384    │ │ 312.5    │ │ 18       │       │
│  └──────────┴ └──────────┘ └──────────┴ └──────────┘       │
│  About                                                       │
│  ┌────────────────────────────────────────────────────────┘  │
│  │  Bio text (max 280 chars)                  [Edit bio]  │  │
│  └────────────────────────────────────────────────────────┘  │
│  Recent Activity                                             │
│  ┌────────────────────────────────────────────────────────┘  │
│  │  Started watching "Title A"               2 hours ago  │  │
│  │  Completed "Title B"                     5 hours ago  │  │
│  │  Added "Title C" to watchlist            1 day ago    │  │
│  │  Started watching "Title D"               2 days ago   │  │
│  │  Completed "Title E"                     3 days ago   │  │
│  └────────────────────────────────────────────────────────┘  │
│  Quick Links                                                 │
│  ┌────────────────────────────────────────────────────────┘  │
│  │  View full watchlist →                                  │  │
│  │  View history →                                         │  │
│  │  Manage settings →                                      │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## 5. Component Hierarchy
- `ProfilePage`
  - `ProfileHeader`
    - `AvatarUpload` (96px, click-to-upload)
    - Display name (Space Grotesk, 22px, `text-primary`)
    - Username (Inter, 14px, `text-secondary`)
    - Join date (Inter, 14px, `text-secondary`)
    - `PlanBadge` (free = grey, premium = Nova gradient)
    - `Button` variant `outline` size `sm` — "Edit"
  - `StatsRow`
    - `StatBadge` × 4 (anime watched, episodes watched, hours watched, watchlist count)
  - `AboutSection`
    - Section heading "About" (Space Grotesk, 18px)
    - Bio text (Inter, 14px, `text-primary`)
    - `Button` variant `ghost` size `sm` — "Edit bio"
  - `ActivitySection`
    - Section heading "Recent Activity" (Space Grotesk, 18px)
    - `ActivityList` — last 5 actions
      - `ActivityEntry` (icon + text + timestamp)
  - `QuickLinksSection`
    - `LinkRow` → /watchlist
    - `LinkRow` → /history
    - `LinkRow` → /settings
  - `ProfileEditModal` (or inline form)
    - `Input` — Display name (max 32 chars)
    - `Textarea` — Bio (max 280 chars)
    - `Button` variant `secondary` — "Cancel"
    - `Button` variant `primary` — "Save"
  - `AvatarUpload` flow
    - File picker (accept image/jpeg, image/png, image/webp; max 5MB)
    - Preview + crop UI
    - `Button` variant `secondary` — "Cancel"
    - `Button` variant `primary` — "Save"

## 6. Desktop Layout (≥1024px)
Max-width container 960px, centered. Header row: 96px avatar on the left, display name + username + join date + plan badge in the middle, "Edit" button right-aligned. Stats row below header in a 4-column grid (equal width, 16px gap). About, Activity, and Quick Links sections stack vertically with 32px section gap. Cards use `surface-raised` background, 16px padding, 12px border radius, 1px `surface-overlay` border. Quick links are full-width rows with chevron-right icon, hover state `surface-overlay`.

## 7. Tablet Layout (768–1023px)
Same layout as desktop but max-width 100%, 24px horizontal padding. Stats row remains 4-column. Section gap reduces to 24px. Header retains single-row layout (avatar + meta + Edit button).

## 8. Mobile Layout (<768px)
Max-width 100%, 16px horizontal padding. Header stacks: 96px avatar centered, display name + username + join date + plan badge below, Edit button right-aligned. Stats row becomes a 2×2 grid (16px gap). Section gap 24px. Quick links full-width, larger touch target (min 48px height). Bottom tab bar active on "Profile" tab with `action-primary-bg` indicator (2px height).

## 9. Navigation Behavior
Header uses dark glassmorphism (`surface-raised`, `backdrop-blur`). Profile link in sidebar highlights with `action-accent-bg` left border (3px). Bottom tab bar "Profile" tab uses `action-primary-bg` indicator (2px height) + `text-primary` label. Quick links navigate to `/watchlist`, `/history`, `/settings` via Next.js `Link`.

## 10. Scroll Behavior
Page scrolls vertically as a single column. No sticky sections. Scroll position preserved on back-navigation. Activity list is capped at 5 items; no pagination (full history lives at /history).

## 11. Motion & Animation
- Entry: header fades in (opacity 0 to 1, 200ms), stats row stagger-fade (50ms delay per item, 200ms each)
- Hover: quick link rows slide-right 4px (translateX 4px), 150ms, `cubic-bezier(0.22, 1, 0.36, 1)`
- Edit modal: backdrop fade 150ms, modal scale 0.95 to 1, 200ms
- Avatar upload: file picker opens native dialog; crop UI fades in 150ms
- Save action: button shows loading spinner (16px, `action-primary-bg`) for up to 2s
- Duration scale 50–1000ms, spring easing `cubic-bezier(0.22, 1, 0.36, 1)`

## 12. Loading Experience
Skeleton state: 96px avatar circle shimmer, 3 title-line shimmers (display name, username, date), 4 stat badge shimmers, 3 section card shimmers. Shimmer uses `surface-raised` to `surface-overlay` gradient animation, 1.5s loop. Streaming: header renders first, then stats, then sections as data arrives.

## 13. Empty States
- Empty bio: "Add a bio to tell the world about your anime taste." (`text-secondary`, Inter 14px) with "Edit bio" ghost button
- Empty activity: "No recent activity. Start watching to see it here." (`text-secondary`, Inter 14px)
- Empty stats: show "0" in each `StatBadge` (no special empty state needed)

## 14. Error Handling
- Profile load failure: full-page error state with `accent-error` icon, message "Couldn't load your profile", and `Button` variant `primary` — "Retry"
- Save failure (inline edit): toast notification (`accent-error`) "Couldn't save changes. Try again." Form retains input values.
- Avatar upload failure: toast notification (`accent-error`) "Couldn't upload avatar. Try again." File picker remains available.
- Avatar file too large: inline validation error "Image must be under 5MB" (`accent-error`, Inter 12px) below file picker
- Unsupported file type: inline validation error "Please use JPEG, PNG, or WebP"

## 15. SEO Metadata Requirements
- Title: `{Display Name}'s Profile — Nexus Anime`
- Description: personal profile page (auto-generated, max 155 chars)
- OG: `og:title` = `{Display Name}'s Profile — Nexus Anime`, `og:type` = `profile`, `og:username` = `@username`
- Canonical: `https://nexus-anime.com/profile`
- Robots: `noindex, nofollow` (authenticated, personal data)
- JSON-LD: none (personal page, no structured data benefit)

## 16. Accessibility Requirements
- WCAG 2.2 AA for dark theme
- Avatar upload: `aria-label="Upload avatar"` on the clickable avatar area; file picker announces accepted formats
- Edit form: every input has an associated `<label>`; display name label "Display name", bio label "Bio"; character count announced via `aria-live="polite"`
- Stats row: each `StatBadge` has `aria-label` (e.g., "142 anime watched")
- Activity entries: `aria-label` describes action (e.g., "Started watching Attack on Titan, 2 hours ago")
- Quick links: `aria-label` on each `LinkRow` (e.g., "View full watchlist")
- Focus management: edit modal traps focus, returns trigger focus on close; avatar upload flow traps focus during crop step
- Color contrast: `text-secondary` on `surface-base` ≥ 4.5:1; plan badge text ≥ 4.5:1 on its background
- Touch targets: quick links min 48px height on mobile; Edit button min 44px

## 17. Future Enhancements
- Public profiles with shareable URLs (`/user/{username}`)
- Activity pagination or "View all activity" link to /history
- Achievement badges (e.g., "100 episodes", "First completed anime")
- Theme preference toggle (dark / darker / OLED)
- Social features: follow users, see friend activity
