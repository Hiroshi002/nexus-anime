# Git Workflow — Nexus Anime

> **Audience:** Everyone who creates, reviews, or merges a branch in this repository.
> **Status:** Accepted. Parts of this document are enforced by GitHub branch protection, pre-commit hooks, and CI; the rest by code review. Changes are proposed via PR against this file.
> **Related:** [Coding Standards](./Coding-Standards.md) · [Naming Conventions](./Naming-Conventions.md) · [Folder Conventions](./Folder-Conventions.md) · [Repository Design §6–§8, §19–§24](../../REPOSITORY-DESIGN.md) · [CONTRIBUTING.md](../../CONTRIBUTING.md)

This document defines the end-to-end workflow from branch creation to merge. It is the operational companion to the design conventions: _what to name, where to branch, what a commit looks like, when to rebase, and how we ship a hotfix._

---

## 1. Model: Trunk-Based Development

We use **trunk-based development** over a single long-lived branch:

- **`main`** is the only long-lived branch. It is always deployable. It is protected by branch protection, required status checks, and at least one reviewer.
- **All work happens on short-lived branches** off `main`. Branches are merged back via PR, ideally within a few days of creation. Long-lived branches are the exception, not the rule.
- **No long-lived `develop` branch.** Releases are cut from `main` via tags, not via a permanent integration branch.
- **Hotfixes** branch from the most recent release tag; the fix is applied, tested, and then cherry-picked back into `main`.

Why: continuous integration keeps branches small and mergeable. Long-lived branches diverge, accumulate invisible conflicts, and erode the "always deployable" invariant on `main`.

---

## 2. Branch Naming

### 2.1 Canonical shape (R)

```
<type>/<milestone>-<short-slug>
```

Where:

- `type` ∈ `feature`, `bugfix`, `chore`, `docs`, `refactor`, `hotfix`, `release`
- `milestone` ∈ `m0..mN` (e.g. `m3`) — ties the branch to the roadmap
- `slug` — kebab-case, ≤ 30 characters, descriptive of the change

### 2.2 Examples (P)

| Branch                     | Meaning                                      |
| -------------------------- | -------------------------------------------- |
| `feature/m3-auth-oauth`    | GitHub OAuth provider, milestone 3           |
| `bugfix/m3-login-redirect` | Login redirect fix, milestone 3              |
| `docs/repository-design`   | Docs-only change (no milestone needed)       |
| `refactor/m2-cache-keys`   | Cache key helper refactor, milestone 2       |
| `hotfix/m2-cache-race`     | Urgent M2 cache race fix (branched from tag) |
| `release/v0.3.0`           | Release preparation for 0.3.0                |

### 2.3 Rules

- **`feature`** for user-visible increments.
- **`bugfix`** for non-urgent bug resolution.
- **`chore`** for dependency updates, tooling, CI, README updates with no feature change.
- **`docs`** for documentation, ADRs, decisions.
- **`refactor`** for code changes that neither fix a bug nor add a feature.
- **`hotfix`** for urgent production/security fixes to an already-tagged release.
- **`release`** for release preparation (version bumps, changelog finalization).

### 2.4 Do not

- Use your own name as a branch prefix (`hiroshi/...`).
- Use ticket-only identifiers (`PROJ-1234`) — ticket links live in PR descriptions.
- Leave generic branches (`fix`, `patch`, `stuff`). These defeat the purpose of the naming convention.

---

## 3. Commit Workflow

### 3.1 Small, atomic commits (P)

Each commit is a **complete, self-contained step** that leaves the project in a working state. Commits answer the question: _what single, small, observable change was made?_

- One concern per commit. If a commit says "and" in its title, it is likely two commits.
- Compile after every commit locally (`pnpm typecheck` passes before pushing).
- Do not use `git commit -m "wip"` and then push six wip commits. Rebase/squash them into coherent commits before opening a PR.

```bash
# Wrong — a single "everything" commit
git commit -m "done with auth"

# Right — three atomic commits
git commit -m "feat: add GitHub OAuth provider"
git commit -m "feat: wire GitHub callback to session"
git commit -m "test: cover GitHub callback error paths"
```

### 3.2 Commit messages follow Conventional Commits (R)

