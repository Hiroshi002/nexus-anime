# Commit Convention

Every commit on `main` follows the [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) specification. This discipline powers semantic versioning, automatic changelog generation, and readable `git log` output.

## Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Constraints:

- The `<type>` field is mandatory and lower-case.
- The `<scope>` field is optional and lower-case.
- The `<description>` field is mandatory, starts with a lowercase letter, and has no trailing period.
- Wrap the body at **72 characters** per line.
- The body and footer are separated by a single blank line.

## Types

### `feat` — a new feature

User-visible capability that did not previously exist. Bumps **MINOR**.

```
feat(auth): add Google OAuth callback route handler
```

```
feat(catalog): implement infinite scroll on anime listing
```

### `fix` — a bug fix

Corrects incorrect behavior the user can observe. Bumps **PATCH**.

```
fix(video): resume from saved progress after session restore
```

```
fix(cache): fall through to upstream when Redis is unreachable
```

### `docs` — documentation only

Markdown, ADRs changes that do not affect behavior. Bumps **PATCH** if included in the changelog, otherwise no version bump at the maintainer's discretion.

```
docs(adrs): add ADR-004 for Redis as cache-only
```

### `style` — code style with no logic change

Formatting, semicolons, trailing commas — changes that do not affect runtime behavior and produce no diff in compiled output.

```
style(ui): normalize quote style in tailwind config
```

### `refactor` — behavior-preserving restructure

Renames, extractions, type simplifications. The test suite must pass before and after with no behavioral difference. Bumps **PATCH**.

```
refactor(db): extract watchlist query into reusable builder
```

### `perf` — performance improvement

Demonstrated improvement on a measurable axis. Bumps **PATCH**.

```
perf(catalog): cache TMDB genre list in Redis for 60s
```

### `test` — add or correct tests

Bumps **PATCH**.

```
test(auth): cover session refresh on token near-expiry
```

### `chore` — housekeeping

Dependency bumps, CI config, build scripts. No user-visible change. Conventional changelogs usually omit these.

```
chore: upgrade Next.js to 16.0.0
```

### `ci` — CI pipeline changes

```
ci: add `build` status check required for merge
```

### `build` — build system or external dependencies

```
build: pin esbuild to 0.23.1 to avoid binary drift
```

### `revert` — undo a previous commit

The body **must** reference the commit hash being reverted.

```
revert: feat(auth): add Google OAuth callback route handler

This reverts commit 7a3b2f1 due to token leakage in server logs.
```

## Common Scopes

Scopes declare **what part of the monorepo** the commit touches. Use them when a consumer needs to filter the changelog by subsystem. The canonical scopes are declared in `.commitlintrc.ts` and reviewed a new package is added.

| Scope    | Owning package / area                                  |
| -------- | ------------------------------------------------------ |
| `ui`     | `@nexus/ui` components, tokens, theme, Tailwind config |
| `db`     | `@nexus/db`, schema, migrations, Drizzle queries       |
| `cache`  | `@nexus/cache`, Redis schema, Feature flags            |
| `auth`   | Auth.js config, providers, middleware, session shape   |
| `api`    | Route Handlers, Server Actions, envelope types         |
| `docs`   | `docs/` site, ADRs, guides                             |
| _(none)_ | Top-level config, Turborepo, CI, root scripts          |

Prefer the narrower scope. A change to the watchlist route handler in `apps/web/src/app/api/watchlist/route.ts` is scoped `api`, not `(none)`.

- Good: `fix(api): return 401 for unprotected watchlist endpoint`
- Bad: `fix: return 401 for unprotected watchlist endpoint` (no scope, forces consumer to read the diff)

## Body

The body explains **why** the change was made, not **what** diff the reader can see. Use it when the motivation is non-obvious.

Rules:

1. Use a blank line between the subject and the body.
2. Wrap at 72 characters per line.
3. Use bullet points (`-`) when listing multiple reasons or effects.
4. Reference issue numbers as `#NNN`, not full URLs — GitHub and GitLab both render these correctly.

Example:

```
fix(cache): wipe stale genre cache on TMDB 404

WMDB began returning 404 for genre IDs 44–52 in early 2026. Our 15m
TTL was serving the now-stale mappings through the catalog page. Now we
short-circuit genre fetches that return an upstream 404, improving
the initial cache from 15m TTL to a fresh fetch on next miss.

Closes #218
```

Avoid a body for simple, self-evident commits. `feat(auth): add Google OAuth callback` needs no body.

## Footer

Footers are structured like RFC 2822 headers — one per line, separated from the body by a blank line. Three forms are recognized.

