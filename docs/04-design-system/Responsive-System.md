# Responsive System

> The responsive design architecture for Nexus Anime — strategy, breakpoints, adaptation patterns, and device targets.

---

## Design Decision

The responsive strategy is **mobile-first with progressive enhancement**. Layouts are designed at 380px (smallest target) and enhanced at each breakpoint. The system uses three adaptation mechanisms: layout reflow (CSS Grid/Flexbox), component variant switching (container queries), and token scaling (spacing, type).

**Why mobile-first, not desktop-first?** Mobile-first produces simpler base styles (single column, stacked layout) with additive overrides at wider breakpoints. Desktop-first produces complex base styles (multi-column, positioned layout) that must be undone at narrow breakpoints — harder to maintain and more error-prone.

**Why not a separate mobile site?** A separate mobile site doubles maintenance, creates content parity issues, and defeats URL consistency. A single responsive codebase with adaptive components is the industry standard for a reason.

---

## Breakpoint System

See [Grid-System.md](Grid-System.md) for the full breakpoint definitions. Summary:

| Token    | Min-Width | Label                             | Columns | Gutter |
| -------- | --------- | --------------------------------- | ------- | ------ |
| `bp-xs`  | 0px       | Mobile (portrait)                 | 4       | 16px   |
| `bp-sm`  | 640px     | Mobile (landscape) / small tablet | 4       | 16px   |
| `bp-md`  | 768px     | Tablet (portrait)                 | 8       | 20px   |
| `bp-lg`  | 1024px    | Tablet (landscape) / laptop       | 12      | 24px   |
| `bp-xl`  | 1280px    | Desktop                           | 12      | 24px   |
| `bp-2xl` | 1536px    | Large desktop                     | 12      | 24px   |

---

## Device Targets

### Primary Targets (Must-test)

| Device            | Viewport  | Pixel Ratio | Notes                                               |
| ----------------- | --------- | ----------- | --------------------------------------------------- |
| iPhone SE         | 375×667   | 2×          | Smallest target — 375 is close to our 380px minimum |
| iPhone 14/15      | 390×844   | 3×          | Standard modern iPhone                              |
| iPhone 15 Pro Max | 430×932   | 3×          | Largest popular iPhone                              |
| iPad Mini         | 768×1024  | 2×          | Tablet portrait — 2-column grid starts here         |
| iPad Pro 11"      | 834×1194  | 2×          | Tablet landscape                                    |
| MacBook 13"       | 1440×900  | 1×          | Desktop — 4-column grid, sidebar layout             |
| Desktop 1440p     | 2560×1440 | 1×          | Large desktop — max-width container                 |

### Secondary Targets (Should-test)

| Device                  | Viewport  | Notes                                    |
| ----------------------- | --------- | ---------------------------------------- |
| Android (Chrome, 360px) | 360×640   | Narrower than iPhone SE — test edge case |
| Samsung Galaxy S23      | 360×780   | Common Android viewport                  |
| iPad Pro 12.9"          | 1024×1366 | Large tablet                             |
| Ultrawide 34"           | 3440×1440 | Extreme width — max-width handles        |

**Decision: 380px minimum, not 320px.** 320px (iPhone SE 1st gen) has <0.5% market share in our target demographic. Designing for 320px constrains the 380–768px range unnecessarily. If 320px users visit, content is usable via horizontal scroll on specific elements (not the page).

---

## Responsive Adaptation Patterns

### Pattern 1: Layout Reflow

The most common pattern — component layout changes based on viewport width.

| Component    | Mobile (<768px)         | Tablet (768–1023px) | Desktop (≥1024px)               |
| ------------ | ----------------------- | ------------------- | ------------------------------- |
| Navigation   | Bottom tab bar          | Side rail (compact) | Side rail (expanded)            |
| Anime grid   | 2 columns               | 3 columns           | 4 columns                       |
| Anime detail | Stacked (poster → info) | Poster + info (row) | Poster + info + sidebar (3-col) |
| Episode list | Full-width rows         | Full-width rows     | Sidebar list                    |
| Search       | Full-screen overlay     | Sidebar panel       | Sidebar panel                   |
| Filters      | Bottom sheet            | Collapsible panel   | Sidebar panel                   |
| Player       | Full-screen only        | Responsive embed    | Side-by-side + episode list     |

### Pattern 2: Component Variant Switching

Using CSS Container Queries, a component changes its internal layout based on its container's width (not the viewport).

| Component   | Narrow (<200px)              | Medium (200–400px)              | Wide (>400px)                               |
| ----------- | ---------------------------- | ------------------------------- | ------------------------------------------- |
| Anime card  | Compact: poster + title only | Default: poster + title + score | Featured: poster + title + score + synopsis |
| Episode row | Title + duration only        | Thumbnail + title + duration    | Thumbnail + title + description + duration  |

### Pattern 3: Content Progressive Disclosure

More content is revealed at wider viewports, not just rearranged.

