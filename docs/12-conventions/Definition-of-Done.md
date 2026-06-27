# Definition of Done

> What "done" means at Nexus Anime. A feature is not done when the code compiles — it is done when it ships, is safe to ship, and stays correct after shipping.

The Definition of Done (DoD) is a shared contract. It removes ambiguity about what "done" means at every level of work, prevents last-minute surprises, and gives every engineer — from intern to tech lead — a clear bar to aim for.

## Core Principle: Done Means Done

**Done means done.** A task that is "done but needs follow-up" is not done. A PR that is "done but I'll fix the tests later" is not done. A milestone that is "done but the docs are stale" is not done.

If work cannot be finished to the bar, split it so the finished portion ships and the remainder is tracked as its own tracked item. Never leave a trail of "almost done" work — it rots, it confuses the next engineer, and it hides real status.

The DoD is not a suggestion. It is the minimum acceptable state before work can advance to the next level. If a checklist item cannot be met, the author surfaces it early — not at review time, not at demo time, not at release time.

## Verification Chain

Every level of done has a verifier. The author is always the first verifier — quality starts with the person who wrote the code.

| Level     | Primary verifier                | Escalation                          |
| --------- | ------------------------------- | ----------------------------------- |
| Task      | Author (self-review)            | Reviewer catches gaps at PR         |
| PR        | Reviewer (≥ 1 approval)         | Tech lead adjudicates disagreements |
| Milestone | Tech lead (acceptance criteria) | Product confirms demo-ability       |
| Release   | Tech lead (tag, deploy)         | Product + engineering lead sign-off |

Authors do not self-approve. Reviewers do not rubber-stamp. Tech leads do not sign off on work they have not verified. Every handoff has a human being accountable for it.

## Task-Level DoD

A task is a single unit of work — a bug fix, a helper function, a schema change, a component. It is the smallest atom of delivery.

A task is **done** when:

1. **Code is written** — the change is complete, compiles, and addresses the task scope. No partial implementations.
2. **Tests pass** — `pnpm test` passes locally. New logic has test coverage. Bug fixes include a regression test that proves the bug existed before the fix and is gone after.
3. **Type safety is intact** — `pnpm typecheck` passes with no new errors. No `any` introduced. No `// @ts-ignore` added.
4. **Lint and format pass** — `pnpm lint` and `pnpm format` pass with zero warnings.
5. **Self-reviewed** — the author has re-read the diff as if they were the reviewer. Obvious nits are caught before anyone else sees them.
6. **No TODOs left** — no `TODO`, `FIXME`, `HACK`, or `XXX` comments remain. If a known gap exists, it is tracked as a follow-up task, not a comment in code.
7. **Scope is honored** — no "while I'm here" refactors. If the task was to fix the login redirect, the author did not also restructure the auth module.

### Task Checklist Template

Authors paste this into their PR description or attach it to the tracking task:

```markdown
## Task Done Checklist

- [ ] Code complete and compiles
- [ ] Tests pass locally (`pnpm test`)
- [ ] Typecheck passes (`pnpm typecheck`)
- [ ] Lint and format pass (`pnpm lint`, `pnpm format`)
- [ ] Self-reviewed the diff
- [ ] No TODOs, FIXMEs, or temporary comments left
- [ ] Scope honored — no unrelated changes
- [ ] Edge cases handled (empty, null, error, network failure)
- [ ] Error paths produce user-friendly messages
```

## PR-Level DoD

A PR is a collection of one or more tasks proposed for merge into `main`. It is the unit of review and the unit of integration.

A PR is **done** when:

1. **Task-level DoD met** — every task in the PR satisfies the task-level checklist above.
2. **CI passes** — all five CI gates are green: `lint`, `typecheck`, `test`, `build`, `format`. No cancelled or skipped checks.
3. **At least one approval** — a reviewer who is not the author has approved the change. Security-sensitive and payment PRs require a reviewer with relevant context.
4. **Conversations resolved** — every review comment is resolved (not just addressed). If a suggestion is declined, the reason is documented in the thread.
5. **Up to date with `main`** — the branch is rebased onto the latest `main` and merges cleanly. No merge conflicts.
6. **PR description is complete** — explains what changed, why, and where to verify. Links the motivating issue, milestone, or ADR. Notes any security, performance, or architectural implications.
7. **Diff is reviewable** — ideally under 400 lines. Larger diffs are split or the author explains why splitting is not practical.
8. **No new tech debt introduced** — or if it is (e.g. a temporary workaround for an upstream bug), it is called out in the PR and tracked as a follow-up task.

### PR Checklist Template

Reviewers use this to structure their review. Authors can use it to preempt reviewer questions:

```markdown
## PR Done Checklist

### CI

- [ ] All five CI gates green (lint, typecheck, test, build, format)
- [ ] Branch up to date with `main`

### Review

- [ ] At least one non-author approval
- [ ] All review conversations resolved
- [ ] Security-sensitive changes reviewed by a security-aware reviewer

### Code Quality

- [ ] Follows applicable ADRs
- [ ] Respects package boundaries (ADR-001 layering)
- [ ] Zod validation at every boundary
- [ ] No `any`, no `// @ts-ignore`
- [ ] Error paths are explicit and user-friendly
- [ ] Files under 300 lines (or justified)

### Testing

- [ ] New logic has tests
- [ ] Bug fixes have regression tests
- [ ] Happy path and error path tested

