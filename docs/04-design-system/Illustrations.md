# Illustrations

> The illustration system for Nexus Anime — style, usage, and production guidelines.

---

## Design Decision

Illustrations are used **sparingly** — for empty states, error states, onboarding, and feature promotion. The platform is content-rich (anime posters, backdrops, video) and doesn't need decorative illustration to fill space. When illustrations are used, they must feel native to the sci-fi aesthetic.

**Why not more illustrations?** Anime streaming platforms are inherently visual — the content itself (posters, key visuals, clips) provides the visual richness. Adding decorative illustrations on top of anime artwork creates visual competition. Illustrations are reserved for states where real content is absent.

---

## Illustration Style

### Visual Language

- **Abstract-geometric** — angular shapes, crystalline forms, energy lines, data streams. NOT cute characters, NOT realistic scenes.
- **Monochromatic + accent** — primarily `void-6` through `void-8` outlines/fills with `aether-4` accents. NOT multi-color, NOT brand-rainbow.
- **Line-based** — 2px stroke, rounded caps, consistent with the icon system. NOT solid-fill, NOT watercolor.
- **Isometric projection** — for any 3D-ish elements (servers, screens, databases), use 30° isometric. NOT perspective, NOT flat-side.

**Decision: Abstract-geometric over character-based.** Character illustrations would compete with anime artwork and risk stylistic dissonance (our style ≠ anime style). Geometric abstracts complement the sci-fi UI without pretending to be content.

### Color Palettes for Illustrations

| Palette | Colors | Usage |
|---------|--------|-------|
| Default | `void-6`, `void-7`, `void-8`, `aether-5` | Standard illustrations |
| Positive | `void-6`, `void-7`, `void-8`, `success` | Success states, completion |
| Negative | `void-6`, `void-7`, `void-8`, `error` | Error states, failure |
| Premium | `void-6`, `void-7`, `void-8`, `nova-5` | Premium features |

---

## Illustration Sizes

| Token | Size (px) | Usage |
|-------|-----------|-------|
| `illust-sm` | 120×120 | Inline empty states, toast illustrations |
| `illust-md` | 200×200 | Standard empty states, error pages |
| `illust-lg` | 320×320 | Onboarding screens, feature promotion |
| `illust-xl` | 480×480 | Full-page empty/error states, splash |

---

## Illustration Catalog

### Empty States

| Name | Description | Used When |
|------|-------------|-----------|
| `empty-watchlist` | Crystalline bookmark with floating particles | Watchlist has no items |
| `empty-search` | Magnifying glass with fractured lines | Search returns no results |
| `empty-history` | Clock face with no hands, dust particles | No watch history |
| `empty-notifications` | Bell with muted ripples | No notifications |
| `empty-comments` | Speech bubble with faded text lines | No comments on anime |
| `empty-episodes` | Film strip with transparent frames | No episodes available |
| `empty-genre` | Geometric shape dissolving | Genre has no anime |

### Error States

| Name | Description | Used When |
|------|-------------|-----------|
| `error-generic` | Circuit board with broken trace | Generic error |
| `error-network` | Signal tower with disconnected wave | Network failure |
| `error-404` | Doorway to void (angular) | Page not found |
| `error-500` | Server crystal with cracks | Server error |
| `error-rate-limit` | Hourglass with energy overflow | Rate limited |
| `error-auth` | Shield with access denied symbol | Authentication failure |
| `error-payment` | Card with rejected stamp | Payment declined |

### Onboarding

| Name | Description | Used When |
|------|-------------|-----------|
| `onboard-discover` | Eye with expanding data rings | Step 1: Discover anime |
| `onboard-watchlist` | Heart entering a crystal container | Step 2: Build watchlist |
| `onboard-stream` | Play button in energy field | Step 3: Start watching |
| `onboard-premium` | Crown with energy aura | Premium upsell |

### Functional

| Name | Description | Used When |
|------|-------------|-----------|
| `login-hero` | Portal frame with energy field | Login/signup hero |
| `maintenance` | Gear with pause symbol | Maintenance mode |
| `under-construction` | Crystalline structure assembling | Feature not yet available |

---

## Production Guidelines

### Format

| Aspect | Requirement |
|--------|-------------|
| Format | SVG (inline or `<img>`) for UI illustrations; PNG @1x/@2x for hero illustrations with raster effects |
| ViewBox | Based on size token (e.g., `0 0 200 200` for `illust-md`) |
| Stroke | 2px, matching icon system |
| Fill | Solid colors from design token palette only |
| Optimization | Run through SVGO with default preset; remove `<?xml>`, editor data, comments |
| Accessibility | Decorative (all current illustrations): `aria-hidden="true"` |
| Responsiveness | SVG `viewBox` handles this naturally; set `width`/`height` via token class |

### Animation

Illustrations can have **subtle idle animations** — floating particles, gentle glow pulses, slow rotation of geometric elements.

| Animation Type | Duration | Easing | Reduced Motion |
|---------------|----------|--------|----------------|
| Float (translateY oscillation) | 3000ms | `ease-in-out` | Disabled |
| Glow pulse (opacity oscillation) | 2000ms | `ease-in-out` | Disabled |
| Slow rotation (transform: rotate) | 6000ms | `linear` | Disabled |

**Decision: 3+ second idle animations.** Faster animation on idle illustrations becomes distracting. 3s+ makes the motion ambient rather than attention-grabbing.

---

## Illustration in Context

### Empty State Composition

```
┌──────────────────────────────┐
│                              │
│       ┌──────────┐           │
│       │          │           │
│       │ Illust.  │           │
│       │ (200px)  │           │
│       └──────────┘           │
│                              │
│     Your watchlist is empty  │  ← text-lg, semibold
│                              │
│  Start adding anime you      │  ← text-base, text-secondary
│  want to watch               │
│                              │
│     ┌──────────────────┐     │
│     │  Browse Anime    │     │  ← Primary CTA
│     └──────────────────┘     │
│                              │
└──────────────────────────────┘
```

- Illustration centered, `space-6` (24px) gap to heading
- Heading: `text-lg`, `weight-semibold`, `text-primary`
- Description: `text-base`, `text-secondary`, max 2 lines
- CTA: `space-4` (16px) gap below description

---

## Illustration Rules

1. **Illustrations are decorative** — `aria-hidden="true"`. They never convey information that isn't in adjacent text.
2. **Maximum 1 illustration per view** — multiple illustrations in one view creates illustration soup.
3. **Never use illustrations where content images exist.** An anime card uses its poster, not a placeholder illustration.
4. **Custom illustrations require design review.** They must match the abstract-geometric style and use only the approved color palette.
5. **No third-party illustration libraries** (unDraw, Storyset, Blush). Their styles don't match our visual language.
6. **Lazy-load illustrations** — they're below the fold in empty/error states. Use `next/dynamic` or `<img loading="lazy">`.
7. **SVG inline for small (≤200px), `<img>` for large.** Inline SVG renders immediately but adds to HTML size. For 480px illustrations, the SVG code is too large to inline.
8. **Total illustration SVG per page ≤ 10KB** (gzipped). Beyond this, use raster PNG.
