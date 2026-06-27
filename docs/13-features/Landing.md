# Landing — Nexus Anime

> **Audience:** Engineers implementing the marketing landing page, SEO specialists, product managers. This spec defines the anonymous-only marketing surface that converts visitors into registered users.
> **Milestone:** M3
> **Owner:** Product / Design
> **Status:** Draft

---

## 1. Purpose

Convert anonymous visitors into registered users with a cinematic, marketing-driven experience that communicates the platform's value proposition in under 5 seconds. The landing page is the first impression for search-engine visitors, social media referrals, and ad-driven traffic. It is statically generated — no server work at request time — ensuring sub-second load times globally.

## 2. Business Goals

- **Conversion:** Drive visitor-to-signup conversion. Target: landing-to-signup rate > 5%.
- **SEO:** Rank for high-intent keywords ("stream anime", "watch anime online"). Target: top-10 ranking for 10 target keywords within 6 months of launch.
- **Performance:** LCP < 1.5s on 4G. Every 100ms of LCP delay costs ~1% conversion. Target: Lighthouse Performance score > 95.
- **Brand perception:** Cinematic, premium aesthetic signals quality. Target: bounce rate < 30%.
- **A/B testability:** CTA variants are swappable without code deploys. Target: run at least 2 concurrent CTA experiments by M4.

## 3. Functional Requirements

### 3.1 Happy Path

1. Anonymous visitor navigates to `nexusanime.com`. System serves the statically-generated landing page with hero section, featured anime carousel, features grid, how-it-works section, final CTA banner, and footer.
2. Visitor reads the hero headline and subheadline, clicks the primary "Get Started" CTA. System navigates to `/signup`.
3. Visitor scrolls down, browses the featured anime carousel (horizontal scroll), clicks a card. System navigates to `/anime/{id}` (public detail page — no auth required to browse catalog).
4. Visitor clicks "Sign In" in the header. System navigates to `/auth/signin`.
5. Visitor scrolls through the features grid and how-it-works sections, then clicks the final CTA banner. System navigates to `/signup`.

### 3.2 Alternate Flows

1. **Returning visitor with a session cookie:** Page renders identically to first visit. No personalization on the landing page (it is a marketing surface, not a product surface). The "Get Started" CTA changes to "Go to Home" if a valid session is detected client-side.
2. **Mobile visitor:** Trailer video is replaced with a static hero image (video is too expensive for mobile bandwidth). CTAs stack vertically (full-width primary, text-link secondary).
3. **Reduced motion preference:** Hero trailer does not auto-play. Fade-up animations are disabled. Header does not slide down on load.
4. **JavaScript disabled:** Static HTML renders correctly. Hero shows static image. Featured carousel shows first 4 cards in a scrollable container. CTAs still function as links.

### 3.3 Edge Cases

1. **Hero trailer fails to load:** System falls back to a static hero image (`/images/hero-fallback.jpg`). No broken video player shown. Error is logged to Sentry.
2. **Featured anime carousel API returns empty:** Section is hidden entirely. No empty state shown. Logged as a warning.
3. **Featured anime carousel API returns partial data (e.g., 2 of 12 items fail):** Render the successfully loaded items. If fewer than 4 items render, reduce the carousel to a single-row grid.
4. **Visitor navigates to a non-existent path from the landing page:** Next.js 404 page renders (defined in `apps/web/app/not.tsx`). No broken navigation.
5. **Visitor clicks a CTA while offline:** Link navigation fails. Browser shows standard offline page. No custom offline handling on the landing page.
6. **Visitor uses a screen reader:** All images have descriptive `alt` text. Hero video is `aria-hidden` (decorative). Heading hierarchy is H1 (hero headline) → H2 (section headings). Skip-to-content link is the first focusable element.
7. **Visitor with a very narrow viewport (320px):** Hero headline scales to 32px. CTAs are full-width. Featured carousel shows 1.2 cards (peek). All content remains readable and accessible.

## 4. Non-Functional Requirements

- **Performance:** LCP < 1.5s on 4G. FID < 50ms. CLS < 0.05. Lighthouse Performance score > 95.
- **Availability:** 99.99% (static generation — no server dependency at request time). CDN-cached globally.
- **Scalability:** Handles traffic spikes (e.g., social media viral post) with zero server load. Static pages scale infinitely via CDN.
- **Accessibility:** WCAG 2.2 AA. Skip-to-content link. Proper heading hierarchy. All CTAs are `<a>` or `<button>` with visible text. Reduced motion respected.
- **Localization:** Single-language (English) in M3. Strings are externalized for future i18n. No hardcoded user-facing text in component logic.
- **Security:** No forms, no user input, no API calls. CSP can be strict (no inline scripts). No cookies set on the landing page.

## 5. User Stories

- As a **visitor**, I want to understand what Nexus Anime is within seconds so that I can decide whether to explore further.
- As a **visitor**, I want to see examples of available anime so that I can judge catalog quality before signing up.
- As a **visitor**, I want to sign up or log in quickly so that I can start watching without friction.
- As a **mobile visitor**, I want the page to load fast and not consume excessive bandwidth so that I can browse on a limited data plan.
- As a **returning user**, I want to go directly to the app so that I do not see marketing content I have already converted past.

