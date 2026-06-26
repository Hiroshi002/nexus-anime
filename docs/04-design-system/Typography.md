# Typography

> The type system for Nexus Anime — scale, pairing, rendering, and implementation tokens.

---

## Design Decision

The typography pairs **Inter** (body) with **Space Grotesk** (display). Inter provides neutral readability for dense metadata (episode lists, synopses, settings). Space Grotesk provides a subtly geometric, technological character for headings and UI chrome — it feels engineered without being decorative.

**Why this pairing?**
- **Inter** is the most legible sans-serif at small sizes on screen. Its tall x-height, open apertures, and tabular number figures make it ideal for score displays and tabular data.
- **Space Grotesk** has just enough personality — slightly wider characters, subtle geometric construction — to feel like a "sci-fi interface" without crossing into novelty. It's readable at display sizes and distinct enough from Inter that headings clearly differ from body.
- Both are open-source (SIL OFL 1.1), support Latin Extended + Vietnamese, and have variable font files with weight axes.

**Rejected alternatives:**
- **JetBrains Mono + Inter:** Too nerdy. A monospace display font screams "terminal," not "cinematic."
- **Outfit + DM Sans:** Too rounded/friendly. Reads as consumer app, not premium launcher.
- **Clash Display + Satoshi:** Good pairing, but Clash Display is too extreme in its geometric shapes — reduces readability on long headings.
- **Geist:** Vercel's proprietary font. Excellent but licensing is restrictive for our use case.

---

## Font Stack

| Role | Font | Fallback Stack | Variable Axes |
|------|------|----------------|---------------|
| Display | Space Grotesk | `"Space Grotesk", system-ui, -apple-system, sans-serif` | `wght` (300–700) |
| Body | Inter | `"Inter", system-ui, -apple-system, sans-serif` | `wght` (100–900), `ital` |

**Decision: `system-ui` as fallback, not specific fonts.** Specific fallback fonts (Helvetica, Arial) create jarring shifts on different OSes. `system-ui` adapts to the user's platform, providing the least-jarring fallback experience.

---

## Type Scale

The scale uses a **1.25 ratio (Major Third)** with a base of 14px. This produces a compact scale suited to information-dense UIs without feeling cramped.

**Why 14px base, not 16px?** A streaming catalog packs many cards per viewport. 14px body text maintains readability while fitting ~15% more content density. The scale compensates with generous line-heights (1.5 for body) to preserve vertical rhythm and readability.

| Step | Token | Size (px) | rem | Line Height | Weight | Font | Usage |
|------|-------|-----------|-----|-------------|--------|------|-------|
| -2 | `text-xs` | 11 | 0.6875 | 1.45 | 500 | Body | Overlines, badge text, timestamps |
| -1 | `text-sm` | 12 | 0.75 | 1.5 | 400 | Body | Captions, helper text, secondary metadata |
| 0 | `text-base` | 14 | 0.875 | 1.5 | 400 | Body | Body text, descriptions, input content |
| 1 | `text-md` | 16 | 1.0 | 1.5 | 500 | Body | Prominent body, card titles |
| 2 | `text-lg` | 18 | 1.125 | 1.4 | 600 | Body | Section titles, list headers |
| 3 | `text-xl` | 22 | 1.375 | 1.35 | 600 | Display | Component headings, dialog titles |
| 4 | `text-2xl` | 28 | 1.75 | 1.3 | 700 | Display | Page headings, card feature titles |
| 5 | `text-3xl` | 35 | 2.1875 | 1.25 | 700 | Display | Hero subheadings, section heroes |
| 6 | `text-4xl` | 44 | 2.75 | 1.2 | 700 | Display | Page titles, hero headings |
| 7 | `text-5xl` | 55 | 3.4375 | 1.15 | 700 | Display | Display headings, large hero |
| 8 | `text-6xl` | 69 | 4.3125 | 1.1 | 700 | Display | Maximum display — splash screens |

**Decision: 1.25 ratio.** 1.333 (Perfect Fourth) creates too large a gap between steps at small sizes — `text-sm` (12px) → `text-base` (16px) leaves a 33% jump that's hard to fill. 1.25 produces smoother steps: 11 → 12 → 14 → 16 → 18 → 22 → 28 → 35 → 44.

**Decision: Tighter line-heights at larger sizes.** Display text at 1.5 line-height wastes vertical space. The scale reduces line-height as size increases: 1.5 (body) → 1.1 (max display). This is standard typographic practice — larger type needs less relative leading.

---

## Font Weights

| Token | Value | Usage |
|-------|-------|-------|
| `weight-light` | 300 | Display only — rare, decorative headlines |
| `weight-regular` | 400 | Body text default |
| `weight-medium` | 500 | Small labels, captions that need emphasis |
| `weight-semibold` | 600 | Subheadings, card titles, navigation items |
| `weight-bold` | 700 | Headings, display text, strong emphasis |

