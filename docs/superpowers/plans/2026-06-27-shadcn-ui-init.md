# shadcn/ui Initialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize shadcn/ui as the project's component foundation, preparing the UI infrastructure for future shared components.

**Architecture:** shadcn/ui components live in `apps/web/src/components/ui/` (installed via CLI). The `cn()` utility lives in `packages/ui/src/lib/cn.ts` as the source of truth, re-exported from `apps/web/src/lib/utils.ts` so shadcn/ui's CLI can find it at `@/lib/utils`. The `components.json` config sits at `apps/web/components.json`. Existing design tokens in `packages/ui/src/tokens/` are untouched. No theme provider, no custom components, no business logic.

**Tech Stack:** shadcn/ui (latest, `new-york` style), Tailwind CSS v4, React 19, Radix UI (peer), Lucide React (icons), `clsx` + `tailwind-merge` (for `cn`).

## Global Constraints

- Tailwind CSS v4 only — no `tailwind.config.js/ts` file. Config stays CSS-first via `@theme` in `globals.css`.
- Do NOT modify existing design tokens in `packages/ui/src/tokens/`.
- Do NOT implement custom components, navigation, layout, pages, auth, theme provider, or business logic.
- shadcn/ui style: `new-york` (the current default for Tailwind v4 + React 19).
- `tailwindcss-animate` is deprecated — use `tw-animate-css` instead.
- Path alias `@/*` → `./src/*` already exists in `apps/web/tsconfig.json`.
- Dark mode is `data-theme="midnight"` driven via `@custom-variant dark` — preserve this.
- `components.json` `tailwind.config` field MUST be `""` (blank) for Tailwind v4.
- Reusable utilities live in `packages/*/src/lib/` per CLAUDE.md.

---

### Task 1: Create the `cn()` utility in `@nexus/ui`

**Files:**

- Create: `packages/ui/src/lib/cn.ts`

**Interfaces:**

- Consumes: nothing (standalone utility)
- Produces: `cn(...inputs: ClassValue[])` — used by shadcn/ui components and available to consumers of `@nexus/ui`

- [ ] **Step 1: Create `packages/ui/src/lib/cn.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Verify file is syntactically correct**

Run: `pnpm --filter @nexus/ui exec tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/lib/cn.ts
git commit -m "feat(ui): add cn utility for class merging"
```

---

### Task 2: Install shadcn/ui peer dependencies

**Files:**

- Modify: `packages/ui/package.json`

**Interfaces:**

- Consumes: nothing
- Produces: `@nexus/ui` with `clsx` and `tailwind-merge` as runtime dependencies; `lucide-react`, `@radix-ui/react-slot`, and `tw-animate-css` as devDependencies

- [ ] **Step 1: Add dependencies to `packages/ui/package.json`**

Add to `dependencies`:

- `clsx`: `^2.1.1`
- `tailwind-merge`: `^3.0.0`

Add to `devDependencies`:

- `lucide-react`: `^0.468.0`
- `@radix-ui/react-slot`: `^1.1.1`
- `tw-animate-css`: `^1.0.0`

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: lockfile updated, no errors

- [ ] **Step 3: Commit**

```bash
git add packages/ui/package.json pnpm-lock.yaml
git commit -m "deps(ui): add shadcn/ui peer dependencies (clsx, tailwind-merge, radix, lucide, tw-animate-css)"
```

---

### Task 3: Create `components.json`

**Files:**

- Create: `apps/web/components.json`

**Interfaces:**

- Consumes: nothing
- Produces: shadcn/ui CLI configuration pointing to the correct paths inside the Next.js app

- [ ] **Step 1: Create `apps/web/components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "cssVariables": true,
    "baseColor": "neutral"
  },
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks",
    "utils": "@/lib/utils"
  }
}
```

Key decisions:

- `"style": "new-york"` — the current Tailwind v4 default.
- `"config": ""` — required for Tailwind v4 (no config file).
- `"css": "src/app/globals.css"` — matches the existing Tailwind entry point.
- `"cssVariables": true` — shadcn/ui uses CSS variables for theme; these map to the existing `@theme` block.
- `"baseColor": "neutral"` — shadcn/ui's default; actual colors come from the existing `--nexus-*` tokens.
- `"ui": "@/components/ui"` — shadcn/ui's default install path for components.
- `"utils": "@/lib/utils"` — shadcn/ui's default path for the `cn` helper.

- [ ] **Step 2: Verify JSON is valid**

Run: `cat apps/web/components.json | python3 -m json.tool`
Expected: pretty-printed JSON, no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/components.json
git commit -m "feat(ui): add shadcn/ui components.json configuration"
```

---

### Task 4: Create the `@/lib/utils` alias path for shadcn/ui

**Files:**

- Create: `apps/web/src/lib/utils.ts`

**Interfaces:**

- Consumes: `cn` from `packages/ui/src/lib/cn.ts` (created in Task 1)
- Produces: `apps/web/src/lib/utils.ts` — the path shadcn/ui's CLI expects for the `cn` utility (per `components.json` → `aliases.utils: "@/lib/utils"`)

**Why no cycle:** `@nexus/web` already depends on `@nexus/ui` via `workspace:*`, so the web app can re-export from the UI package. Direction is `@nexus/web` → `@nexus/ui` (no cycle).

- [ ] **Step 1: Create `apps/web/src/lib/utils.ts`**

```ts
export { cn } from "@nexus/ui";
```

- [ ] **Step 2: Verify `packages/ui/src/lib/cn.ts` still has the original implementation**

