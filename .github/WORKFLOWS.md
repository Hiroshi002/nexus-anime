# GitHub Workflows — Nexus Anime

This document explains why each workflow in `.github/workflows/` exists, what
it gates, and how it relates to the others. Read it when adding a new
workflow or debugging a CI failure.

## The workflow family

```
ci.yml                  ← canonical CI gate (lint + typecheck + test + build + format)
lint.yml                ← fast style-only feedback
typecheck.yml           ← fast type-only feedback
test.yml                ← fast test-only feedback
build.yml               ← fast build-only feedback
codeql.yml              ← security static analysis
release.yml             ← GitHub Release on semver tag
deploy-preview.yml      ← preview environment per PR / main
deploy-production.yml   ← production deploy on semver tag
dependency-update.yml   ← CI re-run when lockfile changes
```

## Why each workflow exists

### `ci.yml` — canonical CI gate

The single source of truth for "is this commit shippable?" Runs lint,
typecheck, test, build, and format check in parallel. Required as a
merge-protection branch check. New workflows below are _additive_ — they
don't replace this one.

### `lint.yml`, `typecheck.yml`, `test.yml`, `build.yml` — fast feedback

These are the same stages as `ci.yml`, split out so a PR author can see
exactly which gate failed at a glance. They cost extra CI minutes but save
developer time when iterating on a specific failure. If CI cost becomes a
concern, these can be collapsed back into `ci.yml`.

### `codeql.yml` — security static analysis

Catches security-relevant patterns (open redirects, prototype pollution,
missing input sanitization) that linting and typechecking miss. Runs on
push to main, on PRs, and weekly as a supply-chain backstop. Results
appear in the repo's **Security → Code scanning alerts** tab.

### `release.yml` — GitHub Release on semver tag

When a tag matching `v*` is pushed, builds the commit (to verify it's
shippable) and creates a GitHub Release with auto-generated notes. This
is the only workflow triggered by tag push — production deploy is
separate on purpose so a release can be drafted without deploying.

### `deploy-preview.yml` — preview environment

Builds and deploys the web app to a preview URL on every PR and push to
main. The deployment provider is configurable — see the comments in the
file for Vercel and custom-provider patterns. The deploy step is a
placeholder until secrets are wired up; the `if: false` guards prevent
accidental no-op deploys.

### `deploy-production.yml` — production deploy

Triggered by semver tag push. Builds first (so a broken tag doesn't
reach production), then hands off to the deployment provider. Uses the
`production` GitHub environment for secrets and required reviewers. The
deploy step is a placeholder — configure your provider before relying on
this workflow.

### `dependency-update.yml` — lockfile change verification

Dependabot opens PRs against `main`; this workflow runs the full CI
suite when a PR touches `pnpm-lock.yaml` or any `package.json`. It does
not bump dependencies itself — it's a backstop that ensures manual or
automated dependency changes still pass every gate.

## Shared conventions

- **Concurrency**: every workflow uses
  `concurrency: { group: ..., cancel-in-progress: true }` so a new push
  cancels the in-flight run for the same ref. Saves CI minutes.
- **Permissions**: default to `contents: read`. Jobs that need more
  (CodeQL SARIF upload, deployment status, PR comments) escalate
  explicitly. This limits blast radius if a workflow is compromised.
- **Node version**: read from `.nvmrc` so the CI runtime matches what
  developers use locally.
- **pnpm cache**: `actions/setup-node` with `cache: pnpm` reuses the
  pnpm store between runs. Combined with `--frozen-lockfile` this keeps
  installs fast and reproducible.
- **Turbo**: not yet configured in this repo. When `turbo.json` lands,
  add `TURBO_TOKEN` / `TURBO_TEAM` secrets and a
  `actions/cache` step for `.turbo/cache` to speed up remote caching.

## Required secrets

| Secret                                               | Used by                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| `GITHUB_TOKEN`                                       | All workflows (auto-provided).                                 |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | `deploy-preview.yml`, `deploy-production.yml` (Vercel option). |
| Provider-specific credentials                        | `deploy-preview.yml`, `deploy-production.yml` (custom option). |

## Required branch protection

To make these workflows meaningful, configure branch protection on `main`:

- Require status checks: `ci.yml` (all jobs), `codeql.yml`.
- Require branches to be up to date before merging.
- Require a PR review before merging.
- Do not allow force pushes.
