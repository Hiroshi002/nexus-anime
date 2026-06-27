# Rate Limiting

> **Authoritative reference** for rate-limit policy across all Nexus Anime API surfaces. Before implementing a new endpoint or changing a quota, read this document.
>
> Ownership: **Lead API Architect**. Last reviewed: 2026-06-26.

---

## 1. Purpose

Rate limiting protects Nexus Anime from abuse, brute-force attacks, and traffic spikes that degrade the experience for all users. Every public-facing endpoint enforces a quota; every response advertises that quota through standard headers so well-behaved clients can self-throttle.

This document defines:

- The algorithm and scoping rules that determine whose requests count toward a bucket.
- The exact quotas per endpoint category — no guessing.
- How the system behaves when the backing store (Redis) is unavailable.
- How clients should react to `429 Too Many Requests`.

Do not invent per-handler limits outside this table. If a new endpoint needs different quotas, update this document first.

---

## 2. Token bucket algorithm

Nexus Anime uses a **token bucket** rate limiter backed by Upstash Redis (`@nexus/cache`).

Conceptually:

- Each bucket starts filled with **N** tokens (the limit).
- Each request consumes **1** token.
- Tokens refill at a rate of **N / window** per second, or equivalently the bucket resets to full after the **window** elapses with no consumption.
- When the bucket is empty, the request is rejected with `429`.

The Redis implementation uses a sliding-window counter (`EVALSHA` script) that atomically increments the counter and sets the TTL. This avoids the staircase effect of fixed-window counters and does not require a background refill process.

**Parameters per rule:**

| Parameter | Meaning                                               | Example |
| :-------- | :---------------------------------------------------- | :------ |
| `limit`   | Maximum tokens in the bucket                          | `20`    |
| `window`  | Refill window in seconds                              | `60`    |
| `key`     | Bucket key: `nexus:ratelimit:{scope}:{id}:{endpoint}` | —       |

---

## 3. Per-actor scoping

A rate-limit bucket is scoped to an **actor** — the entity whose requests count toward the same counter.

| Actor          | Key segment  | When used                                          |
| :------------- | :----------- | :------------------------------------------------- |
| **User ID**    | `user:{uid}` | Authenticated requests — the Auth.js session `sub` |
| **IP address** | `ip:{addr}`  | Unauthenticated requests — the caller's IP         |

### 3.1 IP-based scoping

Used when no authenticated session exists:

- The bucket key includes the **leftmost value** from `X-Forwarded-For` (see section 10).
- If `X-Forwarded-For` is absent, the socket remote address is used.
- IP-scoped buckets receive a **stricter default** than user-scoped buckets (see section 7).

### 3.2 User-ID-based scoping

Used when a valid Auth.js session is present:

- The bucket key includes the session's `sub` (user ID).
- Authenticated actors typically receive **higher quotas** than anonymous IP buckets because they have passed identity verification.
- A single user behind a shared IP (NAT, corporate proxy) gets their own bucket and does not collide with neighbors.

### 3.3 Scoping decision

The middleware resolves the scope at request time:

```
if (session?.sub) → bucket: user:{sub}
else              → bucket: ip:{clientIp}
```

A request is never counted against both scopes simultaneously. Once a session is established, the IP bucket for that request is ignored.

---

## 4. Headers

Every response — including rejected ones — includes rate-limit headers. Clients must parse these to implement self-throttle logic.

| Header                  | Format                         | Meaning                                                             |
| :---------------------- | :----------------------------- | :------------------------------------------------------------------ |
| `X-RateLimit-Limit`     | integer                        | The maximum number of requests allowed in the current window        |
| `X-RateLimit-Remaining` | integer                        | Requests remaining in the current window (≥ 0)                      |
| `X-RateLimit-Reset`     | Unix timestamp                 | The time at which the window resets and the bucket refills          |
| `Retry-After`           | integer (seconds) or HTTP-date | Only present on `429` responses. Seconds until the client may retry |

**Rules:**

- `X-RateLimit-Remaining` is **0** when the request is rejected; it is **≥ 1** when the request is allowed.
- `Retry-After` is set **only on 429 responses**. It equals `resetTime - now`, rounded up to the next whole second.
- All four headers are returned on every response from a rate-limited endpoint, including successful ones. This lets clients adapt before hitting the limit.

---

## 5. Rate table

The following table is the **authoritative quota registry**. Every rate-limited endpoint maps to exactly one row. New endpoints must be added here before they are deployed.

