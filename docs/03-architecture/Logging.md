# Logging — Nexus Anime

> **Audience:** Engineers implementing observability, debugging, and audit trails. This document defines the logging architecture, structured log format, and what to log vs. what not to log.

---

## 1. Logging Library

**Pino** — a structured JSON logger for Node.js.

### Why Pino over alternatives

| Alternative | Why rejected |
|-------------|-------------|
| `console.log` | Unstructured, no log levels, no context enrichment, not JSON-parseable by log aggregators |
| Winston | Feature-rich but slower (5–10x vs Pino). Unnecessary transports — we use Vercel's built-in log aggregation. |
| Bunyan | Good but unmaintained. Pino is the spiritual successor. |
| Next.js built-in logger | No structured logging, no custom transports, no log level control. |

Pino is the fastest Node.js logger (asynchronous by default), produces structured JSON, and integrates with Vercel's log aggregation.

---

## 2. Structured Log Format

Every log entry is JSON with consistent fields:

```json
{
  "level": "info",
  "time": 1700000000000,
  "msg": "Anime detail served",
  "requestId": "req-uuid-123",
  "userId": "user-uuid-456",
  "animeId": "anime-uuid-789",
  "cacheHit": true,
  "duration": 45,
  "service": "catalog",
  "environment": "production"
}
```

### Required fields

| Field | Type | Source | Why |
|-------|------|--------|-----|
| `level` | `trace`/`debug`/`info`/`warn`/`error`/`fatal` | Pino | Filter and alert by severity |
| `time` | ISO 8601 or epoch | Pino (automatic) | Timestamp for ordering and correlation |
| `msg` | string | Application code | Human-readable summary |
| `requestId` | UUID | `x-request-id` header or generated | Correlate all logs for a single request |
| `service` | string | Application code | Identify which service/module produced the log |
| `environment` | string | `NODE_ENV` | Filter production vs. staging logs |

### Optional context fields

| Field | When |
|-------|------|
| `userId` | Authenticated requests |
| `animeId`, `episodeId` | Catalog operations |
| `cacheHit` | Cache reads |
| `duration` | Timed operations (DB queries, upstream calls) |
| `upstream` | External API calls (name + status) |
| `statusCode` | HTTP responses |
| `errorCode` | AppError code |
| `featureFlag` | Feature flag evaluations |

---

## 3. Log Levels

| Level | When | Example |
|-------|------|---------|
| `fatal` | Unrecoverable system failure | Database unreachable, config missing |
| `error` | Operation failed, needs attention | Auth failure, upstream API 5xx, unhandled exception |
| `warn` | Unexpected but recoverable | Cache miss on expected hit, rate limit hit, deprecated API usage |
| `info` | Normal operation, business-significant | User login, anime viewed, watchlist updated, checkout started |
| `debug` | Detailed diagnostics (dev only) | Query SQL, cache key, request headers |
| `trace` | Very verbose (dev only) | Function entry/exit, variable values |

### Production log level: `info`

`debug` and `trace` are disabled in production. This is enforced by the logger configuration:

```ts
const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
});
```

### Why info, not debug, in production

Debug logs are voluminous (every cache read, every function entry). In production, they create noise and cost (Vercel charges for log ingestion). `info` captures business-significant events. If a production issue needs debug-level detail, we temporarily set `LOG_LEVEL=debug` via an environment variable — not permanently.

---

## 4. Request Logging

### Middleware request ID

Every request gets a unique ID for log correlation:

```ts
// middleware.ts
export function middleware(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const response = NextResponse.next();
  response.headers.set("x-request-id", requestId);
  return response;
}
```

### Request-scoped logger

A child logger is created per request with the request ID bound:

```ts
const requestLogger = logger.child({ requestId, userId: session?.user?.id });
```

All logs within that request automatically include the request ID and user ID, enabling log aggregation tools to filter by request.

---

## 5. What to Log

### Always log

- User authentication events (login, logout, OAuth callback, session expiry)
- Mutations (watchlist toggle, profile update, checkout)
- Errors (all `AppError` throws)
- Upstream API calls (status code, duration, cache hit)
- Rate limit hits
- Feature flag evaluations (at `debug` level)

### Never log

- Passwords (plaintext or hashed)
- Session tokens
- API keys (TMDB, Stripe, Stream)
- Full request bodies (may contain PII — passwords in login forms, email in signup forms)
- Full response bodies from upstream APIs (may contain proprietary data)
- Connection strings (DATABASE_URL, REDIS_URL)
- Internal URLs or infrastructure details

### Log with caution

- User email — only in auth-specific logs, not in general request logs
- IP address — only for rate limiting and fraud detection, not in general request logs
- User-agent — useful for debugging, but can be long and noisy

---

## 6. Performance Logging

### Slow query detection

Database queries are timed. Queries exceeding a threshold are logged at `warn`:

```ts
async function timedQuery<T>(label: string, fn: () => Promise<T>, threshold = 200): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  requestLogger.info({ query: label, duration }, "Query completed");

  if (duration > threshold) {
    requestLogger.warn({ query: label, duration, threshold }, "Slow query detected");
  }

  return result;
}
```

### Upstream API latency

External API calls log their duration for SLO monitoring:

```ts
requestLogger.info({
  upstream: "tmdb",
  operation: "searchAnime",
  duration: 320,
  statusCode: 200,
  cacheHit: false,
}, "Upstream API call");
```

### Why duration logging

Latency is the #1 observability signal for a streaming platform. If TMDB responses slow from 100ms to 2000ms, we need to know — the user sees a blank page while waiting. Duration logging enables SLO alerting (e.g., "p95 TMDB latency > 500ms for 5 minutes → alert").

---

## 7. Audit Logging

Certain operations require an immutable audit trail for compliance and debugging:

| Event | Fields logged |
|-------|--------------|
| User signup | `userId`, `email`, `provider`, `ipAddress` |
| User login | `userId`, `provider`, `ipAddress` |
| Password change | `userId`, `ipAddress` |
| Account deletion | `userId`, `ipAddress` |
| Subscription change | `userId`, `planId`, `action` (create/cancel/upgrade) |
| Admin action | `adminUserId`, `targetUserId`, `action` |

### Why separate audit log concept

Audit logs must be immutable and retained longer than operational logs. In practice, they use the same Pino logger but are routed to a separate retention policy by the log aggregator (Vercel or Datadog). The application doesn't need a separate transport — the structured fields (`audit: true`) enable pipeline-level routing.

---

## 8. Error Reporting Integration

### Vercel Integration (default)

Vercel aggregates all `console.error` and structured logs. No additional SDK needed.

### Future: Sentry (M4+)

For applications needing error grouping, replay, and alerting beyond Vercel's built-in:

```ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,  // 10% of transactions
  replaysSessionSampleRate: 0.01,  // 1% of sessions
});
```

### Why defer Sentry

Vercel's built-in error tracking is sufficient for M0–M3. Sentry adds value when the application has complex client-side errors (video player, payment flows) that need session replay. This is M5+ territory.

---

## 9. Development Logging

In development, logs are pretty-printed for readability:

```ts
const logger = pino({
  transport: process.env.NODE_ENV === "development"
    ? { target: "pino-pretty" }
    : undefined,
});
```

### Why pino-pretty in dev

Raw JSON logs are hard to read in a terminal. `pino-pretty` formats them with colors and indentation. In production, we log raw JSON for machine consumption (log aggregators parse JSON natively).
