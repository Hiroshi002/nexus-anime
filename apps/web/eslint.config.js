// ESLint 9 flat config for @nexus/web.
//
// Composes the shared monorepo rules from @nexus/eslint-config with the
// type-checked layer that needs the local tsconfig project info. The shared
// config is intentionally parser-agnostic; web is the only package that ships
// JSX today, so the TS parser + project resolution lives here rather than in
// the shared package.
import nexusConfig from "@nexus/eslint-config";
import tseslint from "typescript-eslint";

export default tseslint.config(...nexusConfig, {
  files: ["**/*.{ts,tsx}"],
  languageOptions: {
    parserOptions: {
      project: ["./tsconfig.json"],
    },
  },
});
