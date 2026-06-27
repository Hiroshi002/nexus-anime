# Tailwind CSS v4 Configuration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure Tailwind CSS v4 as the styling foundation for the entire Nexus Anime monorepo — CSS-first config, design-token namespace, dark-mode variant, production pruning.

**Architecture:** Tailwind v4's CSS-first configuration. A single global stylesheet at `apps/web/src/app/globals.css` serves as the Tailwind entry point via `@import "tailwindcss"`. Design tokens are registered as CSS custom properties on `:root` inside the `@theme` block using our `--nexus-*` namespace from the design system docs. Dark mode uses a `@custom-variant dark` targeting `[data-theme="midnight"]` (attribute selector on `<html>`) rather than the media-query default — matching the project's `data-theme` architecture in `Theme.md`. No `tailwind.config.js` or PostCSS config is needed; `@tailwindcss/postcss` is auto-detected by Next.js 16's built-in Tailwind support. The `@nexus/ui` package exports a `tailwind.config.ts`-compatible reference so the design system stays the single source of truth.

**Tech Stack:** Tailwind CSS v4, React 19, Next.js 16, CSS Custom Properties, OKLCH colors

## Global Constraints

- Tailwind v4 CSS-first config only — no legacy `tailwind.config.js`
- Dark mode strategy: `data-theme` attribute on `<html>` element (per `Theme.md`)
- All design tokens use `--nexus-*` CSS custom property namespace (per `Tokens.md`)
- Token format: OKLCH values with hex fallback in comments (per `Color-System.md`)
- Default theme is "Midnight" — no theme attribute needed for default behavior
- No raw color values in components — all references go through semantic tokens
- `@nexus/ui` is the source of truth for design tokens
- Strict TypeScript mode — no `any`
- Tailwind v4 with `@tailwindcss/postcss` for Next.js integration

---

## File Map

| Action  | File                                      | Responsibility                                                                                                                       |
| ------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Create  | `packages/ui/src/tokens/colors.css`       | Global color palette (Void, Aether, Nova, semantic) as `--nexus-*` CSS custom properties                                             |
| Create  | `packages/ui/src/tokens/theme.css`        | Semantic token layer (surface, text, border, action) + `.dark` variant                                                               |
| Create  | `packages/ui/src/tokens/spacing.css`      | Spatial scale (`--nexus-space-*`)                                                                                                    |
| Create  | `packages/ui/src/tokens/radius.css`       | Border-radius scale (`--nexus-radius-*`)                                                                                             |
| Create  | `packages/ui/src/tokens/shadows.css`      | Elevation shadows (`--nexus-shadow-*`)                                                                                               |
| Create  | `packages/ui/src/tokens/blur.css`         | Backdrop-blur scale (`--nexus-blur-*`)                                                                                               |
| Create  | `packages/ui/src/tokens/motion.css`       | Duration and easing (`--nexus-duration-*`, `--nexus-ease-*`)                                                                         |
| Create  | `packages/ui/src/tokens/typography.css`   | Font families, sizes, weights                                                                                                        |
| Create  | `packages/ui/src/tokens/colors.light.css` | Light theme placeholder (future — commented out)                                                                                     |
| Create  | `packages/ui/src/tailwind/index.ts`       | Re-exports token files as a single import for globals.css                                                                            |
| Modify  | `packages/ui/src/index.ts`                | Add token barrel exports                                                                                                             |
| Modify  | `packages/ui/package.json`                | Add peer dependency on `tailwindcss`                                                                                                 |
| Rewrite | `apps/web/src/app/globals.css`            | Tailwind entry point with `@import "tailwindcss"` + `@import "@nexus/ui/tailwind"` + `@theme` block importing all `--nexus-*` tokens |
| Create  | `apps/web/src/tailwind.css`               | (Optional) Local overrides — empty for now, reserved                                                                                 |
| Modify  | `apps/web/src/app/page.tsx`               | Add Tailwind utility class on a test element (temporary) for verification                                                            |
| Verify  | `pnpm build`                              | Tailwind compiles without errors                                                                                                     |

---

## Tasks

### Task 1: Install Tailwind CSS v4 dependencies

**Files:**

- Modify: `apps/web/package.json` (add `tailwindcss` and `@tailwindcss/postcss` as devDependencies)
- Modify: `package.json` (root — add `tailwindcss` for the `@nexus/ui` package)

**Interfaces:**

- Consumes: nothing
- Produces: tailwindcss@4.x and @tailwindcss/postcss@4.x available in node_modules

**Steps:**

- [ ] **Step 1: Add Tailwind v4 to apps/web**

Modify `apps/web/package.json` to add:

