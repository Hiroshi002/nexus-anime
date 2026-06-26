# Code Review Guidelines

> How we review code at Nexus Anime. Aim: ship quality work without grinding the team into dust.

## Philosophy

Code review is how we share knowledge, catch mistakes early, and keep the codebase coherent. It is **not** a gatekeeping ritual. Every review is a conversation between two engineers who both want the same thing — a platform that works, scales, and is not miserable to maintain.

Treat review as a first-class engineering task. It deserves the same care you'd give writing the code in the first place.

## Review Focus Areas

Every review should weigh these five areas. Not every PR touches all of them — calibrate to the change.

1. **Correctness** — Does the code do what it claims? Are there off-by-one errors, null derefs, race conditions, or silent failures?
2. **Security** — Are inputs validated? Are secrets kept out of logs and responses? Are auth checks in the right place? Is user-generated content sanitized?
3. **Performance** — Are we introducing N+1 queries, unbounded data fetches, or heavy client bundles? Does the change respect the streaming latency budget?
4. **Maintainability** — Could a new engineer understand this in 30 minutes? Are files under 300 lines? Are names clear? Is there hidden coupling?
5. **Architecture alignment** — Does the change follow ADRs? Does it respect package boundaries in the modular monolith? Is the layering correct (Edge → Next.js → Services → Repositories → DB/Cache)?

## What Reviewers Should Check

Go beyond "looks fine." Verify mechanically where possible.

### Type Safety
- `pnpm typecheck` passes — no new errors, no `any` leaked in.
- Zod schemas used at every boundary (request params, query, body, upstream response).
- No `// @ts-ignore` or silence-with-type-assertion hacks.
- Discriminated unions stay exhaustive (no unchecked `AuthState` or `VideoStatus` variant).

### Error Handling
- All promise chains have error handling — no swallowed `catch(async () => {})`.
- `ApiError` shape preserved when errors cross API boundaries (`{ data }` / `{ error: { message, code, details } }`).
- Error paths produce **user-friendly** messages; stack traces stay server-side.
- Loading and empty states are handled, not forgotten.

### Edge Cases
- Empty arrays, null upstream responses, expired sessions, network failures — tested or called out in PR description.
- Pagination boundaries (first page, last page, empty result, single item).
- Rate-limit and timeout paths for upstream API calls (TMDB, AniList, Stripe).

### API Contract Conformance
- Request validation matches the documented contract.
- Response validation enforces the envelope shape.
- Breaking API changes are called out explicitly — no silent contract drift.

### Test Coverage
- New logic has tests. Bug fixes have a regression test proving the bug.
- Tests pass locally and on CI before review is assigned.

## What Authors Should Do Before Requesting Review

Do not push your first draft and walk away.

1. **Self-review.** Re-read your diff top-to-bottom as if you were the reviewer. Catch your own nits — saves everyone time.
2. **Run CI locally.** `pnpm typecheck` and `pnpm build` should pass. Running tests before requesting a review isn't optional, it's baseline courtesy.
3. **Test the happy path and the error path.** Confirm both render / behave without throwing. A screenshot or screen recording for UI changes is worth a thousand review comments.
4. **Write a useful PR description.** What changed, why, and where to verify. Link the issue, milestone, or ADR that motivated it.
5. **Size the diff sensibly.** Under 400 lines is the sweet spot. If your PR is 800 lines, split it — nobody reviews an 800-line diff well.
6. **Call out what you want.** Security-sensitive? Performance-sensitive? Just a quick nod? Tell the reviewer where to spend their attention.

## Feedback Culture

This is the part that makes or breaks a team.

- **Critique the code, never the person.** "This query fetches all rows" lands better than "you always over-fetch."
- **Be specific and actionable.** "Consider extracting this into a repository so it's testable and reusable" is helpful. "Refactor this" is noise.
- **Be kind, assume positive intent.** The author spent real time on this. Honor that.
- **Use suggestions, not commands.** "Maybe batch these calls?" is a recommendation. "Batch these calls" is a demand. Prefer the former unless something is genuinely wrong.
- **Distinguish blocking from optional.** Use a convention — inline comments for nits, a single summary for things that must be addressed. Don't bury a critical fix among a dozen style notes.
- **Praise what's good.** Review isn't just about catching problems. "Nice use of the discriminated union here" reinforces good patterns.
- **Disagree without being disagreeable.** Disagreement is expected. The goal is to converge on the best technical outcome while keeping the room psychologically safe.

