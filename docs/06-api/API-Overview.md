# API Overview

> **Authoritative entry point** for every API decision in Nexus Anime. Before you reach for any endpoint, Server Action, or internal service call — read this document.
>
> Ownership: **Lead API Architect**. Last reviewed: 2026-06-26.

---

## 1. Purpose & scope

This document defines the **three API surfaces** exposed by the Nexus Anime platform, the conventions that bind them, and the decision framework for choosing which surface to use. It is the top-level contract for:

- Client-to-server communication (React Server Components, forms, mutations, REST fetches).
- Server-to-server communication (internal services, webhooks, cron workers).
- External consumption (Stripe callbacks, webhook integrations).

It does **not** replace service-level specs. Each surface has its own companion document:

| Concern                                            | Document                                        |
| :------------------------------------------------- | :---------------------------------------------- |
| Envelope shapes, HTTP semantics, caching, idempotency | [`API-Standards.md`](./API-Standards.md)        |
| Authentication, sessions, provider flow            | [`Authentication.md`](./Authentication.md)      |
| URL versioning policy                              | [`Versioning.md`](./Versioning.md)              |
| Cursor pagination contract                         | [`Pagination.md`](./Pagination.md)              |
| Rate-limit headers & quotas                        | [`Rate-Limiting.md`](./Rate-Limiting.md)        |
| Error code registry                                | [`Error-Codes.md`](./Error-Codes.md)            |

Read this doc first, then drill into the referenced spec for the concern you care about.

---

## 2. The three API surfaces

Nexus Anime presents three distinct surfaces. They are **not** interchangeable — each has a different caller, latency profile, and failure mode.

```
┌───────────────────────┐     ┌──────────────────────────┐     ┌──────────────────────┐
│  Client (browser/app)  │     │  Next.js Route Handlers  │     │  Internal services / │
│                        │     │   (REST over HTTP)       │     │  cron / webhooks     │
├───────────────────────┤     ├──────────────────────────┤     ├──────────────────────┤
│  Server Actions        │     │  REST endpoints          │     │  Service → Service   │
│  (mutations/forms)     │     │  (reads + mobile cache)  │     │  (gRPC/REST bridge)  │
│  use() / <Suspense>    │     │  /api/v1/*               │     │  (server-to-server)  │
└───────────────────────┘     └──────────────────────────┘     └──────────────────────┘
```

| Surface             | Transport             | Primary caller              | Used for                                   |
| :------------------ | :-------------------- | :-------------------------- | :----------------------------------------- |
| **Server Actions**  | RSC function call     | Server + client components  | Mutations, auth flows, personalized reads  |
| **Route Handlers**  | HTTP/REST             | External clients, `fetch()` | Reads, public resources, webhooks, mobile  |
| **Server-to-server**| Internal service call | Workers, cron, sidecars     | Event processing, billing reconciliation   |

---

## 3. When to use each surface

Use this decision tree. When two rows both apply, pick the **more restrictive** option.

### 3.1 Server Actions

Use when **all** of the true:

- The caller is rendered by Next.js (Server Component or Client Component hydrated in the app).
- The operation mutates state or requires the caller's session.
- You are inside the trusted application boundary (not an external consumer).

```ts
// apps/web/src/actions/watchlist.ts
"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { upsertWatchlistEntry } from "@nexus/db";

export const toggleWatchlist = async ({ animeId }: { animeId: string }) => {
  const session = await requireUser();
  const schema = z.object({ animeId: z.string().min(1) });
  const { animeId: id } = schema.parse({ animeId });

  const entry = await upsertWatchlistEntry({ userId: session.userId, animeId: id });
  return { data: entry };
};
```

### 3.2 Route Handlers (REST)

Use when **any** is true:

- The caller is an external client (third-party service, public API consumer, Stripe webhook).
- The endpoint must be cacheable at the edge (CDN) for mobile/web clients.
- You need an idempotent GET that survives outside the React tree.

