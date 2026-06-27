// @nexus/eslint-config — shared flat config for the monorepo (ESLint 9+).
//
// This is the single source of truth for lint rules across `apps/*` and
// `packages/*`. Consumer packages re-export it:
//
//   import nexusConfig from "@nexus/eslint-config";
//   export default [...nexusConfig, { languageOptions: { parserOptions: { project: true } } }];
//
// Rules encoded here:
//   - typescript-eslint recommended + type-checked strictness
//   - react-hooks rules of hooks + exhaustive-deps
//   - react-refresh "only export components" (Next.js Fast Refresh safety)
//   - eslint-plugin-import: enforce import ordering & dedup
//   - eslint-plugin-unused-imports: auto-remove unused imports
//   - eslint-plugin-boundaries: package-boundary contract (docs/03-architecture/Dependency-Graph.md §158–180)
//     ui ⇸ db/cache ; cache ⇸ db ; config/packages ⇸ web ; db/cache ⇸ web
//
// NOTE on DSL: the boundary enforcement rule is `boundaries/element-types`
// (NOT `boundaries/dependency-types`, which does not exist and would silently
// no-op). See eslint-plugin-boundaries docs.

import eslintJs from "@eslint/js";
import tseslint from "typescript-eslint";
import boundariesPlugin from "eslint-plugin-boundaries";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import * as importPlugin from "eslint-plugin-import";
import unused from "eslint-plugin-unused-imports";
import globals from "globals";

export default tseslint.config(
  // Build artifacts & dependency trees — never lint these.
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      ".next/**",
      ".turbo/**",
      "coverage/**",
      "**/*.d.ts",
      "**/*.config.*",
    ],
  },

  // Global defaults applied to all linted JS/TS.
  eslintJs.configs.recommended,

  // TypeScript strict layer — recommended plus the type-checked rules that
  // read tsconfig project info. Consumers that need JSX type info layer their
  // own `languageOptions.parserOptions.project` on top (see apps/web/eslint.config.js).
  ...tseslint.configs.recommendedTypeChecked,

  // Per-file rule set — the actual curated ruleset.
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      boundaries: boundariesPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      import: importPlugin,
      "unused-imports": unused,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
      },
    },
    settings: {
      // Boundary element map — maps filesystem glob patterns to the package
      // "element types" that boundaries/element-types matches against using
      // micromatch. Any file not matched by a pattern is treated as
      // "unknown" and guarded by boundaries/no-unknown-files.
      //
      // Boundary element map. Maps filesystem glob patterns to the package
      // "element types" that boundaries/element-types matches against.
      //
      // DSL NOTE: The plugin matcher (eslint-plugin-boundaries v5.4) walks
      // each element's pattern using its default folder-mode matcher:
      // it accumulates path segments from the end of the file's absolute
      // path (`context.filename`, e.g.
      // "/workspace/.../apps/web/src/app/layout.tsx") and tests the
      // progressive suffix against `pattern + "/**/*"`. So when the
      // accumulated suffix reaches "apps/web/src/app/layout.tsx", the
      // pattern "apps/web/**" with folder mode matches. We therefore need
      // the `apps/web` component to appear in the path — which it does for
      // any file actually inside apps/web.
      //
      // The fallback `root` element (everything) prevents
      // `no-unknown-files` from firing on config files, etc., while
      // `element-types` enforcement still applies to registered elements.
      "boundaries/elements": [
        { type: "web", pattern: "apps/web/**" },
        { type: "ui", pattern: "packages/ui/**" },
        { type: "db", pattern: "packages/db/**" },
        { type: "cache", pattern: "packages/cache/**" },
        // Fallback root element — catches any file not matched above so
        // that infrastructure files (configs, tooling) do not trigger
        // `no-unknown-files`. Boundary enforcement still applies via the
        // element-types rule above for matched elements.
        { type: "root", pattern: "**" },
      ],
      "boundaries/additional-dependency-types": [],
    },
    rules: {
      // react-hooks
      ...reactHooks.configs.recommended.rules,

      // react-refresh — Fast Refresh requires components be the only exports
      // in a module. Non-component helpers deserve their own file.
      // Next.js reserved named exports (metadata, viewport, generateMetadata,
      // generateViewport) are whitelisted — Fast Refresh supports them on
      // layout/page/loading/error/not-found/route/middleware files.
      "react-refresh/only-export-components": [
        "warn",
        {
          allowExportNames: ["metadata", "viewport", "generateMetadata", "generateViewport"],
        },
      ],

      // import ordering — `import/first` forces all imports to the top,
      // `import/order` enforces grouped ordering, `import/no-duplicates`
      // catches the same module imported twice.
      "import/first": "error",
      "import/newline-after-import": "error",
      "import/no-duplicates": "error",
      "import/no-unresolved": "error",
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "object",
            "type",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],

      // unused-imports — auto-fixable removal of unused imports / vars.
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],

      // Package-boundary contract (docs/03-architecture/Dependency-Graph.md §158–180).
      // Using `boundaries/element-types` — the correct rule name. The enforce
      // DSL: default allows everything; listed `from→disallow` pairs reject
      // cross-boundary imports.
      //
      // Note: `boundaries/no-unknown-files` is boolean-only in this plugin
      // version — it does not accept an options object. Passing one throws
      // "should NOT have more than 0 items", so we keep it as a bare severity.
      // Disabled by default because our fallback `root` element matches
      // everything unregistered; turn this `error` back on once you have
      // complete element coverage and want unknown-file detection.
      "boundaries/no-unknown-files": "off",
      "boundaries/element-types": [
        "error",
        {
          default: "allow",
          message:
            "Dependency from '{file.type}' to '{dep.type}' is not allowed. See docs/03-architecture/Dependency-Graph.md.",
          rules: [
            // UI is pure presentation — never import from db/cache layers.
            {
              from: "ui",
              disallow: ["db", "cache"],
              message: "UI components must not depend on db/cache. Lift state into apps/web.",
            },
            // Cache depends on shared primitives only — not on db.
            {
              from: "cache",
              disallow: ["db"],
              message: "Cache package must not depend on db.",
            },
            // Root-level packages must not depend on web (downward coupling).
            {
              from: "root",
              disallow: ["web"],
              message: "Shared packages must not depend on apps/web.",
            },
            // db & cache must not depend on the web app.
            {
              from: "db",
              disallow: ["web"],
              message: "db package must not depend on apps/web.",
            },
            {
              from: "cache",
              disallow: ["web"],
              message: "cache package must not depend on apps/web.",
            },
          ],
        },
      ],

      // Misc quality rules inherited from existing tooling config, kept here
      // so consumers do not drift.
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-unused-vars": "off", // superseded by unused-imports

      // typescript-eslint strictness gaps that `recommendedTypeChecked` does
      // not add by default, but that keep our codebase honest under strict.
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
    },
  },
);
