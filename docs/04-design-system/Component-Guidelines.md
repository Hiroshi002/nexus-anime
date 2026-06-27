# Component Guidelines

> The component architecture, states, variants, and composition patterns for Nexus Anime.

---

## Design Decision

Components follow a **compound component pattern** — small, single-responsibility primitives composed into feature-specific composites. There is no monolithic `AnimeCard` that handles every variant. Instead, `Card` + `Poster` + `ScoreBadge` + `Title` compose into the layouts that need them.

**Why compound over monolithic?** Monolithic components accrete props (variant, size, showScore, showSynopsis, showBadge, interactive, featured...). Each prop is a conditional branch. Compound components have few props, clear responsibilities, and compose via children.

---

## Component Anatomy

Every component has:

1. **Root element** — the outermost container, handles sizing, spacing, and elevation.
2. **Slots** — named child positions (e.g., Card has `header`, `body`, `footer`).
3. **Variants** — visual alternatives (e.g., Card: `default`, `glass`, `compact`).
4. **Sizes** — when applicable: `sm`, `md` (default), `lg`.
5. **States** — interactive states: `rest`, `hover`, `focus`, `active`, `disabled`, `loading`.

---

## Component States

### Interactive States

| State              | Visual Treatment                                                                  | Trigger                            |
| ------------------ | --------------------------------------------------------------------------------- | ---------------------------------- |
| **Rest**           | Default appearance per variant                                                    | Default                            |
| **Hover**          | Elevation +1, background +shade, glow (if accent), cursor: pointer                | Mouse hover                        |
| **Focus**          | 2px focus ring (aether-4), elevation +1, no glow                                  | Keyboard focus, programmatic focus |
| **Active/Pressed** | Elevation -1, inset shadow, slight scale(0.98)                                    | Mouse down, key held               |
| **Disabled**       | Reduced opacity (0.4), cursor: not-allowed, no hover/focus effects, aria-disabled | Prop                               |
| **Loading**        | Skeleton placeholder matching component shape                                     | Loading state                      |

### State Precedence

When multiple states apply simultaneously:

```
disabled > loading > active > focus > hover > rest
```

Disabled overrides everything — a disabled focused button shows disabled, not focus ring.

---

## Common State Patterns

### Button States

| State    | Background               | Text                  | Shadow                | Border                 | Scale |
| -------- | ------------------------ | --------------------- | --------------------- | ---------------------- | ----- |
| Rest     | `action-primary-bg`      | `action-primary-text` | `elevation-1`         | none                   | 1     |
| Hover    | `action-primary-hover`   | same                  | `elevation-2`         | none                   | 1     |
| Focus    | `action-primary-bg`      | same                  | `elevation-1`         | `2px aether-4` (ring)  | 1     |
| Active   | `action-primary-pressed` | same                  | `elevation-0` + inset | none                   | 0.98  |
| Disabled | `void-3`                 | `void-7`              | none                  | `1px void-6`           | 1     |
| Loading  | `void-3`                 | hidden                | none                  | `1px void-6` + spinner | 1     |

### Input States

| State    | Background | Border               | Shadow | Ring                      |
| -------- | ---------- | -------------------- | ------ | ------------------------- |
| Rest     | `void-2`   | `1px border-default` | none   | none                      |
| Hover    | `void-2`   | `1px border-strong`  | none   | none                      |
| Focus    | `void-2`   | `1px border-accent`  | none   | `2px aether-4` offset 2px |
| Error    | `void-2`   | `1px error`          | none   | `2px error` offset 2px    |
| Disabled | `void-3`   | `1px void-6`         | none   | none                      |
| Loading  | `void-2`   | `1px border-default` | none   | none + spinner            |

### Card States

| State    | Elevation     | Border              | Glow      | Transform          |
| -------- | ------------- | ------------------- | --------- | ------------------ |
| Rest     | `elevation-0` | `1px void-6 / 0.30` | none      | none               |
| Hover    | `elevation-1` | `1px void-7 / 0.50` | `glow-sm` | `translateY(-2px)` |
| Focus    | `elevation-1` | `1px aether-4`      | `glow-sm` | none               |
| Active   | `elevation-0` | `1px aether-4`      | none      | none               |
| Selected | `elevation-1` | `1px aether-4`      | `glow-sm` | none               |
| Disabled | `elevation-0` | `1px void-6 / 0.20` | none      | none               |

---

## Skeleton System

Skeletons replace content during loading. They mirror the exact layout of the loaded state — same dimensions, same spacing, same element count.

### Skeleton Appearance

