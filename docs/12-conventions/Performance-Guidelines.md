# Performance Guidelines — Nexus Anime

> **Audience:** All engineers writing, reviewing, and deploying code. This document translates the [Performance Architecture](../03-architecture/Performance.md) and [Caching Strategy](../03-architecture/Caching-Strategy.md) into actionable conventions that must be followed on every PR.

---

## 1. Core Web Vitals Targets

Production targets measured from real users (Vercel Analytics RUM), not Lighthouse lab scores.

| Metric | Our Target | Google "Good" | What it measures |
|--------|-----------|---------------|-----------------|
| **LCP** | < 1.0s | < 2.5s | Perceived load speed — largest visible content |
| **INP** | < 150ms | < 200ms | Responsiveness to user interactions |
| **CLS** | < 0.05 | < 0.1 | Visual stability during page load |

Targets are ~20% tighter than "good" thresholds. A premium streaming platform must feel faster than average.

### Server-side targets

| Metric | Target | Context |
|--------|--------|---------|
| TTFB (cached) | < 200ms | ISR page served from Edge |
| TTFB (uncached) | < 500ms | Full server render |
| DB query p95 | < 50ms | Neon serverless + connection pooling |
| Redis cache p95 | < 5ms | Upstash REST API (no TCP overhead) |
| TMDB/AniList p95 | < 500ms | External network + their API latency |

---

## 2. Rendering Strategy

Choose the correct strategy per route. The wrong strategy is the most common performance regression.

| Strategy | When to use | TTFB impact |
|----------|------------|-------------|
| **ISR** | Catalog pages with high read traffic (home, anime detail, season) | < 50ms from Edge cache |
| **SSR** | Personalized or real-time data (watchlist, profile, settings) | 200–500ms |
| **Streaming** | Mixed-latency data on one page (fast hero + slow reviews) | Fast content visible immediately |
| **Static** | Truly immutable content (legal, about, privacy) | ~0ms from CDN |

### ISR revalidation

| Page | `revalidate` | Rationale |
|------|-------------|-----------|
| Home (trending) | 60s | Trending shifts frequently |
| Anime detail | 300s | Metadata changes rarely |
| Season listing | 600s | Season structure is stable |
| Episode list | 300s | New episodes appear weekly |

Do not over-revalidate (wastes compute) or under-revalidate (stale data).

### Streaming with Suspense

When a page has fast and slow data, wrap each independently. Never block the entire page on one slow section.

```tsx
<Suspense fallback={<HeroSkeleton />}><AnimeHero /></Suspense>
<Suspense fallback={<ReviewsSkeleton />}><ReviewList /></Suspense>
```

---

## 3. React Performance

### Server Components by default

Use `"use client"` **only** when the component needs state, effects, browser APIs, or event handlers. If a component only renders static markup or passes children, it must be a Server Component.

### Dynamic imports for heavy islands

| Component | Est. size | Strategy |
|-----------|----------|----------|
| Video player (HLS.js) | ~200KB | `dynamic(() => import("./PlayerIsland"), { ssr: false })` |
| Stripe checkout | ~80KB | `dynamic(() => import("./CheckoutIsland"), { ssr: false })` |
| Comment/rich editor | ~50KB | `dynamic(() => import("./EditorIsland"), { ssr: false })` |

Always provide a `loading` skeleton so the UI does not flash blank.

### State management

- **Server state:** Server Components for one-shot fetches; TanStack Query for client-cached state (watchlist, continue-watching).
- **Local UI state:** `useState` for ephemeral state only (modal open, selected tab). Do not mirror server state in `useState`.
- **Avoid prop drilling:** If a prop passes through more than two layers, use Context or co-locate state.

### Memoization — only when profiled

Do not preemptively use `React.memo`, `useMemo`, or `useCallback`. Apply only when React DevTools Profiler shows a real re-render bottleneck, and add a comment explaining why.

---

## 4. Data Fetching

### React.cache() for request dedup

When multiple components request the same data during a server render, wrap the fetch with `React.cache()` to deduplicate into a single request.

### Cursor-based pagination

Use cursor-based pagination for infinite scroll, never offset-based. Offset pagination produces duplicate or missing items when data changes between page loads.

```ts
// Cursor — stable regardless of inserts/deletes
getAnimeList({ cursor: "anime-uuid-123", limit: 20 });
```

### Select only needed columns

Specify exact columns in repository queries. Never `SELECT *`. This reduces data transfer, memory allocation, and serialization time.

### Avoid N+1 queries

Use Drizzle's query builder with joins or `with` (relations) to fetch related data in a single round trip. If a loop contains an `await db.*` call, it should be rewritten with a join or batch query.

---

## 5. Bundle Optimization

### Performance budgets

| Budget | Value | Enforcement |
|--------|-------|-------------|
| Initial JS (gzipped) | < 200KB | `next build` + CI check |
| Initial CSS (gzipped) | < 50KB | Tailwind purge + CI check |
| Total page weight | < 1MB | Lighthouse CI |
| Per-route JS delta | < 10KB (on PR) | PR bundle diff flagged if exceeded |

