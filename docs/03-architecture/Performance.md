# Performance — Nexus Anime

> **Audience:** Engineers optimizing renders, queries, and asset delivery. This document defines performance targets, optimization strategies, and measurement approach.

---

## 1. Performance Targets

### Core Web Vitals (production)

| Metric                              | Target  | Threshold      | What it measures                               |
| ----------------------------------- | ------- | -------------- | ---------------------------------------------- |
| **LCP** (Largest Contentful Paint)  | < 1.0s  | < 2.5s (good)  | Perceived load speed — largest visible content |
| **INP** (Interaction to Next Paint) | < 150ms | < 200ms (good) | Responsiveness to user interactions            |
| **CLS** (Cumulative Layout Shift)   | < 0.05  | < 0.1 (good)   | Visual stability during load                   |

### Server-side targets

| Metric                    | Target                               | Why                                         |
| ------------------------- | ------------------------------------ | ------------------------------------------- |
| TTFB (Time to First Byte) | < 200ms (cached), < 500ms (uncached) | Streaming starts fast; ISR serves from edge |
| DB query p95              | < 50ms                               | Neon serverless + connection pooling        |
| Redis cache p95           | < 5ms                                | Upstash REST API (no TCP overhead)          |
| TMDB/AniList p95          | < 500ms                              | External network + their API latency        |

### Why these targets

These are the industry "good" thresholds from web.dev, tightened by ~20% for a premium product. A streaming platform with a "cinematic" brand promise must feel faster than average. The targets are achievable with ISR + Edge caching on Vercel Pro.

---

## 2. Rendering Performance

### ISR for catalog pages (highest traffic)

Catalog pages (home, anime detail, season) are pre-rendered and served from Vercel's Edge Network. Cache hits serve in < 50ms TTFB worldwide. Background revalidation keeps data fresh without adding latency to user requests.

**Why this matters:** 80%+ of traffic hits catalog pages. ISR eliminates server render time for the majority of requests.

### Streaming for slow data sections

Not all data on a page has the same latency. Anime hero (from Redis cache) loads in < 10ms. Reviews (from AniList API) may take 500ms. Streaming sends the hero immediately and streams reviews when ready.

```tsx
<Suspense fallback={<HeroSkeleton />}>
  <AnimeHero />         {/* Fast — from Redis cache */}
</Suspense>
<Suspense fallback={<ReviewsSkeleton />}>
  <ReviewList />        {/* Slow — from AniList API */}
</Suspense>
```

**Why this matters:** Without streaming, the entire page waits for the slowest section. Streaming reduces Time to Interactive (TTI) by decoupling fast and slow sections.

### Client islands for heavy JS

The video player (~200KB), Stripe checkout (~80KB), and comment editor (~50KB) are dynamically imported with `ssr: false`. They are not in the initial page bundle.

```ts
const VideoPlayer = dynamic(() => import("./PlayerIsland"), {
  ssr: false,
  loading: () => <PlayerSkeleton />,
});
```

**Why this matters:** Most users browse catalog pages without playing video. Including HLS.js in every page bundle would add 200KB to every request. Dynamic import loads it only when needed.

---

## 3. Data Fetching Performance

### React.cache() dedup

Avoids N+1 fetches when multiple components request the same data during a single server render.

### Cursor-based pagination

Infinite scroll on browse/search pages uses cursor-based pagination, not offset-based:

```ts
// ✅ Cursor — stable regardless of inserts/deletes
getAnimeList({ cursor: "anime-uuid-123", limit: 20 });

// ❌ Offset — shifts when new anime are inserted above the current page
getAnimeList({ offset: 40, limit: 20 });
```

**Why cursor over offset:** Offset pagination produces duplicate or missing items when data changes between page loads (a new anime inserted at position 10 shifts everything below it). Cursor pagination is stable — it fetches items after a specific ID, regardless of inserts above it.

### Select only needed columns

Repository queries specify exact columns, not `SELECT *`:

