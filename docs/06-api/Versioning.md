# Versioning

> **Authoritative reference** for API version negotiation, deprecation, and sunset policy in Nexus Anime.
>
> Ownership: **Lead API Architect**. Last reviewed: 2026-06-26.

---

## 1. Purpose

This document defines how Nexus Anime assigns, communicates, and retires API versions. It exists so that:

- External clients can build against a contract with a predictable lifespan.
- Internal teams can ship additive changes without coordinating a major release.
- Breaking changes are explicit, announced, and rare — never accidental.

Scope: all public-facing REST endpoints under `/api/*`. Internal service-to-server calls and Server Actions are **unversioned** (see Section 8).

---

## 2. URL-prefix versioning rationale

Nexus Anime embeds the major version in the URL path:

```
/api/v1/anime/{id}
/api/v2/watchlist
```

This is a deliberate choice. The trade-offs:

**Advantages:**

- **Visible in logs and analytics.** A URL is the first thing that appears in access logs, CDN dashboards, and error trackers. No need to parse headers to know which version a client called.
- **Cache-friendly.** CDNs (Vercel Edge, Cloudflare) key on the full URL by default. `/api/v1/...` and `/api/v2/...` are distinct cache entries — no `Vary: Accept` gymnastics, no content-negotiation cache fragmentation.
- **Simpler client contract.** A client targets a URL. No `Accept` header negotiation, no `Content-Type` profile parameter, no ambiguity about which fields are included. The version is the path.
- **Easy to deprecate.** Sunsetting a version means deleting a route prefix — the 404 response is the signal.

**Disadvantages (acknowledged):**

- **URL churn on major bumps.** Clients must update their base path when a major version ships. This is mitigated by the deprecation window (Section 6) and the rarity of major bumps (Section 3).
- **Not REST-purist.** HATEOAS advocates argue versions should be negotiable, not baked into the URL. We accept this trade-off for operational simplicity and observability.

Header and content-type versioning are discussed (and rejected) in Section 12.

---

## 3. Major version in URL path

Every public REST endpoint carries a **single integer major version** in its path: `/api/v1/`, `/api/v2/`, etc.

**Rule:** Breaking changes require a new major version. The old major remains live during the deprecation window.

```
/api/v1/anime/{id}   ← original
/api/v2/anime/{id}   ← breaking change introduced here
```

The current major version is `v1`. It will remain live until all deprecation windows for `v1`-introduced endpoints have elapsed. `v2` ships only when a breaking change is required — not on a calendar cadence.

---

## 4. Non-breaking change classification

The following changes are **compatible** within the current major version. They do not require a new prefix.

| Change type                    | Example                                        | Compatible? |
| ------------------------------ | ---------------------------------------------- | ----------- |
| New optional query parameter   | `?includeThemes` added to `/api/v1/anime/{id}` | Yes         |
| New response field             | `nextAiringAt` added to anime detail response  | Yes         |
| New enum value                 | `status` field gains new value `HIATUS`        | Yes         |
| New endpoint                   | `POST /api/v1/watchlist/export` added          | Yes         |
| Additional `rel` in pagination | `prevCursor` added alongside `nextCursor`      | Yes         |
| New webhook event type         | `anime.announced` added to outbound events     | Yes         |

**Rule of thumb:** if a correctly-behaving client written against the previous spec continues to work without modification, the change is compatible.

---

## 5. Breaking change classification

The following changes are **incompatible** and require a new major version.

| Change type                  | Example                                             | Breaking? |
| ---------------------------- | --------------------------------------------------- | --------- |
| Field rename                 | `username` → `handle`                               | Yes       |
| Field removal                | `malId` dropped from anime response                 | Yes       |
| New required query parameter | `?locale` becomes mandatory                         | Yes       |
| Type change                  | `score: number` → `score: string`                   | Yes       |
| Enum value removal           | `DROPPED` removed from `WatchStatus`                | Yes       |
| Semantics change             | `rating: 0` meant "unrated" → now means "1-star"    | Yes       |
| Envelope shape change        | `{ data }` → `{ result }`                           | Yes       |
| Pagination contract change   | cursor becomes opaque token with different encoding | Yes       |
| Authentication scheme change | bearer token → custom header                        | Yes       |