We use the [Conventional Commits](https://www.conventionalcommits.org/) spec, paired with [Semantic Versioning](https://semver.org/) as described in [Repository Design §9](../../REPOSITORY-DESIGN.md).

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**

| Prefix                    | Meaning                                                 | SemVer bump |
| ------------------------- | ------------------------------------------------------- | ----------- |
| `feat`                    | New feature                                             | MINOR       |
| `fix`                     | Bug fix                                                 | PATCH       |
| `docs`                    | Documentation only                                      | —           |
| `chore`                   | Maintenance, tooling, dependencies                      | —           |
| `refactor`                | Code change that neither fixes a bug nor adds a feature | —           |
| `test`                    | Adding or correcting tests                              | —           |
| `BREAKING CHANGE` in body | Breaking change to a public API or data model           | MAJOR       |

A `!` after the type/scope signals a breaking change: `feat!: redesign auth callback`.

**Rules:**

- The description is imperative, lowercase, no trailing period: `feat: add watchlist endpoint`, not `feat: Added watchlist endpoint.`
- The body explains _why_, not _what_. Reference issues and ADRs: `Refs: ADR-003`, `Closes: #142`.
- The footer carries metadata: `BREAKING CHANGE:`, `Refs:`, `Co-authored-by:`.

**Examples:**

```
feat(catalog): add anime search endpoint

Implements full-text search over anime titles and synonyms.
Uses Postgres `tsvector` with GIN index; see ADR-005 for the
indexing strategy.

Refs: #88
```

```
fix(auth): handle expired JWT on /watch

Expired tokens were returning 500 instead of 401. Now the
session guard returns a typed UNAUTHORIZED error so the client
can redirect to login.

Closes: #201
```

### 3.3 PR title is the squash commit (R)

The PR title **must** follow Conventional Commits, because the squash-merge commit on `main` uses the PR title as its message. A bad PR title becomes a bad commit in `main` history.

---

## 4. Syncing with `main`

### 4.1 Keep your branch up to date (R)

Before opening a PR and before merging, your branch must be **up to date with `main`**. Branch protection enforces this.

### 4.2 Rebase, do not merge `main` into your branch (P)

To bring your branch up to date, **rebase onto `main`** rather than merging `main` into your branch. Rebasing replays your commits on top of the latest `main`, producing a linear history without merge commits.

```bash
git checkout feature/m3-auth-oauth
git fetch origin
git rebase origin/main
```

If conflicts arise during rebase, resolve them in the affected files, `git add`, and `git rebase --continue`. Do not `git rebase --abort` and fall back to a merge commit — that defeats the purpose.

### 4.3 Never rebase shared branches (R)

**Do not rebase any branch that another person is working on or that has been pushed for review without coordination.** Rebasing rewrites history; if someone else has based work on your branch, their local copy diverges.

Rule of thumb:

- **Local-only branches** (not pushed, or pushed but only you work on): rebase freely.
- **Shared branches** (open PR with reviewers, or pair-programmed): coordinate before rebasing. Prefer merging `main` into the branch if a rebase would surprise others.

---

## 5. Handling Merge Conflicts

Conflicts are a signal that two changes touched the same concern. Resolve them deliberately:

1. **Understand both sides.** Read the incoming change and your own. Do not just pick "yours" — the incoming change may carry a fix you did not see.
2. **Resolve in the affected file.** Edit the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) into the correct merged content.
3. **Verify the merge compiles.** Run `pnpm typecheck` and `pnpm lint` after resolving.
4. **Commit the resolution.** For a rebase: `git add . && git rebase --continue`. For a merge: `git add . && git commit`.
5. **Do not** commit conflict markers. ESLint and pre-commit hooks should catch this, but verify.

If a conflict is large or touches unfamiliar code, pair with the author of the other change rather than guessing.

---

## 6. Pull Request Workflow

### 6.1 Opening a PR (R)

1. Push your branch: `git push -u origin feature/m3-auth-oauth`.
2. Open a PR against `main` using the template at `.github/PULL_REQUEST_TEMPLATE.md`.
3. Fill in **Summary**, **Motivation**, **Testing** steps.
4. Include **screenshots or screen recordings** for any UI change.
5. Link related issues (`Closes #142`, `Refs #88`).

