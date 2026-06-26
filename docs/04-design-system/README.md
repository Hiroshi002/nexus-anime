# Design System — Nexus Anime

> The complete production-ready design system documentation for the Nexus Anime platform.

---

## Overview

This design system defines the visual language, interaction patterns, and token architecture for Nexus Anime — a premium anime streaming platform with a futuristic sci-fi fantasy interface inspired by AAA game launcher aesthetics.

**Design identity:** Dark, cinematic, glassmorphic, atmospheric — a portal, not a dashboard.

**Standard:** WCAG 2.2 Level AA compliance required for all features.

---

## Documents

| # | Document | Purpose |
|---|----------|---------|
| 1 | [Design-Principles](Design-Principles.md) | The 10 foundational principles governing every design decision |
| 2 | [Color-System](Color-System.md) | Base palette (Void, Aether, Nova), semantic tokens, glows, gradients, contrast validation |
| 3 | [Typography](Typography.md) | Font pairing (Space Grotesk + Inter), type scale (1.25 ratio), weights, number formatting |
| 4 | [Spacing](Spacing.md) | 8px spatial grid, scale (0–96px), inset/stack/inline presets, responsive scaling |
| 5 | [Grid-System](Grid-System.md) | 12-column fluid grid, breakpoints (640–1536px), container queries, auto-placement |
| 6 | [Radius](Radius.md) | Border-radius scale (0–9999px), component mapping, nesting rules |
| 7 | [Shadows](Shadows.md) | 5 elevation levels, layered box-shadow composition, inset shadows, performance constraints |
| 8 | [Blur](Blur.md) | Backdrop blur scale (4–32px), content blur, performance budget (3 regions), fallback strategy |
| 9 | [Glassmorphism](Glassmorphism.md) | The 5-layer glass recipe, 5 glass variants (Standard, Frosted, Crystal, Tinted, Nova), accessibility |
| 10 | [Motion](Motion.md) | Duration scale (50–1000ms), 7 easing curves, animation patterns, composite-only rule, reduced motion |
| 11 | [Icons](Icons.md) | Lucide base library + 21 custom icons, sizing (12–48px), styling, touch targets |
| 12 | [Illustrations](Illustrations.md) | Abstract-geometric style, catalog (empty/error/onboarding), production guidelines |
| 13 | [Component-Guidelines](Component-Guidelines.md) | Compound component pattern, state specifications (6 states), skeleton system, variant/size tables |
| 14 | [Accessibility](Accessibility.md) | WCAG 2.2 AA criteria, focus management, keyboard navigation, screen reader patterns |
| 15 | [Responsive-System](Responsive-System.md) | Mobile-first strategy, layout reflow patterns, navigation adaptation, device targets, performance budgets |
| 16 | [Tokens](Tokens.md) | Master token registry — global, semantic, and component tiers in JSON; implementation format |
| 17 | [Theme](Theme.md) | Midnight (dark) theme specification, CSS custom property strategy, theme switching architecture, future extensibility |

---

## Quick Reference

### Color

| Role | Token | Value |
|------|-------|-------|
| Page background | `surface-base` | `#0a0e1a` |
| Card background | `surface-raised` | `#111627` |
| Modal background | `surface-overlay` | `#171d30` |
| Primary text | `text-primary` | `#ecedf5` |
| Body text | `text-secondary` | `#a3aac6` |
| Primary accent | `action-primary-bg` | `#4199d8` |
| Premium accent | `action-accent-bg` | `#da44bc` |

### Typography

| Role | Font | Size | Weight |
|------|------|------|--------|
| Body text | Inter | 14px | 400 |
| Card title | Inter | 16px | 500 |
| Section heading | Space Grotesk | 22px | 600 |
| Page heading | Space Grotesk | 28px | 700 |
| Hero heading | Space Grotesk | 44px | 700 |

### Spacing

| Role | Value |
|------|-------|
| Intra-component gap | 8px |
| Inter-component gap | 12px |
| Card padding | 16px |
| Section margin | 32px |
| Hero padding | 80px |

### Key Ratios

| Property | Value |
|----------|-------|
| Type scale ratio | 1.25 (Major Third) |
| Spatial unit | 8px |
| Base font size | 14px |
| Default corner radius | 8px |
| Default animation duration | 250ms |
| Default easing | `cubic-bezier(0.22, 1, 0.36, 1)` (spring) |

---

## Cross-References

- **Color tokens** → defined in [Tokens.md](Tokens.md), documented in [Color-System.md](Color-System.md)
- **Glassmorphism** → uses blur from [Blur.md](Blur.md), shadows from [Shadows.md](Shadows.md), borders from [Radius.md](Radius.md)
- **Component states** → defined in [Component-Guidelines.md](Component-Guidelines.md), accessible per [Accessibility.md](Accessibility.md)
- **Responsive adaptation** → breakpoints in [Grid-System.md](Grid-System.md), patterns in [Responsive-System.md](Responsive-System.md)
- **Theme** → token values in [Theme.md](Theme.md), token structure in [Tokens.md](Tokens.md)
- **Motion** → durations and easings in [Motion.md](Motion.md), reduced-motion in [Accessibility.md](Accessibility.md)

---

## Design Decisions Summary

Every document in this system explains *why* behind each decision. Key decisions:

1. **OKLCH color space** — perceptual uniformity; hex as fallback for tooling
2. **Cool-shifted neutrals** — blue undertone (chroma 0.02, hue 260) for atmospheric depth
3. **Cyan-blue primary (Aether, hue 230)** — futuristic without being teal or corporate
4. **Violet-magenta accent (Nova, hue 310)** — premium channel, ≤10% of visible elements
5. **14px base font** — information density for catalog; generous line-height compensates
6. **8px spatial grid** — alignment with common screen widths; 4px half-unit for fine-tuning
7. **Layered box-shadow** — 2–3 layers per elevation for smooth, realistic depth
8. **3 blur-region cap** — GPU compositing budget for mobile performance
9. **5 glass variants** — Standard, Frosted, Crystal, Tinted, Nova for all surface contexts
10. **Spring easing default** — `cubic-bezier(0.22, 1, 0.36, 1)` for organic, premium motion
11. **CSS transitions by default** — Framer Motion only for page transitions and player chrome
12. **Lucide icons + 21 custom** — clean strokes, consistent weight, tree-shakeable
13. **Mobile-first, bottom tabs** — no hamburger menu, no hover-dependent UI
14. **Semantic token architecture** — components never reference palette values directly
15. **Midnight theme only for v1** — light theme architecturally feasible, not designed
