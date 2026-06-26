# Contributing to Nexus Anime

Thank you for your interest in contributing! This document explains the mechanics of working with this repository. For the high-level design, see the [Repository Convention](docs/REPOSITORY-DESIGN.md) (the "repo constitution").

---

## Branch strategy

- **`main`** is the only long-lived branch. It is always deployable and protected (see [Repository Design §20](docs/REPOSITORY-DESIGN.md)).
- **All work happens on short-lived branches** off `main`:

  ```
  <type>/<milestone>-<short-slug>
  ```

  Where:
  - `type` ∈ `feature` · `bugfix` · `chore` · `docs` · `refactor` · `hotfix` · `release`
  - `milestone` ∈ `m0..mN` (e.g. `m3`) — ties the branch to the [Roadmap](ROADMAP.md)
  - `slug` — kebab-case, ≤ 30 characters, descriptive

- **Examples:**

  | Branch                    | Meaning                                   |
  |---------------------------|-------------------------------------------|
  | `feature/m3-auth-oauth`   | OAuth work, milestone 3                   |
  | `bugfix/m3-login-redirect`| Login redirect fix, milestone 3           |
  | `docs/repository-design`  | Docs-only change (no milestone)           |
  | `hotfix/m2-cache-race`    | Urgent M2 cache fix (branched from tag)   |
  | `release/v0.3.0`          | Release preparation                       |

- **Hotfixes** branch from the most recent release tag, are applied, and are cherry-picked back to `main`.

- **Do not** push directly to `main` — the branch protection rejects it, even for maintainers.

See [Repository Design §5–§7](docs/REPOSITORY-DESIGN.md) for the full rationale.

---

## Commit convention

We follow **[Conventional Commits](https://www.conventionalcommits.org/)**. The PR title (which becomes the squash commit on `main`) **must** use one of:

| Prefix                | Meaning                                           | Version bump |
|-----------------------|---------------------------------------------------|--------------|
| `feat:`               | New feature                                       | MINOR        |
| `fix:`                | Bug fix                                           | PATCH        |
| `docs:`               | Documentation only                                | —            |
| `chore:`              | Maintenance, tooling, dependencies                | —            |
| `refactor:`           | Code change that neither fixes a bug nor adds a feature | —        |
| `test:`               | Adding or correcting tests                        | —            |
| `BREAKING CHANGE` in body | Breaking change to a public API or data model | MAJOR        |

A `!` after the type/scope signals a breaking change: `feat!: redesign auth callback`.

**Examples:**

```
feat: add watchlist endpoint
fix: handle expired JWT on /watch
docs: update ADR index
BREAKING CHANGE: session tokens rotated — all users need to re-login
```

Why: Conventional Commits drive the automated [CHANGELOG.md](CHANGELOG.md) and map 1:1 to [Semantic Versioning](https://semver.org/) as described in [Repository Design §9](docs/REPOSITORY-DESIGN.md).

---

## Pull Request process

See [Repository Design §23](docs/REPOSITORY-DESIGN.md) for the full workflow. At a glance:

1. **Fork or branch** from `main` per the [Branch strategy](#branch-strategy) above.
2. **Open a PR** against `main` using the template at `.github/PULL_REQUEST_TEMPLATE.md`.
   - Fill in **Summary**, **Motivation**, **Testing** steps.
   - Include **screenshots or screen recordings** for any UI change.
3. **Required CI must pass.** The five gates are:

   | Gate           | Command              |
   |----------------|----------------------|
   | lint           | `pnpm lint`          |
   | typecheck      | `pnpm typecheck`     |
   | test           | `pnpm test`          |
   | build          | `pnpm build`         |
   | format:check   | `pnpm format:check`  |

4. **At least one approving review** from a maintainer. All conversations must be resolved.
5. **Squash & merge** by the author (default merge strategy; see [Repository Design §22](docs/REPOSITORY-DESIGN.md)).
6. The feature branch is **deleted** post-merge.

---

## Coding standards

These rules are enforced by tooling *and* expected in review.

### TypeScript

- **Strict mode** is enabled everywhere (`tsconfig.base.json` sets `"strict": true`).
- No `any` unless it is unavoidable, and if used, it must be justified with a comment explaining why.
- Prefer type inference over explicit annotations when the inference is obvious.

### React & Next.js

- Default to **Server Components**. A component becomes a Client Component only when it uses `useState`, `useEffect`, event hooks, or browser-only APIs — mark it with `'use client';` at the top.
- Use **Server Actions** for data mutations from forms and handlers; do not write API route handlers for simple CRUD.
- Route handlers (`app/<route>/route.ts`) are for REST endpoints consumed by non-browser clients (webhooks, third-party callbacks).

### Styling

- **Tailwind CSS 4** is the only styling system. Avoid CSS Modules, styled-components, or inline style objects unless there is a clear reason (e.g. dynamic values Tailwind cannot express).
- The design system (`@nexus/ui`) is the source of truth for tokens, spacing, and components. Do not hand-roll colors or spacing that exist in the theme.
- Run `pnpm format:check` locally before pushing. Prettier is enforced in CI.

### State & data

- **Server state:** server components that fetch directly or via Services.
- **Client state:** `useState` / `useReducer` for UI-only state; server actions for mutations.
- **Global client state** (Zustand, Jotai, etc.) is not yet adopted. Do not introduce it without an ADR.

### Testing

- **Unit tests** (Vitest) for pure logic: services, utilities, hooks.
- **Integration tests** (Playwright, later) for user flows: login, watchlist, playback.
- Tests live next to the code they cover (`*.test.ts` or a `__tests__/` folder).
- New features without tests must justify the omission in the PR.

### Documentation

- **Architecture changes require an ADR** in `docs/architecture/adr/`. See the [ADR template](docs/architecture/adr/000-record-architecture-decisions.md).
- Update the relevant milestone spec if the change alters what the milestone delivers.
- User-facing behavior changes should update any in-app help text or external docs.

### Secrets

- **Never commit secrets.** Use `.env.local` (gitignored) for local dev and GitHub Actions secrets for CI.
- `.env.example` lists the required keys with empty values — keep it in sync when you add new env vars.

---

## Local setup

```bash
# 1. Clone and install
pnpm install

# 2. Configure environment
cp .env.example apps/web/.env.local
# ... fill in the values

# 3. (Optional) Start local backing services
pnpm docker:up

# 4. Run the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Useful scripts

| Command                | Description                                |
|------------------------|--------------------------------------------|
| `pnpm dev`             | Start dev server (Turborepo)               |
| `pnpm build`           | Production build (all packages)            |
| `pnpm lint`            | ESLint across workspace                    |
| `pnpm typecheck`       | TypeScript check                           |
| `pnpm test`            | Vitest unit tests                          |
| `pnpm format`          | Prettier format                            |
| `pnpm format:check`    | Prettier check                             |
| `pnpm clean`           | Clean build artifacts                      |
| `pnpm docker:up`       | Start Docker services                      |
| `pnpm docker:down`     | Stop Docker services                       |
| `pnpm docker:reset`    | Reset Docker services (wipe volumes)       |
| `pnpm docker:logs`     | Tail Docker service logs                   |

---

## Code of Conduct

This project adheres to the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you are expected to uphold it.

## Reporting security issues

**Do not open public issues for security bugs.** See [SECURITY.md](SECURITY.md) for the private reporting process.

## Getting help

See [SUPPORT.md](SUPPORT.md) for how to reach the team and get answers.
