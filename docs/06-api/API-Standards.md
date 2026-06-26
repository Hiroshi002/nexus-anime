# API Standards

This document defines the transport, serialization, envelope, naming, caching, versioning, pagination, security, and deprecation standards for every HTTP API surface in Nexus Anime. Route handlers, Server Action responses consumed over HTTP, and webhooks MUST conform to these standards unless an exception is documented on the specific endpoint.

Related references:

- [Versioning.md](./Versioning.md) — API version negotiation rules.
- [Pagination.md](./Pagination.md) — cursor and offset pagination schemas.
- [Authentication.md](./Authentication.md) — Auth.js session, OAuth flows, and scoped API token shapes.
- [Errors.md](./Errors.md) — machine-readable `ApiError` codes referenced by this document.

---

## 1. Purpose

The goal of this document is to guarantee that every endpoint in the Nexus Anime platform behaves predictably: clients can depend on uniform envelope shapes, consistent naming, stable error semantics, and explicit caching and deprecation signals. When an endpoint deviates from this standard, the deviation MUST be documented in the endpoint's route handler JSDoc and tracked in the relevant ADR.

Scope:

- All HTTP route handlers under `apps/web/app/api/**`.
- Any internal RPC or service-to-service HTTP call that traverses a network boundary.
- Outbound webhook payloads sent from Nexus Anime to partners (same envelope, signed separately).

Out of scope:

- GraphQL or gRPC (not in the current architecture; would require a separate ADR).
- Server-Sent Events or WebSocket payloads (see Streaming ADR if introduced).

---

## 2. Transport

### HTTPS Only

Every endpoint MUST be served over HTTPS. HTTP requests MUST receive a 301 Moved Permanently redirect except for health checks which MAY remain available for tooling probes.

### HSTS

The `Strict-Transport-Security` response header MUST be sent on every response:

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

### TLS Version

Minimum TLS version is 1.2. TLS 1.3 is preferred. Older clients MUST be rejected by the CDN/load balancer; application code MUST NOT need to validate this.

### Connection Reuse

Clients SHOULD use HTTP/2 multiplexing and connection reuse. The server MAY send `Keep-Alive` hints but MUST NOT require persistent connections for correctness.

---

## 3. Serialization

### JSON Body Encoding

All request and response bodies MUST be encoded as UTF-8 JSON without BOM. The server MUST reject a body with a UTF-8 BOM with status 400.

`Content-Type` header requirements on requests:

| Method | Required Content-Type | Notes |
|--------|-----------------------|-------|
| GET, HEAD, DELETE | Optional (no body) | MUST NOT send a body |
| POST, PUT, PATCH | `application/json` (exact, UTF-8) | 415 Unsupported Media Type otherwise |

### Content-Type Response Header

Every response with a body MUST include:

```
Content-Type: application/json; charset=utf-8
```

### No Extraneous Whitespace in Production

Pretty-printing MAY be enabled only when `NODE_ENV !== "production"` and the request includes `?pretty`. In production, compact JSON (`{"d":1}` spacing only where required).

### Binary Uploads

Multipart uploads (e.g. avatar, cover image) MUST use `multipart/form-data` and are limited to 10 MB per request (see Payload Limits).

---

## 4. Envelope Format

All JSON responses use a discriminated envelope. Success responses MUST contain only the `data` key. Error responses MUST contain only the `error` key. Validation errors use the `error` shape with `code: "VALIDATION_ERROR"` and a `details` array.

### Success Shape

```json
{
  "data": { ... }
}
```

`data` MAY be `null` for void responses (e.g. `DELETE` success) but MUST still be present.

### Error Shape

```json
{
  "error": {
    "message": "Human-readable English message",
    "code": "MACHINE_READABLE_CODE",
    "details": { }
  }
}
```

- `message`: user-facing string, MUST NOT leak stack traces, secrets, or internal URLs.
- `code`: string from the error code registry (see `docs/06-api/Errors.md`).
- `details`: optional context object.

### Validation Error Shape

```json
{
  "error": {
    "message": "Request validation failed",
    "code": "VALIDATION_ERROR",
    "details": {
      "issues": [
        { "path": ["email"], "message": "Invalid email address", "code": "invalid_string" }
      ]
    }
  }
}
```

The `issues` array follows a lightweight subset of Zod's `ZodIssue` format.

---

## 5. Naming Conventions

