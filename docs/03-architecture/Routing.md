# Routing — Nexus Anime

> **Audience:** Engineers implementing pages, layouts, and middleware. This document defines the route structure, route groups, middleware behavior, and navigation patterns.

---

## 1. Route Architecture

Next.js App Router uses **file-system-based routing**. The route structure mirrors the product's surface area and auth requirements.

```
app/
├── layout.tsx                        # Root layout — providers, fonts, global metadata
├── not-found.tsx                     # Global 404
├── error.tsx                         # Global error boundary
├── sitemap.ts                        # Auto-generated sitemap
├── robots.ts                         # Robots.txt generation
│
├── (public)/                         # Route Group: public pages (no auth)
│   ├── layout.tsx                    # Public shell — Navbar + Footer
│   │
│   ├── (catalog)/                    # Sub-group: catalog pages (ISR)
│   │   ├── layout.tsx                # Catalog layout — search bar, genre nav
│   │   ├── loading.tsx               # Catalog skeleton (streaming)
│   │   ├── page.tsx                  # / — Home/Browse (trending + genres)
│   │   ├── [id]/
│   │   │   ├── page.tsx             # /:id — Anime detail
│   │   │   ├── loading.tsx          # Detail skeleton
│   │   │   └── error.tsx            # Anime-specific error boundary
│   │   ├── search/
│   │   │   └── page.tsx            # /search — Search results
│   │   └── season/
│   │       └── [seasonId]/
│   │           └── page.tsx         # /season/:id — Season page
│   │
│   └── (marketing)/                  # Sub-group: marketing pages (static)
│       ├── pricing/
│       │   └── page.tsx             # /pricing — Plan comparison
│       ├── about/
│       │   └── page.tsx             # /about — Platform info
│       └── terms/
│           └── page.tsx             # /terms — Terms of service
│
├── (authenticated)/                  # Route Group: logged-in pages
│   ├── layout.tsx                    # Auth shell — Sidebar + session guard
│   │
│   ├── watchlist/
│   │   └── page.tsx                 # /watchlist — User's watchlist
│   ├── profile/
│   │   └── page.tsx                 # /profile — User profile
│   ├── settings/
│   │   └── page.tsx                 # /settings — Account settings
│   └── continue-watching/
│       └── page.tsx                 # /continue-watching — Resume viewing
│
├── (auth)/                           # Route Group: auth pages (no app shell)
│   ├── layout.tsx                    # Minimal layout — centered card
│   ├── login/
│   │   └── page.tsx                 # /login
│   ├── signup/
│   │   └── page.tsx                 # /signup
│   └── verify/
│       └── [token]/
│           └── page.tsx             # /verify/:token — Email verification
│
├── api/                              # Route Handlers (not pages)
│   ├── stripe/
│   │   └── webhook/
│   │       └── route.ts             # POST /api/stripe/webhook
│   ├── stream/
│   │   └── webhook/
│   │       └── route.ts             # POST /api/stream/webhook
│   └── health/
│       └── route.ts                 # GET /api/health — Liveness probe
│
└── dev/                              # Dev-only (stripped in production)
    └── components/
        └── page.tsx                 # /dev/components — Design showcase
```

---

## 2. Route Groups Explained

### (public) — No authentication required

Pages accessible to any visitor. Layout includes the marketing navbar and footer. Catalog sub-pages use ISR because anime metadata changes on a known cadence (new episodes weekly, new seasons quarterly).

### (authenticated) — Session required

Middleware redirects unauthenticated users to `/login?callbackUrl=<current>`. Layout includes the authenticated shell (sidebar navigation, user avatar). All pages in this group read the session via `auth()` on the server.

### (auth) — Authentication pages

No app shell (navbar/sidebar). Minimal centered-card layout. These pages must not have session-dependent chrome — they are the gateway *to* a session.

### Why Route Groups over middleware-only

Middleware can redirect unauthenticated users, but it cannot switch layouts. Route Groups give us both: middleware enforces the auth guard, and the layout provides the correct shell. Without groups, every page would need to conditionally render the navbar vs. sidebar, which is brittle.

---

## 3. Middleware

File: `apps/web/src/lib/middleware.ts`

Middleware runs on the Edge (Vercel Edge Functions / Cloudflare). It is **kept thin** — no database calls, no heavy computation.

### Responsibilities

