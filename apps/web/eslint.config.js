import baseConfig from "../../tooling/config-eslint/index.js";
import tseslint from "typescript-eslint";

// ESLint 9 flat config. Composes the shared monorepo rules (tooling/config-eslint)
// with typescript-eslint so .ts/.tsx parse under strict type-checking. The base
// shared config is intentionally parser-agnostic; web is the only package that
// ships JSX today, so the TS parser lives here rather than in tooling.
export default tseslint.config(
  ...baseConfig,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json"],
      },
    },
  },
);
