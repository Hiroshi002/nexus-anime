# Caching Strategy — Nexus Anime

> **Audience:** Engineers implementing cache reads, writes, and invalidation. This document defines the caching architecture, key schema, TTLs, and invalidation rules.

---

## 1. Caching Layers

Nexus Anime has four caching layers, each serving a distinct request path:

```
Request → [1. Browser cache] → [2. CDN/Edge cache] → [3. Next.js fetch cache] → [4. Redis cache] → Origin
```

| Layer | Technology | Where | Cached by | Invalidation |
|-------|-----------|-------|-----------|-------------|
| **Browser** | HTTP Cache headers | Client | Browser | `Cache-Control` max-age, Vercel revalidation |
| **CDN/Edge** | Vercel Edge Network | Cloud edge | Vercel | `revalidatePath()`, `revalidateTag()` |
| **Next.js fetch** | In-memory + persistent | Server process | `fetch()` `next` option | `revalidateTag()`, time-based |
| **Redis** | Upstash Redis | Server (Upstash) | Application code | Explicit `del` on mutation |

---

## 2. Redis Cache — @nexus/cache

### Key Schema

All Redis keys follow a structured naming convention to prevent collisions and make keys discoverable:

```
nexus:{entity}:{identifier}:{view}
```

| Example | Meaning |
|---------|---------|
| `nexus:anime:uuid-123:detail` | Anime detail view for a specific anime |
| `nexus:anime:uuid-123:episodes` | Episode list for a specific anime |
| `nexus:user:uuid-456:watchlist` | Watchlist for a specific user |
| `nexus:catalog:trending:global` | Global trending anime list |
| `nexus:catalog:genre:action` | Anime in the "action" genre |
| `nexus:search:query:naruto` | Search results for "naruto" |
| `nexus:session:token:abc123` | Session data for a token |
| `nexus:rate-limit:ip:1.2.3.4:search` | Rate limit counter for IP + endpoint |
| `nexus:flag:hd-preview` | Feature flag state |

### Why structured keys

Structured keys are grep-able, auditable, and prevent accidental collisions. `nexus:anime:123:detail` is self-documenting — a developer reading the key knows exactly what it caches. Flat keys (`anime_detail_123`) are ambiguous and harder to manage across namespaces.

### TTL Strategy

| Entity | TTL | Why |
|--------|-----|-----|
| Anime detail | 3600s (1 hr) | Metadata changes infrequently |
| Episode list | 1800s (30 min) | New episodes appear weekly; list changes less often |
| Trending catalog | 300s (5 min) | Trending changes daily; users expect somewhat fresh data |
| Genre catalog | 86400s (24 hr) | Genres are stable |
| Search results | 60s (1 min) | Search is low-cache; results change as catalog updates |
| Watchlist | 30s | User-specific; must be fresh after mutation |
| Watch progress | 0s (no cache) | Real-time; always read from DB |
| Session | 86400s (24 hr) | Matches session maxAge; deleted on logout |
| Rate limit counters | Window-based | Auto-expire with the rate limit window |
| Feature flags | 300s (5 min) | Flags change rarely but should propagate quickly |

---

## 3. Cache Helper API

```ts
// @nexus/cache/src/cache.ts
export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  return raw ? JSON.parse(raw) : null;
}

export async function cacheSet<T>(key: string, value: T, ttl: number): Promise<void> {
  await redis.set(key, JSON.stringify(value), { ex: ttl });
}

export async function cacheDel(key: string): Promise<void> {
  await redis.del(key);
}

export async function cacheDelByPattern(pattern: string): Promise<void> {
  // Scan + delete for pattern-based invalidation (e.g., "nexus:anime:*:detail")
  const keys = await redis.keys(pattern);
  if (keys.length > 0) await redis.del(...keys);
}
```

### Why JSON serialization in Redis

