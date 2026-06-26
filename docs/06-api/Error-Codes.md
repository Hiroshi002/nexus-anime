# Error Codes

> **Authoritative registry** for every `error.code` value returned by Nexus Anime API surfaces. Handled by: Server Actions (thrown), Route Handlers (serialized), internal services (propagated).
>
> Ownership: **Lead API Architect**. Last reviewed: 2026-06-26.

---

## 1. Purpose

This document is the **single source of truth** for error codes across all API surfaces (Server Actions, Route Handlers, server-to-server). It ensures:

- **Consistent envelope shape** — every error response, regardless of caller, follows the same `{ error: { message, code, details } }` schema.
- **Predictable client handling** — clients branch on `error.code`, not HTTP status or message text.
- **Operational clarity** — each code has a defined log level, retry policy, and trigger contract so SRE runbooks can be written without reading handler code.
- **No information leakage** — the schema explicitly excludes stack traces, internal URLs, and raw upstream tokens.

Do not invent ad-hoc codes in individual handlers. If a new failure mode is missing from this table, raise a PR against this document before using the code.

---

## 2. Envelope shape for errors

Every error response follows the same envelope. `code` is the only field clients should branch on; `message` is for display; `details` is structured context.


// Failure envelope — returned from every API surface.
{
  error: {
    message: string,    // Human-readable summary (safe to display)
    code: string,       // Machine-readable code from this registry
    details?: unknown,  // Structured context — shape depends on `code`
  },
  meta: {
    requestId: string,  // Correlation ID for support tickets
  },
}
```

| Field       | Type     | Required |invariant                                           |
| :---------- | :------- | :------- | :------------------------------------------------ |
| `message`   | `string` | yes      | Never contains stack frames, URLs, or secret material |
| `code`      | `string` | yes      | Must be a value from the catalog below            |
| `details`   | `unknown`| no       | Shape is code-specific; see the catalog           |
| `meta.requestId` | `string` | yes | Stable across retries of the same logical request |

### 2.1. Usage across surfaces

| Surface          | How the envelope is produced                                                     |
| :--------------- | :------------------------------------------------------------------------------- |
| **Server Action** | Helper `throwApiError(code, details)` — thrown, serialized by Next.js boundaries |
| **Route Handler**| Helper `error(code, details)` → `NextResponse.json({ error, meta }, { status })` |
| **Internal RPC** | Helper `fail(code, details)` — returned through service envelope                  |

---

## 3. Full error code catalog

### 3.1. Top-level codes

| Code                 | HTTP | Description                                       | Typical Cause                                     | Retry Safe | Log Level |
| :------------------- | :--- | :------------------------------------------------ | :------------------------------------------------ | :-------- | :-------- |
| `VALIDATION_ERROR`   | 400  | Request body/params/query failed schema validation | Client sent malformed payload                     | N         | `info`    |
| `FIELD_REQUIRED`     | 400  | A required field was missing                      | Client omitted a non-nullable field               | N         | `info`    |
| `FIELD_INVALID`      | 400  | A supplied field failed semantic/type rules       | Client supplied malformed email, short password   | N         | `info`    |
| `UNAUTHORIZED`       | 401  | Missing or invalid credentials                    | No session, expired JWT, bad signature            | N         | `warn`    |
| `FORBIDDEN`          | 403  | Authenticated but not authorized for this resource| Insufficient role / ownership check failure       | N         | `warn`    |
| `NOT_FOUND`          | 404  | Resource does not exist or is not visible         | Deleted entity, wrong ID, visibility filter       | N         | `info`    |
| `CONFLICT`           | 409  | State conflict — mutation would violate invariant | Duplicate unique value, version mismatch          | N         | `info`    |
| `RATE_LIMITED`       | 429  | Identity has exhausted its quota                  | Burst traffic, quota leak                        | Y         | `warn`    |
| `PAYMENT_REQUIRED`   | 402  | Subscription or billing state blocks the action   | Lapsed plan, unpaid invoice                      | N         | `info`    |
| `UPSTREAM_ERROR`     | 502  | Upstream dependency returned an error             | TMDB/AniList non-2xx, Stripe webhook NACK         | Y         | `error`   |
| `INTERNAL_ERROR`     | 500  | Unhandled server failure                          | Bug, OOM, infra outage, unhandled exception       | N         | `error`   |

### 3.2. Sub-codes

Sub-codes refine a top-level code when the client needs to distinguish between failure modes without parsing `details`. They are **only** promoted to the `code` field when the parent category is too coarse. Otherwise they live inside `details.reason` and the `code` stays at the top level.

#### `VALIDATION_ERROR` — sub-pattern

`VALIDATION_ERROR` always includes a `details.errors` array. See section 5.

#### `CONFLICT` — subtypes

Each subtype is a **standalone `code`** in the error envelope. Servers MUST emit the subtype, not `CONFLICT`.

| Code                    | HTTP | Description                                | Typical Cause                              | Retry Safe | Log Level |
| :---------------------- | :--- | :----------------------------------------- | :----------------------------------------- | :-------- | :-------- |
| `EMAIL_TAKEN`           | 409  | Email already registered                   | Social-signup alias collision              | N         | `info`    |
| `USERNAME_TAKEN`        | 409  | Username is not unique                     | Race condition during registration         | N         | `info`    |
| `DUPLICATE_BOOKMARK`     | 409  | User already bookmarked this anime         | Double-tap on bookmark button              | N         | `info`    |
| `DUPLICATE_RATING`      | 409  | User already rated this anime/episode      | Re-rentry from stale client cache          | N         | `info`    |

#### `NOT_FOUND` — subtypes

Each subtype is a **standalone `code`** in the error envelope. Servers MUST emit the subtype, not `NOT_FOUND`.

| Code                 | HTTP | Description                                   | Typical Cause                          | Retry Safe | Log Level |
| :------------------- | :--- | :-------------------------------------------- | :------------------------------------- | :-------- | :-------- |
| `ANIME_NOT_FOUND`    | 404  | Anime ID does not exist or is not published   | Bad link, removed catalog entry       | N         | `info`    |
| `EPISODE_NOT_FOUND`  | 404  | Episode ID does not exist or is not aired     | Speculative watch of unreleased ep     | N         | `info`    |
| `USER_NOT_FOUND`     | 404  | User handle/id does not exist                 | Deactivated account, typo in handle    | N         | `info`    |
| `COMMENT_NOT_FOUND`   | 404  | Comment ID does not exist or is not visible   | Deleted comment, visibility filter     | N         | `info`    |

#### `FIELD_*` — codes with per-field `details`

| Code             | HTTP | Description                             | Typical Cause                                 | Retry Safe | Log Level |
| :--------------- | :--- | :-------------------------------------- | :-------------------------------------------- | :-------- | :-------- |
| `FIELD_REQUIRED` | 400  | Required field was omitted              | Client payload missing field                  | N         | `info`    |
| `FIELD_INVALID`  | 400  | Field failed type/format/range rules    | Malformed email, out-of-range score            | N         | `info`    |

---

## 4. Validation error details schema

`VALIDATION_ERROR` carries an array of field-level error objects. Each entry pinpoints one failure. The array **must** contain at least one entry.

```ts
// Shape of error.details on VALIDATION_ERROR
{
  errors: Array<{
    field: string,          // dotted path, e.g. "address.postalCode"
    message: string,        // human-readable field error
    code: "FIELD_REQUIRED" | "FIELD_INVALID" | string,  // sub-type
    received?: unknown,     // the value that failed (sanitized)
    expected?: string,      // description of expected shape, e.g. "email"
  }>
}
```

Constraints:

- `field` uses dotted JSON-path notation to at least the nearest named field.
- `received` must **not** contain passwords, tokens, tokens, or full credit-card numbers. If the field is sensitive, omit `received` entirely.
- `expected` is a short phrase, never a regex or raw Zod fragment.
- Array order is stable across retries of the same request.

---

## 5. Zod integration — mapping Zod issues to error details

All server-side input validation uses **Zod**. Zod's `ZodError` is transformed into the error envelope before leaving the handler layer.

```ts
// packages/api/src/errors.ts
import { ZodError } from "zod";
import { ApiError } from "./ApiError";

