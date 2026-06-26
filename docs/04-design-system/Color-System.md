# Color System

> The complete color architecture for Nexus Anime — palette, semantics, accessibility, and implementation tokens.

---

## Design Decision

The color system is inspired by **futuristic sci-fi fantasy interfaces** — deep space blacks, crystalline blues, and energy-signature accents. The palette avoids the over-saturated neon of cyberpunk in favor of controlled luminosity: dark surfaces with precise punctuations of light. Think less "Synthwave dashboard" and more "premium game launcher at midnight."

All colors are defined in OKLCH for perceptual uniformity. Implementation uses CSS custom properties with OKLCH values, falling back to hex for tooling that doesn't support OKLCH.

**Why OKLCH?** OKLCH is perceptually uniform — a 10% lightness change looks identical across hues. HSL and RGB produce uneven perceptual jumps, making palette generation unreliable. OKLCH also handles the wide gamut of modern displays (P3) natively.

---

## Base Palette

### Neutrals — "Void"

The neutral scale is cool-shifted (blue undertone) to maintain the sci-fi atmosphere. Pure gray feels lifeless; cool gray feels like deep space.

| Token | OKLCH | Hex | Usage |
|-------|-------|-----|-------|
| `void-0` | `oklch(0.02 0.01 260)` | `#050810` | Absolute black — modal backdrops, deepest recesses |
| `void-1` | `oklch(0.06 0.02 260)` | `#0a0e1a` | Base surface — page background |
| `void-2` | `oklch(0.10 0.02 260)` | `#111627` | Raised surface — card backgrounds |
| `void-3` | `oklch(0.14 0.02 260)` | `#171d30` | Overlay surface — modals, drawers |
| `void-4` | `oklch(0.18 0.02 260)` | `#1c2338` | Elevated surface — popup, dropdown |
| `void-5` | `oklch(0.22 0.02 260)` | `#222840` | Highest elevation — floating panels |
| `void-6` | `oklch(0.28 0.02 260)` | `#2d3450` | Subtle borders, dividers |
| `void-7` | `oklch(0.35 0.02 260)` | `#3a4160` | Disabled borders, muted controls |
| `void-8` | `oklch(0.45 0.02 260)` | `#505876` | Placeholder text, icons |
| `void-9` | `oklch(0.60 0.02 260)` | `#747c9e` | Secondary text |
| `void-10` | `oklch(0.75 0.02 260)` | `#a3aac6` | Primary text |
| `void-11` | `oklch(0.88 0.01 260)` | `#cdd1e2` | High-emphasis text |
| `void-12` | `oklch(0.95 0.005 260)` | `#ecedf5` | Maximum emphasis — headings on dark |

**Decision: Blue undertone (chroma 0.02, hue 260).** Pure achromatic neutrals (`chroma: 0`) create a flat, corporate feel. The cold blue push maintains atmosphere without being visibly "blue." The chroma is low enough that `void-12` reads as white, not blue-white.

---

### Primary — "Aether"