```jsonc
{
  "name": "@nexus/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "lint:fix": "eslint --fix .",
    "typecheck": "tsc --noEmit",
    "test": "echo \"no tests\" && exit 0",
    "clean": "rm -rf .next",
  },
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
  },
  "devDependencies": {
    "@nexus/eslint-config": "workspace:*",
    "@nexus/ui": "workspace:*",
    "@tailwindcss/postcss": "^4.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "eslint": "^9.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "typescript-eslint": "^8.0.0",
  },
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd /workspaces/nexus-anime && pnpm install
```

Expected output: No errors. Confirm `tailwindcss` is installed:

```bash
ls node_modules/tailwindcss/package.json
cat node_modules/tailwindcss/package.json | jq .version  # Should show 4.x.x
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git -C /workspaces/nexus-anime commit -m "chore(web): install tailwindcss v4 and @tailwindcss/postcss"
```

---

### Task 2: Create design token CSS files in @nexus/ui

**Files:**

- Create: `packages/ui/src/tokens/colors.css`
- Create: `packages/ui/src/tokens/theme.css`
- Create: `packages/ui/src/tokens/spacing.css`
- Create: `packages/ui/src/tokens/radius.css`
- Create: `packages/ui/src/tokens/shadows.css`
- Create: `packages/ui/src/tokens/blur.css`
- Create: `packages/ui/src/tokens/motion.css`
- Create: `packages/ui/src/tokens/typography.css`
- Create: `packages/ui/src/tokens/colors.light.css`

**Interfaces:**

- Consumes: design system docs (`Tokens.md`, `Theme.md`, `Color-System.md`, `Spacing.md`, `Radius.md`, `Shadows.md`, `Blur.md`, `Motion.md`, `Typography.md`)
- Produces: CSS custom properties on `:root` with `--nexus-*` namespace

**Steps:**

- [ ] **Step 1: Create `packages/ui/src/tokens/colors.css`**

```css
/* @nexus/ui — Global color palette (Void, Aether, Nova, semantic) */
/* Values from docs/04-design-system/Color-System.md and Tokens.md */

:root {
  /* Void — neutral cool-shifted scale */
  --nexus-void-0: oklch(0.02 0.01 260);
  --nexus-void-0-hex: #050810;
  --nexus-void-1: oklch(0.06 0.02 260);
  --nexus-void-1-hex: #0a0e1a;
  --nexus-void-2: oklch(0.1 0.02 260);
  --nexus-void-2-hex: #111627;
  --nexus-void-3: oklch(0.14 0.02 260);
  --nexus-void-3-hex: #171d30;
  --nexus-void-4: oklch(0.18 0.02 260);
  --nexus-void-4-hex: #1c2338;
  --nexus-void-5: oklch(0.22 0.02 260);
  --nexus-void-5-hex: #222840;
  --nexus-void-6: oklch(0.28 0.02 260);
  --nexus-void-6-hex: #2d3450;
  --nexus-void-7: oklch(0.35 0.02 260);
  --nexus-void-7-hex: #3a4160;
  --nexus-void-8: oklch(0.45 0.02 260);
  --nexus-void-8-hex: #505876;
  --nexus-void-9: oklch(0.6 0.02 260);
  --nexus-void-9-hex: #747c9e;
  --nexus-void-10: oklch(0.75 0.02 260);
  --nexus-void-10-hex: #a3aac6;
  --nexus-void-11: oklch(0.88 0.01 260);
  --nexus-void-11-hex: #cdd1e2;
  --nexus-void-12: oklch(0.95 0.005 260);
  --nexus-void-12-hex: #ecedf5;

  /* Aether — primary cyan-blue */
  --nexus-aether-1: oklch(0.3 0.1 230);
  --nexus-aether-1-hex: #1a4a6b;
  --nexus-aether-2: oklch(0.4 0.12 230);
  --nexus-aether-2-hex: #2563a0;
  --nexus-aether-3: oklch(0.5 0.14 230);
  --nexus-aether-3-hex: #3380c4;
  --nexus-aether-4: oklch(0.6 0.15 230);
  --nexus-aether-4-hex: #4199d8;
  --nexus-aether-5: oklch(0.7 0.15 230);
  --nexus-aether-5-hex: #5bb2ea;
  --nexus-aether-6: oklch(0.8 0.12 230);
  --nexus-aether-6-hex: #82c7f5;
  --nexus-aether-7: oklch(0.9 0.08 230);
  --nexus-aether-7-hex: #b0ddfa;
  --nexus-aether-8: oklch(0.95 0.04 230);
  --nexus-aether-8-hex: #daedfc;

  /* Nova — accent violet-magenta */
  --nexus-nova-1: oklch(0.3 0.12 310);
  --nexus-nova-1-hex: #6b1a5e;
  --nexus-nova-2: oklch(0.45 0.15 310);
  --nexus-nova-2-hex: #a0258a;
  --nexus-nova-3: oklch(0.55 0.16 310);
  --nexus-nova-3-hex: #c033a5;
  --nexus-nova-4: oklch(0.65 0.15 310);
  --nexus-nova-4-hex: #da44bc;
  --nexus-nova-5: oklch(0.75 0.13 310);
  --nexus-nova-5-hex: #ec66d4;
  --nexus-nova-6: oklch(0.85 0.1 310);
  --nexus-nova-6-hex: #f494e4;

  /* Semantic colors */
  --nexus-success: oklch(0.65 0.18 150);
  --nexus-success-hex: #22c55e;
  --nexus-success-muted: oklch(0.4 0.08 150);
  --nexus-success-muted-hex: #166534;
  --nexus-warning: oklch(0.75 0.16 85);
  --nexus-warning-hex: #f59e0b;
  --nexus-warning-muted: oklch(0.45 0.08 85);
  --nexus-warning-muted-hex: #92400e;
  --nexus-error: oklch(0.6 0.2 25);
  --nexus-error-hex: #ef4444;
  --nexus-error-muted: oklch(0.35 0.1 25);
  --nexus-error-muted-hex: #7f1d1d;
  --nexus-info: oklch(0.6 0.15 230);
  --nexus-info-hex: #4199d8;

  /* Specialty */
  --nexus-platinum: oklch(0.85 0.02 80);
  --nexus-platinum-hex: #d4cfc4;
  --nexus-gold: oklch(0.8 0.12 85);
  --nexus-gold-hex: #d4a017;
  --nexus-streaming-live: oklch(0.65 0.22 25);
  --nexus-streaming-live-hex: #e53e3e;
}
```

