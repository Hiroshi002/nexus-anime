# Release Process

> How we turn working code into a versioned, deployed, verified release. Milestone-based, not time-based — we ship when the work is done, not when the calendar says so.

## Release Philosophy

A release is a promise to users. Every tag we cut is a commitment that the software at that point is safe, functional, and worth upgrading to. We do not ship on a fixed cadence just to stay busy, and we do not hold releases hostage to half-finished features.

We release when a milestone (or a set of milestones) meets the [Definition of Done](./Definition-of-Done.md). Pre-release suffixes (alpha, beta, rc) let us ship work-in-progress to staging and early adopters without pretending it is stable.

## Release Cadence

**Milestone-based.** A release happens when:

- A milestone meets all its acceptance criteria, or
- A set of accumulated fixes and features justifies a version bump, or
- A critical hotfix must ship immediately.

There is no fixed schedule. We do not rush a release to hit an arbitrary date, and we do not delay a release that is ready. If a milestone ships in 3 weeks, the release happens in 3 weeks. If it ships in 3 months, the release happens in 3 months.

Pre-release cadence within a milestone follows a predictable progression:

| Stage             | Suffix    | Audience                   | Stability bar                 |
| ----------------- | --------- | -------------------------- | ----------------------------- |
| Early development | `alpha.x` | Internal only              | May break, may have gaps      |
| Feature-complete  | `beta.x`  | Internal + invited testers | Core paths work, known issues |
| Stabilization     | `rc.x`    | Staging + early adopters   | No critical bugs, polish only |
| Stable            | (none)    | Public                     | Full DoD met                  |

A version does not advance to the next stage until the current stage's bar is met. An `alpha` does not become a `beta` until feature-complete. A `beta` does not become an `rc` until no critical bugs remain. An `rc` does not become stable until the full milestone DoD is satisfied.

## Version Bumping Rules

