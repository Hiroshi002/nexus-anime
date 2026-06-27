# Radius

> The border-radius system for Nexus Anime — scale, usage rules, and token mapping.

---

## Design Decision

The radius system ranges from **0 (sharp)** to **full (pill)** across 7 steps. The default corner radius is **8px** — enough to feel modern and approachable without looking "rounded" or "bubble-like." Sharp corners are reserved for elements that should feel structural (dividers, code blocks, full-bleed images).

**Why 8px default, not 4px or 12px?** 4px reads as "almost sharp" — a visual half-measure that doesn't register as intentionally rounded. 12px is too friendly — it softens the sci-fi aesthetic. 8px says "designed" without saying "cute."

**Why not per-element radius?** Inconsistent radius destroys visual cohesion. A card at 8px radius containing an input at 4px creates a clashing intersection. The radius scale ensures nesting compatibility.

---

## Radius Scale

| Token         | Value  | Usage                                                 | Visual Feel                       |
| ------------- | ------ | ----------------------------------------------------- | --------------------------------- |
| `radius-0`    | 0px    | Code blocks, dividers, full-bleed images, data tables | Sharp — structural                |
| `radius-1`    | 2px    | Small badges, inline tags, avatar borders             | Barely rounded — subtle softening |
| `radius-2`    | 4px    | Icon buttons, chips, compact inputs, tooltips         | Slightly rounded — compact UI     |
| `radius-3`    | 6px    | Input fields, textareas, selects                      | Rounded — interactive inputs      |
| `radius-4`    | 8px    | Cards, buttons, dialogs, dropdowns, modals            | Default — primary UI              |
| `radius-5`    | 12px   | Large cards, hero sections, panels                    | Soft — prominent surfaces         |
| `radius-6`    | 16px   | Feature cards, splash elements, image thumbnails      | Very soft — feature/UI break      |
| `radius-full` | 9999px | Pills, avatars, toggle switches, circular buttons     | Pill/circle — enclosing           |

**Decision: Even-number scale with 2px granularity.** This matches the 4px half-unit available in our spacing system, ensuring radius values align with spatial rhythm.

**Decision: `9999px` for full, not `50%`.** `border-radius: 50%` creates a circle only on square elements. `9999px` creates a pill on any rectangle and a circle on squares — it works regardless of element dimensions.

---

## Radius by Component

| Component          | Token                                           | Value   | Rationale                                      |
| ------------------ | ----------------------------------------------- | ------- | ---------------------------------------------- |
| Button (default)   | `radius-4`                                      | 8px     | Matches card radius — visual pairing           |
| Button (compact)   | `radius-2`                                      | 4px     | Tighter at small size, denser feel             |
| Button (pill)      | `radius-full`                                   | 9999px  | Tag buttons, filter pills                      |
| Card               | `radius-4`                                      | 8px     | Default surface radius                         |
| Card (featured)    | `radius-5`                                      | 12px    | Larger, more prominent                         |
| Dialog / Modal     | `radius-5`                                      | 12px    | Slightly softer than card — elevation cue      |
| Toast              | `radius-4`                                      | 8px     | Matches button radius                          |
| Input field        | `radius-3`                                      | 6px     | Slightly less than button — input ≠ button     |
| Textarea           | `radius-3`                                      | 6px     | Same as input                                  |
| Select / Dropdown  | `radius-3` (top), `radius-4` (bottom when open) | 6px/8px | Open state uses card radius                    |
| Avatar             | `radius-full`                                   | 9999px  | Circular — standard pattern                    |
| Badge / Tag        | `radius-full`                                   | 9999px  | Pill shape                                     |
| Chip               | `radius-2`                                      | 4px     | Compact, information-dense                     |
| Tooltip            | `radius-2`                                      | 4px     | Small, contextual — shouldn't feel like a card |
| Code block         | `radius-0`                                      | 0px     | Structural, monospace context                  |
| Image (in card)    | `radius-3`                                      | 6px     | Slightly less than card to nest visually       |
| Image (standalone) | `radius-4`                                      | 8px     | Same as card when full-bleed                   |
| Progress bar       | `radius-full`                                   | 9999px  | Pill endcaps                                   |
| Toggle switch      | `radius-full`                                   | 9999px  | Standard toggle shape                          |

---

## Nested Radius Rule

When a rounded container holds a rounded child, the child's radius must be **at least 4px less** than the container's. This prevents the child's corners from visually merging with the container's corners.

| Container Radius  | Max Child Radius | Example                            |
| ----------------- | ---------------- | ---------------------------------- |
| `radius-4` (8px)  | `radius-2` (4px) | Card (8px) → Input inside (4px)    |
| `radius-5` (12px) | `radius-3` (6px) | Dialog (12px) → Input inside (6px) |
| `radius-6` (16px) | `radius-4` (8px) | Panel (16px) → Card inside (8px)   |

**Decision: 4px nesting gap.** Less than 4px and the eye can't distinguish the two curves. More than 4px wastes available radius and makes inner elements look too sharp.

---

## Conditionals

### Squircle (Superellipse) Consideration

Apple's design language uses continuous corners (squircles) where the radius follows a superellipse curve rather than a circular arc. This avoids the "cut corner" appearance of large border-radius values.

**Decision: Not in v1.** CSS `border-radius` produces circular arcs. Squircles require SVG masks or `paint-order` hacks that hurt performance and accessibility. If the design feels "too cut" at large radii, we'll reduce the radius value rather than implement squircles.

### Focus Ring Radius

Focus rings follow the element's radius plus 2px outward offset:

```css
/* Design specification, not implementation */
:focus-visible {
  outline: 2px solid var(--aether-4);
  outline-offset: 2px;
  border-radius: inherit; /* matches element radius */
}
```

**Decision: Focus ring inherits element radius.** A square focus ring on a rounded button looks wrong. `border-radius: inherit` ensures the ring follows the element's shape.

---

## Radius Rules

1. **Always use token values.** No hardcoded `border-radius: 7px`.
2. **Default to `radius-4` (8px)** for any new component unless it's explicitly listed above.
3. **Never mix two non-adjacent radius tokens** in the same component (e.g., `radius-1` top-left + `radius-5` top-right).
4. **Full-bleed images inside cards** get the card's radius on their outer corners and `radius-0` where they meet card content. Use `overflow: hidden` on the card.
5. **Radius does not scale responsive.** A card is 8px at 375px and 8px at 1440px. Responsive radius creates layout shift and visual inconsistency.
