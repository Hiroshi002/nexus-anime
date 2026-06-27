# Error Handling — Nexus Anime

> **Audience:** Engineers implementing error boundaries, error logging, and error responses. This document defines the error hierarchy, handling strategy, and user-facing error UX.

---

## 1. Error Hierarchy

All errors in the system derive from a base `AppError` class. This enables consistent serialization, logging, and client handling.

```ts
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly statusCode: number,
    public readonly details?: unknown,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}
```

### Specialized error classes

| Class                  | Code               | Status | When                                          |
| ---------------------- | ------------------ | ------ | --------------------------------------------- |
| `ValidationError`      | `VALIDATION_ERROR` | 400    | Zod schema parse fails                        |
| `UnauthorizedError`    | `UNAUTHORIZED`     | 401    | No session or expired session                 |
| `ForbiddenError`       | `FORBIDDEN`        | 403    | Insufficient permissions                      |
| `NotFoundError`        | `NOT_FOUND`        | 404    | Resource doesn't exist                        |
| `ConflictError`        | `CONFLICT`         | 409    | Duplicate resource (email already registered) |
| `RateLimitError`       | `RATE_LIMITED`     | 429    | Too many requests                             |
| `PaymentRequiredError` | `PAYMENT_REQUIRED` | 402    | Subscription required                         |
| `UpstreamError`        | `UPSTREAM_ERROR`   | 502    | External API failure (TMDB, Stripe, Stream)   |
| `InternalError`        | `INTERNAL_ERROR`   | 500    | Unexpected/unhandled error                    |

### Why a custom error hierarchy

| Alternative                   | Why rejected                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Raw `Error` with message only | No machine-readable code. Client can't switch on error type. No status code mapping.                                                       |
| `HttpError` with status only  | Status codes are ambiguous (400 could be validation or bad request shape). Machine-readable `code` is specific.                            |
| Neverthrow / Result type      | Forces every function to return `Result<T, E>`. Adds boilerplate. Good for functional codebases but fights Next.js's error boundary model. |

---

## 2. Error Serialization

Errors are serialized into the API envelope format:

```ts
function serializeError(error: unknown): ApiErrorEnvelope {
  if (error instanceof AppError) {
    return {
      error: {
        message: error.message, // User-friendly
        code: error.code, // Machine-readable
        details: error.details ?? null, // Structured (field errors, etc.)
      },
    };
  }

  // Unknown errors — never leak internals
  return {
    error: {
      message: "An unexpected error occurred",
      code: "INTERNAL_ERROR",
      details: null,
    },
  };
}
```

### Why strip stack traces for unknown errors

Stack traces contain file paths, line numbers, and internal variable names. Leaking them to the client is an information disclosure vulnerability. Only `AppError` subclasses with intentionally-crafted messages are sent to the client; everything else gets a generic message.

---

## 3. Error Boundary Architecture

Next.js App Router uses `error.tsx` files as React Error Boundaries. They are **hierarchical** — the nearest boundary catches the error.

```
Root error boundary (app/error.tsx)
  │
  ├── (public) error boundary
  │   ├── (catalog) error boundary ← catches anime/episode errors
  │   └── (marketing) error boundary
  │
  ├── (authenticated) error boundary ← catches session/auth errors
  │
  └── (auth) error boundary ← catches OAuth/credential errors
```

### Error boundary anatomy

```tsx
// app/(public)/(catalog)/[id]/error.tsx
"use client"; // Required — error boundaries need reset()

export default function AnimeDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError(error); // Report to observability
  }, [error]);

  const appError = error instanceof AppError ? error : null;

  return (
    <ErrorLayout
      title={appError?.code === "NOT_FOUND" ? "Anime not found" : "Something went wrong"}
      description={appError?.message ?? "We couldn't load this page."}
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
```

### Why per-feature error boundaries

A single root error boundary catches everything — but it can't provide context-specific recovery. A catalog error should show "Check our trending anime" with a link to the home page. An auth error should show "Try logging in again" with a link to login. Feature boundaries give context-appropriate UX.

---

## 4. Error Handling by Layer

### Presentation layer (Route Handlers)

```ts
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const data = await someService.doSomething();
    return NextResponse.json({ data });
  } catch (error) {
    const serialized = serializeError(error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json(serialized, { status });
  }
}
```

### Application layer (Services)

Services throw `AppError` subclasses. They do not catch errors from repositories — they let them propagate to the caller (action or route handler) which applies the appropriate error boundary.

```ts
export async function getAnimeDetail(id: string): Promise<AnimeDetail> {
  const anime = await animeRepository.getDetail(id);
  if (!anime) throw new NotFoundError(`Anime ${id} not found`);
  return anime;
}
```

### Infrastructure layer (Repositories)

Repositories throw `AppError` for known failures (e.g., connection error → `InternalError`). Unknown errors propagate as raw `Error` and are serialized by the presentation layer.

### Why services don't catch repository errors

If a repository throws a connection error, the service can't do anything useful with it — it can't retry (that's the repository's job), it can't substitute data (that would hide the failure). Letting the error propagate keeps services thin and error handling centralized at the boundary.

