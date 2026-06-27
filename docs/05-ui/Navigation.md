# Navigation — Nexus Anime

> **Audience:** Engineers implementing navigation chrome, designers building navigation specs. This document defines every navigation surface on the platform — global header, mobile nav, sidebar, breadcrumbs, and contextual navigation.

---

## 1. Navigation Architecture

The platform has **four navigation contexts**:

```
┌─────────────────────────────────────────────────────────┐
│  Global Header (public)          Sidebar (authenticated)│
│  ┌────────────────────────────┐  ┌─────────────────────┐  │
│  │ Logo | Search | Theme | Auth│  │ Logo | Avatar      │  │
│  └────────────────────────────┘  │ Home | Trending    │  │
│                                  │ Popular | Latest   │  │
│                                  │ Genres | Schedule  │  │
│                                  │ ─ ─ ─ ─ ─ ─ ─ ─ ─ │  │
│                                  │ Watchlist          │  │
│                                  │ Continue Watching  │  │
│                                  │ History            │  │
│                                  │ ─ ─ ─ ─ ─ ─ ─ ─ ─ │  │
│                                  │ Profile | Settings │  │
│                                  │ Notifications     │  │
│                                  └─────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Rule:** The right side of the header switches based on session state. The left side (logo + primary nav) is consistent across all public pages.

---

## 2. Global Header (Public)

### Desktop layout

| Left | Center                          | Right (anon)                   | Right (auth)                           |
| ---- | ------------------------------- | ------------------------------ | -------------------------------------- |
| Logo | Search field (expands on focus) | Theme toggle, Sign In, Sign Up | Theme toggle, Notifications, User menu |

### Mobile layout

| Left           | Center | Right                           |
| -------------- | ------ | ------------------------------- |
| Logo (smaller) | —      | Hamburger (opens mobile drawer) |

On mobile, the search icon expands to a full-screen search overlay when tapped. There is no inline search field.

### Header behavior

- **Sticky:** Yes, with `backdrop-blur` glass effect.
- **On scroll:** Shrinks slightly (80px → 64px height) below 100px scroll; restores on scroll up.
- **Background:** `surface-base/80` with `backdrop-blur-md` when at top; `surface-base/95` + subtle bottom border when scrolled.
- **Z-index:** 50 (above all content, below modals).

### Logo

- Returns the user to `/` on click.
- Interactive hover: subtle `scale(1.02)` transition.
- Animated mark optional (Nova glow pulse on idle).

### Primary nav links (desktop only)

| Label     | Route        | Active when                                                                 |
| --------- | ------------ | --------------------------------------------------------------------------- |
| Home      | `/`          | Path is `/` or `/home`                                                      |
| Browse    | `/trending`  | Path starts with `/trending`, `/popular`, `/latest`, `/genres`, `/schedule` |
| Watchlist | `/watchlist` | Path is `/watchlist`                                                        |

**Active state:** `text-primary` + 2px bottom border in `action-primary-bg`. Inactive: `text-secondary`. Hover: `text-primary`.

**Why dropdown-free:** Catalog sub-pages (Trending, Popular, Latest, Genres, Schedule) are exposed via a "Browse" mega-menu on desktop (a glass panel with categories). Mobile exposes them as accordion items in the drawer.

---

## 3. Browse Mega-Menu (Desktop)

Triggered on hover over "Browse" link. Panel drops down from the header.

### Layout

```
┌────────────────────────────────────────────────────────┐
│  CARGO            GENRES            SCHEDULE           │
│  ┌──────────┐     ┌────────────┐     ┌──────────────┐  │
│  │ Trending │     │ Action     │     │ Today        │  │
│  │ Popular  │     │ Adventure  │     │ Tomorrow     │  │
│  │ Latest   │     │ Fantasy    │     │ This Week    │  │
│  │ Airing   │     │ Sci-Fi     │     │ Full Calendar│  │
│  │ Movies   │     │ Romance    │     └──────────────┘  │
│  │ TV Series│     │ ...        │                       │
│  └──────────┘     └────────────┘                       │
└────────────────────────────────────────────────────────┘
```

- Three columns: Cargo (rankings), Genres (dynamic list), Schedule (quick links).
- Background: `surface-raised` glass with `backdrop-blur-lg`.
- Animation: slide-down 150ms spring, fade-in 100ms.
- Click outside to close. Escape to close.

---

## 4. Mobile Drawer

Triggered by hamburger icon in global header. Slides in from the right.

### Layout

```
┌───────────────────────┐
│ Nexus Anime      [X] │
│ ──────────────────── │
│ Home                 │
│ ▸ Browse             │
│   Trending           │
│   Popular            │
│   Latest             │
│   Genres             │
│   Schedule           │
│ ▸ Personal           │
│   Watchlist          │
│   Continue Watching  │
│   History            │
│   Profile            │
│   Settings           │
│   Notifications      │
│ ──────────────────── │
│ Sign In   Sign Up    │
│ Theme toggle         │
└───────────────────────┘
```

- Background: `surface-overlay` glass with `backdrop-blur-xl`.
- Animation: slide-in 250ms spring from right; slide-out 200ms ease-in.
- Close on: X button, click outside (scrim click), navigation, Escape.
- **Personal section:** only visible when authenticated. Hides entirely for anonymous users.
- **Sign In / Sign Up:** visible when anonymous. Hidden when authenticated (replaced by avatar + user menu within the drawer if needed).

---

## 5. Authenticated Sidebar

Desktop-only persistent navigation for authenticated route group `(authenticated)`.

### Layout

```
┌─────────┐
│  Logo   │
│  Avatar │
│  ─────  │
│  Home   │
│  Trend  │
│  Popular│
│  Latest │
│  Genres │
│  Sched  │
│  ─────  │
│  Watch  │
│  Cont.  │
│  History│
│  ─────  │
│  Profile│
│  Settings│
│  Notif. │
│  ─────  │
│  Help   │
│  Sign Out│
└─────────┘
```

- Width: 240px default, collapses to 64px icons-only on scroll or toggle.
- Background: `surface-raised` glass with right border `border-white/5`.
- Active state: `text-primary` + left 2px accent bar in `action-primary-bg`.
- Position: sticky, top 0, height 100vh.
- Scrolls independently if content overflows (rare).

### Sidebar collapse behavior

- **Expanded:** Icons + labels. Default on desktop.
- **Collapsed:** Icons only, labels hidden. Triggered by toggle button at bottom or auto-collapse on scroll.
- **Mobile:** Never visible as a sidebar. Mobile authenticated pages use the mobile drawer instead.

---

## 6. User Menu (Desktop Header)

Triggered by avatar click. Glass dropdown below avatar.

### Layout

```
┌─────────────────────────┐
│  Avatar  Username       │
│          Plan badge     │
│ ─────────────────────── │
│  Profile               │
│  Settings              │
│  Notifications    (3)  │
│ ─────────────────────── │
│  Sign Out              │
└─────────────────────────┘
```

- Background: `surface-raised` glass with `backdrop-blur-lg`.
- Animation: fade-in 100ms + slide-down 100ms.
- Click outside to close. Escape to close.
- **Notifications badge:** red circle with count, top-right of Notifications item. Hidden when 0.

---

## 7. Breadcrumbs

Used on detail pages only. Not used on discovery pages (those rely on the mega-menu and back button).

### Anime Detail

```
Home > Anime > [Romaji Title] > Season 1 > Episode 3
```

### Season Detail

```
Home > Anime > [Romaji Title] > Season 1
```

### Episode Detail

```
Home > Anime > [Romaji Title] > Season 1 > Episode 3
```

- Separator: `/` in `text-secondary`.
- Clickable segments: Home, Anime title, Season. Current page segment is plain text (not a link).
- Truncate middle segments if breadcrumb overflows container.
- Font: Inter 12px, `text-secondary`.

---

## 8. Contextual Navigation

### Back button

- Browser back button works as expected (Next.js provides this).
- No custom back button in the header — the platform relies on browser back.
- Exception: modals have an explicit close button (X) that returns to the originating page.

### Pagination

- Discovery pages use **infinite scroll** with a "Load more" fallback button.
- Search results use **cursor-based pagination** with infinite scroll.
- Watch history uses **cursor-based pagination** with a "Load more" button (not infinite scroll — bounded list).

### Tab navigation

Used on:

- **Anime Detail:** Episodes / Related / Reviews tabs.
- **Settings:** Account / Billing / Notifications / Accessibility tabs.
- **Profile:** Overview / Watchlist / History tabs.

Tab bar: underline-style active indicator in `action-primary-bg`, 2px height, full width of tab label. Animation: slide-underline 200ms spring when switching.

---

## 9. Footer

### Desktop

Four columns:

| Column   | Links                                       |
| -------- | ------------------------------------------- |
| Platform | About, Pricing, Press, Careers              |
| Content  | Trending, Popular, Latest, Genres, Schedule |
| Support  | Help Center, Contact, Status, Bug Reports   |
| Legal    | Terms, Privacy, Cookies, Licenses           |

Bottom row: copyright + social icons (Twitter, Discord, GitHub).

### Mobile

Two columns: Support + Legal. Platform and Content links collapse into the header's Browse menu.

- Background: `surface-base` with top border `border-white/5`.
- Text: `text-secondary`, links `text-primary` on hover.
- Font: Inter 13px.

---

## 10. Skip Navigation

- Skip-to-content link visible on keyboard focus only.
- Position: top-left, off-screen by default, slides in on focus.
- Target: `<main id="main-content">`.
- Style: `action-primary-bg` background, white text, 14px, padding 12px 16px, z-index 100.

---

## 11. Navigation State Summary

| State                        | Header right                    | Sidebar | Drawer personal |
| ---------------------------- | ------------------------------- | ------- | --------------- |
| Anonymous, public page       | Theme, Sign In, Sign Up         | —       | Hidden          |
| Anonymous, auth page         | Theme, Sign In, Sign Up         | —       | Hidden          |
| Authenticated, public page   | Theme, Notifications, User menu | —       | Visible         |
| Authenticated, auth page     | Theme, Notifications, User menu | —       | Visible         |
| Authenticated, personal page | Theme, Notifications, User menu | Visible | Visible         |

---

## 12. Future Enhancements

- **Command palette** (⌘K) — fuzzy search across catalog, settings, and actions.
- **Quick switcher** — recently viewed anime in user menu.
- **Tab bar on mobile** — bottom tab bar for primary actions (Home, Browse, Watchlist, Profile).
- **Gesture navigation** — swipe to go back on mobile.