export function fromZodError(zodError: ZodError): ApiError {
  const errors = zodError.issues.map((issue) => {
    const isRequired = issue.code === "invalid_type" && issue.received === undefined;
    return {
      field: issue.path.join("."),
      message: issue.message,
      code: isRequired ? "FIELD_REQUIRED" : "FIELD_INVALID",
      // Never forward issue.received for password/token/secret fields
      ...(isSensitiveField(issue.path) ? {} : { received: issue.received }),
    };
  });
  return new ApiError("VALIDATION_ERROR", { errors });
}
```

Mapping rules:

| Zod issue code     | Result `code`    | Notes                                              |
| :----------------- | :--------------- | :------------------------------------------------- |
| `invalid_type` with `received === undefined` | `FIELD_REQUIRED`        | Missing required field                   |
| `invalid_type` otherwise | `FIELD_INVALID` | Type mismatch                              |
| `too_small` / `too_big` | `FIELD_INVALID` | Length/range violation                |
| `invalid_string` with format check | `FIELD_INVALID` | e.g. email, url                          |
| `invalid_union`    | `FIELD_INVALID` | Ambiguous union match                              |
| custom `.refine()` failures | `FIELD_INVALID` | With refine message propagated into `message` |

Multiple Zod issues on the same field each produce their own entry — callers cannot assume one error per field.

---

## 6. Error handling per layer

```
Client Component (use() / <Suspense>)
  │  catches thrown ApiError → reads error.code → renders fallback
  ▼
