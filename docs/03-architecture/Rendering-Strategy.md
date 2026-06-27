# Rendering Strategy — Nexus Anime

> **Audience:** Engineers implementing pages and components. This document defines which rendering strategy — SSG, ISR, SSR, or CSR — applies to each route and why.

---

## 1. Rendering Strategies Overview

| Strategy                                  | When data is rendered                    | Cache behavior             | Latency | Use when                                     |
| ----------------------------------------- | ---------------------------------------- | -------------------------- | ------- | -------------------------------------------- |
| **SSG** (Static Site Generation)          | Build time                               | Immutable until next build | Lowest  | Content never changes (marketing pages)      |
| **ISR** (Incremental Static Regeneration) | Build time, then revalidates on schedule | Time-based (`revalidate`)  | Low     | Content changes on a known cadence (catalog) |
| **SSR** (Server-Side Rendering)           | Request time                             | No cache (or per-request)  | Medium  | Content is user-specific or real-time        |
| **CSR** (Client-Side Rendering)           | In browser after hydration               | Browser-side (React Query) | Highest | Interactive state, live data                 |

---

## 2. Route-Level Rendering Decisions

### Public catalog — ISR

| Route                  | `revalidate`  | Why ISR                                                                                             |
| ---------------------- | ------------- | --------------------------------------------------------------------------------------------------- |
| `/` (home/browse)      | 300 (5 min)   | Trending changes daily; genres rarely change. 5 min balances freshness with cache hit rate.         |
| `/[id]` (anime detail) | 3600 (1 hr)   | Anime metadata (synopsis, rating, episode count) changes infrequently. New episodes appear weekly.  |
| `/season/[seasonId]`   | 86400 (24 hr) | Season rosters are stable once published.                                                           |
| `/search`              | N/A (SSR)     | Search queries are unique per user; caching by query string has low hit rate. ISR is inappropriate. |

**Why ISR for catalog:** Catalog pages receive the highest traffic. ISR serves cached HTML instantly (sub-50ms TTFB on Vercel Edge) and regenerates in the background. Users never wait for a cold server render. The `revalidate` values are tuned to the data change cadence — anime metadata doesn't change every minute, so a 1-hour cache is safe.

**Alternative considered: On-demand ISR via revalidateTag.** We could invalidate on webhook (e.g., TMDB update notification) instead of time-based. This is more precise but requires a webhook from the data source. TMDB doesn't offer one, so time-based is pragmatic. We can add on-demand invalidation later when we have admin-editable metadata.

---

### Authenticated pages — SSR

| Route                | Why SSR                                               |
| -------------------- | ----------------------------------------------------- |
| `/watchlist`         | User-specific data. Cannot share cache between users. |
| `/profile`           | User-specific data.                                   |
| `/settings`          | User-specific data.                                   |
| `/continue-watching` | Real-time watch progress.                             |

**Why SSR, not ISR:** Authenticated pages contain private data. ISR would serve one user's cached page to another. SSR renders per-request with the user's session, ensuring data isolation.

**Why SSR, not CSR:** CSR requires a loading spinner on every navigation (flash of loading state). SSR streams HTML immediately, giving instant feedback. The data fetch is fast (single DB query with indexes), so SSR latency is acceptable (~100ms).

---

### Marketing pages — SSG (Static)

| Route               | Why SSG                                                                          |
| ------------------- | -------------------------------------------------------------------------------- |
| `/pricing`          | Plan names and prices change only when we deploy a new version. No dynamic data. |
| `/about`            | Static content.                                                                  |
| `/terms`            | Legal text, updated only via deployment.                                         |
| `/login`, `/signup` | No data fetching — pure forms.                                                   |

**Why SSG:** These pages have zero dynamic data. SSG renders them at build time, giving the fastest possible TTFB and zero server cost. They deploy to Vercel's Edge Network as static files.

---

### API routes — No rendering

Route Handlers return JSON, not HTML. They are always SSR (executed per-request) but the concept of rendering strategy doesn't apply — there's no HTML to cache.

---

## 3. Component-Level Rendering

### Server Components (default)

Server Components render on the server and send HTML to the client. They can directly access databases, Redis, and environment variables. **They send zero JavaScript to the client.**

**Use for:** Data fetching, static markup, composition of other components, SEO-critical content.

**Catalog example:**

```tsx
// AnimeCard.tsx — Server Component (zero client JS)
// Fetches nothing itself — receives data via props from parent
export function AnimeCard({ anime }: AnimeCardProps) {
  return (
    <article>
      <Image src={anime.coverUrl} alt={anime.title} ... />
      <h3>{anime.title}</h3>
      <Badge>{anime.rating}</Badge>
    </article>
  );
}
```

### Client Components (opt-in with `"use client"`)

Client Components render on both server (for initial HTML) and client (for hydration and interactivity). **They increase bundle size.**

**Use for:** Event handlers, React hooks, browser APIs, Framer Motion.

**Interactive example:**

```tsx
// WatchlistToggle.tsx — Client Component (needs onClick + optimistic state)
"use client";
export function WatchlistToggle({ animeId, isInWatchlist }: Props) {
  const [optimistic, toggle] = useOptimistic(isInWatchlist);
  return <Button onClick={() => toggleWatchlistAction(animeId)}>{optimistic ? "✓" : "+"}</Button>;
}
```

### Client Islands (dynamic import)

Client Islands are Client Components loaded via `next/dynamic` with `ssr: false`. They are **not rendered on the server at all** — the client fetches and renders them after hydration.

**Use for:** Heavy components that would significantly increase the initial bundle.