The primary color is a luminous cyan-blue — the signature accent. It evokes energy fields, holographic displays, and data streams. It is NOT a typical "brand blue" (#3B82F6); it leans distinctly cyan to feel futuristic.

| Token | OKLCH | Hex | Usage |
|-------|-------|-----|-------|
| `aether-1` | `oklch(0.30 0.10 230)` | `#1a4a6b` | Darkest — focus ring inner glow |
| `aether-2` | `oklch(0.40 0.12 230)` | `#2563a0` | Pressed state background |
| `aether-3` | `oklch(0.50 0.14 230)` | `#3380c4` | Hover state background |
| `aether-4` | `oklch(0.60 0.15 230)` | `#4199d8` | Default background (buttons, links) |
| `aether-5` | `oklch(0.70 0.15 230)` | `#5bb2ea` | Light variant — icons on dark surface |
| `aether-6` | `oklch(0.80 0.12 230)` | `#82c7f5` | Glow source — text on dark |
| `aether-7` | `oklch(0.90 0.08 230)` | `#b0ddfa` | Light text — badge backgrounds |
| `aether-8` | `oklch(0.95 0.04 230)` | `#daedfc` | Near-white tint — subtle highlights |

**Decision: Hue 230 (cyan-blue), not 260 (blue) or 200 (cyan).** 260 reads as "corporate blue." 200 reads as "cyan/teal." 230 hits the sweet spot: recognizably blue but with enough cyan shift to feel futuristic.

---

### Accent — "Nova"

Nova is a warm violet-magenta used sparingly for: premium indicators, special events, and secondary CTAs that need to break from the Aether signature.

| Token | OKLCH | Hex | Usage |
|-------|-------|-----|-------|
| `nova-1` | `oklch(0.30 0.12 310)` | `#6b1a5e` | Darkest |
| `nova-2` | `oklch(0.45 0.15 310)` | `#a0258a` | Pressed |
| `nova-3` | `oklch(0.55 0.16 310)` | `#c033a5` | Hover |
| `nova-4` | `oklch(0.65 0.15 310)` | `#da44bc` | Default |
| `nova-5` | `oklch(0.75 0.13 310)` | `#ec66d4` | Light variant |
| `nova-6` | `oklch(0.85 0.10 310)` | `#f494e4` | Glow source |

**Decision: Hue 310 (violet-magenta).** This avoids the purple-blue that would compete with Aether. The warm shift creates a clear visual channel: Aether = navigation/action, Nova = premium/special.

---

### Semantic Colors

| Token | OKLCH | Hex | Purpose | WCAG Use |
|-------|-------|-----|---------|----------|
| `success` | `oklch(0.65 0.18 150)` | `#22c55e` | Confirmations, completed states, online indicators | Large text/UI: 3:1 ✓ |
| `success-muted` | `oklch(0.40 0.08 150)` | `#166534` | Success backgrounds on dark surfaces | Background only |
| `warning` | `oklch(0.75 0.16 85)` | `#f59e0b` | Warnings, attention needed, expiring soon | Large text/UI: 3:1 ✓ |
| `warning-muted` | `oklch(0.45 0.08 85)` | `#92400e` | Warning backgrounds | Background only |
| `error` | `oklch(0.60 0.20 25)` | `#ef4444` | Errors, destructive actions, invalid states | Large text/UI: 3:1 ✓ |
| `error-muted` | `oklch(0.35 0.10 25)` | `#7f1d1d` | Error backgrounds | Background only |
| `info` | `oklch(0.60 0.15 230)` | `#4199d8` | Info banners, tooltips | Same as aether-4 |

**Decision: Success hue 150 (green), Warning hue 85 (amber), Error hue 25 (red).** These follow established semantic color conventions. The specific hues are shifted slightly cooler/warmer to harmonize with the void-aether palette rather than looking like generic traffic-light colors.

---

### Specialty Colors

| Token | OKLCH | Hex | Purpose |
|-------|-------|-----|---------|
| `platinum` | `oklch(0.85 0.02 80)` | `#d4cfc4` | Premium subscriber badge, exclusive content |
| `gold` | `oklch(0.80 0.12 85)` | `#d4a017` | Achievement badges, ranked indicators |
| `streaming-live` | `oklch(0.65 0.22 25)` | `#e53e3e` | Live broadcast indicator dot |

---

## Semantic Token Mapping

These tokens map base palette values to semantic roles. Components reference **only** semantic tokens.

### Surface Tokens

| Token | Resolves To | Description |
|-------|-------------|-------------|
| `surface-base` | `void-1` | Page background |
| `surface-raised` | `void-2` | Card, list item background |
| `surface-overlay` | `void-3` | Modal, drawer background |
| `surface-elevated` | `void-4` | Dropdown, tooltip, popover |
| `surface-floating` | `void-5` | Highest elevation — floating panels, toasts |
| `surface-sunken` | `void-0` | Inset areas, code blocks, well regions |

### Text Tokens

| Token | Resolves To | Contrast on surface-base | Description |
|-------|-------------|--------------------------|-------------|
| `text-primary` | `void-12` | 17.4:1 ✓ | Headings, primary content |
| `text-secondary` | `void-10` | 7.8:1 ✓ | Body text |
| `text-tertiary` | `void-9` | 4.9:1 ✓ | Captions, helper text |
| `text-placeholder` | `void-8` | 3.2:1 ✗* | Placeholder text in inputs |
| `text-disabled` | `void-7` | 2.1:1 ✗ | Disabled element text |
| `text-on-accent` | `void-1` | 17.4:1 ✓ | Text on Aether/Nova backgrounds |
| `text-inverse` | `void-1` | 17.4:1 ✓ | Text on bright surfaces |

*\* Placeholder text at 3.2:1 is permitted per WCAG 2.2 SC 1.4.11 — placeholder is not "text that conveys information." However, we aim for 3:1 minimum even for placeholders.*

### Border Tokens

| Token | Resolves To | Description |
|-------|-------------|-------------|
| `border-subtle` | `void-6` | Default borders — card edges, dividers |
| `border-default` | `void-7` | Interactive borders — input fields |
| `border-strong` | `void-8` | Emphasized borders — active cards |
| `border-accent` | `aether-4` | Accent-colored borders — focused inputs, selected cards |

### Action Tokens

| Token | Resolves To | Description |
|-------|-------------|-------------|
| `action-primary-bg` | `aether-4` | Primary button background |
| `action-primary-hover` | `aether-3` | Primary button hover |
| `action-primary-pressed` | `aether-2` | Primary button pressed |
| `action-primary-text` | `void-1` | Text on primary button |
| `action-secondary-bg` | `void-3` | Secondary button background |
| `action-secondary-hover` | `void-4` | Secondary button hover |
| `action-secondary-text` | `void-11` | Text on secondary button |
| `action-ghost-hover` | `void-3` | Ghost button/icon hover background |
| `action-accent-bg` | `nova-4` | Accent/premium button background |
| `action-accent-text` | `void-1` | Text on accent button |

---

## Glow System

Glows are the signature visual effect. They use the primary color at low opacity to create energy-like halos around key elements.

| Token | Value | Usage |
|-------|-------|-------|
| `glow-sm` | `0 0 8px aether-4 / 0.25` | Small glow — active nav items, badges |
| `glow-md` | `0 0 16px aether-4 / 0.20` | Medium glow — primary buttons, focused cards |
| `glow-lg` | `0 0 24px aether-4 / 0.15` | Large glow — hero elements, featured content |
| `glow-xl` | `0 0 40px aether-4 / 0.10` | Extra large — ambient background effects |
| `glow-nova-sm` | `0 0 8px nova-4 / 0.25` | Premium glow — subscriber features |
| `glow-nova-md` | `0 0 16px nova-4 / 0.20` | Premium glow — premium CTAs |

**Decision: Glow uses `box-shadow` with spread 0, not `filter: drop-shadow`.** Multiple box-shadow layers GPU-composite efficiently. Spread 0 keeps the glow proportional to element size without bleeding into neighbors.

---

## Gradient Presets

| Name | Value | Usage |
|------|-------|-------|
| `gradient-surface` | `linear-gradient(180deg, void-2, void-1)` | Card surfaces — subtle top-to-bottom depth |
| `gradient-hero` | `radial-gradient(ellipse at 50% 0%, aether-5 / 0.15, transparent 70%)` | Hero ambient light |
| `gradient-overlay` | `linear-gradient(180deg, transparent 50%, void-1)` | Image overlays — text readability on images |
| `gradient-accent` | `linear-gradient(135deg, aether-4, nova-4)` | Premium/feature badges |
| `gradient-shine` | `linear-gradient(135deg, transparent 40%, void-11 / 0.05 50%, transparent 60%)` | Gloss shimmer on glass surfaces |

---

## Contrast Validation

Every text/background combination used in the interface passes WCAG 2.2 AA:

| Combination | Foreground | Background | Ratio | Passes AA |
|-------------|-----------|-----------|-------|-----------|
| Body text on base | `void-10` (#747c9e) | `void-1` (#0a0e1a) | 4.9:1 | ✓ (4.5:1 req) |
| Heading on base | `void-12` (#ecedf5) | `void-1` (#0a0e1a) | 17.4:1 | ✓ |
| Caption on base | `void-9` (#a3aac6) | `void-1` (#0a0e1a) | 7.8:1 | ✓ |
| Body on raised | `void-10` (#747c9e) | `void-2` (#111627) | 4.5:1 | ✓ |
| Button text on aether | `void-1` (#0a0e1a) | `aether-4` (#4199d8) | 6.2:1 | ✓ |
| Error text on base | `error` (#ef4444) | `void-1` (#0a0e1a) | 4.6:1 | ✓ |
| Success text on base | `success` (#22c55e) | `void-1` (#0a0e1a) | 5.9:1 | ✓ |
| Aether text on base | `aether-6` (#82c7f5) | `void-1` (#0a0e1a) | 8.1:1 | ✓ |

**Disabled text** (`void-7` on `void-1`) at 2.1:1 is exempt per WCAG SC 1.4.3 — disabled UI is not required to meet contrast minimums.

---

## Color Usage Rules

1. **Never use palette tokens directly in components.** Always reference semantic tokens. Palette tokens appear only in token definition files.
2. **Maximum 3 colors per component** (surface, text, accent). More signals over-design.
3. **Glow on interactive elements only.** Static content never glows.
4. **Semantic colors never decorate.** Red is for errors, green for success, amber for warning — never for "it looks cool."
5. **Nova accent appears on ≤10% of visible elements** at any time. It loses impact through overuse.
6. **Gradients never exceed 2 color stops** except `gradient-shine` (3 stops for the gloss effect).
7. **All color values must be specified in OKLCH** in the token definition, with hex as a fallback comment for tooling.
