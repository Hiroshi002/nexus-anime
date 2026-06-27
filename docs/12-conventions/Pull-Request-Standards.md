# Pull Request Standards

A PR is a conversation artifact. It must be scoped for a reviewer to read in a single sitting, scoped for an automaton to validate in CI, and scoped for a release manager to land without anxiety.

## PR Template

Every PR opens with the following sections via `.github/pull_request_template.md`. Fill them in; do not delete the headings.

```markdown
## Title

<!-- Conventional Commit, see docs/ -->

## Motivation

<!-- One paragraph: why this change exists. Link the milestone, the
     user story, or the bug that motivates it. -->

## Changes

<!-- Bullet list of concrete changes. Walk the reviewer through the
     shape of the diff so they can budget their attention. -->

## Testing

<!-- How you verified the change. Local dev server? Fixture data?
     Manual steps with expected vs actual behavior? -->

## Screenshots / Recordings

<!-- Required for UI changes. Show the change at 380px, 768px, and
     1440px when layout is affected. Videos for motion. -->

## Checklist

- [ ] Code compiles and passes `pnpm typecheck`
- [ ] `pnpm lint` clean
- [ ] `pnpm test` passes (no skipped tests introduced)
- [ ] New dependencies justify their weight in the PR description
- [ ] Database migrations are reversible (safe rollback)
- [ ] Edge cases covered: empty arrays, null upstream, expired session
- [ ] No secrets, tokens, or internal URLs committed
- [ ] PR size is under 400 lines changed (or justified if over)
```

Each section has a purpose:

- **Motivation** anchors the PR in work the reviewer already understands. A PR without motivation forces the reviewer to reverse-engineer intent.
- **Changes** lets a skimmer understand the shape of the diff without clicking into every file.
- **Testing** turns review from "do I trust this?" into "do I agree with the proof?".
- **Screenshots** are mandatory for UI changes. Reviewers cannot review CSS by reading it.
- **Checklist** captures non-obvious gates (rollback, secrets, edge cases) that CI does not enforce.

## Title Format

The PR title **must** be a valid Conventional Commit message — it becomes the squash commit subject on `main`, which means it also drives the changelog release version.

```
feat(auth): add Google OAuth callback route handler
fix(video): resume from saved progress after session restore
docs(adrs): add ADR-004 for Redis as cache-only
```

Pattern: `<type>[optional scope]: <description>`

Rules:

- Lowercase after the colon.
- No trailing period.
- Imperative mood — not "added" or "adds", but "add".
- Keep it under 72 characters. The description field is what readers see on GitHub search results.

If multiple PRs compose a single feature, they are individually named and individually reviewed. Avoid parent-child PR hierarchies — reviewers lose context when dependencies are layered.

## Size Guidelines

Reviewing large PRs is the single best way to ship defects disguised as features.

| Metric            | Target | Hard cap                     |
| ----------------- | ------ | ---------------------------- |
| Lines changed     | < 400  | 800                          |
| Files touched     | < 15   | 25                           |
| Commits in branch | 1–20   | — (squashed at merge anyway) |

If a PR crosses the 800-line hard cap, **it must be split**. Strategies:

- Split by layer (API route → UI component → Tailwind tokens).
- Extract a no-op refactor into an independent PR (e.g. type renames) that lands first.
- Use a feature flag to land partial behavior behind a toggle, then enable it in a follow-up PR.

For PRs under 800 lines but over 400, explain in the Motivation section why splitting is impractical. Reviewers may still ask for a split — accept that gracefully.

Chore and docs PRs are exempt from the line-accounting rule because they do not change runtime behavior, but they should still be small enough for a reviewer to absorb quickly.

## Review Process

1. **Request review** from at least one code owner of the affected package. Cross-package changes request from an owner of _each_ touched package.
2. **Approval** — 1 approval from a non-author team member. Reviewers self-assign; the author does not assign themselves.
3. **CI green** — all five checks must pass: lint, typecheck, test, build, format. Cancelled checks do not count.
4. **Conversations resolved** — every comment receives a response. Approval after outstanding comments is still valid, but the comments should be resolved to preserve signal.
5. **Stale review dismissal** — if the PR changes materially after approval (beyond reviewer suggestions), the existing approval is dismissed and a fresh review is requested.

### What reviewers check

- Are types meaningful, or are there `any` escapes?
- Are error paths covered (5xx from upstream, expired sessions, empty arrays)?
- Does the change respect the existing architecture (ADR-001 modular monolith, route handler envelope, Zod validation)?
- Are there security implications (new endpoint, new provider, new webhook)?
- Does the UI work at 380px, 768px, 1024px, 1440px?
- Are my comments addressed without just agreeing to disagree?

## CI Requirements

CI is required on every PR targeting `main` or a release branch and enforces five gates. All gates must pass.

