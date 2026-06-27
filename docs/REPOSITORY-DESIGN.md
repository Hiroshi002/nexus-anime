# Repository Design — Nexus Anime

> **Audience:** Everyone who touches this repository — engineers, reviewers, and future contributors.
> **Status:** Accepted. This document is the "repo constitution." Process changes are proposed via PR against this file.
> **Source of truth:** For any question about _how we organize, branch, version, or govern this repo_, this file wins.

This document captures **all 28 deliverables** for Step 1 (Repository Initialization). Every decision is explained. The goal is a professional, low-friction, auditable workflow that scales from the current small team to a broader contributor base — without over-engineering.

---

## 1. Repository name suggestions

**Recommended:** `nexus-anime` (already in use).

**Alternatives (if rebranding or transferring):**
| Name | Rationale |
|------|-----------|
| `nexus-stream` | Generic; works if the platform expands beyond anime. |
| `nexus-portal` | Evokes a "gateway" aesthetic that matches the sci-fi UI direction. |
| `nexus-otaku` | Niche and community-coded; risks being less discoverable to newcomers. |

**Why `nexus-anime`:** "Nexus" signals a hub/gathering place; pairing it with "anime" keeps it discoverable via search. It is short, brandable, and avoids trademark conflict with existing streaming services (Crunchyroll, Funimation, HIDIVE, Netflix). The name does not lock us into a single genre or surface.

---

## 2. Repository description

> **Premium anime streaming platform with console-grade UI — a dark, cinematic portal built for gaming crossover and anime fans. Next.js 16 · Turborepo · TypeScript · Tailwind 4.**

**Why:** The description is the first thing shown in GitHub search results and the social card. It names the product, the aesthetic ("console-grade", "cinematic"), and the stack — all within GitHub's display budget. It is written for a visitor who has never seen the project, not for the team.

---

## 3. Repository topics (GitHub Topics)

`anime`, `streaming`, `nextjs`, `typescript`, `tailwindcss`, `turborepo`, `pnpm`, `drizzle-orm`, `redis`, `vercel`, `monorepo`, `shadcn-ui`, `framer-motion`

**Why these, specifically:**

- **Product signals** (`anime`, `streaming`) — what it is.
- **Stack signals** (`nextjs`, `typescript`, `tailwindcss`, `turborepo`, `pnpm`, `drizzle-orm`, `redis`, `shadcn-ui`, `framer-motion`) — what it's built with; these are the terms contributors search for.
- **Structural signals** (`monorepo`, `vercel`) — how it's organized and deployed.

**Why not more:** Generic terms (`javascript`, `web`, `frontend`) add noise, not signal. We keep the set to high-signal terms so the repo surfaces in the right searches.

---

## 4. Repository visibility recommendation

**Recommendation: Private during milestones M0–M4**, then evaluate going public at M5 (payments) or later.

**Why private now:**

- Protects unreleased IP (UI design, product direction).
- Reduces attack surface while payment (Stripe) and video (Cloudflare Stream) integrations are wired up.
- Avoids promising stability on a product that is explicitly mid-build (M3 in progress).

**When to go public:** When the product is ready for community scrutiny and contributions — typically at feature-complete launch (M7) or when a specific piece (e.g. `@nexus/ui`) is mature enough to be useful standalone.

**If open-source from day one is the goal:** Flip to public immediately and add a CLA (Contributor License Agreement) so the project retains relicensing flexibility. See §18.

---

## 5. Default branch strategy

**Default branch: `main`.**

`main` is the integration branch for production-ready code and the source of truth for releases. It is protected (see §20) and always deployable.

**We do NOT use a long-lived `develop` branch.** Releases are cut via tags (see §8), not via a permanent integration branch. See §7 for the workflow this enables.

**Why:** A single long-lived trunk reduces merge debt and pairs naturally with the CI status checks in §21. The "always deployable" invariant on `main` is what makes continuous delivery possible.

---

## 6. Branch naming convention

```
<type>/<milestone>-<short-slug>
```

Where:

- `type` ∈ `feature`, `bugfix`, `chore`, `docs`, `refactor`, `hotfix`, `release`
- `milestone` ∈ `m0`..`mN` (e.g. `m3`) — ties the branch to the roadmap
- `slug` is kebab-case, ≤ 30 characters, descriptive

