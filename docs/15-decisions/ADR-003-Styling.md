# ADR-003 — Tailwind CSS 4 with Semantic Theme Tokens

- **Status:** accepted
- **Deciders:** Tech Lead, Senior Frontend Engineer, Design Lead
- **Date:** 2026-04-22
- **Supersedes:** None
- **Superseded by:** None
- **Related:** ADR-001
- **References:** docs/04-design-system/README.md, docs/04-design-system/Theme.md, docs/04-design-system/Tokens.md

## Context

Nexus Anime's visual identity is dark, cinematic, and glassmorphic — "a
portal, not a dashboard." The styling system must support this identity
while remaining maintainable across a growing component library and
accessible to a team that will rotate engineers in and out.

The forces at play were:

- **Design consistency.** Without a shared token system, every component
  invents its own colors, spacing, and blur values. Inconsistency
  accumulates and the product feels cobbled together.
- **Themeability.** The platform ships with one dark theme (Midnight) in v1,
  but the design team has signaled that a light theme (Dawn) and a
  high-contrast accessibility mode are on the roadmap. The token system
  must make adding a new theme a configuration change, not a component
  rewrite.
- **Performance.** Glassmorphism relies on `backdrop-blur`, which is
  expensive on mobile GPUs. The system must constrain blur usage to
  prevent jank on low-end devices.
- **Developer experience.** Engineers should be able to style components
  without consulting a designer for every spacing value or color choice.
  The system must make the right choice the easy choice.
- **Mobile-first.** The product must work at 380 px viewport width. The
  styling system must make responsive design natural, not an afterthought.

We considered three alternatives:

1. **CSS-in-JS (styled-components, Emotion).** Scoped styles, dynamic
   theming via React context. Rejected because: (a) CSS-in-JS adds runtime
   overhead (style recalculation on every render), which conflicts with
   our performance goals for catalog pages that render thousands of cards;
   (b) it breaks the React Server Component model — CSS-in-JS requires
   client-side hydration for styles to apply, which defeats our
   server-first rendering strategy; (c) it introduces a parallel styling
   language that new engineers must learn in addition to Tailwind.
2. **Vanilla CSS with BEM.** Full control, no build step overhead. Rejected
   because: (a) BEM naming is verbose and error-prone; (b) there is no
   built-in token system — consistency depends on discipline, not
   enforcement; (c) tree-shaking is manual (unused CSS accumulates).
3. **Tailwind CSS 3.** Mature, widely adopted. Rejected in favor of
   Tailwind CSS 4 because v4 introduces `@theme` (native CSS custom
   property-based theming), `@variant` (native variant composition), and
   a 3× faster build. The upgrade cost from v3 to v4 is real but
   one-time; staying on v3 would lock us out of these improvements.

## Decision

We use **Tailwind CSS 4** as the sole styling technology. There are no
CSS-in-JS libraries, no styled-components, no global stylesheets, and no
Sass. Every visual decision is expressed through Tailwind utility classes
or theme tokens defined in `@nexus/ui`.

### Theme tokens

All theme values are defined as CSS custom properties on `:root` using
Tailwind v4's `@theme` directive. Components never reference raw color
values, spacing, or blur radii — they reference semantic tokens:

```css
@theme {
  --color-surface-glass: oklch(14.5% 0.025 264 / 0.7);
  --color-text-primary: oklch(98% 0.01 264);
  --radius-card: 1rem;
  --blur-frosted: 16px;
}
```

Components use these as `bg-surface-glass`, `text-primary`, `rounded-card`,
`backdrop-blur-frosted`. If a designer changes `--color-surface-glass`,
every component that uses it updates automatically.

### Semantic token architecture

Tokens are organized in three layers:

1. **Palette** — raw OKLCH values (e.g. `--color-aether-500`). Components
   must never reference palette tokens.
2. **Semantic** — named roles (e.g. `--color-surface-glass`,
   `--color-text-primary`). Components reference semantic tokens only.
3. **Component** — scoped to a specific component (e.g.
   `--button-primary-bg`). Overrides of a single component.

This three-layer architecture means changing the theme (e.g. adding a
light Dawn theme) requires changing only the semantic layer. Palette and
component tokens stay the same.

### Runtime theming via `data-theme`

Theme is applied via a `data-theme` attribute on `<html>`, not a CSS
class. Components use variants:

```html
<html data-theme="midnight">
```

```html
<div class="bg-surface-glass">...</div>
```

The `data-theme` attribute is set on the server by reading a cookie, so
the first paint is theme-correct. There is no flash-of-wrong-theme.