We follow [SemVer 2.0.0](https://semver.org/). Every version is `MAJOR.MINOR.PATCH` with optional pre-release suffix.

| Change type                                      | Commit prefix                                  | Version bump                                     |
| ------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------ |
| Bug fix with no breaking change                  | `fix:`                                         | PATCH (`1.0.0` → `1.0.1`)                        |
| New feature, backward-compatible                 | `feat:`                                        | MINOR (`1.0.0` → `1.1.0`)                        |
| Breaking change (API contract, schema, behavior) | `BREAKING CHANGE` in footer, or `!` after type | MAJOR (`1.0.0` → `2.0.0`)                        |
| Pre-release advancement                          | `chore(release):`                              | Suffix change (`1.0.0-alpha.1` → `1.0.0-beta.1`) |

Rules:

- **PATCH** — for fixes that do not change public APIs, do not alter schema, and do not affect user-visible behavior beyond correcting a defect.
- **MINOR** — for new features that are backward-compatible. Existing code, existing APIs, existing schema all work as before.
- **MAJOR** — for breaking changes. A client, integration, or database migration must change to keep working. The old behavior is not preserved.
- **Pre-release suffix** — applied during milestones before v1.0.0, and for any pre-stable release thereafter. Format: `1.0.0-alpha.1`, `1.0.0-beta.1`, `1.0.0-rc.1`. The number after the suffix increments with each pre-release tag of the same stage.

v1.0.0 is the first stable public release, targeted at M7. Everything before v1.0.0 carries a pre-release suffix. After v1.0.0, normal SemVer applies.

## Pre-Release Checklist

Before any release (including pre-releases), verify:

1. **CI green** — all five gates pass on the release branch: `lint`, `typecheck`, `test`, `build`, `format`.
2. **No critical bugs** — no open issues tagged `severity:critical`. High-severity issues are triaged and scheduled (they do not block unless the tech lead decides otherwise).
3. **Docs updated** — architecture docs, API docs, ADRs, and READMEs reflect the released state.
4. **Changelog generated** — conventional commits since the last tag are compiled into the changelog. Human-reviewed for clarity.
5. **Migration safety** — if the release includes database migrations, they are backward-compatible (no column drops without deprecation, no table renames without views).
6. **Security review** — any new auth, payment, or user-data paths have been reviewed.
7. **Performance baseline** — key routes measured, no regressions beyond threshold.
8. **Secrets rotated** — if any credentials were compromised or rotated during the milestone, verify the new values are in production config.

## Release Steps

### 1. Create the Release Branch

```bash
git checkout main
git pull origin main
git checkout -b release/v1.2.0
```

The release branch is created from the latest `main`. It exists to stabilize — not to develop. After the branch is cut, only bug fixes, docs, and changelog updates merge into it. New features wait for the next release.

### 2. Stabilize

On the release branch:

- Fix bugs discovered during QA.
- Update documentation to match the released state.
- Generate and review the changelog.
- Run the full test suite, including integration and end-to-end tests.
- Verify staging deployment works end-to-end.

Bug fixes targeting the release branch follow the naming convention `bugfix/release-v1.2.x-<slug>`. Each fix goes through the normal PR process — review, CI, squash-merge.

### 3. Version Bump

The version bump is committed directly on the release branch. Update `package.json` (and any package-level `package.json` files in the monorepo) to the new version.

```bash
# Example: bumping to 1.2.0
pnpm --filter @nexus/web version 1.2.0
# Repeat for other packages as needed
```

Commit with the conventional format:

```
chore(release): v1.2.0
```

### 4. Tag

After the release branch merges into `main` via PR, create an annotated tag on `main`:

```bash
git checkout main
git pull origin main
git tag -a v1.2.0 -m "release: v1.2.0"
git push origin v1.2.0
```

Tags are **annotated** (not lightweight) and **immutable** once pushed. Never move a tag. If a new version is needed, cut a new tag with a new number.

### 5. Deploy

CI deploys the tag to production automatically. Verify:

- Deployment completes without errors.
- Health checks pass.
- Smoke tests pass (see [Post-Release Verification](#post-release-verification)).

### 6. Announce

- Publish GitHub Release notes from the changelog.
- Send internal announcement (Slack, email, or equivalent) summarizing what changed and who should pay attention.
- If the release includes user-visible changes, update public-facing documentation and status pages.

## Hotfix Process

A hotfix is a production defect that cannot wait for the next planned release. It follows a disciplined path to avoid shipping regressions under pressure.

### 1. Branch from the Production Tag

```bash
git checkout -b hotfix/v1.2.1-session-expiry v1.2.0
```

The hotfix branch is created from the **annotated tag** that corresponds to the broken production version — not from `main`. This ensures the hotfix does not accidentally include unrelated work that has landed on `main` since the last release.

### 2. Fix the Defect

- Make the **minimal** change required to fix the issue. No refactors, no "while I'm here" improvements.
- Add or update a regression test so the defect cannot return silently.
- Run `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm format` locally before pushing.

### 3. Open a PR Targeting `main`

- PR title follows Conventional Commit: `fix(auth): refresh session before expiry check`.
- CI must be green.
- At least one reviewer must approve. For critical production fixes, the tech lead must be in the approval chain.

### 4. Squash-Merge and Tag

```bash
git checkout main
git pull origin main
git tag -a v1.2.1 -m "fix(auth): refresh session before expiry check"
git push origin v1.2.1
```

### 5. Deploy Immediately

Hotfix tags deploy automatically. Monitor error rates and health checks closely for the first hour.

### 6. Cherry-Pick into Open Release Branches

If a release branch is open, cherry-pick the fix into it to keep the lines consistent:

```bash
git checkout release/v1.3.0
git cherry-pick <hotfix-commit-sha>
```

## Rollback Plan

If a release introduces a critical regression, roll back. Do not wait, do not debug in production.

### Standard Rollback (No Migration)

1. Re-deploy the previous tag:

   ```bash
   git checkout v1.1.0
   # Trigger deployment of v1.1.0 through CI
   ```

2. Verify health checks pass on the rolled-back version.
3. Monitor error rates to confirm the regression is resolved.
4. Investigate the root cause in a follow-up task.

### Rollback with Migration

If the release included a database migration:

1. **Re-deploy the previous application tag** — the old code must run against the database state it expects.
2. **Assess migration state** — if the migration is backward-compatible (e.g. added a column), the old code can run against the migrated database without issue.
3. **If the migration is not backward-compatible**, run the **rollback migration** to revert the schema change. Rollback migrations are written alongside forward migrations and tested before the release.
4. **Verify data integrity** — confirm no data was lost or corrupted during the forward or reverse migration.
5. **Monitor** — watch error rates and data consistency for 24 hours.

The rule: every migration must have a corresponding rollback migration. If a migration cannot be rolled back safely, the tech lead must sign off on the risk before the release is approved.

## Changelog Generation

Changelogs are generated automatically from conventional commits since the last tag. We use a standard tool (e.g. `standard-version`, `semantic-release`, or equivalent) configured in CI.

### Grouping

Commits are grouped by type:

- **Features** — `feat:` commits
- **Bug Fixes** — `fix:` commits
- **Performance** — `perf:` commits
- **Reverts** — `revert:` commits

Breaking changes are called out prominently at the top of the changelog.

### Human Review

Automated changelogs are a starting point, not the final product. Before the release tag is pushed:

- Review the generated changelog for accuracy.
- Rewrite opaque commit messages into user-meaningful descriptions.
- Remove internal-only changes that are not meaningful to users (e.g. `chore: update CI config`).
- Highlight breaking changes, migration steps, and new features.

### Format

```markdown
# v1.2.0

## Breaking Changes

- (none)

## Features

- feat(auth): add Google OAuth provider
- feat(catalog): infinite scroll on browse page

## Bug Fixes

- fix(player): resume playback after network interruption
- fix(search): correct pagination offset on page 2+

## Performance

- feat(cache): reduce TMDB API calls by 40% via stale-while-revalidate
```

## Release Communication

### GitHub Release Notes

Every tag gets a GitHub Release entry. The body is the human-reviewed changelog. Attach any relevant artifacts (migration guides, breaking change documentation).

### Internal Announcement

Posted to the engineering channel within 1 hour of deployment. Includes:

- Version number and tag link.
- Summary of user-visible changes.
- Any action required from the team (e.g. "please test the new auth flow on staging").
- Any known issues and workarounds.

### External Communication

For stable releases with user-visible changes:

- Update the public changelog (if one exists).
- Post to social media or blog if the change is significant.
- Update the status page if there was downtime.

## Post-Release Verification

The release is not "done" when the tag is pushed. It is done when we have verified the release is healthy in production.

### Smoke Tests

Within 15 minutes of deployment, run the critical-path smoke tests:

- Homepage loads and renders.
- Catalog search returns results.
- User can sign in (auth provider).
- Video playback starts (if the release touched playback paths).
- User profile loads.

### Monitoring

For 24 hours after deployment, monitor:

- **Error rate** — 5xx responses, unhandled exceptions, client-side errors. Alert if the rate exceeds the baseline by more than 2x.
- **Latency** — p50, p95, p99 for key routes. Alert if p95 regresses by more than 30%.
- **Database** — connection pool saturation, slow queries, lock contention.
- **Cache** — Redis hit rate, eviction rate, memory usage.
- **Business metrics** — sign-ups, video starts, search queries. A sudden drop indicates a user-facing regression.

### Rollback Trigger

If any metric exceeds its threshold and the regression correlates with the release, roll back immediately. Investigate after stabilization — not before.

## Further Reading

- [Definition of Done](./Definition-of-Done.md) — the DoD that gates each release.
- [Branching Strategy](./Branching-Strategy.md) — how release and hotfix branches work.
- [Dependency Management](./Dependency-Management.md) — how we handle dependency updates that affect releases.
- `docs/milestones/master-roadmap.md` — milestone definitions and the path to v1.0.0.
