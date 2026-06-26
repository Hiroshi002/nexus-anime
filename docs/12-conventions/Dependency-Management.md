# Dependency-Management

> How we add, update, audit, and reason about third-party code. A dependency is a liability as much as it is an asset — treat it accordingly.

## Package Manager: pnpm

pnpm is the only package manager used in this repository. Never use `npm install` or `yarn` — pnpm's strict mode prevents phantom dependencies, its content-addressable store is faster and disk-efficient, and its workspace protocol is the foundation of our monorepo.

```bash
# Install
pnpm install

# Add a dependency
pnpm --filter @nexus/web add <package>

# Remove a dependency
pnpm --filter @nexus/web remove <package>

# Update to latest matching range
pnpm --filter @nexus/web update <package>

# Update all matching range
pnpm update --recursive <package>

# List outdated packages
pnpm outdated --recursive
```

Rules:

- Always run `pnpm install` after pulling a changed `pnpm-lock.yaml`. Never manually edit files inside `node_modules`.
- Use `pnpm --filter <package>` to target a specific workspace package. Installing at the root installs across the workspace.
- Use `pnpm --filter <package>...` (with ellipsis) to target a package and all its dependents — useful for builds that depend on a specific package.

## Lockfile Integrity

`pnpm-lock.yaml` is committed to the repository and is the single source of truth for the exact dependency tree. Never edit it manually.

Rules:

- The lockfile is updated only by `pnpm install` or `pnpm update`. Human edits corrupt the integrity hash.
- CI verifies lockfile integrity on every build. A mismatch between `package.json` and `pnpm-lock.yaml` fails the build.
- If `pnpm install` detects a conflict it cannot resolve, it fails with `--strict-peer-dependencies`. The fix is to resolve the conflict in `package.json`, not to loosen the check.
- Regenerating the lockfile from scratch (`rm pnpm-lock.yaml && pnpm install`) is acceptable only when deliberately upgrading the entire tree — and the diff is reviewed line-by-line in the PR.

## Workspace Dependencies

Packages within the monorepo (`@nexus/ui`, `@nexus/db`, `@nexus/cache`, `@nexus/eslint-config`) use the `workspace:` protocol:

```json
{
  "dependencies": {
    "@nexus/ui": "workspace:*"
  }
}
```

The `workspace:*` protocol tells pnpm to resolve the dependency from the local workspace, not from a registry. Changes in a linked package are immediately available to its dependents without an install or publish step.

Rules:

- Internal dependencies always use `workspace:*`. Never pin an internal dependency to a version number.
- When breaking changes are made to an internal package, all dependents must be updated in the same PR. The CI `typecheck` gate verifies this.
- The build order in `turbo.json` respects the internal dependency graph — `@nexus/db` builds before `@nexus/cache`, which builds before `@nexus/web`. Do not introduce circular dependencies.

### Internal Dependency Graph

```
@nexus/eslint-config  (leaf — no internal deps)
    ↑
@nexus/ui            (depends on: @nexus/eslint-config)
    ↑
@nexus/cache         (depends on: @nexus/ui)
@nexus/db            (depends on: @nexus/eslint-config)
    ↑
apps/web             (depends on: @nexus/ui, @nexus/cache, @nexus/db)
```

## Adding Dependencies

Every new dependency must justify its inclusion. Third-party code is a maintenance liability — it must be updated, audited, and reasoned about forever. Default to "no" unless the value is clear.

### Before Adding

1. **Check if the need can be met with existing code.** Can you write the utility yourself in under 100 lines? Can a dependency you already have do the job? Is a Node.js built-in sufficient?
2. **Evaluate the dependency.** Use the checklist below.
3. **Open an ADR or a tracking issue** for any dependency that adds more than 50 KB to the bundle or touches a security-sensitive path (auth, payment, data validation).
4. **Get a reviewer's sign-off.** The reviewer evaluates the justification, not just the code.

### Evaluation Checklist

Before approving a new dependency, verify:

