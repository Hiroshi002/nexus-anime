# Branching Strategy

Trunk-based development with short-lived branches and a single deployable `main` line.

## Branching Model

```
main (always deployable)
  │
  ├── feature/m3-oauth-callback        ← short-lived (hours, max 1–2 days)
  │     └── PR #142 → squash → main
  │
  ├── bugfix/m3-login-redirect         ← short-lived
  │     └── PR #143 → squash → main
  │
  ├── hotfix/v1.0.1-login-expiry       ← branched from tag, cherry-picked
  │     └── PR #144 → main + tag v1.0.1
  │
  └── release/v1.1.0                   ← stabilization window (≤ 48h)
        └── PR #145 → main + tag v1.1.0
```

Rules of thumb:

- Every commit on `main` is a candidate for production.
- Branches diverge from `main` and merge back within hours — never days.
- If a branch lives longer than 2 days, split it or rebase onto a fresh `main`.

## Branch Lifecycle

1. **Create** — branch from `main` (or a release tag for hotfixes). Keep the branch local until the first push; do not push WIP that breaks CI.
2. **Commit** — follow the [Commit Convention](./Commit-Convention.md). Each commit must be atomic and pass lint + typecheck locally before pushing.
3. **Open PR** — open early as a draft to get early reviewer signal. Mark ready for review only when CI is green and the scope is final.
4. **Review** — at least one approval, all status checks passing, all conversations resolved.
5. **Merge** — squash-and-merge by default (see [Pull Request Standards](./Pull-Request-Request-Standards.md)).
6. **Delete** — the remote branch is deleted automatically on merge. Close any linked tracking issues.

Never merge a red CI into `main`. Never push directly to `main` — every change goes through a PR.

## Branch Types

| Type | When to use | Branches from | Merges to |
|------|-------------|---------------|-----------|
| `feature` | New capability (OAuth, catalog page, sidebar drawer) | `main` | `main` |
| `bugfix` | Defect that blocks the user path but is not production-critical | `main` | `main` |
| `chore` | Dependency bump, config change, housekeeping with no user-visible effect | `main` | `main` |
| `docs` | Documentation or ADR additions with no code change | `main` | `main` |
| `refactor` | Behavior-preserving restructure (rename, extract helper, simplify types) | `main` | `main` |
| `hotfix` | Production defect that must ship immediately | annotated tag on `main` | `main` (cherry-pick or squash from hotfix branch) |
| `release` | Final stabilization before a version tag (QA, polish, changelog) | `main` at freeze | `main` + annotated tag |

Every branch follows the `<type>/<milestone>-<slug>` naming convention. Examples:

- `feature/m3-oauth-callback`
- `bugfix/m3-login-redirect-loop`
- `chore/m4-upgrade-next-16`
- `hotfix/v1.0.1-session-expiry`
- `release/v1.1.0`

The milestone segment is required (`m3`, `m4`, …). The slug is ≤ 30 kebab-case characters and describes the change, not the ticket.

## Milestone Branches

Milestone branches are **not** long-lived integration branches. We do not use `develop`. The milestone segment in the branch name is taxonomical only — it groups work for bookkeeping and reporting.

Use a shared milestone branch only when a release needs coordinated stabilization across multiple features (e.g. `release/v1.1.0`). Even then, individual feature branches still target `main`; the release branch is created late (freeze), merges in the final feature branches, and closes within 48 hours.

## Hotfix Flow

Production defects follow a disciplined hotfix path to avoid shipping regressions:

1. Create the hotfix branch from the **annotated tag** on `main` that corresponds to the broken production version: `git checkout -b hotfix/v1.0.1-session-expiry v1.0.0`.
2. Make the minimal Add or update a regression test so the defect cannot return silently.
3. Open a PR targeting `main`. The PR title **must** follow Conventional Commit: `fix(auth): refresh session before expiry check`.
4. CI must be green (lint, typecheck, test, build, format). At least one reviewer must approve.
5. Squash-and-merge into `main`.
6. Immediately create an annotated tag on `main`: `git tag -a v1.0.1 -m "fix(auth): refresh session before expiry check"`.
7. Deploy the tag through CI.

For critical fixes where a full CI cycle is too slow, the maintainer may fast-track with a post-merge monitoring window — but the same tag and PR discipline applies.

## Release Flow

A release is a **freeze → stabilize → tag** sequence, not a long-lived code split.

