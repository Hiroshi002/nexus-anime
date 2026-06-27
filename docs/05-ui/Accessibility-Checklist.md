# Accessibility Checklist — Nexus Anime

> **Audience:** Frontend engineers, QA testers, auditors — anyone implementing or verifying UI accessibility.

---

## 1. Purpose

A page-by-page accessibility checklist that supplements the global rules in `docs/04-design-system/Accessibility.md` with per-page requirements, testing procedure, and the public a11y statement.

## 2. User Goals

- Confirm every page in the app meets WCAG 2.2 Level AA before a PR merges.
- Give engineers a single reference for per-page a11y requirements without re-deriving them from the design system.
- Define the testing protocol (automated + manual + user) that QA follows each milestone.
- Provide a public-facing a11y commitment that can be linked from the footer and the status page.

## 3. Entry Points

- Linked from every page spec in `docs/05-ui/` under the "Accessibility" section.
- Referenced in PR templates and the Definition of Done checklist (`docs/REPOSITORY-DESIGN.md`).
- Linked from the a11y statement page in the marketing footer and `/status`.

## 4. Layout Structure

```
┌────────────────────────────────────────────────────�
│  Skip link (#main) — hidden until focused          │
├────────────────────────────────────────────────────┤
│  <html lang="en">                                  │
│  ┌──────────────────────────────────────────────�  │
│  │  Header / Nav bar                            │  │
│  └──────────────────────────────────────────────�  │
│  ┌──────────────────────────────────────────────�  │
│  │  <main id="main">                            │  │
│  │   Page content per spec                      │  │
│  │                                              │  │
│  └──────────────────────────────────────────────�  │
│  ┌──────────────────────────────────────────────�  │
│  │  Footer                                      │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────�
```

## 5. Component Hierarchy

- `RootLayout` — `<html lang="en">`, skip-link, `<head>` metadata
  - `SkipLink` — first focusable element, links to `#main`
  - `HeaderBanner` — `role="banner"`, primary nav, search trigger
  - `MainContent` — `<main id="main">`, page-specific sections
  - `Footer` — `role="contentinfo"`

---

## 6. Desktop Layout (≥1024px)

Full keyboard-navigable two-column layouts where applicable (e.g. detail pages with sidebar). Skip link hidden but focus-visible. No layout changes that violate focus order.

## 7. Tablet Layout (768–1023px)

Collapsible sidecars become stacked sections. Touch targets remain ≥ 44×44px. No hover-only interactions exposed.

## 8. Mobile Layout (<768px)

Single-column stack; navigation collapses into a `Drawer` with focus trap. Carousels remain swipeable and have keyboard equivalents. Font size never below 14px to respect 200% zoom.

## 9. Navigation Behavior

- Skip-to-content link visible on every page, first focusable element.
- Global keyboard shortcuts (`/`, `?`, `Escape`) do not conflict with browser / assistive-tech shortcuts. When conflicts exist, app shortcuts yield.
- Drawer open: focus trapped; on close, focus returns to the trigger.
- Tab order follows DOM order; DOM order follows visual order.

## 10. Scroll Behavior

- Scroll position is not preserved in a way that disorients screen reader users on route change; focus moves to the top of `<main>` or the relevant section heading, not a buried element.
- Sticky headers never fully obscure a focused element (≥ 50% of the focused element remains visible).

## 11. Motion & Animation

- `prefers-reduced-motion: reduce` disables non-essential transitions, parallax, skeleton spinners, and auto-advance on carousels. Loading state falls back to text ("Loading...").
- Auto-playing media (hero video, carousel) respects the reduced-motion preference and falls back to a static poster or single slide.

## 12. Loading Experience

- Skeleton screens announce loading state via `aria-live="polite"`. No focus movement to skeleton regions.
- Images marked with explicit `width` and `height` — no layout shift.

## 13. Empty States

- Every empty state has a heading (`h2` or `h3`) describing why content is missing and a clear next action (button or link). No blank containers.

## 14. Error Handling