## 6. Acceptance Criteria

- [ ] Page is statically generated (SSG) — no `dynamic` functions, no server work at request time.
- [ ] Hero section displays headline, subheadline, and two CTAs ("Get Started" primary, "Browse" secondary).
- [ ] Hero background shows a muted, looping trailer video on desktop and a static image on mobile.
- [ ] Featured anime carousel shows 12 anime cards with horizontal scroll and snap points.
- [ ] Features grid shows 4 cards highlighting catalog, HD quality, personalization, and free entry.
- [ ] How-it-works section shows 3 steps (Sign up, Browse, Watch).
- [ ] Final CTA banner displays "Join Nexus Anime today" with a signup button.
- [ ] Footer includes links to Terms, Privacy, and Contact.
- [ ] "Get Started" CTA changes to "Go to Home" when a valid session cookie is detected client-side.
- [ ] LCP < 1.5s on simulated 4G in Lighthouse.
- [ ] Page passes `pnpm typecheck` with strict mode.
- [ ] All interactive elements are keyboard-accessible; focus ring visible.
- [ ] `prefers-reduced-motion` disables trailer autoplay and fade-up animations.
- [ ] JSON-LD `WebSite` schema with `SearchAction` is present in the `<head>`.
- [ ] OG tags include `og:title`, `og:description`, `og:image` (1200x630), `og:type: website`.

## 7. UI Components

| Component          | Responsibility                                                        | Reusable? | Package     |
| ------------------ | --------------------------------------------------------------------- | --------- | ----------- |
| `LandingShell`     | Page wrapper with glass header and section ordering                   | No        | `apps/web`  |
| `HeroSection`      | Full-viewport hero with background trailer/image and centered content | No        | `apps/web`  |
| `HeroBackground`   | Muted looping video (desktop) or static image (mobile)                | Yes       | `apps/web`  |
| `HeroContent`      | Headline + subheadline + CTAs                                         | Yes       | `apps/web`  |
| `FeaturedCarousel` | Horizontal snap-scroll carousel of anime cards                        | No        | `apps/web`  |
| `FeaturesGrid`     | 4-column grid of feature highlight cards                              | No        | `apps/web`  |
| `FeatureCard`      | Icon + title + description in a glass card                            | Yes       | `@nexus/ui` |
| `HowItWorks`       | 3-step numbered section with connecting line                          | No        | `apps/web`  |
| `StepCard`         | Numbered circle + title + description                                 | Yes       | `@nexus/ui` |
| `FinalCtaBanner`   | Full-width glass panel with CTA text and button                       | Yes       | `apps/web`  |
| `GlassHeader`      | Sticky header with blur-on-scroll transition                          | Yes       | `@nexus/ui` |
| `Footer`           | Links to Terms, Privacy, Contact                                      | Yes       | `@nexus/ui` |
| `LandingAnimeCard` | Compact anime card for the featured carousel                          | Yes       | `apps/web`  |

## 8. API Dependencies

| Endpoint | Method | Auth Required | Rate Limit | Cache |
| -------- | ------ | ------------- | ---------- | ----- |
| None     | —      | —             | —          | —     |

The landing page has **no API dependencies**. All content is either statically known at build time or fetched client-side from the public anime catalog API (which itself is ISR-cached). The page itself produces no API calls.

## 9. Database Dependencies

| Table / View | Operation | Index / Query Notes |
| ------------ | --------- | ------------------- |
| None         | —         | —                   |

The landing page has **no database dependencies**. It is a purely static page. Featured anime data is fetched client-side from the public `/api/anime/featured` endpoint (which is ISR-cached).

## 10. Edge Cases

1. **Hero trailer fails to load:** System falls back to a static hero image (`/images/hero-fallback.jpg`). No broken video player shown. Error is logged to Sentry. The page still renders correctly.
2. **Featured anime carousel API returns empty:** Section is hidden entirely. No empty state shown. Logged as a warning. Other sections (features, how-it-works, final CTA) render normally.
3. **Featured anime carousel API returns partial data (e.g., 2 of 12 items fail):** Render the successfully loaded items. If fewer than 4 items render, reduce the carousel to a single-row grid. Do not show broken image placeholders.
4. **Visitor navigates to a non-existent path from the landing page:** Next.js 404 page renders (defined in `apps/web/app/not.tsx`). No broken navigation. Footer and header remain functional on the 404 page.
5. **Visitor clicks a CTA while offline:** Link navigation fails. Browser shows standard offline page. No custom offline handling on the landing page (it is a marketing surface, not an app).
6. **Visitor uses a screen reader:** All images have descriptive `alt` text. Hero video is `aria-hidden` (decorative). Heading hierarchy is H1 (hero headline) → H2 (section headings). Skip-to-content link is the first focusable element. Carousel has `role="region"` and `aria-label="Featured anime"`.
7. **Visitor with a very narrow viewport (320px):** Hero headline scales to 32px. CTAs are full-width. Featured carousel shows 1.2 cards (peek). All content remains readable and accessible. No horizontal overflow.
8. **Returning user with a valid session:** Client-side `useSession()` detects the session. "Get Started" CTA text changes to "Go to Home" and the link points to `/` instead of `/signup`. The rest of the page renders identically.
9. **A/B test variant assigned:** If the visitor is in an A/B test cohort (assigned via a `cta_variant` cookie set by middleware), the hero CTA text, color, or destination may differ. The variant is determined at the edge and does not cause a client-side layout shift.