| #   | Endpoint / Category           | Limit | Window (s) | Scope                     | Rationale                                               |
| :-- | :---------------------------- | ----: | ---------: | :------------------------ | :------------------------------------------------------ |
| 1   | Login / Signup                |     5 |        300 | IP (unauth) / User (auth) | Brute-force prevention; 5 attempts per 5 minutes        |
| 2   | Verify Email                  |     3 |        300 | IP                        | Prevent resend abuse                                    |
| 3   | Password Reset                |     3 |        300 | IP                        | Prevent credential-stuffing and spam                    |
| 4   | Session Refresh               |    10 |         60 | User                      | Normal tab-restore patterns                             |
| 5   | Search                        |    20 |         60 | User / IP                 | Typahead debounce at client; 20 queries/minute is ample |
| 6   | Catalog reads                 |   120 |         60 | User / IP                 | Browse-heavy; paginated cursors spread load             |
| 7   | Bookmark toggle               |    10 |         60 | User                      | Rate UI clicks, prevent script spam                     |
| 8   | Watch history heartbeat       |    30 |         60 | User                      | Client pings every 10s; 30/60 accommodates jitter       |
| 9   | Rating create / update        |    10 |         60 | User                      | Prevent rating-bot abuse                                |
| 10  | Comment create                |     5 |         60 | User                      | Anti-spam; 5 comments/minute is generous                |
| 11  | Profile update                |    10 |         60 | User                      | Avatar/bio edits are infrequent                         |
| 12  | Notification read (mark-read) |    30 |         60 | User                      | Batch mark-read on mount; 30/60 covers bulk UI          |
| 13  | Upload (avatar, banner)       |     5 |        300 | User                      | Image processing is expensive; 5 per 5 minutes          |
| 14  | Webhook — Stripe              |   100 |         60 | Stripe-Sig header         | Stripe retries on failure; generous allowance           |
| 15  | Webhook — Cloudflare Stream   |   100 |         60 | Stream-Sig header         | Same rationale as Stripe                                |
| 16  | Stream signed URL issuance    |    30 |         60 | User                      | Each URL is short-lived; 30/min supports seek/reload    |
| 17  | Export (data export, CSV)     |     1 |      3 600 | User                      | Heavy async job; 1 per hour                             |
| 18  | Health check (`/api/health`)  |    30 |         60 | IP                        | Load-balancer probes; 30/min is conservative            |

**Notation:** "User / IP" means the scope is user-scoped when a session exists, IP-scoped otherwise.

---

## 6. Global defaults vs per-endpoint overrides

The rate-limit middleware applies limits in two layers:

### 6.1 Global defaults

| Scope       | Limit | Window (s) |
| :---------- | ----: | ---------: |
| User (auth) |   120 |         60 |
| IP (unauth) |    60 |         60 |

These apply to any endpoint that does not have an explicit entry in the rate table (section 5). Deploying a new endpoint without a table entry is legal — it falls back to the global default — but it must be added to the table before the next release.

### 6.2 Per-endpoint overrides

Any entry in the rate table overrides the global default for that endpoint/category. Overrides are matched in order:

1. **Exact path match** — `/api/v1/auth/login` overrides before a wildcard.
2. **Category wildcard** — `search:*` covers `/api/v1/search/anime`, `/api/v1/search/users`, etc.
3. **Global default** — no match found; applies the scope-appropriate default.

The override configuration is a single JSON map loaded at middleware initialization. It is not dynamically reconfigurable at runtime — changes require a redeployment. This is intentional: rate-limit changes are security-sensitive and should go through review.

---

## 7. Unauthenticated limit strategy

When no valid session exists, all requests are scoped to the caller's **IP address** with a **stricter global default** (60 req/60s vs 120 req/60s for authenticated users).

Additional safeguards for unauthenticated traffic:

- **Login, Verify Email, Password Reset** always use IP scoping regardless of session state. These are pre-authentication flows; a session should not exist yet.
- **Catalog reads** for anonymous users receive the lower IP default. If an anonymous user is scraping, they hit 60/min instead of 120/min.
- **Webhooks** (Stripe, Stream) are scoped by their signature header, not by IP or user — webhook identity is verified cryptographically.

---

## 8. Auth.js session cookie verification failures

A failed session-cookie verification (e.g. expired, malformed, or tampered JWT) returns `401 Unauthorized` and is **not rate-limited**.

Rationale:

- Cookie verification is a **stateless JWT decode** — no database lookup, no Redis call, no side effects. It costs essentially nothing.
- Rate-limiting it would penalize users with expired tokens who are simply navigating the site. Every page load triggers a cookie check; a stale token on a tab left open overnight would accumulate dozens of "failures" that are not attacks.
- The server returns `401` and the client refreshes the token or redirects to login. This is normal flow, not abuse.

