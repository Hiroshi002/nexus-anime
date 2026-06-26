# Tokens

> The master design token index for Nexus Anime — the single source of truth for all token names, values, and groupings ready for implementation.

---

## Design Decision

Design tokens are the **bridge between design and code**. They are platform-agnostic key-value pairs that define every visual property. This document is the canonical token registry — all other design system documents derive their specific values from these tokens.

**Why tokens, not raw values?** Tokens provide:
1. **Single source of truth** — change a token value once, update everywhere.
2. **Semantic meaning** — `surface-raised` communicates intent; `#111627` does not.
3. **Theming support** — swap token definitions for light theme, high-contrast mode, etc.
4. **Validation** — tooling can verify that component code uses only defined tokens.

---

## Token Architecture

```
tokens/
├── global/           # Raw palette values (never used in components)
│   ├── color.json    # Palette colors — void, aether, nova, semantic
│   ├── space.json    # Spatial scale
│   ├── time.json     # Duration values
│   └── blur.json     # Blur pixel values
├── semantic/         # Meaning-mapped tokens (what components reference)
│   ├── color.json    # surface-*, text-*, border-*, action-*
│   ├── typography.json # text-*, weight-*, tracking-*
│   ├── spacing.json  # inset-*, stack-*, inline-*
│   ├── radius.json   # radius-*
│   ├── shadow.json   # shadow-*, elevation-*
│   ├── motion.json   # duration-*, ease-*
│   └── blur.json     # blur-*, glass-*
└── component/        # Component-specific token compositions
    ├── button.json
    ├── card.json
    ├── input.json
    └── ...
```

**Decision: Three-tier token architecture (global → semantic → component).** This is the W3C Design Tokens specification pattern. Global tokens define the palette. Semantic tokens map palette values to meaning. Component tokens compose semantic tokens for specific use cases. Components reference component tokens or semantic tokens — never global tokens.

---

## Global Token Registry

### Color Palette

```jsonc
{
  "void": {
    "0":  { "$value": "oklch(0.02 0.01 260)", "$hex": "#050810" },
    "1":  { "$value": "oklch(0.06 0.02 260)", "$hex": "#0a0e1a" },
    "2":  { "$value": "oklch(0.10 0.02 260)", "$hex": "#111627" },
    "3":  { "$value": "oklch(0.14 0.02 260)", "$hex": "#171d30" },
    "4":  { "$value": "oklch(0.18 0.02 260)", "$hex": "#1c2338" },
    "5":  { "$value": "oklch(0.22 0.02 260)", "$hex": "#222840" },
    "6":  { "$value": "oklch(0.28 0.02 260)", "$hex": "#2d3450" },
    "7":  { "$value": "oklch(0.35 0.02 260)", "$hex": "#3a4160" },
    "8":  { "$value": "oklch(0.45 0.02 260)", "$hex": "#505876" },
    "9":  { "$value": "oklch(0.60 0.02 260)", "$hex": "#747c9e" },
    "10": { "$value": "oklch(0.75 0.02 260)", "$hex": "#a3aac6" },
    "11": { "$value": "oklch(0.88 0.02 260)", "$hex": "#cdd1e2" },
    "12": { "$value": "oklch(0.95 0.005 260)", "$hex": "#ecedf5" }
  },
  "aether": {
    "1": { "$value": "oklch(0.30 0.10 230)", "$hex": "#1a4a6b" },
    "2": { "$value": "oklch(0.40 0.12 230)", "$hex": "#2563a0" },
    "3": { "$value": "oklch(0.50 0.14 230)", "$hex": "#3380c4" },
    "4": { "$value": "oklch(0.60 0.15 230)", "$hex": "#4199d8" },
    "5": { "$value": "oklch(0.70 0.15 230)", "$hex": "#5bb2ea" },
    "6": { "$value": "oklch(0.80 0.12 230)", "$hex": "#82c7f5" },
    "7": { "$value": "oklch(0.90 0.08 230)", "$hex": "#b0ddfa" },
    "8": { "$value": "oklch(0.95 0.04 230)", "$hex": "#daedfc" }
  },
  "nova": {
    "1": { "$value": "oklch(0.30 0.12 310)", "$hex": "#6b1a5e" },
    "2": { "$value": "oklch(0.45 0.15 310)", "$hex": "#a0258a" },
    "3": { "$value": "oklch(0.55 0.16 310)", "$hex": "#c033a5" },
    "4": { "$value": "oklch(0.65 0.15 310)", "$hex": "#da44bc" },
    "5": { "$value": "oklch(0.75 0.13 310)", "$hex": "#ec66d4" },
    "6": { "$value": "oklch(0.85 0.10 310)", "$hex": "#f494e4" }
  },
  "semantic": {
    "success":        { "$value": "oklch(0.65 0.18 150)", "$hex": "#22c55e" },
    "success-muted":  { "$value": "oklch(0.40 0.08 150)", "$hex": "#166534" },
    "warning":        { "$value": "oklch(0.75 0.16 85)",  "$hex": "#f59e0b" },
    "warning-muted":  { "$value": "oklch(0.45 0.08 85)",  "$hex": "#92400e" },
    "error":          { "$value": "oklch(0.60 0.20 25)",  "$hex": "#ef4444" },
    "error-muted":    { "$value": "oklch(0.35 0.10 25)",  "$hex": "#7f1d1d" },
    "info":           { "$value": "oklch(0.60 0.15 230)", "$hex": "#4199d8" }
  },
  "specialty": {
    "platinum":       { "$value": "oklch(0.85 0.02 80)",  "$hex": "#d4cfc4" },
    "gold":           { "$value": "oklch(0.80 0.12 85)",  "$hex": "#d4a017" },
    "streaming-live": { "$value": "oklch(0.65 0.22 25)",  "$hex": "#e53e3e" }
  }
}
```

