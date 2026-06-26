# Scalability — Nexus Anime

> **Audience:** Engineers and architects planning for growth. This document defines how the architecture scales across traffic, data, team, and feature dimensions.

---

## 1. Scalability Dimensions

Nexus Anime must scale across four independent dimensions:

| Dimension | Current scale | Target scale (v1.0) | Bottleneck today |
|-----------|--------------|---------------------|-----------------|
| **Traffic** | < 1K DAU | 100K DAU | Single Vercel deploy, single DB |
| **Data** | < 10K anime | 500K anime + 1M episodes | Single Neon database |
| **Team** | 1–3 engineers | 5–10 engineers | Monorepo with no team boundaries |
| **Features** | 6 features | 15+ features | Feature coupling risk |

---

## 2. Traffic Scalability

### Horizontal: Vercel Serverless Functions

Vercel automatically scales serverless functions horizontally. Each SSR request runs in an isolated function instance. Under load, Vercel spawns more instances (zero to thousands in seconds).

**No action needed.** This is the primary scaling mechanism and it's automatic.

### Edge: ISR + Edge Network

ISR pages are served from Vercel's global Edge Network (300+ PoPs). Cache hits don't invoke serverless functions at all — the edge serves pre-rendered HTML directly.

**Why this matters at scale:** At 100K DAU, catalog pages will receive ~500K daily requests. If 95% are ISR cache hits, only 25K requests reach the serverless function. The edge absorbs 95% of the load.

### Database: Neon Serverless

Neon Postgres uses HTTP-based connection pooling (via `@neondatabase/serverless`). Each serverless function gets a pooled connection over HTTP, not a dedicated TCP connection.

**Why this matters at scale:** Traditional Postgres connection limits are ~100 per instance. Under 500 concurrent page renders, traditional Postgres would exhaust connections. Neon's HTTP pooling allows effectively unlimited concurrent queries from serverless functions.

### Redis: Upstash REST API

Upstash Redis is accessed over HTTP (REST API), not TCP. This is compatible with serverless/Edge environments and eliminates connection pooling concerns.

**Why Upstash over self-hosted Redis:** Self-hosted Redis requires managing TCP connections, memory limits, and failover. Upstash is serverless — it scales automatically and is accessed over HTTP, which works from any Vercel function (Edge or Node.js).

### Traffic scaling summary

```
100K DAU
  → ~500K daily page views
  → 95% served from Edge (ISR cache hits) → 475K hits, < 50ms TTFB
  → 5% SSR (authenticated + cache misses) → 25K renders, < 500ms TTFB
  → DB: 25K queries/day, p95 < 50ms (Neon pooling)
  → Redis: 500K cache reads/day, p95 < 5ms (Upstash REST)
  → TMDB: ~1K external calls/day (fetch cache hit rate > 90%)
```

---

## 3. Data Scalability

### Database: Neon with branching

Neon supports database branching — instant, copy-on-write clones of the production database. Each PR can have its own branch for schema migrations, without affecting production.

| Data volume | Strategy |
|-------------|----------|
| < 100K rows per table | Standard indexes sufficient |
| 100K–1M rows | Add composite indexes for common query patterns; consider partitioning for `watch-progress` (partition by month) |
| > 1M rows | Partition large tables; add read replicas if read latency increases |

### Table growth estimates

| Table | Growth rate | Size at v1.0 | Index strategy |
|-------|-----------|-------------|---------------|
| `anime` | ~10K/year (new titles) | ~50K rows | B-tree on `id`, `slug`, `rating` |
| `episodes` | ~100K/year | ~500K rows | B-tree on `animeId`, `seasonNumber` |
| `users` | Grows with signups | ~100K rows | B-tree on `email` |
| `watchlist` | Grows with users | ~500K rows | Composite on `(userId, animeId)`, `(userId, position)` |
| `watch-progress` | Grows with views | ~1M rows | Composite on `(userId, episodeId)`; partition by month |
| `sessions` | Churn (30-day expiry) | ~50K active rows | B-tree on `sessionToken`, `userId` |

### Full-text search

Anime search uses a combination of:
1. **PostgreSQL `tsvector`** for title/synopsis search (fast, in-database).
2. **TMDB search API** as a secondary source (for titles not in our DB yet).

At > 100K titles, consider migrating to a dedicated search service (Meilisearch or Typesense) for sub-50ms search latency. This is a future optimization — PostgreSQL fulltext is sufficient at our scale.

---

## 4. Team Scalability

### Package boundaries as team boundaries

The `@nexus/*` packages define ownership boundaries. As the team grows:

| Team | Owns | Can modify |
|------|------|-----------|
| Design systems | `@nexus/ui` | Component APIs, theme tokens |
| Platform | `@nexus/db`, `@nexus/cache` | Schema, migrations, Redis helpers |
| Backend | `services/`, `actions/`, Route Handlers | Business logic, API surface |
| Frontend | `features/`, `shared/` | UI, user flows |

### Feature module isolation

Feature modules (`features/auth/`, `features/catalog/`, etc.) are self-contained. A developer working on the player feature doesn't need to understand the payments feature. This reduces cognitive load as the number of features grows.

### CODEOWNERS enforcement

`.github/CODEOWNERS` requires reviews from the owning team for changes in their package:

```
packages/ui/          @nexus-anime/design-system
packages/db/          @nexus-anime/platform
apps/web/src/services/ @nexus-anime/backend
apps/web/src/features/ @nexus-anime/frontend
```

### Why package boundaries over Conway's Law-driven microservices