If credential-stuffing at the login endpoint is a concern, that is handled by the Login rate-limit (5/300s), not by cookie-check rate-limiting.

---

## 9. Redis fail-open vs fail-closed

The rate limiter depends on Redis. When Redis is unreachable, the system must decide whether to **allow** (fail open) or **reject** (fail closed) requests.

### 9.1 Default: fail open

Most endpoints **fail open** — if Redis is down, the request proceeds without rate-limit enforcement, and a `WARN` log is emitted.

This trades temporary over-consumption for availability. A fully available API with no rate limiting for a few seconds is preferable to a hard outage that blocks all traffic.

### 9.2 Exception: login fails closed

The **Login / Signup** endpoint **fails closed**. If Redis is unreachable, the login attempt is rejected with `503 Service Unavailable` and the error code `RATE_LIMIT_STORE_UNAVAILABLE`.

Rationale:

- Login is the primary brute-force target. Without rate-limit enforcement, an attacker could fire unlimited credential guesses.
- A temporary `503` on login is preferable to an undetected credential-stuffing burst.
- The response includes `Retry-After: 5` so automated clients back off.

### 9.3 Fail-closed candidates

Other endpoints that **may** be promoted to fail-closed in future (after load testing confirms the blast radius is small):

| Endpoint          | Reason                                      |
| :---------------- | :------------------------------------------ |
| Password Reset    | Credential recovery abuse                   |
| Verify Email      | OTP brute-force                             |
| Webhook endpoints | Replay attack prevention (low stakes today) |

Any promotion from fail-open to fail-closed requires a PR that updates this table and includes a blast-radius analysis.

---

## 10. X-Forwarded-For handling

Nexus Anime deploys behind Vercel's edge, which appends the connecting IP to `X-Forwarded-For` on each hop. The middleware must extract the **actual client IP** from this header.

### 10.1 Trust model

