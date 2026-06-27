# Schedule — Nexus Anime

> **Audience:** Subscribers and guests who want to discover what anime airs each week and plan their viewing around real-world broadcast times.

## 1. Purpose

A weekly release schedule that maps every tracked anime to its broadcast day and local air time, so users can see at a glance what is airing now and what is coming next.

## 2. User Goals

- See everything airing today at a glance without scrolling through the full catalog
- Jump to a specific weekday to plan the rest of the week
- Filter by time-of-day block (morning / afternoon / evening / late night) to match personal availability
- Convert Japanese broadcast times (JST) to the user's local timezone automatically
- Navigate directly to an anime's detail page from a schedule entry
- Identify new episodes versus continuing series at a glance

## 3. Entry Points

- Primary navigation link labeled "Schedule" in the top app bar
- Deep link shared from social or notifications (`/schedule?day=mon`)
- "Full Schedule" call-to-action on the Home page hero rail
- Search result shortcut when a query matches an airing title

## 4. Layout Structure

The page is a two-zone layout: a horizontal day-tab strip pinned to the top, and a scrollable vertical timeline list below. Each timeline row contains a thumbnail, title, episode number, and local air time.

```
┌──────────────────────────────────────────────────────────────┐
│  Schedule                              [Time filter ▾]       │
├──────────────────────────────────────────────────────────────┤
│ ┌────┬────┬────┬────┬────┬────┬────┬────┐                    │
│ │Today│Mon│Tue│Wed│Thu│Fri│Sat│Sun│ ← horizontally scrollable│
│ └────┴────┴────┴────┴────┴────┴────┴────┘                    │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ ▢  Anime Title Here                     Ep 12  ·  07:30 │ │
│ │    Subtext / studio line                                 │ │
│ └──────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ ▢  Another Title                        Ep 03  ·  14:00 │ │
│ └──────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ ▢  ...                                                   │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## 5. Component Hierarchy

- `SchedulePage` (route `app/schedule/page.tsx`)
  - `ScheduleHeader` — page title "Schedule" (Space Grotesk 22px) + time-filter control
    - `TimeFilter` — segmented toggle or dropdown (morning / afternoon / evening / late night / all)
  - `DayTabs` — horizontal strip of day buttons
    - `DayTab` × 8 (Today, Mon, Tue, Wed, Thu, Fri, Sat, Sun)
  - `TimelineList` — vertical list of entries for the active day
    - `TimelineItem` — clickable row
      - `AnimeThumbnail` — 64×48 poster crop
      - title text (Inter 16px, `text-primary`)
      - episode badge + local air time (Inter 14px, `text-secondary`)
    - `EmptyState` — shown when no entries match
  - `ScheduleSkeleton` — streaming placeholder while data loads

## 6. Desktop Layout

At ≥1024px the day tabs span the full content width with equal spacing. The timeline list sits below in a single column with 16px card padding and 8px row gap. The time filter aligns to the right of the header. Max content width is 960px, centered. Section gap between header and tabs is 32px; gap between tabs and list is 24px.

## 7. Tablet Layout

At 768–1023px the day tabs become a horizontally scrollable strip with `overflow-x: auto` and hidden scrollbar, snapping to the active tab. The timeline list remains single-column. Card padding stays 16px. The time filter collapses into a compact dropdown to preserve horizontal space.

## 8. Mobile Layout

Below 768px the day tabs are a full-bleed horizontally scrollable strip pinned under the header. Timeline items use compact rows: 48px thumbnail, single-line title, episode and time on one line. If the app shell includes a bottom tab bar, the timeline list gets bottom padding equal to tab-bar height (56px) so the last row is not obscured.

## 9. Navigation Behavior

The active `DayTab` uses `action-primary-bg` as its background with `text-primary` label and a 2px `action-accent-bg` underline indicator. "Today" is auto-selected on page load; the tab strip scrolls to make it visible. Selecting a different tab updates the URL query (`?day=tue`) and re-renders the timeline without a full page reload. The selected day persists across navigation via the URL.

## 10. Scroll Behavior

The day-tab strip scrolls horizontally with snap points aligned to each tab. The timeline list scrolls vertically within its own scroll container; the tab strip remains pinned to the top of the content area. On day switch, the timeline scroll resets to the top. No infinite scroll — the full day's entries render in one pass (capped at a reasonable limit with a "Show more" button if needed).

## 11. Motion & Animation

- Tab switch: crossfade of the timeline list over 150ms with spring easing `cubic-bezier(0.22, 1, 0.36, 1)`.
- Active-tab underline slides to the new position over 200ms with the same spring easing.
- Timeline item hover: background transitions from `surface-raised` to `surface-overlay` over 100ms; subtle scale `1.005` on the thumbnail.
- Duration scale follows the design system: 50ms for micro-feedback, 100–200ms for transitions, up to 1000ms for orchestrated entrance. All use the spring easing unless a linear fade is more appropriate.

## 12. Loading Experience

While the schedule data streams in, `ScheduleSkeleton` renders three to five placeholder rows. Each skeleton row mirrors the real layout: a grey `surface-raised` thumbnail block, two shimmering text lines (title + meta), and a time chip. Skeletons use the same 16px card padding and 8px row gap so the final layout does not shift when real content arrives. Data is fetched server-side with ISR (revalidate 15 minutes) so skeletons are brief.

## 13. Empty States

When the active day (or time filter) yields zero entries, show a centered empty state: a muted illustration, heading "No releases found for this day." in `text-primary` (Inter 16px), and a secondary line "Try another day or clear the time filter." in `text-secondary` (Inter 14px). A `secondary` button labeled "Back to Today" resets the selection.

## 14. Error Handling

- **Partial failure:** If some days fail to load but the active day succeeds, render the available data and show a subtle banner ("Some days couldn't load — showing what's available.") with a Retry link.
- **Full failure:** If the active day fails, show a full-page error card with `accent-error` icon, a friendly message, and a `primary` "Retry" button.
- **Retry:** Re-fetches the failed chunk; on success the error state is replaced without a full reload. Errors never leak stack traces to the client.

## 15. SEO Metadata Requirements

- Title: `Airing Schedule — Nexus Anime`
- Description: "See what anime is airing this week on Nexus Anime. Browse by day and time, converted to your local timezone."
- OG image: 1200×630 branded schedule graphic with `surface-base` background and `action-accent-bg` accent.
- Canonical: `https://nexus-anime.com/schedule`
- Robots: `index, follow` (the schedule is public and intended for discovery).

## 16. Accessibility Requirements

- WCAG 2.2 AA compliance for the dark theme: all text meets contrast ratios against `surface-base` / `surface-raised` / `surface-overlay` (verified for `text-primary` and `text-secondary`).
- Day tabs are an ARIA `tablist` with `tab` / `tabpanel` semantics; arrow-key navigation moves focus between tabs.
- Each `TimelineItem` is a single focusable element with an accessible name combining title, episode, and air time.
- Focus ring uses `action-accent-bg` at 2px offset for high visibility on dark surfaces.
- Time filter toggle is a labeled `group` with `aria-pressed` on segmented options.
- Empty and error states are announced via `aria-live="polite"`.

## 17. Future Enhancements

- Personalized schedule that surfaces only series in the user's watchlist or marked as "watching"
- Push/email notifications N minutes before a tracked anime airs
- Calendar export (`.ics`) so users can add air dates to Google Calendar or Apple Calendar
- Countdown timer on the "Today" tab showing time until the next airing
- Studio or genre quick-filters layered on top of the time filter