- [ ] **Step 2: Create `packages/ui/src/tokens/theme.css`**

```css
/* @nexus/ui — Semantic color tokens (surface, text, border, action) */
/* Values from docs/04-design-system/Theme.md and Color-System.md */

:root,
[data-theme="midnight"] {
  /* Surfaces */
  --nexus-surface-base: var(--nexus-void-1);
  --nexus-surface-raised: var(--nexus-void-2);
  --nexus-surface-overlay: var(--nexus-void-3);
  --nexus-surface-elevated: var(--nexus-void-4);
  --nexus-surface-floating: var(--nexus-void-5);
  --nexus-surface-sunken: var(--nexus-void-0);

  /* Text */
  --nexus-text-primary: var(--nexus-void-12);
  --nexus-text-secondary: var(--nexus-void-10);
  --nexus-text-tertiary: var(--nexus-void-9);
  --nexus-text-placeholder: var(--nexus-void-8);
  --nexus-text-disabled: var(--nexus-void-7);
  --nexus-text-on-accent: var(--nexus-void-1);
  --nexus-text-inverse: var(--nexus-void-1);

  /* Borders */
  --nexus-border-subtle: var(--nexus-void-6);
  --nexus-border-default: var(--nexus-void-7);
  --nexus-border-strong: var(--nexus-void-8);
  --nexus-border-accent: var(--nexus-aether-4);

  /* Actions */
  --nexus-action-primary-bg: var(--nexus-aether-4);
  --nexus-action-primary-hover: var(--nexus-aether-3);
  --nexus-action-primary-pressed: var(--nexus-aether-2);
  --nexus-action-primary-text: var(--nexus-void-1);
  --nexus-action-secondary-bg: var(--nexus-void-3);
  --nexus-action-secondary-hover: var(--nexus-void-4);
  --nexus-action-secondary-text: var(--nexus-void-11);
  --nexus-action-ghost-hover: var(--nexus-void-3);
  --nexus-action-accent-bg: var(--nexus-nova-4);
  --nexus-action-accent-text: var(--nexus-void-1);

  /* Glows */
  --nexus-glow-sm: 0 0 8px oklch(0.6 0.15 230 / 0.25);
  --nexus-glow-md: 0 0 16px oklch(0.6 0.15 230 / 0.2);
  --nexus-glow-lg: 0 0 24px oklch(0.6 0.15 230 / 0.15);
  --nexus-glow-xl: 0 0 40px oklch(0.6 0.15 230 / 0.1);
  --nexus-glow-nova-sm: 0 0 8px oklch(0.65 0.15 310 / 0.25);
  --nexus-glow-nova-md: 0 0 16px oklch(0.65 0.15 310 / 0.2);

  /* Gradients */
  --nexus-gradient-surface: linear-gradient(180deg, var(--nexus-void-2), var(--nexus-void-1));
  --nexus-gradient-hero: radial-gradient(
    ellipse at 50% 0%,
    oklch(0.7 0.15 230 / 0.15),
    transparent 70%
  );
  --nexus-gradient-overlay: linear-gradient(180deg, transparent 50%, var(--nexus-void-1));
  --nexus-gradient-accent: linear-gradient(135deg, var(--nexus-aether-4), var(--nexus-nova-4));
  --nexus-gradient-shine: linear-gradient(
    135deg,
    transparent 40%,
    oklch(0.88 0.01 260 / 0.05) 50%,
    transparent 60%
  );
}
```