Consistent naming reduces friction between backend (PostgreSQL `snake_case`) and frontend (JavaScript `camelCase`).

| Layer | Convention | Example |
|-------|-----------|---------|
| URL path segments | lowercase-hyphenated | `/api/v1/watchlist-items` |
| Query parameters | camelCase | `?sortOrder=asc&pageSize=20` |
| JSON request/response fields | camelCase | `"createdAt"`, `"displayName"` |
| HTTP headers | Hyphenated title case | `Idempotency-Key`, `Accept-Language` |
| Database columns | snake_case (in schema only, never leaked) | `created_at`, `display_name` |

Rules:

- Do NOT alias fields between camelCase and snake_case. One name per concept based on its layer.
- URL path segments MUST be plural resources except for `me`, `health`, and similar singleton resources.
- Boolean query params use `true`/`false` strings, not `1`/`0`.
- Enums in JSON use lowercase-hyphenated strings (e.g. `"not_started"`, `"in_progress"`).

---

## 6. Time Format

### Default: ISO 8601 UTC

All datetime fields in JSON request/response bodies MUST be ISO 8601 with UTC offset, formatted as:

```
YYYY-MM-DDTHH:mm:ss.sssZ
```

Example: `"2026-06-26T14:30:00.000Z"`

Rules:

- Server MUST store and return times in UTC. Client localization is a presentation concern.
- Fractional seconds to millisecond precision (3 digits). Do not emit more.
- If a field documents "epoch seconds", the field name MUST end in `At` with number type (e.g. `expiresAt: 1750945800`). Only use epoch seconds where explicitly documented (e.g. JWT claims, signed URL expiry).

### Common Pitfalls

- Never send local-offset strings like `2026-06-26T14:30:00+09:00` unless the endpoint contract explicitly requires a user-local representation.
- Never use Unix milliseconds in JSON responses; prefer ISO 8601 for readability and JSON-native compatibility.

---

## 7. Date Filtering

Date-range filters use `from` and `to` query parameters.

### Format

- Single date: `YYYY-MM-DD` (no time component). Example: `?from=2026-06-01`.
- ISO 8601 range: `?from=2026-06-01T00:00:00.000Z&to=2026-06-30T23:59:59.999Z`.

### Semantics

Where a single date `YYYY-MM-DD` is used, the semantics are **inclusive of the entire calendar day in the requesting user's timezone**, resolved server-side using the `tz` query parameter (IANA timezone, default `UTC`).

### Combinations

- `from` alone: lower bound inclusive, no upper bound.
- `to` alone: upper bound inclusive, no lower bound.
- Both: `[from, to]` inclusive on both ends.

Errors:

- `from > to`: returns `VALIDATION_ERROR`.
- Malformed date: returns `VALIDATION_ERROR`.

---

## 8. Localization

### Accept-Language Header

Clients SHOULD send `Accept-Language` on every request. Supported tags:

| Tag | Status |
|-----|--------|
| `en-US` | Default, always supported |
| `ja-JP` | Supported, translated UI strings |
| Others | Treated as `en-US` (no error, silent fallback) |

Format follows RFC 7231, e.g. `ja-JP,ja;q=0.9,en-US;q=0.8`.

### Response

Localized user-facing strings MUST be returned based on the resolved `Accept-Language`. The server MUST also emit a `Content-Language` response header matching the language actually used for localized strings.

### Fallback Order

1. Exact match on primary tag (`ja-JP`).
2. Base language fallback (`ja` → `ja-JP`).
3. Default (`en-US`).

No 400 or 406 is raised for unsupported languages; fall back silently to `en-US`.

---

## 9. Idempotency

An idempotent request has the same effect on server state whether it is issued once or multiple times.

### Idempotency-Key Header

```
Idempotency-Key: <uuid-v4 or opaque token, max 128 chars>
```

### When Required vs Recommended

| Condition | Idempotency-Key |
|-----------|-----------------|
| Write endpoints that are not natively idempotent by HTTP method (e.g. POST create) | Required |
| Payment creation, webhook trigger, watchlist mutations | Required |
| PUT full-replace | Recommended (defensive against partial retries) |
| PATCH with idempotent semantics | Recommended |
| Read endpoints (GET, HEAD, DELETE) | Optional |

Requests to endpoints marked **Required** that lack a valid `Idempotency-Key` MUST return `400 Bad Request` with code `IDEMPOTENCY_KEY_REQUIRED`.