## 11. Error Handling

| Error Condition                | User-Facing Message     | Recovery Action                | Log Level |
| ------------------------------ | ----------------------- | ------------------------------ | --------- |
| Hero trailer load failure      | Static hero image shown | Silent fallback                | warn      |
| Featured carousel API failure  | Section hidden          | Other sections render          | warn      |
| Featured carousel partial data | Render available items  | Reduce to grid if < 4 items    | info      |
| JavaScript disabled            | Static HTML renders     | Native scroll, link-based CTAs | —         |
| Invalid CTA deep link          | 404 page                | Standard Next.js 404           | —         |

## 12. Analytics Events

| Event Name                    | Trigger                              | Properties               | Surface                    |
| ----------------------------- | ------------------------------------ | ------------------------ | -------------------------- | -------------- | ------------- | ------ |
| `landing_page_view`           | Page loads                           | `{ source: 'direct'      | 'search'                   | 'social'       | 'referral' }` | Client |
| `landing_hero_cta_click`      | User clicks hero CTA                 | `{ cta_type: 'primary'   | 'secondary', variant?: 'A' | 'B' }`         | Client        |
| `landing_header_cta_click`    | User clicks header CTA               | `{ cta_type: 'signup'    | 'signin'                   | 'home' }`      | Client        |
| `landing_featured_card_click` | User clicks featured anime card      | `{ anime_id, position }` | Client                     |
| `landing_featured_scroll`     | User scrolls featured carousel       | `{ direction: 'left'     | 'right', card_count }`     | Client         |
| `landing_how_it_works_view`   | How-it-works section enters viewport | `{ — }`                  | Client                     |
| `landing_final_cta_click`     | User clicks final CTA banner         | `{ — }`                  | Client                     |
| `landing_footer_link_click`   | User clicks footer link              | `{ link_type: 'terms'    | 'privacy'                  | 'contact' }`   | Client        |
| `landing_signup_redirect`     | User redirected to signup            | `{ source: 'hero'        | 'header'                   | 'final_cta' }` | Client        |

## 13. Security Considerations

- **No forms or user input:** The landing page does not accept any user input, eliminating injection vectors.
- **Strict CSP:** No inline scripts, no `eval`, no third-party scripts (except analytics with `nonce`). The page can enforce a strict CSP policy.
- **No cookies set:** The landing page does not set any cookies. Existing session cookies are read-only (for CTA variant detection).
- **No sensitive data exposure:** The page is entirely public. No API keys, no internal URLs, no user data.
- **External links use `rel="noopener noreferrer"`:** Any links opening in a new tab (Terms, Privacy) include these attributes to prevent reverse tabnapping.
- **Analytics tracking is privacy-respecting:** No fingerprinting, no cross-site tracking. Analytics events are first-party and anonymized.

## 14. Performance Requirements

- **LCP:** < 1.5s on simulated 4G. Hero image loads eagerly (not lazy). Preconnect to CDN and image source.
- **FID:** < 50ms (no JavaScript execution blocking the main thread during initial load).
- **CLS:** < 0.05 (all images have `width` and `height` attributes; skeleton states match final dimensions).
- **TTFB:** < 200ms (static generation — CDN edge cache serves the response).
- **Rendering strategy:** Static generation (SSG). The page is built at deploy time and served from the CDN. No server work at request time.
- **Bundle-size budget:** Landing page client JS < 40kB gzipped (header scroll logic, carousel, analytics).
- **Image optimization:** Hero image uses `next/image` with `priority` prop. Featured carousel images use `next/image` with `loading="lazy"` and `sizes` attribute.
- **Preconnect:** `<link rel="preconnect">` to CDN domain and image source domain in `<head>`.

## 15. Future Improvements

1. **A/B testable CTA variants** — Allow product managers to swap hero CTA text, color, and destination via a CMS or config, without code deploys.
2. **Personalized landing for returning visitors** — Detect returning users via cookie and show a different hero (e.g., "Welcome back — pick up where you left off").
3. **Animated Nova logo in hero** — Subtle SVG animation in the hero section to reinforce brand identity.
4. **Live counter** — "Join 50,000+ anime fans" with a real-time user count (fetched from a lightweight API endpoint).
5. **Localized landing pages** — Serve translated landing pages based on `Accept-Language` header or geo data.
6. **Video testimonials** — Embedded short video clips from beta users (future — requires consent and moderation).
7. **Interactive catalog preview** — Allow anonymous visitors to browse a limited catalog preview directly from the landing page (no signup required to browse).