| Responsibility | Implementation |
|----------------|---------------|
| Auth redirect | Check session cookie. Redirect `(authenticated)` routes to `/login` if unauthenticated. |
| Callback URL injection | Set `callbackUrl` search param so post-login redirects back. |
| Security headers | Append `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. |
| CSP header | Dynamic CSP with nonce for inline scripts (if needed). |
| Geo header | Inject `x-geo-country` from `request.geo` for region-based content. |

### What middleware must NOT do

- Database queries — Edge runtime does not have Node.js APIs for Drizzle/Neon.
- Redis calls — Too slow for Edge middleware (latency budget is ~50ms).
- Complex routing logic — Keep redirects simple and predictable.

### Why thin middleware

Edge middleware runs on every request. Adding database/Redis calls would add 20–100ms latency to every page load. Latency-sensitive operations belong in Server Components or Route Handlers, which run in the Node.js runtime and are only invoked for the specific page being rendered.

---

## 4. Dynamic Routes

### [id] — Anime detail

- **Route:** `/[id]` where `id` is the anime UUID or slug.
- **`generateStaticParams`**: Pre-render top 100 most popular anime at build time (ISR).
- **`generateMetadata`**: Dynamic OG title/description/image from anime metadata.
- **`revalidate`**: 3600 (1 hour) — anime metadata changes infrequently.

### [seasonId] — Season page

- **Route:** `/season/[seasonId]` where `seasonId` is the season UUID.
- **`revalidate`**: 86400 (24 hours) — season rosters are stable.

### [token] — Email verification

- **Route:** `/verify/[token]` where `token` is the verification token.
- **Rendering:** SSR (no cache — token is single-use).

### Why ISR for catalog, SSR for auth

Catalog pages (anime detail, season) get high traffic and the data changes on a known cadence. ISR gives the performance of static pages with the freshness of periodic regeneration. Auth-related pages (verification, profile) are user-specific and must never be cached between users — SSR is correct.

---

## 5. Parallel Routes & Intercepting Routes

### Use cases (future, post-M3)

| Feature | Mechanism | Purpose |
|---------|-----------|---------|
| Episode detail modal | Intercepting route `@modal/(.)[id]/[episodeId]` | Open episode details in a modal instead of a full page. Direct URL access renders the full page. |
| Photo gallery | Parallel route `@gallery` | Render a photo gallery in a slot alongside the main content, independently loading and error-handling. |

### Why defer

These are UX polish features. The architecture supports them (Next.js App Router handles them natively), but they are not needed for M3 (auth) or M4 (personalization). Implementing them now adds complexity without user value.

---

## 6. Navigation Patterns

### Client navigation

Next.js `<Link>` for internal navigation. Prefetching enabled by default for visible links (viewport detection).

### Programmatic navigation

- After login: `router.push(callbackUrl || "/")` — redirect to intended destination.
- After logout: `router.push("/login")` — clear session, go to login.
- After mutation: `router.refresh()` — revalidate Server Component data.

### Active link detection

`usePathname()` in the sidebar to highlight the current page. This is a client concern (the sidebar is a Client Component for mobile toggle).

### Why Next.js Link over custom navigation

`<Link>` prefetches route segments in the background, giving instant navigation. A custom `<a>` or `router.push` without prefetch creates visible loading states on every click. The only exception is links to dynamic routes with high cardinality (e.g., every anime in a 10,000-item grid) — these use `<Link>` with `prefetch={false}` to avoid prefetching an unbounded number of pages.

---

## 7. Redirects & Rewrites

Defined in `next.config.ts`:

| Pattern | Target | Type | Reason |
|---------|--------|------|--------|
| `/anime/:id` | `/:id` | Redirect (301) | Legacy URL: old `/anime/123` → new `/123` |
| `/show/:id` | `/:id` | Redirect (301) | Legacy URL: "show" → "anime" |

### Why in next.config.ts, not middleware

Static redirects defined at build time are faster than middleware-based redirects (no function invocation). Middleware is reserved for dynamic logic (session checks, geo-based routing).

---

## 8. API Route Handlers

API routes exist for **machines**, not browsers. They handle webhooks, health checks, and future mobile API access.

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/stripe/webhook` | POST | Stripe event delivery | Stripe signature verification |
| `/api/stream/webhook` | POST | Cloudflare Stream events | Stream signature verification |
| `/api/health` | GET | Liveness/readiness probe | None (internal) |

### Why Route Handlers over Server Actions for webhooks

Server Actions are form submissions — they require a Next.js client and a CSRF-protectable context. Webhooks come from external services (Stripe, Cloudflare) that post raw JSON with signature verification. Route Handlers are the correct primitive for HTTP-level integrations.

---

## 9. Loading States per Route

| Route | Strategy | `loading.tsx` |
|-------|----------|---------------|
| `/` (home) | Streaming + ISR | Trending skeleton + genre grid skeleton |
| `/[id]` (detail) | Streaming + ISR | Hero skeleton + episode list skeleton |
| `/search` | Streaming (SSR) | Search result grid skeleton |
| `/watchlist` | SSR + React Query | Watchlist grid skeleton |
| `/profile` | SSR | Profile header skeleton |
| `/login`, `/signup` | Static | None (instant) |
| `/pricing` | Static | None (instant) |

### Why skeletons, not spinners

Skeletons match the layout of the content that will appear, reducing layout shift (CLS) and giving the user a preview of what's loading. Spinners are generic and provide no shape information. For a premium cinematic UI, skeletons are the expected pattern — they maintain visual continuity during streaming.