| Content                | Mobile                      | Tablet                     | Desktop                         |
| ---------------------- | --------------------------- | -------------------------- | ------------------------------- |
| Anime metadata on card | Title only                  | Title + score + genre tags | Title + score + genres + studio |
| Synopsis lines         | 2-line clamp                | 3-line clamp               | 3-line clamp + "Read more"      |
| Episode thumbnails     | Hidden                      | Small (120px)              | Standard (160px)                |
| Related anime count    | 4 items                     | 6 items                    | 8 items                         |
| Trending section       | 5 items (horizontal scroll) | 8 items (grid)             | 12 items (grid)                 |

---

## Navigation Responsive Strategy

### Mobile: Bottom Tab Bar

| Tab       | Icon     | Label       |
| --------- | -------- | ----------- |
| Home      | `zap`    | "Home"      |
| Browse    | `search` | "Browse"    |
| Watchlist | `heart`  | "Watchlist" |
| Continue  | `play`   | "Continue"  |
| Profile   | `user`   | "Profile"   |

- Fixed to bottom of viewport.
- 56px height (below 44px min touch target per item).
- Active tab: aether-4 icon + label, glow effect.
- Inactive: void-8 icon, muted label.

### Tablet: Side Rail (Compact)

- 64px wide, fixed left.
- Icons only (no labels).
- Active: aether-4 icon, left border accent, glow.
- Expand on hover to 200px with labels (tooltip-style expansion).

### Desktop: Side Rail (Expanded)

- 240px wide, fixed left.
- Icons + labels.
- Sections: Main nav, Library, Account.
- Collapsible to compact mode via toggle.

**Decision: Bottom tab on mobile, not hamburger menu.** Hamburger menus hide navigation behind an interaction wall, reducing discoverability. Bottom tabs make all primary destinations visible — critical for a content app where navigation is the primary action.

---

## Touch vs Pointer

| Behavior         | Touch (Mobile/Tablet)              | Pointer (Desktop)                          |
| ---------------- | ---------------------------------- | ------------------------------------------ |
| Card interaction | Tap → navigate to detail           | Hover → preview metadata; Click → navigate |
| Hover reveals    | Not available — use tap/long-press | Hover to reveal secondary info             |
| Context menus    | Long-press → context menu          | Right-click → context menu                 |
| Drag to reorder  | Touch drag with 44px handles       | Click-drag                                 |
| Scroll           | Native momentum scroll             | Scroll wheel, trackpad                     |
| Video controls   | Tap to show/hide chrome            | Mouse move to show chrome, idle to hide    |

**Decision: Never require hover.** Any information shown on hover must be available without hover. Card preview metadata on hover is supplementary — the full metadata is on the detail page accessible by tap/click.

---

## Safe Zones

### Content Safe Zones

| Area                          | Mobile                              | Desktop | Rationale      |
| ----------------------------- | ----------------------------------- | ------- | -------------- |
| Top (below status bar)        | `env(safe-area-inset-top)`          | 0       | iPhone notch   |
| Bottom (above home indicator) | `env(safe-area-inset-bottom)` + 8px | 0       | iOS swipe area |
| Left (default)                | 16px                                | 32px    | Page margin    |
| Right (default)               | 16px                                | 32px    | Page margin    |

### Scroll Under

Fixed elements (nav bar, bottom tabs) allow content to scroll under them with a glassmorphic surface creating separation. Content must have `padding-top`/`padding-bottom` equal to the fixed element's height to prevent overlap.

---

## Performance Budgets by Device

| Metric               | Mobile     | Tablet      | Desktop     |
| -------------------- | ---------- | ----------- | ----------- |
| Max initial JS       | 100KB      | 150KB       | 200KB       |
| Max blur regions     | 2          | 3           | 3           |
| Max shadow elevation | 1          | 2           | 4           |
| Max card columns     | 2          | 3           | 4           |
| Image quality        | 60%        | 75%         | 90%         |
| Hero image size      | 800px wide | 1200px wide | 1920px wide |
| Poster image size    | 300×450px  | 400×600px   | 500×750px   |

**Decision: Lower image quality on mobile.** Mobile screens have higher pixel density, making compression artifacts less visible. 60% quality at 2× pixel ratio looks sharper than 90% quality at 1× — and saves ~60% bandwidth.

---

## Responsive Rules

1. **Design at 380px first**, then add breakpoint overrides. Never design desktop-first and "squeeze" to mobile.
2. **Never use `!important` in breakpoint overrides.** If specificity requires it, the selector structure is wrong.
3. **Test every component at 380, 768, 1024, and 1440px** before marking complete.
4. **Touch targets on mobile are larger than visual size.** If a button is 36px tall visually, add 4px padding top/bottom to reach 44px touch target.
5. **No hover-only interactions.** Every hover effect must have a non-hover equivalent.
6. **Container queries for component-level responsiveness**, viewport queries for page layout.
7. **Responsive images via `next/image`** with `sizes` prop specifying the image width at each breakpoint.
8. **Lazy-load below-fold content** — intersection observer or Next.js dynamic imports.