```ts
// ✅ Only what the card needs
constanime = await db
  .select({ id: anime.id, title: anime.title, coverUrl: anime.coverUrl, rating: anime.rating })
  .from(animeTable)
  .where(eq(animeTable.id, id));

// ❌ Everything (including synopsis, episodes, cast — unused on the card)
const anime = await db.select().from(animeTable).where(eq(animeTable.id, id));
```

### Database connection pooling

Neon serverless provides HTTP-based connection pooling. Each serverless function gets a pooled connection, not a dedicated TCP connection. This eliminates connection exhaustion under load.

---

## 4. Asset Performance

### Image optimization

All images via `next/image` with the R2 loader. Next.js generates srcset variants at request time (on-demand optimization) and caches them on the CDN.

| Optimization     | How                                                                        |
| ---------------- | -------------------------------------------------------------------------- |
| Format selection | WebP for browsers that support it, AVIF for modern browsers, JPEG fallback |
| Responsive sizes | `srcset` with 1x, 2x, 3x variants based on `sizes` prop                    |
| Quality tuning   | 75 for thumbnails (small size), 80 for hero images (better quality)        |
| Lazy loading     | `loading="lazy"` for below-the-fold images (automatic in Next.js)          |
| Priority loading | `priority` prop for LCP images (preloads in `<head>`)                      |

### Font optimization

Self-hosted fonts in `public/fonts/` with `next/font`:

```ts
const inter = localFont({
  src: "./fonts/Inter-Variable.woff2",
  display: "swap", // Prevents FOIT (Flash of Invisible Text)
  preload: true, // Preloads in <link>
  fallback: ["system-ui"], // Fallback while font loads
});
```

**Why self-hosted over Google Fonts:** Eliminates a third-party DNS lookup and TCP connection. Self-hosted fonts load from the same CDN as the app, reducing latency by 100–300ms.

### CSS performance

Tailwind v4 generates only the CSS used in the application (dead code elimination). No unused utility classes ship to production. The CSS bundle for a catalog page should be < 30KB gzipped.

---

## 5. JavaScript Bundle Performance

### Target budgets

| Route         | JS budget (gzipped)             | Why                                          |
| ------------- | ------------------------------- | -------------------------------------------- |
| Home (browse) | < 80KB                          | Mostly Server Components — minimal client JS |
| Anime detail  | < 100KB                         | Interactive watchlist toggle + episode list  |
| Watchlist     | < 60KB                          | Grid + React Query                           |
| Player        | < 50KB (initial) + 200KB (lazy) | Shell loads fast; player streams in          |
| Checkout      | < 50KB (initial) + 80KB (lazy)  | Stripe Elements lazy-loaded                  |

### Tree-shaking enforcement

- `@nexus/ui` uses barrel exports (index.ts) — tree-shakeable by default.
- No side-effectful imports (`import "some-css"` without using exports).
- `sideEffects: false` in `@nexus/ui` package.json.

### Code splitting

Next.js App Router automatically code-splits by route. Additional splits:

- `next/dynamic` for heavy client islands (player, Stripe).
- React.lazy for conditionally rendered sections.

---

## 6. Caching for Performance

See [Caching-Strategy.md](Caching-Strategy.md) for full details. Key performance-impacting caches:

| Cache               | Hit rate target         | Impact                        |
| ------------------- | ----------------------- | ----------------------------- |
| Vercel Edge (ISR)   | > 95% for catalog pages | Serves cached HTML in < 50ms  |
| Redis               | > 80% for anime detail  | Avoids DB query + TMDB call   |
| Next.js fetch cache | > 90% for TMDB/AniList  | Avoids external API call      |
| Browser cache       | Varies                  | Eliminates network round-trip |

---

## 7. Network Performance

### Preconnect hints

```html
<link rel="preconnect" href="https://cdn.nexus-anime.com" />
<!-- R2 images -->
<link rel="preconnect" href="https://api.tmdb.org" />
<!-- TMDB (server-only, not in client) -->
```

**Why preconnect:** Eliminates DNS + TCP + TLS handshake for known origins. Saves 100–300ms on the first request to each origin.