- [ ] **Step 3: Create `packages/ui/src/tokens/spacing.css`**

```css
/* @nexus/ui — Spatial scale */
/* Values from docs/04-design-system/Spacing.md and Tokens.md */

:root {
  --nexus-space-0: 0px;
  --nexus-space-0_5: 2px;
  --nexus-space-1: 4px;
  --nexus-space-1_5: 6px;
  --nexus-space-2: 8px;
  --nexus-space-2_5: 10px;
  --nexus-space-3: 12px;
  --nexus-space-3_5: 14px;
  --nexus-space-4: 16px;
  --nexus-space-5: 20px;
  --nexus-space-6: 24px;
  --nexus-space-7: 28px;
  --nexus-space-8: 32px;
  --nexus-space-9: 36px;
  --nexus-space-10: 40px;
  --nexus-space-12: 48px;
  --nexus-space-16: 64px;
  --nexus-space-20: 80px;
  --nexus-space-24: 96px;
}
```

- [ ] **Step 4: Create `packages/ui/src/tokens/radius.css`**

```css
/* @nexus/ui — Border radius scale */
/* Values from docs/04-design-system/Radius.md and Tokens.md */

:root {
  --nexus-radius-0: 0px;
  --nexus-radius-1: 2px;
  --nexus-radius-2: 4px;
  --nexus-radius-3: 6px;
  --nexus-radius-4: 8px;
  --nexus-radius-5: 12px;
  --nexus-radius-6: 16px;
  --nexus-radius-full: 9999px;
}
```

- [ ] **Step 5: Create `packages/ui/src/tokens/shadows.css`**

```css
/* @nexus/ui — Elevation shadows */
/* Values from docs/04-design-system/Shadows.md and Theme.md */

:root {
  --nexus-shadow-0: none;
  --nexus-shadow-1: 0 1px 2px 0 oklch(0.02 0.01 260 / 0.3), 0 1px 3px 0 oklch(0.02 0.01 260 / 0.15);
  --nexus-shadow-2: 0 2px 4px 0 oklch(0.02 0.01 260 / 0.35), 0 4px 8px 0 oklch(0.02 0.01 260 / 0.2);
  --nexus-shadow-3:
    0 4px 6px 0 oklch(0.02 0.01 260 / 0.4), 0 8px 16px 0 oklch(0.02 0.01 260 / 0.25),
    0 2px 4px 0 oklch(0.02 0.01 260 / 0.15);
  --nexus-shadow-4:
    0 8px 12px 0 oklch(0.02 0.01 260 / 0.45), 0 16px 32px 0 oklch(0.02 0.01 260 / 0.3),
    0 4px 8px 0 oklch(0.02 0.01 260 / 0.2);
}
```

- [ ] **Step 6: Create `packages/ui/src/tokens/blur.css`**

```css
/* @nexus/ui — Backdrop blur scale */
/* Values from docs/04-design-system/Blur.md and Tokens.md */

:root {
  --nexus-blur-xs: 4px;
  --nexus-blur-sm: 8px;
  --nexus-blur-md: 16px;
  --nexus-blur-lg: 24px;
  --nexus-blur-xl: 32px;
  --nexus-blur-content-sm: 8px;
  --nexus-blur-content-md: 20px;
}
```

- [ ] **Step 7: Create `packages/ui/src/tokens/motion.css`**

```css
/* @nexus/ui — Duration and easing */
/* Values from docs/04-design-system/Motion.md and Tokens.md */

:root {
  --nexus-duration-0: 0ms;
  --nexus-duration-50: 50ms;
  --nexus-duration-100: 100ms;
  --nexus-duration-150: 150ms;
  --nexus-duration-200: 200ms;
  --nexus-duration-250: 250ms;
  --nexus-duration-350: 350ms;
  --nexus-duration-500: 500ms;
  --nexus-duration-700: 700ms;
  --nexus-duration-1000: 1000ms;

  --nexus-ease-linear: cubic-bezier(0, 0, 1, 1);
  --nexus-ease-in: cubic-bezier(0.4, 0, 1, 1);
  --nexus-ease-out: cubic-bezier(0, 0, 0.2, 1);
  --nexus-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --nexus-ease-spring: cubic-bezier(0.22, 1, 0.36, 1);
  --nexus-ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
  --nexus-ease-sluggish: cubic-bezier(0.5, 0, 0.3, 1);
}
```