| Property      | Value                                                      |
| ------------- | ---------------------------------------------------------- |
| Color         | `void-6` (shimmer base)                                    |
| Shimmer color | `void-7` (highlight pass)                                  |
| Animation     | Shimmer — gradient sweep left to right, 2s loop            |
| Border radius | Matches the element it replaces                            |
| Opacity       | 1 (full — skeletons don't fade in, they swap with content) |

### Shimmer Animation

```css
/* Design specification */
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.skeleton {
  background: linear-gradient(90deg, var(--void-6) 25%, var(--void-7) 50%, var(--void-6) 75%);
  background-size: 200% 100%;
  animation: shimmer 2s ease-in-out infinite;
}
```

**Decision: 2s shimmer cycle.** Faster than 2s draws attention to the shimmer itself. Slower doesn't register as "loading" and feels broken.

**Decision: Shimmer pauses under `prefers-reduced-motion`.** Replace with a static `void-6` fill.

### Skeleton Presets

| Preset                  | Elements                                                    | Layout                 |
| ----------------------- | ----------------------------------------------------------- | ---------------------- |
| `skeleton-card`         | Image rectangle + title line + subtitle line                | Match AnimeCard layout |
| `skeleton-card-compact` | Image square + title line                                   | Match compact card     |
| `skeleton-detail`       | Hero rect + title + 3 meta lines + synopsis block (4 lines) | Match anime detail     |
| `skeleton-episode-row`  | Thumbnail square + 2 text lines                             | Match episode row      |
| `skeleton-list-item`    | Avatar circle + 2 text lines                                | Match list item        |
| `skeleton-form`         | Label + input rect, repeated                                | Match form layout      |

---

## Component Variants

### Card Variants

| Variant    | Surface         | Border        | Content                | Use When                       |
| ---------- | --------------- | ------------- | ---------------------- | ------------------------------ |
| `default`  | `void-2` opaque | `void-6`      | Title, score, metadata | Standard catalog grid          |
| `glass`    | Standard glass  | Glass border  | Title, score           | Home page, featured sections   |
| `compact`  | Transparent     | None          | Title only             | Dense lists, inline references |
| `featured` | Tinted glass    | Tinted border | Title, score, synopsis | Hero/featured carousel         |

### Button Variants

| Variant       | Background    | Text       | Border             | Use When                    |
| ------------- | ------------- | ---------- | ------------------ | --------------------------- |
| `primary`     | `aether-4`    | `void-1`   | None               | Primary CTA, play button    |
| `secondary`   | `void-3`      | `void-11`  | `1px void-7`       | Secondary action, cancel    |
| `ghost`       | transparent   | `void-10`  | None               | Tertiary, icon buttons, nav |
| `accent`      | `nova-4`      | `void-1`   | None               | Premium CTA, upsell         |
| `destructive` | `error-muted` | `error`    | `1px error / 0.50` | Delete, remove, disconnect  |
| `link`        | transparent   | `aether-6` | None               | Inline text link            |

### Button Sizes

| Size | Padding (V × H)     | Font               | Icon Size        | Min Height |
| ---- | ------------------- | ------------------ | ---------------- | ---------- |
| `sm` | `space-1 × space-2` | `text-sm` (12px)   | `icon-xs` (12px) | 28px       |
| `md` | `space-2 × space-3` | `text-sm` (12px)   | `icon-sm` (16px) | 36px       |
| `lg` | `space-2 × space-4` | `text-base` (14px) | `icon-sm` (16px) | 44px       |
| `xl` | `space-3 × space-5` | `text-md` (16px)   | `icon-md` (20px) | 52px       |

**Decision: 36px default button height (md).** 36px is compact enough for dense UIs but large enough to tap accurately. 44px (lg) is used for prominent CTAs.

### Input Variants

| Variant   | Use When                                                |
| --------- | ------------------------------------------------------- |
| `default` | Standard form inputs                                    |
| `glass`   | Inputs on glassmorphic surfaces (search overlay, modal) |

---

## Composition Patterns

### Slot Pattern

```tsx
// Design specification — component API
<Card>
  <Card.Header>
    <Poster src={anime.poster} />
  </Card.Header>
  <Card.Body>
    <Title>{anime.title}</Title>
    <ScoreBadge score={anime.score} />
  </Card.Body>
  <Card.Footer>
    <WatchlistToggle animeId={anime.id} />
  </Card.Footer>
</Card>
```

### Polymorphic Root

Some components can render as different elements:

- `Card` → `<article>` (default), `<a>` (clickable), `<div>` (layout-only)
- `Button` → `<button>` (default), `<a>` (link button)
- `Input` → `<input>` (default), `<textarea>` (multiline)

---

## Naming Conventions

| Category   | Prefix         | Examples                                    |
| ---------- | -------------- | ------------------------------------------- |
| Primitives | None           | `Button`, `Input`, `Badge`, `Avatar`        |
| Layout     | None           | `Stack`, `Grid`, `Container`, `Divider`     |
| Composite  | Feature prefix | `AnimeCard`, `EpisodeRow`, `PlayerControls` |
| Overlay    | None           | `Modal`, `Drawer`, `Tooltip`, `Toast`       |
| Hooks      | `use`          | `useWatchlist`, `useContinueWatching`       |

**Decision: Feature prefix on composites only.** Primitives are generic — `Button` is `Button` everywhere. Composites embed domain concepts — `AnimeCard` makes the context explicit.

---

## Component Rules

1. **One responsibility per component.** If a component does two things (fetches data AND renders UI), split into a data-fetching wrapper and a presentational component.
2. **Props ≤ 7 per component.** More than 7 props suggests the component does too much. Compose instead.
3. **Boolean props for states** (`disabled`, `loading`), enum props for variants (`variant="glass"`), never both for the same concept.
4. **No `style` prop.** If a component needs custom styling, it's not in the design system — use a one-off.
5. **All interactive elements have a default handler** (at minimum a no-op or console warning) — never require a handler for basic rendering.
6. **Composition via children over props.** Instead of `<Card title="..." subtitle="...">`, use `<Card><Title>...</Title><Subtitle>...</Subtitle></Card>`.
7. **Every component has a `children` slot** unless it has no logical body (e.g., `Divider`, `Spacer`).
8. **Components are Server Component by default.** Add `"use client"` only when state/effects/browser APIs are required.