### 6.2 Required CI gates (R)

All five gates must pass before merge:

| Gate        | Command             | What it gates                         |
| ----------- | ------------------- | ------------------------------------- |
| `lint`      | `pnpm lint`         | Code style + correctness (ESLint)     |
| `typecheck` | `pnpm typecheck`    | Type safety (TypeScript strict)       |
| `test`      | `pnpm test`         | Behavior (Vitest unit tests)          |
| `build`     | `pnpm build`        | Production build succeeds (Turborepo) |
| `format`    | `pnpm format:check` | Formatting conformance (Prettier)     |

### 6.3 Review (R)

- At least **one approving review** from a maintainer is required.
- All review conversations must be resolved before merge.
- Reviewers check: correctness, type safety, security, performance, adherence to conventions, and test coverage.
- Authors respond to comments with code changes or clarifying comments; resolve the conversation when addressed.

### 6.4 Merge strategy: squash by default (R)

| Strategy                       | When to use                                             |
| ------------------------------ | ------------------------------------------------------- |
| **Squash and merge** (default) | Most PRs — produces one clean commit on `main` per PR   |
| Create a merge commit          | Multi-commit PRs that tell a coherent, reviewable story |
| Rebase and merge               | **Disabled** — avoids rewriting shared history          |

The squash commit's title becomes the changelog entry, so the PR title must follow Conventional Commits.

### 6.5 Post-merge cleanup (R)

- **Delete the feature branch** after merge (GitHub can do this automatically).
- Verify the deployment (Vercel preview → production) if applicable.
- Close linked issues if the PR description did not auto-close them.

---

## 7. Hotfix Process

Hotfixes are for **urgent production or security issues** on an already-released version.

### 7.1 When to hotfix

- A critical bug affecting users on a released version.
- A security vulnerability in released code.
- A data-corruption risk that cannot wait for the next regular release.

Non-urgent fixes go through the normal PR flow.

### 7.2 Steps

1. **Branch from the most recent release tag**, not from `main`:
   ```bash
   git fetch --tags
   git checkout -b hotfix/v0.3.1 v0.3.0
   ```
2. **Apply the minimal fix.** One commit, focused on the issue. Do not bundle unrelated cleanup.
3. **Test.** Run the full CI suite locally; add a regression test if one is missing.
4. **Open a PR** against the release branch (or directly against `main` if the release branch is `main`). Mark it `hotfix` in the title: `hotfix: resolve session race on /watch`.
5. **Merge** via squash.
6. **Tag the new release** on `main`:
   ```bash
   git checkout main
   git pull --ff-only
   git tag -a v0.3.1 -m "release: v0.3.1 — session race fix"
   git push origin v0.3.1
   ```
7. **Cherry-pick to `main`** if the hotfix was applied to a release branch that is not `main`:
   ```bash
   git checkout main
   git cherry-pick <hotfix-commit-sha>
   git push origin main
   ```
8. **Verify** the fix on the production deployment.

### 7.3 Rules

- Hotfix branches are **never** long-lived. Merge and delete within hours, not days.
- The hotfix commit must include a **regression test** proving the bug stays fixed.
- Tag immutability: never force-push a published tag. If a release is wrong, release a new patch version.

---

## 8. Rebasing vs. Merging

### 8.1 Summary

| Situation                              | Action                                                             |
| -------------------------------------- | ------------------------------------------------------------------ |
| Local branch, not pushed               | Rebase freely                                                      |
| Local branch, pushed, only you work on | Rebase, then force-push with lease (`git push --force-with-lease`) |
| Shared branch (open PR with reviewers) | Coordinate before rebase; prefer merge `main` into branch          |
| Bringing `main` into your branch       | Rebase your branch onto `main`                                     |
| Merging your branch into `main`        | Squash and merge (default)                                         |

### 8.2 Why rebase local branches

Rebasing produces a **linear, readable history** on `main`. Each commit is a coherent step, and the merge is a fast-forward or a single squash commit. Merge commits from `main` into feature branches clutter the history with "merge main into feature" noise.

### 8.3 Why never rebase shared branches

Rebasing rewrites commit hashes. If a reviewer has pulled your branch, their local copy diverges from the rebased remote. They must reset their local copy, losing any in-progress review work. The rule "never rebase shared branches" prevents this.