| Gate        | What fails                                                                                            | Typical root cause                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `lint`      | ESLint error, unused import, exhaustive-deps violation                                                | Missed during local dev because `tsc` doesn't run ESLint             |
| `typecheck` | Type error across apps/web or packages/\*                                                             | Incorrect inference from a third-party library without augmentation  |
| `test`      | A test fails, coverage drops below threshold, or a test was skipped (`it.skip`) without justification | Test relies on timing, hidden mock state, or env var not in CI       |
| `build`     | `pnpm build` fails across all packages                                                                | Missing export, invalid `next.config`, syntax error in a config file |
| `format`    | Prettier diff detected (including inside Markdown and JSON)                                           | Editor format-on-save config diverges from repo `.prettierrc`        |

Locally, run `pnpm check` before pushing — it runs all five gates in parallel via Turborepo.

CI caching is configured. First runs in a cold cache take ~6–8 minutes; subsequent runs on a warm cache with few file changes take ~2–3 minutes.

## Squash-and-merge as Default

**Squash-and-merge** is the default merge strategy for PR on `main` and release branches.

Why:

- The squash commit message is the PR title, which is a Conventional Commit. `git log main` reads as a clean linear history.
- Individual "fix typo" and "address feedback" commits are discarded on merge, so reviewers are not judged on those micro-steps in the public history.
- Linear `git log` makes `git bisect` trivial.

The squash commit preserves the PR number in the footer: `Closes #142`. This backfills the changelog and issue closure automatically.

## When to Use Merge Commit

Merge commits (non-squash) are reserved for two cases:

1. **Combining a stack of dependent PRs** into `main` when the stack itself forms a meaningful integration point. The merge commit subject references the stack and each constituent PR is still listed individually, but a merge commit marks the integration seam.
2. **Release branch merges to `main`** — a merge commit preserves the fact that a release was a batch of work, not a single change. The merge commit subject is `release: v1.1.0` and links to the changelog.

In both cases, every commit within the merged branch is still a valid Conventional Commit — the merge commit wraps them.

Rebase-and-merge is **not used**. It rewrites commit hashes and destroys the PR discussion trail.

## Post-merge Cleanup

After a squash-and-merge to `main`:

1. **Delete the branch** — GitHub auto-deletes the head branch when "auto-delete head branches" is enabled. If it is not enabled, delete it manually within the hour.
2. **Close linked issues** — if the PR did not use a `Closes #NNN` footer, close the issue manually with a comment referencing the squash commit hash.
3. **Update milestone tracking** — move the issue to the "Done" column on the milestone board if not already automated.
4. **Deploy** — CI deploys `main` on every merge; monitor the deployment dashboard for at least 15 minutes.

For cross-package PRs (e.g. a package change paired with an app/web consumer), both repos' package.json version bumps should land before the merge, or in a follow-up commit that is also squash-merged.

## Best Practices for UI Changes

UI changes must show, not describe.

- **Before / after** — pair screenshots or embed a short video. Show the unmodified state first so the delta is obvious.
- **Width tests** — capture at 380px (mobile), 768px (tablet), 1024px (laptop), 1440px (desktop). Use browser dev tools to simulate before committing.
- **Dark mode** — capture both light and dark if the change touches colors, borders, or shadows.
- **Empty / loading / error states** — show what the user sees when the upstream is slow, the list is empty, or the session expires. These states ship bugs more often than the happy path.
- **Video for motion** — screen recording for video player chrome, page transitions, or animation changes. A 5-second clip is worth a thousand words of description.
- **Alt text** — include descriptive alt text on every image so screen-reader users on the team can review.

Example:

```
## Screenshots

### Before
![Before: cramped login form at 380px](/.../before-mobile.png)

### After (380px)
![After: full-width form with glassmorphism card](/.../after-mobile.png)

### After (1440px)
![After: centered form with backdrop blur at desktop](/.../after-desktop.png)
```

## Handling Review Feedback

Keep the branch's history linear with the branch; let the squash flatten it into `main`.

Preferred patternfeat(auth): add Google OAuth callback route handler
fixup! feat(auth): rename callback handler for clarity
fixup! feat(auth): clarify error response in body

```

The `fixup!` prefix (or `squash!` if you want the commit preserved but rebased) marks commits as folded into the previous commit during an interactive rebase. The PR author rebases locally and force-pushes only before review — after a reviewer has reviewed, new feedback becomes new commits (not amendments) so the reviewer can read only the delta.

Once approved, the author runs `git rebase -i --autosquash main` to fold the fixups before the PR merge. The squash-and-merge then produces a single, clean commit on `main`.

Do not amend pushed commits once someone has left a review — rewriting history invalidates their diff context and creates "force-push roulette" where the reviewer ends up re-reading the entire PR.

## Further Reading

- [Branching Strategy](./Branching-Strategy.md) — what branches can target `main`.
- [Commit Convention](./Commit-Convention.md) — what types and shapes land inside a PR.
- `.github/workflows/ci.yml` — the canonical CI gate definitions.
- `.github/CODEOWNERS` — which team must approve which path.
```
