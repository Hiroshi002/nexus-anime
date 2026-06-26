# API Layer — Nexus Anime

> **Audience:** Engineers implementing Server Actions, Route Handlers, and external API clients. This document defines the API architecture, envelope format, validation, and error contract.

---

## 1. API Architecture Overview

Nexus Anime has three API surfaces:

| Surface | Protocol | Consumers | When to use |
|---------|----------|-----------|-------------|
| **Server Actions** | Form submission (RPC-like) | Browser (Next.js client) | All user-facing mutations and form submissions |
| **Route Handlers** | HTTP REST | External services (Stripe, Cloudflare), future mobile | Webhooks, health checks, API-for-mobile |
| **Server-to-server** | Direct function calls | Internal services | Service → Repository, Service → Cache (no HTTP overhead) |

---

## 2. API Response Envelope

All API responses follow a consistent envelope format. This is **non-negotiable** — every Route Handler and Server Action return value conforms.

### Success envelope

```json
{
  "data": {
    "id": "anime-uuid",
    "title": "Naruto Shippuden",
    "episodes": 500
  }
}
```

### Error envelope

```json
{
  "error": {
    "message": "Anime not found",
    "code": "NOT_FOUND",
    "details": null
  }
}
```

### Validation error envelope (with field-level details)

```json
{
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": [
      { "field": "email", "message": "Invalid email format" },
      { "field": "password", "message": "Must be at least 8 characters" }
    ]
  }
}
```

### Why a consistent envelope

| Without envelope | With envelope |
|------------------|---------------|
| Response shape varies per endpoint | Every response has the same top-level shape |
| Client must know if response is data or error by shape | Client checks `data` or `error` — single dispatch |
| Errors are ad-hoc (`{ message: "..." }` or `{ err: "..." }`) | Errors are typed (`code`, `message`, `details`) |
| No machine-readable error codes | `code` enables generic error handling per category |

---

## 3. Error Code Catalog

Machine-readable codes that the client can switch on for localized, context-appropriate error messages.

| Code | HTTP status | When |
|------|-------------|------|
| `VALIDATION_ERROR` | 400 | Input fails Zod validation |
| `UNAUTHORIZED` | 401 | No session or expired session |
| `FORBIDDEN` | 403 | Session exists but lacks permission |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `CONFLICT` | 409 | Duplicate resource (email already registered) |
| `RATE_LIMITED` | 429 | Too many requests |
| `PAYMENT_REQUIRED` | 402 | Subscription required for action |
| `UPSTREAM_ERROR` | 502 | External API (TMDB, Stripe, Stream) failure |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### Why machine-readable codes

`message` is human-readable and may change ("Anime not found" → "Title not found"). `code` is machine-readable and stable — the client switches on `code`, not `message`. This decouples client error handling from server copy.

---

## 4. Server Actions

Server Actions are Next.js's native mechanism for mutations. They are `"use server"` functions called from Client Components.

### Contract

```ts
"use server";

export async function toggleWatchlistAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  // 1. Parse and validate input
  const input = watchlistToggleSchema.safeParse({
    animeId: formData.get("animeId"),
  });
  if (!input.success) {
    return { error: { message: "Validation failed", code: "VALIDATION_ERROR", details: input.error.flatten().fieldErrors } };
  }

  // 2. Get session (server-only)
  const session = await auth();
  if (!session?.user) {
    return { error: { message: "Sign in required", code: "UNAUTHORIZED" } };
  }

  // 3. Call service (business logic)
  await watchlistService.toggle(session.user.id, input.data.animeId);

  // 4. Revalidate cache
  revalidateTag(`watchlist:${input.data.animeId}`);
  revalidatePath("/watchlist");

  // 5. Return success
  return { data: { toggled: true } };
}
```

### ActionState type

```ts
type ActionState<T = unknown> =
  | { data: T }
  | { error: { message: string; code: string; details?: unknown } };
```

### Rules for Server Actions

1. **Validate all input with Zod** — never trust `FormData` or `useActionState` payload directly.
2. **Check auth** — every action that modifies data must verify the session.
3. **Call service, not repository** — actions are thin; business logic lives in services.
4. **Revalidate after mutation** — `revalidatePath` or `revalidateTag` to refresh Server Component data.
5. **Return ActionState** — consistent envelope for client-side handling.
6. **No secrets in returns** — never return tokens, API keys, or internal URLs.

### Why Server Actions over fetch-based mutations

| Criterion | Server Actions | fetch() to Route Handler |
|-----------|---------------|------------------------|
| Type safety | End-to-end (same TypeScript process) | Broken at HTTP boundary |
| Progressive enhancement | Works without JS (form) | Requires JS |
| Boilerplate | Less (no request/response shaping) | More (parse request, shape response) |
| CSRF protection | Built-in (Next.js origin check) | Must implement manually |
| Cache revalidation | Built-in `revalidatePath/Tag` | Manual cache control headers |

---

## 5. Route Handlers

Route Handlers handle HTTP requests that **cannot** be Server Actions — webhooks, health checks, and API-for-mobile endpoints.

### Webhook pattern

```ts
// app/api/stripe/webhook/route.ts
export async function POST(request: Request): Promise<NextResponse> {
  // 1. Verify signature (Stripe, not our auth)
  const signature = request.headers.get("stripe-signature");
  const event = stripe.webhooks.constructEvent(
    await request.text(),
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );

  // 2. Process event (idempotent)
  await paymentsService.handleWebhook(event);

  // 3. Acknowledge
  return NextResponse.json({ data: { received: true } });
}
```

### API-for-mobile pattern