Redis stores bytes. We could use MessagePack for smaller payloads, but JSON is native to JavaScript, debuggable in Redis CLI (`GET nexus:anime:123:detail` gives readable JSON), and the size difference is negligible for our payload sizes (anime detail ~2KB).

---

## 4. Invalidation Strategy

### Time-based (TTL)

The primary invalidation mechanism. Keys auto-expire after their TTL. Simple, reliable, requires no code on write paths.

### Explicit invalidation on mutation

When a mutation changes data that is cached, the Server Action explicitly deletes the relevant keys:

```ts
"use server";
export async function toggleWatchlistAction(animeId: string) {
  const userId = (await auth())?.user?.id;
  await watchlistService.toggle(userId, animeId);

  // Explicit invalidation
  await cacheDel(`nexus:user:${userId}:watchlist`);

  // Next.js revalidation (updates Server Component data)
  revalidateTag(`watchlist:${userId}`);
  revalidatePath("/watchlist");
}
```

### Tag-based invalidation

Next.js fetch cache uses tags for group invalidation. When a TMDB update webhook fires (future), we invalidate all TMDB-sourced data:

```ts
revalidateTag("tmdb"); // Invalidates all fetches tagged "tmdb"
```

### Why TTL + explicit, not explicit-only

Explicit-only requires every write path to know and delete all affected keys. If a developer forgets a `cacheDel`, stale data persists forever. TTL is a safety net — even if explicit invalidation is missed, data expires within the TTL window. The trade-off is that data may be stale for up to the TTL duration, which is acceptable for our timeframes (max 1 hour for anime detail).

---

## 5. Stale-While-Revalidate

Redis cache supports a stale-while-revalidate pattern for browse pages:

1. **Cache hit:** Return cached data immediately (fast response).
2. **Stale (within revalidation window):** Return stale data, trigger background refresh.
3. **Cache miss:** Fetch from origin, cache, return.

This is implemented at the application level:

```ts
export async function getWithSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number,
  staleWhileRevalidate: number
): Promise<T> {
  const cached = await cacheGet<T & { _cachedAt?: number }>(key);

  if (cached) {
    const age = Date.now() - (cached._cachedAt ?? 0);
    if (age < ttl * 1000) return cached;  // Fresh
    if (age < staleWhileRevalidate * 1000) {
      // Stale but within SWR window — return stale, refresh in background
      fetcher().then((fresh) => cacheSet(key, { ...fresh, _cachedAt: Date.now() }, staleWhileRevalidate));
      return cached;
    }
  }

  // Miss or expired — fetch fresh
  const fresh = await fetcher();
  await cacheSet(key, { ...fresh, _cachedAt: Date.now() }, staleWhileRevalidate);
  return fresh;
}
```

### Why SWR for trending/catalog

Trending anime doesn't change minute-to-minute, but users expect it to be "roughly current." SWR gives instant response from cache while refreshing in the background. The user sees data that's at most 10 minutes stale, and the refresh is invisible.

---

## 6. Next.js Fetch Cache

Server Components use `fetch()` with the `next` option for caching:

```ts
const res = await fetch(url, {
  next: {
    revalidate: 3600,            // Revalidate every hour
    tags: ["anime", `anime:${id}`],  // Tag for group invalidation
  },
});
```

### Relationship to Redis cache

Next.js fetch cache and Redis cache serve different purposes:

| Aspect | Next.js fetch cache | Redis cache |
|--------|-------------------|-------------|
| Scope | Per-server-process (durable on Vercel) | Shared across all server instances |
| Granularity | Per-fetch-call | Per-entity |
| Access | Implicit (Next.js handles it) | Explicit (application code reads/writes) |
| Invalidation | `revalidatePath`, `revalidateTag` | `cacheDel`, TTL |
| Use for | External API responses (TMDB, AniList) | Application-level data aggregation |