## Review SLAs

Respect each other's time.

- **Aim for a first review within 24 hours** of assignment — even a quick "I'll get to this tomorrow" reaction counts.
- **Maximum turnaround: 48 hours.** If a reviewer hasn't responded in 48 hours, ping them once. If still silent, escalate to the tech lead who can reassign.
- **Fast-track security and payment changes.** These get priority review — drop non-urgent things if needed.
- **Authors respond to feedback within 24 hours.** Don't leave a reviewed PR dangling.
- **Stale PRs (>5 days with no activity) get a nudge; >10 days should be flagged in standup.**

## Handling Disagreements

Two smart engineers can disagree. Have an escalation path.

1. **Discuss in the PR thread first.** Talk it out. Most disagreements resolve here through better explanation or a small compromise.
2. **If the disagreement is architectural, consult the relevant ADR.** If an ADR governs the decision, the ADR wins. If the ADR doesn't cover it or is wrong, that's a signal a new ADR may be needed.
3. **Escalate to the tech lead** if you genuinely cannot converge. Bring the two options, their trade-offs, and the impact of doing nothing. The tech lead decides — and that decision is final for this PR.
4. **Document the decision.** If the outcome sets a new precedent, write an ADR. If it's a one-off, a brief comment in the PR explaining why option A beat option B is enough.
5. **Don't let disagreement fester.** Once decided, commit and move on. No passive-aggressive follow-ups.

## Security Review Triggers

Certain changes demand explicit security scrutiny — call it out in the PR.

- **Auth changes** — new provider, new OAuth flow, session handling changes, credential storage.
- **Payment code** — anything touching Stripe tokens, webhook handlers that process charges, pricing logic.
- **New API endpoints** — especially those accepting user input, returning data to clients, or proxying upstream.
- **DB migrations** — schema changes, new indexes, anything touching PII.
- **Secrets and config** — new environment variables, key rotation, `.env` handling.
- **User-generated content paths** — comments, bios, profile uploads, anything rendered to other users.

For these, a reviewer with security context (or the tech lead) **must** be in the approval chain.

## Performance Review Triggers

Tag performance-sensitive PRs so reviewers know to look deeper.

- **New database queries** — check the plan, check for N+1, check indexes.
- **Large components or heavy client islands** — verify dynamic import / Suspense usage, check bundle impact.
- **Changes to streaming or video playback paths** — signed URL generation, player chrome, buffering logic.
- **Upstream API call changes** — new endpoints, larger payloads, altered caching strategy.
- **Homepage or high-traffic route changes** — performance here is revenue.

For these, include a note in the PR on what you checked (Lighthouse, query plan, bundle analyzer).

## Review Checklist Template

Authors can paste this into a PR. Reviewers can use it to structure feedback.

```markdown
## Review Checklist

### Correctness
- [ ] Happy path works as described
- [ ] Error and empty states handled
- [ ] No obvious logic bugs

### Type Safety
- [ ] `pnpm typecheck` passes with no new errors
- [ ] Zod used for runtime validation at boundaries
- [ ] No `any` or `// @ts-ignore` introduced

### Security
- [ ] Inputs validated and sanitized
- [ ] No secrets in code or logs
- [ ] Auth checks present where needed

### Performance
- [ ] No N+1 or unbounded queries
- [ ] Heavy client components are lazy-loaded
- [ ] Streaming/playback paths unaffected

### Architecture
- [ ] Follows applicable ADRs
- [ ] Respects package boundaries
- [ ] Layering is correct (ADR-001)

### Maintainability
- [ ] Files under 300 lines (or justified)
- [ ] Names are clear and discoverable
- [ ] Non-obvious logic has a short why-comment

### Testing
- [ ] New logic covered by tests
- [ ] Bug fix has a regression test
- [ ] All tests pass locally and on CI

### Docs
- [ ] ADR updated or created if architecture changed
- [ ] Public APIs have TSDoc
- [ ] README updated for new module or behavior
```

## Closing Thought

Good review culture compounds. Every thoughtful review makes the next PR better, the next engineer faster, and the next incident less likely. Invest in it.
