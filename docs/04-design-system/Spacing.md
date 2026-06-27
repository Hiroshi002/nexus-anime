# Spacing

> The 8px spatial grid system for Nexus Anime — scale, usage rules, and responsive adaptation.

---

## Design Decision

All spatial values (padding, margin, gap, inset) are multiples of **8px**, with **4px** available for fine-tuning where optical alignment demands it. This is the "8pt grid" system used by Material Design, Ant Design, and most mature design systems.

**Why 8px?** 8 divides cleanly into common screen widths (320, 375, 768, 1024, 1440), produces harmonious rhythms, and most importantly — 8 is the typical size of a "unit of spatial information" in UI design. 4px is too granular for a primary unit; 16px is too coarse for component detailing.

**Why allow 4px escapes?** Optical alignment sometimes requires half-units. An icon at 20px centered in a 24px container needs 2px inset (4px ÷ 2). These escapes are the exception, not the default.

---

## Spatial Scale

| Token       | Value (px) | rem   | Usage                                                       |
| ----------- | ---------- | ----- | ----------------------------------------------------------- |
| `space-0`   | 0          | 0     | No spacing — edge-to-edge elements                          |
| `space-0_5` | 2          | 0.125 | Hairline — rarely used, only for optical tweaks             |
| `space-1`   | 4          | 0.25  | Fine — icon padding, inline gaps, tight label spacing       |
| `space-1_5` | 6          | 0.375 | Compact — not on the 8px grid; use sparingly                |
| `space-2`   | 8          | 0.5   | Base — default intra-component gap                          |
| `space-2_5` | 10         | 0.625 | Slightly relaxed — not on the 8px grid; sparingly           |
| `space-3`   | 12         | 0.75  | Comfortable — form field gaps, list item padding            |
| `space-3_5` | 14         | 0.875 | Transitional — rarely used                                  |
| `space-4`   | 16         | 1.0   | Standard — inter-component gap, card padding                |
| `space-5`   | 20         | 1.25  | Relaxed — section padding (mobile), larger gaps             |
| `space-6`   | 24         | 1.5   | Spacious — section padding (desktop), card padding variants |
| `space-7`   | 28         | 1.75  | Generous — hero padding (mobile)                            |
| `space-8`   | 32         | 2.0   | Large — page section margins                                |
| `space-9`   | 36         | 2.25  | Extra large — rare, major section breaks                    |
| `space-10`  | 40         | 2.5   | Maximum component-level spacing                             |
| `space-12`  | 48         | 3.0   | Section padding (desktop)                                   |
| `space-16`  | 64         | 4.0   | Page-level vertical rhythm                                  |
| `space-20`  | 80         | 5.0   | Hero section padding                                        |
| `space-24`  | 96         | 6.0   | Maximum — splash screen, full-page spacing                  |

**Decision: Provide all multiples of 4 from 0–40, then jump to 48/64/80/96.** The 4px resolution covers every real-world gap. Beyond 40px, large jumps (48, 64, 80, 96) handle page-scale spacing where fine resolution isn't needed.

---

## Component Spacing Presets

Instead of requiring designers/developers to pick from the scale every time, common patterns are predefined:

### Inset (Padding) Presets

| Token               | Value            | Usage                               |
| ------------------- | ---------------- | ----------------------------------- |
| `inset-compact`     | `space-2` (8px)  | Dense lists, tags, small badges     |
| `inset-default`     | `space-3` (12px) | Default button padding, form fields |
| `inset-comfortable` | `space-4` (16px) | Card padding, dialog padding        |
| `inset-spacious`    | `space-6` (24px) | Section padding, large card padding |

### Stack (Vertical Gap) Presets

| Token            | Value            | Usage                                          |
| ---------------- | ---------------- | ---------------------------------------------- |
| `stack-tight`    | `space-1` (4px)  | Related inline items, form field label + input |
| `stack-compact`  | `space-2` (8px)  | List items, form fields in a group             |
| `stack-default`  | `space-3` (12px) | Paragraphs in a block, sections in a card      |
| `stack-relaxed`  | `space-4` (16px) | Between card sections, between form groups     |
| `stack-spacious` | `space-6` (24px) | Between major sections in a page               |