Server Action / Route Handler
  │  calls ApiError(code, details) → thrown OR returned via envelope
  ▼
Service Layer
  │  receives ApiError from repo/upstream → re-throws (preserves code)
  ▼
Repository Layer
  │  translates DB/upstream errors → ApiError (never raw driver errors)
  ▼
Infrastructure (Postgres, Redis, upstream APIs)
```

### 6.1. Server Actions

- Use `throw new ApiError(code, details)` on failure.
- Server Actions that perform validation must **not** swallow `ZodError` — re-throw as `ApiError("VALIDATION_ERROR", { errors })`. This preserves the code contract when Next.js serializes the error back to the client.
- Server Actions **must not** throw raw `Error` instances. Raw errors are converted to `INTERNAL_ERROR` at the boundary, but that hides real intent. Always construct `ApiError`.

```ts
"use server";
import { ApiError } from "@nexus/api/errors";
import { requireUser } from "@/lib/auth/session";

export async function deleteComment(commentId: string) {
  const user = await requireUser();
  const comment = await services.comments.get(commentId);
  if (!comment) throw new ApiError("COMMENT_NOT_FOUND", { commentId });
  if (comment.userId !== user.id) throw new ApiError("FORBIDDEN", { commentId });
  await services.comments.softDelete(commentId);
  return { data: { commentId } };
}
```

### 6.2. Route Handlers

- Use the `error(code, details)` helper to serialize the envelope with the correct HTTP status.
- Let the helper set `meta.requestId` from the incoming request context — never generate it by hand.
- Return via `NextResponse.json(envelope, { status })`. The helper enforces both the shape and the status code from the catalog.

```ts
import { error } from "@nexus/api/responses";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // helper parses + validates; throws ApiError("VALIDATION_ERROR", ...) on bad input
  const commentId = parseCommentId(id);
  await services.comments.softDelete(commentId);
  return NextResponse.json({ data: { commentId } });
}
```

### 6.3. Client display

Client code branches on `error.code`, never on HTTP status or message text.

```ts
const result = await deleteComment(commentId);
if (result.error) {
  switch (result.error.code) {
    case "COMMENT_NOT_FOUND":
      toast.error("Comment is already gone.");
      break;
    case "FORBIDDEN":
      toast.error("You can't delete someone else's comment.");
      break;
    case "VALIDATION_ERROR":
      result.error.details.errors.forEach((e) => form.setError(e.field, { message: e.message }));
      break;
    default:
      toast.error("Something went wrong. Please try again.");
  }
  return;
}
```

`VALIDATION_ERROR` is the only code where `details.errors` must be map-driven onto form fields. For all other codes, `details` is display-only context or omitted.

---

## 7. Upstream error wrapping

External service failures (TMDB, AniList, Stripe) must never leak into the client envelope. Always translate.

```ts
// packages/services/anime/src/upstream.ts
export async function fetchAnimeDetail(id: string) {
  try {
    const res = await tmdb.get(`/tv/${id}`);
    return res.data;
  } catch (err) {
    if (isUpstreamRateLimit(err)) {
      // Retry-safe: client can back off and retry the request.
      throw new ApiError("RATE_LIMITED", { retryAfter: err.retryAfterSeconds, source: "tmdb" });
    }
    if (isUpstreamNotFound(err)) {
      throw new ApiError("ANIME_NOT_FOUND", { id });
    }
    // 5xx from upstream becomes UPSTREAM_ERROR to our client — not INTERNAL_ERROR.
    throw new ApiError("UPSTREAM_ERROR", {
      source: "tmdb",
      status: err.status,
      // Forward opaque upstream requestId if available for SRE debugging.
      upstreamRequestId: err.headers?.["x-request-id"],
    });
  }
}
```

Rules:

- Upstream `4xx` → mapped to a semantic code the client understands (`ANIME_NOT_FOUND`, `RATE_LIMITED`), never `UPSTREAM_ERROR`.
- Upstream `5xx` → `UPSTREAM_ERROR` (retry-safe).
- Upstream `429` → `RATE_LIMITED`; propagate `Retry-After` in both headers and `details.retryAfter`.
- Always record the upstream `requestId` in `details` for cross-service correlation — but never in `message` or `code`.
- Never forward upstream error bodies verbatim. They often contain internal stack traces or signed URLs.

---

## 8. DO NOTs

Hard prohibitions. Violations block merge.

| # | Rule                                                                 | Rationale                                                       |
| :- | :------------------------------------------------------------------- | :-------------------------------------------------------------- |
| 1 | **No stack traces** in client responses.                             | Prevents file-path disclosure and internal layout discovery.    |
| 2 | **No internal URLs** in client responses.                            | Internal hostnames reveal infrastructure.                       |
| 3 | **No leaked tokens, API keys, or secrets** in client responses.      | Keys in messages are a live credential leak.                    |
| 4 | **No raw upstream error bodies** in client responses.                | Upstream bodies often contain internal stack traces or URLs.    |
| 5 | **No sensitive field values** in `details.received`.                 | Passwords, tokens, and full PANs must never be echoed back.     |
| 6 | **No ad-hoc `code` strings** not registered in this document.         | Prevents client-side branching drift.                            |
| 7 | **No throwing raw `Error`** from Server Actions. Use `ApiError`.       | Raw errors are collapsed to `INTERNAL_ERROR` at the boundary.   |
| 8 | **No 200-with-error** responses.                                     | Errors must carry their correct HTTP status for caching/proxy.   |
| 9 | **No parsing `message` in client code**. Branch on `code`.            | Messages are localized and evolve independently of semantics.    |

---

## 9. Reserved codes for future milestones

These codes are **reserved** — do not repurpose them. They will be promoted to active use by the milestone indicated.

| Code                       | Reserved For        | Milestone | Notes                                        |
| :------------------------- | :------------------ | :-------- | :------------------------------------------- |
| `MFA_REQUIRED`             | Auth                | M3        | User must complete MFA challenge             |
| `ACCOUNT_LOCKED`           | Auth                | M3        | Temp lock after brute-force                  |
| `TOKEN_EXPIRED`            | Auth                | M3        | Auth.js refresh failure                      |
| `SUBSCRIPTION_EXPIRED`     | Billing             | M4        | Lapsed plan blocks premium content           |
| `REGION_BLOCKED`           | Licensing           | M4        | Geo-rights enforcement                       |
| `VIDEO_UNAVAILABLE`        | Video Playback      | M5        | Signed URL expired or content geo-blocked    |
| `PLAYER_TOKEN_INVALID`     | Video Playback      | M5        | Signed URL signature mismatch                |
| `CONCURRENT_STREAM_LIMIT`  | Video Playback      | M5        | Too many simultaneous streams                 |
| `SEARCH_TIMEOUT`           | Search              | M6        | Search backend overloaded, cache-aside miss  |
| `CONTENT_FLAGGED`          | Moderation          | M6        | User-generated content flagged by automated review |
| `EXPORT_FAILED`            | GDPR / Data export  | M7        | Account data export failed                   |

---

## 10. Error response examples

### 10.1. Single error — `ANIME_NOT_FOUND`

```json
{
  "error": {
    "message": "Anime not found",
    "code": "ANIME_NOT_FOUND",
    "details": { "id": "88098" }
  },
  "meta": { "requestId": "req_1a2b3c4d" }
}
```

HTTP: `404`

### 10.2. Validation errors — `VALIDATION_ERROR`

```json
{
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": {
      "errors": [
        {
          "field": "email",
          "message": "Required",
          "code": "FIELD_REQUIRED"
        },
        {
          "field": "password",
          "message": "String must contain at least 8 character(s)",
          "code": "FIELD_INVALID",
          "expected": "string >= 8"
        },
        {
          "field": "age",
          "message": "Number must be greater than or equal to 13",
          "code": "FIELD_INVALID",
          "received": 12,
          "expected": "number >= 13"
        }
      ]
    }
  },
  "meta": { "requestId": "req_2e3f4g5h" }
}
```

HTTP: `400`

### 10.3. Conflict — `USERNAME_TAKEN`

```json
{
  "error": {
    "message": "Username is already taken",
    "code": "USERNAME_TAKEN",
    "details": { "username": "owl" }
  },
  "meta": { "requestId": "req_3f4g5h6i" }
}
```

HTTP: `409`

### 10.4. Rate limited — `RATE_LIMITED`

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1700000000
Retry-After: 47

{
  "error": {
    "message": "Rate limit exceeded",
    "code": "RATE_LIMITED",
    "details": {
      "retryAfter": 47,
      "limit": 100,
      "window": "60s"
    }
  },
  "meta": { "requestId": "req_4g5h6i7j" }
}
```

