// Commitlint — enforces Conventional Commits 1.0.0 for this monorepo.
//
// Canonical scope registry. Source of truth for commit scopes; reviewed when
// a new package is added. See docs/12-conventions/Commit-Convention.md.
//
// Rules enforced:
//   - type must be one of the Conventional Commits types
//   - scope must be one of the canonical scopes (or empty for top-level)
//   - description: lowercase, no trailing period, max 72 chars (subject)
//   - body: wrapped at 72 chars
//   - footer: wrapped at 72 chars
//   - type cannot be empty; subject cannot be empty
import type { UserConfig } from "@commitlint/types";

const config: UserConfig = {
  // Extends the Conventional Commits preset (Angular-style rules).
  extends: ["@commitlint/config-conventional"],
  // Helpful error messages when a commit fails.
  helpUrl:
    "https://github.com/nexus-anime/nexus-anime/blob/main/docs/12-conventions/Commit-Convention.md",
  rules: {
    // type-enum: the allowed commit types.
    "type-enum": [
      2,
      "always",
      [
        "feat", // new feature (MINOR)
        "fix", // bug fix (PATCH)
        "docs", // documentation only
        "style", // code style, no logic change
        "refactor", // behavior-preserving restructure
        "perf", // performance improvement
        "test", // add or correct tests
        "build", // build system / external deps
        "ci", // CI pipeline changes
        "chore", // housekeeping
        "revert", // undo a previous commit
      ],
    ],
    // scope-enum: canonical scopes from Commit-Convention.md.
    // An empty scope is allowed for top-level / CI / config commits.
    "scope-enum": [
      2,
      "always",
      [
        "ui", // @nexus/ui components, tokens, theme
        "db", // @nexus/db, schema, migrations
        "cache", // @nexus/cache, Redis, feature flags
        "auth", // Auth.js config, providers, middleware
        "api", // Route Handlers, Server Actions
        "docs", // docs/ site, ADRs, guides
        "tooling", // dev toolchain, CI, scripts
        "web", // apps/web
      ],
    ],
    // subject-case: lowercase only.
    "subject-case": [2, "always", ["lower-case"]],
    // subject-empty: subject must not be empty.
    "subject-empty": [2, "never"],
    // subject-full-stop: no trailing period.
    "subject-full-stop": [2, "never", "."],
    // subject-max-length: 72 chars.
    "subject-max-length": [2, "always", 72],
    // body-max-line-length: wrap body at 72 chars.
    "body-max-line-length": [2, "always", 72],
    // footer-max-line-length: wrap footer at 72 chars.
    "footer-max-line-length": [2, "always", 72],
    // type-empty: type must not be empty.
    "type-empty": [2, "never"],
  },
};

export default config;
