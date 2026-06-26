# Documentation Standards

> How we write, organize, and maintain documentation at Nexus Anime. Docs are a first-class deliverable — not an afterthought.

## Philosophy

Documentation exists so that a new engineer can understand the system within 30 minutes, a returning engineer can re-orient after a month away, and the team can make decisions without relying on tribal knowledge.

We treat **documentation as code**: Markdown files, versioned with the codebase, reviewed in PRs, and held to the same quality bar as the code they describe.

## Documentation as Code

All documentation lives in the repository as Markdown. This is non-negotiable.

- **Versioned with code.** Docs ship in the same commit as the code they describe. A feature PR that changes behavior updates the relevant doc in the same diff.
- **Reviewed like code.** Doc changes go through the same PR and review process. Typos and clarity issues get the same attention as logic bugs.
- **Discoverable.** A clear folder structure so engineers can guess where a doc lives.
- **Owned.** Every doc has an implicit owner — the team or individual most responsible for the area. Ownership is visible in the file history, not a metadata field nobody maintains.

## Location Conventions

```
docs/
  architecture/
    adr/                    # Architecture Decision Records
  12-conventions/           # How we work (this folder)
  14-milestones/            # Milestone specs and progress
  15-decisions/             # Decision logs beyond ADRs
  REPOSITORY-DESIGN.md      # Repo-wide conventions
  database.md               # Schema, migrations, dialects
  api.md                    # Route contracts, envelope, error codes
  auth.md                   # Auth.js config, providers, session shape
  cache.md                  # Redis usage, key schema, TTLs
  deployment.md             # Vercel config, env vars, edge headers
```

Package-level docs live with their package:

```
packages/
  ui/
    README.md               # What this package exports, how to use it
  db/
    README.md               # Schema overview, migration guide
  cache/
    README.md               # Key schema, TTL conventions
```

Feature-level docs live with their feature module:

```
apps/web/src/
  components/
    anime/
      README.md             # Anime component family: purpose, usage
  actions/
    README.md               # Server Actions: naming, validation rules
```

## Architecture Decision Records (ADRs)

ADRs are **immutable records** of architectural decisions. Once accepted, an ADR is not edited to reflect what actually happened — a new ADR supersedes it.

### When to Write an ADR

Write an ADR when you are making a decision that:

- Changes the structure of the system (new package, new layer, new service boundary).
- Introduces a new technology (database, cache, queue, third-party service).
- Establishes a new pattern that other engineers must follow (error handling, validation, caching).
- Departs from an existing ADR or resolves an ambiguity one did not cover.
- Has meaningful trade-offs that future engineers should understand.

Do **not** write an ADR for trivial choices (library X vs library Y for a one-off utility) or decisions that are easily reversible.

### ADR Format

```markdown
# ADR-XXX: [Title]

## Status
Proposed | Accepted | Superseded by ADR-YYY | Deprecated

## Context
What is the issue we are deciding on? What forces are at play (technical, organizational, timeline)?
What constraints exist? Be specific — cite the relevant code, ADRs, or docs.

## Decision
What did we decide? State it clearly and unambiguously. This is the binding part.

## Consequences
What becomes easier? What becomes harder? What do we need to watch out of?
What follow-up work does this create? Be honest about the downsides — that is the point.

## References
- Related ADRs
- Relevant docs
- Links to the PR that implemented the decision
```

### ADR Lifecycle

1. **Proposed** — open for discussion. The author writes the ADR, links it from the PR, and solicits feedback.
2. **Accepted** — after review and consensus. Move to `docs/architecture/adr/`. The decision is now binding.
3. **Superseded** — a later ADR replaces it. The old ADR stays in place with its status updated, so the history is preserved.
4. **Deprecated** — the decision is no longer relevant but not replaced. Rare; prefer superseded.

### ADR Numbering

Sequential, zero-padded: `ADR-001`, `ADR-002`, ... The number is assigned when the ADR is accepted, not when proposed. Proposed ADRs use `ADR-XXX` as a placeholder.

## Milestone Specs

Milestone specs define the scope and acceptance criteria for a milestone. They live in `docs/14-milestones/`.

### Milestone Spec Format

```markdown
# M[N]: [Milestone Name]

## Objective
One sentence on what this milestone achieves and why it matters.

## Scope
What is in and what is out. Be explicit — scope creep is the default, so name the boundaries.

## Deliverables
Numbered list of concrete deliverables. Each should be independently verifiable.

1. [Deliverable] — [brief description]
2. ...

## Acceptance Criteria
How we know the milestone is done. These should be testable.

- [ ] Criterion 1
- [ ] Criterion 2
- ...

## Risks and Mitigations
What could go wrong and how we handle it.

## Dependencies
What must be true before this milestone can start.
```

