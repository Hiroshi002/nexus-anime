# Loading States — Nexus Anime

> **Audience:** UI/UX designers, frontend engineers implementing skeleton and spinner patterns.

---

## 1. Purpose
Define the skeleton, spinner, and progress-bar design system for perceived-performance transitions across the application.

## 2. User Goals
- Understand that content is loading without a blank screen.
- Perceive progress during measurable operations (upload, buffering).
- Recognize the shape of upcoming content via skeleton placeholders.
- Experience no layout shift between skeleton and resolved content.

## 3. Entry Points
- Catalog page (anime grid + rail skeletons during initial fetch)
- Anime detail page (hero + metadata skeletons)
- Search results (list or grid skeleton depending on viewToggle)
- Home page (streamed sections with per-section skeletons)
- Profile / watchlist pages (profile header + row skeletons)
- Episode list (episode row skeletons during infinite scroll)
- Client actions: form submit, watchlist toggle, file upload, video buffering

## 4. Layout Structure
```
┌──────────────────────────────────────────────────────┐
│  Rail / Section                               │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │ ▓▓▓▓ │ │ ▓▓▓▓ │ │ ▓▓▓▓ │ │ ▓▓▓▓ │ │ ▓▓▓▓ │      │
│  │ ▓▓▓▓ │ │ ▓▓▓▓ │ │ ▓▓▓▓ │ │ ▓▓▓▓ │ │ ▓▓▓▓ │      │
│  │ ▒▒   │ │ ▒▒   │ │ ▒▒   │ │ ▒▒   │ │ ▒▒   │      │
│  │ ▒▒   │ │ ▒▒   │ │ ▒▒   │ │ ▒▒   │ │ ▒▒   │      │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘      │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  Detail Page                                         │
│  ┌─────────────────────────────────────────┐         │
│  │         HeroSkeleton (480px)            │         │
│  └─────────────────────────────────────────┘         │
│  ┌──────────┐  ┌───────────────────────────┐         │
│  │ Avatar   │  │ Text x3 (100% / 80% / 60%)│        │
│  └──────────┘  └───────────────────────────┘         │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  Profile Header                                      │
│  ┌────────┐  ┌──────────────────────────┐            │
│  │  ◯◯◯  │  │ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒    │            │
│  │  Avatar│  │ ▒▒▒▒▒▒▒▒▒▒              │            │
│  └────────┘  │ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒        │            │
│  ┌────────┐  └──────────────────────────┘            │
│  │ Stats  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │
│  │  row   │  │ ▒▒  │ │ ▒▒  │ │ ▒▒  │ │ ▒▒  │       │
│  └────────┘  └─────┘ └─────┘ └─────┘ └─────┘       │
└──────────────────────────────────────────────────────┘
```

## 5. Component Hierarchy
- SkeletonProvider (context for aria-live region & reduced-motion preference)
  - SectionSkeleton (groups a set of skeletons with a shared label)
    - AnimeCardSkeleton
    - AnimeRowSkeleton
    - EpisodeRowSkeleton
  - HeroSkeleton (standalone, high-emphasis)
  - ProfileHeaderSkeleton
    - AvatarSkeleton (96px / 64px / 48px responsive)
    - TextSkeleton (×3, 100% / 80% / 60% widths)
    - Stats row (4 pill skeletons)
  - TextSkeleton (standalone, 1–3 lines, variable widths)
  - AvatarSkeleton (standalone: 40px / 64px / 96px)
  - GridSkeleton
    - children: repeated skeletons matching grid template (count = expected items)
  - ListSkeleton
    - children: repeated row skeletons (count = expected rows)
  - Spinner (inline | block | overlay variants)
  - ProgressBar (determinate, with visible percentage label)

