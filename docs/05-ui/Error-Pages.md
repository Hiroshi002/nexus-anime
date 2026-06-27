# Error Pages — Nexus Anime

> **Audience:** Frontend engineers implementing error boundaries, global error handlers, and toast notifications.

---

## 1. Purpose

Define the visual and behavioral specifications for 404, 500, inline component errors, Server Action failures, and offline network states.

## 2. User Goals

- Understand what went wrong in plain language.
- Recover quickly via clear calls to action.
- Continue browsing even when a section or page fails.
- Reference a support ID when reporting a server error.

## 3. Entry Points

- Navigating to a non-existent route (404).
- Unhandled server exception during SSR/ISR (500).
- Server Component throwing inside an `error.tsx` boundary (inline).
- Server Action rejecting or throwing (toast).
- Browser losing network connectivity (offline banner).

## 4. Layout Structure

```
┌──────────────────────────────────────────┐
│  [Logo]                        (minimal) │  404 / 500
├──────────────────────────────────────────┤
│                                          │
│            ┌──────────────────┐          │
│            │   Illustration   │          │
│            └──────────────────┘          │
│                                          │
│                404 / 500                 │
│         "This page drifted..."           │
│          [SearchBar        ]             │
│     [Go home]      [Browse trending]     │
│                          [Sentry ID]     │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  ┌────────────────────────────────────┐  │
│  │  [icon] Title                       │  │  Inline error card
│  │  Message text                       │  │
│  │                    [Try again]      │  │
│  └────────────────────────────────────┘  │
├──────────────────────────────────────────┤
│  ... page content continues ...          │
└──────────────────────────────────────────┘

                              ┌────────────┐
                              │ Toast msg  │  top-right
                              │        [X] │
                              └────────────┘

┌──────────────────────────────────────────┐
│  "You're offline. Some features may..."  │  top banner
├──────────────────────────────────────────┤
│  ... page content ...                    │
└──────────────────────────────────────────┘
```

## 5. Component Hierarchy

- `app/not-found.tsx` → `NotFoundPage`
  - `Logo`
  - `Illustration` (lost astronaut / empty space)
  - `ErrorCode` ("404")
  - `ErrorMessage`
  - `SearchBar`
  - `Button` (primary: "Go home") → `/`
  - `Button` (secondary: "Browse trending") → `/trending`
- `app/global-error.tsx` → `ErrorPage`
  - `Logo`
  - `ErrorCode` ("500")
  - `ErrorMessage`
  - `SentryErrorId`
  - `Button` (primary: "Try again") → `router.refresh()`
  - `Button` (secondary: "Go home") → `/`
- `*/error.tsx` → `InlineError`
  - `ErrorIcon`
  - `ErrorTitle`
  - `ErrorDescription`
  - `Button` ("Try again") → `reset()`
- `Toaster` (client island) → `Toast`
  - `ToastMessage`
  - `ToastDismiss`
- `NetworkBanner` (client island)
  - `BannerMessage`

## 6. Desktop Layout (≥1024px)

- 404/500: full-viewport centered column, max-width 640px, padding 64px.
- Error code: Space Grotesk, 120px, Nova gradient (action-primary-bg → action-accent-bg), line-height 1.
- Illustration: 320×240px, centered above the code.
- Message: Inter, 18px, text-secondary, centered, margin-top 24px.
- SearchBar: full width, max-width 480px, centered, margin-top 32px.
- CTAs: horizontal row, gap 16px, margin-top 24px, centered.
- Sentry ID: Inter, 12px, text-secondary, margin-top 48px, centered.
- Inline error card: max-width 560px, centered within section, padding 32px, surface-raised, border 1px, border-radius 16px, backdrop-blur.
- Toast: fixed top-right, offset 24px from top/right, max-width 360px.
- Offline banner: fixed top, full-width, accent-error background at 10% opacity, text-primary, padding 12px 16px, z-index 50.

## 7. Tablet Layout (768–1023px)

- 404/500: padding 48px, max-width 560px.
- Error code: 96px.
- Illustration: 280×210px.
- SearchBar: max-width 420px.
- CTAs: horizontal row maintained.
- Inline error card: max-width 480px, padding 24px.
- Toast: offset 16px, max-width 320px.

## 8. Mobile Layout (<768px)

- 404/500: padding 32px 20px, full-width.
- Error code: 72px.
- Illustration: 220×165px.
- Message: 16px.
- SearchBar: full width, margin-top 24px.
- CTAs: vertical stack, full-width buttons, gap 12px, margin-top 20px.
- Sentry ID: 11px, margin-top 32px.
- Inline error card: full-width, padding 20px, border-radius 12px.
- Toast: full-width with 16px side margins, max-width none.
- Offline banner: padding 10px 14px, Inter 13px.