HTTP: `429`

### 10.5. Upstream failure — `UPSTREAM_ERROR`

```json
{
  "error": {
    "message": "The catalog service is temporarily unavailable",
    "code": "UPSTREAM_ERROR",
    "details": {
      "source": "tmdb",
      "status": 503
    }
  },
  "meta": { "requestId": "req_5h6i7j8k" }
}
```

HTTP: `502`

---

## 11. How clients should handle errors

**Rule one: branch on `error.code`, never on HTTP status or `error.message`.**

```ts
async function handleResult<T>(result: ApiResult<T>): Promise<T> {
  if (!result.error) return result.data;

  const { code, details } = result.error;

  switch (code) {
    case "VALIDATION_ERROR":
      // `details.errors` is an array of { field, message, code }
      for (const e of details.errors) form.report(e.field, e.message);
      throw new ValidationError();

    case "FIELD_REQUIRED":
    case "FIELD_INVALID":
      // clients shouldn't normally receive these as top-level codes;
      // they arrive nested inside VALIDATION_ERROR.details.errors.
      throw new UnexpectedCodeError(code);

    case "UNAUTHORIZED":
      await router.push("/auth/signin?returnTo=" + encodeURIComponent(location.href));
      throw new AuthRequiredError();

    case "FORBIDDEN":
      raiseToast("You don't have permission to do that.");
      throw new ForbiddenError();

    case "ANIME_NOT_FOUND":
    case "EPISODE_NOT_FOUND":
    case "USER_NOT_FOUND":
    case "COMMENT_NOT_FOUND":
      raiseToast(result.error.message);
      router.push("/404");
      throw new NotFoundError(code);

    case "USERNAME_TAKEN":
    case "EMAIL_TAKEN":
      raiseToast("That's already taken. Try another.");
      throw new ConflictError(code);

    case "DUPLICATE_BOOKMARK":
    case "DUPLICATE_RATING":
      // Idempotent: treat as success.
      return /* cached state */;

    case "RATE_LIMITED": {
      const seconds = details.retryAfter ?? 60;
      scheduleRetry(seconds * 1000);
      throw new RetryableError(seconds);
    }

    case "PAYMENT_REQUIRED":
      router.push("/billing/upgrade");
      throw new BillingRequiredError();

    case "UPSTREAM_ERROR":
      raiseToast("We're having trouble reaching a dependency. Please try again.");
      throw new TransientError();

    default:
      raiseToast("Something went wrong. Please try again.");
      throw new UnknownApiError(code);
  }
}
```

**Retry semantics**:

| Retry-safe | Client action                                            |
| :--------- | :------------------------------------------------------- |
| Y (`RATE_LIMITED`, `UPSTREAM_ERROR`) | Back off using `details.retryAfter` or `Retry-After` header, then replay the identical request. |
| N          | Never replay. Show user-facing message or redirect.      |

---

## 12. Changelog

| Date       | Change                    | Ticket / PR |
| :--------- | :------------------------ | :---------- |
| 2026-06-26 | Initial error code registry | —         |
|            |                           |             |
|            |                           |             |

> Each entry is added when the code catalog changes — not on every bugfix. Backfill in the same PR that introduces or removes a code.

---

## 13. License & ownership

This specification is under the same license as the Nexus Anime repository. Code catalog changes require review from the **Lead API Architect** and two approving engineers. All trademarks and brand assets referenced remain property of their respective owners.
