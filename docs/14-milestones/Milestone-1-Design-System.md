# M1 — Design System

## Objective

Implement the `@nexus/ui` design system as a production-ready, theme-driven component library that encodes the Nexus Anime visual identity: dark, premium, glassmorphic, Wuthering Waves inspired. This milestone delivers the complete token architecture (color, typography, spacing, blur, shadow, radius), the glassmorphism and motion systems, and a full set of reusable component primitives (Button, Input, Card, Badge, Dialog, etc.) with dark-mode support via a theme provider. At the end of M1, every UI component in the application has a single source of truth in `@nexus/ui`.

## Scope

- Token architecture: 3-tier system (global, semantic, component) in W3C Design Tokens format
- Color system: OKLCH base palettes (Void, Aether, Nova), semantic colors, glow presets, gradient presets, contrast validation
- Typography: Space Grotesk (display) + Inter (body), Major Third type scale (1.25), 5 weights, responsive scaling
- Spacing: 8px grid, 18-step scale, inset/stack/inline presets
- Grid: 12-column fluid grid, 6 breakpoints (xs–2xl), max content width 1200px
- Radius: 8-step scale, nested radius rule
- Shadows: 5 elevation levels, layered composition, glow+shadow combinations
- Blur: 4 backdrop-blur levels, 2 content-blur levels, 3-region performance budget
- Glassmorphism: 5-layer recipe, 5 variants (Standard, Frosted, Crystal, Tinted, Nova), responsive reduction
- Motion: duration scale, 7 easing curves, animation patterns, reduced-motion handling
- Icons: Lucide base + 21 custom icons, 6 size steps
- Component primitives: Button, Input, Card, Badge, Dialog, Tabs, Avatar, Skeleton, Tooltip, Dropdown, Select, Checkbox, Switch, Toast
- Theme provider: `data-theme` attribute on `<html>`, cookie-based preference resolution, high-contrast and forced-colors support
- Dark mode: single "Midnight" theme active; architecture supports future "Dawn" light theme
- Accessibility: WCAG 2.2 AA, focus ring spec, keyboard navigation, touch targets (44x44px)

Out of scope: application-specific composite components (e.g., AnimeCard, VideoPlayer chrome), page layouts, route structure.

## Deliverables

### D1 — Token Registry

`packages/ui/src/tokens/` containing JSONC token files implementing the 3-tier architecture:
- `colors.jsonc` — Void (13-step), Aether (8-step), Nova (6-step), semantic colors, glow presets, gradient presets
- `typography.jsonc` — font families, type scale (11 steps, base 14px), weights, letter spacing, responsive scaling
- `spacing.jsonc` — 8px grid scale, inset/stack/inline presets
- `radius.jsonc` — 8-step radius scale
- `shadow.jsonc` — 5 elevation levels with layered shadow compositions
- `blur.jsonc` — backdrop-blur and content-blur levels
- `motion.jsonc` — duration scale, easing curves, animation patterns

### D2 — CSS Custom Properties Generator

`packages/ui/src/lib/generate-css.ts` — a build step that reads the JSONC token files and emits `packages/ui/src/globals.css` with `:root` custom properties using `{alias}` resolution. Output is deterministic and committed to the repo.

### D3 — Tailwind Theme Extension

`packages/ui/src/tailwind.ts` — a Tailwind CSS 4 `@theme` block that maps every token tier to utility classes. This is the bridge between the token registry and Tailwind utility classes. All application code uses Tailwind utilities; no raw CSS custom properties in application components.

### D4 — Glassmorphism Utilities

`packages/ui/src/styles/glass.css` — implements the 5-layer glass recipe (border, background, backdrop-blur, shadow, content) as reusable CSS classes and Tailwind `@utility` directives. Includes all 5 variants (Standard, Frosted, Crystal, Tinted, Nova) and responsive reduction rules.

### D5 — Component Primitives

`packages/ui/src/components/` containing the following components, each with full variant support, accessibility attributes, and Tailwind-only styling:
- `Button` — variants: primary, secondary, ghost, destructive, outline; sizes: sm, md, lg; loading state with spinner
- `Input` — text, email, password, search; with label, helper text, error state, icon slot
- `Card` — with header, body, footer sections; glass variant support
- `Badge` — variants: default, success, warning, error, info; sizes: sm, md
- `Dialog` — modal and non-modal; with overlay, close button, focus trap
- `Tabs` — horizontal and vertical; with active indicator, keyboard navigation
- `Avatar` — image, initials, fallback; sizes: xs, sm, md, lg, xl
- `Skeleton` — text, circular, rectangular; shimmer animation
- `Tooltip` — top, bottom, left, right; with delay, focus trigger
- `Dropdown` — with divider items, icon slots, keyboard navigation
- `Select` — single select with search; native fallback on mobile
- `Checkbox` — with label, indeterminate state
- `Switch` — with label, on/off states
- `Toast` — with variant-specific styling, auto-dismiss, action slot

