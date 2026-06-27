# Accessibility

> The accessibility system for Nexus Anime — standards, patterns, and implementation requirements.

---

## Design Decision

The platform targets **WCAG 2.2 Level AA** compliance. This is non-negotiable — not a "target," not "best effort," but a requirement for every shipped feature.

**Why WCAG 2.2 AA, not AAA?** AA covers 95% of accessibility needs. AAA requirements (7:1 contrast, sign language, etc.) are extremely restrictive for a dark-theme, media-rich platform — they would force design compromises that degrade the experience for all users. AA provides solid accessibility without compromising the visual identity.

**Why WCAG 2.2, not 2.1?** WCAG 2.2 adds 9 new success criteria relevant to our UI patterns: focus appearance (2.4.11, 2.4.12), dragging movements (2.5.7), target size (2.5.8), and consistent help (3.2.6). These directly improve our users' experience.

---

## Applicable Success Criteria

### Perceivable

| Criterion                     | Level | Our Application                                                                 |
| ----------------------------- | ----- | ------------------------------------------------------------------------------- |
| 1.1.1 Non-text Content        | A     | All images have `alt`; decorative images use `alt=""` + `aria-hidden`           |
| 1.3.1 Info and Relationships  | A     | Semantic HTML: headings, lists, landmarks, labels                               |
| 1.3.2 Meaningful Sequence     | A     | DOM order matches visual order                                                  |
| 1.4.1 Use of Color            | A     | Color never sole indicator of state; icons/text accompany                       |
| 1.4.3 Contrast (Minimum)      | AA    | Text: 4.5:1; Large text: 3:1; UI components: 3:1                                |
| 1.4.4 Resize Text             | AA    | Text resizes to 200% without loss of function                                   |
| 1.4.11 Non-text Contrast      | AA    | UI components & graphical objects: 3:1 against background                       |
| 1.4.12 Text Spacing           | AA    | No loss of content at 1.5× line-height, 1.5× letter-spacing, 0.12× word-spacing |
| 1.4.13 Content on Hover/Focus | AA    | Hoverable content is dismissable, hoverable, persistent                         |

### Operable

| Criterion                   | Level          | Our Application                                                 |
| --------------------------- | -------------- | --------------------------------------------------------------- |
| 2.1.1 Keyboard              | A              | All functionality operable by keyboard                          |
| 2.1.2 No Keyboard Trap      | A              | Focus never trapped unless modals with documented escape        |
| 2.2.1 Timing Adjustable     | A              | No time limits on user actions (auto-play除外 — user initiated) |
| 2.4.1 Bypass Blocks         | A              | Skip-to-content link on every page                              |
| 2.4.2 Page Titled           | A              | Unique, descriptive `<title>` on every route                    |
| 2.4.3 Focus Order           | A              | Focus follows logical reading order                             |
| 2.4.6 Headings and Labels   | AA             | Headings describe topic; labels describe purpose                |
| 2.4.7 Focus Visible         | AAA (we apply) | Focus indicator always visible on keyboard nav                  |
| 2.4.11 Focus Appearance     | AAA (2.2)      | Focus indicator ≥ 2px, contrast ≥ 3:1 against adjacent          |
| 2.4.12 Focus Not Obscured   | AAA (2.2)      | Focused element not hidden by sticky headers (min 50% visible)  |
| 2.5.1 Pointer Gestures      | A              | No path-based gestures without single-pointer alternative       |
| 2.5.2 Pointer Cancellation  | A              | Actions on `up` event, not `down` (or cancellable)              |
| 2.5.3 Label in Name         | A              | Accessible name contains visible label text                     |
| 2.5.7 Dragging Movements    | AA (2.2)       | Drag-sort has single-pointer alternative (up/down buttons)      |
| 2.5.8 Target Size (Minimum) | AA (2.2)       | Inline targets ≥ 24×24px; other targets ≥ 44×44px               |

### Understandable

| Criterion                  | Level   | Our Application                                         |
| -------------------------- | ------- | ------------------------------------------------------- |
| 3.1.1 Language of Page     | A       | `<html lang="en">` + `lang` on Japanese content         |
| 3.2.1 On Focus             | A       | Focus never triggers context change                     |
| 3.2.2 On Input             | A       | Input never triggers unexpected context change          |
| 3.2.6 Consistent Help      | A (2.2) | Help mechanism (if any) in consistent location          |
| 3.3.1 Error Identification | A       | Errors described in text, not just color                |
| 3.3.2 Labels               | A       | All inputs have visible labels                          |
| 3.3.3 Error Suggestion     | AA      | When detectable, suggest corrections                    |
| 3.3.4 Error Prevention     | AA      | Submissions that modify data are reversible/confirmable |