- [ ] **Step 8: Create `packages/ui/src/tokens/typography.css`**

```css
/* @nexus/ui — Typography */
/* Values from docs/04-design-system/Typography.md and Tokens.md */

:root {
  --nexus-font-display: "Space Grotesk", system-ui, -apple-system, sans-serif;
  --nexus-font-body: "Inter", system-ui, -apple-system, sans-serif;

  /* Text sizes */
  --nexus-text-xs: 11px;
  --nexus-text-sm: 12px;
  --nexus-text-base: 14px;
  --nexus-text-md: 16px;
  --nexus-text-lg: 18px;
  --nexus-text-xl: 22px;
  --nexus-text-2xl: 28px;
  --nexus-text-3xl: 35px;
  --nexus-text-4xl: 44px;
  --nexus-text-5xl: 55px;
  --nexus-text-6xl: 69px;

  /* Tracking */
  --nexus-tracking-tight: -0.02em;
  --nexus-tracking-normal: 0;
  --nexus-tracking-wide: 0.02em;
  --nexus-tracking-wider: 0.06em;
  --nexus-tracking-widest: 0.12em;

  /* Icon sizes */
  --nexus-icon-xs: 12px;
  --nexus-icon-sm: 16px;
  --nexus-icon-md: 20px;
  --nexus-icon-lg: 24px;
  --nexus-icon-xl: 32px;
  --nexus-icon-2xl: 48px;
}
```

- [ ] **Step 9: Create `packages/ui/src/tokens/colors.light.css`**

```css
/* @nexus/ui — Light theme placeholder (Dawn) */
/* Not implemented. Architecturally reserved for future theme. */
/* Uncomment when Dawn theme is designed. */

/*
[data-theme="dawn"] {
  --nexus-void-1: oklch(0.95 0.005 260);
  --nexus-void-2: oklch(0.98 0.002 260);
  --nexus-void-12: oklch(0.10 0.02 260);
  --nexus-void-10: oklch(0.25 0.02 260);
  --nexus-surface-base: var(--nexus-void-1);
  --nexus-surface-raised: var(--nexus-void-2);
  --nexus-text-primary: var(--nexus-void-12);
  --nexus-text-secondary: var(--nexus-void-10);
}
*/
```

- [ ] **Step 10: Commit**

```bash
git add packages/ui/src/tokens/
git -C /workspaces/nexus-anime commit -m "feat(ui): add design token CSS files for Tailwind v4"
```

---

### Task 3: Create @nexus/ui Tailwind entry point

**Files:**

- Create: `packages/ui/src/tailwind/index.ts`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**

- Consumes: all token CSS files from Task 2
- Produces: a single barrel import that `globals.css` can reference

**Steps:**

- [ ] **Step 1: Create `packages/ui/src/tailwind/index.ts`**

```typescript
/**
 * @nexus/ui Tailwind entry point.
 *
 * Import this module in globals.css via `@import "@nexus/ui/tailwind"` to
 * pull all design tokens into the Tailwind v4 @theme context.
 *
 * The token files use CSS custom properties on :root — Tailwind v4 picks
 * them up automatically when they are in the import graph.
 */
export {} from "../tokens/colors.css";
export {} from "../tokens/theme.css";
export {} from "../tokens/spacing.css";
export {} from "../tokens/radius.css";
export {} from "../tokens/shadows.css";
export {} from "../tokens/blur.css";
export {} from "../tokens/motion.css";
export {} from "../tokens/typography.css";
```

Wait — CSS imports in TypeScript need a different approach. Let me correct this.

**Correction:** Tailwind v4's `@import` resolves CSS files directly. We don't need a TypeScript barrel. Instead, we create a single CSS barrel file.

- [ ] **Step 1 (corrected): Create `packages/ui/src/tailwind.css`**

```css
/* @nexus/ui — Tailwind entry point */
/* Import this file in globals.css via @import "@nexus/ui/tailwind" */

@import "./tokens/colors.css";
@import "./tokens/theme.css";
@import "./tokens/spacing.css";
@import "./tokens/radius.css";
@import "./tokens/shadows.css";
@import "./tokens/blur.css";
@import "./tokens/motion.css";
@import "./tokens/typography.css";
```

- [ ] **Step 2: Update `packages/ui/src/index.ts`**

```typescript
// @nexus/ui — design system primitives (Tailwind 4 + React 19)
// Placeholder module; components land in later milestones.

export { type TailwindConfig } from "./types";
export {};
```

