# @nexus/tsconfig

Shareable, strict TypeScript base configs for every workspace member.

## Usage

```jsonc
// packages/*/tsconfig.json and apps/*/tsconfig.json
{
  "extends": "../../tsconfig.base.json", // root copy — kept for backward compat
  // or, to depend on the package explicitly:
  // "extends": "@nexus/tsconfig"
  "compilerOptions": {
    /* package-specific overrides */
  },
  "include": ["src/**/*.ts"],
}
```

The canonical definition lives in this package (`tsconfig.base.json` at the
package root). A copy remains at the repo root so existing relative
`extends: "../../tsconfig.base.json"` references keep working. When the
base changes, update both in the same PR.
