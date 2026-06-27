import nexusConfig from "@nexus/eslint-config";
import tseslint from "typescript-eslint";

// Flat config for @nexus/ui. Re-exports the shared monorepo config and adds
// type-checked project resolution so @typescript-eslint typed rules can
// resolve the local tsconfig.json.
export default tseslint.config(...nexusConfig, {
  files: ["**/*.{ts,tsx}"],
  languageOptions: {
    parserOptions: {
      project: true,
    },
  },
});