### Glassmorphism constraints

- Maximum **3 blur regions** per viewport (GPU compositing budget for
  mobile).
- **5 named glass variants** in `@nexus/ui`: Standard, Frosted, Crystal,
  Tinted, Nova. Each is a pre-tuned combination of background opacity,
  blur radius, and border color. Components must use one of these five;
  ad-hoc `backdrop-blur-*` values are forbidden.
- Glass tuning is per-theme. Midnight uses high-opacity backgrounds
  (0.7+); Dawn will use lower opacity (0.4+) because blur over a light
  background produces a different visual effect.

### Animation policy

- **CSS transitions** for all micro-interactions (hover, focus, press).
- **Framer Motion** only for complex orchestration: page transitions,
  video player chrome, modal enter/exit sequences.
- Default easing: `cubic-bezier(0.22, 1, 0.36, 1)` (spring-like).

### Responsive design

Mobile-first. Every component is designed at 380 px first, then scaled
up. Breakpoints: `sm: 768px`, `md: 1024px`, `lg: 1440px`. We do not
target viewports narrower than 380 px.

### Single theme for v1

Only the Midnight theme ships in v1. The token architecture ensures that
adding Dawn later is a configuration change (new semantic token values for
`data-theme="dawn"`), not a component rewrite.

## Consequences

### Positive

- **Utility-first consistency.** Engineers do not invent spacing or
  color values. The design system constrains choices to the token set,
  which means the product looks consistent by default.
- **Fast development.** Tailwind's utility classes are composable
  directly in JSX. An engineer can style a component without leaving
  the file, without switching to a CSS file, and without inventing a
  class name.
- **Theme flexibility.** Adding a new theme (Dawn, Aurora
  high-contrast) requires defining a new set of semantic token values
  under `data-theme="..."`. No component code changes.
- **Performance.** No runtime style recalculation (unlike CSS-in-JS).
  The CSS bundle is purged at build time — only the utilities we use
  ship to the client.
- **Accessibility.** OKLCH color space gives us perceptual uniformity;
  we can calculate contrast ratios programmatically and enforce WCAG
  2.2 AA at the token level.

### Negative

- **Theme token lock-in.** The entire component library is coupled to
  the `--color-*`, `--radius-*`, `--blur-*` token names. Switching to
  CSS-in-JS later would require rewriting every component. We are
  committed to Tailwind for the foreseeable future.
  **Mitigation:** This is an acceptable trade-off. Tailwind is the
  industry standard for React applications. The probability of a
  future migration to CSS-in-JS is low, and the cost of the lock-in
  is outweighed by the consistency benefits.
- **Glassmorphism performance.** `backdrop-blur` is expensive. On
  low-end Android devices, animating a blurred surface causes jank.
  **Mitigation:** The 3-blur-region cap and the pre-tuned glass
  variants prevent runaway blur usage. We test on a Moto G Power
  (2022) as our performance floor.
- **Tailwind v4 migration risk.** Tailwind v4 is a major version with
  breaking changes from v3 (new config format, `@theme` instead of
  `tailwind.config.js`). The migration requires a focused effort.
  **Mitigation:** We allocate a dedicated milestone (M1) for the
  migration. We do not start component development until the
  migration is complete.
- **Learning curve for OKLCH.** Engineers must understand that
  `--color-aether-500` is a semantic name, not a literal color. This
  requires reading the token documentation.
  **Mitigation:** The three-layer token architecture is documented in
  `docs/04-design-system/Tokens.md`. The naming convention
  (`--color-{role}-{weight}`) is self-explanatory once the pattern is
  learned.
- **Single-theme limitation.** Midnight-only in v1 means users who
  prefer light mode cannot switch. This is a known gap.
  **Mitigation:** The token architecture makes Dawn cheap to add. We
  schedule it for M4 or M5, after the core product is stable.

### Compliance

- No CSS-in-JS imports. ESLint rule `nexus/no-css-in-js` rejects
  `styled-components`, `@emotion/styled`, and similar.
- Components must reference semantic tokens only. Direct palette usage
  is rejected by `nexus/no-palette-token`.
- Maximum 3 `backdrop-blur-*` utilities per rendered page. Violations
  are flagged in code review.
- Framer Motion is allowed only in `apps/web/src/components/video/`
  and `apps/web/src/components/transitions/`. Any other directory
  importing `framer-motion` is a CI error.
- All new themes must pass WCAG 2.2 AA contrast checks. Token values
  are validated in `packages/ui/src/theme/validate-contrast.ts`.
