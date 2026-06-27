// lint-staged — runs only on staged files per hook.
//
// ESLint is removed from lint-staged because it requires a per-package
// eslint.config.js with parserOptions.project for type-checked rules.
// Running `eslint --fix` from the repo root would either fail (no config)
// or produce false positives (no type info). ESLint is instead enforced
// through turbo's `lint` task (CI gate) and manual `pnpm lint:fix`.
//
// Prettier is safe to run from any cwd because it ignores project structure.
//
// Docs: docs/12-conventions/Git-Workflow.md §9.1
/** @type {import('lint-staged').Config} */
export default {
  "*.{ts,tsx,js,jsx}": ["prettier --write"],
  "*.{json,md,yml,yaml,css}": ["prettier --write"],
};