**Examples:**
| Branch | Meaning |
|--------|---------|
| `feature/m3-auth-callback` | Auth callback work, milestone 3 |
| `bugfix/m3-login-redirect` | Login redirect fix, milestone 3 |
| `docs/repository-design` | Docs-only change (no milestone) |
| `hotfix/m2-cache-race` | Urgent fix to M2 cache logic |
| `release/v0.3.0` | Release preparation for 0.3.0 |

**Why:** The prefix groups branches in GitHub's branch dropdown and in `git branch` output. The milestone ties work to the roadmap (§26). The slug is human-readable so you can tell what a branch does without opening it.

---

## 7. Git workflow

**Trunk-based development.**

- Short-lived feature branches off `main`, merged via PR within days.
- No long-lived `develop` branch.
- Hotfixes branch from the latest release tag, the fix is applied, then cherry-picked to `main`.
- `main` is always deployable (enforced by branch protection + CI).

**Why trunk-based, not GitFlow:** Trunk-based keeps integration continuous and avoids the "merge hell" of long-lived feature branches. For a small-to-mid team shipping a single deployable (`apps/web`), GitFlow's extra branches (`develop`, `release/*`, `hotfix/*`) add ceremony without value. Releases are handled by tags (§8), not branches.

---

## 8. Git tag strategy

Tags mark **releases only**: `v<semver>` (e.g. `v0.3.0`, `v0.3.1`, `v1.0.0`).

- **Annotated tags** (`git tag -a v0.3.0 -m "release: v0.3.0"`) — record author, date, and release notes in the tag message.
- **Immutable** — never force-push a tag that has been published. If a release is wrong, release a new patch version; do not reuse the tag.
- Tags are created from `main` (or from a `release/vX.Y.Z` branch during release prep).

**Why annotated + immutable:** Annotated tags are first-class Git objects (author, date, message); lightweight tags are just pointers. Immutability protects the integrity of released artifacts — a downstream user who pinned `v0.3.0` must always get the same bits.

---

## 9. Semantic Versioning strategy

