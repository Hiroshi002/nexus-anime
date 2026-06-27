# Repository Initialization — Step 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the complete GitHub repository design for `nexus-anime` (all 28 deliverables) into `docs/REPOSITORY-DESIGN.md`, then materialize the missing scaffolding that is pure configuration/documentation (LICENSE, .github/_, docs/_, tooling/docker, tooling/scripts, .gitignore patches, .nvmrc, .env.example). No application code is written.

**Architecture:** Treat the design doc as the single source of truth (a "repo constitution"). Decode the existing conventions already baked into `package.json`, `apps/web`, `packages/{ui,db,cache,config-eslint}`, and the README's stated stack — then design everything else to be consistent with them. All 28 deliverables are explained, not just listed.

**Tech Stack:** pnpm 9 workspaces · Turborepo · Next.js 16 · TypeScript (strict) · Tailwind CSS 4 · Drizzle ORM · Upstash Redis · Auth.js v5 · Stripe · Cloudflare Stream · Vercel.

## Global Constraints

- **No application code.** Only documentation and config/scaffolding. If a step would touch `apps/web/src/**` runtime logic, skip it — that belongs to later milestones.
- **Decode, don't invent.** Match the existing monorepo layout (`apps/web`, `packages/ui|db|cache|config-*`, `tooling/docker`, `tooling/scripts`, `docs/`).
- **Explain every decision.** Every deliverable gets a rationale paragraph.
- **Output professional Markdown.** The design doc is a deliverable in its own right.
- **Stop after Step 1.** Do not begin M3/auth implementation.

---

## File Structure

**Create:**