### Server Behavior

1. Key is stored in Redis (via `@nexus/cache`) under key prefix `nexus:idem:{hashOfKey}`.
2. TTL: **24 hours**.
3. On first request: store response body (status + data) and return.
4. On repeat request: return stored response without re-executing handling logic. Responses MUST be byte-identical including `X-Request-Id` of the original request.
5. Concurrent duplicate: the second request waits for the first to complete, then serves the stored response.

### Key Requirements

- Clients MUST generate a new key per logical user intent. Reusing a key after 24h is treated as a new intent.
- Keys MUST be globally unique per tenant (user or service account). Prefix with a tenant-scoped secret client-side for safety.

---

## 10. HTTP Method Semantics

Methods have strict usage rules. Do not use GET for mutations, POST for idempotent updates, or PUT for partial patching.

### Semantics Table

| Method | Safe | Idempotent | Cacheable | Typical Use |
|--------|------|------------|-----------|-------------|
| GET | Yes | Yes | Yes | Read resource or list |
| HEAD | Yes | Yes | Yes | Resource metadata (size, last-modified) |
| OPTIONS | Yes | Yes | Yes | CORS preflight |
| POST | No | No | Only with explicit Cache-Control and ETag | Create resource; non-idempotent by default |
| PUT | No | Yes | No | Full replace of a resource by ID |
| PATCH | No | Yes (signed) | No | Partial update; MUST document idempotency |
| DELETE | No | Yes | No | Soft or hard delete by ID |

### Rules

- GET MUST NOT cause observable side effects beyond logging and analytics.
- POST responses SHOULD return `201 Created` with a `Location` header pointing to the new resource. `200 OK` is acceptable when the response body is required immediately.
- PUT MUST fully replace the resource. Partial fields are overwritten with provided values; omitted fields MUST receive their schema defaults or be rejected with `VALIDATION_ERROR`.
- PATCH MUST merge or replace only the provided fields. JSON Merge Patch (`application/merge-patch+json`) or JSON Patch (`application/json-patch+json`) is acceptable when documented per endpoint.
- DELETE returning `204 No Content` for hard deletes, `200 OK` for soft deletes that return a tombstone.

---

## 11. Response Caching

### Read Endpoints

Read endpoints SHOULD support conditional requests via `ETag` and `If-None-Match`.

- Server emits: `ETag: "<hex-hash>"`, `Cache-Control: public, max-age=60, stale-while-revalidate=30`.
- Client sends: `If-None-Match: "<hex-hash>"`.
- Server responds with `304 Not Modified` when ETag matches.

Cache-Control directives:

| Endpoint Type | Cache-Control |
|--------------|---------------|
| Public catalog detail | `public, max-age=300, stale-while-revalidate=60` |
| Trending / homepage | `public, max-age=60, stale-while-revalidate=15` |
| Authenticated user data | `private, max-age=0, must-revalidate` |
| Me / profile | `private, max-age=0, must-revalidate` |

### Mutation Endpoints

Mutation endpoints MUST emit:

```
Cache-Control: no-store, no-cache, must-revalidate
```

And MUST NOT emit `ETag`.

---

## 12. Standard Request Headers

### Per-Endpoint Responsibility

The table below defines the minimum set of headers each category of endpoint requires.

| Header | Read Endpoints | Authenticated Mutations | Public Writes (pre-auth) |
|--------|:---:|:---:|:---:|
| `User-Agent` | Required | Required | Required |
| `Accept` (`application/json`) | Required | Required | Required |
| `Content-Type` (for body) | N/A | Required | Required |
| `Accept-Language` | Recommended | Recommended | Recommended |
| `Authorization` (Bearer) | Optional (public read) | Required | N/A |
| `Idempotency-Key` | No | Required | N/A |
| `If-None-Match` | Optional | No | No |
| `X-Client-Version` | Recommended | Recommended | Recommended |

Requests without a valid `User-Agent` MUST be rejected with `400 Bad Request` and code `USER_AGENT_REQUIRED`.

### Required User-Agent Format

```
{client-name}/{version} ({platform})
```

Example: `NexusWeb/1.0.0 (browser)`, `NexusiOS/2.1.0 (iOS 18)`.

Empty, generic, or spammy user agents (e.g. `curl/`, `python-requests/` without a registered partner header) are rejected unless allowlisted via internal partner registry.

