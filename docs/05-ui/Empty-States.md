# Empty States — Nexus Anime

> **Audience:** Engineers building page-level and rail-level content surfaces. Defines the reusable empty-state design system used across the app when there is nothing to show.

---

## 1. Purpose

Standardize how Nexus Anime communicates empty data conditions — zero results, uninitialized personal collections, and data-load failures — through a single reusable component anatomy with consistent tokens, copy patterns, and layout rules.

## 2. User Goals

- Understand instantly why the screen is empty (no data vs. error vs. not yet populated).
- Take the next meaningful action without guessing (browse, retry, clear filters).
- Recover from dead-ends without navigating back or leaving the page.
- Trust that the app is working correctly even when there is nothing to display.

## 3. Entry Points

- Search results with zero matches
- Genre filter with no anime
- Schedule day with no releases
- User watchlist before adding any title
- Continue Watching before watching any episode
- Watch History before first watch
- Notifications inbox before first notification
- Any rail or section whose data fetch returned an empty array
- Any rail or section whose data fetch failed

## 4. Layout Structure

```
┌──────────────────────────────────────────┐
│  CONTENT AREA                            │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │                                    │  │
│  │        [ILLUSTRATION]              │  │
│  │            64–96px                 │  │
│  │                                    │  │
│  │        Title (H2, 20px)            │  │
│  │                                    │  │
│  │      Description (14px)            │  │
│  │      max-width 300px, centered     │  │
│  │                                    │  │
│  │     [Primary CTA Button]           │  │
│  │     [Secondary text link]          │  │
│  │                                    │  │
│  └────────────────────────────────────┘  │
│                                          │
└──────────────────────────────────────────┘
```

## 5. Component Hierarchy

- `EmptyState`
  - `EmptyStateIllustration` (decorative SVG, 64–96px)
  - `EmptyStateTitle` (H2, Space Grotesk 20px, `text-primary`)
  - `EmptyStateDescription` (Inter 14px, `text-secondary`, max-width 300px, centered)
  - `EmptyStateActions`
    - `Button` (primary variant, 1 required)
    - `Button` (text variant, optional "Learn more" or similar)
  - `EmptyStateSuggestions` (optional, chip row — used only on search/genre)
- `EmptyStateInline` (compact variant for rail-level failures)
  - `EmptyStateTitle` (Inter 16px, `text-primary`)
  - `EmptyStateDescription` (Inter 13px, `text-secondary`)
  - `Button` (primary, small size)

## 6. Desktop Layout (≥1024px)