### D6 — Theme Provider

`packages/ui/src/components/ThemeProvider.tsx` — a client component that:
- Sets `data-theme` attribute on `<html>` based on cookie preference
- Reads preference from cookie, falls back to `prefers-color-scheme`, defaults to "midnight"
- Supports high-contrast and forced-colors media queries
- Exports `useTheme()` hook for reading current theme

### D7 — Design System Documentation

`docs/04-design-system/` containing 17 documents covering: README (index), Design Principles, Color System, Typography, Spacing, Grid, Radius, Shadows, Blur, Glassmorphism, Motion, Icons, Illustrations, Component Guidelines, Accessibility, Responsive System, Tokens, Theme.

### D8 — Design System Showcase

`apps/web/app/dev/components/page.tsx` — a development-only route that renders every component primitive in every variant, with copy-to-clipboard for class names and token values. Serves as visual regression reference and developer documentation.

## Prerequisites

- M0 (Foundation) is complete: repository exists, `package.json` and `pnpm-workspace.yaml` are configured.
- Node 22 LTS and pnpm 9.x are installed.
- Familiarity with Tailwind CSS 4 `@theme` and `@utility` directives.
- Familiarity with W3C Design Tokens Community Group format.

## Dependencies

- `packages/ui` — the `@nexus/ui` package must be initialized with its own `package.json`, `tsconfig.json`, and entry point before design system work begins.
- `packages/config-eslint` — ESLint config must be available for linting `@nexus/ui` source.
- `packages/config-typescript` — `tsconfig.base.json` must be available for strict TypeScript compilation.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Token drift between JSONC source and generated CSS** | Medium | High | The generator (`generate-css.ts`) is the single source of output; CI step verifies `globals.css` matches the generated output (checksum or `format:check`). |
| **Tailwind v4 `@theme` API instability** | Medium | High | Pin to a specific Tailwind v4 minor version; the `@theme` block is isolated in one file (`tailwind.ts`) so API changes are localized. |
| **Glassmorphism performance on low-end devices** | Medium | Medium | Implement the 3-region blur budget; use `opaque` fallback class for `prefers-reduced-motion`; test on Moto G Power before M1 closes. |
| **OKLCH color space browser support** | Low | Medium | Provide hex fallbacks in generated CSS (OKLCH first, then hex in a `@supports` block); Safari 15.4+ supports OKLCH. |
| **Component API inconsistency across primitives** | Medium | Medium | Define a shared `BaseComponentProps` interface (className, children, aria-*) before building any components; review all component APIs in a single PR. |
| **Accessibility audit reveals contrast failures** | Medium | High | Run contrast validation at token-design time (in the token spec), not at component-build time; the Color System doc includes a pre-computed contrast table. |

## Acceptance Criteria

1. `packages/ui/src/tokens/*.jsonc` contains all 7 token files with `$value` keys and `{alias}` references.
2. `pnpm --filter @nexus/ui generate` produces `packages/ui/src/globals.css` deterministically (re-running produces byte-identical output).
3. `packages/ui/src/tailwind.ts` exports a valid Tailwind CSS 4 `@theme` block that maps all token tiers to utility classes.
4. All 14 component primitives (Button, Input, Card, Badge, Dialog, Tabs, Avatar, Skeleton, Tooltip, Dropdown, Select, Checkbox, Switch, Toast) are exported from `packages/ui/src/index.ts`.
5. Every component supports `className` override and `aria-*` passthrough.
6. `ThemeProvider` correctly sets `data-theme` on `<html>` and reads preference from cookie.
7. `prefers-reduced-motion: reduce` disables all non-essential animations.
8. Glassmorphism components respect the 3-region blur budget (no more than 3 concurrent `backdrop-blur` regions).
9. All color pairings meet WCAG 2.2 AA contrast ratios (verified via the Color System contrast table).
10. Focus indicators are visible on all interactive elements (2px aether-4 ring, 2px offset).
11. Touch targets are >= 44x44px on all interactive elements.
12. `/dev/components` renders every component in every variant without console errors.
13. `pnpm --filter @nexus/ui build` succeeds with no TypeScript errors.
14. `pnpm typecheck` passes across the entire workspace.
15. `docs/04-design-system/` contains all 17 documents with accurate cross-references.

## QA Checklist