---

## 5. Validation Errors

Zod validation errors are converted to the envelope format:

```ts
function formatZodError(error: ZodError): ApiErrorEnvelope {
  return {
    error: {
      message: "Validation failed",
      code: "VALIDATION_ERROR",
      details: error.flatten().fieldErrors, // { email: ["Invalid email"], password: ["Too short"] }
    },
  };
}
```

### Server Action pattern

```ts
"use server";
export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!result.success) {
    return formatZodError(result.error);
  }

  // Proceed with valid data
}
```

### Why Zod at every boundary

Validation is defense-in-depth. Even if the client validates, the server must validate independently (client code can be bypassed). Zod gives us:

1. Runtime validation (catch shape errors from upstream APIs).
2. Type inference (derive TS types from Zod schemas).
3. Error formatting (field-level errors for form display).

---

## 6. Upstream Error Handling

External API failures (TMDB, AniList, Stripe, Cloudflare Stream) are handled with retry + fallback.

### Retry strategy

```ts
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries) throw new UpstreamError("TMDB", (error as any).status);
      await new Promise((r) => setTimeout(r, delay * 2 ** attempt)); // Exponential backoff
    }
  }
  throw new Error("Unreachable");
}
```

### Fallback strategy

| Upstream          | Failure mode             | Fallback                                                                     |
| ----------------- | ------------------------ | ---------------------------------------------------------------------------- |
| TMDB              | API down or rate-limited | Serve stale Redis cache (if available) or show degraded UI (no poster image) |
| AniList           | Same                     | Same                                                                         |
| Stripe            | API down                 | Queue webhook events for later processing; show "Payment processing" message |
| Cloudflare Stream | API down                 | Show "Video temporarily unavailable" with retry button                       |

### Why stale cache as fallback, not hardcoded defaults

Stale data is usually better than no data. If TMDB is down, the anime detail page still works — just with potentially outdated ratings. This is preferable to a blank page. The stale cache was populated when TMDB was healthy; it's accurate within the last TTL window.

---

## 7. Unhandled Error Safety Net

### global-error.tsx

The root-level error boundary catches errors that escape all other boundaries (including errors in the root layout).

```tsx
"use client";
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Report to error tracking service
    reportError(error);
  }, [error]);

  return (
    <html>
      <body>
        <h1>Something went wrong</h1>
        <p>We've been notified and are working on it.</p>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
```

### Why global-error must render `<html>` and `<body>`

If the root layout fails to render, the normal `<html>` and `<body>` tags are missing. `global-error.tsx` must provide them to render valid HTML. This is a Next.js requirement.

---

## 8. Error Logging

All errors are logged with structured context before being serialized for the client:

```ts
function logError(error: unknown, context?: Record<string, unknown>) {
  if (error instanceof AppError) {
    logger.error(error.message, {
      code: error.code,
      statusCode: error.statusCode,
      ...context,
      // Never log: passwords, tokens, personal data
    });
  } else {
    logger.error("Unhandled error", {
      name: (error as Error).name,
      message: (error as Error).message,
      stack: (error as Error).stack, // Stack is OK in server logs, not client responses
      ...context,
    });
  }
}
```

### What NOT to log

- Passwords (even hashed)
- Session tokens
- API keys
- Full request bodies (may contain PII)
- User email in non-auth contexts

---

## 9. User-Facing Error UX

| Error              | UI                                                | Recovery               |
| ------------------ | ------------------------------------------------- | ---------------------- |
| Network error      | "Check your connection and try again"             | Retry button           |
| 404 Not Found      | "This anime doesn't exist" + trending suggestions | Link to home           |
| Validation error   | Inline field errors on form                       | Fix and resubmit       |
| 401 Unauthorized   | "Sign in to continue"                             | Redirect to login      |
| 403 Forbidden      | "You need a subscription to watch this"           | Link to pricing        |
| 429 Rate limited   | "Slow down! Try again in a minute"                | Auto-retry after delay |
| 502 Upstream error | "We're having trouble loading this"               | Retry button           |
| 500 Internal error | "Something went wrong on our end"                 | Retry button           |

### Why context-specific messages, not generic "Error"

Generic error messages erode trust. "Something went wrong" tells the user nothing. "This anime doesn't exist" tells them exactly what happened and what they can do about it (browse trending). Context-specific messages reduce support burden and improve perceived reliability.

---

## 10. Error Recovery Patterns

### Retry (reset)

The `reset()` function from `error.tsx` re-renders the boundary's children. This is appropriate for transient errors (network blip, temporary upstream failure).

### Redirect

For auth errors, redirect to the login page. For 404s, redirect to the home page. The user takes a different action instead of retrying the same failing request.

### Optimistic rollback

For mutations with optimistic updates, a server failure rolls back the optimistic state. The user sees the item revert to its previous state, often with an error toast.

### Degraded mode

For upstream failures where stale cache is available, the UI renders with cached data and shows a subtle "Data may be outdated" indicator. The page is functional, just not fully fresh.