- Form errors are associated with inputs via `aria-describedby`. Errors are announced `aria-live="assertive"` on submit.
- Inline validation does not move focus unexpectedly.
- Fatal errors (failed fetch, 500) are presented as a region with `role="alert"` and a link to retry.

## 15. SEO Metadata Requirements

- `<title>` — unique per route, ≤ 60 chars, brand suffix ` — Nexus Anime`.
- `<meta name="description">` — unique per route, ≤ 160 chars.
- OG tags — title, description, image (1200×630), type, url.
- Canonical URL on every route.
- `<meta name="robots">` — `index, follow` on public content; `noindex` on auth-gated pages.
- JSON-LD — `TVSeries` / `Movie` schema on Anime Detail; `ItemList` on genre index and schedule.

## 16. Accessibility Requirements

### Global — Every Page

| #   | Requirement                                                                        | Token / Spec                                     |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | Skip-to-content link (`#main`)                                                     | `aether-4` bg, `void-1` text                     |
| 2   | `<html lang="en">`; `lang="ja"` on Japanese content spans                          |                                                  |
| 3   | Unique, descriptive `<title>`                                                      |                                                  |
| 4   | One `h1` per page; sequential `h2`+ without skipping levels                        |                                                  |
| 5   | Focus visible — 2px `action-primary-bg` (#4199d8) ring, 2px offset                 | `:focus-visible` except form inputs use `:focus` |
| 6   | Color contrast — 4.5:1 body text, 3:1 large text & UI components                   | `text-primary` (#ecedf5) against `void-1`        |
| 7   | Touch targets — ≥ 44×44px on non-inline controls; 8px gap                          |                                                  |
| 8   | `prefers-reduced-motion` respected — no essential animation                        |                                                  |
| 9   | Keyboard navigation — every interactive element reachable, no trap (except modals) |                                                  |
| 10  | All `<img>` have `alt`; decorative use `alt=""` + `aria-hidden="true"`             |                                                  |
| 11  | All form inputs have visible `<label>`                                             |                                                  |
| 12  | Errors announced via `aria-live`; associated via `aria-describedby`                |                                                  |

### Per-Page Checklist

#### Landing

- Hero background video: `muted`, `playsinline`, `autoplay`; visible pause button (`aria-label="Pause background video"`).
- Featured carousel: keyboard arrow keys (`←`/`→`); visible dots are `role="tabbist"` buttons with `aria-selected`; auto-advance pauses on focus and respects `prefers-reduced-motion`.
- Skip link and landmark roles present; focus order through hero then featured rail then CTA.

#### Home

- Hero carousel: pause button (`aria-label="Pause carousel"`); auto-advance disabled under reduced motion.
- Content rails: arrow buttons labeled `aria-label="Scroll {Trending} left/right"`; cards inside link have descriptive accessible names ("{Title}, score {score}, {status}").
- Cards: `aria-label` constructed from title + score + status; focus ring matches spec.

#### Trending / Popular / Latest

- Time-period / sort tabs: `role="tablist"` with `aria-selected`; arrow keys switch.
- Filter inputs: every checkbox or select has a label; filter state announced via live region (`"Filter updated: showing {count} results"`).
- Row heading labels visible and concise (≤ 80 chars).

#### Genre Index

- Genre grid cells are `<a>` links with accessible name (genre label), not bare images.
- Breadcrumb landmarks present (`<nav aria-label="Breadcrumb">`).
- Focus order: breadcrumb → heading → grid cells row by row.

#### Schedule

- Day tabs: `role="tablist"`, arrow keys navigate, `Home` / `End` supported.
- Time slots: announced with day + time context for screen-reader users (e.g. `aria-label="Wednesday 20:00 — Attack on Titan, Season 4"`).
- Empty day states described by heading + sentence.

#### Search

- Results list: `role="listbox"` or appropriate combobox pattern; result count announced `aria-live="polite"` ("{n} results for ‘{query’}").
- Suggestions: announced without moving focus away from the input; arrow nav, `Enter` select, `Escape` dismiss.
- Clear button labeled `aria-label="Clear search"`.

#### Anime Detail

- Hero video: full controls (play/pause, mute/unmute, progress, fullscreen) with ARIA labels; keyboard-operable.
- Episode list: semantic `<table>` with labeled columns, or `<ul>` with each item announced as "Episode {n}, {title}, {duration}."
- Synopsis "read more" toggle: `aria-expanded` reflects state.
- Related rail cards use standard `Anime Card` pattern.

#### Player

- Full keyboard shortcuts (play/pause, seek, volume, fullscreen, captions) — see `docs/04-design-system/Accessibility.md` § Keyboard Navigation.
- Focus trap while in fullscreen mode (`Escape` exits, does not focus-trap outside player).
- Every control has an ARIA label matching its visible function; icon-only buttons include accessible label (not title-only).
- Captions area: `aria-live="polite"` region for captions text.

#### Watchlist

- Drag-sort alternative: each item exposed "Move up" / "Move down" icon buttons (labeled) — dragging is optional.
- Remove action: confirmation dialog with `alertdialog` role before deletion.
- Drag-and-drop does **not** replace the up/down alternative; both paths are testable.

#### Profile

- Avatar upload: visible label ("Upload avatar") and file-input label; preview described via `aria-label`.
- Edit fields: each input has label + description; errors linked via `aria-describedby`.
- Save / cancel in edit dialog: focus returns to trigger on cancel.

#### Settings

- Toggles: use `role="switch"` with `aria-checked` and label provided by visible text; not icon-only.
- Form sections: grouped in `<fieldset>` with `<legend>` when fields are related (e.g. notification preferences).
- Destructive actions require confirmation checkbox or dialog.

#### Notifications

- Unread badge: announced via `aria-live="polite"` region ("{n} new notifications").
- List uses `<ul>` / `<li>` semantics; each item labeled with source + time + excerpt.
- Mark-all-read button labeled `aria-label="Mark all notifications as read"`.

#### Auth

- All fields: visible label (not placeholder-only). Email / password / name.
- Validation errors: `aria-describedby` on the; errors announced on submit.
- Password toggle: `aria-pressed` indicates state ("Show password" / "Hide password").
- OAuth provider buttons: accessible name contains provider name ("Continue with Google").

#### Error Pages (404 / 500)

- On load, focus moves to the `h1` of the error page so screen readers announce it immediately.
- Page uses valid landmark structure: header, main, footer.
- Primary CTA (go home) is the first focusable element inside `<main>`.

---

## 17. Future Enhancements

- **WCAG 2.2 AAA contrast mode** — optional user toggle to force 7:1 across surfaces, beyond default AA.
- **Dark/Light/High-contrast theme switcher** — expands accessibility beyond WCAG minimums.
- **Sign-language toggle for video content** — tracks a future signed-language overlay for key help articles.
- **User-defined reduced-motion granularity** — expose "disable parallax" vs "disable all animation" separately.

---

## Testing Checklist

### Automated

- **axe-core** integrated into CI on every PR; zero Critical or Serious violations threshold for merge.
- **Lighthouse** — accessibility score ≥ 95 on every public route.
- **Pa11y** or equivalent runs against preview deployments for /home, /search, /anime/[id], /player, /settings — baseline smoke tests.

### Manual

- **Keyboard-only navigation**: every interactive element reachable; no traps outside documented modals/drawers; focus ring visible at every step.
- **Screen reader**: test on VoiceOver (macOS, Safari) and NVDA (Windows, Firefox) on at least the Home, Search, Detail, and Player flows.
- **200% zoom**: full layout remains functional — no horizontal scroll on single-column layouts, no clipped focus rings, no truncated labels.
- **High-contrast mode** (Windows): focus rings and text remain legible.

### User Testing

- Engage at least **two testers with disabilities per milestone** who use assistive technology as part of their daily workflow. Incorporate findings into the next milestone's retrospective.

---

## A11y Statement

> Nexus Anime targets WCAG 2.2 Level AA. We welcome feedback from users of assistive technologies. Report accessibility issues at [accessibility@nexusanime.com](mailto:accessibility@nexusanime.com).
