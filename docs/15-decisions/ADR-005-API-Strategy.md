# ADR-005 — Server Actions for Web, Route Handlers for Everything Else

- **Status:** accepted
- **Deciders:** Tech Lead, Staff Engineer, API Designer
- **Date:** 2026-05-03
- **Supersedes:** None
- **Superseded by:** None
- **Related:** ADR-001, ADR-002
- **References:** docs/06-api/API-Overview.md, docs/06-api/API-Standards.md, docs/06-api/Error-Codes.md

## Context

Nexus Anime needs an API strategy that serves two masters: the web app
(which benefits from tight coupling to the Next.js runtime) and potential
external consumers (a future mobile app, a partner integration, an admin
dashboard) that need a stable REST contract.

The forces at play were:

- **Dual mutation entry points.** Server Actions are the ergonomic choice
  for web mutations — they run in the same TypeScript context as the
  caller, use the Auth.js session cookie automatically, and integrate
  with `revalidatePath`/`revalidateTag` for cache invalidation. But
  Server Actions are not callable from outside the Next.js runtime. A
  mobile app cannot POST to a Server Action.
- **Webhooks.** Stripe, Cloudflare Stream, and (potentially) analytics
  providers send webhooks to our endpoints. These are external HTTP
  callers that cannot use Server Actions.
- **Consistency.** A consumer receiving an error from a Server Action
  (via `useActionState`) and an error from a Route Handler (via HTTP)
  must see the same envelope shape. Otherwise, the client must branch
  on the transport, which is a maintenance burden.
- **Mobile readiness.** The product roadmap may include a native app.
  If it does, the app must consume a REST API from day one. We cannot
  retrofit REST endpoints after the mobile app is built — the
  contracts must exist from the start.

We considered three alternatives:

1. **Server Actions only.** Use Server Actions for everything, expose
   them via a thin HTTP proxy for external callers. Rejected because:
   (a) Server Actions are not designed for external HTTP
   invocation — they do not support content negotiation, versioning,
   or CORS; (b) the "thin proxy" becomes a complex translation layer
   that strips away the flexibility of both Server Actions and HTTP; (c)
   we cannot version Server Actions — they are tied to the application
   deployment.
2. **REST only.** Replace Server Actions with Route Handlers for
   all mutations. Rejected because: (a) Route Handlers are more
   boilerplate (parse request, validate body, format response) for
   web callers who already have the session cookie; (b) progressive
   enhancement (form submissions without JS) is harder to achieve
   with Route Handlers; (c) the team loses the end-to-end type safety
   of Server Actions — the HTTP boundary breaks the TypeScript
   contract.
3. **GraphQL.** Unified API via GraphQL. Rejected for v1 because:
   (a) GraphQL is a read-optimized technology; mutations in GraphQL
   are a second-class citizen with weaker tooling; (b) our team has
   more REST experience; (c) GraphQL adds a schema layer, a query
   parser, and complexity around file subscriptions and caching that
   we do not need yet. A read-only GraphQL layer is earmarked for M5+.

## Decision

We use **two distinct mutation surfaces** with a **single envelope
format**:

### Surface 1: Server Actions (web only)

All web mutations use Server Actions — async functions decorated with
`"use server"`. Validation happens at the top of the action via Zod.
Cache invalidation uses `revalidatePath`/`revalidateTag`.

Server Actions are the default for web. Every new feature starts here.

A Server Action is chosen when:
- The caller is a web component (Server or Client).
- The mutation needs the Auth.js session cookie.
- The caller benefits from `useActionState` (pending state, optimistic
  updates).
- The action runs inside the Next.js runtime.

### Surface 2: Route Handlers (external + webhooks)

REST endpoints are Route Handlers under `apps/web/app/api/v1/**`. They
use standard HTTP method routing (`GET`, `POST`, `PUT`, `PATCH`,
`DELETE`). Every request is validated with Zod. Every response uses
the envelope format.

A Route Handler is chosen when:
- The caller is external (mobile app, partner, cron).
- The endpoint is a webhook (Stripe, Cloudflare Stream).
- The endpoint must be cacheable at the edge (`Cache-Control`
  headers).
- The endpoint must support content negotiation or CORS.

### Universal envelope

Every successful response (from both surfaces) uses:

```json
{
  "data": <T>,
  "meta": {
    "requestId": "uuid-v4"
  }
}
```

Every error response uses:

```json
{
  "error": {
    "message": "Human-readable message",
    "code": "VALIDATION_ERROR",
    "details": { "field": "email" }
  },
  "meta": {
    "requestId": "uuid-v4"
  }
}
```

The `code` is a string enum defined in `docs/06-api/Error-Codes.md`.
The envelope is the floor, not the ceiling — responses may include
additional fields, but they must always carry `data` (success) or
`error` (failure) at the top level.

### Per-surface authentication

| Surface | Mechanism |
|---|---|
| Server Actions | Auth.js session cookie + `requireUser()` helper |
| Route Handlers (user) | Bearer OAuth2 token + middleware |
| Route Handlers (webhook) | HMAC signature verification |
| Route Internal (worker) | mTLS + service token |