### Inline (Horizontal Gap) Presets

| Token            | Value            | Usage                                   |
| ---------------- | ---------------- | --------------------------------------- |
| `inline-tight`   | `space-1` (4px)  | Icon + label, avatar + name             |
| `inline-compact` | `space-2` (8px)  | Tag list, breadcrumb items              |
| `inline-default` | `space-3` (12px) | Button group, filter chips              |
| `inline-relaxed` | `space-4` (16px) | Section header + action, two-column gap |

---

## Layout Spacing

### Page-Level

| Area                   | Mobile            | Tablet            | Desktop           |
| ---------------------- | ----------------- | ----------------- | ----------------- |
| Page horizontal margin | `space-4` (16px)  | `space-6` (24px)  | `space-8` (32px)  |
| Section vertical gap   | `space-8` (32px)  | `space-10` (40px) | `space-12` (48px) |
| Hero top padding       | `space-12` (48px) | `space-16` (64px) | `space-20` (80px) |
| Hero bottom padding    | `space-8` (32px)  | `space-12` (48px) | `space-16` (64px) |
| Content max-width      | 100%              | 720px             | 1200px            |

### Component-Level

| Component      | Padding                                                | Internal Gap                |
| -------------- | ------------------------------------------------------ | --------------------------- |
| Card           | `space-4` (16px)                                       | `space-3` (12px)            |
| Card (compact) | `space-3` (12px)                                       | `space-2` (8px)             |
| Dialog         | `space-6` (24px)                                       | `space-4` (16px)            |
| Dropdown       | `space-2` (8px)                                        | `space-1` (4px)             |
| List item      | `space-3` (12px) vertical                              | `space-3` (12px) horizontal |
| Nav item       | `space-2` (8px) vertical, `space-3` (12px) horizontal  | `space-2` (8px)             |
| Toast          | `space-3` (12px) vertical, `space-4` (16px) horizontal | `space-2` (8px)             |

---

## Responsive Spacing

Spacing responds to viewport width. The principle is **proportional increase** — mobile spacing is the base; tablet/desktop add 33–50% more.

| Token                 | Mobile (<768) | Tablet (768–1023) | Desktop (≥1024) |
| --------------------- | ------------- | ----------------- | --------------- |
| `space-responsive-1`  | 4px           | 4px               | 4px             |
| `space-responsive-2`  | 8px           | 8px               | 8px             |
| `space-responsive-3`  | 12px          | 12px              | 12px            |
| `space-responsive-4`  | 16px          | 16px              | 16px            |
| `space-responsive-6`  | 24px          | 24px              | 28px            |
| `space-responsive-8`  | 32px          | 36px              | 40px            |
| `space-responsive-12` | 48px          | 56px              | 64px            |
| `space-responsive-16` | 64px          | 80px              | 96px            |

**Decision: Small spaces don't scale.** 4, 8, 12, and 16px are fixed across breakpoints — scaling micro-spacing produces negligible benefit and breaks pixel-aligned elements. Only macro-spacing (24px+) scales.

---

## Spacing Rules

1. **Always use token values.** Never hardcode `8px`, `16px`, etc. in component CSS. Use `var(--space-2)`, `var(--space-4)`.
2. **Adjacent spacing combines, never overlaps.** Two elements that each have `space-4` padding produce 32px between them (16 + 16), not 16px. If 16px is desired, use `gap` on the parent instead of padding on children.
3. **Touch targets: minimum 44×44px** (Apple HIG) / 48×48px (Material). If an icon is 20×20px, add at least 12px padding all sides to reach 44×44px.
4. **Minimum gap between clickable elements: `space-2` (8px).** Prevents mis-taps on mobile.
5. **Negative margin is forbidden** except for intentional overlap patterns (e.g., avatar stack, badge overlap).
6. **`space-0_5` (2px) requires justification in code review.** 2px should never be the default — it exists for optical alignment only.
7. **Vertical rhythm: consecutive block elements in a column** should use `stack-*` presets, not arbitrary spacing values.