```ts
// apps/web/app/api/v1/anime/[id]/route.ts
import { NextResponse } from "next/server";
import { fetchAnimeDetail } from "@/lib/services/anime";

export const revalidate = 300; // ISR-style cache at the route level.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const anime = await fetchAnimeDetail(id);
  if (!anime) {
    return NextResponse.json(
      { error: { message: "Not found", code: "ANIME_NOT_FOUND", details: { id } } },
      { status: 404 },
    );
  }
  return NextResponse.json({ data: anime });
}
```

### 3.3 Server-to-server

- Operates internal-only. Callers are workers, cron jobs, and sidecars running inside the VPC.
- Never exposes public URLs; reachable only via internal service discovery.
- Uses the shared envelope but skips session middleware — authentication is mTLS or service tokens, **not** user cookies.

```ts
// packages/services/billing/src/reconcile.ts
import { callService } from "@nexus/internal-rpc";

export const reconcileInvoice = async (invoiceId: string) => {
  const result = await callService("billing", "reconcile", { invoiceId });
  return result; // { data } / { error } envelope
};
```

### 3.4 Quick-reference decision table

| Scenario                                      | Use                | Why                                       |
| :-------------------------------------------- | :----------------- | :---------------------------------------- |
| Save a watch-progress tick                   | Server Action      | Mutation, needs session                   |
| Load anime detail for SSR home feed          | Server Action      | Personalized, in React tree               |
| Mobile app fetches trending list             | Route Handler      | Edge-cachable, external client            |
 Stripe sends `checkout.session.completed`     | Route Handler      | Webhook, no user session                  |
| Daily cron prunes expired sessions           | Server-to-server   | Internal, trusted worker                  |
| Public partner queries catalog metadata      | Route Handler      | External consumer, REST semantics         |

---

## 4. Authentication overview

All three surfaces authenticate — but they do it differently.

| Surface             | Session source           | Mechanism                        |
| :------------------ | :----------------------- | :------------------------------- |
| **Server Actions**  | Auth.js session cookie   | `requireUser()` inside the action |
| **Route Handlers**  | `Authorization: Bearer`  | OAuth2 / API token, validated by  middleware |
| **Server-to-server**| mTLS + service token     | `@nexus/internal-rpc`            |

For the full spec — provider flows (Google, GitHub, Credential), JWT/Session shapes, CSRF strategy, and token rotation — see **[`Authentication.md`](./Authentication.md)**. In short:

- **Never** pass secrets from client to server. Server Actions inherit the session from the server context; REST endpoints require explicit bearer tokens.
- **Never** call a Route Handler with a user session cookie expecting elevated trust — verify the bearer token at the middleware boundary.

---

## 5. Global conventions: the envelope

Every API response in Nexus Anime follows a single envelope shape. This applies to Server Actions, Route Handlers, and internal service calls.

**Success:**

```json
{
  "data": { /* payload */ },
  "meta": { "requestId": "req_123" }
}
```

**Failure:**

```json
{
  "error": {
    "message": "Human-readable summary",
    "code": "ANIME_NOT_FOUND",
    "details": { "id": "xyz" }
  },
  "meta": { "requestId": "req_456" }
}
```

```ts
// The envelope is enforced by helpers, never hand-written.
return ok(anime);           // → { data, meta }
return notFound({ id });    // → { error: { message, code, details }, meta }
```

The envelope is the floor, not the ceiling — see **[`API-Standards.md`](./API-Standards.md)** for field semantics, meta shape, idempotency headers, and caching rules.

---

## 6. Versioning

REST endpoints are pinned to a **URL prefix**:

```
/api/v1/anime/[id]
/api/v1/watchlist
```

- Breaking changes bump the prefix (`v1` → `v2`).
- Additive changes stay within the current version.
- Server Actions are **not** versioned at the URL — they are tied to the application deployment, consistent with the Next.js release.

Full policy — deprecation window, sunset headers, client negotiation — in **[`Versioning.md`](./Versioning.md)**.

---

## 7. Pagination