### Documentation

- [ ] ADR updated or created if architecture changed
- [ ] Public APIs have TSDoc
- [ ] README updated for new module or behavior

### PR Hygiene

- [ ] PR description explains what, why, and where to verify
- [ ] Diff is under 400 lines (or justified)
- [ ] No unrelated changes
- [ ] No TODOs or temporary comments
```

## Milestone-Level DoD

A milestone is a collection of features, fixes, and documentation that together deliver a coherent capability (e.g. M3 Auth, M4 Catalog, M5 Streaming). Milestones span multiple PRs and multiple engineers.

A milestone is **done** when:

1. **All deliverables complete** — every deliverable listed in the milestone spec is implemented and merged into `main`. No deliverable is "almost done."
2. **Acceptance criteria met** — every acceptance criterion from the milestone spec is demonstrably true. If a criterion cannot be met, it is either fixed or explicitly descoped with a written reason.
3. **Documentation updated** — architecture docs, API docs, ADRs, and READMEs reflect the new state. The next engineer reading the docs will not be misled.
4. **Demo-able** — the milestone can be demonstrated end-to-end on a staging environment. A user can walk the happy path without hitting a dead end, an error, or a placeholder.
5. **No critical bugs open** — no open issues tagged `severity:critical` or `severity:high` for the milestone. Medium and low issues are triaged and scheduled.
6. **Performance baseline established** — key routes and queries have been measured. No regressions beyond acceptable thresholds.
7. **Security review passed** — any new auth, payment, or user-data paths have been reviewed by a security-aware engineer.
8. **Changelog drafted** — user-visible changes are summarized for the release notes.

### Milestone Checklist Template

The tech lead verifies each item before declaring the milestone complete:

```markdown
## Milestone Done Checklist

### Deliverables

- [ ] All deliverables from the milestone spec implemented and merged
- [ ] All acceptance criteria demonstrably met
- [ ] Any descoped items documented with rationale

### Quality

- [ ] No open critical or high-severity bugs
- [ ] Medium and low bugs triaged and scheduled
- [ ] Performance measured — no regressions beyond threshold
- [ ] Security review passed for auth, payment, and user-data paths

### Documentation

- [ ] Architecture docs updated
- [ ] API docs updated
- [ ] ADRs created or updated
- [ ] README files accurate
- [ ] Changelog drafted

### Demo-ability

- [ ] End-to-end demo passes on staging
- [ ] Happy path works without dead ends or placeholders
- [ ] Error paths work with user-friendly messages
- [ ] Mobile responsive at 380px, 768px, 1024px, 1440px
```

## Release-Level DoD

A release is a versioned, tagged, deployable artifact. It is the unit of delivery to users. v1.0.0 is the first stable public release (targeted at M7); earlier milestones ship pre-release versions.

A release is **done** when:

1. **All milestone DoDs met** — every milestone included in the release satisfies the milestone-level checklist above.
2. **Pre-release checklist passed** — all tests pass, no critical bugs, docs updated, changelog generated.
3. **Version bump follows SemVer** — `fix` commits bump PATCH, `feat` commits bump MINOR, `BREAKING CHANGE` bumps MAJOR. Pre-release suffixes follow the progression alpha → beta → rc → stable.
4. **Changelog generated** — automated from conventional commits since the last tag. Human-reviewed for clarity and completeness.
5. **Tag created** — annotated tag on `main` with the version number. Tag is immutable once pushed.
6. **Deployment verified** — the tag deploys successfully to production. Smoke tests pass.
7. **Post-release verification** — error rates monitored for 24 hours. No spike in 5xx errors, no new client-side exceptions, no performance regression.
8. **Release communication sent** — GitHub Release notes published, internal announcement made.

### Release Checklist Template

The tech lead owns this checklist. Product signs off on user-visible messaging:

```markdown
## Release Done Checklist

### Pre-Release

- [ ] All included milestones meet milestone DoD
- [ ] All CI gates green on release branch
- [ ] No critical or high-severity bugs
- [ ] Documentation up to date
- [ ] Changelog generated and reviewed

### Versioning

- [ ] Version bump follows SemVer
- [ ] Pre-release suffix appropriate (alpha/beta/rc/stable)
- [ ] Version number matches changelog

### Tag and Deploy

- [ ] Annotated tag created on `main`
- [ ] Tag deployed to production
- [ ] Smoke tests pass on production

### Post-Release

- [ ] Error rates monitored for 24 hours
- [ ] No spike in 5xx or client exceptions
- [ ] Performance within acceptable thresholds
- [ ] GitHub Release notes published
- [ ] Internal announcement sent
- [ ] Release branch deleted
```

## Done Is Not Negotiable

The DoD is a floor, not a ceiling. Teams are free to add stricter criteria for their area — but they may not relax these criteria without a written ADR.

If a deadline is at risk, the right move is to descope — ship less, ship it well — not to ship work that does not meet the DoD. A delayed release that works is worth more than a on-time release that breaks users.

## Further Reading

- [Branching Strategy](./Branching-Strategy.md) — how branches map to releases and hotfixes.
- [Code Review Guidelines](./Code-Review-Guidelines.md) — how reviewers verify the PR-level DoD.
- [Release Process](./Release-Process.md) — the step-by-step release workflow that implements this DoD.
- `docs/milestones/master-roadmap.md` — milestone definitions and acceptance criteria.