1. **Freeze** — decide the release scope. No new features merge after freeze; only docs, polish, and bug fixes.
2. **Create the release branch**: `git checkout -b release/v1.1.0 main`.
3. **Stabilize** — bug fixes targeted at the release branch as `bugfix/release-v1.1.x-*. Run the full QA checklist.
4. **Changelog** — generate the changelog from the conventional commits on `main` since the last tag. Commit it directly to the release branch.
5. **Merge** — open a PR from `release/v1.1.0` to `main`. Squash-and-merge.
6. **Tag** — `git tag -a v1.1.0 -m "release: v1.1.0"` on the merged commit. Tags are **annotated** and **immutable** — never move a tag after it is pushed.
7. **Delete** the release branch and deploy the tag.

Hotfixes after the release branch opens are merged into `main` as usual and cherry-picked into `release/v1.1.0` to keep the lines consistent.

## Branch Protection Rules

The `main` branch is protected. The configuration is checked into the repository (see `.github/settings.yml` or repository rules) and enforced by GitHub:

- **Require a PR before merging** — direct pushes to `main` are blocked.
- **1 approval** from a code owner. Reviews from the author of the PR do not count.
- **Require status checks to pass** — all five CI gates must be green: `lint`, `typecheck`, `test`, `build`, `format`. Do not allow merge on cancelled or skipped checks.
- **Require conversation resolution** — every review comment must be resolved (not just addressed) before merge.
- **No force push** — force push to `main` is disabled for everyone, including admins.
- **No delete** — the `main` branch cannot be deleted.
- **Require branches to be up to date** — the working branch must be rebased onto the latest `main` before merge.

Feature branches are not protected (except by CI), but must be deleted after merge. Configure "auto-delete head branches" at the repository level.

## Why Trunk-Based Over GitFlow

We chose trunk-based development because the cost of long-lived branches compounds quickly:

- **Merge debt** — days-divergent branches produce merge conflicts that grow super-linearly with divergence time. Short-lived branches merge back within hours, so conflicts stay small and mechanical.
- **Continuous integration** — every commit on `main` is a true integration point. Developers integrate continuously, not in batch at the end of a cycle. Integration bugs surface in minutes, not days.
- **Smaller PRs** — a branch that lives an hour has a diff measured in tens or hundreds of lines. A branch that lives a week has a diff measured in thousands. Reviewers can meaningfully read a 200-line PR; they skim a 2000-line PR.
- **Simpler mental model** — there is one line (`main`). There is no `develop` vs `main` confusion, no "which branch do I rebase onto?" ambiguity, no long-running integration queue.

GitFlow is well-suited to projects with multiple concurrent production versions (e.g. desktop software on a quarterly cadence). We ship a single version of a continuously deployed SaaS application, and our release cadence is expressed through tags, not branches.

## Conflict Resolution

Branches diverge from `main` and `main` continues to move. The longer a branch lives, the more likely a conflict when resolving the merge. Living with this reality is the discipline that keeps branches short.

### Prevention

- **Rebase early, rebase often** — rebase your branch onto `main` at least once a day. Conflicts resolved incrementally stay small. To rebase: `git fetch origin && git rebase origin/main`.
- **PR size** — smaller diffs have fewer conflict hotspots. See size limits in [Pull Request Standards](./Pull-Request-Standards.md).
- **Avoid file-level contention** — do not refactor a large shared file (e.g. `packages/ui/src/theme/tokens.ts`) on the same day as a feature that depends on that file. Coordinate in chat, or land the refactor first.

### During Rebase

When `git rebase origin/main` produces conflicts:

1. Pause and read both sides of the conflict — do not blindly take "ours" or "theirs". Conflicting intent must be reconciled consciously.
2. If conflict is pure churn (someone else touched the same 3 lines with a maintenance commit), take the newer version and preserve your own intent.
3. If conflict contains intent from both branches, re-read both PRs to understand the mental model before stitching.
4. After resolving, run `pnpm check` before continuing the rebase — merge artifacts causing a type error inside an unresolved conflict are a common source of mainline regressions.

### After Merge

If a merge into `main` introduces a defect that slips past CI (rare), revert the squash commit with `git revert <SHA>` — do **not** revert with a fix-forward on a hotfix branch unless the defect is production-critical. The revert preserves the audit trail and can be reverted-again once the corrected version ships.

## Further Reading

- [Commit Convention](./Commit-Convention.md) — how to format the commits that land on `main`.
- [Pull Request Standards](./Pull-Request-Standards.md) — PR template, size guidelines, and CI requirements.
- `docs/REPOSITORY-DESIGN.md` — monorepo layout and ownership.
- `docs/milestones/master-roadmap.md` — the milestone taxonomy referenced in branch names.
