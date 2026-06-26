# Blur

> The blur system for Nexus Anime — backdrop blur levels, content blur, and performance constraints.

---

## Design Decision

Blur is the core mechanism behind glassmorphism surfaces. The system defines **4 blur levels** for `backdrop-filter: blur()` and **2 levels** for content/preview blur. Each level is tuned for perceptual quality vs. GPU cost.

**Why 4 backdrop-blur levels?** Glassmorphism requires enough blur to obscure the background for readability but not so much that the background color influence is lost. The 4 levels cover: minimal hint of depth, standard glass, heavy frost, and maximum obscuration.

**Why restrict blur regions?** `backdrop-filter: blur()` triggers GPU compositing for each element. On devices with limited GPU memory, 10+ simultaneous blur regions cause frame drops. The system caps simultaneous blurs at 3 per viewport.

---

## Backdrop Blur Scale

| Token | Value | Visual Effect | Usage |
|-------|-------|---------------|-------|
| `blur-xs` | 4px | Barely perceptible — slight color bleed | Subtle glass hints, decorative panels |
| `blur-sm` | 8px | Light frosted glass — background shapes visible | Secondary cards, tags, badges |
| `blur-md` | 16px | Standard frosted glass — background colors present, detail absent | Primary cards, navigation bar, modal surfaces |
| `blur-lg` | 24px | Heavy frost — background barely recognizable | Dialogs, overlays, full-screen panels |
| `blur-xl` | 32px | Maximum frost — near-opaque blur | Splash screens, loading overlays |

**Decision: Anchor at 16px for default glass.** 16px blur on a typical desktop background produces readable text while maintaining visible color influence from the background. This is the "sweet spot" for glassmorphism that actually looks like glass, not like a semi-transparent overlay over noise.

**Decision: 4px minimum for `backdrop-filter`.** Below 4px, the blur is perceptually equivalent to no blur — it wastes GPU cycles for no visual benefit. If you don't need at least 4px of blur, don't use `backdrop-filter`.

---

## Content Blur Scale

Content blur is used for spoiler images, age-gated content, and preview thumbnails.

| Token | Value | Visual Effect | Usage |
|-------|-------|---------------|-------|
| `blur-content-sm` | 8px | Faces obscured, text unreadable | Mild spoiler protection |
| `blur-content-md` | 20px | Everything reduced to color blobs | Full spoiler/age-gate blur |

**Decision: `filter: blur()` for content (not `backdrop-filter`).** Content blur applies to the element itself (an image), not the area behind it. `filter: blur()` is appropriate here and doesn't trigger the same compositing overhead as `backdrop-filter` on surrounding content.

---

## Blur by Component

| Component | Blur Token | Rationale |
|-----------|-----------|-----------|
| Navigation bar (fixed) | `blur-md` | Must be readable while scrolling content shows through |
| Card (glass variant) | `blur-sm` | Subtle glass — card content is the focus, not the effect |
| Card (featured) | `blur-md` | Prominent glass — backdrop color creates atmosphere |
| Modal/Dialog | `blur-lg` | Strong separation from background content |
| Drawer/Sidebar | `blur-md` | Moderate separation — sidebar is persistent, not disruptive |
| Toast | `blur-sm` | Lightweight — toast should feel ephemeral |
| Tooltip | `blur-xs` | Barely there — tooltip is small, blur is decorative |
| Dropdown | `blur-sm` | Subtle glass — content behind is often the trigger button |
| Bottom sheet (mobile) | `blur-lg` | Covers most of the screen — needs strong frost |
| Badge (glass variant) | `blur-xs` | Minimal — badge is tiny, heavy blur wastes GPU |
| Spoiler image | `blur-content-md` | Full obscuration |
| Age-gate preview | `blur-content-md` | Full obscuration |

---

## Performance Budget

| Constraint | Limit | Rationale |
|------------|-------|-----------|
| Max simultaneous `backdrop-filter` regions | 3 per viewport | GPU compositing cost scales linearly with blur regions |
| Max blur per region | 32px (`blur-xl`) | Beyond 32px, GPU cost increases sharply with diminishing visual return |
| Max total blur area | ~500,000 px² per viewport | 3 regions × ~400×400px = 480,000px² — within most mobile GPU budgets |
| Mobile (≤768px) max regions | 2 | Mobile GPUs have less VRAM; reduce blur regions |
| Low-end device fallback | 0 regions | Detect via `@supports (backdrop-filter: blur(1px))` and serve opaque surfaces |

**Decision: 3-region cap with detection.** Modern desktop browsers handle 5+ blur regions easily. The bottleneck is mobile Safari and mid-range Android devices. 3 regions is conservative enough to avoid jank on 90% of devices.

---

## Fallback Strategy

When `backdrop-filter` is unsupported or the device is low-end, glass surfaces degrade to **opaque surfaces** with the same border and shadow:

```css
/* Design specification — fallback logic */
.glass-surface {
  background: oklch(0.10 0.02 260 / 0.80); /* semi-transparent */
  backdrop-filter: blur(16px);
}

@supports not (backdrop-filter: blur(1px)) {
  .glass-surface {
    background: oklch(0.10 0.02 260); /* opaque */
    /* border + shadow remain — depth still communicated */
  }
}
```

**Decision: Opaque fallback, not blur removal.** Removing blur without making the surface opaque creates readability failures — text over an unblurred background is often illegible. The fallback makes the surface fully opaque, preserving all other depth cues (border, shadow, radius).

---

## Reduced Motion

`prefers-reduced-motion: reduce` does **not** disable blur — blur is a static visual property, not a motion effect. However, animated blur transitions (changing blur value over time) are disabled under reduced-motion.

| Preference | Static Blur | Animated Blur |
|-----------|-------------|---------------|
| `prefers-reduced-motion: no-preference` | Enabled | Enabled |
| `prefers-reduced-motion: reduce` | Enabled | Instant snap (no animation) |

---

## Blur Rules

1. **Always use blur tokens**, never raw `blur(17px)` values.
2. **Count blur regions** — if a layout has more than 3 surfaces with `backdrop-filter`, reduce visual blur in the least important surface or make it opaque.
3. **Never animate `backdrop-filter: blur()`.** If a reveal animation needs blur to decrease, animate `opacity` from 0→1 with a pre-blurred static surface. Animating the blur value itself triggers per-frame compositing.
4. **`blur-xs` (4px) requires justification.** At 4px, the effect is subtle enough that it may not justify the GPU cost. Consider whether an opaque surface with a subtle border would achieve the same visual.
5. **Content blur uses `filter: blur()`, never `backdrop-filter`.** `filter` applies to the element; `backdrop-filter` applies to the area behind it.
6. **`overflow: hidden` on blurred image containers.** `filter: blur()` bleeds outside the element's bounds. Clip with `overflow: hidden` on the parent.