### BREAKING CHANGE

Any change that forces a consumer to update their code or config. Bumps **MAJOR** regardless of type.

```
feat(db): switch watchlist primary key to UUID

BREAKING CHANGE: `watchlist.id` is now a UUID instead of a sequential
integer. Migrate existing references before upgrading.

Closes #301
```

### Closes

Reference an issue the commit resolves. GitHub closes the issue when the commit lands on `default`, so we say `Closes #NNN`.

```
fix(api): return empty array for unwatched users with no history

Closes #187
```

### Co-Authored-By

Attribute a co-author. Required when pair programming or cherry-picking someone else's work. The line must include an email to be recognized by GitHub.

```
Co-Authored-By: Jane Doe <jane.doe@users.noreply.github.com>
```

## Good vs Bad

Discipline in commit messages pays off six months later when `git log --grep` is the fastest way to find the origin of a decision.

### Good

```
feat(catalog): add sort control to anime listing page

Sort by popularity, rating, release date, or trending — persisted in
query params so the URL is shareable. The control renders as a
combobox on mobile and a pill-bar on desktop.

Closes #142
```

Why it works: type, scope, lowercase subject, no period, body explains motivation, issue closed by footer.

### Bad

```
add sort

I added sorting. It works for popularity and rating. Also fixed a thing
where the page crashed on Safari. Will add trending later.

fixes #142, #143, #144
```

Why it fails:

- No `type:` — commitlint rejects it.
- Mixed concerns (sorting + bug fix + deferred work) in a single commit.
- "fixed a thing" is not a useful description.
- The body lists issue numbers without `Closes` semantics — they will not auto-close on merge.

Split into three commits:

```
feat(catalog): add popularity and rating sort combobox

Sort persists in the `sort` query param so the URL is shareable.
Renders as a combobox on mobile and a pill-bar on desktop.

Closes #142
```

```
fix(catalog): guard against null sort key on session restore

Resolves a Safari-specific crash when `sessionStorage` contained a
stale sort key no longer in the enum.

Closes #143
```

## Commit Atomicity

One logical change per commit. Atomic commits make bisect, revert, and cherry-pick reliable.

- Add the feature in one commit. Update the tests in another. Bump the dependency in a third.
- Do **not** mix a refactor with a behavior change. Reviewers must be able to approve the refactor whole-sale and focus scrutiny on the behavior change.
- If a commit touches 20 files because of a rename, call it `refactor(...):` and let the diff speak.

As a rough heuristic: if you need to use "and" in the subject line, split the commits.

## Mapping to Version Bumps and Changelog

Schema is Conventional Commits 1.0.0 with the Angular default set extended for our scopes. The repository uses `semantic-release` with the `conventionalcommits` preset to derive version numbers from the commit log since the last tag.

| Footer / marker                         | Type constraint | Version bump                          |
| --------------------------------------- | --------------- | ------------------------------------- |
| `BREAKING CHANGE` or trailing `!`       | any             | MAJOR                                 |
| `feat`                                  | —               | MINOR                                 |
| `fix`                                   | —               | PATCH                                 |
| `perf`                                  | —               | PATCH                                 |
| `docs`, `style`, `chore`, `ci`, `build` | —               | _(omitted from changelog by default)_ |

Feature and fix commits land in the changelog grouped under "Features" and "Bug Fixes". Each entry includes the scope and links to the PR.

```
## Features

- **catalog** [#142](.../pull/142): add sort control to anime listing page
- **auth** [#138](.../pull/138): add Google OAuth callback route handler
```

## Amending Commits

Amending is safe **before pushing** and only on branches not yet shared with another developer.

- During local iteration, prefer amending: `git commit --amend` keeps history clean.
- Once you push, **do not amend** on a PR branch — rewriting public history invalidates in-flight review diffs.
- After a reviewer requests changes, prefer a **new commit** addressed to the feedback rather than amending. The squash-and-merge at PR merge consolidates the history; the individual revision commits are noise and are discarded during the squash.

If you accidentally pushed a bad commit locally (misspelled subject, leaked token), coordinate with the team — revising pushed history is a force-push, which is prohibited on `main`. On a PR branch the maintainer may force-push a revert commit instead.

## Further Reading

- [Branching Strategy](./Branching-Strategy.md) — the branch lifecycle that carries commits to `main`.
- [Pull Request Standards](./Pull-Request-Standards.md) — PR title format and CI gates.
- `.commitlintrc.ts` — commit message enforcement config.
- `package.json` (`release` script) — semantic-release configuration.