**Rule of thumb:** if a client written against the previous spec would silently misinterpret the response or receive a 4xx it did not expect, the change is breaking.

---

## 6. Deprecation process

Deprecation is a four-phase process. No phase may be skipped.

### Phase 1: Announce

- Add a `Sunset` header to the deprecated endpoint's response (see Section 11).
- Add a `Deprecation: true` field to the response envelope.
- Document the deprecation in the endpoint's JSDoc and in `CHANGELOG.md`.
- Notify registered developers (if a developer portal exists) and post to the internal `#api-changes` channel.

### Phase 2: Maintain

- The deprecated endpoint continues to function for **12 months** from the announcement date.
- During this window, the endpoint returns `200 OK` with the `Sunset` header and a `deprecationNotice` field in the response body.
- The new (recommended) endpoint is live and documented in parallel.

### Phase 3: Sunset

- After the 12-month window, the deprecated endpoint returns `410 Gone` with a JSON body pointing to the replacement.
- The response includes `Sunset` header set to the sunset date and a `migration` URL in the error body.

### Phase 4: Remove

- The route is deleted in the next major version bump.
- A `404 Not Found` is the final signal. No alias, no redirect.

**Minimum window:** 12 months. Longer windows may be granted for endpoints with active third-party consumers.

---

## 7. How clients discover the current version

Every successful response includes an `apiVersion` field in the `meta` object:

```json
{
  "data": { "id": 123, "title": "..." },
  "meta": {
    "requestId": "req_abc",
    "apiVersion": "v1"
  }
}
```

Clients SHOULD:

- Log `apiVersion` on every response for debugging.
- Alert if they receive a version they were not built for.
- Use the version to determine which fields and endpoints are available.

The current major version is also advertised in the API root:

```
GET /api → { "versions": ["v1"], "current": "v1" }
```

---

## 8. Internal endpoints are unversioned

The following surfaces carry **no version prefix** and are not subject to the deprecation process above:

| Surface           | Path pattern                                    | Reason                                                                       |
| ----------------- | ----------------------------------------------- | ---------------------------------------------------------------------------- |
| Server Actions    | N/A (RSC function calls)                        | Tied to the Next.js deployment; versioned with the app                       |
| Health checks     | `/api/health`, `/api/ready`                     | Infrastructure tooling; must not break on version rotation                   |
| Internal RPC      | `packages/services/**/src/rpc/**`               | Server-to-server; coordinated deployment                                     |
| Webhook receivers | `/api/webhooks/stripe`, `/api/webhooks/partner` | External caller controls the URL; versioned via signing key rotation instead |

**Why:** these surfaces are either invisible to external consumers (Server Actions, internal RPC) or controlled by an external caller (webhooks). Versioning them in the URL would add friction without benefit.

---

## 9. Cross-version compatibility policy

- **Multiple majors may be live simultaneously.** `v1` and `v2` can serve traffic in parallel during the deprecation window.
- **A single client SHOULD target one major.** Mixing `v1` and `v2` endpoints in the same client session is unsupported — field semantics may differ.
- **Database and service layers are shared.** Both `/api/v1/` and `/api/v2/` route through the same service and repository code. Version differences are enforced at the route handler boundary via Zod schemas, not via separate service implementations.
- **Response validation is version-specific.** Each route handler validates its output against a Zod schema pinned to its major version. A `v2` handler MUST NOT return a `v1` schema.

---

## 10. Pre-release and beta endpoints

Endpoints that are experimental or not yet committed to the stability contract live under a **pre-release prefix**:

```
/api/v1beta/anime/{id}/recommendations
/api/v2alpha/watchlist/discover
```

Naming convention: `{major}{stage}` where stage is one of `alpha`, `beta`, `rc`.

Rules:

- Beta endpoints MAY change or break without a major version bump.
- Beta endpoints MUST include `"stability": "beta"` in the `meta` response envelope.
- Beta endpoints do NOT carry a `Sunset` header until they graduate to stable.
- Beta endpoints MUST graduate to a stable major version or be removed within **6 months**.
- After graduation, the beta prefix is deleted — the endpoint moves to `/api/v1/...` (or the current stable major).