- [ ] **Maintenance** — actively maintained? Last release within the last 12 months? Responsive to issues and security advisories? Not a one-person project with no succession?
- [ ] **Bundle size** — small enough to justify the capability? Check with [bundlephobia.com](https://bundlephobia.com). A utility that adds 100 KB to a streaming platform's client bundle is a hard sell.
- [ ] **TypeScript support** — ships its own types, or has `@types/<package>` maintained by the DefinitelyTyped team? No types = manual maintenance burden.
- [ ] **License** — MIT, ISC, Apache-2.0, or BSD-2/3-Clause. No GPL, no AGPL, no custom licenses without legal review.
- [ ] **Direct dependencies only** — prefer packages with few or no transitive dependencies. Every transitive dep is code you are responsible for without direct oversight.
- [ ] **Ecosystem alignment** — plays well with our stack (Next.js 16, React 19, Tailwind 4)? Does not bring its own conflicting state management, styling, or build tooling?

### How to Add

```bash
pnpm --filter @nexus/web add <package>
```

This updates `package.json` and `pnpm-lock.yaml` automatically. Open a PR that includes:

- What the dependency does and why existing code cannot.
- The evaluation checklist above.
- The bundle size impact (if client-side).
- The license.

## Updating Dependencies

### Regular Cadence

Dependency updates happen on a regular cadence — weekly or bi-weekly, depending on the volume of outdated packages. Letting updates accumulate creates a mountain of changes that is impossible to review and risky to merge.

```bash
pnpm outdated --recursive
```

Review the list. Apply updates in logical groups:

- **Security-critical** — update immediately, regardless of cadence.
- **Patch updates** — generally safe, batch and merge monthly.
- **Minor updates** — review changelogs for breaking changes, batch monthly.
- **Major updates** — plan separately, treat as a feature. Test thoroughly.

### Update Strategy

- **One major upgrade per PR.** Do not bundle Next.js 16 → 17 with React 19 → 20 with Tailwind 4 → 5. Isolate variables.
- **Run `pnpm build` after every update.** Type errors in a dependency's types often surface only at build time.
- **Review the lockfile diff.** A 500-line lockfile change for a minor version bump is a signal something unexpected happened.
- **Update internal packages first,** then external. Internal changes are more predictable and easier to test.

### Automated Updates

Dependabot is configured to open PRs for security-critical updates. Dependabot PRs are reviewed by a human before merge — they are not auto-merged.

## Dependency Categories

| Category | Examples | Version strategy |
|----------|----------|------------------|
| Runtime (client) | `next`, `react`, `framer-motion` | Pin to carets (`^16.0.0`), test before minor bumps |
| Runtime (server) | `drizzle-orm`, `ioredis`, `zod` | Pin to carets, test before minor bumps |
| Dev (build) | `typescript`, `eslint`, `turbo` | Carets, wide range acceptable |
| Dev (test) | `vitest`, `@testing-library/react` | Carets, fast-moving |
| Dev (tooling) | `prettier`, `husky`, `lint-staged` | Exact or tilde, low churn |
| Peer | `react` (peer of framer-motion) | Match the range expected by the primary |
| Optional | `sharp` (optional for next/image) | Installed only when needed |

### Version Pinning Strategy

- **Runtime dependencies**: use `^` (caret). Allows patch and minor updates that are backward-compatible. Avoid `*` and `latest`.
- **Critical runtime dependencies** (auth, payment, video): pin to exact version in the first release after integration. Evaluate caret on a case-by-case basis.
- **Dev dependencies**: use `^` (caret). Churn is acceptable; breaking changes in dev tooling rarely affect production.
- **Build tooling** (Next.js, TypeScript, Turbo): use `^`. Evaluate each minor upgrade individually.
- **No wildcards.** `*` and `latest` are forbidden in `package.json`. Always pin a version or range.

## Security Scanning

Multiple layers of automated scanning catch vulnerabilities in dependencies.

### pnpm Audit

Run locally or in CI:

```bash
pnpm audit --recursive
```

Flags known vulnerabilities in installed packages. Critical vulnerabilities block the CI build.

### Dependabot

Configured in `.github/dependabot.yml`:

- Weekly scan of all dependencies.
- Opens PRs with version bumps that resolve known vulnerabilities.
- Labels: `dependencies`, `security`.
- Auto-assigned to the on-call engineer.

Dependabot PRs for critical or high-severity vulnerabilities are fast-tracked through review.

### CodeQL

GitHub CodeQL scans the codebase weekly for security issues — including patterns in how dependencies are used (e.g. unsanitized input passed to a template engine, unsafe deserialization).

### Manual Review

Before any major version upgrade of a security-critical dependency (Auth.js, Stripe SDK, Zod, Drizzle, ioredis):

1. Read the project's security advisory page.
2. Review the changelog for security-related changes.
3. Test the upgrade on staging before deploying to production.

## Banned Packages

The following categories of dependencies are banned. New additions in these categories require a written exception from the tech lead:

- **Deprecated packages** — packages marked `deprecated` by their maintainers. No exceptions.
- **Unmaintained packages** — no release or meaningful commit in the last 18 months. If the last release predates the current Node.js LTS, it is unmaintained.
- **GPL/AGPL-licensed** — copyleft licenses are prohibited. MIT, ISC, Apache-2.0, BSD-2/3-Clause only.
- **Packages with known critical vulnerabilities** that have no published fix.
- **Duplicate functionality** — do not add a date library when we already have one. Do not add a state management library when we already have one.
- **Speculative additions** — "we might need this later" is not a justification. Add dependencies when the need is concrete.

### Currently Banned

This list evolves. Tech lead maintains it.

| Package | Reason |
|---------|--------|
| `moment` | Unmaintained, large bundle. Use `date-fns` or `dayjs`. |
| `lodash` (full) | Import-only-what-you-use is hard to enforce. Use `lodash-es` or native equivalents. |
| `request` | Deprecated. Use `node-fetch` or built-in `fetch`. |
| `node-cache` | Use `@nexus/cache` (ioredis) for caching. |
| `jest` | Incompatible with our ESM-first setup. Use `vitest`. |

## Breaking Change Handling in Dependencies

When a dependency introduces a breaking change in a minor or patch release (semantic versioning violation), the team must balance the fix against the risk of upgrading.

### Process

1. **Verify the breaking change.** Confirm it is actually the dependency's fault and not a misconfiguration. Check the issue tracker, changelog, and release notes.
2. **Check if it affects us.** Does our code path hit the changed behavior? Can we confirm with a test?
3. **If it does not affect us:** ignore the update. File a tracking issue to re-evaluate after the next major release.
4. **If it affects us and the fix is urgent:** upgrade in an isolated PR. Pin the version. Document the issue and the reason for the upgrade in the PR and the relevant tracking issue.
5. **If it affects us and the fix is not urgent:** schedule the upgrade as a standalone task. Bundle with other related updates in the next dependency update window.
6. **Raise the issue upstream** if the breaking change is a bug. Open an issue on the dependency's repository. Link it from our tracking issue.

### Staged Rollout for Major Upgrades

For major version upgrades of critical dependencies (Next.js, React, Drizzle, etc.):

1. **Read the migration guide thoroughly.** Note every breaking change that touches our codebase.
2. **Create a dedicated branch** (not a release branch — a working branch).
3. **Upgrade and fix compile errors.** Run `pnpm typecheck` and `pnpm build` until both pass.
4. **Run the full test suite.** Verify no behavioral regressions.
5. **Deploy to staging.** Test every critical user path. Take screenshots and recordings.
6. **Performance benchmark.** Compare before and after on key metrics (Lighthouse, TTFB, bundle size).
7. **Open a PR for review.** Include the benchmark results and the list of breaking changes.
8. **Merge and deploy outside peak hours** with a rollback plan ready.

Never upgrade a critical dependency in a feature PR. Keep upgrades isolated so regressions are easy to identify and revert.

## Further Reading

- [Definition of Done](./Definition-of-Done.md) — how dependency changes factor into task and PR DoD.
- [Release Process](./Release-Process.md) — how dependency updates are batched into releases.
- `docs/REPOSITORY-DESIGN.md` — monorepo layout and how packages relate.
- `docs/03-architecture/adr/ADR-001-modular-monolith.md` — the layered modular monolith that constrains where dependencies can live.
