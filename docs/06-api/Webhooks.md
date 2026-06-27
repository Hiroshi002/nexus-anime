# Webhooks

**Status: RESERVED**

This document describes webhook endpoints that are planned but not yet implemented. The API surface is documented here for forward-consumers and to lock naming, security, and behavior decisions before implementation begins.

## Purpose

Nexus Anime will accept asynchronous event delivery from upstream providers:

- **Stripe** — payment lifecycle events (checkout completed, subscription updated, invoice failed).
- **Cloudflare Stream** — video processing lifecycle (encoding complete, ready to stream, error).

Webhook endpoints are the only ingress path where payloads originate from outside the platform and must be authenticated at the edge before any processing occurs.

## Planned Endpoints

| Method | Path                      | Upstream          | Signature Header       |
| ------ | ------------------------- | ----------------- | ---------------------- |
| `POST` | `/api/v1/webhooks/stripe` | Stripe            | `Stripe-Signature`     |
| `POST` | `/api/v1/webhooks/stream` | Cloudflare Stream | `Cloudflare-Signature` |

Both endpoints share the same contract:

- **Input**: raw JSON body (do not parse before verifying signature).
- **Success response**: `200 OK` with `{ received: true }`.
- **Signature failure**: `400 Bad Request` with `{ error: { message: "Invalid signature", code: "WEBHOOK_INVALID_SIGNATURE" } }`.
- **Idempotent replay**: `200 OK` (no-op if event ID already processed).
- **Processing failure**: `500 Internal Server Error` — upstream will retry with exponential backoff.

## Planned Behavior

### Signature Verification

1. Read the raw request body (do not let a framework parse it first — signature is over the raw bytes).
2. Extract the signature header specific to the upstream.
3. Compute the expected signature using the webhook secret stored in environment variables (`STRIPE_WEBHOOK_SECRET`, `CF_STREAM_WEBHOOK_SECRET`).
4. Compare using a constant-time comparison. Reject on mismatch.

**Never trust a payload that fails signature verification.** Log the attempt at WARN level with the header name and timestamp; do not log the signature value itself.

### Idempotency

- Extract the event ID from the payload (Stripe: `id` field; Cloudflare: `event.id` or `cf-ray` + `timestamp`).
- Check Redis key `nexus:webhook:{provider}:{eventId}`.
- If the key exists, return `200 OK` immediately (dedup hit).
- If the key does not exist, set it with a 24-hour TTL, then proceed to processing.

This prevents double-processing when upstream retries a delivery.

### Async Processing

The webhook handler must return `200 OK` within 5 seconds. Long-running work (database writes, state transitions, notification dispatch) is pushed to a background worker queue:

1. Handler verifies signature and idempotency.
2. Emit a job to the queue with the verified event payload.
3. Return `200 OK`.
4. Worker processes the job asynchronously; on failure, retry with exponential backoff (3 attempts), then move to a dead-letter queue for manual inspection.

### Rate Limit

- **Budget**: 100 requests per 60-second window per IP.
- **Enforcement**: token-bucket via Redis, keyed by source IP.
- **Exceeding the limit**: `429 Too Many Requests` with `Retry-After` header.

This protects the signature-verification path (HMAC is CPU-bound) from abuse.

### Security

- Webhook secrets live in environment variables only. Never in code, never in logs.
- Raw payload is logged at `DEBUG` level only. In production, DEBUG logging is disabled.
- Signature verification runs before any payload parsing — malformed JSON on a bad-signature request must not cause a server-side exception.
- Each upstream has its own secret. Compromise of one does not compromise the other.

## Future Work

- **Webhook registration UI**: admin panel to register and rotate secrets per upstream.
- **Retry policy**: configurable per-upstream backoff strategy and max-retry count.
- **Dead-letter queue**: persisted store for events that exhausted retries, with replay capability.
- **Observability**: metrics on webhook delivery latency, signature failure rate, dedup hit rate, and queue depth.
- **Additional providers**: the endpoint pattern (`/api/v1/webhooks/{provider}`) is designed to be extended without a new route per provider if the signature scheme is shared.