**Decision: 5 weights only.** More weights increase font file size without proportional UX benefit. 300/400/500/600/700 covers all cases. Inter's variable font means we're not loading 5 separate files — the weight axis is continuous.

---

## Letter Spacing

Letter spacing adjusts at display sizes to maintain optical evenness. Space Grotesk benefits from slight positive tracking at large sizes.

| Token | Value | Applies To |
|-------|-------|-----------|
| `tracking-tight` | `-0.02em` | `text-4xl` and above — tight display spacing |
| `tracking-normal` | `0` | `text-base` through `text-2xl` — default |
| `tracking-wide` | `0.02em` | `text-xs`, `text-sm` — small text readability |
| `tracking-wider` | `0.06em` | Overlines, all-caps labels — optical correction |
| `tracking-widest` | `0.12em` | Buttons, nav items — all-caps tracking |

**Decision: Positive tracking on small text.** At 11–12px, character spacing is optically tight. +0.02em opens it up without looking "spaced out." All-caps text requires more tracking because uppercase glyphs have less inter-character white space.

---

## Number Formatting

Anime UIs display many numbers: scores, episode counts, rankings, ratings.

| Context | Style | Example | Rationale |
|---------|-------|---------|-----------|
| Score (0–10) | Tabular, 1 decimal | `"8.5"` | `.5` precision matters for scoring |
| Episode count | Tabular, integer | `"24"` | Episodes are always whole |
| Ranking | Tabular, ordinal | `"#1"`, `"#24"` | Hash prefix for clarity |
| Duration | Tabular, colon-separated | `"24:00"` | MM:SS for episodes, HH:MM for movies |
| Percentage | Proportional, 0 decimals | `"85%"` | For progress bars, completion |
| User count | Compact abbreviation | `"1.2K"`, `"3.4M"` | Avoid digit-width jumps |

**Decision: Tabular number figures for all numeric display.** Inter supports `font-variant-numeric: tabular-nums`. This prevents score displays from jumping when `"8.5"` changes to `"10"` — all digits share the same advance width.

---

## Text Truncation

| Method | Lines | Usage | CSS |
|--------|-------|-------|-----|
| Single-line | 1 | Card titles, nav items, list items | `truncate` (text-overflow: ellipsis) |
| Clamp-2 | 2 | Card descriptions, search results | `-webkit-line-clamp: 2` |
| Clamp-3 | 3 | Anime synopsis, episode descriptions | `-webkit-line-clamp: 3` |
| Expandable | 3+ | Full synopses, reviews | Clamp-3 + "Show more" toggle |

**Decision: 3-line clamp for synopses.** Anime synopses average 40–80 words. 3 lines at 14px shows ~30 words — enough to determine interest, short enough to scan. The "Show more" toggle uses an animated max-height transition rather than reflow.

---

## Responsive Type Scaling

Type scales up at wider viewports to maintain proportional impact. The base step mapping doesn't change — only the computed pixel values increase.

| Breakpoint | Scale Factor | Example: `text-4xl` |
|------------|-------------|---------------------|
| mobile (< 768px) | 1.0× | 44px |
| tablet (768–1023px) | 1.05× | 46px |
| desktop (1024–1439px) | 1.1× | 48px |
| large (≥ 1440px) | 1.15× | 51px |

**Decision: Scale factor, not separate scales.** Maintaining one scale definition and multiplying by a viewport factor is simpler than defining separate mobile/desktop type scales. The factor is subtle (max 15% increase) because the dark theme already creates visual weight — large type at max factor would overwhelm.

---

## Anti-Aliasing

```css
html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

**Decision: Anti-aliased, not subpixel.** Subpixel antialiasing (`auto`) produces thicker, more colorful fringes on dark backgrounds. Grayscale antialiasing produces crisper, thinner glyphs that read better on dark surfaces — standard practice for dark UIs.

---

## Font Loading Strategy

1. **Variable font files** — load single WOFF2 per font with weight/italic axes.
2. **`font-display: swap`** — show fallback immediately, swap when loaded.
3. **Preload critical subset** — `<link rel="preload">` for Space Grotesk (display) since FOIT on headings is most visible.
4. **Size-adjust on fallback** — use `@font-face` `size-adjust` to reduce CLS when Inter swaps in for system-ui.
5. **Subset to Latin Extended** — no CJK glyphs in our fonts (user content uses system CJK fonts via `font-family: inherit`).

---

## Usage Rules

1. **Never use `!important` on font properties.** Token classes handle specificity.
2. **Display font never appears below 18px.** Space Grotesk's character is lost at small sizes and becomes hard to read.
3. **Body font never appears above 28px.** At large sizes, Inter looks generic — that's where Space Grotesk belongs.
4. **Maximum 2 fonts per component.** Mixing both in one component creates visual noise.
5. **Tabular nums on any element containing dynamic numbers.** Prevents layout shift.
6. **No `letter-spacing` on body text below 18px** except `text-xs`/`text-sm`. Body tracking at 0 is optimal for Inter.