## README Requirements

Every package and feature module has a README. The README is the entry point — if it doesn't exist, the module doesn't exist for onboarding purposes.

### Package README

```markdown
# @nexus/[package]

One-line purpose.

## What It Does
Two to three sentences on responsibility and boundaries.

## Installation / Setup
How to use it from another package in the monorepo.

## Public API
List of the main exports with one-line descriptions. Link to TSDoc for detail.

## Conventions
Any package-specific rules (naming, file layout, key schema).

## Testing
How to run tests for this package.
```

### Feature Module README

```markdown
# [Feature Name]

What this feature does and who owns it.

## Components / Actions / Hooks
List of the main pieces with one-line descriptions.

## Data Flow
How data moves through this feature (server → client, cache → UI).

## Edge Cases and Gotchas
What bites people. Update this as you learn.

## Related Docs
Links to ADRs, milestone specs, and relevant docs.
```

## Code Documentation

Code documents itself for the **what**. Your job is to document the **why**.

### TSDoc for Public APIs

Every public export gets a TSDoc comment. This is how consumers discover behavior without reading the implementation.

```typescript
/**
 * Fetches an anime detail by ID, caching the result in Redis.
 *
 * Cache TTL is 15 minutes. Callers should not rely on cache being warm —
 * a cache miss triggers a fresh fetch from TMDB.
 *
 * @param id - The TMDB anime ID
 * @returns The anime detail, or null if not found
 * @throws {ApiError} If the upstream request fails
 */
export async function getAnimeDetail(id: number): Promise<AnimeDetail | null> {
  // ...
}
```

TSDoc should cover:
- What the function does (one sentence).
- Non-obvious behavior (caching, side effects, error conditions).
- Parameter descriptions (especially when the name isn't self-explanatory).
- Return value and what "empty" or "not found" looks like.
- Exceptions thrown and when.

### Inline Comments

Use inline comments for **non-obvious logic only**. If the code is clear without a comment, don't add one.

Good:
```typescript
// TMDB returns runtime in minutes; convert to hours for display.
const hours = Math.round(runtime / 60);
```

Bad:
```typescript
// Convert runtime to hours.
const hours = Math.round(runtime / 60);
```

The bad comment restates the code. The good comment explains the **why** (the upstream contract).

### What Not to Comment

- Don't restate the code.
- Don't leave commented-out code in commits — delete it; git history preserves it.
- Don't use comments as a TODO tracker — use issues. A `// TODO` is acceptable only when it includes an issue number: `// TODO(#123): handle pagination`.

## Changelog Maintenance

We generate the changelog automatically from **Conventional Commits**. This means commit messages are load-bearing.

### Commit Types That Feed the Changelog

- `feat:` — new feature (minor version bump).
- `fix:` — bug fix (patch version bump).
- `BREAKING CHANGE` in footer — breaking change (major version bump).
- `docs:`, `chore:`, `refactor:`, `test:` — do not appear in the changelog by default.

### Changelog Generation

Run `pnpm changelog` (or the equivalent release script) before tagging a release. The tool parses commits since the last tag and produces `CHANGELOG.md`. Review the generated output — automated is not the same as correct.

## How to Update Documentation

Documentation changes follow the same workflow as code changes.

1. **Branch.** Create a short-lived branch: `docs/adr-012-redis-cluster`, `docs/m3-auth-spec`, etc.
2. **Edit.** Make the change. For ADRs, use the format above. For specs, use the milestone format.
3. **Review.** Open a PR. The same review process applies — at least one approval, constructive feedback.
4. **Merge.** Squash-and-merge. The doc ships with the code it describes.

### Updating an Existing Doc

- For **corrections** (typos, broken links, stale references): a small PR is fine. No need for a heavy process.
- For **substantive changes** (new decision, scope change): treat it like a feature PR. Explain the motivation in the PR description.
- For **ADRs**: do not edit an accepted ADR to change its decision. Write a new ADR that supersedes it.

## Documentation Quality Bar

Before merging a doc, verify:

- **Accuracy.** Does it reflect the current state of the code? Stale docs are worse than no docs.
- **Clarity.** Can a new engineer understand it without reading the code? If not, it needs work.
- **Completeness.** Are the edge cases, trade-offs, and follow-ups covered?
- **Discoverability.** Is it in the right folder? Is it linked from the relevant README or parent doc?
- **Brevity.** Say what needs saying, then stop. A 10-page ADR nobody reads is a failed ADR.

## Closing Thought

Documentation is a gift to your future self and your future teammates. Write the doc you wish you'd found on your first day.