**Do not build production clients against beta endpoints.**

---

## 11. Sunrise and sunset examples

### Sunrise (new endpoint goes live)

```
GET /api/v1/anime/1234

200 OK
Content-Type: application/json; charset=utf-8

{
  "data": { "id": "1234", "title": "..." },
  "meta": { "requestId": "req_1", "apiVersion": "v1" }
}
```

No `Sunset` header. No `Deprecation` field. Endpoint is stable.

### Deprecation announcement

```
GET /api/v1/anime/1234

200 OK
Sunset: Sat, 26 Jun 2027 00:00:00 GMT
Deprecation: true
Link: </api/v2/anime/1234>; rel="successor-version"

{
  "data": { "id": "1234", "title": "..." },
  "meta": { "requestId": "req_2", "apiVersion": "v1" },
  "deprecationNotice": "This endpoint is deprecated. Migrate to /api/v2/anime/1234 by 2027-06-26."
}
```

### Sunset (after 12-month window)

```
GET /api/v1/anime/1234

410 Gone
Sunset: Sat, 26 Jun 2027 00:00:00 GMT

{
  "error": {
    "message": "This endpoint has been retired.",
    "code": "VERSION_SUNSET",
    "details": {
      "deprecatedSince": "2026-06-26",
      "sunsetDate": "2027-06-26",
      "migration": "/api/v2/anime/1234"
    }
  }
}
```

### Final removal (next major version)

```
GET /api/v1/anime/1234

404 Not Found
```

No body, no alias, no redirect. The version is gone.

---

## 12. Why not header or content-type versioning?

Header versioning (e.g., `Accept: application/vnd.nexus.v1+json`) and content-type profiling keep URLs clean but introduce operational friction:

- **CDNs must be configured to key on headers.** Default CDN behavior keys on URL only. Misconfigured `Vary` headers cause cache poisoning — a real risk on a streaming platform where catalog responses are cached aggressively.
- **Debugging requires header inspection.** URLs are visible in logs, browser DevTools, and curl commands. Headers require deliberate inspection. When a client reports "weird behavior," the first question is "what URL did you call?" — with URL versioning, the answer is self-diagnosing.
- **Client complexity increases.** Clients must set headers correctly; forgetting the header silently falls back to a default version. URL versioning is explicit — the path is the contract.
- **Tooling support is uneven.** Many HTTP clients, proxies, and API gateways handle content negotiation poorly. URL paths are universally understood.

We accept the trade-off of URL churn on major bumps in exchange for operational simplicity, cache correctness, and debuggability.

---

## 13. Future-proofing: "Since" and "Changed in" markers

Every endpoint documented in `docs/api.md` (and its per-route companions) includes **version lifecycle markers** in the endpoint's JSDoc and markdown description:

- `@since v1` — the major version that introduced this endpoint or field.
- `@since v1.2` — for additive changes within a major (minor version is informational, not a contract boundary).
- `@changedIn v1.3` — for behavioral changes (e.g., default page size, new default sort).
- `@deprecated v1` — marks the endpoint as deprecated with the announcement date and successor URL.

These markers are the contract surface for future readers. They allow a client engineer to answer "what did I get when I called this endpoint in v1?" without spelunking through git history.

Example in a route handler:

```ts
/**
 * GET /api/v1/anime/{id}
 *
 * @since      v1
 * @changedIn v1.2  Added `nextAiringAt` field.
 * @changedIn v1.3  `rating` now returns 0-10 instead of 1-10 (unrated = null).
 */
```

These markers are required on every public endpoint. They are the first thing updated when a change is shipped.

---

## 14. Changelog

| Date       | Change                  | Ticket / PR |
| ---------- | ----------------------- | ----------- |
| 2026-06-26 | Initial versioning spec | —           |
|            |                         |             |
|            |                         |             |

> Each entry is added when a version policy changes — not on every deprecation announcement. Deprecations are tracked in the endpoint's JSDoc and in `CHANGELOG.md`.

---

## 15. License & ownership

This specification is under the same license as the Nexus Anime repository. Version policy changes require review from the **Lead API Architect** and two approving engineers.