Actually, let's keep it simpler. The index.ts is a placeholder for future React components. We don't need to modify it for Tailwind tokens — they're CSS-only.

- [ ] **Step 2 (corrected): Leave `packages/ui/src/index.ts` unchanged**

The Tailwind entry point is a CSS file, not a TypeScript export. No changes needed to `index.ts`.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/tailwind.css
git -C /workspaces/nexus-anime commit -m "feat(ui): add Tailwind CSS entry point barrel"
```

---

### Task 4: Rewrite globals.css as Tailwind v4 entry point

**Files:**

- Rewrite: `apps/web/src/app/globals.css`

**Interfaces:**

- Consumes: `@nexus/ui/tailwind` (Task 3)
- Produces: a single CSS file that imports Tailwind and all design tokens

**Steps:**

- [ ] **Step 1: Rewrite `apps/web/src/app/globals.css`**

```css
/* Tailwind CSS v4 — entry point */
/* Design tokens from @nexus/ui are pulled in via @import below. */

@import "tailwindcss";
@import "@nexus/ui/tailwind";

/* Tailwind v4 @theme block — registers our design tokens as Tailwind utilities. */
/* Each --nexus-* custom property becomes a utility class (e.g. bg-surface-base). */

@theme {
  /* Colors — Void */
  --color-void-0: var(--nexus-void-0);
  --color-void-1: var(--nexus-void-1);
  --color-void-2: var(--nexus-void-2);
  --color-void-3: var(--nexus-void-3);
  --color-void-4: var(--nexus-void-4);
  --color-void-5: var(--nexus-void-5);
  --color-void-6: var(--nexus-void-6);
  --color-void-7: var(--nexus-void-7);
  --color-void-8: var(--nexus-void-8);
  --color-void-9: var(--nexus-void-9);
  --color-void-10: var(--nexus-void-10);
  --color-void-11: var(--nexus-void-11);
  --color-void-12: var(--nexus-void-12);

  /* Colors — Aether */
  --color-aether-1: var(--nexus-aether-1);
  --color-aether-2: var(--nexus-aether-2);
  --color-aether-3: var(--nexus-aether-3);
  --color-aether-4: var(--nexus-aether-4);
  --color-aether-5: var(--nexus-aether-5);
  --color-aether-6: var(--nexus-aether-6);
  --color-aether-7: var(--nexus-aether-7);
  --color-aether-8: var(--nexus-aether-8);

  /* Colors — Nova */
  --color-nova-1: var(--nexus-nova-1);
  --color-nova-2: var(--nexus-nova-2);
  --color-nova-3: var(--nexus-nova-3);
  --color-nova-4: var(--nexus-nova-4);
  --color-nova-5: var(--nexus-nova-5);
  --color-nova-6: var(--nexus-nova-6);

  /* Semantic colors */
  --color-success: var(--nexus-success);
  --color-success-muted: var(--nexus-success-muted);
  --color-warning: var(--nexus-warning);
  --color-warning-muted: var(--nexus-warning-muted);
  --color-error: var(--nexus-error);
  --color-error-muted: var(--nexus-error-muted);
  --color-info: var(--nexus-info);

  /* Specialty */
  --color-platinum: var(--nexus-platinum);
  --color-gold: var(--nexus-gold);
  --color-streaming-live: var(--nexus-streaming-live);

  /* Semantic surface colors */
  --color-surface-base: var(--nexus-surface-base);
  --color-surface-raised: var(--nexus-surface-raised);
  --color-surface-overlay: var(--nexus-surface-overlay);
  --color-surface-elevated: var(--nexus-surface-elevated);
  --color-surface-floating: var(--nexus-surface-floating);
  --color-surface-sunken: var(--nexus-surface-sunken);

  /* Semantic text colors */
  --color-text-primary: var(--nexus-text-primary);
  --color-text-secondary: var(--nexus-text-secondary);
  --color-text-tertiary: var(--nexus-text-tertiary);
  --color-text-placeholder: var(--nexus-text-placeholder);
  --color-text-disabled: var(--nexus-text-disabled);
  --color-text-on-accent: var(--nexus-text-on-accent);
  --color-text-inverse: var(--nexus-text-inverse);

  /* Border colors */
  --color-border-subtle: var(--nexus-border-subtle);
  --color-border-default: var(--nexus-border-default);
  --color-border-strong: var(--nexus-border-strong);
  --color-border-accent: var(--nexus-border-accent);

  /* Action colors */
  --color-action-primary-bg: var(--nexus-action-primary-bg);
  --color-action-primary-hover: var(--nexus-action-primary-hover);
  --color-action-primary-pressed: var(--nexus-action-primary-pressed);
  --color-action-primary-text: var(--nexus-action-primary-text);
  --color-action-secondary-bg: var(--nexus-action-secondary-bg);
  --color-action-secondary-hover: var(--nexus-action-secondary-hover);
  --color-action-secondary-text: var(--nexus-action-secondary-text);
  --color-action-ghost-hover: var(--nexus-action-ghost-hover);
  --color-action-accent-bg: var(--nexus-action-accent-bg);
  --color-action-accent-text: var(--nexus-action-accent-text);

  /* Shadows */
  --shadow-0: var(--nexus-shadow-0);
  --shadow-1: var(--nexus-shadow-1);
  --shadow-2: var(--nexus-shadow-2);
  --shadow-3: var(--nexus-shadow-3);
  --shadow-4: var(--nexus-shadow-4);

  /* Blur */
  --blur-xs: var(--nexus-blur-xs);
  --blur-sm: var(--nexus-blur-sm);
  --blur-md: var(--nexus-blur-md);
  --blur-lg: var(--nexus-blur-lg);
  --blur-xl: var(--nexus-blur-xl);

  /* Spacing */
  --spacing-0: var(--nexus-space-0);
  --spacing-0_5: var(--nexus-space-0_5);
  --spacing-1: var(--nexus-space-1);
  --spacing-1_5: var(--nexus-space-1_5);
  --spacing-2: var(--nexus-space-2);
  --spacing-2_5: var(--nexus-space-2_5);
  --spacing-3: var(--nexus-space-3);
  --spacing-3_5: var(--nexus-space-3_5);
  --spacing-4: var(--nexus-space-4);
  --spacing-5: var(--nexus-space-5);
  --spacing-6: var(--nexus-space-6);
  --spacing-7: var(--nexus-space-7);
  --spacing-8: var(--nexus-space-8);
  --spacing-9: var(--nexus-space-9);
  --spacing-10: var(--nexus-space-10);
  --spacing-12: var(--nexus-space-12);
  --spacing-16: var(--nexus-space-16);
  --spacing-20: var(--nexus-space-20);
  --spacing-24: var(--nexus-space-24);

  /* Border radius */
  --radius-0: var(--nexus-radius-0);
  --radius-1: var(--nexus-radius-1);
  --radius-2: var(--nexus-radius-2);
  --radius-3: var(--nexus-radius-3);
  --radius-4: var(--nexus-radius-4);
  --radius-5: var(--nexus-radius-5);
  --radius-6: var(--nexus-radius-6);
  --radius-full: var(--nexus-radius-full);

  /* Typography */
  --font-display: var(--nexus-font-display);
  --font-body: var(--nexus-font-body);

  --text-xs: var(--nexus-text-xs);
  --text-sm: var(--nexus-text-sm);
  --text-base: var(--nexus-text-base);
  --text-md: var(--nexus-text-md);
  --text-lg: var(--nexus-text-lg);
  --text-xl: var(--nexus-text-xl);
  --text-2xl: var(--nexus-text-2xl);
  --text-3xl: var(--nexus-text-3xl);
  --text-4xl: var(--nexus-text-4xl);
  --text-5xl: var(--nexus-text-5xl);
  --text-6xl: var(--nexus-text-6xl);

  --tracking-tight: var(--nexus-tracking-tight);
  --tracking-normal: var(--nexus-tracking-normal);
  --tracking-wide: var(--nexus-tracking-wide);
  --tracking-wider: var(--nexus-tracking-wider);
  --tracking-widest: var(--nexus-tracking-widest);

  /* Duration */
  --duration-0: var(--nexus-duration-0);
  --duration-50: var(--nexus-duration-50);
  --duration-100: var(--nexus-duration-100);
  --duration-150: var(--nexus-duration-150);
  --duration-200: var(--nexus-duration-200);
  --duration-250: var(--nexus-duration-250);
  --duration-350: var(--nexus-duration-350);
  --duration-500: var(--nexus-duration-500);
  --duration-700: var(--nexus-duration-700);
  --duration-1000: var(--nexus-duration-1000);

  /* Easing */
  --ease-linear: var(--nexus-ease-linear);
  --ease-in: var(--nexus-ease-in);
  --ease-out: var(--nexus-ease-out);
  --ease-in-out: var(--nexus-ease-in-out);
  --ease-spring: var(--nexus-ease-spring);
  --ease-bounce: var(--nexus-ease-bounce);
  --ease-sluggish: var(--nexus-ease-sluggish);
}

