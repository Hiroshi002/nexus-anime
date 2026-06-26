# Settings — Nexus Anime

> **Audience:** Product designers, frontend engineers, QA, and accessibility reviewers working on the authenticated Settings experience.

---

## 1. Purpose
Provide authenticated users a single, tabbed destination to manage account identity, subscription, notification preferences, and accessibility display preferences.

## 2. User Goals
- Update display name, email, or password without leaving the page.
- View current plan, manage subscription, and download invoice PDFs.
- Tune email, push, and per-anime notification preferences.
- Configure reduced motion, font scale, high contrast, autoplay, and captions defaults.
- Delete account through a verified, multi-step confirmation flow.

## 3. Entry Points
- User menu in the global navigation → "Settings" link.
- Deep link from the billing success return URL (`/settings?tab=billing`).
- Deep link from account-deleted confirmation email → landing on Account tab.
- Footer link labeled "Account Settings" visible only to authenticated users.

## 4. Layout Structure
```
┌──────────────────────────────────────────────────────────┐
│  Header / Nav bar (authenticated)                        │
├────────────┬─────────────────────────────────────────────┤
│            │  Page title: "Settings"                     │
│  Sidebar   │  Tab bar: Account | Billing |               │
│  sub-nav   │               Notifications | Accessibility  │
│            ├─────────────────────────────────────────────┤
│            │  Active tab panel                           │
│            │                                             │
└────────────┴─────────────────────────────────────────────┘
```

## 5. Component Hierarchy
- `SettingsLayout`
  - `SettingsSidebar` / `SettingsTabBar`
    - `TabsList` (`role="tablist"`)
      - `Tab` — Account
      - `Tab` — Billing
      - `Tab` — Notifications
      - `Tab` — Accessibility
  - `AccountPanel`
    - `ProfileSection` (display name, email)
    - `PasswordSection`
    - `DangerZoneSection` → `DeleteAccountModal`
  - `BillingPanel`
    - `CurrentPlanBadge`
    - `ManageSubscriptionButton` (Stripe portal redirect)
    - `BillingHistoryTable`
    - `UpgradePlanCTA`
  - `NotificationsPanel`
    - `EmailPreferencesSection`
    - `PushPreferencesSection` (future)
    - `PerAnimeNotificationsSection`
  - `AccessibilityPanel`
    - `ReducedMotionToggle`
    - `FontSizeSelector` (sm / md / lg)
    - `HighContrastToggle`
    - `AutoplayPreferenceToggle`
    - `CaptionsDefaultToggle`
  - `ModalOverlay`

## 6. Desktop Layout (≥1024px)
- Two-column layout: fixed-width sidebar on the left (240px), fluid content on the right.
- Sidebar is vertically scrollable if tab list overflows; it pins to the top below the header.
- Tab buttons are full-width, left-aligned, 14px Inter, `text-secondary` default, `text-primary` with `action-primary-bg` active pill.
- Section padding: 16px card internal; 32px between adjacent sections.
- Page title: Space Grotesk, 22px, `text-primary`.

## 7. Tablet Layout (768–1023px)
- Sidebar collapses into a horizontal scrollable tab bar pinned below the page title.
- Tab buttons become pill-shaped, 14px, 16px horizontal padding, no vertical stacking.
- Section padding remains 16px; section gap reduces from 32px to 24px.

## 8. Mobile Layout (<768px)
- Horizontal tab bar persists; tab labels remain visible (do not collapse to icons).
- Full-width cards; section gap 16px.
- "Delete account" CTAs appear as outline buttons, not text links, for touch target size.
- Stripe portal redirect becomes a full-width primary button.
- Modals render as bottom sheets with drag-to-dismiss affordance.

## 9. Navigation Behavior
- Tab state lives in the URL query string (`?tab=account`); deep-linkable and back-button friendly.
- Default landing tab is `account`.
- Modifying unsaved form fields surfaces an "Unsaved changes" toast if the user tries to switch tabs — confirm/cancel.
- Sidebar buttons update `aria-selected="true"` and `aria-controls="<panel-id>"` on click.

## 10. Scroll Behavior
- When switching tabs, scroll position resets to 0 of the active panel.
- Within a long panel (e.g., billing history), internal section anchors are not used; users scroll.
- Sidebar is independent of panel scroll on desktop.

## 11. Motion & Animation
- Tab switch: cross-fade, 150ms `ease-out`.
- Modal open: scale 95% → 100%, 200ms, with `surface-overlay` backdrop at 60% opacity.
- Toggle switch: knob slides 120ms; animated only when the user has "reduced motion" disabled.
- All motion tokens respect the `prefers-reduced-motion` media query automatically.

## 12. Loading Experience
- Suspense skeleton renders the sidebar (4 placeholder pill items) + content area (three 48px placeholder lines).
- Billing table shows skeleton rows (3 × 56px rows) until Stripe data returns.
- Server action responses surface a success or error toast inline; no full-page reload.

## 13. Empty States
- Billing history: when no receipts exist, show illustration + "No invoices yet. Your receipts will appear here after your first payment."
- Per-anime notifications: when user has no anime with notifications enabled, show "You haven't enabled notifications for any anime yet. Open an anime page and toggle \"Notify me\"."

## 14. Error Handling
- Failed subscription redirect → inline error banner inside Billing panel with a "Retry" button.
- Failed account deletion → inline error inside the modal, preserve typed confirmation text.
- Failed preferences save → toast with error message; form state rolls back to last known good values.
- All banners use `accent-error` for icon and border, `text-secondary` for description text.

## 15. SEO Metadata Requirements
- `<title>`: `Settings — Nexus Anime`
- `<meta name="description" content="Manage your account, subscription, notifications, and accessibility preferences on Nexus Anime.">`
- `<meta name="robots" content="noindex">`
- OG tags: `og:title`, `og:description`, `og:url` (no image, as settings is not shareable).
- Canonical URL: `https://nexus-anime.com/settings`.
- No JSON-LD; this is an authenticated, non-public page.

## 16. Accessibility Requirements
- Visible `<label>` associated with every input via `for` attribute; instruction text linked via `aria-describedby`.
- Toggles use `role="switch"` with `aria-checked` reflecting current state.
- Tab panels use `role="tabpanel"` with `aria-labelledby` pointing to the owning tab.
- Modal traps focus on open; `ESC` closes it, focus returns to the triggering button.
- Color alone is never the sole indicator — error/success states include icon + text.
- Minimum touch target: 44 × 44px on interactive controls.
- Font-size selector choices are radio buttons (`role="radiogroup"`), not a slider.

## 17. Future Enhancements
- Add push notification preferences once Web Push is integrated (currently `aria-disabled="true"` placeholder row).
- Add "Download my data" / "Request archive" flow in Account tab (GDPR / data portability).
- Add connected devices management (revoke sessions) in Account tab.
- Add language preference selector in Accessibility tab.
- Add per-subtitle-language default selection in Accessibility tab.
