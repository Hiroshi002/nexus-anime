# Authentication — Nexus Anime

> **Audience:** Engineers implementing auth flows (login, signup, verify email, forgot/reset password). All four pages share a centered, full-height layout with no chrome.

---

## 1. Purpose

Provide secure, low-friction account access and recovery flows for unauthenticated users, with consistent UX across all auth surfaces.

## 2. User Goals

- Sign in quickly with email/password or a trusted OAuth provider.
- Create an account with clear feedback on password strength and field requirements.
- Verify email ownership without leaving the platform.
- Recover access when a password is forgotten.

## 3. Entry Points

- Header avatar button (unauthenticated state) → `/login`
- "Sign up" link inside the sign-in card → `/signup`
- "Forgot password?" link inside the sign-in card → `/forgot-password`
- OAuth callback (Google, GitHub) → redirects back to the originating page or `/`
- Deep links to protected routes → `/login?callbackUrl=/watch/123`
- Email verification link (external) → `/verify?token=...`

## 4. Layout Structure

```
┌────────────────────────────────────────────┐
│                                            │
│              [LOGO] Nexus Anime           │
│               (link to /)                  │
│                                            │
│         ┌──────────────────────┐           │
│         │   CARD (max 440px)   │           │
│         │                      │           │
│         │   Title + subtitle   │           │
│         │   Form fields        │           │
│         │   Primary CTA        │           │
│         │   Divider            │           │
│         │   OAuth buttons      │           │
│         │   Alternate flow    │           │
│         └──────────────────────┘           │
│                                            │
│         (subtle Nova gradient orbs)        │
│                                            │
└────────────────────────────────────────────┘
```

Background: `surface-base (#0a0e1a)` with 2–3 large, softly blurred gradient orbs (`action-primary-bg` to `action-accent-bg`, ~640px diameter, `opacity-20`, drifting slowly). No header, no sidebar, no footer.

## 5. Component Hierarchy

- CenteredAuthLayout (full-screen, vertical + horizontal centering, orb backdrop)
  - LogoLink (top of card, links to `/`, focus ring on tab)
  - AuthCard (max-width 440px, surface-raised, rounded-2xl, glassmorphism border)
    - AuthHeader
      - Space Grotesk 28px weight-700, text-primary — form title
      - Inter 14px weight-400, text-secondary — optional subtitle or email hint
    - Client-side Zod form
      - FormField (email)
      - FormField (password) + PasswordToggle
      - PasswordStrengthMeter (signup only)
      - RememberMeCheckbox (login only)
      - SubmitButton (primary, full-width)
      - InlineFormError (aria-live region)
    - Divider ("or continue with")
    - OAuthButton (Google, full-width, outline style)
    - OAuthButton (GitHub, full-width, outline style)
    - AlternateFlowLink (signup ↔ login, login ↔ signup)
  - FooterLinks (terms, privacy — small text, bottom edge, centered)

## 6. Desktop Layout (≥1024px)

- Card centered vertically and horizontally with 32px safe padding on all sides.
- Card padding: 40px.
- Max card width: 440px; fills fluidly down to 360px.
- Orb backdrop spans full viewport with floating animation (see Motion).
- Logo above card: 32px height, 16px gap to card top.
- Card border: 1px solid `surface-overlay` with `backdrop-blur-sm`.
- All interactive elements hit area ≥ 44px vertical.
- OAuth buttons are stacked vertically (not side by side).

## 7. Tablet Layout (768–1023px)

- Card padding: 32px.
- Card width still capped at 440px; left/right safe margin 24px.
- Orbs compressed to 480px diameter, opacity reduced to 0.15 to reduce visual noise.
- Alternate flow link increases hit area to 48px.
- No other layout changes.

## 8. Mobile Layout (<768px)

- Card edge margins: 16px each side.
- Card padding: 24px.
- Logo height: 28px.
- Title font size scales to 24px.
- Password strength meter bars shrink proportionally but remain touch-friendly (each bar 6px height).
- OAuth buttons reduce horizontal padding to 16px; icon + label truncation rule — never wrap label to a second line.
- Show-Hide toggle positioned at least 44px from right card edge to avoid overlap on narrow screens (≤360px).
- Orb backdrop reduced to static, single-orb variant (no animation on devices that disable motion).

## 9. Navigation Behavior

- Logo click → `/`.
- "Sign up" link in the sign-in card → `/signup`.
- "Already have an account? Sign in" in signup card → `/login`.
- "Forgot password?" → `/forgot-password`.
- After successful login, redirect to `callbackUrl` search param if present, otherwise `/`.
- After successful signup, redirect to `/verify/email`.
- Back-button after form submission: returns to the originating auth page without re-POST (replace navigation on submit).
- Terms and Privacy links open in a new tab (`target="_blank"`, `rel="noopener noreferrer"`).

## 10. Scroll Behavior