### Route-level JS targets

| Route | JS budget (gzipped) |
|-------|---------------------|
| Home (browse) | < 80KB (mostly Server Components) |
| Anime detail | < 100KB (watchlist toggle + episode list) |
| Watchlist | < 60KB (grid + React Query) |
| Player | < 50KB initial + 200KB lazy (HLS.js) |
| Checkout | < 50KB initial + 80KB lazy (Stripe Elements) |

### Tree-shaking

- `@nexus/ui` barrel exports + `"sideEffects": false` in package.json.
- No side-effectful imports (`import "some-css"` without using exports).

### Bundle analysis

Run `ANALYZE=true pnpm build` to open the treemap per route. Use it to identify large dependencies, verify dynamic imports are working (heavy modules should not appear in the parent route's bundle), and find duplicate package copies.

---

## 6. Image Optimization

All images must use `next/image` with the R2 loader. No `<img>` tags.

### Required props

- `width` and `height` — prevents CLS when image loads.
- `sizes` — tells browser which srcset variant to download.
- `quality` — 75 for thumbnails, 80 for heroes.
- `loading="lazy"` — default; use `priority` for LCP images.

LCP images must use `priority` — this adds a `<link rel="preload">` to `<head>`, eliminating the lazy-load delay on the most important image.

### Anti-patterns

- Missing `width`/`height` — causes CLS.
- Missing `sizes` — browser downloads largest variant regardless of viewport.
- `<img>` instead of `<Image>` — no format selection, srcset, or lazy loading.
- External `src` without loader — Next.js cannot optimize.

---

## 7. Font Optimization

All fonts must use `next/font`. No Google Fonts `<link>`.

- Always `display: "swap"` — never `block` or `auto` (causes FOIT).
- Mark critical fonts with `preload: true`.
- Limit to 2-3 families (1 body + 1 display + 1 monospace if needed).
- Variable fonts preferred (single file, multiple weights).

Self-hosted fonts eliminate a third-party DNS + TCP + TLS handshake, reducing latency by 100-300ms compared to Google Fonts.

---

## 8. CSS Performance

Tailwind CSS 4 generates only used CSS (dead code elimination). No unused utilities ship to production.

- Do not introduce CSS-in-JS, styled-components, or global stylesheets.
- Use `@nexus/ui` design tokens for glassmorphism effects, not raw Tailwind classes.
- Target: < 30KB gzipped CSS per catalog page.

Ensure the Tailwind `content` array covers all component source paths:

```ts
content: [
  "./src/**/*.{ts,tsx}",
  "../../packages/ui/src/**/*.{ts,tsx}",
],
```

---

## 9. Caching Strategy

### Cache layers and TTLs

| Cache | Key / Scope | TTL | Invalidation |
|-------|------------|-----|-------------|
| Vercel Edge (ISR) | Per-route | Page `revalidate` value | On deploy (full), on revalidate (background) |
| Redis | `nexus:{entity}:{id}:{view}` | 60s (volatile) / 15min (catalog) | On mutation (explicit) |
| Next.js fetch cache | Per-request URL | Route default | `revalidateTag` / `revalidatePath` |
| Browser | Asset hashes | Immutable (1 year) | New deploy = new hash |

### Redis key examples

```
nexus:anime:1234:detail     → 15min (anime detail page)
nexus:anime:trending        → 60s  (changes often)
nexus:user:5678:watchlist   → 60s  (invalidate on toggle)
nexus:search:query-hash     → 5min (search results)
```

### Cache rules

- **Write-through:** Update DB first, then invalidate cache. Never cache-then-DB.
- **Fail-open for reads:** If Redis is unreachable, serve from DB. Availability over performance.
- **Fail-closed for security writes:** Deny login/password-reset if Redis is unreachable.

---

## 10. Database Performance

### Indexing requirements

Every migration that adds a table or column must include indexes for:
- **Foreign keys** — Drizzle does not auto-index FKs.
- **Columns in `WHERE` clauses** and **`ORDER BY` clauses**.
- **Composite indexes** for frequent multi-column queries.

Review the migration diff for missing indexes before approving a PR.

### Connection pooling

Neon serverless provides HTTP-based connection pooling via `@nexus/db` — applications do not manage connections directly. No TCP overhead, no connection exhaustion, sub-10ms acquisition.

### Query patterns

- Simple select: `db.select().from(table).where(eq(table.id, id))`
- Join: `db.select().from(anime).innerJoin(studio, ...)`
- Transaction: **Required** for multi-statement writes (watchlist + progress).

---

## 11. CDN and Edge

### Vercel Edge Network

Static assets and ISR pages are served from Vercel's global Edge Network. Cache hits serve in < 50ms TTFB worldwide.

### Cache headers

| Asset type | Cache-Control |
|-----------|--------------|
| Static (JS, CSS, fonts) | `public, max-age=31536000, immutable` |
| ISR pages | Managed by Next.js |
| API responses | `private, no-store` or `s-maxage=60` |

### Preconnect hints

Add `<link rel="preconnect">` for origins loaded on initial render (R2 images, Stripe on checkout). Do not preconnect origins only needed on user interaction (video CDN).

---

## 12. Measurement and Monitoring

### Development

| Tool | When | What |
|------|------|------|
| Chrome DevTools Performance | During dev | Render time, layout shifts, long tasks |
| React DevTools Profiler | Component optimization | Unnecessary re-renders |
| `next build` output | Before deploy | Bundle sizes per route |
| `@next/bundle-analyzer` | Investigating bundle size | Treemap of route JS dependencies |

### CI/CD

| Check | Threshold | Action on failure |
|-------|-----------|-------------------|
| Bundle size | New route adds < 10KB gzipped | Comment on PR |
| Lighthouse CI | LCP < 2.5s, CLS < 0.1, INP < 200ms | Block merge |
| `pnpm typecheck` + `pnpm build` | Must pass | Block merge |

### Production

| Tool | Alert condition |
|------|----------------|
| Vercel Analytics (RUM) | p75 LCP > 2.5s for 10 min |
| Vercel Speed Insights | Route CWV regression > 20% |
| Custom Pino metrics | p95 > threshold for 5 min |

Lab data (Lighthouse) is synthetic. RUM from Vercel Analytics is the ground truth for performance.

---

## 13. Performance Budget Enforcement

| Budget | Value | Measurement |
|--------|-------|-------------|
| Initial JS (gzipped) | < 200KB | `next build` output |
| Initial CSS (gzipped) | < 50KB | `next build` output |
| Total page weight | < 1MB | Lighthouse CI |
| Third-party JS | Only Stripe + Cloudflare Embed | CSP enforcement |

When a budget is exceeded: identify the regressor, determine if it can be lazy-loaded, optimize if it must remain in the initial bundle. If the budget cannot be met, document the rationale and get team lead approval. Do not silently exceed budgets.

---

## 14. When to Optimize

### Decision flow

1. **Measure** — Is there a real problem? Check Vercel Analytics or Lighthouse. If metrics meet targets, stop.
2. **Identify the bottleneck** — Use the table below.
3. **Optimize** — Apply the specific fix. One change at a time.
4. **Re-measure** — Did it improve? If not, revert and try a different approach.
5. **Document** — Add a comment so the optimization is not removed later.

### Bottleneck diagnosis

| Symptom | Likely bottleneck | First check |
|---------|------------------|-------------|
| Slow TTFB | Rendering strategy | Should this page be ISR? |
| Slow TTFB | Cache miss | Is Redis populated? ISR cached? |
| Slow TTFB | DB query | Query plan, missing indexes |
| Slow LCP | Large JS bundle | Heavy component in initial bundle? Make dynamic. |
| Slow LCP | Unoptimized image | `priority` on LCP image? `sizes` correct? |
| Slow LCP | Font loading | `display: "swap"`? `preload: true`? |
| High CLS | Image dimensions | `width`/`height` on all images? |
| High CLS | Dynamic content | Skeletons the right size? |
| High INP | Expensive handler | Profile the handler |
| High INP | Unnecessary re-renders | Component re-rendering on every interaction? |
| Slow API | Upstream latency | Cache, retry, backoff |

### Anti-patterns

| Anti-pattern | Correct approach |
|-------------|-----------------|
| `useState` + `useEffect` fetch | Server Component fetch or TanStack Query |
| Blocking page on one slow section | `<Suspense>` with streaming |
| `SELECT *` from DB | Select only needed columns |
| Images without `width`/`height` | Always set explicit dimensions |
| Heavy client component in initial bundle | `next/dynamic` with `ssr: false` |
| Synchronous font loading | `font-display: swap` |
| No `sizes` prop on `<Image>` | Set `sizes` for responsive loading |
| Premature memoization | Only when profiling shows benefit |
| Client-side search index | Server-side search (TMDB API, DB fulltext) |
| Offset-based pagination | Cursor-based pagination |

### Premature vs. justified optimization

**Premature (don't):** `React.memo` on every component, pre-caching unrequested data, virtualization for < 100 items, service workers when ISR suffices.

**Justified (do):** Dynamic import for 200KB video player, `priority` on the LCP hero image, cursor pagination for infinite scroll, ISR on catalog pages with 80%+ traffic.

The difference: justified optimizations address a measured or obvious bottleneck.

---

## Further Reading

- [Performance Architecture](../03-architecture/Performance.md) — targets, rendering strategy, caching
- [Caching Strategy](../03-architecture/Caching-Strategy.md) — Redis, ISR, and fetch cache patterns
- [Rendering Strategy](../03-architecture/Rendering-Strategy.md) — ISR, SSR, streaming, static decisions
- [Scalability](../03-architecture/Scalability.md) — load handling, auto-scaling, capacity planning
- [API Layer](../03-architecture/API-Layer.md) — cursor pagination, envelope shape, error handling