Conway's Law says team structure should mirror system structure. Microservices mirror this perfectly — each team owns a service. But for 5–10 engineers, microservices add operational overhead (deployment, monitoring, inter-service auth) that outweighs the team-autonomy benefit. Package boundaries give us the ownership clarity of microservices without the operational cost. If a team grows to > 20 engineers working on a single module, extraction is justified (ADR-001 extraction criteria).

---

## 5. Feature Scalability

### Adding new features

The feature module structure makes adding features cheap:

1. Create `features/<name>/` with standard anatomy.
2. Add service in `services/`.
3. Add routes in `app/`.
4. Add repositories in `@nexus/db` if new tables are needed.

No refactoring of existing features required. The cross-feature import rule prevents coupling.

### Feature flags for gradual rollout

New features are wrapped in feature flags:

```ts
if (await isFeatureEnabled("comments")) {
  return <CommentSection animeId={animeId} />;
}
```

This allows deploying code to production without exposing it to users. Gradual rollout (10% → 50% → 100%) is done by toggling the flag in Redis.

### Why feature flags over branch-based deployment

Branch-based deployment ("deploy the feature branch to staging") requires maintaining long-lived branches and a separate staging environment. Feature flags deploy code to production (single branch, single environment) and control visibility at runtime. This is simpler and avoids merge debt.

---

## 6. Extraction Strategy

ADR-001 defines when to extract a module from the monolith:

| Signal | Action | Example |
|--------|--------|---------|
| **Independent deploy cadence** | Extract to separate app/service | Video transcoding worker needs its own deploy cycle |
| **Performance isolation** | Extract to separate compute | Player service consuming too much memory, affecting catalog |
| **Team ownership** | Extract when a team exclusively owns a module | Admin panel maintained by a separate team |
| **Technology divergence** | Extract when a module needs different runtime | ML recommendation service in Python |

### Extraction path

```
1. Module in features/player/ + services/streaming.service.ts
2. Extract to apps/player-api/ (Express/Fastify) or packages/player-core/
3. Replace service calls with HTTP calls (from services/streaming.service.ts)
4. Write ADR documenting rationale
5. Deploy independently via separate Vercel project or container
```

### Why plan for extraction but not execute

Extraction without need adds complexity (inter-service auth, network failures, deploy coordination). The modular monolith is simpler and sufficient. But the architecture must make extraction *cheap* when needed — that's why we have the service layer (extraction seam) and package boundaries (ownership boundaries).

---

## 7. Geographic Scalability

### CDN: Vercel Edge Network

Vercel's Edge Network has 300+ PoPs worldwide. ISR pages are served from the nearest PoP to the user. This gives sub-50ms TTFB for cached pages globally.

### Database: Neon read replicas

Neon supports read replicas in different regions. For read-heavy workloads (catalog browsing), we can add a read replica closer to the user's region.

**Current strategy:** Single Neon region (us-east-1) + Edge caching. At 100K DAU with global traffic, add read replicas in eu-west-1 and ap-southeast-1.

### Video: Cloudflare Stream

Cloudflare Stream delivers video from Cloudflare's global CDN (300+ PoPs). Video chunks are cached at the edge. This is independent of our application scaling — Cloudflare handles it.

### Why Edge-first, not region-first

Running the application in multiple regions (EKS in us-east + eu-west) is expensive and complex (data replication, session consistency, cross-region routing). Edge caching + single-region database is simpler and handles 95% of global latency concerns. Only database-bound requests (SSR) hit the single region; Edge-cached requests are already local.

---

## 8. Rate Limiting at Scale

See [API-Layer.md](API-Layer.md) for implementation details. At scale:

| Tier | Limit | Purpose |
|------|-------|---------|
| Anonymous | 60 req/min per IP | Prevent abuse; generous for normal browsing |
| Authenticated | 120 req/min per user | Higher limit for logged-in users |
| Subscriber | 200 req/min per user | Premium users get higher limits |
| API (mobile) | 1000 req/min per API key | Machine access |

Rate limits use Upstash Redis's sliding-window algorithm, which is O(1) per check and scales to millions of requests.

---

## 9. Cost Scaling

### Estimated costs at scale (Vercel Pro + Neon Pro + Upstash)

| DAU | Vercel | Neon | Upstash | Total |
|-----|--------|------|---------|-------|
| 1K | $20/mo | $19/mo | $10/mo | ~$50/mo |
| 10K | $20/mo | $19/mo | $30/mo | ~$70/mo |
| 100K | $20/mo | $70/mo | $100/mo | ~$190/mo |

**Why Vercel cost stays flat:** ISR cache hits don't invoke serverless functions. Vercel Pro's included bandwidth (1TB/month) covers 100K DAU easily. Serverless function invocations (SSR) are a small fraction of total requests.

**Neon scales with data:** Read/write units increase with traffic. At 100K DAU, we exceed the free tier and need Neon Pro for autoscaling.

**Upstash scales with requests:** Redis commands per day increase linearly with traffic. Upstash's per-request pricing means costs grow proportionally.

---

## 10. Scalability Decision Matrix

When facing a scaling problem, apply this decision matrix:

| Problem | First response | Escalation |
|---------|---------------|-----------|
| Slow page load | Add/extend ISR cache | Consider Edge runtime for SSR |
| Slow DB query | Add index, optimize query | Consider read replica or caching layer |
| Slow external API | Extend Next.js fetch cache TTL | Mirror data in our DB |
| High serverless invocations | Increase ISR cache hit rate | Consider persistent server (Vercel Fluid) |
| Connection exhaustion | Verify Neon pooling is active | Add connection pooler (PgBouncer) |
| Feature coupling | Enforce cross-feature import rule | Extract to separate package |
| Team conflict | Tighten CODEOWNERS | Extract to separate app |
