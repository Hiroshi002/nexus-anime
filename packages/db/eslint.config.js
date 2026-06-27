import nexusConfig from "@nexus/eslint-config";
import tseslint from "typescript-eslint";

export default tseslint.config(...nexusConfig, {
  files: ["**/*.{ts,tsx}"],
  languageOptions: {
    parserOptions: {
      project: true,
    },
  },
});