## 6. Desktop Layout (≥1024px)
- Grid skeletons: 5 columns for catalog rail, 4 columns for related.
- Row skeletons: 72px thumbnail + flexible text block, 16px gap, 4px rounding.
- HeroSkeleton: full container width (80vw cap), min-height 480px, rounded 12px, surface-raised (#111627).
- ProfileHeaderSkeleton: 96px avatar + 3 text lines (240px block) + stats row (4 pill skeletons, equal width, 8px gap).
- EpisodeRowSkeleton: 160px thumbnail (16:9) + title line + metadata line + duration pill.
- TextSkeleton: left-aligned lines with 8px vertical gap between lines.

## 7. Tablet Layout (768–1023px)
- Grid skeletons: 3 columns, 16px gap.
- Row skeletons: 64px thumbnail, single text line + metadata line.
- HeroSkeleton: full width, min-height 360px.
- ProfileHeaderSkeleton: 64px avatar, 2 text lines, compact stats.
- EpisodeRowSkeleton: 120px thumbnail + title + metadata inline.

## 8. Mobile Layout (<768px)
- Grid skeletons: 2 columns, 12px gap.
- Row skeletons: 56px thumbnail, single line clamped (ellipsis after 2 lines).
- HeroSkeleton: full width, min-height 280px, rounded 8px.
- ProfileHeaderSkeleton: 48px avatar, stacked below name line, horizontal scroll stats row.
- EpisodeRowSkeleton: full-width thumbnail (aspect 16:9) + title line below.
- ListSkeleton rows: full-width, no side thumbnail, vertically stacked.

## 9. Navigation Behavior
- Initial page load: skeletons render from the first paint; no blank white flash between route change and data.
- Soft navigation (Link prefetch): skeleton appears only if data arrives after 200ms; otherwise skip skeleton entirely to avoid flicker.
- Tab switch within a page: retain content if already loaded; show skeleton only on first view.

## 10. Scroll Behavior
- Scroll position is preserved when skeletons replace content (matching dimensions).
- Infinite-scroll rows: skeleton row appended at the bottom, removed when data arrives — no jump.
- Lazy skeletons (below fold): render when within 200px of viewport via IntersectionObserver.

## 11. Motion & Animation
- Pulse: opacity 0.6 → 1 → 0.6, linear, 1.5s infinite.
- Base skeleton color: `surface-raised` (#111627); overlay variant for nested surfaces uses `surface-overlay` (#171d30).
- No shimmer — shimmer is visually noisy and triggers vestibular issues.
- Stagger: siblings offset by 80ms (max 5 visible) for subtle wave — only on initial load, not on pagination append.
- Spinner: rotation 0.8s linear infinite, stroke color `text-primary` (#ecedf5), stroke-width 3px.
- Progress bar: fill animates smoothly over time, color `text-primary`,Track color `surface-overlay`.
- `prefers-reduced-motion: reduce` → static placeholder (no pulse, no rotation, no stagger). Skeleton remains visible but motionless. Spinner replaced by static "…" indicator.

## 12. Loading Experience
| Scenario | Indicator | Duration threshold |
|---|---|---|
| Known content shape, async fetch | Skeleton | > 200ms |
| Unknown content shape | Spinner | > 200ms |
| Sub-200ms fetch | Nothing (avoid flicker) | < 200ms |
| Measurable progress | Progress bar ( determinate ) | — |
| Indeterminate, > 3s | Skeleton + "Still loading…" text | > 3s |

### Skeleton vs Spinner vs Progress Bar
- **Skeleton**: preferred for known shapes (cards, rows, lists, hero, profile). Provides perceived structural preview.
- **Spinner**: used when content shape is unknown, or when loading a secondary/inline element without spatial context.
- **Progress bar**: used for measurable operations (video buffering, file upload, onboarding steps). Always show numeric percentage when available.

### Skeleton Inventory
- **AnimeCardSkeleton**: rounded rect (2:3 aspect ratio for poster) + 2 text lines (title + subtitle). Rounded 8px, gap 8px.
- **AnimeRowSkeleton**: 72px thumbnail (desktop) + 2 text lines (title + metadata) + 1 secondary metadata line.
- **HeroSkeleton**: full-width 480px dark block. Contains shimmer-free gradient overlay placeholder for back drop image.
- **TextSkeleton**: 1–3 lines of varying widths (100%, 80%, 60% from container). Text lines rounded 2px.
- **AvatarSkeleton**: circle, available in 40px / 64px / 96px variants for different contexts (comment, card, profile).
- **EpisodeRowSkeleton**: 160px thumbnail + 2 text lines + duration pill (rounded full, fixed width ~48px).
- **ProfileHeaderSkeleton**: avatar + 2 text lines + stats row (4 equal pills).
- **GridSkeleton**: N cards in a grid; respects the responsive grid template of the parent. Use typical result count — 6 for a rail, 12 for a page, 20 for a full grid.
- **ListSkeleton**: N rows in a list; matches the height of a typical AnimeRowSkeleton. Use typical page size — 10–20 rows.

### Streaming Suspense Boundaries
- Each async Server Component wrapped in `<Suspense>` with a skeleton fallback matching the component shape.
- Boundaries are per-section, not per-page — so heroes, rails, and sidebars resolve independently and partial content is visible before the page finishes streaming.
- Nested Suspense: parent skeleton shows until first child resolves; once the shell is ready, children stream in with their own skeletons.
- Without `<Suspense>`, the entire page blocks on the slowest component. With per-section boundaries, each boundary clears independently.

### Client Loading States
- **Button loading**: replace label with inline spinner, set `disabled`, swap text to "Saving…" / "Submitting…" / context-aware verb.
- **Form loading**: overlay with spinner centered, fields disabled to prevent double submission.
- **Optimistic update**: UI updates immediately on action, rolls back with toast notification on error.
- **Infinite scroll**: skeleton row appended at the bottom; removed when data arrives; no scroll jump.

### Performance
- Skeleton count: match typical result count, not the full dataset. A rail shows 6 skeletons even if the API returns 20.
- Do not skeleton already-loaded content — preserving scroll position is more important than showing a skeleton for cached data.
- Lazy-render below-fold skeletons via IntersectionObserver (200px margin).

## 13. Empty States
Distinct from loading — see Empty States doc. Skeleton disappears and empty-state illustration + CTA appear when zero results are returned. Never show skeleton if the response is an empty array with no error.

## 14. Error Handling
- On fetch failure: skeleton fades out, inline error card fades in with retry button.
- Partial failure in streamed sections: healthy sections render; failed section shows its own error card without blocking the page.
- Persistent skeleton (> 10s): escalate to "Trouble loading — retry?" card to guard against stuck states.

## 15. SEO Metadata Requirements
<title, description, OG, canonical, robots, JSON-LD if applicable>

`Loading States` has no dedicated route — metadata rules apply to each consuming page. General guidance:
- `<title>` and `<meta name="description">` are server-rendered before skeleton mounts; no skeleton affects crawler output.
- Canonical URL and OG tags are emitted at the shell level.
- `robots`: `index, follow` on catalog and detail pages; `noindex` on profile/watchlist (private).
- JSON-LD: emit structured data from resolved data in `<head>`; never include skeleton state in JSON-LD. Use `availability` / `schema:validFrom` contextually if appropriate.

## 16. Accessibility Requirements
- Skeletons: `role="status"`, `aria-busy="true"`, `aria-label="Loading…"`.
- Spinner: `role="status"`, `aria-label="Loading"`.
- Progress bar: `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`.
- Skeleton content is not read by screen readers (`aria-hidden="true"` on decorative blocks).
- After skeleton resolves: `aria-busy` removed, focus moves to the new content if it replaced an interactive region.
- Reduced motion: respect `prefers-reduced-motion` — no pulse, no spinner rotation, no stagger.
- Color contrast of skeleton surface against background — do not use surface-raised on surface-raised; skeleton container must have a visible boundary.

## 17. Future Enhancements
- Progressive image skeleton: dominant-color placeholder extracted from TMDB poster, blurred LQIP behind full image download.
- Bone-svg skeletons: vector outlines of specific components (exact poster shape, avatar silhouette) for higher-fidelity perceived structure.
- Skeleton swap animation: cross-fade from skeleton to real content with 200ms opacity transition when data arrives.
- Prefetch-tuned thresholds: adjust 200ms skeleton delay based on `navigator.connection.effectiveType` (200ms on 4g, 500ms on 3g).
- App-level spinner: branded Nexus Anime logo spinner for top-level route transitions.
- Content preview: return partial data from API for ultra-light initial render before full detail loads.