### Robust

| Criterion               | Level | Our Application                                         |
| ----------------------- | ----- | ------------------------------------------------------- |
| 4.1.2 Name, Role, Value | A     | All UI components have accessible name, role, and value |
| 4.1.3 Status Messages   | AA    | Status messages announced without moving focus          |

---

## Focus Management

### Focus Ring Specification

| Property      | Value                   | Rationale                                      |
| ------------- | ----------------------- | ---------------------------------------------- |
| Width         | 2px                     | Visible without being thick                    |
| Color         | `aether-4` (#4199d8)    | High contrast against all surfaces             |
| Style         | solid                   | Dotted/dashed rings are harder to see at speed |
| Offset        | 2px from element edge   | Prevents overlap with element border           |
| Border-radius | Inherits from element   | Square ring on round button looks wrong        |
| Transition    | `duration-100 ease-out` | Fast but not instant — indicates direction     |

**Decision: `aether-4` for focus ring.** Tested against all surface colors:

- On `void-1` (base): contrast 6.2:1 ✓
- On `void-2` (raised): contrast 5.1:1 ✓
- On `void-3` (overlay): contrast 4.3:1 ✓
- On `aether-4` (primary button): Use `void-12` (light) ring instead, contrast 6.8:1 ✓

### Focus-Visible, Not Focus

Focus rings show on **keyboard navigation only** (`:focus-visible`), not on click/tap (`:focus`). Clicking a button shouldn't leave a persistent ring.

```css
/* Design specification */
:focus {
  outline: none; /* Reset - never show on click focus */
}

:focus-visible {
  outline: 2px solid var(--aether-4);
  outline-offset: 2px;
  border-radius: inherit;
}
```

**Exception:** Form inputs always show focus ring on `:focus` (not just `:focus-visible`) — users expect to see which input they're typing in regardless of input method.

### Focus Trapping

| Component    | Trapped?         | Escape                                        |
| ------------ | ---------------- | --------------------------------------------- |
| Modal/Dialog | Yes              | `Escape` key, close button, overlay click     |
| Drawer       | Yes              | `Escape` key, close button                    |
| Dropdown     | Yes (while open) | `Escape`, selecting an item, clicking outside |
| Toast        | No               | Toasts are non-modal — focus stays on trigger |
| Tooltip      | No               | Tooltips are non-modal — focus passes through |

---

## Keyboard Navigation

### Global Shortcuts

| Key                 | Action                  | Context                    |
| ------------------- | ----------------------- | -------------------------- |
| `Tab` / `Shift+Tab` | Move focus              | Global                     |
| `Escape`            | Close overlay/dismiss   | Modal, drawer, dropdown    |
| `/`                 | Focus search            | Global (when not in input) |
| `?`                 | Show keyboard shortcuts | Global (when not in input) |

### Component Shortcuts

| Component | Key               | Action              |
| --------- | ----------------- | ------------------- |
| Dialog    | `Escape`          | Close               |
| Dropdown  | `↑` / `↓`         | Navigate options    |
| Dropdown  | `Enter` / `Space` | Select option       |
| Dropdown  | `Escape`          | Close               |
| Tabs      | `←` / `→`         | Switch tab          |
| Tab list  | `Home` / `End`    | First/last tab      |
| Accordion | `Enter` / `Space` | Toggle section      |
| Listbox   | `↑` / `↓`         | Navigate items      |
| Listbox   | `Enter`           | Select item         |
| Slider    | `←` / `→`         | Change value (step) |
| Slider    | `Home` / `End`    | Min/max value       |

---

## Screen Reader Patterns

### Landmark Structure

```
<body>
  <a href="#main" class="skip-link">Skip to content</a>
  <header>         <!-- role="banner" — navigation -->
  <main>           <!-- role="main" — page content -->
  <nav>            <!-- role="navigation" — secondary nav -->
  <footer>         <!-- role="contentinfo" — site info -->
</body>
```

### Skip Link

- First focusable element on every page.
- Visually hidden by default; visible on focus.
- Links to `<main id="main">`.
- Style: positioned absolute top, `aether-4` background, `void-1` text.

### Anime Card Accessible Name

```html
<article aria-label="Attack on Titan, score 8.5, currently airing">
  <!-- content -->
</article>
```

The card's accessible name includes: title, score, and status. This lets screen reader users identify the anime without navigating into the card.

### Live Regions

| Purpose              | ARIA                    | Usage                                           |
| -------------------- | ----------------------- | ----------------------------------------------- |
| Watchlist add/remove | `aria-live="polite"`    | "Added to watchlist" / "Removed from watchlist" |
| Search results count | `aria-live="polite"`    | "12 results found"                              |
| Loading state        | `aria-live="polite"`    | "Loading results..."                            |
| Form validation      | `aria-live="assertive"` | "Error: Email is required"                      |
| Toast notification   | `aria-live="polite"`    | Toast content                                   |

---

## Color Accessibility

### Not Color-Alone

| Information Conveyed | Also Conveyed By                    | Example                                            |
| -------------------- | ----------------------------------- | -------------------------------------------------- |
| Error state          | Icon (alert-circle) + text + border | Input error: red border + × icon + "Invalid email" |
| Success state        | Icon (check-circle) + text          | Form success: green + ✓ + "Saved"                  |
| Active/selected      | Border + glow + label               | Active nav: aether border + "Current page"         |
| Score quality        | Numeric value + label               | Score badge: "8.5" not just green                  |
| Content rating       | Text label + icon                   | "TV-MA" not just red                               |
| Live streaming       | Pulsing dot + "LIVE" text           | Red dot + "LIVE" badge                             |
| Online status        | Dot + text                          | Green dot + "Online"                               |

---

## Motion Accessibility

| Preference                              | Behavior                                                                         |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| `prefers-reduced-motion: reduce`        | All animations instant; no parallax; no auto-play; skeleton screens not spinners |
| `prefers-reduced-motion: no-preference` | Full animation system as designed                                                |

Implementation: set all `animation-duration` and `transition-duration` to `0.01ms` via the media query. See [Motion.md](Motion.md).

---

## Touch Accessibility

| Requirement             | Value                                 | Source           |
| ----------------------- | ------------------------------------- | ---------------- |
| Minimum touch target    | 24×24px (inline), 44×44px (other)     | WCAG 2.5.8 (2.2) |
| Spacing between targets | 8px minimum                           | Apple HIG        |
| No hover-dependent UI   | All hover info available on tap/focus | Mobile context   |

---

## Image Accessibility

| Image Type              | Alt Text Strategy                                        |
| ----------------------- | -------------------------------------------------------- |
| Anime poster            | `"Poster art for {title}"` — describes the image purpose |
| Anime backdrop          | `"Key visual for {title}"`                               |
| Avatar                  | `"" (decorative)` — name is in adjacent text             |
| Decorative UI           | `"" + aria-hidden="true"`                                |
| Illustration            | `"" + aria-hidden="true"` — decorative                   |
| Content image (reviews) | User-provided alt, fallback to `"User uploaded image"`   |

**Decision: Posters describe purpose, not content.** `"Poster art for Attack on Titan"` is more useful than `"A man standing on a wall with a giant behind him"` — the user knows they're looking at anime; they need to identify which anime.

---

## Japanese Content Accessibility

Anime titles often have both English and Japanese (romaji/kanji) versions.

```html
<h2>
  <span lang="en">Attack on Titan</span>
  <span lang="ja" class="text-secondary text-sm">進撃の巨人</span>
</h2>
```

- Both spans have appropriate `lang` attributes for screen reader pronunciation.
- The primary title (user's language preference) comes first.
- Secondary title is marked as `text-secondary` — available but not dominant.

---

## Accessibility Rules

1. **Test with a screen reader** (VoiceOver on macOS, NVDA on Windows) for every new component.
2. **Every interactive element** has an accessible name. No `button` without text or `aria-label`.
3. **No `alt` attribute missing** on `<img>`. If decorative, use `alt=""`.
4. **No `aria-*` overrides** unless native semantics are insufficient. Use native HTML first.
5. **No `role="presentation"` or `aria-hidden="true"` on focusable elements.** If it can receive focus, it's not decorative.
6. **Heading levels increase by 1.** No skipping `h1 → h3`. Use only one `h1` per page.
7. **Form inputs have visible labels.** Placeholder text is NOT a label — it disappears when typing.
8. **Error messages are associated with inputs** via `aria-describedby`.
9. **Modals manage focus.** Focus moves to modal on open, returns to trigger on close.
10. **Automated testing** with axe-core in CI for every PR. Zero critical/serious violations.
