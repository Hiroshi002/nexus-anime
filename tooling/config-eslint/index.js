// @nexus/eslint-config — shared flat config for the monorepo (ESLint 9).
// Packages extend this via `eslint --config ../../tooling/config-eslint/index.js`.
/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: ["node_modules/", "dist/", ".next/"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
];
