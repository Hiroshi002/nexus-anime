# Landing Page — Nexus Anime

> **Audience:** Engineers implementing the marketing landing, SEO specialists. This spec defines the anonymous landing experience.

---

## 1. Purpose

Convert anonymous visitors into registered users with a cinematic, marketing-driven hero that communicates the platform's value proposition in under 5 seconds.

## 2. User Goals

- Understand what Nexus Anime is
- See what kind of content is available
- Decide whether to sign up
- Sign up or log in quickly

## 3. Entry Points

- Typed URL `nexusanime.com`
- Search engine result
- Social media link
- Referral from friend
- Ad click

## 4. Layout Structure

```
┌──────────────────────────────────────────────────────────────┐
│  LOGO          [Browse] [Sign In]  [Sign Up]  [Theme]       │  ← Sticky glass header
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                    HERO (full viewport)                      │
│                    Background: muted autoplay trailer         │
│                    Headline + Subheadline                     │
│                    CTA: Get Started  |  Browse                │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  FEATURED ANIME CAROUSEL  ◀ ▶                                │
├──────────────────────────────────────────────────────────────┤
│  FEATURES GRID (3-4 cards)                                   │
│  Massive catalog | HD quality | Personalized | Free to start  │
├──────────────────────────────────────────────────────────────┤
│  HOW IT WORKS (3 steps)                                      │
│  Sign up → Browse → Watch                                     │
├──────────────────────────────────────────────────────────────┤
│  TESTIMONIALS / SOCIAL PROOF (future)                        │
├──────────────────────────────────────────────────────────────┤
│  FINAL CTA BANNER                                            │
│  "Join Nexus Anime today" | Sign up                          │
├──────────────────────────────────────────────────────────────┤
│  FOOTER                                                      │
└──────────────────────────────────────────────────────────────┘
```

## 5. Component Hierarchy

- `LandingShell` (public layout with glass header)
  - `HeroSection`
    - `HeroBackground` (video element, muted, autoplay, loop)
    - `HeroContent` (headline, subheadline, CTAs)
  - `FeaturedCarousel` (`AnimeCard` x 12, horizontal scroll)
  - `FeaturesGrid` (4 feature cards)
  - `HowItWorks` (3 step cards)
  - `Testimonials` (future — placeholder silent)
  - `FinalCtaBanner`
  - `Footer`

## 6. Desktop Layout (≥1024px)

- Hero section: full viewport height, centered content, trailer background at `opacity-30` with `overlay-gradient` from `surface-base` to `void-1`.
- Headline: Space Grotesk 56px weight-700, `text-primary`.
- Subheadline: Inter 20px weight-400, `text-secondary`.
- CTAs side-by-side, 48px height, 24px horizontal padding.
- Featured carousel: 4 visible cards, horizontal scroll with snap, fade edges.
- Features grid: 4 columns.
- How it works: 3 columns with numbered circles.
- Final CTA banner: full-width, glass panel, 120px height.

## 7. Tablet Layout (768–1023px)

- Hero: same, headline shrinks to 40px.
- Featured carousel: 3 visible cards.
- Features grid: 2 columns.
- How it works: still 3 columns (numbers smaller).

## 8. Mobile Layout (<768px)

- Trailer replaced with static hero image (video too expensive for mobile).
- Hero: stacked CTAs (full-width primary, text-link secondary).
- Featured carousel: 1.5 visible cards (peek).
- Features grid: 1 column stacked.
- How it works: 1 column stacked with vertical line connector.
- Final CTA: stack headline + CTA button vertically.
- Header: logo only, hamburger top-right. "Sign up" as text link in drawer.

## 9. Navigation Behavior

- Global header is sticky glass. On scroll, gains bottom border.
- "Browse" links to `/trending`.
- "Sign In" links to `/login`.
- "Sign Up" primary CTA links to `/signup`.
- Theme toggle cycles system/light/dark (only dark theme implemented v1 — toggle no-op).

## 10. Scroll Behavior

- Hero: fixed background, content scrolls over.
- Featured carousel: horizontal snap scroll, not drag.
- Page: smooth scroll, no parallax on v1.
- Sticky header with `backdrop-blur` transition at 50px scroll threshold.

## 11. Motion & Animation

- Hero headline: fade-up 600ms spring, stagger 100ms per line.
- Hero CTAs: fade-up 600ms spring, stagger 200ms.
- Featured carousel: cards fade-in on scroll (IntersectionObserver, 100ms stagger).
- Header: slide-down 200ms on page load.
- Hover on cards: scale 1.02 + shadow elevation increase, 200ms spring.
- Background trailer: no animation (continuous muted autoplay).

## 12. Loading Experience

- Page is SSG — no skeleton.
- Hero image loads eagerly (LCP candidate).
- Trailer loads asynchronously after first paint.
- Featured carousel: skeleton grid of 4 placeholder cards until data loads.
- Below-fold sections: lazy-load on intersection.

## 13. Empty States

- Featured carousel: if no featured anime, hide section entirely (not an empty state).
- Testimonials: section not rendered in v1.

## 14. Error Handling

- If hero trailer fails to load: fallback to static hero image.
- If featured carousel fails: log to Sentry, render empty section.
- Root error boundary catches any unhandled error.

## 15. SEO Metadata Requirements

- Title: `Nexus Anime — Stream Premium Anime`
- Description: `Stream the best anime in HD. Massive catalog, personalized recommendations, free to start.`
- OG image: `/og/landing.jpg` (1200x630).
- OG type: `website`.
- Twitter card: `summary_large_image`.
- Canonical: `https://nexusanime.com/`.
- Robots: `index, follow`.
- JSON-LD: `WebSite` schema with `SearchAction` (sitelinks search).

## 16. Accessibility Requirements

- Skip-to-content link as first focusable element.
- Hero video has no audio — no audio control needed.
- All CTAs are `<button>` or `<a>` with visible text.
- Carousel has `role="region"`, `aria-label="Featured anime"`, arrow buttons have `aria-label="Previous"` / `"aria-label="Next"`.
- Heading hierarchy: H1 (hero headline), H2 (section headings).
- Reduced motion: disable trailer autoplay, disable fade-up animations.

## 17. Future Enhancements

- Personalized landing for returning visitors (detect cookie).
- Animated Nova logo in hero.
- Live counter ("Join 50,000+ anime fans").
- Localized landing pages.
- Video testimonials.