## 9. Navigation Behavior

- "Go home" navigates to `/` via `next/link` (full navigation).
- "Browse trending" navigates to `/trending`.
- "Try again" on 500 calls `router.refresh()` to re-render the route segment without full reload.
- Inline "Try again" calls the `reset()` function from the error boundary to retry the failed segment.
- Logo links to `/`.
- SearchBar submits to `/search?q=...`.

## 10. Scroll Behavior

- 404/500: no scroll expected (content fits viewport); if content overflows, vertical scroll with no sticky elements.
- Inline error: section scrolls naturally with surrounding page content.
- Toast: does not affect scroll; auto-dismiss after 5s, pauses on hover/focus.
- Offline banner: pushes content down (static flow), not overlay; dismisses when `navigator.onLine` returns true.

## 11. Motion & Animation

- 404/500: illustration fades in (opacity 0→1) over 300ms ease-out; error code slides up 12px and fades in over 400ms.
- Toast: enters from right with translateX(100%)→0 over 250ms ease-out; exits reverse over 200ms.
- Offline banner: slides down from top over 200ms; slides up on dismiss.
- Inline error card: subtle scale 0.98→1 on mount over 200ms.
- No layout-shifting animations.

## 12. Loading Experience

- 404/500: static pages, no loading state.
- Inline error: no loading state (replaces the errored component directly).
- Toast: appears instantly on Server Action failure; no skeleton.
- Offline banner: appears instantly when `offline` event fires.

## 13. Empty States

- Not applicable — error pages always render content.

## 14. Error Handling

- 404: returned for any unmatched route; logs to analytics as a page-not-found event.
- 500: rendered by `global-error.tsx` for uncaught route errors; logs to Sentry with error ID displayed to user.
- Inline Server Component error: rendered by nearest `error.tsx`; logs to Sentry with component stack; exposes `reset()` for retry.
- Server Action failure: caught in action, surfaces a toast with message "Could not complete action. Please try again."; logs to Sentry.
- Network error (offline): `NetworkBanner` listens to `online`/`offline` events; dismisses automatically when back online; no Sentry log.

## 15. SEO Metadata Requirements

- 404 page:
  - `<title>`: `Page Not Found — Nexus Anime`
  - `<meta name="description">`: `The page you're looking for doesn't exist. Explore trending anime on Nexus Anime.`
  - `<meta name="robots" content="noindex">`
  - `<meta property="og:title">`: `Page Not Found — Nexus Anime`
  - `<meta property="og:type" content="website">`
  - canonical: none (do not canonicalize 404).
  - JSON-LD: none.
- 500 page:
  - `<title>`: `Server Error — Nexus Anime`
  - `<meta name="description">`: `Something went wrong on our end. Please try again shortly.`
  - `<meta name="robots" content="noindex">`
  - `<meta property="og:title">`: `Server Error — Nexus Anime`
  - canonical: none.
  - JSON-LD: none.
- Inline errors: inherit parent page metadata; no separate SEO handling.
- Toasts/banners: no SEO impact.

## 16. Accessibility Requirements

- 404/500: `<main>` landmark; error code is an `<h1>`; message is `<p>`; CTAs are `<a>`/`<button>`; focus moves to `<h1>` on mount via `tabIndex={-1}` and `ref.focus()`.
- Inline error card: wrapped in `<section>` with `aria-live="assertive"`; title is `<h2>`; "Try again" is `<button>`.
- Toast: `role="status"`, `aria-live="polite"`, `aria-atomic="true"`; dismiss button has `aria-label="Dismiss notification"`.
- Offline banner: `role="alert"`, `aria-live="polite"`; dismiss button has `aria-label="Dismiss offline banner"`.
- Color contrast: error code gradient meets 4.5:1 against surface-base; text-secondary meets 4.5:1 on surface-raised.
- Keyboard: all CTAs and dismiss buttons reachable via Tab; Enter/Space activates; focus visible with 2px action-accent-bg outline.
- Reduced motion: disable slide/fade animations when `prefers-reduced-motion: reduce`.

## 17. Future Enhancements

- Localized error messages based on Accept-Language header.
- Suggested links on 404 derived from the failed path (fuzzy match against catalog slugs).
- Animated illustration variants (different scenes per error type).
- Retry-with-backoff for 500 page after a short delay.
- Offline banner with a "Retry" action for queued mutations.