- **Trust at most one proxy hop** (Vercel's edge). This means the **leftmost value** in `X-Forwarded-For` is the client IP.
- The header format is `X-Forwarded-For: client, proxy1, proxy2, ...`. We read `values[0]`.
- If the header is **missing** when it is expected (i.e. the request arrived via HTTPS through the Vercel edge), the middleware falls back to the socket remote address (`request.ip` in Next.js) and emits a `WARN` log. This may be the proxy IP, not the client — a degraded but safe default.

### 10.2 Spoofing defense

Because we trust only one hop, an attacker who injects a fake `X-Forwarded-For` gets their spoofed value treated as the client IP. This is acceptable because:

- The spoofed IP is rate-limited under its own bucket. The attacker does not gain extra capacity — they merely shift which bucket they occupy.
- Legitimate users behind the Vercel edge are always identified by the **real** client IP that Vercel prepends. Vercel overwrites the header on ingress; the attacker's injected value is pushed rightward and ignored.

### 10.3 Never trust if missing

If `X-Forwarded-For` is absent on a production request that passed through the Vercel edge, something is wrong — either the request bypassed the edge, or the edge configuration changed. In this case:

- Fall back to `request.ip`.
- Log `WARN` with the request path and remote address.
- Do **not** assume `request.ip` is the true client IP for rate-limit key purposes if the deployment model guarantees a proxy. The fallback bucket may be shared across many users — this is a known degradation, not a design goal.

---

## 11. Monitoring

Rate-limit events are observable at three levels.

### 11.1 Metrics

Emit a counter metric on every `429` response:

```
rate_limit_rejected{endpoint="/api/v1/auth/login", scope="ip"} += 1
```

Dashboard panels should track:

- **429 rate by endpoint** — spikes on login or password-reset are security signals.
- **429 rate by scope** — a single IP hitting 429 repeatedly is likely abusive.
- **Redis error rate** — `rate_limit_store_error` fires when Redis is unreachable.

### 11.2 Logging

- Every `429` response emits a `WARN` log: `{ msg: "rate_limit_rejected", endpoint, scope, key, retryAfter }`.
- Redis failures emit `WARN`: `{ msg: "rate_limit_store_error", endpoint, error }`.
- Successful rate-limit checks (token consumed, request allowed) are **not logged** — they are normal traffic. Use the metric counter for volume.

### 11.3 Alerting

| Condition                                        | Severity | Action                                     |
| :----------------------------------------------- | :------- | :----------------------------------------- |
| 429 rate on Login exceeds 50/min across all IPs  | CRITICAL | Page on-call; possible credential attack   |
| 429 rate on any single IP exceeds 100/min        | HIGH     | Investigate; consider temporary IP block   |
| Redis error rate exceeds 1% of rate-limit checks | HIGH     | Redis may be degraded; fail-closed at risk |
| 429 rate on Password Reset exceeds 20/min        | MEDIUM   | Investigate; possible account takeover     |

Alert thresholds are per-deployment and should be tuned after the first two weeks of production traffic.

---

## 12. Client handling of 429

Clients must implement **exponential backoff** based on the `Retry-After` header when they receive a `429`.

### 12.1 Algorithm

```
1. On 429, read Retry-After header (seconds).
2. Wait for Retry-After seconds before retrying.
3. If Retry-After is absent, use a default of 1 second.
4. On subsequent 429s for the same logical request, double the wait time (exponential backoff), capped at 60 seconds.
5. After 5 consecutive 429s for the same request, abort and surface an error to the user.
```

### 12.2 Server Actions

Server Actions return the rate-limit error in the standard envelope `{ error: { code: "RATE_LIMITED", ... } }`. The client-side `Retry-After` is not an HTTP header in this case — it is included in `error.details.retryAfter`.

```ts
// Client-side Server Action error handling
const result = await toggleWatchlist({ animeId: "123" });
if (result.error?.code === "RATE_LIMITED") {
  const retryAfter = result.error.details?.retryAfter ?? 1;
  // Back off for retryAfter seconds, then retry.
}
```

### 12.3 Route Handlers

Standard HTTP. Parse `Retry-After` from the response headers.

```ts
const res = await fetch("/api/v1/search/anime?q=...");
if (res.status === 429) {
  const retryAfter = parseInt(res.headers.get("Retry-After") ?? "1", 10);
  // Back off for retryAfter seconds, then retry.
}
```

---

## 13. Examples

### 13.1 429 response (Route Handler)

**Request:**

```http
POST /api/v1/auth/login HTTP/1.1
Content-Type: application/json
X-Forwarded-For: 203.0.113.42

{ "email": "user@example.com", "password": "..." }
```

**Response (6th attempt within the window):**

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1750000000
Retry-After: 240

{
  "error": {
    "message": "Too many login attempts. Try again later.",
    "code": "RATE_LIMITED",
    "details": {
      "retryAfter": 240,
      "limit": 5,
      "window": 300
    }
  },
  "meta": {
    "requestId": "req_abc123"
  }
}
```

### 13.2 Successful response with rate-limit headers

**Request:**

```http
GET /api/v1/search/anime?q=attack+on+titan HTTP/1.1
Authorization: Bearer eyJ...
```

**Response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 14
X-RateLimit-Reset: 1750000060

{
  "data": [ ... ],
  "meta": {
    "requestId": "req_def456",
    "pagination": { "nextCursor": "...", "hasMore": true }
  }
}
```

Note: `Retry-After` is **absent** on successful responses. It is only set on `429`.

### 13.3 Header parsing (client-side)

```ts
function parseRateLimitHeaders(headers: Headers): {
  limit: number;
  remaining: number;
  reset: Date;
} {
  return {
    limit: parseInt(headers.get("X-RateLimit-Limit") ?? "0", 10),
    remaining: parseInt(headers.get("X-RateLimit-Remaining") ?? "0", 10),
    reset: new Date(parseInt(headers.get("X-RateLimit-Reset") ?? "0", 10) * 1000),
  };
}

// Usage:
const rl = parseRateLimitHeaders(response.headers);
if (rl.remaining <= 2) {
  console.warn(
    `Approaching rate limit: ${rl.remaining} requests left until ${rl.reset.toISOString()}`,
  );
}
```

### 13.4 Server Action rate-limit error

```ts
// apps/web/src/actions/watchlist.ts
"use server";

export async function toggleWatchlist({ animeId }: { animeId: string }) {
  // Rate-limit check happens at middleware before this body runs.
  // If rejected, the client receives:
  // {
  //   error: {
  //     message: "Too many requests. Try again later.",
  //     code: "RATE_LIMITED",
  //     details: { retryAfter: 12, limit: 10, window: 60 },
  //   },
  //   meta: { requestId: "req_ghi789" },
  // }
}
```

---

## 14. Changelog

| Date       | Change                              | Ticket / PR |
| :--------- | :---------------------------------- | :---------- |
| 2026-06-26 | Initial rate-limiting specification | —           |

---

## 15. License & ownership

This specification is under the same license as the Nexus Anime repository. Rate-limit policy changes require review from the **Lead API Architect** and one approving engineer. Quota reductions on security-sensitive endpoints (Login, Password Reset, Verify Email) require two approving engineers.
