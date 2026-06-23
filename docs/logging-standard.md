# M2.9 — Logging & Error Handling Standard

> **Document Type:** Engineering Standard
> **Milestone:** M2 (Sprints 2–8)
> **Status:** Authoritative
> **Date:** 2026-06-24
> **Authority:** `docs/master-roadmap.md` v10.0, `docs/architecture/backend-architecture.md`

---

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [Normative References](#2-normative-references)
3. [Architecture Overview](#3-architecture-overview)
4. [Global Exception Handler](#4-global-exception-handler)
5. [Typed Error Hierarchy](#5-typed-error-hierarchy)
6. [Logging Levels & Usage](#6-logging-levels--usage)
7. [Structured Log Format](#7-structured-log-format)
8. [Error Response Format](#8-error-response-format)
9. [Request Correlation (requestId)](#9-request-correlation-requestid)
10. [Audit Logs](#10-audit-logs)
11. [Client-Side Error Handling](#11-client-side-error-handling)
12. [React Error Boundaries](#12-react-error-boundaries)
13. [Observability Pipeline](#13-observability-pipeline)
14. [Environment Behavior Matrix](#14-environment-behavior-matrix)
15. [Implementation Checklist](#15-implementation-checklist)

---

## 1. Purpose & Scope

This document defines the **mandatory** logging and error handling standards for the Nexus Anime backend (Route Handlers, Server Actions, Services, Repositories) and frontend (React Components, Client-side data fetching). All code from S2 onward must comply.

### 1.1 Goals

| Goal | Description |
|------|-------------|
| **Observability** | Every request is traceable via `requestId`; every error is logged with context. |
| **Consistency** | All API errors return the same envelope shape; all logs use the same JSON structure. |
| **Safety** | No sensitive data (passwords, tokens, PII) is ever logged. |
| **Actionability** | Errors contain enough context to reproduce and fix without exposing internals to clients. |
| **Auditability** | Security-relevant actions (auth, role changes, billing) produce immutable audit records. |

### 1.2 Scope

| In Scope | Out of Scope |
|----------|-------------|
| Route Handlers (`app/api/**/route.ts`) | Third-party service internals |
| Server Actions (`actions/*.ts`) | Vercel platform logs (managed externally) |
| Service & Repository layers | Client browser console (developer responsibility) |
| Middleware (`middleware.ts`) | |
| React Error Boundaries | |
| Client-side error handling (TanStack Query) | |

---

## 2. Normative References

| Document | Relevance |
|----------|-----------|
| `docs/architecture/backend-architecture.md` §11 | Observability architecture, logging tiers |
| `docs/architecture/backend-architecture.md` §7 | Error codes, error handling in services |
| `docs/api-specification.md` §1.2–1.3 | API envelope, error codes reference |
| `docs/api-specification.md` §1.5 | Rate limiting headers |
| `apps/web/lib/api/envelope.ts` | Current envelope implementation |

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Request Lifecycle                             │
│                                                                      │
│  Client Request                                                      │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────┐   requestId   ┌──────────────────┐                 │
│  │  Middleware  │──────────────▶│  Route Handler /  │                │
│  │  (logging    │   inject +    │  Server Action    │                │
│  │   + trace)   │   log entry   │                   │                │
│  └─────────────┘               └────────┬───────────┘               │
│                                         │                            │
│                              ┌──────────▼──────────┐                │
│                              │      Service         │                │
│                              │  (business logic,    │                │
│                              │   throws typed errs) │                │
│                              └──────────┬──────────┘                │
│                                         │                            │
│                              ┌──────────▼──────────┐                │
│                              │    Repository        │                │
│                              │  (Drizzle queries,   │                │
│                              │   throws DB errors)  │                │
│                              └──────────┬──────────┘                │
│                                         │                            │
│  ┌──────────────────────────────────────┼──────────────────────┐    │
│  │              Error Handling Layer     │                      │    │
│  │  ┌──────────────────┐   ┌───────────▼──────────┐           │    │
│  │  │  Global Exception │◀──│  Error Translator     │           │    │
│  │  │  Handler          │   │  (typed → envelope)   │           │    │
│  │  └────────┬─────────┘   └──────────────────────┘           │    │
│  │           │                                                  │    │
│  │           ▼                                                  │    │
│  │  ┌──────────────────┐   ┌──────────────────────┐           │    │
│  │  │  Structured Log   │   │  API Error Response   │           │    │
│  │  │  (JSON to stdout) │   │  (envelope + HTTP)    │           │    │
│  │  └────────┬─────────┘   └───────────┬──────────┘           │    │
│  └───────────┼──────────────────────────┼──────────────────────┘    │
│              │                          │                            │
│              ▼                          ▼                            │
│  ┌──────────────────┐      ┌──────────────────────┐                │
│  │  Observability    │      │  Client receives      │                │
│  │  (Axiom/Sentry)   │      │  { error: {...} }     │                │
│  └──────────────────┘      └──────────────────────┘                │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Global Exception Handler

### 4.1 Purpose

A **single** global error handler catches all unhandled exceptions from Route Handlers and Server Actions, ensuring:

1. No unhandled error leaks stack traces to clients.
2. Every error produces a structured log entry.
3. The client always receives a well-formed `ApiErrorResponse`.

### 4.2 Implementation Location

```
apps/web/lib/api/errors/
├── errors.ts          # Typed error classes + global handler
├── handler.ts         # Global exception handler utility
└── index.ts           # Barrel export
```

### 4.3 Global Handler Contract

```typescript
// apps/web/lib/api/errors/handler.ts

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { errorResponse } from "@/lib/api/envelope";
import { logger } from "@/lib/logging/logger";
import {
  NexusError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  RateLimitedError,
} from "./errors";

/**
 * Translates any thrown error into a NextResponse with the standard
 * API error envelope. Logs the error with full context before returning.
 *
 * This is the SINGLE error boundary for all Route Handlers.
 * Services throw typed errors; this function catches and translates.
 */
export function handleApiError(
  error: unknown,
  requestId: string,
  route: string,
): NextResponse {
  // ── Typed domain errors ──────────────────────────────────────
  if (error instanceof NexusError) {
    logger.warn({
      type: "api_error",
      requestId,
      route,
      errorCode: error.code,
      message: error.message,
      statusCode: error.statusCode,
    });

    return NextResponse.json(
      errorResponse(error.message, error.code, error.details),
      { status: error.statusCode },
    );
  }

  // ── Zod validation errors ────────────────────────────────────
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));

    logger.info({
      type: "validation_error",
      requestId,
      route,
      details,
    });

    return NextResponse.json(
      errorResponse("Request validation failed", "VALIDATION_ERROR", details),
      { status: 400 },
    );
  }

  // ── Unknown / unhandled errors ───────────────────────────────
  // Log full stack internally; return generic 500 to client.
  logger.error({
    type: "unhandled_error",
    requestId,
    route,
    error:
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { raw: String(error) },
  });

  return NextResponse.json(
    errorResponse("An unexpected error occurred", "INTERNAL_ERROR"),
    { status: 500 },
  );
}
```

### 4.4 Usage in Route Handlers

Every Route Handler wraps its logic in the global handler:

```typescript
// apps/web/app/api/v1/titles/[slug]/route.ts

import { handleApiError } from "@/lib/api/errors/handler";
import { successResponse } from "@/lib/api/envelope";
import { getRequestId } from "@/lib/logging/request-id";
import { CatalogService } from "@/features/catalog";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const requestId = getRequestId(request);
  try {
    const { slug } = await params;
    const title = await CatalogService.getBySlug({ slug, requestId });
    return successResponse(title);
  } catch (error) {
    return handleApiError(error, request, requestId);
  }
}
```

### 4.5 Usage in Server Actions

```typescript
// apps/web/actions/watchlist/add.ts

"use server";

import { handleActionError } from "@/lib/api/errors/handler";
import { getRequestId } from "@/lib/logging/request-id";
import { LibraryService } from "@/features/library";
import { requireAuth } from "@/lib/auth/require-auth";

export async function addToWatchlist(formData: FormData) {
  const requestId = getRequestId();
  try {
    const session = await requireAuth();
    const animeId = formData.get("animeId") as string;
    const item = await LibraryService.addToWatchlist({
      userId: session.user.id,
      animeId,
      requestId,
    });
    return { success: true, data: item };
  } catch (error) {
    return handleActionError(error, requestId);
  }
}
```

---

## 5. Typed Error Hierarchy

### 5.1 Base Class

```typescript
// apps/web/lib/api/errors/errors.ts

export interface ErrorDetail {
  field?: string;
  message: string;
}

/**
 * Base error class for all Nexus domain errors.
 * Every typed error carries an HTTP status code and an API error code.
 */
export class NexusError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: ErrorDetail[];

  constructor(message: string, statusCode: number, code: string, details: ErrorDetail[] = []) {
    super(message);
    this.name = "NexusError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    // Maintains proper stack trace in V8 environments
    Error.captureStackTrace?.(this, this.constructor);
  }
}
```

### 5.2 Concrete Error Classes

```typescript
// apps/web/lib/api/errors/errors.ts (continued)

/** 400 — Validation Error */
export class ValidationError extends NexusError {
  constructor(details: ErrorDetail[]) {
    super("Request validation failed", 400, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

/** 401 — Unauthorized */
export class UnauthorizedError extends NexusError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

/** 403 — Forbidden */
export class ForbiddenError extends NexusError {
  constructor(message = "Insufficient permissions") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

/** 404 — Not Found */
export class NotFoundError extends NexusError {
  public readonly resource: string;
  public readonly ref: string;

  constructor(resource: string, ref: string) {
    super(`${resource} '${ref}' not found`, 404, "NOT_FOUND");
    this.name = "NotFoundError";
    this.resource = resource;
    this.ref = ref;
  }
}

/** 409 — Conflict */
export class ConflictError extends NexusError {
  constructor(message: string, details: ErrorDetail[] = []) {
    super(message, 409, "CONFLICT", details);
    this.name = "ConflictError";
  }
}

/** 429 — Rate Limited */
export class RateLimitedError extends NexusError {
  public readonly retryAfter: number;

  constructor(retryAfter: number) {
    super(
      `Too many requests. Please retry after ${retryAfter} seconds.`,
      429,
      "RATE_LIMITED",
    );
    this.name = "RateLimitedError";
    this.retryAfter = retryAfter;
  }
}

/** 500 — Internal Error (for explicit throws, not catch-all) */
export class InternalError extends NexusError {
  constructor(message = "An unexpected error occurred") {
    super(message, 500, "INTERNAL_ERROR");
    this.name = "InternalError";
  }
}
```

### 5.3 Error Code → HTTP Status Mapping

| Error Class | `code` | HTTP | When to Throw |
|-------------|--------|------|---------------|
| `ValidationError` | `VALIDATION_ERROR` | 400 | Zod schema failure (handled by global handler) |
| `UnauthorizedError` | `UNAUTHORIZED` | 401 | Missing/invalid session |
| `ForbiddenError` | `FORBIDDEN` | 403 | Valid session, insufficient permission |
| `NotFoundError` | `NOT_FOUND` | 404 | Resource not found by slug/ID |
| `ConflictError` | `CONFLICT` | 409 | Duplicate resource |
| `RateLimitedError` | `RATE_LIMITED` | 429 | Rate limit exceeded |
| `InternalError` | `INTERNAL_ERROR` | 500 | Explicit internal failure (rare) |

---

## 6. Logging Levels & Usage

### 6.1 Level Definitions

| Level | Numeric | Usage | Examples |
|-------|---------|-------|----------|
| `debug` | 10 | Development-only diagnostics. Never emitted in production. | Cache hit/miss, query plans, detailed flow tracing. |
| `info` | 20 | Normal operational events. | Request received, response sent, cache write, config loaded. |
| `warn` | 30 | Recoverable issues; degraded but functional. | 4xx client errors, rate limit hit, deprecated API usage, slow query (>500ms). |
| `error` | 30 | Unrecoverable failures requiring intervention. | 5xx server errors, database connection lost, unhandled exceptions. |

> **Note:** There is no `fatal` level. Nexus Anime treats all fatal conditions as `error` and relies on the hosting platform (Vercel) for process-level restart.

### 6.2 Level Usage by Layer

| Layer | `debug` | `info` | `warn` | `error` |
|-------|---------|--------|--------|---------|
| **Middleware** | Session resolution detail | Request start, request complete | Rate limit hit, auth redirect | Middleware crash |
| **Route Handler** | Parsed params | Response sent (2xx) | 4xx errors | 5xx errors |
| **Service** | Cache hit/miss | Operation start/end | Business rule violation, external API retry | External API failure, data integrity issue |
| **Repository** | Query SQL, row count | Query executed | Slow query (>500ms) | Query failure, connection error |
| **Client** | Render cycles, state changes | Page navigation, action triggered | API error received, retry | Unhandled promise rejection |

### 6.3 What NOT to Log

The following must **never** appear in any log output:

| Forbidden | Reason |
|-----------|--------|
| Passwords, secrets, API keys | Security |
| Session tokens / JWTs | Security |
| Full credit card numbers | PCI compliance |
| Email addresses (full) | GDPR/privacy — use `user_***@domain.com` or hash |
| Raw SQL with parameter values | Use parameterized query logs only |
| Request/response bodies containing PII | Sanitize before logging |
| Stack traces in production | Log stack locally; send to Sentry in production |

---

## 7. Structured Log Format

### 7.1 Log Entry Schema

Every log entry is a **single JSON object** written to `stdout`. Fields are ordered by convention for readability:

```typescript
interface LogEntry {
  // ── Required ──────────────────────────────────────────────────
  timestamp: string;       // ISO 8601, e.g. "2026-06-24T10:30:00.000Z"
  level: "debug" | "info" | "warn" | "error";
  message: string;         // Human-readable summary

  // ── Context (always include when available) ──────────────────
  requestId?: string;      // Correlation ID from request
  route?: string;          // Route pattern, e.g. "GET /api/v1/titles/[slug]"
  userId?: string;         // Authenticated user ID (omit if unauthenticated)

  // ── Optional ──────────────────────────────────────────────────
  [key: string]: unknown;  // Additional structured context
}
```

### 7.2 Log Entry Examples

**Request received (info):**
```json
{
  "timestamp": "2026-06-24T10:30:00.000Z",
  "level": "info",
  "message": "Request received",
  "requestId": "req_abc123def456",
  "route": "GET /api/v1/titles/attack-on-titan",
  "method": "GET",
  "path": "/api/v1/titles/attack-on-titan",
  "userAgent": "Mozilla/5.0...",
  "ip": "203.0.113.42"
}
```

**Response sent (info):**
```json
{
  "timestamp": "2026-06-24T10:30:00.042Z",
  "level": "info",
  "message": "Response sent",
  "requestId": "req_abc123def456",
  "route": "GET /api/v1/titles/attack-on-titan",
  "statusCode": 200,
  "durationMs": 42
}
```

**Domain error (warn):**
```json
{
  "timestamp": "2026-06-24T10:30:01.123Z",
  "level": "warn",
  "message": "Title not found",
  "requestId": "req_abc123def456",
  "route": "GET /api/v1/titles/nonexistent",
  "errorCode": "NOT_FOUND",
  "resource": "Title",
  "ref": "nonexistent"
}
```

**Database error (error):**
```json
{
  "timestamp": "2026-06-24T10:30:02.456Z",
  "level": "error",
  "message": "Database connection failed",
  "requestId": "req_abc123def456",
  "route": "GET /api/v1/titles",
  "errorCode": "INTERNAL_ERROR",
  "dbHost": "nexus-anime-db.neon.tech",
  "retryAttempt": 3
}
```

**Slow query warning (warn):**
```json
{
  "timestamp": "2026-06-24T10:30:03.789Z",
  "level": "warn",
  "message": "Slow query detected",
  "requestId": "req_abc123def456",
  "route": "GET /api/v1/search",
  "queryHash": "search_titles_fts",
  "durationMs": 1250,
  "thresholdMs": 500
}
```

### 7.3 Logger Implementation

```typescript
// apps/web/lib/logging/logger.ts

import "server-only";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function shouldLog(messageLevel: LogLevel): boolean {
  const configLevel: LogLevel =
    (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === "production" ? "info" : "debug");
  return LOG_LEVEL_PRIORITY[messageLevel] >= LOG_LEVEL_PRIORITY[configLevel];
}

function formatEntry(level: LogLevel, message: string, context: Record<string, unknown>): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };
}

function output(entry: LogEntry): void {
  const json = JSON.stringify(entry);
  switch (entry.level) {
    case "error":
      console.error(json);
      break;
    case "warn":
      console.warn(json);
      break;
    default:
      console.log(json);
  }
}

export const logger = {
  debug(message: string, context: Record<string, unknown> = {}): void {
    if (!shouldLog("debug")) return;
    output(formatEntry("debug", message, context));
  },

  info(message: string, context: Record<string, unknown> = {}): void {
    if (!shouldLog("info")) return;
    output(formatEntry("info", message, context));
  },

  warn(message: string, context: Record<string, unknown> = {}): void {
    if (!shouldLog("warn")) return;
    output(formatEntry("warn", message, context));
  },

  error(message: string, context: Record<string, unknown> = {}): void {
    if (!shouldLog("error")) return;
    output(formatEntry("error", message, context));
  },
};
```

### 7.4 Environment Variable

| Variable | Default | Values | Description |
|----------|---------|--------|-------------|
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | `debug`, `info`, `warn`, `error` | Minimum log level to emit |

---

## 8. Error Response Format

### 8.1 Envelope (Authoritative)

All error responses conform to the envelope defined in `docs/api-specification.md` §1.2:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  },
  "meta": {
    "requestId": "req_abc123def456",
    "version": "v1"
  }
}
```

### 8.2 Enhancement to Existing Envelope

The existing `errorResponse()` function in `apps/web/lib/api/envelope.ts` is extended to accept an optional `meta` parameter:

```typescript
// apps/web/lib/api/envelope.ts (additions)

export interface ApiMeta {
  requestId: string;
  version: string;
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
  meta: ApiMeta;
}

export function successResponse<T>(
  data: T,
  meta: ApiMeta,
): ApiSuccessResponse<T> {
  return { data, meta };
}

export function errorResponse(
  message: string,
  code: string,
  meta: ApiMeta,
  details: ApiErrorDetail[] = [],
): ApiErrorResponse {
  return {
    error: { message, code, details },
    meta,
  };
}
```

### 8.3 Error Response Examples by Code

**VALIDATION_ERROR (400):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "email", "message": "Invalid email format" },
      { "field": "password", "message": "Password must be at least 8 characters" }
    ]
  },
  "meta": { "requestId": "req_val_001", "version": "v1" }
}
```

**UNAUTHORIZED (401):**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  },
  "meta": { "requestId": "req_auth_001", "version": "v1" }
}
```

**FORBIDDEN (403):**
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "An active Nexus Prime subscription is required to stream content"
  },
  "meta": { "requestId": "req_forb_001", "version": "v1" }
}
```

**NOT_FOUND (404):**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Title 'nonexistent-slug' not found"
  },
  "meta": { "requestId": "req_nf_001", "version": "v1" }
}
```

**CONFLICT (409):**
```json
{
  "error": {
    "code": "CONFLICT",
    "message": "This anime is already in your watchlist"
  },
  "meta": { "requestId": "req_conf_001", "version": "v1" }
}
```

**RATE_LIMITED (429):**
```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please retry after 847 seconds."
  },
  "meta": { "requestId": "req_rl_001", "version": "v1" }
}
```

**INTERNAL_ERROR (500):**
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
  },
  "meta": { "requestId": "req_int_001", "version": "v1" }
}
```

> **Critical:** The `INTERNAL_ERROR` response **never** includes the actual error message, stack trace, or internal details. Those are only in server-side logs.

---

## 9. Request Correlation (requestId)

### 9.1 Purpose

Every request is assigned a unique `requestId` that is:
1. Injected into the request context by middleware.
2. Included in every log entry for that request.
3. Returned in the response `meta.requestId` field.
4. Included in error responses for support ticket correlation.

### 9.2 Generation

```typescript
// apps/web/lib/logging/request-id.ts

import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

const REQUEST_ID_HEADER = "X-Request-Id";

/**
 * Extracts or generates a requestId for the current request.
 * Priority:
 * 1. Client-provided X-Request-Id header (for client-side tracing)
 * 2. Auto-generated UUID v4 with "req_" prefix
 */
export function getRequestId(request?: NextRequest): string {
  if (request) {
    const clientRequestId = request.headers.get(REQUEST_ID_HEADER);
    if (clientRequestId) return clientRequestId;
  }
  return `req_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}
```

### 9.3 Middleware Integration

```typescript
// apps/web/middleware.ts (M2.9 additions)

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRequestId } from "@/lib/logging/request-id";
import { logger } from "@/lib/logging/logger";

export function middleware(request: NextRequest) {
  const requestId = getRequestId(request);
  const startTime = Date.now();

  // Log request entry
  logger.info("Request received", {
    requestId,
    method: request.method,
    path: request.nextUrl.pathname,
    ip: request.ip ?? "unknown",
  });

  // Inject requestId into headers for downstream access
  const response = NextResponse.next();
  response.headers.set("X-Request-Id", requestId);

  // Log response completion
  const duration = Date.now() - startTime;
  logger.info("Request completed", {
    requestId,
    durationMs: duration,
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

### 9.4 Response Header

Every API response includes:

| Header | Example | Description |
|--------|---------|-------------|
| `X-Request-Id` | `req_abc123def456` | Correlation ID for log lookup |
| `API-Version` | `v1` | Current API version |

---

## 10. Audit Logs

### 10.1 Purpose

Audit logs record **security-relevant** and **business-critical** actions for compliance, incident investigation, and accountability. Unlike operational logs, audit logs are **immutable** and **retained for 90 days minimum**.

### 10.2 Audit Event Schema

```typescript
interface AuditEntry {
  timestamp: string;        // ISO 8601
  event: string;            // Dot-separated event name
  actorId: string;          // User who performed the action
  actorRole: string;        // Role at time of action
  target?: string;          // Resource affected (e.g., "user:uuid", "title:slug")
  outcome: "success" | "failure";
  requestId: string;        // Correlation ID
  ip?: string;              // Client IP
  userAgent?: string;       // Client user agent
  metadata?: Record<string, unknown>; // Event-specific data (sanitized)
}
```

### 10.3 Audit Events Catalog

| Event | Actor | Target | Description |
|-------|-------|--------|-------------|
| `auth.login.success` | user | — | Successful login |
| `auth.login.failure` | — | — | Failed login attempt (include reason, not password) |
| `auth.logout` | user | — | Session destroyed |
| `auth.register` | user | — | New account created |
| `auth.password_reset.request` | user | — | Password reset requested |
| `auth.password_reset.complete` | user | — | Password reset completed |
| `auth.oauth.link` | user | provider | OAuth account linked |
| `auth.session.expired` | user | — | Session expired |
| `user.profile.update` | user | user | Profile fields changed |
| `user.role.change` | admin | user | Role modified (include old + new) |
| `user.suspend` | admin | user | User suspended |
| `user.unsuspend` | admin | user | User unsuspended |
| `user.delete` | user/admin | user | Account deleted |
| `billing.subscription.create` | user | subscription | New subscription |
| `billing.subscription.cancel` | user | subscription | Subscription canceled |
| `billing.subscription.update` | user | subscription | Plan changed |
| `billing.payment.success` | system | invoice | Payment received |
| `billing.payment.failure` | system | invoice | Payment failed |
| `admin.title.create` | admin | title | Title created |
| `admin.title.update` | admin | title | Title modified |
| `admin.title.delete` | admin | title | Title soft-deleted |
| `admin.episode.publish` | admin | episode | Episode published |
| `admin.shelf.update` | admin | shelf | Shelf modified |

### 10.4 Audit Logger Implementation

```typescript
// apps/web/lib/logging/audit.ts

import "server-only";
import { logger } from "./logger";

type AuditEvent =
  | "auth.login.success"
  | "auth.login.failure"
  | "auth.logout"
  | "auth.register"
  | "auth.password_reset.request"
  | "auth.password_reset.complete"
  | "auth.oauth.link"
  | "auth.session.expired"
  | "user.profile.update"
  | "user.role.change"
  | "user.suspend"
  | "user.unsuspend"
  | "user.delete"
  | "billing.subscription.create"
  | "billing.subscription.cancel"
  | "billing.subscription.update"
  | "billing.payment.success"
  | "billing.payment.failure"
  | "admin.title.create"
  | "admin.title.update"
  | "admin.title.delete"
  | "admin.episode.publish"
  | "admin.shelf.update";

interface AuditContext {
  actorId: string;
  actorRole: string;
  target?: string;
  outcome: "success" | "failure";
  requestId: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export function audit(event: string, ctx: AuditContext): void {
  logger.info(`AUDIT: ${event}`, {
    type: "audit",
    event,
    ...ctx,
  });
}
```

### 10.5 Usage Example

```typescript
// In a login service
audit("auth.login.success", {
  actorId: user.id,
  actorRole: user.role,
  outcome: "success",
  requestId,
  ip: request.headers.get("x-forwarded-for") ?? undefined,
  userAgent: request.headers.get("user-agent") ?? undefined,
});

// In a role change action
audit("user.role.change", {
  actorId: adminUser.id,
  actorRole: adminUser.role,
  target: `user:${targetUserId}`,
  outcome: "success",
  requestId,
  metadata: { previousRole: oldRole, newRole: newRole },
});
```

---

## 11. Client-Side Error Handling

### 11.1 API Error Handling

All API calls via TanStack Query use a shared error handler:

```typescript
// apps/web/lib/api/client.ts

import { isApiErrorResponse } from "@/lib/api/envelope";

export interface ApiClientError {
  code: string;
  message: string;
  details: { field?: string; message: string }[];
  requestId: string;
}

export async function parseApiError(response: Response): Promise<ApiClientError> {
  const body = await response.json();

  if (isApiErrorResponse(body)) {
    return {
      code: body.error.code,
      message: body.error.message,
      details: body.error.details,
      requestId: body.meta?.requestId ?? "unknown",
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
    details: [],
    requestId: response.headers.get("X-Request-Id") ?? "unknown",
  };
}
```

### 11.2 TanStack Query Global Error Handler

```typescript
// apps/web/lib/api/query-client.ts

import { QueryClient, MutationCache, QueryCache } from "@tanstack/react-query";
import { toast } from "sonner"; // or custom toast system (S3+)
import { parseApiError } from "./client";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Log to client-side observability (S9: Sentry)
      console.error("[Query Error]", { error, queryKey: query.queryKey });

      // User-facing toast for unexpected errors only
      if (error instanceof Response && error.status >= 500) {
        toast.error("Something went wrong. Please try again.");
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      console.error("[Mutation Error]", { error });
    },
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Response && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      staleTime: 30_000, // 30 seconds
    },
  },
});
```

### 11.3 Error Code → User Message Mapping

| Error Code | User-Facing Message | Action |
|------------|---------------------|--------|
| `VALIDATION_ERROR` | Show field-level errors from `details` | Inline form errors |
| `UNAUTHORIZED` | "Please log in to continue." | Redirect to `/login` |
| `FORBIDDEN` | "You don't have permission to do this." | Show message, no redirect |
| `NOT_FOUND` | "The requested content could not be found." | Show 404 state |
| `CONFLICT` | Context-specific (e.g., "Already in watchlist") | Inline message |
| `RATE_LIMITED` | "Too many requests. Please wait and try again." | Show countdown |
| `INTERNAL_ERROR` | "Something went wrong. Please try again later." | Toast + retry button |

---

## 12. React Error Boundaries

### 12.1 Global Error Boundary

Next.js requires `global-error.tsx` to catch errors outside the component tree:

```tsx
// apps/web/app/global-error.tsx

"use client";

import { useEffect } from "react";
import { Button } from "@nexus/ui";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log to error tracking (Sentry in S9)
    console.error("[Global Error]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <html>
      <body>
        <div role="alert">
          <h2>Something went wrong</h2>
          <p>We've been notified and are working on a fix.</p>
          <p>
            <small>Reference: {error.digest ?? "N/A"}</small>
          </p>
          <Button onClick={reset}>Try again</Button>
        </div>
      </body>
    </html>
  );
}
```

### 12.2 Route-Level Error Boundary

```tsx
// apps/web/app/error.tsx

"use client";

import { useEffect } from "react";
import { Button } from "@nexus/ui";

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RouteError({ error, reset }: RouteErrorProps) {
  useEffect(() => {
    console.error("[Route Error]", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div role="alert">
      <h2>Something went wrong</h2>
      <p>Please try again or go back.</p>
      <p>
        <small>Reference: {error.digest ?? "N/A"}</small>
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
```

### 12.3 Feature-Level Error Boundary

For granular error isolation within feature sections:

```tsx
// apps/web/components/error-boundary.tsx

"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@nexus/ui";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: { componentStack: string | null }) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string | null }) {
    console.error("[ErrorBoundary]", {
      message: error.message,
      componentStack: errorInfo.componentStack,
    });
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div role="alert">
          <p>This section failed to load.</p>
          <Button onClick={this.reset}>Retry</Button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## 13. Observability Pipeline

### 13.1 Log Flow by Environment

```
┌─────────────────────────────────────────────────────────────────┐
│                        Development                              │
│                                                                  │
│  App → JSON stdout → Terminal (pretty-printed via pino-pretty)  │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                        Production (Vercel)                       │
│                                                                  │
│  App → JSON stdout → Vercel Log Drain → Axiom                  │
│                        │                                         │
│                        ├─→ Sentry (errors only, S9)             │
│                        └─→ Vercel Analytics (S9)                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 13.2 Log Shipping

| Environment | Destination | Tool | Notes |
|-------------|-------------|------|-------|
| Local | stdout | `console.log/warn/error` | Pretty-printed via `pino-pretty` in dev |
| Preview | Vercel logs | Built-in | 7-day retention |
| Staging | Vercel logs + Axiom | Log drain | 30-day retention |
| Production | Vercel logs + Axiom + Sentry | Log drain | 90-day retention (logs), 180-day (errors) |

### 13.3 Sentry Integration (S9)

When Sentry is integrated (S9), the following is added:

```typescript
// apps/web/lib/logging/sentry.ts (S9)

import * as Sentry from "@sentry/nextjs";
import { logger } from "./logger";

/**
 * Reports an error to Sentry with Nexus-specific context.
 * Called by the global error handler for 5xx errors.
 */
export function reportError(
  error: Error,
  context: {
    requestId: string;
    route: string;
    userId?: string;
    level?: "error" | "fatal";
  },
): void {
  Sentry.withScope((scope) => {
    scope.setTag("requestId", context.requestId);
    scope.setTag("route", context.route);
    if (context.userId) {
      scope.setUser({ id: context.userId });
    }
    scope.setLevel(context.level ?? "error");
    Sentry.captureException(error);
  });

  // Also log locally for Vercel log drain
  logger.error(error.message, {
    type: "sentry_report",
    requestId: context.requestId,
    route: context.route,
  });
}
```

### 13.4 Key Metrics to Track

| Metric | Type | Source | Alert Threshold |
|--------|------|--------|-----------------|
| Error rate (5xx) | Percentage | Axiom / Vercel | > 1% over 5 min |
| P95 request latency | Milliseconds | Axiom | > 2000ms over 5 min |
| P99 request latency | Milliseconds | Axiom | > 5000ms over 5 min |
| Rate limit hits | Count per minute | Axiom | > 100/min |
| Database error rate | Percentage | Axiom | > 0.1% over 5 min |
| Cache hit ratio | Percentage | Axiom | < 80% over 15 min |
| Audit event count | Count per hour | Axiom | Anomaly detection |

---

## 14. Environment Behavior Matrix

| Behavior | Local | Preview | Staging | Production |
|----------|-------|---------|---------|------------|
| **Log level** | `debug` | `info` | `info` | `info` |
| **Log format** | Pretty (pino-pretty) | JSON | JSON | JSON |
| **Log destination** | stdout (terminal) | Vercel logs | Vercel + Axiom | Vercel + Axiom |
| **Sentry** | Disabled | Disabled | Enabled (staging DSN) | Enabled (prod DSN) |
| **Stack traces in response** | ❌ Never | ❌ Never | ❌ Never | ❌ Never |
| **Error details in response** | Generic message | Generic message | Generic message | Generic message |
| **Audit log retention** | N/A (console) | 30 days | 90 days | 90 days |
| **Log retention** | Session | 7 days (Vercel) | 30 days | 90 days |

---

## 15. Implementation Checklist

### 15.1 Backend (S2–S4)

| # | Task | Sprint | Status |
|---|------|--------|--------|
| 1 | Create `apps/web/lib/api/errors/errors.ts` — typed error hierarchy | S2 | ⬜ |
| 2 | Create `apps/web/lib/api/errors/handler.ts` — global exception handler | S2 | ⬜ |
| 3 | Create `apps/web/lib/logging/logger.ts` — structured JSON logger | S2 | ⬜ |
| 4 | Create `apps/web/lib/logging/request-id.ts` — requestId generation | S2 | ⬜ |
| 5 | Create `apps/web/lib/logging/audit.ts` — audit event logger | S2 | ⬜ |
| 6 | Update `apps/web/lib/api/envelope.ts` — add `meta` to responses | S2 | ⬜ |
| 7 | Update `apps/web/middleware.ts` — inject requestId, log requests | S2 | ⬜ |
| 8 | Refactor all Route Handlers to use `handleApiError` | S2–S3 | ⬜ |
| 9 | Refactor all Server Actions to use `handleActionError` | S2–S3 | ⬜ |
| 10 | Add audit calls to auth flows (login, logout, register) | S4 | ⬜ |
| 11 | Add audit calls to billing flows (subscribe, cancel) | S5 | ⬜ |
| 12 | Add audit calls to admin flows (CRUD, role changes) | S8 | ⬜ |

### 15.2 Frontend (S3–S4)

| # | Task | Sprint | Status |
|---|------|--------|--------|
| 13 | Create `apps/web/app/global-error.tsx` | S3 | ⬜ |
| 14 | Create `apps/web/app/error.tsx` | S3 | ⬜ |
| 15 | Create `apps/web/components/error-boundary.tsx` | S3 | ⬜ |
| 16 | Create `apps/web/lib/api/client.ts` — API error parser | S3 | ⬜ |
| 17 | Create `apps/web/lib/api/query-client.ts` — global error handler | S3 | ⬜ |
| 18 | Wrap feature sections with `ErrorBoundary` | S3–S4 | ⬜ |

### 15.3 Observability (S9)

| # | Task | Sprint | Status |
|---|------|--------|--------|
| 19 | Install and configure Sentry SDK | S9 | ⬜ |
| 20 | Create `apps/web/lib/logging/sentry.ts` | S9 | ⬜ |
| 21 | Configure Axiom log drain on Vercel | S9 | ⬜ |
| 22 | Set up alerts (error rate, latency, DB errors) | S9 | ⬜ |
| 23 | Configure `sentry.config.ts` with Nexus context | S9 | ⬜ |

---

## Appendix A: Quick Reference — Throwing Errors in Services

```typescript
// 400 — Validation (usually handled by Zod in route handler)
throw new ValidationError([{ field: "email", message: "Invalid format" }]);

// 401 — Unauthorized
throw new UnauthorizedError();

// 403 — Forbidden
throw new ForbiddenError("An active subscription is required");

// 404 — Not Found
throw new NotFoundError("Title", slug);

// 409 — Conflict
throw new ConflictError("This anime is already in your watchlist");

// 429 — Rate Limited
throw new RateLimitedError(retryAfterSeconds);

// 500 — Internal (explicit)
throw new InternalError();
// OR let the global handler catch unexpected errors
```

## Appendix B: Quick Reference — Logging in Services

```typescript
import { logger } from "@/lib/logging/logger";

// Debug (dev only)
logger.debug("Cache hit", { requestId, key: cacheKey });

// Info
logger.info("Title fetched", { requestId, titleId, durationMs: 42 });

// Warn
logger.warn("Slow query detected", { requestId, queryHash, durationMs: 1250 });

// Error
logger.error("Database connection failed", {
  requestId,
  dbHost: "nexus-anime-db.neon.tech",
  retryAttempt: 3,
});
```

## Appendix C: File Structure Summary

```
apps/web/
├── lib/
│   ├── api/
│   │   ├── envelope.ts              # Updated with meta
│   │   ├── errors/
│   │   │   ├── errors.ts            # Typed error classes
│   │   │   ├── handler.ts           # Global exception handler
│   │   │   └── index.ts             # Barrel export
│   │   ├── client.ts                # Client-side API error parser
│   │   └── query-client.ts          # TanStack Query error config
│   └── logging/
│       ├── logger.ts                # Structured JSON logger
│       ├── request-id.ts            # RequestId generation
│       ├── audit.ts                 # Audit event logger
│       ├── sentry.ts                # Sentry integration (S9)
│       └── index.ts                 # Barrel export
├── components/
│   └── error-boundary.tsx           # Reusable ErrorBoundary
├── app/
│   ├── global-error.tsx             # Next.js global error boundary
│   └── error.tsx                    # Next.js route error boundary
└── middleware.ts                     # Updated with requestId + logging
```

---

*This document is the authoritative standard for logging and error handling in Nexus Anime. All route handlers, services, server actions, and React components must conform to the patterns defined herein. For the API contract, see [api-specification.md](./api-specification.md). For backend architecture, see [architecture/backend-architecture.md](./architecture/backend-architecture.md).*