A critical rule: **never trust a session cookie at a Route Handler.**
Route Handlers that require user context validate a Bearer token at the
middleware boundary. This prevents CSRF-via-fetch attacks where a
malicious page could trigger a Route Handler using the user's cookies.

### URL pinning

REST endpoints are pinned to a URL prefix: `/api/v1/anime/[id]`.
Breaking changes bump the prefix to `/api/v2/`. Old versions are
supported for 12 months (see the deprecation policy in
API-Standards.md).

Server Actions are not versioned — they are tied to the application
deployment.

### Cursor pagination

All collection endpoints use cursor pagination, never page-offset.
Cursors are opaque base64-encoded strings. This is a hard rule —
page-offset pagination is forbidden on collection endpoints because it
produces inconsistent results under concurrent writes.

## Consequences

### Positive

- **Server Actions are fast to build.** An action is a function + a
  Zod schema. No request parsing, no response formatting, no CORS.
  A new feature can ship its mutation layer in minutes.
- **REST is mobile-ready from day one.** When the mobile team arrives,
  the endpoints exist, the contracts are documented, the error codes
  are defined. No retrofit required.
- **Consistent error handling.** Every error, regardless of surface,
  produces the same envelope. A client can write one error handler
  that works everywhere.
- **Webhooks are first-class.** Stripe and Cloudflare Stream call
  Route Handlers with HMAC-verified payloads. No tunneling, no
  middleware hacks, no local ngrok.
- **Cache strategy is per-surface.** Route Handlers emit
  `Cache-Control` headers (public for catalog, private for user data,
  no-store for mutations). Server Actions use `revalidatePath` /
  `revalidateTag`. Each surface uses the invalidation mechanism that
  fits its execution model.
- **URL versioning is clean.** The `/v1/` prefix makes it explicit which
  contract a consumer is using. Breaking changes are a prefix bump,
  not a query parameter or header negotiation.

### Negative

- **Dual mutation entry points.** A developer building a feature that
  must be callable from both web and mobile must write the logic
  twice: once in a Server Action (web) and once in a Route Handler
  (external), or extract the logic into a shared service and call
  it from both.
  **Mitigation:** The service layer ADR (ADR-001 §Repositories and
  Services) requires business logic to live in services. Both the
  Server Action and the Route Handler are thin wrappers around the
  same service function. The logic lives once; the transport differs.
- **Zod boilerplate.** Every Route Handler validates the request body
  with Zod and validates the response with Zod. This is repetitive.
  **Mitigation:** A `createRouteHandler` wrapper in
  `apps/web/src/lib/api/` provides the envelope, Zod validation,
  and error mapping out of the box. Route Handlers are ~10 lines of
  code beyond the business logic.
- **Server Actions are harder to test.** Because they run inside the
  Next.js runtime, testing a Server Action in isolation requires
  mocking `revalidatePath`, `revalidateTag`, the Auth.js session, and
  the database. Route Handlers are standard HTTP functions and can be
  tested with `node:test` or vitest's `injectable` pattern.
  **Mitigation:** The service function (which contains the business
  logic) is what we unit-test. Server Action tests are integration
  tests against the full Next.js runtime (Playwright). Route Handler
  tests are also integration tests, but they require less runtime
  mocking.
- **Envelope rigidity.** A single `{ data } / { error }` envelope is
  simple but constraining. Streaming endpoints (live chat, real-time
  notifications) cannot use this envelope. These are deferred to M5,
  at which point we may use Server-Sent Events or WebSockets with
  their own envelope format.
  **Mitigation:** Streaming endpoints are explicitly out of scope for
  this ADR. When we add them, a new ADR will document the protocol
  and envelope.
- **Twelve-month version deprecation is expensive.** Maintaining two
  major versions of an API surface for 12 months requires duplicated
  tests, duplicated documentation, and careful routing.
  **Mitigation:** We limit v1 to a clear, stable surface. Breaking
  changes are rare by design (cursor pagination, semantic versioning).
  When v2 ships, the v1 deprecation window starts, and we automate:
  `Deprecation` header, `Sunset` header, 410 Gone after sunset.

### Compliance

- Every REST endpoint must be under `/api/v1/`. Adding breaking
  changes requires bumping to `/api/v2/` with an ADR.
- Every Route Handler must use the `createRouteHandler` wrapper.
  Direct `NextResponse.json({ ... })` calls outside the wrapper are
  forbidden by ESLint rule `nexus/no-raw-response`.
- Every request body must be validated with Zod before processing.
  Every response body must be validated with Zod before returning.
- Cursor pagination is mandatory on collection endpoints. Page-offset
  pagination is forbidden.
- The envelope must include `meta.requestId` on every response.
  `requestId` is a UUID v4, also propagated to logs via
  `AsyncLocalStorage`.
- Webhook endpoints must verify HMAC signatures before processing
  the payload. The verification happens in middleware, not in the
  handler.
- REST endpoints must emit the correct `Cache-Control` header:
  public catalog `max-age=300, stale-while-revalidate=60`,
  authenticated `max-age=0, must-revalidate`, mutations `no-store`.
