# Theme

> The theme architecture for Nexus Anime — dark theme specification, future extensibility, and CSS custom property strategy.

---

## Design Decision

The platform ships with a **single theme: Dark (codename: Midnight).** This is the primary identity — the "cinematic portal" aesthetic is fundamentally dark. A light theme is architecturally feasible (all tokens are semantic, not color-literal) but is not designed or implemented in the current milestone scope.

**Why dark-only for v1?**
- The brand identity is dark. A light theme would be a fundamentally different visual experience.
- Designing two themes simultaneously doubles design effort and splits attention.
- The anime streaming market skews dark (Crunchyroll, HIDIVE, AnimeLab all default to dark).
- Semantic token architecture ensures a light theme can be added later without touching component code.

**Why name it "Midnight"?** Theme names avoid the ambiguous "dark"/"light" — which describe appearance, not identity. "Midnight" is evocative, on-brand, and unambiguous. Future themes get their own names (e.g., "Dawn" for light, "Aurora" for high-contrast).

---

## Midnight Theme Specification

### Surface Colors

| Token | Value | Preview |
|-------|-------|---------|
| `surface-base` | `#0a0e1a` | ██████████ Deep void |
| `surface-raised` | `#111627` | ██████████ Card surface |
| `surface-overlay` | `#171d30` | ██████████ Modal surface |
| `surface-elevated` | `#1c2338` | █████████<arg_value> Dropdown surface |
| `surface-floating` | `#222840` | ██████████ Floating panel |
| `surface-sunken` | `#050810` | ██████████ Inset areas |

### Text Colors

| Token | Value | On surface-base Contrast |
|-------|-------|--------------------------|
| `text-primary` | `#ecedf5` | 17.4:1 |
| `text-secondary` | `#a3aac6` | 7.8:1 |
| `text-tertiary` | `#747c9e` | 4.9:1 |
| `text-placeholder` | `#505876` | 3.2:1 |
| `text-disabled` | `#3a4160` | 2.1:1 (exempt) |
| `text-on-accent` | `#0a0e1a` | — (on aether) |
| `text-inverse` | `#0a0e1a` | — (on bright surfaces) |

### Accent Colors

| Token | Value | Usage |
|-------|-------|-------|
| `action-primary-bg` | `#4199d8` | Primary buttons, links |
| `action-primary-hover` | `#3380c4` | Button hover |
| `action-primary-pressed` | `#2563a0` | Button pressed |
| `action-primary-text` | `#0a0e1a` | Text on primary buttons |
| `action-accent-bg` | `#da44bc` | Premium/upsell buttons |
| `action-accent-text` | `#0a0e1a` | Text on accent buttons |

### Border Colors

| Token | Value | Usage |
|-------|-------|-------|
| `border-subtle` | `#2d3450` | Card edges, dividers |
| `border-default` | `#3a4160` | Input borders |
| `border-strong` | `#505876` | Emphasized borders |
| `border-accent` | `#4199d8` | Focused, selected |

---

## Theme Architecture

### CSS Custom Property Strategy

All theme values are expressed as CSS custom properties on `:root`. Components never reference color values — only custom properties.

```css
/* Design specification — Midnight theme */
:root {
  /* Surfaces */
  --nexus-surface-base: #0a0e1a;
  --nexus-surface-raised: #111627;
  --nexus-surface-overlay: #171d30;
  --nexus-surface-elevated: #1c2338;
  --nexus-surface-floating: #222840;
  --nexus-sunken: #050810;

  /* Text */
  --nexus-text-primary: #ecedf5;
  --nexus-text-secondary: #a3aac6;
  --nexus-text-tertiary: #747c9e;
  --nexus-text-placeholder: #505876;
  --nexus-text-disabled: #3a4160;
  --nexus-text-on-accent: #0a0e1a;
  --nexus-text-inverse: #0a0e1a;

  /* ... all other tokens ... */
}
```

### Theme Switching Mechanism

Theme switching (when implemented) uses a `data-theme` attribute on `<html>`:

```css
:root, [data-theme="midnight"] {
  --nexus-surface-base: #0a0e1a;
  /* ... Midnight values ... */
}

[data-theme="dawn"] {
  --nexus-surface-base: #f8f9fc;
  /* ... Dawn (light) values — future ... */
}
```

**Decision: `data-theme` attribute, not CSS class.** `data-*` attributes are semantically appropriate for state/configuration. They don't conflict with utility classes and are queryable via `querySelector('[data-theme="midnight"]')`.

**Decision: Theme preference stored in cookie, not localStorage.** The theme must be known at render time to avoid flash-of-wrong-theme (FOWT). Cookies are sent with the HTTP request; localStorage requires client-side JS. Server Components can read the cookie and set `data-theme` before the first paint.

---

## Theme Persistence

| Storage | Purpose | Reason |
|---------|---------|--------|
| Cookie (`nexus-theme`) | Server-rendered theme class | Available on first request |
| `prefers-color-scheme` | System preference fallback | If no cookie, follow OS preference |
| localStorage | JS-accessible backup | For theme switcher UI that runs client-side |

### Preference Resolution Order

```
Cookie value → localStorage value → prefers-color-scheme → "midnight" (default)
```

Cookie takes precedence (set by server). If no cookie, check localStorage (client-side). If neither, follow OS preference. If OS offers no preference, default to Midnight.

