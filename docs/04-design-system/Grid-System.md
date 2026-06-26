# Grid System

> The layout grid for Nexus Anime — breakpoints, columns, gutters, and responsive behavior.

---

## Design Decision

The grid uses a **12-column** system with fluid columns and fixed gutters. 12 is the most versatile column count: divisible by 2, 3, 4, and 6, supporting layouts from 2-column (6+6) to 4-column (3+3+3+3) to asymmetric (8+4, 9+3).

**Why not 16-column?** 16 supports finer divisions but the marginal benefit over 12 doesn't justify the complexity. Our content types (cards, sidebars, hero + sidebar) are well-served by 12.

**Why fluid columns with fixed gutters?** Fluid columns adapt to viewport width naturally. Fixed gutters prevent content from touching at narrow widths or stretching apart at wide widths. This is the standard responsive grid pattern used by Bootstrap, Bulma, and Chakra UI.

---

## Breakpoints

Breakpoints define viewport ranges where layout strategies change. They are **min-width** (mobile-first).

| Token | Name | Min-Width | Target Devices | Layout Strategy |
|-------|------|-----------|----------------|-----------------|
| `bp-xs` | Extra Small | 0px | Phones (portrait) | Single column, full-width cards |
| `bp-sm` | Small | 640px | Phones (landscape), small tablets | Single column, compact cards |
| `bp-md` | Medium | 768px | Tablets (portrait) | 2-column grid, sidebar visible |
| `bp-lg` | Large | 1024px | Tablets (landscape), small laptops | 3-column grid, sidebar expanded |
| `bp-xl` | Extra Large | 1280px | Desktops, large laptops | 4-column grid, max-width container |
| `bp-2xl` | 2X Large | 1536px | Large desktops, ultrawide | 4-column grid, more margin |

**Decision: 6 breakpoints.** This matches Tailwind CSS 4's default breakpoints, ensuring zero configuration overhead. Custom breakpoints would require overriding Tailwind's `screens` config and increase maintenance.

**Decision: 640px for `sm`, not 576px.** 640px aligns with iPhone landscape and is the Tailwind default. 576px (Bootstrap's `sm`) is too narrow for a meaningful layout shift.

---

## Grid Configuration

| Breakpoint | Columns | Gutter | Margin (each side) | Max Content Width |
|------------|---------|--------|--------------------|--------------------|
| xs (0–639px) | 4 | 16px | 16px | 100% |
| sm (640–767px) | 4 | 16px | 16px | 100% |
| md (768–1023px) | 8 | 20px | 24px | 100% |
| lg (1024–1279px) | 12 | 24px | 32px | 1200px |
| xl (1280–1535px) | 12 | 24px | 32px | 1200px |
| 2xl (1536px+) | 12 | 24px | 48px | 1200px |

**Decision: 4 columns on mobile, not 12.** A 12-column grid forced into 375px produces columns too narrow to be meaningful. 4 columns on mobile map naturally to: full-width (4), half-width (2+2), and sidebar-like (3+1). The 12-column system activates at `lg` where there's enough width for all subdivisions.

**Decision: Max content width 1200px.** Beyond 1200px, line lengths exceed 75–80 characters (at 14px), reducing readability. The page margin absorbs excess width, centering content.

---

## Column Spans by Component Type

| Content Type | xs | sm | md | lg | xl | 2xl |
|-------------|----|----|----|----|----|-----|
| Anime card (grid) | 2 (2-col) | 2 (2-col) | 4 (2-col) | 3 (4-col) | 3 (4-col) | 3 (4-col) |
| Anime card (featured) | 4 (full) | 4 (full) | 8 (full) | 8 (⅔) | 8 (⅔) | 8 (⅔) |
| Sidebar | — | — | — | 3 (¼) | 3 (¼) | 3 (¼) |
| Main content (with sidebar) | 4 (full) | 4 (full) | 8 (full) | 9 (¾) | 9 (¾) | 9 (¾) |
| Hero section | 4 (full) | 4 (full) | 8 (full) | 12 (full) | 12 (full) | 12 (full) |
| Search results (list) | 4 (full) | 4 (full) | 8 (full) | 8 (⅔) | 9 (¾) | 9 (¾) |
| Season sidebar | — | — | 3 (sidebar) | 3 (¼) | 3 (¼) | 3 (¼) |

---

## CSS Grid vs Flexbox

| Layout Need | Use | Why |
|-------------|-----|-----|
| Card grids (anime catalog, search results) | CSS Grid | 2D layout, consistent row heights, auto-fill |
| Page layout (sidebar + main) | CSS Grid | Named grid areas, fixed sidebar width |
| Nav items, button groups | Flexbox | 1D flow, centering, gap |
| Form fields (label + input) | Flexbox | 1D alignment, wrapping |
| Card internal layout | Flexbox | Direction flexibility (row/col) |
| Hero sections | CSS Grid | Overlapping elements, asymmetric placement |

**Decision: CSS Grid for 2D, Flexbox for 1D.** This is the standard recommendation. Grid prevents the "row alignment" problem that flexbox has with wrapping items of different heights.

---

## Grid Auto-Placement

For anime card grids, use CSS Grid auto-placement to avoid specifying explicit column positions:

```css
/* Not implementation — design specification */
.anime-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-4); /* 16px */
}

@media (min-width: 1024px) {
  .anime-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

**Decision: `auto-fill` with `minmax(180px, 1fr)` below `lg`.** This naturally adapts to any viewport width between 320–1023px without breakpoint-specific column declarations. At `lg` and above, we force 4 columns for consistent density.

---

## Container Queries

For component-level responsive behavior (card layout changing based on its container size, not viewport size), use **CSS Container Queries**.

| Component | Container Query Breakpoint | Layout Change |
|-----------|---------------------------|---------------|
| Anime card | `@container (min-width: 200px)` | Compact → default layout |
| Episode row | `@container (min-width: 400px)` | Hide image → show image |
| Watchlist item | `@container (min-width: 300px)` | Stack → row layout |

**Decision: Container queries for cards, not viewport queries.** A card in a sidebar (300px wide) should be compact regardless of viewport. Container queries make components responsive to their own context — essential for the sidebar + main layout.

---

## Safe Area Insets

For devices with notches (iPhone X+) or rounded corners, respect safe area insets:

```css
/* Not implementation — design specification */
.page {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

**Decision: Use `env(safe-area-inset-*)` on the page wrapper.** Individual components don't need to handle this — the page container absorbs the insets.

---

## Grid Rules

1. **Always use `gap` for grid/flex spacing**, never margin on children.
2. **Nest grids sparingly.** Maximum 2 levels of grid nesting. Beyond that, the layout is too complex and should be decomposed.
3. **Never use absolute positioning for grid items** except for intentional overlaps (hero badge, floating action).
4. **Columns must use `1fr` divisions** (e.g., `3fr 1fr`), not fixed widths, to maintain responsiveness. The sidebar can be an exception (fixed 280px + `1fr` main).
5. **Gutter values must come from the spacing scale** (`space-4`, `space-5`, `space-6`). No custom gutter values.
6. **Cards within a grid row must have equal height.** Use `grid-auto-rows: 1fr` or `align-items: stretch`.