Read the file — it should contain:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/utils.ts
git commit -m "feat(web): create lib/utils alias for shadcn/ui cn utility"
```

---

### Task 5: Update `@nexus/ui` exports

**Files:**

- Modify: `packages/ui/src/index.ts`

**Interfaces:**

- Consumes: `cn` from `packages/ui/src/lib/cn.ts`
- Produces: `@nexus/ui` package that exports `cn` for consumers

- [ ] **Step 1: Update `packages/ui/src/index.ts`**

```ts
// @nexus/ui — design system primitives (Tailwind 4 + React 19)
export { cn } from "./lib/cn";
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @nexus/ui exec tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/index.ts
git commit -m "feat(ui): export cn from @nexus/ui"
```

---

### Task 6: Add `tw-animate-css` to the Tailwind CSS entry point

**Files:**

- Modify: `apps/web/src/app/globals.css`

**Interfaces:**

- Consumes: `tw-animate-css` package (installed in Task 2)
- Produces: `globals.css` with animation utilities enabled for shadcn/ui components

- [ ] **Step 1: Add `@import "tw-animate-css";` to `globals.css`**

Place it after `@import "tailwindcss";` and before `@import "@nexus/ui/tailwind";`:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "@nexus/ui/tailwind";
```

- [ ] **Step 2: Verify the CSS compiles (deferred to Task 8 build)**

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(ui): add tw-animate-css to globals.css"
```

---

### Task 7: Add a sample shadcn/ui component (button)

**Files:**

- Created by shadcn/ui CLI: `apps/web/src/components/ui/button.tsx`

**Interfaces:**

- Consumes: `cn` from `@/lib/utils`, Radix UI Slot, Lucide React icons
- Produces: A working shadcn/ui Button component that validates the entire setup

- [ ] **Step 1: Run shadcn/ui CLI to add the button component**

Run: `cd apps/web && npx shadcn@latest add button`
Expected: `apps/web/src/components/ui/button.tsx` is created

- [ ] **Step 2: Verify the component file exists**

Run: `ls -la apps/web/src/components/ui/button.tsx`
Expected: file exists

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/button.tsx
git commit -m "feat(ui): add sample shadcn/ui button component"
```

---

### Task 8: Full validation

**Files:** none (validation only)

**Interfaces:** none

- [ ] **Step 1: Typecheck the web app**

Run: `pnpm --filter @nexus/web exec tsc --noEmit`
Expected: no TypeScript errors

- [ ] **Step 2: Lint the web app**

Run: `pnpm --filter @nexus/web exec lint`
Expected: no lint errors

- [ ] **Step 3: Build the web app**

Run: `pnpm --filter @nexus/web build`
Expected: build succeeds

- [ ] **Step 4: Typecheck the UI package**

Run: `pnpm --filter @nexus/ui exec tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Stage all changes and create the Conventional Commit**

```bash
git add .
git status
```

Expected staged files:

- `apps/web/components.json` (new)
- `apps/web/src/components/ui/button.tsx` (new)
- `apps/web/src/lib/utils.ts` (new)
- `apps/web/src/app/globals.css` (modified)
- `packages/ui/package.json` (modified)
- `packages/ui/src/index.ts` (modified)
- `packages/ui/src/lib/cn.ts` (new)
- `pnpm-lock.yaml` (modified)

```bash
git commit -m "feat(ui): initialize shadcn/ui"
```

---

## File Summary

| File                                    | Action           | Purpose                                                       |
| --------------------------------------- | ---------------- | ------------------------------------------------------------- |
| `apps/web/components.json`              | Create           | shadcn/ui CLI configuration                                   |
| `apps/web/src/components/ui/button.tsx` | Create (via CLI) | Sample component validating the setup                         |
| `apps/web/src/lib/utils.ts`             | Create           | Re-exports `cn` for shadcn/ui's expected path                 |
| `apps/web/src/app/globals.css`          | Modify           | Add `tw-animate-css` import                                   |
| `packages/ui/package.json`              | Modify           | Add `clsx`, `tailwind-merge`, `tw-animate-css`, Radix, Lucide |
| `packages/ui/src/index.ts`              | Modify           | Export `cn` from `@nexus/ui`                                  |
| `packages/ui/src/lib/cn.ts`             | Create           | `cn()` utility (source of truth)                              |
| `pnpm-lock.yaml`                        | Modify           | Lockfile update from new deps                                 |

## Compatibility Notes

- The existing `@custom-variant dark` in `globals.css` is preserved. shadcn/ui components use `dark:` variants which will respect the custom variant definition.
- shadcn/ui's CSS variables (e.g., `--background`, `--foreground`) will coexist with the existing `--nexus-*` variables. No naming conflicts exist.
- The `@theme` block maps Tailwind utilities to the project's tokens, so shadcn/ui components using `bg-background` will resolve correctly.

## Risks

- **CSS variable conflicts:** shadcn/ui adds its own CSS variables when components are used. These are scoped and won't conflict with `--nexus-*` variables. Future theme adjustments may be needed if shadcn/ui's defaults don't align with the design system.
- **Path alias resolution:** Verified — `@/*` → `./src/*` in `apps/web/tsconfig.json` ensures `@/lib/utils` resolves correctly.
- **tw-animate-css vs tailwindcss-animate:** The project does not have `tailwindcss-animate` installed, so adding `tw-animate-css` is clean.

## Next Recommended Task

After this task is approved and committed, the next step is to begin building shared components using the shadcn/ui foundation (e.g., a reusable Button, Card, or Input in `@nexus/ui`). This is part of the M3 milestone or as directed by the user.