### Compression

All responses are Brotli-compressed by Vercel's Edge Network (automatic). Brotli is 15–20% smaller than gzip for text assets.

### Streaming responses

Next.js streams HTML by default in App Router. The browser starts parsing and rendering before the full response is received. This reduces FCP by 30–50% compared to buffered responses.

---

## 8. Measurement & Monitoring

### Development

| Tool                            | When                   | What it measures                                     |
| ------------------------------- | ---------------------- | ---------------------------------------------------- |
| Chrome DevTools Performance tab | During development     | Component render time, layout shifts, long tasks     |
| React DevTools Profiler         | Component optimization | Unnecessary re-renders, render duration              |
| `next build` output             | Before deploy          | Bundle sizes per route, code splitting effectiveness |

### CI/CD

| Check         | When              | Threshold                                           |
| ------------- | ----------------- | --------------------------------------------------- |
| Bundle size   | On PR             | New route adds < 10KB gzipped (flagged if exceeded) |
| Lighthouse CI | On deploy preview | LCP < 2.5s, CLS < 0.1, INP < 200ms                  |

### Production

| Tool                  | What                                               | Alert                             |
| --------------------- | -------------------------------------------------- | --------------------------------- |
| Vercel Analytics      | Real User Monitoring (RUM) — CWV from actual users | p75 LCP > 2.5s for 10 min → alert |
| Vercel Speed Insights | Per-route performance breakdown                    | Route regression detection        |
| Custom pino metrics   | DB query p95, Redis p95, upstream p95              | p95 > threshold for 5 min → alert |

### Why measure in production, not just lab

Lab data (Lighthouse) is synthetic and doesn't reflect real user conditions (slow networks, low-end devices, third-party scripts). Vercel Analytics captures CWV from actual user sessions, which is the ground truth for performance.

---

## 9. Performance Anti-Patterns to Avoid

| Anti-pattern                             | Why it's bad                                     | Correct approach                           |
| ---------------------------------------- | ------------------------------------------------ | ------------------------------------------ |
| `useState` + `useEffect` fetch           | Waterfall: render → effect → fetch → render      | Server Component fetch or React Query      |
| Blocking the page on one slow section    | User sees nothing until slowest section resolves | `<Suspense>` with streaming                |
| `SELECT *` from DB                       | Transfers unused columns, increases latency      | Select only needed columns                 |
| Images without `width`/`height`          | Layout shift (CLS) when image loads              | Always set explicit dimensions             |
| Heavy client component in initial bundle | Increases JS parse time for all pages            | `next/dynamic` with `ssr: false`           |
| Synchronous font loading                 | FOIT — text invisible until font loads           | `font-display: swap`                       |
| No `sizes` prop on `<Image>`             | Browser downloads largest variant regardless     | Set `sizes` for responsive loading         |
| Premature memoization                    | `useMemo`/`useCallback` without profiling        | Only memoize when profiling shows benefit  |
| Client-side search indexing              | Shipping full catalog to browser for search      | Server-side search (TMDB API, DB fulltext) |

---

## 10. Performance Optimization Flowchart

```
Is there a measured performance problem?
├── No → Do not optimize. Premature optimization adds complexity.
└── Yes → Where is the bottleneck?
    ├── Slow TTFB → Check rendering strategy (ISR vs SSR)
    │            → Check cache hit rate
    │            → Check DB query time
    ├── Slow FCP/LCP → Check JavaScript bundle size
    │                → Check image optimization (priority, sizes, format)
    │                → Check font loading (swap vs block)
    ├── High CLS → Check image width/height
    │           → Check skeleton shapes
    │           → Check dynamic content loading
    ├── High INP → Check event handler cost
    │           → Check unnecessary re-renders (React.memo?)
    │           → Move heavy computation off main thread
    └── Slow API → Check upstream latency (TMDB, Stripe)
                → Check retry/backoff settings
                → Check cache invalidation frequency
```

**Rule:** Measure before optimizing. Every optimization adds complexity. Only optimize when measurement shows the target is missed.