---

## 13. Standard Response Headers

Every response SHOULD include the following headers.

| Header | Required | Description |
|--------|----------|-------------|
| `X-Request-Id` | Yes | UUID v4 unique per request. Returned in error responses for traceability. |
| `X-Response-Time` | Recommended | End-to-end latency in milliseconds. |
| `Content-Type` | Yes | `application/json; charset=utf-8` or multipart content type. |
| `Content-Language` | When localized | Match the resolved language of the response body strings. |
| `Cache-Control` | Yes | As defined in caching section. |
| `ETag` | On reads | Hex hash of response body. |
| `Vary` | Yes | At minimum `Accept-Language, Accept-Encoding, Authorization` on endpoints where response depends on these. |

### Rate Limit Headers

When rate limits are enforced, emit:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Budget per window |
| `X-RateLimit-Remaining` | Remaining tokens |
| `X-RateLimit-Reset` | Seconds until window resets |
| `Retry-After` | Present on 429 responses; seconds until retry is allowed |

### Deprecation and Sunset Headers

When an endpoint is deprecated or scheduled for removal (see Deprecation Policy):

| Header | Description |
|--------|-------------|
| `Deprecation` | Date string in the format `@<RFC3339 date>` |
| `Sunset` | RFC3339 date when endpoint will shut off |
| `Link` | `<url>; rel="successor-version"` pointing to replacement endpoint |
| `X-Env-Announcement` | Optional short deprecation message |

---

## 14. Versioning

Full policy: [Versioning.md](./Versioning.md).

Summary:

- Path-based versioning: `/api/v1/...`, `/api/v2/...`.
- Minimum one prior version maintained for 12 months after a new major version ships.
- Minor and patch changes are expressed via content negotiation (Accept header with vendor MIME `application/vnd.nexus+json;v=1`) but the URL major version is the source of truth.
- Breaking changes require a major version bump and a new ADR.

---

## 15. Pagination

Full policy: [Pagination.md](./Pagination.md).

Summary:

- Default strategy is **cursor pagination** for list endpoints that grow or shift (e.g. watchlist).
- **Offset pagination** is allowed on static or admin-only lists with `page` and `pageSize`.
- Default page size: 20. Max page size: 100.
- Response envelope wraps `data` in a list shape with `items`, `nextCursor` or `total` as appropriate.

---

## 16. CORS Policy

CORS is enforced via `next.config.ts` middleware. The application does NOT handle CORS at the route layer; it relies on configured rules.

| Setting | Value |
|---------|-------|
| `Access-Control-Allow-Origin` | Origin allowlist for known clients (e.g. web app domain); NEVER `*` in production. |
| `Access-Control-Allow-Methods` | `GET, POST, PUT, PATCH, DELETE, OPTIONS` |
| `Access-Control-Allow-Headers` | `Content-Type, Accept, Accept-Language, Authorization, Idempotency-Key, X-Client-Version` |
| `Access-Control-Expose-Headers` | `X-Request-Id, X-RateLimit-*, ETag, Content-Language, Deprecation, Sunset, Link` |
| `Access-Control-Max-Age` | `86400` (24 hours) |

Preflight responses MUST be returned for cross-origin requests with `204 No Content`. Credentials (cookies, Authorization) are allowed only from the allowlisted origin.

---

## 17. CSRF Protection

### Auth.js Double Submit Cookie

All browser cookie-authenticated endpoints rely on Auth.js v5's built-in double-submit CSRF cookie pattern:

- A `csrf-token` cookie is set on login.
- Client reads the cookie and sends it in the `X-CSRF-Token` header on mutations.
- Server validates the header against the cookie value.

### Immutability Tokens for Sensitive Operations

For domains where CSRF via XSS is a concern beyond the Auth.js defaults (e.g. payment operations, account deletion), the server MUST additionally require an **immutability token**:

- Server issues a `signed_immutability_token` scoped to user + resource + action + 5-minute TTL.
- Client includes the token in the `X-Immutability-Token` header.
- Server validates the token's signature, scope, and expiry before executing the action.

Rules:
- Tokens MUST be single-use: reuse of a consumed token MUST fail.
- Failed immutability token responses return `403 Forbidden` with code `IMMUTABILITY_TOKEN_INVALID`.

---

## 18. Payload Size Limits

