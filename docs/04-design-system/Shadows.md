# Shadows

> The shadow/elevation system for Nexus Anime — levels, composition, and performance.

---

## Design Decision

The shadow system uses **layered `box-shadow`** with 2–3 shadow layers per elevation. Multi-layer shadows produce smoother, more realistic depth than single-layer shadows — they simulate the soft penumbra and hard umbra of real-world light.

**Why layered shadows?** A single `box-shadow` with a large blur produces a "dirty" shadow with harsh edges. Layering a tight shadow (small blur, high opacity) with a soft shadow (large blur, low opacity) produces natural depth gradation.

**Why not `filter: drop-shadow`?** `filter: drop-shadow` respects alpha contours but forces GPU filter rendering on the entire element and its children. This breaks compositing optimizations and causes jank on animated elements. `box-shadow` GPU-composites independently.

**Why no colored shadows?** Colored shadows (e.g., blue shadow under a blue button) are a trend that ages quickly and reduces the shadow's depth-communication function. All shadows are neutral (cool-gray).

---

## Elevation Levels

Elevation communicates spatial depth. Higher elevation = closer to the user = more important.

| Level | Token | Description | Visual Cue |
|-------|-------|-------------|------------|
| 0 | `elevation-0` | Flush with surface | No shadow, no border |
| 1 | `elevation-1` | Slightly raised | Subtle shadow, subtle border |
| 2 | `elevation-2` | Default raised | Medium shadow |
| 3 | `elevation-3` | Elevated | Prominent shadow |
| 4 | `elevation-4` | Floating | Strong shadow, max depth |

---

## Shadow Definitions

Each elevation uses 2–3 shadow layers. The shadow color is `void-0` (#050810) — the deepest neutral — ensuring shadows are invisible against the base surface and visible against raised surfaces.

### Elevation 0 — Flush

```css
--shadow-0: none;
```

No shadow. Used for: page background, inset areas, base-level elements.

### Elevation 1 — Slightly Raised

```css
--shadow-1:
  0 1px 2px 0 oklch(0.02 0.01 260 / 0.30),  /* tight */
  0 1px 3px 0 oklch(0.02 0.01 260 / 0.15);  /* soft */
```

Used for: cards at rest, list items, input fields.

### Elevation 2 — Default Raised

```css
--shadow-2:
  0 2px 4px 0 oklch(0.02 0.01 260 / 0.35),  /* tight */
  0 4px 8px 0 oklch(0.02 0.01 260 / 0.20);  /* soft */
```

Used for: hovered cards, active nav items, dropdowns.

### Elevation 3 — Elevated

```css
--shadow-3:
  0 4px 6px 0 oklch(0.02 0.01 260 / 0.40),  /* umbra */
  0 8px 16px 0 oklch(0.02 0.01 260 / 0.25), /* penumbra */
  0 2px 4px 0 oklch(0.02 0.01 260 / 0.15);  /* contact */
```

Used for: modals, drawers, popovers, floating panels.

### Elevation 4 — Floating

```css
--shadow-4:
  0 8px 12px 0 oklch(0.02 0.01 260 / 0.45),  /* umbra */
  0 16px 32px 0 oklch(0.02 0.01 260 / 0.30), /* penumbra */
  0 4px 8px 0 oklch(0.02 0.01 260 / 0.20);   /* contact */
```

Used for: dialogs, toast notifications, highest-priority overlays.

---

## Elevation by Component

| Component | Rest | Hover | Focus | Active/Drag |
|-----------|------|-------|-------|-------------|
| Card (catalog) | `elevation-0` + border | `elevation-1` + glow | `elevation-1` | — |
| Card (featured) | `elevation-1` | `elevation-2` + glow | `elevation-2` | — |
| Button (primary) | `elevation-1` | `elevation-2` | `elevation-1` | `elevation-0` |
| Button (secondary) | `elevation-0` | `elevation-1` | `elevation-1` | `elevation-0` |
| Dropdown | `elevation-2` | — | — | — |
| Modal/Dialog | `elevation-3` | — | — | — |
| Drawer | `elevation-3` | — | — | — |
| Toast | `elevation-4` | — | — | — |
| Tooltip | `elevation-2` | — | — | — |
| Nav item | `elevation-0` | `elevation-0` + bg | `elevation-0` + bg | — |
| Floating action | `elevation-3` | `elevation-4` | `elevation-3` | `elevation-2` |

---

## Inner Shadows (Inset)

Inset shadows simulate depth within a container — sunken wells, inset inputs, pressed buttons.

| Token | Value | Usage |
|-------|-------|-------|
| `shadow-inset-1` | `inset 0 1px 2px 0 oklch(0.02 0.01 260 / 0.30)` | Pressed buttons, inset fields |
| `shadow-inset-2` | `inset 0 2px 4px 0 oklch(0.02 0.01 260 / 0.25)` | Well regions, code blocks |

**Decision: Inset shadows are rare.** The glassmorphism system (see Glassmorphism.md) handles most "depth" communication via `backdrop-blur` and border opacity. Inset shadows are reserved for pressed states and explicitly sunken areas.

---

## Shadow + Glow Combination

Interactive elements combine shadow (depth) with glow (accent). The glow is an additive `box-shadow` layer:

```css
/* Design specification for a hovered primary card */
.card-primary:hover {
  box-shadow:
    /* glow layer (innermost) */
    0 0 16px oklch(0.60 0.15 230 / 0.20),
    /* elevation shadow layers */
    0 2px 4px 0 oklch(0.02 0.01 260 / 0.35),
    0 4px 8px 0 oklch(0.02 0.01 260 / 0.20);
}
```

**Decision: Glow before shadow in `box-shadow` declaration.** CSS renders `box-shadow` layers back-to-front (first listed = outermost/behind). Putting glow first ensures it renders behind the elevation shadow, creating a "lit from behind" effect rather than "floating in light."

---

## Performance Considerations

| Scenario | Recommendation |
|----------|---------------|
| Animated element | Use only `transform` + `opacity`; never animate `box-shadow` |
| Large shadow area | Prefer `elevation-0` (border-only) for full-width elements |
| Shadow on scroll | Use `will-change: box-shadow` sparingly; prefer class toggle |
| Multiple elevated elements | Limit to 8 simultaneous shadowed elements per viewport |
| Mobile | Reduce to `elevation-0`/`elevation-1` only below 768px |

**Decision: Reduce shadows on mobile.** On small screens, elements are close together — large shadows overlap and create visual mud. `elevation-1` max on mobile preserves depth cues without the noise.

---

## Shadow Rules

1. **Always use elevation tokens**, not raw `box-shadow` values.
2. **Elevation must increase monotonically** through interaction states: rest < hover < focus (or equal). Going from `elevation-2` to `elevation-0` on hover is banned — it implies the element moves *into* the surface, which is confusing.
3. **Exception: Active/pressed state** — dropping to `elevation-0` + `shadow-inset-1` simulates physical depression. This is the only allowed decrease.
4. **Never combine more than 4 `box-shadow` layers** (glow + 3 shadow layers). Beyond 4, compositing cost rises without visible quality gain.
5. **Shadow color must always be `void-0`** — never use accent colors or semantic colors in shadows.
6. **`filter: drop-shadow` is banned** in component CSS. Use it only in SVG-specific utilities where alpha-contour shadow is required.