**Strict [SemVer 2.0.0](https://semver.org/):** `MAJOR.MINOR.PATCH`

| Bump    | When                                           |
| ------- | ---------------------------------------------- |
| `MAJOR` | Breaking changes to a public API or data model |
| `MINOR` | New, backward-compatible functionality         |
| `PATCH` | Backward-compatible bug fixes                  |

**Pre-release suffixes** are allowed during milestones: `v0.3.0-alpha.1`, `v0.3.0-beta.1`, `v0.3.0-rc.1`. These signal "not stable yet" and are not considered production-ready.

**`v1.0.0`** is the first stable public release, targeted at feature-complete launch (M7).

**Conventional Commits drive automated version bumps:**

- `fix:` → PATCH
- `feat:` → MINOR
- `BREAKING CHANGE` in the commit body → MAJOR

**Why:** SemVer is the ecosystem standard. Pairing it with Conventional Commits lets tooling (semantic-release, or a simple CI step) generate changelogs and version numbers automatically, removing human error and debate.

---

## 10. Repository folder structure

```
.
├── apps/                  # Deployable applications
├── packages/              # Shared libraries consumed by apps
├── tooling/               # Dev infra (docker, scripts)
├── docs/                  # Roadmaps, specs, ADRs, milestone plans
├── .github/               # Templates, workflows, labels, rules
├── .gitignore
├── package.json           # Workspace root (scripts, devDeps)
├── pnpm-workspace.yaml
├── turbo.json
├── LICENSE
├── README.md
├── .nvmrc
└── .env.example
```

**Why this layout:** This is the canonical Turborepo monorepo shape. `apps/` for deployables, `packages/` for shared code, `tooling/` for local infra that isn't shipped, `docs/` for long-lived design records, `.github/` for GitHub-native automation. Each top-level directory has one clear responsibility.

---

## 11. Root files

| File                  | Responsibility                                                            |
| --------------------- | ------------------------------------------------------------------------- |
| `package.json`        | Workspace root — scripts, devDeps, `packageManager` field                 |
| `pnpm-workspace.yaml` | Declares workspace globs (`apps/*`, `packages/*`)                         |
| `turbo.json`          | Pipeline config for `dev`, `build`, `lint`, `typecheck`, `test`           |
| `.npmrc`              | pnpm behavior (`shamefully-hoist=false`, `strict-peer-dependencies=true`) |
| `.nvmrc`              | Pins Node 22 LTS                                                          |
| `.env.example`        | Template for required env vars (no secrets)                               |
| `.gitignore`          | Standard Node/Next/Turbo/env ignores                                      |
| `prettier.config.js`  | Shared Prettier config (root)                                             |
| `tsconfig.base.json`  | Shared TS base config extended by apps/packages                           |
| `LICENSE`             | MIT (see §18)                                                             |
| `README.md`           | Project overview, quick start, scripts, architecture                      |
| `CODE_OF_CONDUCT.md`  | Community standards (mirrored in `.github/`)                              |
| `CONTRIBUTING.md`     | Contributor guide (mirrored in `.github/`)                                |

**Why:** Each file has one clear responsibility. Shared configs live at the root so apps and packages inherit them via Turborepo, avoiding drift.

---

## 12. `.github/` folder structure

```
.github/
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── SECURITY.md
├── PULL_REQUEST_TEMPLATE.md
├── labels.yml                  # Declarative label definitions
├── ISSUE_TEMPLATE/
│   ├── config.yml              # Blank-issue disable + contact links
│   ├── bug_report.yml
│   └── feature_request.yml
└── workflows/
    ├── ci.yml                  # PR checks: lint, typecheck, test, build
    ├── release.yml             # Tag → GitHub Release + changelog
    └── label-sync.yml          # Enforce labels.yml
```

**Why:** GitHub reads these paths natively — issue templates, PR templates, and workflow files are discovered automatically. Declarative labels (`labels.yml`) plus a sync workflow keep the label set consistent without manual clicking. Disabling blank issues (`config.yml`) routes reporters through templates, which forces the info we need to act.

---

## 13. `docs/` folder structure

```
docs/
├── README.md                   # Docs index + how to author ADRs/specs
├── master-roadmap.md           # Milestone table (M0..MN)
├── REPOSITORY-DESIGN.md        # This document (deliverables 1–28)
├── architecture/
│   └── adr/
│       ├── 000-record-architecture-decisions.md
│       ├── 001-modular-monolith-nextjs.md
│       └── <NNN>-<title>.md
├── milestones/
│   ├── milestone-0-repository-scaffold.md
│   ├── milestone-1-project-foundation.md
│   └── milestone-<N>-<title>.md
└── sprints/                    # Optional per-sprint plans
```

**Why this split:**

- **ADRs** capture _why_ a decision was made (context, consequences).
- **Milestone specs** capture _what_ a milestone delivers.
- **The roadmap** captures _when_ (milestone table).
- **The docs index** is the entry point for anyone new.

Separating "why" from "what" from "when" keeps each document focused and reviewable. ADRs are immutable records — when one is superseded, you add a new ADR that links back, rather than editing history.

---

## 14. `apps/` folder structure

```
apps/
└── web/                        # Next.js 16 application (deployable)
    ├── src/
    │   ├── app/                # App Router pages + layouts
    │   ├── components/         # Page-level components
    │   ├── lib/                # App-specific utilities
    │   └── styles/             # Global styles / Tailwind entry
    ├── public/                 # Static assets
    ├── tests/                  # App-level tests
    ├── next.config.ts
    ├── tsconfig.json
    ├── tailwind.config.ts
    └── package.json
```

**Why:** Single deployable for now (`web`). If a second app is needed later (e.g. `admin`), it follows the same shape. App Router colocates routes and components, which is the modern Next.js convention. `src/` keeps application code distinct from config files at the app root.

---

## 15. `packages/` folder structure

```
packages/
├── ui/                         # @nexus/ui — design system primitives
│   ├── src/
│   │   ├── components/         # shadcn/ui-based components
│   │   ├── hooks/
│   │   └── styles/             # Theme tokens
│   ├── package.json            # name: @nexus/ui
│   └── tsconfig.json
├── db/                         # @nexus/db — Drizzle schema, client, dialects
│   ├── src/
│   │   ├── schema/             # Table definitions
│   │   ├── migrations/
│   │   └── client.ts
│   └── package.json            # name: @nexus/db
├── cache/                      # @nexus/cache — Redis, rate limiting, flags
│   ├── src/
│   └── package.json            # name: @nexus/cache
└── config-eslint/              # @nexus/eslint-config — shared lint rules
    ├── index.js
    └── package.json            # name: @nexus/eslint-config
```

**Why:** Each package has a single, well-defined interface. `@nexus/*` scoped names prevent npm collisions and make imports self-documenting (`import { Button } from "@nexus/ui"`). The layout decodes what the existing `package.json` already references (`@nexus/db`, `@nexus/cache`, `@nexus/ui`).

---

## 16. `scripts` folder

Located at `tooling/scripts/` (see §10 — colocated with `tooling/docker/` because both are dev-time infra, not shipped code).

| Script            | Purpose                       |
| ----------------- | ----------------------------- |
| `seed-admin.ts`   | Creates admin user + roles    |
| `seed-anime.ts`   | Seeds anime catalog metadata  |
| `seed-catalog.ts` | Seeds genres, tags, relations |

Run with `pnpm tsx tooling/scripts/<name>.ts` (`tsx` is already a root devDependency).

**Why colocated with docker:** Both are dev-time tooling. Keeping them under `tooling/` separates "what we ship" (`apps/`, `packages/`) from "what we use to develop" (`tooling/`).

---

## 17. `docker` folder

Located at `tooling/docker/`.

| File                           | Purpose                                 |
| ------------------------------ | --------------------------------------- |
| `docker-compose.yml`           | Local Postgres, Redis, Mailpit services |
| `Dockerfile` (optional, later) | App containerization when needed        |

The root `package.json` already references `tooling/docker/docker-compose.yml` via the `docker:up` / `docker:down` / `docker:reset` / `docker:logs` scripts, so this is a decode-and-fill: the file must exist for those scripts to work.

**Why:** Local backing services for development, matching the stack (Postgres for `@nexus/db`, Redis for `@nexus/cache`, Mailpit for email testing during auth work).

---

## 18. Recommended licenses (with pros & cons)

| License                             | Pros                                                                                         | Cons                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **MIT** (recommended)               | Permissive, simple, widely understood; allows commercial use; low friction for contributors. | No explicit patent grant; others can relicense proprietary derivatives.      |
| Apache-2.0                          | Permissive + explicit patent grant; good when corporate contributors are involved.           | Slightly more complex; some hobbyists find the legal language intimidating.  |
| AGPL-3.0                            | Ensures derivatives stay open; strong copyleft.                                              | Deters commercial adoption; overkill for a streaming platform's UI scaffold. |
| Proprietary / "All Rights Reserved" | Maximum control; required if the platform itself is closed-source.                           | Blocks community contributions; not open-source.                             |

**Recommendation: MIT** for the open-source scaffold. The platform's own content (anime metadata, branding, video) is separately copyrighted and is NOT covered by the repo license — the MIT license covers the code only.

**If the business intends to keep the source closed:** use a proprietary license, skip the public repo, and rely on GitHub's private-repo access controls instead.

---

## 19. Repository rules

These are the human-readable rules that branch protection (§20) and CI (§21) enforce mechanically.

1. **All changes go through PRs** — no direct pushes to `main`.
2. **At least one approving review** required before merge.
3. **All required status checks must pass** (§21).
4. **Branches must be up to date with `main`** before merging.
5. **Conventional Commits** required for PR titles (drives versioning + changelog).
6. **No secrets in code** — use `.env.local` (gitignored) + GitHub Actions secrets.
7. **An ADR is required for any architectural change** (see §13).
8. **New packages must be scoped `@nexus/*`** (see §15).

**Why a written list:** Rules that live only in branch-protection settings are invisible to new contributors. A written list in the design doc (and mirrored in `CONTRIBUTING.md`) makes the expectations discoverable and discussable.

---

## 20. Branch protection rules (apply to `main`)

Configured in GitHub → Settings → Branches → `main`:

| Rule                                                   | Setting                      | Why                                       |
| ------------------------------------------------------ | ---------------------------- | ----------------------------------------- |
| Require a pull request before merging                  | On                           | Enforces §19.1                            |
| Require approving reviews                              | ≥ 1                          | Enforces §19.2                            |
| Dismiss stale PR approvals when new commits are pushed | On                           | Prevents "approved then silently changed" |
| Require review from Code Owners                        | On (if `CODEOWNERS` present) | Domain experts own their areas            |
| Require status checks to pass before merging           | On                           | Enforces §19.3                            |
| Require branches to be up to date before merging       | On                           | Enforces §19.4                            |
| Require conversation resolution before merging         | On                           | No dangling discussions                   |
| Require signed commits                                 | On (recommended)             | Auditability                              |
| Include administrators                                 | On                           | Even maintainers follow the process       |
| Allow force pushes                                     | **No**                       | Protects history + tags (§8)              |
| Allow deletions                                        | **No**                       | Protects `main`                           |

**Why apply to admins:** Rules that exempt administrators create a two-tier culture. Applying them to everyone makes the process credible.

---

## 21. Required status checks

From the CI workflow (`.github/workflows/ci.yml`). These five gates run on every PR and block merge on failure:

| Check       | Command             | What it gates                         |
| ----------- | ------------------- | ------------------------------------- |
| `lint`      | `pnpm lint`         | Code style + correctness (ESLint)     |
| `typecheck` | `pnpm typecheck`    | Type safety (TypeScript strict)       |
| `test`      | `pnpm test`         | Behavior (Vitest unit tests)          |
| `build`     | `pnpm build`        | Production build succeeds (Turborepo) |
| `format`    | `pnpm format:check` | Formatting conformance (Prettier)     |

**Why these five:** They cover the standard quality dimensions — style, types, behavior, buildability, and formatting — without being so slow that PRs stall. They map directly to the scripts already defined in the root `package.json`.

---

## 22. Merge strategy recommendation

**Squash and merge** as the default.

| Strategy                       | When to use                                             |
| ------------------------------ | ------------------------------------------------------- |
| **Squash and merge** (default) | Most PRs — produces one clean commit on `main` per PR   |
| Create a merge commit          | Multi-commit PRs that tell a coherent, reviewable story |
| Rebase and merge               | **Disabled** — avoids rewriting shared history          |

**Why squash by default:** It produces a linear, readable history on `main` where each commit is one complete, titled change. This pairs with Conventional Commits (§19.5) and semantic versioning (§9) — the squash commit's title becomes the changelog entry.

---

## 23. Pull Request workflow

1. **Create a branch** per §6.
2. **Open a PR** using `.github/PULL_REQUEST_TEMPLATE.md` — fill in motivation, testing steps, and screenshots for UI changes.
3. **CI runs** the required checks (§21).
4. **At least one reviewer approves**; all conversations are resolved.
5. **Author squashes & merges** (§22); the branch is deleted post-merge.
6. **PR title follows Conventional Commits** (`feat:`, `fix:`, `docs:`, etc.) — this drives the changelog and version bump (§9).

**Why a predictable lifecycle:** It reduces review friction, produces an auditable history, and means every contributor knows exactly what "done" looks like for a PR.

---

## 24. Issue workflow

- **Bugs** → `bug_report.yml` template (steps to reproduce, expected/actual behavior, environment).
- **Features** → `feature_request.yml` template (problem, proposed solution, alternatives).
- **Triage within 48h:** apply a label, a milestone, and an assignee.
- **`good-first-issue` label** for newcomer-friendly work.
- **Stale issues:** warned after 30 days of inactivity, closed after 60 days (stale bot optional).

**Why templates + SLAs:** Templates force reporters to provide the info needed to act (repro steps, motivation). Triage SLAs prevent the backlog from rotting and signal to contributors that their time is respected.

---

## 25. Labels

Defined declaratively in `.github/labels.yml` and synced via workflow. Categorized set:

| Category      | Labels                                                                       |
| ------------- | ---------------------------------------------------------------------------- |
| **Type**      | `bug`, `feature`, `docs`, `chore`, `refactor`, `question`                    |
| **Priority**  | `priority:critical`, `priority:high`, `priority:medium`, `priority:low`      |
| **Status**    | `blocked`, `in-progress`, `needs-review`, `good-first-issue`, `help-wanted`  |
| **Scope**     | `scope:web`, `scope:ui`, `scope:db`, `scope:cache`, `scope:ci`, `scope:docs` |
| **Milestone** | `m1`, `m2`, ... (one per milestone)                                          |

**Why this shape:** type × priority × status × scope gives enough dimensions to filter and report without label sprawl. Milestone labels tie issues to the roadmap (§26). Declarative labels + a sync workflow keep the set consistent.

---

## 26. Milestones

GitHub Milestones map 1:1 to the roadmap's milestones:

| ID  | Milestone                                   | Goal                                      | Status      |
| --- | ------------------------------------------- | ----------------------------------------- | ----------- |
| M0  | Repository scaffold                         | Repo, CI, conventions                     | ✅          |
| M1  | Design system in code                       | `@nexus/ui` primitives, theme tokens      | ✅          |
| M2  | Catalog foundation                          | DB, cache, API envelope, error boundaries | ✅          |
| M3  | Auth complete                               | Auth.js v5, sessions, OAuth               | In progress |
| M4  | User profiles, watchlist, continue-watching | Personalization                           | Planned     |
| M5  | Payments                                    | Stripe subscriptions                      | Planned     |
| M6  | Video streaming                             | Cloudflare Stream                         | Planned     |
| M7  | Public launch                               | v1.0.0                                    | Planned     |

**Why milestones:** They group issues and PRs into shippable increments and power GitHub's progress/burndown views. Each milestone has a spec in `docs/milestones/`.

---

## 27. GitHub Project board columns

A single "Nexus Anime" project board (table or board view):

| Column          | Meaning                       |
| --------------- | ----------------------------- |
| **Backlog**     | Un-triaged ideas              |
| **Ready**       | Triaged, labeled, no blockers |
| **In Progress** | Assigned, being worked        |
| **In Review**   | PR open, awaiting review      |
| **Done**        | Merged / shipped              |

**Optional extra columns** (add only if the team actually uses them): **Blocked** (explicit), **Needs Design** (for UI work awaiting design direction).

**Why minimal:** A small Kanban that mirrors the issue workflow (§24) keeps the board useful. Extra columns add noise unless there's a clear process that needs them.

---

## 28. Initial commit checklist

This is the acceptance test for Step 1. Every item maps to a deliverable above.

- [ ] Repo created with name, description, topics (§1–3)
- [ ] Visibility set (§4)
- [ ] Default branch = `main` (§5)
- [ ] LICENSE added (§18)
- [ ] Root files present (§11): `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.npmrc`, `.nvmrc`, `.env.example`, `.gitignore`, `prettier.config.js`, `tsconfig.base.json`, `README.md`
- [ ] `.github/` populated (§12)
- [ ] `docs/` populated with roadmap, ADR template, M1 spec (§13)
- [ ] `apps/web` scaffolded (§14)
- [ ] `packages/{ui,db,cache,config-eslint}` scaffolded (§15)
- [ ] `tooling/docker/docker-compose.yml` present (§17)
- [ ] `tooling/scripts/seed-*.ts` present (§16)
- [ ] Branch protection on `main` configured (§20)
- [ ] Required status checks configured (§21)
- [ ] Labels synced from `labels.yml` (§25)
- [ ] Milestones created (§26)
- [ ] Project board created (§27)
- [ ] Initial commit signed off (DCO optional)

**Why a checklist:** Step 1 is done only when every deliverable is materialized. This list is the verification — an engineer (or a future step) can walk it top-to-bottom and confirm the repo is fully initialized before any application code is written.

---

## How to change this document

This is a living constitution. To change any of the above:

1. Open a PR against `docs/REPOSITORY-DESIGN.md`.
2. Explain the rationale (context, consequences — same shape as an ADR).
3. Get ≥ 1 review from a maintainer.
4. Squash & merge.

Changes to process rules (§19–§22) should also update the corresponding GitHub settings (branch protection, labels) in the same PR.