### Spacing

```jsonc
{
  "space": {
    "0":   { "$value": "0px" },
    "0_5": { "$value": "2px" },
    "1":   { "$value": "4px" },
    "1_5": { "$value": "6px" },
    "2":   { "$value": "8px" },
    "2_5": { "$value": "10px" },
    "3":   { "$value": "12px" },
    "3_5": { "$value": "14px" },
    "4":   { "$value": "16px" },
    "5":   { "$value": "20px" },
    "6":   { "$value": "24px" },
    "7":   { "$value": "28px" },
    "8":   { "$value": "32px" },
    "9":   { "$value": "36px" },
    "10":  { "$value": "40px" },
    "12":  { "$value": "48px" },
    "16":  { "$value": "64px" },
    "20":  { "$value": "80px" },
    "24":  { "$value": "96px" }
  }
}
```

### Radius

```jsonc
{
  "radius": {
    "0":    { "$value": "0px" },
    "1":    { "$value": "2px" },
    "2":    { "$value": "4px" },
    "3":    { "$value": "6px" },
    "4":    { "$value": "8px" },
    "5":    { "$value": "12px" },
    "6":    { "$value": "16px" },
    "full": { "$value": "9999px" }
  }
}
```

### Duration

```jsonc
{
  "duration": {
    "0":    { "$value": "0ms" },
    "50":   { "$value": "50ms" },
    "100":  { "$value": "100ms" },
    "150":  { "$value": "150ms" },
    "200":  { "$value": "200ms" },
    "250":  { "$value": "250ms" },
    "350":  { "$value": "350ms" },
    "500":  { "$value": "500ms" },
    "700":  { "$value": "700ms" },
    "1000": { "$value": "1000ms" }
  }
}
```

### Easing

```jsonc
{
  "ease": {
    "linear":   { "$value": "cubic-bezier(0, 0, 1, 1)" },
    "in":       { "$value": "cubic-bezier(0.4, 0, 1, 1)" },
    "out":      { "$value": "cubic-bezier(0, 0, 0.2, 1)" },
    "in-out":   { "$value": "cubic-bezier(0.4, 0, 0.2, 1)" },
    "spring":   { "$value": "cubic-bezier(0.22, 1, 0.36, 1)" },
    "bounce":   { "$value": "cubic-bezier(0.68, -0.55, 0.265, 1.55)" },
    "sluggish": { "$value": "cubic-bezier(0.5, 0, 0.3, 1)" }
  }
}
```

### Blur

```jsonc
{
  "blur": {
    "xs":          { "$value": "4px" },
    "sm":          { "$value": "8px" },
    "md":          { "$value": "16px" },
    "lg":          { "$value": "24px" },
    "xl":          { "$value": "32px" },
    "content-sm":  { "$value": "8px" },
    "content-md":  { "$value": "20px" }
  }
}
```

### Typography

```jsonc
{
  "font": {
    "display": { "$value": "'Space Grotesk', system-ui, -apple-system, sans-serif" },
    "body":    { "$value": "'Inter', system-ui, -apple-system, sans-serif" }
  },
  "text": {
    "xs":   { "$value": "11px", "$line-height": "1.45", "$weight": "500", "$font": "body" },
    "sm":   { "$value": "12px", "$line-height": "1.5",  "$weight": "400", "$font": "body" },
    "base": { "$value": "14px", "$line-height": "1.5",  "$weight": "400", "$font": "body" },
    "md":   { "$value": "16px", "$line-height": "1.5",  "$weight": "500", "$font": "body" },
    "lg":   { "$value": "18px", "$line-height": "1.4",  "$weight": "600", "$font": "body" },
    "xl":   { "$value": "22px", "$line-height": "1.35", "$weight": "600", "$font": "display" },
    "2xl":  { "$value": "28px", "$line-height": "1.3",  "$weight": "700", "$font": "display" },
    "3xl":  { "$value": "35px", "$line-height": "1.25", "$weight": "700", "$font": "display" },
    "4xl":  { "$value": "44px", "$line-height": "1.2",  "$weight": "700", "$font": "display" },
    "5xl":  { "$value": "55px", "$line-height": "1.15", "$weight": "700", "$font": "display" },
    "6xl":  { "$value": "69px", "$line-height": "1.1",  "$weight": "700", "$font": "display" }
  },
  "tracking": {
    "tight":   { "$value": "-0.02em" },
    "normal":  { "$value": "0" },
    "wide":    { "$value": "0.02em" },
    "wider":   { "$value": "0.06em" },
    "widest":  { "$value": "0.12em" }
  },
  "icon": {
    "xs":  { "$value": "12px" },
    "sm":  { "$value": "16px" },
    "md":  { "$value": "20px" },
    "lg":  { "$value": "24px" },
    "xl":  { "$value": "32px" },
    "2xl": { "$value": "48px" }
  }
}
```