External API responses (TMDB, AniList) are cached via Next.js fetch cache because the `next` option integrates with ISR and revalidation. Application-level data (composed views, user watchlists) is cached in Redis because it needs TTL, SWR, and explicit invalidation that the Next.js fetch cache doesn't provide.

---

## 7. Cache-Aside Pattern

The application uses the **cache-aside** pattern exclusively. The application code checks the cache first; on miss, it fetches from the origin and populates the cache.

```ts
async function getAnimeDetail(id: string): Promise<AnimeDetail> {
  // 1. Check cache
  const cached = await cacheGet<AnimeDetail>(`nexus:anime:${id}:detail`);
  if (cached) return cached;

  // 2. Fetch from origin (DB)
  const anime = await animeRepository.getDetail(id);

  // 3. Populate cache
  await cacheSet(`nexus:anime:${id}:detail`, anime, 3600);

  return anime;
}
```

### Why cache-aside over write-through

| Pattern | Read path | Write path | Complexity |
|---------|----------|------------|------------|
| **Cache-aside** | Check cache → miss → fetch → populate | Write to DB → delete cache key | Simple; standard |
| Write-through | Check cache → miss → fetch → populate | Write to DB → write to cache | Must keep cache and DB in sync on every write |
| Write-behind | Same as write-through | Write to cache → async write to DB | Risk of data loss if cache fails before DB write |

Cache-aside is the simplest and most resilient. If Redis is down, reads fall through to the DB (degraded but functional). Write-through and write-behind add complexity and failure modes.

---

## 8. Cache Failure Handling

### Read failures — Fail open

If Redis is unreachable on a read, the request proceeds to the origin (DB). The user sees slightly slower responses but no errors.

```ts
async function cacheGetSafe<T>(key: string): Promise<T | null> {
  try {
    return await cacheGet<T>(key);
  } catch (error) {
    log.warn("Cache read failed", { key, error });
    return null;  // Treat as cache miss
  }
}
```

### Write failures — Log and continue

If Redis is unreachable on a write (cache population), we log the failure and continue. The next read will be a cache miss and re-populate.

### Why fail-open

Cache is a performance optimization, not a source of truth. A cache outage should not take down the application. The database is always the authoritative source.

**Exception:** Rate limiting cache failures are handled differently (see API-Layer.md). Login rate limits fail **closed** to prevent brute-force when Redis is down.

---

## 9. Browser Cache Headers

Set via `next.config.ts` headers and `Cache-Control` in Route Handlers:

| Path | `Cache-Control` | Why |
|------|-----------------|-----|
| `/_next/static/*` | `public, max-age=31536000, immutable` | Static assets are content-hashed — never change |
| `/fonts/*` | `public, max-age=31536000, immutable` | Self-hosted fonts are immutable |
| `/images/*` (R2) | `public, max-age=86400, stale-while-revalidate=604800` | Images change rarely; stale-while-revalidate for 1 week |
| `/api/*` | `no-store` | API responses are dynamic |
| Pages | Handled by ISR/SSR — no explicit header needed | Next.js sets appropriate headers per rendering strategy |

---

## 10. Feature Flags in Redis

Feature flags are stored in Redis with a safe default when Redis is unreachable.

```ts
export async function isFeatureEnabled(flag: string, defaultValue = false): Promise<boolean> {
  try {
    const value = await redis.get(`nexus:flag:${flag}`);
    return value === "true";
  } catch {
    return defaultValue;  // Safe default — flags are "off" when Redis is down
  }
}
```

### Flag examples

| Flag | Default | Purpose |
|------|---------|---------|
| `hd-preview` | `false` | Enable HD episode thumbnails (higher bandwidth) |
| `new-search` | `false` | Use new search algorithm (A/B test) |
| `comments` | `false` | Enable comment section (feature rollout) |

### Why Redis for flags, not environment variables

Feature flags change at runtime without redeployment. Changing an env var requires a rebuild and deploy. Redis allows toggling flags instantly via an admin tool or CLI.
