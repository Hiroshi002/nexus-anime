# CLAUDE.md - Nexus Anime (Monorepo)

## Response Style & Token Efficiency
- **Strictly No Preamble/Postamble:** Do not say "Sure", "Here is the code", or summarize. Start and end directly with code or core answers.
- **Diffs over Full Code:** Only provide modified lines or specific functions. Do not rewrite whole files.
- **No Over-engineering:** Implement exact requirements. Avoid speculative code or unused checks.

## Tech Stack & Architecture
- **Framework:** Next.js (App Router inside `apps/web/app`), TypeScript, Tailwind CSS.
- **Project Structure:** Follow standard feature-based pattern. Core folders in `apps/web`: `features`, `components`, `lib`, `types`.
- **Testing:** Vitest for unit/integration tests (`vitest.config.ts`), Playwright/Cypress for `e2e`.

## Development Commands
Always run commands from the project root:
- **Dev:** `pnpm dev` (Runs turbo dev)
- **Build:** `pnpm build`
- **Lint & Check:** `pnpm lint` / `pnpm typecheck` / `pnpm format:check`
- **Test:** `pnpm test`
- **Docker (Database/Services):** 
  - Up: `pnpm docker:up`
  - Down: `pnpm docker:down`
  - Logs: `pnpm docker:logs`
