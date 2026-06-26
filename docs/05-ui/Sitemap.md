# Sitemap — Nexus Anime

> **Audience:** Engineers implementing routes, SEO specialists, product managers. This document is the canonical route tree — every URL on the platform, its access control, rendering strategy, and parent-child relationships.

---

## 1. Route Tree

```
/                                           Home (marketing if anon, feed if auth)
├── /trending                                Trending rankings
├── /popular                                All-time popular
├── /latest                                 Latest releases
├── /genres                                 Genre index
│   └── /genres/:slug                        Genre detail (filtered catalog)
├── /schedule                               Weekly release schedule
│   └── /schedule/:day                       Schedule for a specific day (today, mon, tue...)
├── /search                                 Search results (query: q)
│
├── /anime/:slug                            Anime detail
│   ├── /anime/:slug/season/:number          Season detail
│   └── /anime/:slug/episode/:number         Episode player
│
├── /watchlist                              User's watchlist
├── /continue-watching                      Resume in-progress episodes
├── /history                                Watch history
│
├── /profile                                User profile
├── /settings                               Settings index → /settings/account
│   ├── /settings/account                   Account settings
│   ├── /settings/billing                   Billing & subscription
│   ├── /settings/notifications             Notification preferences
│   └── /settings/accessibility             Accessibility settings
├── /notifications                          Notification center
│
├── /login                                  Sign in
├── /signup                                 Sign up
├── /verify/email                           "Check your email" interstitial
├── /verify/:token                          Email verification handler
├── /forgot-password                        Forgot password
├── /reset-password/:token                  Reset password handler
│
├── /pricing                                Pricing / plans
├── /about                                  About platform
├── /terms                                  Terms of service
├── /privacy                                Privacy policy
│
├── /api
│   ├── /api/stripe/webhook                 Stripe webhook
│   ├── /api/stream/webhook                 Cloudflare Stream webhook
│   └── /api/health                         Health probe
│
└── /dev/components                        Design showcase (dev only)
```

---

## 2. Route Metadata

| Route | Group | Auth | Rendering | ISR revalidate |
|-------|-------|------|-----------|----------------|
| `/` | public | Optional | ISR (anon) / SSR (auth) | 300s (anon) |
| `/trending` | public | No | ISR | 300s |
| `/popular` | public | No | ISR | 300s |
| `/latest` | public | No | ISR | 900s |
| `/genres` | public | No | ISR | 86400s |
| `/genres/:slug` | public | No | ISR | 3600s |
| `/schedule` | public | No | ISR | 3600s |
| `/schedule/:day` | public | No | ISR | 3600s |
| `/search` | public | No | SSR | — |
| `/anime/:slug` | public | No | ISR | 3600s |
| `/anime/:slug/season/:n` | public | No | ISR | 86400s |
| `/anime/:slug/episode/:n` | public | No | SSR (signed URL) | — |
| `/watchlist` | authenticated | Yes | SSR | — |
| `/continue-watching` | authenticated | Yes | SSR | — |
| `/history` | authenticated | Yes | SSR | — |
| `/profile` | authenticated | Yes | SSR | — |
| `/settings` | authenticated | Yes | SSR | — |
| `/settings/account` | authenticated | Yes | SSR | — |
| `/settings/billing` | authenticated | Yes | SSR | — |
| `/settings/notifications` | authenticated | Yes | SSR | — |
| `/settings/accessibility` | authenticated | Yes | SSR | — |
| `/notifications` | authenticated | Yes | SSR | — |
| `/login` | auth | No (redirect if auth) | SSG | — |
| `/signup` | auth | No (redirect if auth) | SSG | — |
| `/verify/email` | auth | No | SSG | — |
| `/verify/:token` | auth | No | SSR | — |
| `/forgot-password` | auth | No | SSG | — |
| `/reset-password/:token` | auth | No | SSR | — |
| `/pricing` | public | No | SSG | — |
| `/about` | public | No | SSG | — |
| `/terms` | public | No | SSG | — |
| `/privacy` | public | No | SSG | — |
| `/api/stripe/webhook` | — | Signature | Edge | — |
| `/api/stream/webhook` | — | Signature | Edge | — |
| `/api/health` | — | None | Edge | — |
| `/dev/components` | — | Dev only | SSG | — |

---

## 3. Route Groups

### (public) — No auth required

Layout: Global header + footer. All marketing and catalog pages.

### (authenticated) — Session required

Layout: Sidebar + header (with user menu). All personal pages. Middleware redirects to `/login?callbackUrl=<current>` if no session.

### (auth) — Auth pages (no app shell)

Layout: Minimal centered card. No header, no sidebar, no footer. Logo links to `/`. If user is already authenticated, middleware redirects to `/`.

### (marketing) — Marketing pages (subset of public)

Layout: Global header + footer. Static content. No personalized data.

---

## 4. Dynamic Route Parameters

| Param | Type | Validation | Example |
|-------|------|------------|---------|
| `:slug` | string | Slug regex `[a-z0-9]+(?:-[a-z0-9]+)*` | `attack-on-titan` |
| `:number` | integer | Positive integer 1–999 | `1`, `2`, `12` |
| `:token` | string | UUID v4 or opaque token | `a1b2c3d4-...` |
| `:day` | string | Enum: `today`, `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun` | `mon` |
| `:slug` (genre) | string | Slug regex | `action`, `fantasy` |

---

## 5. Redirects

| From | To | Type | Condition |
|------|----|------|-----------|
| `/anime/:id` | `/:id` | 301 | Legacy URL |
| `/show/:id` | `/:id` | 301 | Legacy URL |
| `/home` | `/` | 301 | Canonical |
| `/verify` | `/verify/email` | 301 | Canonical |
| `/settings` | `/settings/account` | 301 | Default settings tab |

---

## 6. Canonical URLs

Every page has exactly **one canonical URL**. Query strings do not create duplicate content.

| Page | Canonical URL | Query params |
|------|---------------|--------------|
| Search | `/search` | `q` is the only allowed param; ignored by crawlers via `robots` noindex |
| Genre detail | `/genres/:slug` | None |
| Anime detail | `/anime/:slug` | None |
| Episode | `/anime/:slug/episode/:n` | None |
| Schedule | `/schedule` | `day` is a path param, not query |

Search and schedule-with-day are `noindex` to prevent query-param duplication.

---

## 7. Access Control Matrix

| Role | Public | Authenticated | Auth pages | Marketing | API |
|------|--------|--------------|------------|-----------|-----|
| Anonymous | ✅ | → /login | ✅ (redirect if session) | ✅ | ❌ |
| Authenticated | ✅ | ✅ | → / (redirect) | ✅ | ❌ |
| Admin (future) | ✅ | ✅ | → / | ✅ | ✅ (limited) |

---

## 8. Future Routes (post-v1)

| Route | Purpose | Target milestone |
|-------|---------|------------------|
| `/user/:username` | Public user profiles | M5 |
| `/collection/:slug` | Curated editorial collections | M5 |
| `/watch/:slug` | Party watch (synchronized playback) | M6 |
| `/support` | Help center | M4 |
| `/support/:article` | Help article | M4 |
| `/status` | System status page | M4 |
| `/api/v1/*` | Public REST API (mobile) | M7 |