### 8.4 Force-push safely

When force-pushing a rebased branch, always use `--force-with-lease`, not `--force`. `--force-with-lease` aborts if the remote has commits you have not seen, preventing accidental overwrite of someone else's work.

```bash
git push --force-with-lease origin feature/m3-auth-oauth
```

---

## 9. Pre-Commit Hooks

### 9.1 What runs on commit (R)

Pre-commit hooks (via `lint-staged` + `simple-git-hooks` / `husky`) run on staged files before a commit is created:

| Hook         | What it does                                          |
| ------------ | ----------------------------------------------------- |
| `pre-commit` | Runs `lint-staged`: ESLint + Prettier on staged files |
| `pre-push`   | Runs `pnpm typecheck` on the current package          |

These are **local** hooks. They catch the most common issues before they reach CI, but they are not a substitute for CI — CI is the source of truth.

### 9.2 Rules

- **Do not bypass hooks** with `git commit --no-verify` to "just get this in." If a hook is wrong, fix the hook, not the bypass.
- If a hook fails, read the error, fix the issue, re-stage, and re-commit.
- Hooks are configured in the repo (`.git-hooks/` or `package.json` `simple-git-hooks` section). They apply to everyone; do not disable them locally.

### 9.3 Typecheck on staged files (P)

The pre-push hook runs `pnpm typecheck` to catch type errors before they reach CI. This is a workspace-wide check — it may take a few seconds. If it fails, fix the type errors before pushing.

---

## 10. Tagging & Releases

### 10.1 Tag strategy (R)

- Tags mark **releases only**: `v<semver>` (e.g. `v0.3.0`, `v0.3.1`, `v1.0.0`).
- **Annotated tags** (`git tag -a v0.3.0 -m "release: v0.3.0"`) — record author, date, and release notes.
- **Immutable** — never force-push a published tag. If a release is wrong, release a new patch version.
- Tags are created from `main` (or from a `release/vX.Y.Z` branch during release prep).

### 10.2 Pre-release suffixes (P)

During milestones, pre-release suffixes signal "not stable yet":

- `v0.3.0-alpha.1`
- `v0.3.0-beta.1`
- `v0.3.0-rc.1`

These are not considered production-ready.

### 10.3 `v1.0.0` (P)

The first stable public release, targeted at feature-complete launch (M7). Before `v1.0.0`, the API and data model are considered unstable and may change without a major version bump.

---

## 11. Do Not

| Anti-pattern                                    | Why                                           | Fix                                      |
| ----------------------------------------------- | --------------------------------------------- | ---------------------------------------- |
| `git push origin main` directly                 | Branch protection rejects it; bypasses review | Open a PR                                |
| `git commit -m "fix"`                           | Useless history                               | Conventional Commits with description    |
| `git merge main` into feature branch repeatedly | Clutters history with merge commits           | Rebase onto `main`                       |
| `git rebase` on a shared branch                 | Rewrites history others depend on             | Coordinate or merge                      |
| `git push --force`                              | Can silently overwrite others' work           | `--force-with-lease`                     |
| `git commit --no-verify` to bypass hooks        | Defeats the purpose of hooks                  | Fix the underlying issue                 |
| Long-lived feature branches                     | Diverge from `main`, accumulate conflicts     | Short-lived branches, merged within days |
| Force-pushing a published tag                   | Breaks downstream users who pinned the tag    | Release a new patch version              |

---

## 12. Quick Reference

```bash
# Start a new feature
git checkout main
git pull --ff-only
git checkout -b feature/m3-auth-oauth

# Work, commit, repeat
git add -A
git commit -m "feat: add GitHub OAuth provider"

# Keep up to date with main
git fetch origin
git rebase origin/main

# Push and open PR
git push -u origin feature/m3-auth-oauth
# ... open PR, CI runs, review, squash-merge, delete branch

# Hotfix
git fetch --tags
git checkout -b hotfix/v0.3.1 v0.3.0
# ... fix, test, merge, tag v0.3.1, cherry-pick to main
```

---

When this document conflicts with `REPOSITORY-DESIGN.md`, `CONTRIBUTING.md`, or an accepted ADR, the other document wins and this one should be updated to match.