| Content Type | Max Body Size | Enforcement |
|-------------|---------------|-------------|
| `application/json` | 1 MB | Rejected with `413 Payload Too Large` and code `PAYLOAD_TOO_LARGE` |
| `multipart/form-data` | 10 MB | Rejected with `413 Payload Too Large` |
| Nested depth | Max 10 levels of nesting | Rejected with `VALIDATION_ERROR` |

Requests that exceed these limits MUST be rejected before body parsing completes (e.g. via `bodyParser.sizeLimit` in Next.js route handlers). The error response MUST include:

```json
{
  "error": {
    "message": "Request body exceeds maximum allowed size",
    "code": "PAYLOAD_TOO_LARGE",
    "details": { "maxBytes": 1048576 }
  }
}
```

---

## 19. User-Agent

### Required

Every incoming request MUST include a `User-Agent` header. The server MUST reject requests without a `User-Agent` header with:

```
400 Bad Request
```

```json
{
  "error": {
    "message": "User-Agent header is required",
    "code": "USER_AGENT_REQUIRED"
  }
}
```

### Validation

- Must be non-empty and at least 4 characters.
- Must match the expected format of a real client (reject empty strings, strings consisting only of whitespace, or known bot/spam signatures not in the partner allowlist).
- Automated partners (e.g. monitoring, webhooks) SHOULD use a signed partner token in `X-Partner-Token` header and a clear UA like `NexusMonitor/1.0`.

---

## 20. Deprecation Policy

Deprecation is a 12-month, three-phase process.

### Rollout Phases

1. **Deprecated** — the endpoint is marked as deprecated but still fully functional. Response headers MUST include `Deprecation` and a `Link` pointing to the successor endpoint. SLA remains unchanged.
2. **Sunset Window** — a fixed period (minimum 6 months) before removal. The `Sunset` header is added. The response body MUST include a soft warning under `data._meta.deprecation`. SLA for bug fixes drops to critical-only.
3. **Removed** — endpoint returns `410 Gone` with a JSON response directing clients to the successor. A non-configurable grace endpoint redirect MAY exist for read endpoints for 30 days.

### Requirements

- All `Deprecation` and `Sunset` dates MUST be published in the project changelog.
- Client libraries and SDKs MUST be updated to remove calls to deprecated endpoints.
- The API deprecation MUST be noted in the release notes with migration code examples.
- Communication with registered partners (via webhook notification) MUST occur at least 90 days before the Sunset date.

### Deprecation Header Example

```
Deprecation: @2027-06-26T00:00:00.000Z
Sunset: @2027-12-26T00:00:00.000Z
Link: </api/v2/watchlist-items>; rel="successor-version"
```

---

## Appendix: Response Code Quick Reference

The table below lists HTTP codes referenced in this document. Full semantics live in [Errors.md](./Errors.md).

| Code | HTTP Status | Usage |
|------|-------------|-------|
| `200 OK` | 200 | Standard success for reads and idempotent writes |
| `201 Created` | 201 | Successful POST creating a new resource |
| `204 No Content` | 204 | Successful DELETE or void action |
| `304 Not Modified` | 304 | ETag-matched conditional read |
| `400 Bad Request` | 400 | Malformed request, missing required header (User-Agent, Idempotency-Key) |
| `401 Unauthorized` | 401 | Missing or invalid session/token |
| `403 Forbidden` | 403 | Valid auth, insufficient scope, or invalid immutability token |
| `404 Not Found` | 404 | Resource not found |
| `405 Method Not Allowed` | 405 | Unsupported HTTP method for the endpoint |
| `406 Not Acceptable` | 406 | Requested content type cannot be served |
| `409 Conflict` | 409 | State conflict (e.g. duplicate create) |
| `410 Gone` | 410 | Resource removed and no longer accessible |
| `413 Payload Too Large` | 413 | Request body exceeds size limits |
| `415 Unsupported Media Type` | 415 | Missing or invalid Content-Type for POST/PUT/PATCH |
| `429 Too Many Requests` | 429 | Rate limit exceeded |
| `500 Internal Server Error` | 500 | Unexpected server fault |
| `502 Bad Gateway` | 502 | Upstream failure |
| `503 Service Unavailable` | 503 | Planned maintenance or circuit-breaker open |

---

**When editing this file:** additions or changes that affect endpoint behavior require a corresponding change in the route handler implementation and tests within the same PR. Do not declare a rule here that is not actually enforced.