- [ ] Token JSONC files parse correctly (validate with `@design-tools/community-group` parser or similar).
- [ ] Generated `globals.css` is committed and matches the output of `pnpm --filter @nexus/ui generate`.
- [ ] All Tailwind utility classes derived from tokens work in a sample component (e.g., `bg-void-9`, `text-aether-4`, `p-3`).
- [ ] Every component renders correctly in the showcase page.
- [ ] Every component renders correctly with `data-theme="midnight"`.
- [ ] `prefers-color-scheme: light` does not break the layout (Midnight theme remains active; no flash).
- [ ] `prefers-reduced-motion: reduce` disables shimmer, dialog transitions, and tooltip animations.
- [ ] Keyboard navigation works through all interactive components (Tab, Enter, Escape, Arrow keys where applicable).
- [ ] Focus ring is visible on all interactive elements against the darkest background (`void-1`).
- [ ] Glass components render correctly in Firefox (verify `backdrop-filter` support or fallback).
- [ ] No `any` types in `packages/ui/src/`.
- [ ] No `ts-ignore` comments in `packages/ui/src/`.
- [ ] No global stylesheets outside `packages/ui/src/globals.css` and `packages/ui/src/styles/`.
- [ ] `pnpm lint` passes in `packages/ui/`.
- [ ] `pnpm test` passes in `packages/ui/` (if unit tests are present for generator logic).

## Estimated Tasks

| # | Task | Estimate | Owner | Dependencies |
|---|------|----------|-------|--------------|
| T1 | Initialize `packages/ui/` package structure (`package.json`, `tsconfig.json`, entry point) | 1h | Frontend | M0 complete |
| T2 | Write all 7 JSONC token files | 6h | Design + Frontend | T1 |
| T3 | Implement `generate-css.ts` (token-to-CSS custom properties) | 3h | Frontend | T2 |
| T4 | Implement `tailwind.ts` (Tailwind v4 `@theme` block) | 3h | Frontend | T2 |
| T5 | Implement `glass.css` (5-layer recipe, 5 variants, responsive reduction) | 2h | Frontend | T2 |
| T6 | Implement `ThemeProvider.tsx` and `useTheme` hook | 2h | Frontend | T1 |
| T7 | Implement Button component (all variants, loading state) | 2h | Frontend | T4, T5 |
| T8 | Implement Input component (all types, error state, icon slot) | 2h | Frontend | T4, T5 |
| T9 | Implement Card component (header, body, footer, glass variant) | 1.5h | Frontend | T4, T5 |
| T10 | Implement Badge component (all variants, sizes) | 1h | Frontend | T4 |
| T11 | Implement Dialog component (modal, focus trap, overlay) | 3h | Frontend | T4, T5 |
| T12 | Implement Tabs component (horizontal, vertical, keyboard nav) | 2.5h | Frontend | T4 |
| T13 | Implement Avatar component (image, initials, fallback) | 1.5h | Frontend | T4 |
| T14 | Implement Skeleton component (text, circular, rectangular, shimmer) | 1.5h | Frontend | T4, T5 |
| T15 | Implement Tooltip component (4 directions, delay, focus trigger) | 2h | Frontend | T4 |
| T16 | Implement Dropdown component (divider, icon slots, keyboard nav) | 2.5h | Frontend | T4 |
| T17 | Implement Select component (single, search, mobile fallback) | 3h | Frontend | T4 |
| T18 | Implement Checkbox and Switch components | 2h | Frontend | T4 |
| T19 | Implement Toast component (variants, auto-dismiss, action) | 2h | Frontend | T4 |
| T20 | Build `/dev/components` showcase page | 3h | Frontend | T7–T19 |
| T21 | Write `docs/04-design-system/` 17 documents | 8h | Design + Docs | T2–T6 |
| T22 | Accessibility audit (contrast, focus, keyboard, touch targets) | 3h | QA + Frontend | T20 |
| T23 | Performance audit (blur budget, paint count on glass surfaces) | 2h | Frontend | T20 |
| T24 | Cross-browser testing (Chrome, Firefox, Safari, Edge) | 2h | QA | T20 |
| T25 | Final typecheck, lint, and build verification | 1h | Frontend | T22–T24 |

**Total estimate: ~57 engineer-hours** (approximately 1.5 weeks for a single engineer, or 1 week for a design-system engineer + technical writer pair).

## Completion Checklist

- [ ] All deliverables (D1–D8) are present in the repository.
- [ ] All acceptance criteria (1–15) are met.
- [ ] QA checklist is fully checked off.
- [ ] `packages/ui/` builds successfully with no TypeScript errors.
- [ ] `/dev/components` is accessible in the development server.
- [ ] All 17 design system documents are published in `docs/04-design-system/`.
- [ ] No raw Tailwind class strings exist in `apps/web/` that duplicate `@nexus/ui` component functionality.
- [ ] Token generator is wired into the `pnpm build` pipeline for `@nexus/ui`.
- [ ] Milestone marked complete in GitHub Projects board.
- [ ] Branch `feature/m1-design-system` deleted after merge.