| Island         | Bundle size                | Why lazy                                                                 |
| -------------- | -------------------------- | ------------------------------------------------------------------------ |
| Video Player   | ~200KB (HLS.js + controls) | Only needed on episode pages. Most users browse catalog without playing. |
| Comment Editor | ~50KB (rich text)          | Only on anime detail pages.                                              |
| Payment Form   | ~80KB (Stripe.js)          | Only on checkout.                                                        |

**Why dynamic import, not code splitting via route:** Code splitting by route is automatic in Next.js App Router. However, the video player, comment editor, and payment form are components _within_ a route, not separate routes. Dynamic import ensures they don't bloat the route's initial chunk.

---

## 4. Streaming Architecture

Next.js App Router streams HTML progressively by default. This is the key rendering innovation for our platform.

### How streaming works for anime detail page

```
Request → Server starts rendering
  ├── Root layout sent immediately (fonts, providers)
  ├── (public) layout sent (navbar, footer)
  ├── Suspense: AnimeHero skeleton → ... → AnimeHero HTML streams in
  ├── Suspense: EpisodeList skeleton → ... → EpisodeList HTML streams in
  └── Suspense: ReviewList skeleton → ... → ReviewList HTML streams in
```

**Result:** The user sees the skeleton instantly, then each section fills in as its data resolves. The slowest section (reviews from AniList) doesn't block the fastest (hero from Redis cache).

### React.cache() for request dedup

When multiple Server Components in the same request need the same data (e.g., both `AnimeHero` and `EpisodeList` need the anime record), `React.cache()` deduplicates the fetch. One database call, multiple consumers.

```ts
const getAnime = React.cache(async (id: string) => {
  return animeRepository.getDetail(id);
});
```

**Why React.cache over SWR/React Query on the server:** `React.cache()` is the Server Component equivalent of de-duplication. It operates within a single server request and is automatically cleared between requests. React Query is a client-side cache — it doesn't apply to Server Components.

---

## 5. Image Optimization

All images use `next/image` with the R2 loader for Cloudflare R2-hosted images.

| Image source                    | Loader                 | Optimization                                        |
| ------------------------------- | ---------------------- | --------------------------------------------------- |
| Cloudflare R2 (covers, avatars) | Custom R2 loader       | Next.js on-demand resize + WebP/AVIF                |
| TMDB image CDN                  | Custom TMDB loader     | Next.js on-demand resize (TMDB already serves WebP) |
| Static assets (`/public`)       | Default Next.js loader | Build-time optimization via `next/image`            |

### Required props for every `<Image>`

```tsx
<Image
  src={anime.coverUrl}
  alt={anime.title} // Always required — accessibility + SEO
  width={300} // Explicit — prevents layout shift
  height={450} // Explicit — prevents layout shift
  sizes="(max-width: 768px) 50vw, 300px" // Responsive sizes hint
  priority={isAboveTheFold} // Preload LCP images
/>
```

**Why explicit width/height:** Without them, the browser can't reserve space, causing layout shift (CLS) as images load. For a streaming platform with heavy image content (anime covers, episode thumbnails), CLS is the largest Core Web Vitals risk.

---

## 6. Metadata & SEO Rendering

### generateMetadata (dynamic routes)

```ts
// app/[id]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const anime = await getAnime(params.id);
  return {
    title: `${anime.title} | Nexus Anime`,
    description: anime.synopsis,
    openGraph: { images: [{ url: anime.coverUrl, width: 1200, height: 630 }] },
  };
}
```

### generateStaticParams (ISR pre-rendering)

```ts
// app/[id]/page.tsx
export async function generateStaticParams() {
  const popular = await getPopularAnimeIds(); // Top 100
  return popular.map((id) => ({ id }));
}
```

**Why pre-render top 100:** The long tail of anime (thousands of titles) gets virtually no traffic. Pre-rendering all of them would make builds slow and expensive. The top 100 by popularity cover 90%+ of traffic; the rest are rendered on first request and cached by ISR.

---

## 7. Not-found & Error Rendering

| File               | Rendering        | Purpose                                               |
| ------------------ | ---------------- | ----------------------------------------------------- |
| `not-found.tsx`    | Static (SSG)     | Custom 404 page with navigation suggestions           |
| `error.tsx`        | Client Component | Must be a Client Component (uses `reset()` for retry) |
| `loading.tsx`      | Static (SSG)     | Skeleton — instant, no data fetch                     |
| `global-error.tsx` | Client Component | Catches root layout errors (last resort)              |

**Why error.tsx must be a Client Component:** Next.js requires error boundaries to be Client Components because they need the `reset()` function to retry rendering. This is a framework constraint, not an architectural choice.

---

## 8. Dev-Only Rendering

The `/dev/components` route renders the design system showcase. It is:

- **Excluded from production** via `next.config.ts` `exclude` or a feature flag.
- **CSR** — it dynamically imports all `@nexus/ui` components and displays their variants. This page is for development only; it does not need SEO or SSR.

---

## 9. Performance Budgets per Rendering Strategy

| Strategy     | Target TTFB    | Target FCP | Target LCP        |
| ------------ | -------------- | ---------- | ----------------- |
| SSG          | <50ms          | <200ms     | <500ms            |
| ISR          | <50ms (cached) | <200ms     | <1s               |
| SSR          | <200ms         | <500ms     | <1.5s             |
| CSR (island) | N/A            | hydration  | <2s (lazy loaded) |

**Why these targets:** Vercel Edge serves cached ISR/SSG pages in <50ms TTFB. SSR adds database latency (~50-100ms). CSR islands are lazy-loaded after hydration, so their LCP depends on bundle size and network conditions. These targets are achievable on Vercel Pro with the Neon/Upstash stack.