- `docs/REPOSITORY-DESIGN.md` — the full 28-deliverable design document (primary deliverable)
- `docs/architecture/adr/000-record-architecture-decisions.md` — ADR template + index
- `docs/architecture/adr/001-modular-monolith-nextjs.md` — the ADR the README already links to
- `docs/master-roadmap.md` — the roadmap the README already links to
- `docs/milestone-1-project-foundation.md` — the M1 spec the README already links to
- `.github/CODE_OF_CONDUCT.md`
- `.github/CONTRIBUTING.md`
- `.github/SECURITY.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/feature_request.yml`
- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/labels.yml` — declarative labels (for `gh` or label-sync action)
- `.github/workflows/ci.yml` — required status checks live here
- `tooling/docker/docker-compose.yml` — referenced by root `package.json` scripts
- `tooling/scripts/seed-admin.ts` — referenced by README
- `tooling/scripts/seed-anime.ts`
- `tooling/scripts/seed-catalog.ts`
- `LICENSE` — MIT (recommended; see deliverable 18)
- `.nvmrc` — referenced by README prerequisites
- `.env.example` — referenced by README quick start
- `docs/README.md` — docs folder index (deliverable 13)

**Modify:**

- `.gitignore` — append Next.js/Turbo/pnpm/env entries currently missing
- `README.md` — add a "Repository conventions" section pointing at the new design doc (no app-code changes)

---

## Task 1: Author the repository design document

**Files:**

- Create: `docs/REPOSITORY-DESIGN.md`

**Interfaces:**

- Consumes: existing `package.json` scripts + workspace layout, README stack table, README architecture section
- Produces: the canonical reference every later step reads before creating files/branches/PRs

- [ ] **Step 1: Create the design doc with all 28 deliverables**

Create `docs/REPOSITORY-DESIGN.md`. It MUST contain every deliverable below, each with a rationale. Use the exact content specified so there is no ambiguity.

### 1. Repository name suggestions

Recommended: **`nexus-anime`** (already in use). Alternatives: `nexus-stream`, `nexus-portal`, `nexus-otaku`. Rationale: "Nexus" signals a hub/gathering place; pairing with "anime" keeps it discoverable. The name is short, brandable, and avoids trademark conflict with existing streaming services.

### 2. Repository description

`Premium anime streaming platform with console-grade UI — a dark, cinematic portal built for gaming crossover and anime fans. Next.js 16 · Turborepo · TypeScript · Tailwind 4.` Rationale: the description is the first thing shown in search results; it names the product, the aesthetic, and the stack in under 120 characters.

### 3. Repository topics (GitHub Topics)

`anime`, `streaming`, `nextjs`, `typescript`, `tailwindcss`, `turborepo`, `pnpm`, `drizzle-orm`, `redis`, `vercel`, `monorepo`, `shadcn-ui`, `framer-motion`. Rationale: these are the searchable signals that attract contributors and signal stack to visitors. Keep to high-signal terms; avoid generic ones like `javascript` or `web`.

### 4. Repository visibility recommendation

**Private during milestones M0–M4**, then evaluate going public at M5 (payments) or later. Rationale: private protects unreleased IP, payment integrations, and any licensed metadata before a public launch. Going public later maximizes community growth when the product is ready. (If the goal is open-source from day one, flip to public and add a CLA — see deliverable 18.)

### 5. Default branch strategy

Default branch: **`main`**. It is the integration branch for production-ready code and the source of truth for releases. `develop` is NOT used (see deliverable 7 — trunk-based). Rationale: a single long-lived trunk reduces merge debt; releases are cut via tags, not a permanent `develop` branch.

### 6. Branch naming convention

`<type>/<milestone>-<short-slug>` where:

- `type` ∈ `feature`, `bugfix`, `chore`, `docs`, `refactor`, `hotfix`, `release`
- milestone ∈ `m0`..`mN` (e.g. `m3`)
- slug is kebab-case, ≤ 30 chars

Examples: `feature/m3-auth-callback`, `bugfix/m3-login-redirect`, `docs/repository-design`, `hotfix/m2-cache-race`, `release/v0.3.0`. Rationale: prefix groups branches in GitHub's branch dropdown; the milestone ties work to the roadmap; the slug is human-readable.

### 7. Git workflow

**Trunk-based development.** Short-lived feature branches off `main`, merged via PR within days. No long-lived `develop` branch. Hotfixes branch from the latest release tag, fix applied, then cherry-picked to `main`. Rationale: trunk-based keeps integration continuous and pairs well with the CI status checks in deliverable 21. It avoids the "merge hell" of GitFlow for a small-to-mid team.

### 8. Git tag strategy

Tags mark releases only: `v<semver>` (e.g. `v0.3.0`, `v0.3.1`, `v1.0.0`). Annotated tags (`git tag -a`) with release notes in the tag message. Tags are immutable — never force-push a tag that has been published. Rationale: annotated tags record the author and date; immutability protects the integrity of released artifacts.

### 9. Semantic Versioning strategy

Strict **SemVer 2.0.0**. `MAJOR.MINOR.PATCH`:

- `MAJOR` — breaking changes to public API or data model
- `MINOR` — new, backward-compatible functionality
- `PATCH` — backward-compatible bug fixes

Pre-release suffixes allowed during milestones: `v0.3.0-alpha.1`, `v0.3.0-beta.1`. `v1.0.0` is the first stable public release (targeted at feature-complete launch). Conventional Commits (`feat`, `fix`, `BREAKING CHANGE`) drive automated version bumps. Rationale: SemVer is the ecosystem standard; pre-releases let us ship milestones without implying stability.

### 10. Repository folder structure

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

Rationale: this is the canonical Turborepo layout. `apps/` for deployables, `packages/` for shared code, `tooling/` for local infra that isn't shipped, `docs/` for long-lived design records.

### 11. Root files

| File                  | Purpose                                                         |
| --------------------- | --------------------------------------------------------------- |
| `package.json`        | Workspace root — scripts, devDeps, `packageManager` field       |
| `pnpm-workspace.yaml` | Declares workspace globs (`apps/*`, `packages/*`)               |
| `turbo.json`          | Pipeline config for `dev`, `build`, `lint`, `typecheck`, `test` |
| `.npmrc`              | `shamefully-hoist=false`, `strict-peer-dependencies=true`       |
| `.nvmrc`              | Pins Node 22 LTS                                                |
| `.env.example`        | Template for required env vars (no secrets)                     |
| `.gitignore`          | Standard Node/Next/Turbo/env ignores                            |
| `prettier.config.js`  | Shared Prettier config (root)                                   |
| `tsconfig.base.json`  | Shared TS base config extended by apps/packages                 |
| `LICENSE`             | MIT (see deliverable 18)                                        |
| `README.md`           | Project overview, quick start, scripts, architecture            |
| `CODE_OF_CONDUCT.md`  | Community standards (also in `.github/`)                        |
| `CONTRIBUTING.md`     | Contributor guide (also in `.github/`)                          |

Rationale: each file has one clear responsibility. Shared configs live at the root so apps/packages inherit them via Turborepo.

### 12. `.github/` folder structure

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

Rationale: GitHub reads these paths natively. Declarative labels + a sync workflow keep the label set consistent without manual clicking.

### 13. `docs/` folder structure

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

Rationale: ADRs capture "why" decisions; milestone specs capture "what"; the roadmap captures "when". Separating them keeps each document focused and reviewable.

### 14. `apps/` folder structure

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

Rationale: single deployable for now (`web`). If a second app is needed later (e.g. `admin`), it follows the same shape. App Router colocates routes and components.

### 15. `packages/` folder structure

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

Rationale: each package has a single, well-defined interface. `@nexus/*` scoped names prevent npm collisions and make imports self-documenting.

### 16. `scripts` folder

Located at `tooling/scripts/` (see deliverable 10). Files:

- `seed-admin.ts` — creates admin user + roles
- `seed-anime.ts` — seeds anime catalog metadata
- `seed-catalog.ts` — seeds genres, tags, relations

Rationale: colocated with `tooling/docker/` because both are dev-time infra, not shipped code. `tsx` (already a root devDep) runs them.

### 17. `docker` folder

Located at `tooling/docker/`. Files:

- `docker-compose.yml` — Postgres, Redis, Mailpit services
- `Dockerfile` (optional, for app containerization later)

Rationale: local backing services for development. The root `package.json` already references `tooling/docker/docker-compose.yml`, so this is a decode-and-fill.

### 18. Recommended licenses (pros/cons)

| License                             | Pros                                                                                         | Cons                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **MIT** (recommended)               | Permissive, simple, widely understood; allows commercial use; low friction for contributors. | No patent grant; others can relicense proprietary derivatives. |
| Apache-2.0                          | Permissive + explicit patent grant; good for projects with corporate contributors.           | Slightly more complex; some hobbyists find it intimidating.    |
| AGPL-3.0                            | Ensures derivatives stay open; strong copyleft.                                              | Deters commercial adoption; overkill for a streaming platform. |
| Proprietary / "All Rights Reserved" | Maximum control; required if the platform itself is closed-source.                           | Blocks community contributions; not open-source.               |

Recommendation: **MIT** for the open-source scaffold; the platform's own content/branding is separately copyrighted. If the business intends to keep the source closed, use a proprietary license and skip the public repo.

### 19. Repository rules

1. All changes go through PRs — no direct pushes to `main`.
2. At least one approving review required before merge.
3. All required status checks must pass (deliverable 21).
4. Branches must be up to date with `main` before merging.
5. Conventional Commits required for PR titles.
6. No secrets in code — use `.env.local` + GitHub Secrets.
7. ADR required for any architectural change.
8. New packages must be scoped `@nexus/*`.

Rationale: these rules encode the workflow so they can be enforced by branch protection (deliverable 20) and so new contributors can discover them in one place.

### 20. Branch protection rules (apply to `main`)

- Require a pull request before merging
  - Require ≥ 1 approving review
  - Dismiss stale PR approvals when new commits are pushed
  - Require review from Code Owners (if CODEOWNERS is present)
- Require status checks to pass before merging
  - Require branches to be up to date before merging
  - Required checks: `lint`, `typecheck`, `test`, `build` (from CI)
- Require conversation resolution before merging
- Require signed commits (recommended)
- Include administrators (rules apply to admins too)
- Allow force pushes: **No**
- Allow deletions: **No**

Rationale: these mirror the repository rules in GitHub's enforcement layer. Applying them to admins prevents even maintainers from bypassing the process.

### 21. Required status checks

From the CI workflow (`ci.yml`):

1. `lint` — ESLint across workspace
2. `typecheck` — TypeScript strict check
3. `test` — Vitest unit tests
4. `build` — Production build (Turborepo)
5. `format:check` — Prettier conformance

Rationale: these five gates cover code quality, correctness, and formatting. They run on every PR and block merge on failure.

### 22. Merge strategy recommendation

**Squash and merge** as the default. Rationale: squash produces a single, clean commit on `main` per PR, which keeps the history linear and pairs with Conventional Commits + semantic-release. "Create a merge commit" is allowed for multi-commit PRs that tell a coherent story; "Rebase and merge" is disabled to avoid rewriting shared history.

### 23. Pull Request workflow

1. Create branch per deliverable 6.
2. Open PR with the template (`.github/PULL_REQUEST_TEMPLATE.md`) — fill in motivation, testing steps, screenshots for UI changes.
3. CI runs required checks (deliverable 21).
4. At least 1 reviewer approves; conversations resolved.
5. Author squashes & merges; branch deleted post-merge.
6. PR title follows Conventional Commits (`feat:`, `fix:`, `docs:`, etc.) — this drives the changelog and version bump.

Rationale: a predictable PR lifecycle reduces review friction and produces an auditable history.

### 24. Issue workflow

- Bugs → `bug_report.yml` template (steps to reproduce, expected/actual, env).
- Features → `feature_request.yml` template (problem, proposed solution, alternatives).
- Triage within 48h: apply a label, milestone, and assignee.
- "Good first issue" label for newcomer-friendly work.
- Stale issues warned after 30d, closed after 60d of inactivity (stale bot optional).

Rationale: templates force reporters to provide the info needed to act; triage SLAs prevent the backlog from rotting.

### 25. Labels

Categorized set (defined in `.github/labels.yml`):

- **Type:** `bug`, `feature`, `docs`, `chore`, `refactor`, `question`
- **Priority:** `priority:critical`, `priority:high`, `priority:medium`, `priority:low`
- **Status:** `blocked`, `in-progress`, `needs-review`, `good-first-issue`, `help-wanted`
- **Scope:** `scope:web`, `scope:ui`, `scope:db`, `scope:cache`, `scope:ci`, `scope:docs`
- **Milestone tie-in:** `m1`, `m2`, ... (one per milestone)

Rationale: type+priority+status+scope gives enough dimensions to filter and report without label sprawl.

### 26. Milestones

GitHub Milestones map 1:1 to the roadmap's milestones:

- M0 Repository scaffold ✅
- M1 Design system in code ✅
- M2 Catalog foundation ✅
- M3 Auth complete (in progress)
- M4 User profiles, watchlist, continue-watching
- M5 Payments (Stripe)
- M6 Video streaming (Cloudflare Stream)
- M7 Public launch (v1.0.0)

Rationale: milestones group issues/PRs into shippable increments and power the burndown/progress view.

### 27. GitHub Project board columns

A single "Nexus Anime" project board (table or board view):

1. **Backlog** — un-triaged ideas
2. **Ready** — triaged, labeled, no blockers
3. **In Progress** — assigned, being worked
4. **In Review** — PR open, awaiting review
5. **Done** — merged / shipped

Optional extra columns: **Blocked** (explicit), **Needs Design** (for UI work). Rationale: a minimal Kanban that mirrors the issue workflow; extra columns add noise unless the team actually uses them.

### 28. Initial commit checklist

- [ ] Repo created with name, description, topics (deliverables 1–3)
- [ ] Visibility set (deliverable 4)
- [ ] Default branch = `main` (deliverable 5)
- [ ] LICENSE added (deliverable 18)
- [ ] Root files present (deliverable 11): `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.npmrc`, `.nvmrc`, `.env.example`, `.gitignore`, `prettier.config.js`, `tsconfig.base.json`, `README.md`
- [ ] `.github/` populated (deliverable 12)
- [ ] `docs/` populated with roadmap, ADR template, M1 spec (deliverable 13)
- [ ] `apps/web` scaffolded (deliverable 14)
- [ ] `packages/{ui,db,cache,config-eslint}` scaffolded (deliverable 15)
- [ ] `tooling/docker/docker-compose.yml` present (deliverable 17)
- [ ] `tooling/scripts/seed-*.ts` present (deliverable 16)
- [ ] Branch protection on `main` (deliverable 20)
- [ ] Required status checks configured (deliverable 21)
- [ ] Labels synced from `labels.yml` (deliverable 25)
- [ ] Milestones created (deliverable 26)
- [ ] Project board created (deliverable 27)
- [ ] Initial commit signed off (DCO optional)

Rationale: this checklist is the acceptance test for Step 1. Every item maps to a deliverable so nothing is missed.

- [ ] **Step 2: Commit the design doc**

```bash
git add docs/REPOSITORY-DESIGN.md
git commit -m "docs: add repository design (Step 1 — 28 deliverables)"
```

---

## Task 2: Author the ADR template + the already-referenced ADR-001

**Files:**

- Create: `docs/architecture/adr/000-record-architecture-decisions.md`
- Create: `docs/architecture/adr/001-modular-monolith-nextjs.md`

**Interfaces:**

- Produces: the ADR index + the ADR the README links to (so the README link resolves)

- [ ] **Step 1: Write the ADR template/index**

Create `docs/architecture/adr/000-record-architecture-decisions.md`:

```markdown
# Record Architecture Decisions

We capture significant architecture decisions as [ADRs](https://adr.github.io/) using the format from Michael Nygard's template.

## Format

Each ADR is a file `NNN-title.md` containing:

- **Status** — proposed | accepted | deprecated | superseded
- **Context** — the forces at play (technical, organizational, constraints)
- **Decision** — what we decided
- **Consequences** — what becomes easier/harder as a result

## Index

| ADR | Title                                    | Status   |
| --- | ---------------------------------------- | -------- |
| 001 | Modular monolith with Next.js App Router | accepted |
```

- [ ] **Step 2: Write ADR-001**

Create `docs/architecture/adr/001-modular-monolith-nextjs.md`:

```markdown
# ADR-001 — Modular monolith with Next.js App Router

- **Status:** accepted
- **Context:** The platform needs a UI that can evolve from a single product (web) to multiple surfaces (admin, mobile) without premature microservice overhead. The team is small-to-mid sized and values fast iteration, shared types, and a single deploy pipeline.
- **Decision:** Adopt a modular monolith inside a Turborepo: a single Next.js App Router application (`apps/web`) consuming shared packages (`@nexus/ui`, `@nexus/db`, `@nexus/cache`). Modules are bounded by directory and package boundaries, not network calls. Extract services only when a clear scaling or team-boundary need emerges.
- **Consequences:** Easier local development, single deploy, shared types. Risk of tight coupling — mitigated by package boundaries and ADR-governed extraction criteria.
```

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/adr
git commit -m "docs(adr): add ADR template and ADR-001 modular monolith"
```

---

## Task 3: Author the roadmap + M1 spec the README links to

**Files:**

- Create: `docs/master-roadmap.md`
- Create: `docs/milestone-1-project-foundation.md`
- Create: `docs/README.md`

**Interfaces:**

- Produces: the roadmap + M1 spec the README links to; the docs index

- [ ] **Step 1: Write the master roadmap**

Create `docs/master-roadmap.md`:

```markdown
# Master Roadmap

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

Each milestone has a spec in `docs/milestones/`.
```

- [ ] **Step 2: Write the M1 spec**

Create `docs/milestones/milestone-1-project-foundation.md` (and the README link target `docs/milestone-1-project-foundation.md`):

```markdown
# M1 — Project Foundation

## Goal

Establish the monorepo, design system primitives, and local dev infrastructure.

## Scope

- Turborepo + pnpm workspace
- `@nexus/ui` component library (shadcn/ui-based)
- Local docker-compose (Postgres, Redis, Mailpit)
- CI pipeline (lint, typecheck, test, build)

## Done criteria

- [ ] `pnpm dev` starts the web app
- [ ] Design system showcase renders at `/dev/components`
- [ ] CI green on `main`
```

- [ ] **Step 3: Write the docs index**

Create `docs/README.md`:

```markdown
# Docs

Long-lived design records for Nexus Anime.

- [Master Roadmap](master-roadmap.md)
- [Repository Design](REPOSITORY-DESIGN.md) — repo constitution (28 deliverables)
- [Architecture Decision Records](architecture/adr/)
- [Milestone specs](milestones/)

## How to author an ADR

See [`architecture/adr/000-record-architecture-decisions.md`](architecture/adr/000-record-architecture-decisions.md).
```

- [ ] **Step 4: Commit**

```bash
git add docs/
git commit -m "docs: add roadmap, M1 spec, docs index"
```

---

## Task 4: Populate `.github/` templates, labels, and CI workflow

**Files:**

- Create: `.github/CODE_OF_CONDUCT.md`
- Create: `.github/CONTRIBUTING.md`
- Create: `.github/SECURITY.md`
- Create: `.github/PULL_REQUEST_TEMPLATE.md`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Create: `.github/labels.yml`
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`

**Interfaces:**

- Produces: the PR template, issue templates, labels, and the CI workflow that defines the required status checks (deliverable 21)

- [ ] **Step 1: CODE_OF_CONDUCT**

Create `.github/CODE_OF_CONDUCT.md` using the Contributor Covenant 2.1 (standard text; replace contact with the project's email).

- [ ] **Step 2: CONTRIBUTING**

Create `.github/CONTRIBUTING.md`:

```markdown
# Contributing

Thanks for your interest. Please read before submitting.

## Workflow

1. Fork or branch from `main` (see branch naming in `docs/REPOSITORY-DESIGN.md`).
2. Open a PR using the template.
3. CI must pass (lint, typecheck, test, build, format:check).
4. Obtain ≥ 1 review.
5. Squash & merge.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/).

## Local setup

See the README quick start.
```

- [ ] **Step 3: SECURITY**

Create `.github/SECURITY.md`:

```markdown
# Security Policy

## Reporting

Please report vulnerabilities to <security@example.com>. Do NOT open public issues for security bugs.

## Supported versions

Only the latest release on `main` is supported.
```

- [ ] **Step 4: PR template**

Create `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## Summary

<!-- What does this PR do? -->

## Motivation

<!-- Why is this change needed? -->

## Testing

<!-- How did you verify it? -->

## Screenshots (if UI)

## Checklist

- [ ] CI passes
- [ ] Conventional Commit title
- [ ] Docs updated (if needed)
```

- [ ] **Step 5: Issue templates**

Create `.github/ISSUE_TEMPLATE/config.yml`:

```yaml
blank_issues_enabled: false
contact_links:
  - name: Security
    url: mailto:security@example.com
    about: Report vulnerabilities privately.
```

Create `.github/ISSUE_TEMPLATE/bug_report.yml`:

```yaml
name: Bug Report
description: Report a bug
labels: ["bug", "needs-triage"]
body:
  - type: textarea
    id: what
    attributes:
      label: What happened?
    validations:
      required: true
  - type: textarea
    id: repro
    attributes:
      label: Steps to reproduce
    validations:
      required: true
  - type: input
    id: env
    attributes:
      label: Environment (browser, OS, version)
```

Create `.github/ISSUE_TEMPLATE/feature_request.yml`:

```yaml
name: Feature Request
description: Suggest an idea
labels: ["feature", "needs-triage"]
body:
  - type: textarea
    id: problem
    attributes:
      label: Problem
    validations:
      required: true
  - type: textarea
    id: solution
    attributes:
      label: Proposed solution
```

- [ ] **Step 6: Labels**

Create `.github/labels.yml`:

```yaml
- name: "bug"
  color: "d73a4a"
  description: "Something isn't working"
- name: "feature"
  color: "a2eeef"
  description: "New functionality"
- name: "docs"
  color: "0075ca"
  description: "Documentation"
- name: "chore"
  color: "cfd3d7"
  description: "Maintenance"
- name: "refactor"
  color: "c5def5"
  description: "Code change that neither fixes a bug nor adds a feature"
- name: "priority:critical"
  color: "b60205"
- name: "priority:high"
  color: "d93f0b"
- name: "priority:medium"
  color: "fbca04"
- name: "priority:low"
  color: "0e8a16"
- name: "blocked"
  color: "000000"
- name: "good-first-issue"
  color: "7057ff"
  description: "Good for newcomers"
- name: "help-wanted"
  color: "008672"
- name: "scope:web"
  color: "5319e7"
- name: "scope:ui"
  color: "5319e7"
- name: "scope:db"
  color: "5319e7"
- name: "scope:cache"
  color: "5319e7"
- name: "scope:ci"
  color: "5319e7"
- name: "scope:docs"
  color: "5319e7"
```

- [ ] **Step 7: CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build

  format:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm format:check
```

- [ ] **Step 8: Release workflow**

Create `.github/workflows/release.yml`:

```yaml
name: Release
on:
  push:
    tags: ["v*"]

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
```

- [ ] **Step 9: Commit**

```bash
git add .github/
git commit -m "ci: add PR/issue templates, labels, CI and release workflows"
```

---

## Task 5: Add LICENSE, .nvmrc, .env.example, and patch .gitignore

**Files:**

- Create: `LICENSE`
- Create: `.nvmrc`
- Create: `.env.example`
- Modify: `.gitignore`

**Interfaces:**

- Produces: the files the README quick start and prerequisites reference

- [ ] **Step 1: LICENSE**

Create `LICENSE` with the MIT license text (year 2026, copyright holder = the project owner).

- [ ] **Step 2: .nvmrc**

Create `.nvmrc` containing:

```
22
```

- [ ] **Step 3: .env.example**

Create `.env.example`:

```env
# Copy to apps/web/.env.local and fill in.
# Database (Neon)
DATABASE_URL=

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Auth.js
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# Stripe (S5+)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Cloudflare Stream (S6+)
CLOUDFLARE_STREAM_TOKEN=
```

- [ ] **Step 4: Patch .gitignore**

Append to `.gitignore`:

```
# Next.js
.next/
out/

# Turbo
.turbo/

# pnpm
node_modules/

# Env
.env
.env.local
.env.*.local

# Build
dist/
build/

# OS
.DS_Store
*.log
```

- [ ] **Step 5: Commit**

```bash
git add LICENSE .nvmrc .env.example .gitignore
git commit -m "chore: add MIT license, .nvmrc, .env.example, patch .gitignore"
```

---

## Task 6: Add docker-compose + seed scripts (tooling/)

**Files:**

- Create: `tooling/docker/docker-compose.yml`
- Create: `tooling/scripts/seed-admin.ts`
- Create: `tooling/scripts/seed-anime.ts`
- Create: `tooling/scripts/seed-catalog.ts`

**Interfaces:**

- Produces: the files the root `package.json` scripts and README reference

- [ ] **Step 1: docker-compose**

Create `tooling/docker/docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: nexus
      POSTGRES_PASSWORD: nexus
      POSTGRES_DB: nexus
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  mailpit:
    image: axllent/mailpit
    ports:
      - "1025:1025"
      - "8025:8025"

volumes:
  pgdata:
```

- [ ] **Step 2: Seed scripts**

Create `tooling/scripts/seed-admin.ts`:

```ts
// Dev-only seed: creates an admin user + roles.
// Run with: pnpm tsx tooling/scripts/seed-admin.ts
console.log("seed-admin: not implemented yet");
```

Create `tooling/scripts/seed-anime.ts`:

```ts
// Dev-only seed: seeds anime catalog metadata.
// Run with: pnpm tsx tooling/scripts/seed-anime.ts
console.log("seed-anime: not implemented yet");
```

Create `tooling/scripts/seed-catalog.ts`:

```ts
// Dev-only seed: seeds genres, tags, relations.
// Run with: pnpm tsx tooling/scripts/seed-catalog.ts
console.log("seed-catalog: not implemented yet");
```

- [ ] **Step 3: Commit**

```bash
git add tooling/
git commit -m "chore: add docker-compose and seed script stubs"
```

---

## Task 7: Add a "Repository conventions" section to the README

**Files:**

- Modify: `README.md`

**Interfaces:**

- Produces: a pointer from the README to the new design doc (no app-code changes)

- [ ] **Step 1: Append the conventions section**

Append to `README.md`:

```markdown
## Repository conventions

The repository's branch strategy, workflow, versioning, folder structure, and process rules are defined in [`docs/REPOSITORY-DESIGN.md`](docs/REPOSITORY-DESIGN.md). Read it before creating branches, PRs, or issues.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(readme): point to repository design doc"
```

<longcat_arg_value>
