# Glassmorphism

> The glass surface system for Nexus Anime — composition, variants, constraints, and the definitive glass recipe.

---

## Design Decision

Glassmorphism is the **signature surface treatment** of Nexus Anime. Glass surfaces use `backdrop-filter: blur()` combined with semi-transparent backgrounds and subtle borders to create the illusion of frosted glass floating over an atmospheric background. This creates depth, hierarchy, and the futuristic aesthetic that defines the platform.

**Why glassmorphism over flat surfaces?** The platform's identity is "cinematic portal." Flat opaque surfaces read as a standard web app. Glass surfaces read as a holographic interface — the content feels like it's floating in space rather than sitting on a page.

**Why not neumorphism?** Neumorphism (soft UI) uses inner/outer shadows to simulate extrusion from a surface. It fails on dark themes — dark surfaces + subtle shadows = invisible shadows. Glassmorphism works with dark themes because the blur + transparency effect is visible regardless of background color.

---

## The Glass Recipe

Every glass surface is composed of 5 layers. All 5 must be present for the glass effect to work:

```
┌─────────────────────────────────────┐
│ 1. BORDER (subtle, semi-transparent)│  ← Defines the glass edge
│  ┌─────────────────────────────────┐│
│ │ 2. BACKGROUND (semi-transparent) ││  ← Tints the blurred content
│ │  ┌─────────────────────────────┐││
│ │ │ 3. BACKDROP BLUR             │││  ← Obscures the content behind
│ │ │  ┌─────────────────────────┐│││
│ │ │ │ 4. SHADOW                 ││││  ← Communicates elevation
│ │ │ │  ┌─────────────────────┐ ││││
│ │ │ │ │ 5. CONTENT            │ ││││  ← Text, icons, controls
│ │ │ │ └─────────────────────┘ ││││
│ │ │ └─────────────────────────┘│││
│ │ └─────────────────────────────┘││
│ └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

### Layer 1: Border

```css
border: 1px solid oklch(0.60 0.02 260 / var(--glass-border-opacity));
```

The border is **always semi-transparent** — this is what makes the glass edge feel like a light refraction rather than a painted line. The opacity varies by glass variant.

### Layer 2: Background

```css
background: oklch(var(--glass-lightness) 0.02 260 / var(--glass-bg-opacity));
```

The background is semi-transparent with the **cool neutral** (chroma 0.02, hue 260). The opacity controls how much the blurred background bleeds through. Lower opacity = more glass-like; higher opacity = more readable.

### Layer 3: Backdrop Blur

```css
backdrop-filter: blur(var(--glass-blur));
```

See [Blur.md](Blur.md) for the blur scale. Blur amount varies by glass variant.

### Layer 4: Shadow

Shadow from the elevation system. See [Shadows.md](Shadows.md).

### Layer 5: Content

Text, icons, controls rendered on the glass surface. Always at full opacity — never apply opacity to content itself.

---

## Glass Variants

### Standard Glass

The default glass surface for cards and UI panels.

| Property | Value | Rationale |
|----------|-------|-----------|
| Background | `void-2 / 0.70` | Readable but background color influences surface |
| Border | `void-8 / 0.15` | Barely visible edge — light refraction |
| Blur | `blur-sm` (8px) | Light frost — detail obscured, color present |
| Shadow | `elevation-1` | Subtly raised |

### Frosted Glass

Heavy glass for modals, overlays, and surfaces that need strong separation from background content.

| Property | Value | Rationale |
|----------|-------|-----------|
| Background | `void-3 / 0.85` | Nearly opaque — readability priority |
| Border | `void-7 / 0.20` | Visible edge — clear boundary |
| Blur | `blur-md` (16px) | Standard frost |
| Shadow | `elevation-3` | Prominent elevation |

### Crystal Glass

Minimal glass for badges, chips, and small elements. Lightest touch.

| Property | Value | Rationale |
|----------|-------|-----------|
| Background | `void-2 / 0.50` | Very transparent — background dominates |
| Border | `void-8 / 0.10` | Near-invisible edge |
| Blur | `blur-xs` (4px) | Minimal frost |
| Shadow | `elevation-0` | No elevation |

### Tinted Glass

Glass with an accent color bleed. Used for featured content, premium features, and branded surfaces.

| Property | Value | Rationale |
|----------|-------|-----------|
| Background | `aether-2 / 0.15` | Subtle Aether tint |
| Border | `aether-5 / 0.20` | Colored edge — Aether light |
| Blur | `blur-sm` (8px) | Light frost |
| Shadow | `elevation-1` + `glow-sm` | Subtle Aether glow |

### Nova Glass

Premium glass with Nova (violet-magenta) accent. For subscriber-exclusive content and premium CTAs.

| Property | Value | Rationale |
|----------|-------|-----------|
| Background | `nova-1 / 0.15` | Nova tint |
| Border | `nova-5 / 0.25` | Nova edge |
| Blur | `blur-sm` (8px) | Light frost |
| Shadow | `elevation-1` + `glow-nova-sm` | Nova glow |

---

## Glass by Component

| Component | Variant | Rationale |
|-----------|---------|-----------|
| Anime card | Standard | Default browsing surface |
| Featured anime card | Tinted | Aether accent highlights the featured item |
| Premium content card | Nova | Signals exclusivity |
| Navigation bar | Frosted | Must be readable over scrolling content |
| Sidebar/drawer | Frosted | Persistent but separate from content |
| Modal/dialog | Frosted | Strong separation from background |
| Bottom sheet | Frosted | Mobile overlay — needs strong frost |
| Tooltip | Crystal | Small and lightweight |
| Badge | Crystal | Minimal glass decoration |
| Dropdown | Frosted | Needs readability over trigger content |
| Toast | Frosted | Transient but readable |
| Hero overlay | Standard (reversed) | Text over hero image — glass helps readability |

---

## Glass + Shadow Interaction

Glass surfaces at higher elevations need stronger shadows to communicate depth. The shadow must be visible *around* the glass edge, not just behind it. This means:

- **Border radius** on the glass surface and its shadow must match.
- **No `overflow: hidden`** on glass containers that need visible shadow edges.
- The shadow renders **behind the glass surface**, visible in the margin/gap area.

---

## Background Requirements

Glassmorphism only works when there's something interesting to blur. The system requires:

1. **The page background layer** must have visual content — gradients, ambient glows, or a subtle pattern. A solid-color background behind glass produces no visible blur effect.
2. **Glass surfaces must not stack directly** — two glass surfaces overlapping produce double-blur (blur of blur), which is unreadable and expensive. Stack at most 1 glass surface over the background.
3. **Glass surfaces over images** (hero sections, video thumbnails) produce the most dramatic effect and are encouraged.

---

## Responsive Behavior

| Viewport | Glass Behavior |
|----------|---------------|
| Desktop (≥1024px) | Full glass — blur + transparency + glow |
| Tablet (768–1023px) | Standard glass — blur + transparency, no glow on non-interactive elements |
| Mobile (<768px) | Reduced glass — `blur-xs` (4px), higher background opacity (0.85), no glow |
| Low-end | Opaque fallback — no blur, full opacity, border + shadow only |

**Decision: Reduce glass on mobile.** Mobile GPUs struggle with multiple blur regions. Reducing blur amount and increasing opacity preserves the glass *feeling* (semi-transparent border, subtle shadow) while reducing GPU cost. On low-end devices, the fallback is fully opaque — the border and shadow still communicate depth.

---

## Accessibility

1. **Text on glass must pass contrast** against both the glass surface AND the worst-case background. Test with a light background area behind the glass — if contrast drops below 4.5:1, increase background opacity.
2. **Glass borders are decorative** — they must not be the sole indicator of a boundary. If the border is invisible (e.g., light background behind crystal glass), the surface must have an alternative boundary (shadow or spacing).
3. **Focus rings on glass elements** must be high-contrast. Use Aether-4 (#4199d8) at 2px — this is visible against all glass variants' backgrounds.

---

## Glassmorphism Rules

1. **All 5 layers must be present** in a glass surface (border, background, blur, shadow, content). Omitting any layer breaks the glass illusion.
2. **Never apply `opacity` to a glass container** — this affects all children. Use rgba/oklch alpha on the background property instead.
3. **Content opacity is always 1.0.** Text and icons on glass are never faded.
4. **Maximum 1 glass surface overlapping** the background at any point. No glass-on-glass stacking.
5. **Background must have visual interest** (gradient, image, ambient glow). Glass over flat color produces no visible effect.
6. **Test contrast with worst-case background.** The minimum contrast must pass AA regardless of what's behind the glass.
7. **Use the variant system**, not ad-hoc glass properties. Every glass surface in the product should map to one of the 5 variants.
