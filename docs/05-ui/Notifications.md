# Notifications — Nexus Anime

> **Audience:** Authenticated users who want to track new episodes, recommendations, system alerts, and social activity.

---

## 1. Purpose
A dedicated notification center where authenticated users can view, manage, and navigate to relevant updates across the platform.

## 2. User Goals
- See new episodes available for followed anime
- Discover personalized recommendations
- Review system announcements and service alerts
- Dismiss or mark notifications as read
- Navigate directly to the relevant content from a notification

## 3. Entry Points
- Bell icon in the global navigation header (with unread count badge)
- Direct route: `/notifications`
- Post-action toasts that link to `/notifications?notificationId=:id`

## 4. Layout Structure
```
┌──────────────────────────────────────────────────────────┐
│  Header (surface-raised)                                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Notifications  [unread badge]   Mark all read     │  │
│  └────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────┤
│  Content (surface-base)                                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │  │ Icon  Title                           time ago  │  │
│  │  │ Body text                                     │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  │ Icon  Title                           time ago  │  │
│  │  │ Body text                                     │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  ...                                              │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  [Load more]                                      │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

## 5. Component Hierarchy
- `NotificationsPage`
  - `NotificationsHeader`
    - `PageTitle` — "Notifications" (Space Grotesk, 22px)
    - `UnreadBadge` — pill badge with count
    - `Button` (ghost variant) — "Mark all as read"
  - `NotificationList`
    - `NotificationItem` (one per notification)
      - `TypeIcon` — per-type glyph
      - `Title` — text-primary, Inter 14px semibold
      - `Body` — text-secondary, Inter 14px
      - `TimeAgo` — text-secondary, Inter 12px
      - `ReadAccent` — left bar, action-primary-bg, 3px wide
  - `EmptyState`
    - `EmptyIllustration`
    - `EmptyTitle` — "You're all caught up!"
    - `EmptyBody` — "We'll let you know when something new arrives."
  - `LoadMoreButton` — ghost variant, centered

## 6. Desktop Layout (≥1024px)
- Max-width container: 720px, centered
- Header: sticky at top, 64px height, surface-raised with 1px border-bottom (surface-overlay)
- Notification list: 16px vertical gap between items
- Each notification card: 16px padding, surface-raised, 8px border-radius, 1px border (surface-overlay)
- Left accent bar: 3px wide, full height, action-primary-bg, only on unread items
- "Mark all as read": right-aligned in header, ghost button, 14px Inter
- Unread badge: action-primary-bg background, text-primary, 12px Inter, 8px horizontal padding, 4px vertical padding, pill shape
- Infinite scroll sentinel: 200px before viewport edge triggers next page fetch

## 7. Tablet Layout (768–1023px)
- Container: full width with 24px horizontal padding
- Header: same as desktop
- Notification cards: same as desktop
- "Load more" button: full-width, ghost variant

## 8. Mobile Layout (<768px)
- Container: full width with 16px horizontal padding
- Header: stacked — title + badge on first row, "Mark all as read" on second row, right-aligned
- Notification cards: 12px padding, same structure
- Type icon: 20px (down from 24px)
- Body text: truncated to 2 lines with ellipsis
- "Load more": full-width
- Infinite scroll sentinel: 100px before viewport edge

## 9. Navigation Behavior
- Clicking a `NotificationItem` marks it as read (optimistic update) and navigates to `linkUrl`
- `linkUrl` targets: `/anime/:slug` (episode/recommendation), `/system/:id` (system), `/user/:id` (social)
- "Mark all as read" sends a POST to `/api/notifications/read-all`; optimistic UI clears all accent bars
- Back button returns to the page the user came from (history state preserved)

## 10. Scroll Behavior
- Page does not reset scroll position on refocus
- Infinite scroll: IntersectionObserver watches a sentinel `<li>` at the end of the list; when visible, fetch next page (cursor-based, 20 items per page)
- New page results append to the list; sentinel re-repositions
- No virtualization for lists under 200 items; virtualize beyond that

## 11. Motion & Animation
- New notification items: fade-in + 8px slide-up, 200ms ease-out
- Mark-as-read transition: accent bar fades to transparent over 300ms
- "Mark all as read": button shows a brief loading spinner (12px) for 300ms minimum to avoid flash
- Empty state illustration: subtle float animation, 3s loop, ease-in-out

## 12. Loading Experience
- Initial load: skeleton list of 6 placeholder cards (animated shimmer on surface-raised)
- Skeleton per row: left accent placeholder, 2-line text placeholder (title 60% width, body 90% width), time placeholder (30% width)
- "Load more" button: shows spinner while fetching next page
- Header unread count: populated from initial API response; no separate skeleton

## 13. Empty States
- Trigger: user has zero notifications
- Illustration: bell with "no new messages" visual (64px × 64px, accent-success outline)
- Title: "You're all caught up!" — Space Grotesk 18px, text-primary
- Body: "We'll let you know when something new arrives." — Inter 14px, text-secondary
- No CTA button — user has nothing to act on

## 14. Error Handling
- API failure on initial load: full-page error state with retry button (ghost variant)
- API failure on "Load more": inline error toast below the list with retry button
- API failure on "Mark all as read": revert optimistic update, show error toast, retain unread badges
- Network offline: show banner at top — "You're offline. Notifications may be outdated." (accent-success 40% opacity)
- Invalid `notificationId` in query param: silently ignore, do not highlight any item

## 15. SEO Metadata Requirements
- `<title>Notifications — Nexus Anime</title>`
- `<meta name="description" content="View and manage your notifications on Nexus Anime.">`
- `<meta name="robots" content="noindex">`
- `<meta property="og:title" content="Notifications — Nexus Anime">`
- `<meta property="og:description" content="View and manage your notifications on Nexus Anime.">`
- `<meta property="og:type" content="website">`
- `<link rel="canonical" href="https://nexus-anime.com/notifications">`
- No JSON-LD (private, user-specific page)

## 16. Accessibility Requirements
- Unread count badge wrapped in `aria-live="polite"` region so screen readers announce changes
- `NotificationList` is a `<ul>` with `role="list"`; each item is a `<li>`
- Each `NotificationItem` has `aria-label="{type}: {title}, {read status}, {time ago}"`
- Unread items: `aria-current="true"` on the accent bar region
- "Mark all as read" button: `aria-label="Mark all notifications as read"`
- Clickable notification: wrapped in `<a>` with `href={linkUrl}` — natively focusable and keyboard-navigable
- Focus visible: 2px outline in action-primary-bg, 2px offset
- Empty state illustration: `aria-hidden="true"` with descriptive text alternative
- Infinite scroll sentinel: `aria-busy="true"` during fetch, `aria-live="polite"` for result count announcement

## 17. Future Enhancements
- Filter tabs: All / Episodes / Recommendations / System / Social
- Push notification opt-in with browser Notification API
- Real-time delivery via Server-Sent Events (SSE) for new notifications
- Grouped notifications (e.g., "3 new episodes for Attack on Titan")
- Notification preferences page to mute categories