---

## Midnight Theme: Glass Specifications

The Midnight theme's glass variants (see [Glassmorphism.md](Glassmorphism.md)):

| Variant | Background | Border | Blur |
|---------|-----------|-------|------|
| Standard | `#111627 / 0.70` | `#505876 / 0.15` | 8px |
| Frosted | `#171d30 / 0.85` | `#3a4160 / 0.20` | 16px |
| Crystal | `#111627 / 0.50` | `#505876 / 0.10` | 4px |
| Tinted | `#2563a0 / 0.15` | `#5bb2ea / 0.20` | 8px |
| Nova | `#6b1a5e / 0.15` | `#ec66d4 / 0.25` | 8px |

---

## Midnight Theme: Shadow Specifications

| Elevation | Shadow CSS Value |
|-----------|-----------------|
| 0 | `none` |
| 1 | `0 1px 2px 0 rgba(5,8,16,0.30), 0 1px 3px 0 rgba(5,8,16,0.15)` |
| 2 | `0 2px 4px 0 rgba(5,8,16,0.35), 0 4px 8px 0 rgba(5,8,16,0.20)` |
| 3 | `0 4px 6px 0 rgba(5,8,16,0.40), 0 8px 16px 0 rgba(5,8,16,0.25), 0 2px 4px 0 rgba(5,8,16,0.15)` |
| 4 | `0 8px 12px 0 rgba(5,8,16,0.45), 0 16px 32px 0 rgba(5,8,16,0.30), 0 4px 8px 0 rgba(5,8,16,0.20)` |

---

## Midnight Theme: Gradient Specifications

| Name | CSS Value |
|------|-----------|
| `gradient-surface` | `linear-gradient(180deg, #111627, #0a0e1a)` |
| `gradient-hero` | `radial-gradient(ellipse at 50% 0%, rgba(91,178,234,0.15), transparent 70%)` |
| `gradient-overlay` | `linear-gradient(180deg, transparent 50%, #0a0e1a)` |
| `gradient-accent` | `linear-gradient(135deg, #4199d8, #da44bc)` |
| `gradient-shine` | `linear-gradient(135deg, transparent 40%, rgba(237,237,245,0.05) 50%, transparent 60%)` |

---

## Future Theme: Dawn (Light)

**Not designed. Not implemented. Architecturally feasible only.**

The Dawn theme would invert the Midnight palette:

| Midnight Token | Dawn Concept |
|----------------|--------------|
| `surface-base` (#0a0e1a) | → Light gray-blue (#f8f9fc) |
| `surface-raised` (#111627) | → White (#ffffff) |
| `text-primary` (#ecedf5) | → Near-black (#1a1e2e) |
| `text-secondary` (#a3aac6) | → Mid-gray (#5a6178) |
| `action-primary-bg` (#4199d8) | → Same (accent color doesn't invert) |
| Glass backgrounds | → Higher opacity (0.90+) with light tints |

**Key challenge:** Glassmorphism in a light theme requires different opacity/color tuning. The blur effect over a light background produces a different visual than over a dark background. Dawn glass would need dedicated variant tuning.

**Key challenge:** Glow effects are far less visible on light surfaces. Dawn would likely use shadows as the primary depth indicator and reduce/eliminate glow effects.

---

## High-Contrast Mode

For users who need maximum contrast (e.g., `prefers-contrast: more`):

| Adjustment | Applied |
|------------|---------|
| Surface base | Darker → `#020408` |
| Text primary | Brighter → `#ffffff` |
| Text secondary | Brighter → `#c0c6dc` |
| Border subtle | Brighter → `#505876` |
| Focus ring | Wider → 3px, higher contrast → `#82c7f5` |
| Glass backgrounds | More opaque → 0.95+ |

**Decision: Honor `prefers-contrast: more`.** Windows users with high-contrast mode enabled get these adjustments automatically. No opt-in required.

---

## Forced Colors Mode

For users with OS-level forced colors (Windows High Contrast themes):

```css
@media (forced-colors: active) {
  /* Respect the user's forced color choices */
  .button-primary {
    border: 1px solid ButtonText;
    color: ButtonText;
    background: ButtonFace;
  }
  /* Focus ring uses system highlight */
  :focus-visible {
    outline: 2px solid Highlight;
  }
}
```

**Decision: Don't fight forced-colors.** When the OS says "use these colors," respect it. Our design system is a suggestion; the user's accessibility need is a requirement.

---

## Theme Rules

1. **Components never contain color values.** All colors reference `var(--nexus-*)`.
2. **Theme tokens are set on `:root`, not on components.** Components inherit; they don't define.
3. **The default theme is Midnight.** No theme attribute required for default behavior.
4. **Theme switching must be flicker-free.** Server-rendered `data-theme` from cookie; no client-side flash.
5. **All future themes must pass the same WCAG 2.2 AA criteria** as Midnight. No theme ships with sub-standard contrast.
6. **Glass and glow tuning is per-theme.** These effects depend on background color and cannot be uniformly applied.
7. **One theme per page.** Theme switching changes the entire page, not individual components.
8. **The theme system is not a "dark mode toggle."** It's a named theme system. "Midnight" happens to be dark. Future themes may not correspond to dark/light at all.