/* Custom dark variant — uses data-theme attribute instead of prefers-color-scheme */
@custom-variant dark (&:where([data-theme="midnight"], [data-theme="midnight"] *));

/* Base styles — minimal reset, no color values (all in tokens) */
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  min-height: 100vh;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/globals.css
git -C /workspaces/nexus-anime commit -m "feat(styles): configure Tailwind CSS v4 entry point with design tokens"
```

---

### Task 5: Verify build and hot reload

**Files:**

- Modify: `apps/web/src/app/page.tsx` (add temporary Tailwind utility classes for verification)

**Interfaces:**

- Consumes: Tailwind v4 compiled CSS
- Produces: verified working Tailwind utilities in the running app

**Steps:**

- [ ] **Step 1: Add Tailwind utility test to page.tsx**

Replace `apps/web/src/app/page.tsx` with a minimal verification page:

```tsx
export default function Home() {
  return (
    <main className="bg-surface-base text-text-primary font-body p-spacing-6 min-h-screen">
      <h1 className="font-display text-text-primary text-4xl font-bold">Nexus Anime</h1>
      <p className="text-text-secondary mt-spacing-4 text-base">Tailwind CSS v4 is configured.</p>
      <div className="mt-spacing-6 p-spacing-4 bg-surface-raised rounded-radius-4 shadow-2">
        <p className="text-text-tertiary text-sm">Design system tokens are live.</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd /workspaces/nexus-anime/apps/web && pnpm typecheck
```

Expected: No errors. Tailwind classes are type-checked by the TypeScript compiler via `next-env.d.ts`.

- [ ] **Step 3: Run production build**

```bash
cd /workspaces/nexus-anime/apps/web && pnpm build
```

Expected output:

```
  ▲ Next.js 16.x.x
  ...
  Compiled successfully
  ...
```

- [ ] **Step 4: Verify Tailwind utilities in output**

Check that the build output contains our custom classes:

```bash
grep -r "bg-surface-base" apps/web/.next/static/css/ | head -1
grep -r "text-text-primary" apps/web/.next/static/css/ | head -1
grep -r "font-display" apps/web/.next/static/css/ | head -1
```

Expected: At least one match per class — confirms Tailwind generated the utilities.

- [ ] **Step 5: Start dev server and verify hot reload**

```bash
cd /workspaces/nexus-anime/apps/web && pnpm dev &
sleep 5 && curl -s http://localhost:3000 | grep -o 'Nexus Anime'
```

Expected: "Nexus Anime" appears in the HTML response. Dev server starts without errors.

- [ ] **Step 6: Stop dev server and clean up**

```bash
pkill -f "next dev" 2>/dev/null; true
```

- [ ] **Step 7: Revert page.tsx to placeholder**

```tsx
export default function Home() {
  return (
    <main>
      <h1>Nexus Anime</h1>
    </main>
  );
}
```

- [ ] **Step 8: Final commit**

```bash
git add apps/web/src/app/page.tsx
git -C /workspaces/nexus-anime commit -m "chore(web): verify Tailwind v4 utilities compile and render"
```

---

### Task 6: Self-review and final verification

**Files:** All created/modified files

**Interfaces:**

- Consumes: all previous tasks
- Produces: verified, committed, clean state

**Steps:**

- [ ] **Step 1: Review all created files**

Read each file created in this plan and verify:

- No raw color values (all use `var(--nexus-*)`)
- No `any` types
- No deprecated Tailwind v3 patterns (no `@tailwind` directives, no `tailwind.config.js`)
- All CSS custom properties use `--nexus-*` namespace
- `@import "tailwindcss"` is the first import in globals.css
- `@custom-variant dark` uses `[data-theme="midnight"]` selector

- [ ] **Step 2: Verify no leftover placeholder tokens**

```bash
grep -r "\-\-bg:" apps/web/src/ && grep -r "\-\-fg:" apps/web/src/
```

Expected: No matches. The old placeholder `--bg` and `--fg` should be gone from globals.css.

- [ ] **Step 3: Verify build still passes**

```bash
cd /workspaces/nexus-anime/apps/web && pnpm build
```

Expected: `✓ Compiled successfully`

- [ ] **Step 4: Stage all changes**

```bash
git add .
git status
```

- [ ] **Step 5: Create Conventional Commit**

```bash
git commit -m "feat(styles): configure Tailwind CSS v4"
```

- [ ] **Step 6: Stop and wait for approval**

Do not push. Wait for user review.

---

## Execution Handoff

After saving the plan, offer execution choice:

**"Plan complete and saved to `docs/superpowers/plans/2026-06-27-tailwind-css-v4.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?"**

**If Subagent-Driven chosen:**

- **REQUIRED SUB-SKILL:** Use superpowers:subagent-driven-development
- Fresh subagent per task + two-stage review

**If Inline Execution chosen:**

- **REQUIRED SUB-SKILL:** Use superpowers:executing-plans
- Batch execution with checkpoints for review