- Scroll is generally unnecessary; card is viewport-fit with internal overflow only when content exceeds 90vh.
- When overflow triggers (small viewport + password strength + OAuth buttons), the card itself scrolls internally — background remains fixed.
- No parallax. No sticky header.

## 11. Motion & Animation

- Orb drift: 24000ms linear infinite, translates ±30px X / ±20px Y; uses `prefers-reduced-motion` media query to disable.
- Card entrance: 200ms spring, 0→1 opacity, translateY 12px→0.
- Button press: scale 0.985 on `:active`, 150ms ease-out.
- Focus ring: 2px solid `action-primary-bg`, 4px offset, fades in 150ms.
- Password strength bars: width expands 200ms ease-out as score increases.
- Error messages: slide-in from top 8px, 200ms ease-out.
- OAuth loading state: spinner replaces icon, label remains, button becomes aria-disabled.

## 12. Loading Experience

- Initial page render (unauthenticated, SSR): form is interactive immediately.
- Submit: button enters loading state (spinner, disabled) until server response resolves.
- OAuth click: button enters loading state, redirect initiated client-side (no visible spinner delay; navigate on click).
- Verify token page: auto-submit via `use()` + Server Action on mount; show 2-second skeleton pulse before result, then present success or redirect.

## 13. Empty States

- Not applicable — all auth forms have a defined, always-present field set.

## 14. Error Handling

- Client-side validation (Zod) fires on blur and on submit attempt; inline error below each field, linked via `aria-describedby`.
- Server errors:
  - Invalid credentials — generic inline form error: **"Invalid email or password."** Never reveal whether email exists.
  - Rate-limited — form-level banner: **"Too many attempts. Try again in N minutes."** Countdown time comes from `Retry-After` header mapped to minutes.
  - Account locked — same message as rate-limited to prevent enumeration.
  - Network failure — snackbar-style inline banner, red `accent-error` left border: **"Could not reach the server. Check your connection."**
- Zod validation messages:
  - Email — "Enter a valid email address."
  - Password (signup) — "Password must be at least 8 characters, include upper + lower + number + symbol."
  - Confirm password — "Passwords do not match."
  - Username — "3–20 characters. Letters, numbers, underscore only."
- Password hash failure on reset: redirect to `/verify/expired` with resend option, never surface raw token status.

## 15. SEO Metadata Requirements

- **Login page:**
  - `<title>Sign In — Nexus Anime</title>`
  - `<meta name="description" content="Sign in to Nexus Anime to continue your watchlist and pick up where you left off.">`
  - `<meta name="robots" content="noindex">`
  - `<link rel="canonical" href="https://nexus-anime.com/login">`
  - No OG auth-specific tags; default site OG applies.
- **Signup page:**
  - `<title>Create Your Account — Nexus Anime</title>`
  - `<meta name="description" content="Create a free Nexus Anime account to track anime, build a watchlist, and pick up where you left off on any device.">`
  - `<meta name="robots" content="noindex">`
  - `<link rel="canonical" href="https://nexus-anime.com/signup">`
- **Verify Email interstitial & token pages:**
  - `<meta name="robots" content="noindex, nofollow">`
  - No canonical (token is one-shot).
- **Forgot / Reset Password pages:**
  - `<meta name="robots" content="noindex">`
  - Title: `Reset Your Password — Nexus Anime` and `Check Your Inbox — Nexus Anime`
- No JSON-LD on auth pages (no structured data for auth surfaces).

## 16. Accessibility Requirements

- Every field has a visible `<label>` associated via `for`/`id`.
- Errors linked to their field via `aria-describedby`; the form-level error region uses `aria-live="polite"` so screen readers announce after submit.
- Password toggle uses `aria-pressed="true|false"` and `aria-label="Show password"` / `"Hide password"`.
- Tab order: logo → title → form fields (top to bottom) → submit → OAuth buttons → alternate flow link. Never traps focus; Escape on OAuth triggers has no side effect.
- Focus indicator: visible ring as defined in Motion section, applied to all interactive elements at all times (no `:focus-woff`).
- OAuth buttons distinguishable by icon AND text label; never icon-only.
- Background orbs are decorative — `aria-hidden="true"`.
- Reduced motion: `prefers-reduced-motion: reduce` disables orb drift, card entrance transition, button press scale.
- Skip-to-content link (first focusable element on page, visible on focus) pointing to the form's first input.
- Color contrast: text-secondary on surface-base must meet WCAG AA 4.5:1 minimum; text on OAuth button meets AA at 4.5:1.

## 17. Future Enhancements

- Passkey / WebAuthn login as an alternative to password.
- Two-factor authentication (TOTP) — separate flow, reuse the centered card layout.
- "Continue with Discord" and "Continue with Apple" OAuth providers (expand OAuth row in the card).
- Account linking: allow users to connect Google / GitHub / Discord after initial email signup in settings.
- Suspicious-login detection challenge (CAPTCHA or proof-of-work) before the OAuth callback completes.