### Breakpoints

```jsonc
{
  "breakpoint": {
    "xs":  { "$value": "0px" },
    "sm":  { "$value": "640px" },
    "md":  { "$value": "768px" },
    "lg":  { "$value": "1024px" },
    "xl":  { "$value": "1280px" },
    "2xl": { "$value": "1536px" }
  }
}
```

---

## Semantic Token Registry

### Surface

```jsonc
{
  "surface": {
    "base":     { "$value": "{void.1}" },
    "raised":   { "$value": "{void.2}" },
    "overlay":  { "$value": "{void.3}" },
    "elevated": { "$value": "{void.4}" },
    "floating": { "$value": "{void.5}" },
    "sunken":   { "$value": "{void.0}" }
  }
}
```

### Text

```jsonc
{
  "text": {
    "primary":      { "$value": "{void.12}" },
    "secondary":    { "$value": "{void.10}" },
    "tertiary":     { "$value": "{void.9}" },
    "placeholder":  { "$value": "{void.8}" },
    "disabled":     { "$value": "{void.7}" },
    "on-accent":    { "$value": "{void.1}" },
    "inverse":      { "$value": "{void.1}" }
  }
}
```

### Border

```jsonc
{
  "border": {
    "subtle":  { "$value": "{void.6}" },
    "default": { "$value": "{void.7}" },
    "strong":  { "$value": "{void.8}" },
    "accent":  { "$value": "{aether.4}" }
  }
}
```

### Action

```jsonc
{
  "action": {
    "primary-bg":      { "$value": "{aether.4}" },
    "primary-hover":   { "$value": "{aether.3}" },
    "primary-pressed": { "$value": "{aether.2}" },
    "primary-text":    { "$value": "{void.1}" },
    "secondary-bg":    { "$value": "{void.3}" },
    "secondary-hover": { "$value": "{void.4}" },
    "secondary-text":  { "$value": "{void.11}" },
    "ghost-hover":     { "$value": "{void.3}" },
    "accent-bg":       { "$value": "{nova.4}" },
    "accent-text":     { "$value": "{void.1}" }
  }
}
```

---

## Implementation Format

Tokens are stored as JSON following the **W3C Design Tokens Community Group** format (`$value` key, `{alias}` references). Build tooling (Style Dictionary or similar) transforms these into:

1. **CSS Custom Properties** — `--nexus-surface-raised: #111627;`
2. **Tailwind configuration** — Extend `theme` with token values.
3. **TypeScript types** — Auto-generated constant types for token names.

### CSS Custom Property Naming

```
--nexus-{group}-{token}
```

Examples:
- `--nexus-surface-raised`
- `--nexus-text-primary`
- `--nexus-duration-250`
- `--nexus-ease-spring`
- `--nexus-radius-4`
- `--nexus-blur-md`

### Tailwind Configuration Mapping

```js
// Design specification — not implementation
module.exports = {
  theme: {
    extend: {
      colors: {
        nexus: {
          'surface-base': 'var(--nexus-surface-base)',
          'surface-raised': 'var(--nexus-surface-raised)',
          // ...
        }
      },
      spacing: {
        '0.5': 'var(--nexus-space-0_5)',
        '1': 'var(--nexus-space-1)',
        // ...
      },
      borderRadius: {
        '1': 'var(--nexus-radius-1)',
        // ...
      },
      // ...
    }
  }
}
```

---

## Token Validation Rules

1. **No component references global tokens directly.** Always go through semantic layer.
2. **Semantic tokens reference only global tokens or other semantic tokens.** No raw values in semantic definitions.
3. **Component tokens reference only semantic tokens.** No global token references.
4. **Token names use kebab-case.** `surface-raised`, not `surfaceRaised` or `surface_Raised`.
5. **Every semantic token has a description** documenting its purpose and valid contexts.
6. **Deprecated tokens are kept for 2 major versions** with a `$deprecated: true` flag and a `$replacement` pointer.
7. **No orphan tokens.** Every token must be referenced by at least one component or another token.