- Container: centered vertically and horizontally within the content area; max-width 400px; padding 48px.
- Background: `surface-raised` (#111627) panel with `backdrop-blur-md` glass effect; 1px border `text-secondary/10`; border-radius 16px.
- Illustration: 96px wide, top-aligned, `margin-bottom: 32px`.
- Title: `margin-bottom: 12px`, centered.
- Description: `margin-bottom: 24px`, centered, `line-height: 1.5`.
- Actions: flex row, gap 12px, centered; primary button first, secondary text link after.
- Suggestion chips: 3 chips, `secondary` variant, below actions with `margin-top: 16px`; horizontally scrollable if they overflow.

## 7. Tablet Layout (768–1023px)

- Container: max-width 360px; padding 40px.
- Illustration: 80px wide.
- Title: Space Grotesk 20px (unchanged).
- Description: Inter 14px (unchanged).
- Actions: stack vertically if label exceeds 120px; otherwise row layout.
- Suggestion chips: same as desktop, may wrap to second line.

## 8. Mobile Layout (<768px)

- Container: max-width 300px; padding 32px; width `calc(100% - 32px)` so it breathes on 380px viewports.
- Illustration: 64px wide.
- Title: Space Grotesk 18px (scale down one step).
- Description: Inter 14px unchanged (do not go below 14px).
- Actions: stack vertically, full-width primary button, full-width text link below.
- Suggestion chips: wrap freely; do not horizontally scroll.

## 9. Navigation Behavior

- Primary CTA is a real `<button>` (or `<a>` when navigation); activates the most useful next step.
- Secondary text link is an `<a>` when it navigates, or `<button>` when it triggers an action (e.g., "Clear filters").
- Focus order: illustration (decorative, skipped) → title → description → primary CTA → secondary link → suggestion chips.
- Keyboard: Tab cycles through interactive elements only; Escape has no effect (empty state is not a modal).

## 10. Scroll Behavior

- Empty state does not scroll internally; the parent page scrolls normally.
- Suggestion chip rows on tablet may scroll horizontally via `overflow-x: auto` with hidden scrollbar.
- On mobile, chip rows wrap; no scroll.

## 11. Motion & Animation

- Container: fade-in 200ms ease-out; no vertical offset (no fade-up — content is already centered).
- Illustration: optional subtle float animation (translate-y ±4px, 3s ease-in-out, infinite) when the illustration is the only visual anchor; disabled under `prefers-reduced-motion`.
- Primary CTA: standard button hover/active transitions (background-color 150ms, scale 0.98 on active).
- Suggestion chips: stagger fade-in 100ms per chip after container enters.
- Inline variant: no animation; appears instantly.

## 12. Loading Experience

- Empty state is never skeleton-loaded; it renders only after data resolves to an empty array or an error.
- Parent Suspense boundary shows skeleton while waiting; empty state replaces skeleton on resolution.
- If the data condition is transient (e.g., cache miss), show skeleton first — do not flash an empty state.

## 13. Empty States

### Catalog Empty States

**Search No Results**

- Title: `No results for "{query}".`
- Description: `Try one of these instead:`
- Primary CTA: none (suggestion chips are the action).
- Suggestion chips: 3 related queries sourced from trending or fuzzy match.
- If filters are also active, append: `Clearing filters may show more results.` with a ghost-button CTA "Clear filters".

**Genre No Results**

- Title: `No anime in this genre yet.`
- Description: `Check back later or explore a different genre.`
- Primary CTA: `Browse genres` (navigates to /genres).

**Schedule Empty**

- Title: `No releases this day.`
- Description: `Nothing is scheduled for this date. Try another day.`
- Primary CTA: `Pick another date` (opens date picker or navigates to nearest day with releases).

### Personal Empty States

**Watchlist Empty**

- Title: `Your watchlist is empty.`
- Description: `Save anime you want to watch later. Tap the bookmark icon on any title to add it here.`
- Primary CTA: `Browse trending` (navigates to /trending).

**Continue Watching Empty**

- Title: `Nothing to resume.`
- Description: `Start watching anime and it will appear here for quick pickup.`
- Primary CTA: `Browse trending` (navigates to /trending).

**Watch History Empty**

- Title: `You haven't watched anything yet.`
- Description: `Your watch history will show up here once you start streaming.`
- Primary CTA: `Browse trending` (navigates to /trending).

**Notifications Empty**

- Title: `You're all caught up!`
- Description: `New notifications will appear here. Check back after new episodes or features drop.`
- Primary CTA: `Browse what's new` (navigates to /latest).

### Error Empty States (Data Failed to Load)

**Page-Level Error**

- Title: `Couldn't load this section.`
- Description: `Something went wrong fetching your data. Check your connection and try again.`
- Primary CTA: `Try again` (re-fetches the data).

**Rail-Level Inline Error**

- Uses `EmptyStateInline` variant.
- Title: `Couldn't load.`
- Description: (none — keep it compact).
- Primary CTA: `Retry` (small button, re-fetches the rail data only).

## 14. Error Handling

- Empty state is itself a recovery surface; do not log its render as an error.
- "Try again" button triggers the same fetch the page uses; on success, the empty state unmounts and real content renders.
- If retry fails again, the empty state remains; do not auto-retry more than once per click.
- Inline rail errors do not block the rest of the page; other rails render normally.

## 15. SEO Metadata Requirements

Not applicable. Empty states are components rendered inside pages, not standalone routes. They do not emit `<title>`, meta description, OG tags, canonical, or robots directives. The parent page's SEO metadata remains in effect.

## 16. Accessibility Requirements

- Illustration: `aria-hidden="true"` and `role="presentation"` — decorative, not announced.
- Title: semantic `<h2>` within its section; if the empty state replaces a list, the heading level must match the heading level that would have introduced the list.
- Description: `<p>` with `id` referenced by `aria-describedby` on the title when the relationship is not implicit in DOM order.
- Primary CTA: real `<button>` or `<a>` — never a `<div>` with a click handler.
- Secondary text link: real `<a>` when navigating; real `<button>` when triggering an action.
- Suggestion chips: each is a real `<button>` or `<a>`; the row uses `role="list"` and items use `role="listitem"` only when the chips represent a list of options.
- Color contrast: `text-primary` on `surface-raised` ≥ 7:1; `text-secondary` on `surface-raised` ≥ 4.5:1.
- `prefers-reduced-motion`: disable float animation on illustration; disable chip stagger; render instantly.

## 17. Future Enhancements

- Contextual illustrations per empty state (magnifying glass for search, clock for schedule, bookmark for watchlist) while keeping the abstract-geometric style defined in Illustrations.md.
- Smart suggestions powered by recommendation engine instead of static trending list.
- "Surprise me" CTA that opens a random popular anime detail page.
- Empty-state A/B testing framework to measure which copy/CTA combinations drive the highest re-engagement.
- Toast notification on successful retry so the user knows the data refreshed even if the empty state unmounts quickly.