```ts
// app/api/v1/anime/[id]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // 1. Validate auth (Bearer token, not cookie)
  const session = await authenticateApiRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: { message: "Unauthorized", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  // 2. Validate input
  const id = z.uuid().parse(params.id);

  // 3. Call service
  const anime = await catalogService.getDetail(id);

  // 4. Return envelope
  return NextResponse.json({ data: anime });
}
```

### Route Handler rules

1. **Never use for user-facing mutations** — those are Server Actions.
2. **Verify webhook signatures** — Stripe, Cloudflare Stream, etc. use signature verification, not our auth.
3. **Process webhooks idempotently** — use the event ID as a dedup key.
4. **Return envelope format** — same `{ data }` / `{ error }` as Server Actions.
5. **Set appropriate status codes** — 200 for success, 4xx/5xx for errors.

---

## 6. External API Clients

External APIs (TMDB, AniList, Stripe, Cloudflare Stream) are wrapped in typed client modules.

### Client anatomy

```ts
// lib/clients/tmdb.client.ts
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

async function tmdbFetch<T>(path: string, params: Record<string, string>, schema: ZodSchema<T>): Promise<T> {
  const url = new URL(path, TMDB_BASE_URL);
  url.searchParams.set("api_key", process.env.TMDB_API_KEY!);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    next: { revalidate: 3600, tags: ["tmdb"] },  // ISR cache
  });

  if (!res.ok) throw new UpstreamError("TMDB", res.status);

  const data = await res.json();
  return schema.parse(data);  // Validate response shape with Zod
}

export const tmdb = {
  searchAnime: (query: string) => tmdbFetch("/search/tv", { query }, tmdbSearchResponseSchema),
  getDetails: (id: number) => tmdbFetch(`/tv/${id}`, {}, tmdbDetailSchema),
};
```

### Client rules

1. **Zod-validate every response** — upstream APIs change without notice. Validation catches contract drift at the boundary.
2. **Use Next.js fetch cache** — `next: { revalidate, tags }` for ISR-like caching on external responses.
3. **Typed return values** — `tmdb.getDetails(123)` returns `Promise<TmdbAnimeDetail>`, not `Promise<any>`.
4. **Retry on transient failures** — 5xx or network errors get 2 retries with exponential backoff.
5. **Log failures** — structured log with upstream name, status code, and request path.

### Why validate upstream responses with Zod

An upstream API change (e.g., TMDB renames `vote_average` to `rating`) would crash the UI silently without validation. Zod at the boundary turns a runtime shape error into a logged, typed error that we can detect and fix — instead of a blank screen the user sees.

---

## 7. Rate Limiting

Rate limiting is enforced at two levels:

| Level | Mechanism | Scope |
|-------|-----------|-------|
| Edge | Vercel Edge Middleware + `@nexus/cache` rate limiter | Per-IP, per-route |
| Application | `@nexus/cache` sliding-window limiter | Per-user, per-action |

### Implementation

```ts
// @nexus/cache rate limiter
export async function checkRateLimit(key: string, limit: number, window: number): Promise<boolean> {
  const redis = getRedis();
  const result = await redis.incr(key);
  if (result === 1) await redis.expire(key, window);
  return result <= limit;
}
```

### Rate limits by endpoint

| Endpoint | Limit | Window | Why |
|----------|-------|--------|-----|
| Search | 20 requests | 60s | Search is expensive (TMDB API calls) |
| Watchlist toggle | 10 mutations | 60s | Prevent accidental double-toggles |
| Auth login | 5 attempts | 300s | Brute-force protection |
| Stripe webhook | 100 requests | 60s | Stripe may send rapid events |

### Why fail-open for reads, fail-closed for writes

If Redis is down, read rate limits are bypassed (the user can still browse). Write rate limits are also bypassed with a warning log — we prefer serving requests over blocking all writes due to a Redis outage. Auth rate limits (login) are fail-closed — if Redis is down, we block login attempts rather than risk brute-force.

---

## 8. API Versioning

Route Handler endpoints under `/api/v1/` are versioned for mobile/future consumers.

```
/api/v1/anime/[id]     → v1 anime detail
/api/v1/watchlist      → v1 watchlist CRUD
/api/v1/auth/session   → v1 session check
```

### Why prefix versioning over header-based

| Approach | Pros | Cons |
|----------|------|------|
| **URL prefix** (`/v1/`) | Explicit, cacheable, discoverable | URL changes between versions |
| Header-based (`Accept: application/vnd.nexus.v1+json`) | URL stays clean | Hidden from logs, not cacheable by CDN |

URL prefix is more visible in logs, easier to debug, and more cacheable on CDN edges. For an internal API consumed by our own mobile app, the URL change cost is negligible — we control both sides.

---

## 9. Request Deduplication

`React.cache()` deduplicates identical fetches within a single server request. For client-to-server dedup, Next.js automatically deduplicates `fetch()` calls with the same URL and options within a single render pass.

### External API dedup

TMDB and AniList calls use `next: { tags }` for cache control. If two Server Components both call `tmdb.getDetails(123)`, the second call hits the Next.js fetch cache (not the network).

---

## 10. API Security Checklist

- [x] All inputs validated with Zod at the boundary
- [x] All outputs validated with Zod before returning (for Route Handlers serving mobile)
- [x] No secrets in responses (API keys, tokens, connection strings)
- [x] Webhook signatures verified before processing
- [x] Rate limiting on all mutation endpoints
- [x] Auth check on all mutation actions (Server Action `auth()` call)
- [x] Idempotent webhook processing (dedup by event ID)
- [x] CORS restricted to our domain (Route Handlers)
- [x] CSRF protection (built-in for Server Actions)
- [x] Request size limits enforced (Vercel default: 4.5MB)