Collection endpoints return a **cursor-based paginated envelope**, never array-only responses.

```json
{
  "data": [ /* items */ ],
  "meta": {
    "requestId": "req_789",
    "pagination": {
      "nextCursor": "eyJpZCI6IDEyM30",
      "hasMore": true
    }
  }
}
```

Cursor pagination is deterministic under concurrent writes; page-offset pagination is forbidden on collection endpoints. Details, cursor encoding rules, and page-size negotiation live in **[`Pagination.md`](./Pagination.md)**.

---

## 8. Rate limiting

All public-facing surfaces return rate-limit headers:

| Surface            | Scope             | Headers                         |
| :----------------- | :---------------- | :------------------------------ |
| Route Handlers     | Per identity      | `X-RateLimit-*`, `Retry-After`  |
| Server Actions     | Per session       | Same, applied at middleware     |
| Server-to-server   | Per service link  | Internal quota, closed-loop     |

Headers and retry semantics are defined in **[`Rate-Limiting.md`](./Rate-Limiting.md)**.

---

## 9. Error codes

Every `error.code` value is centrally registered. **Do not invent ad-hoc codes in individual handlers.**

| Code                | Meaning                  | Typical status |
| :------------------ | :----------------------- | :------------- |
| `UNAUTHENTICATED`   | Missing or invalid token | 401            |
| `FORBIDDEN`         | Authz failure            | 403            |
| `VALIDATION_FAILED` | Zod or schema error      | 422            |
| `NOT_FOUND`         | Resource missing         | 404            |
| `RATE_LIMITED`      | Quota exhausted          | 429            |
| `INTERNAL`          | Unhandled server error   | 500            |

The full registry, with field-level `details` shape and client-display rules, lives in **[`Error-Codes.md`](./Error-Codes.md)**.

---

## 10. Future compatibility: GraphQL

**REST is the primary API.** Every feature ships on REST first.

A **read-only GraphQL layer** is earmarked for **M5+** to reduce over-fetching on mobile clients. Until that milestone lands:

- Do not optimize for GraphQL. Build on REST with the envelope above.
- Do not introduce a `gql/` pathway in the codebase. REST remains the source of truth for both reads and writes.
- GraphQL, when it arrives, will be additive: REST endpoints continue to work.

If you are designing a new mobile client today, paginate aggressively and use field-sparse REST responses — they migrate cleanly to GraphQL later.

---

## 11. How to read this spec

Notation used across all API documents in this repo:

- **Path templates** follow OpenAPI-style templating:
  - `/api/v1/watchlist` — literal path
  - `/api/v1/anime/{id}` — path parameter (always single braces)
  - `/api/v1/anime/{id}/episodes/{ep}` — nested parameter

- **Required vs optional**:
  - `param!` — required
  - `param?` — optional (absent=nullable, not the string `"param"`)
  - `param?: type` — optional with explicit type

- **Schema format** uses TypeScript-flavored pseudo-schemas (full Zod source lives next to each handler):

  ```ts
  CreateReq: {
    animeId!: string,
    status!: "PLANNING" | "WATCHING" | "DROPPED",
    score?: number,               // 1-10, optional
  }
  ```

- **Stability markers** preface each method:
  - `[stable]` — committed contract, breaking changes only on major version bump.
  - `[beta]`   — working, but fields may change within the current major version with deprecation notice.
  - `[internal]` — implementation detail, not for external consumers.

---

## 12. Changelog

| Date       | Change                   | Ticket / PR    |
| :--------- | :----------------------- | :------------- |
| 2026-06-26 | Initial API overview     | —              |
|            |                          |                |
|            |                          |                |

> Each entry is added when a surface policy changes — not on every bugfix. Backfill in the same PR that changes an API contract.

---

## 13. License & ownership

This specification is under the same license as the Nexus Anime repository. API contract changes require review from the **Lead API Architect** and two approving engineers. All trademarks and brand assets referenced remain property of their respective owners — this document is an engineering contract, not a license for redistribution.
