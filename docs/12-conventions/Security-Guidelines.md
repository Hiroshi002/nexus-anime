# Security Guidelines — Nexus Anime

> **Audience:** All engineers writing, reviewing, and deploying code. This document translates the [Security Architecture](../03-architecture/Security-Architecture.md) into actionable conventions that must be followed on every PR.

---

## 1. Input Validation

### Zod on every boundary

Every external input must be validated with Zod before processing. Client-side validation is for UX only; server-side validation is the security boundary.

| Boundary | What to validate |
|----------|-----------------|
| Server Actions | FormData fields, composed inputs |
| Route Handlers | Request body, query string, path params |
| External API responses | Third-party data shapes (TMDB, AniList, Stripe) |
| Dynamic route segments | URL params (`z.uuid().parse(params.id)`) |

Define Zod schemas adjacent to their consumer or in a shared `schemas/` directory if reused. Derive TypeScript types with `z.infer` — never hand-write a parallel interface.

### Sanitize user-generated content

| Content type | Sanitizer | Rationale |
|-------------|-----------|-----------|
| Plain text (comments, bios) | `DOMPurify.sanitize(text, { ALLOWED_TAGS: [] })` | Strip all HTML |
| Rich text (future: reviews) | `DOMPurify.sanitize(html, { ALLOWED_TAGS: ['b', 'i', 'a'] })` | Allow limited tags only |
| URLs (profile links) | `z.url()` + protocol check (`https:` only) | Prevent `javascript:` URL XSS |

Do not use regex-based sanitizers. Infinite XSS bypasses exist for regex patterns. DOMPurify parses HTML into a DOM tree and filters at the AST level, which is sound.

---

## 2. Output Encoding

### React auto-escaping

React escapes all interpolated values by default. `{userInput}` is safe — React converts `<script>` to `&lt;script&gt;`. This is the primary XSS defense for 99% of rendered content.

### dangerouslySetInnerHTML — only when sanitized

`dangerouslySetInnerHTML` bypasses React's auto-escaping. Use it **only** when the content has been sanitized through DOMPurify first. If you find raw `dangerouslySetInnerHTML` in a PR, request a DOMPurify step or restructure as React elements.

### No secrets in responses

Every Route Handler and Server Action response must never contain API keys, internal URLs, session tokens, or stack traces. Use Zod output validation on Route Handlers to strip accidental field leakage:

```ts
const validated = animeDetailResponseSchema.parse(anime); // strips extra fields
return NextResponse.json({ data: validated });
```

---

## 3. Authentication

### Password hashing

- Bcrypt with work factor 12. Do not lower without security review.
- Never log password values or hashes.
- Reset tokens must be single-use and expire within 1 hour.

### Session management

Session cookies are set by Auth.js v5 with `httpOnly`, `secure`, `sameSite=lax`, and a 30-day `maxAge`. Session revocation is database-backed — deleting the session row immediately invalidates the session.

### OAuth flow (Google, GitHub)

- Authorization code flow only — never implicit flow.
- The `state` parameter prevents CSRF during the OAuth callback.
- OAuth tokens are never stored client-side.

### CSRF protection

Auth.js uses the Double Submit Cookie pattern combined with `sameSite=lax`. Do not disable CSRF protection on any route. If an endpoint needs cross-origin requests, use CORS + origin validation instead.

---

## 4. Authorization

### Role-based access control (RBAC)

| Role | Capabilities |
|------|-------------|
| `viewer` | Browse catalog, watch free content, manage own watchlist |
| `subscriber` | All viewer + premium content, HD streams |
| `admin` | All subscriber + catalog management, user management |

### Middleware auth guards

`apps/web/src/middleware.ts` runs on every request at the Edge. It checks authenticated routes (redirect to `/login`), admin routes (return 403), and skips auth for public endpoints. Keep middleware thin: no database calls, no heavy computation.

### Server Action auth checks

Every Server Action that performs a mutation must verify the session independently:

```ts
const session = await auth();
if (!session?.user) throw new Error("Unauthorized");
```

Never assume the client will only call an action when logged in.

---

## 5. Secrets Management

### Environment variables only

Secrets live in Vercel environment variables, never in source code. All API keys (`DATABASE_URL`, `UPSTASH_REDIS_*`, `AUTH_SECRET`, `AUTH_GOOGLE_*`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TMDB_API_KEY`, `CLOUDFLARE_STREAM_*`) are server-only — no `NEXT_PUBLIC_*` prefix for API keys.

### What never contains secrets

- Client-side JavaScript (no `NEXT_PUBLIC_*` for API keys)
- Source code (no hardcoded values)
- Git history (`.env.local` and `.env.production.local` are gitignored)
- Client responses (Zod strips unknown fields)
- Logs (Pino serializers strip sensitive fields)

### Local and CI

- Copy `.env.example` to `.env.local` with placeholder values — never commit real production secrets.
- GitHub Actions secrets for deployment. Vercel env vars per environment (Preview, Production).
- Rotate secrets when team members with access leave the project.

---

## 6. API Security

### Rate limiting

| Endpoint | Limit | Window | Enforcement |
|----------|-------|--------|-------------|
| Login attempts | 5 attempts | 5 minutes | Per IP + per email |
| Password reset | 3 attempts | 15 minutes | Per email |
| Server Actions (mutations) | 30 requests | 1 minute | Per session |
| Public API reads | 100 requests | 1 minute | Per IP |

Use Upstash Redis for counters. When Redis is unavailable: fail open for reads, fail closed for security-critical writes (login, password reset).

### CORS

- API routes set strict `Access-Control-Allow-Origin` — only the production domain and preview URLs.
- Never use `Access-Control-Allow-Origin: *` on user-data endpoints.

### Webhook signature verification

Every webhook handler must verify the signature before processing. Without verification, an attacker could forge events and grant themselves a subscription.

```ts
const event = stripe.webhooks.constructEvent(
  await request.text(),
  request.headers.get("stripe-signature"),
  process.env.STRIPE_WEBHOOK_SECRET!
);
```

---

## 7. Database Security

### Parameterized queries — always

Drizzle ORM generates parameterized queries by default. This is the primary SQL injection defense. Do not use `sql` template tags with user input unless the value is explicitly parameterized. When in doubt, use the query builder.

```ts
// Safe — parameterized
await db.select().from(animeTable).where(eq(animeTable.id, userInput));
```

### Least-privilege database user

The application DB user can only read/write application tables. It cannot drop tables, alter schemas, access other databases, or create roles. The migration user is separate.

### Connection pooling

Neon serverless provides HTTP-based connection pooling — enforced by `@nexus/db`. Applications do not configure connections directly. This eliminates connection exhaustion and reduces cold-start latency.

---

## 8. Dependency Security

| Tool | Frequency | What it checks |
|------|-----------|---------------|
| Dependabot | Daily | Known vulnerabilities in npm dependencies |
| CodeQL | Weekly + on PR | Security vulnerability patterns in our code |
| `pnpm audit` | In CI | Known CVEs in lockfile |
| Socket.dev | On install | Supply chain attacks (typosquatting, maintainer changes) |

### Lockfile integrity

`pnpm-lock.yaml` is committed to git. CI runs with `--frozen-lockfile` — no new dependencies can be silently added during CI.

### Adding new dependencies

Before adding a package: check npm downloads (> 10K/week), recent commits (within 6 months), known vulnerabilities, prefer few transitive deps, document the rationale in the PR.

---

## 9. HTTP Security Headers

Set in `next.config.ts` `headers()` and middleware. Do not override or weaken.

| Header | Value | Why |
|--------|-------|-----|
| `Content-Security-Policy` | Dynamic nonce-based | Prevent XSS, control resource origins |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Force HTTPS for 2 years |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-Content-Type-Options` | `nosniff` | Browser respects declared MIME type |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Don't leak full URL to third parties |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Deny sensitive browser APIs |

### CSP

Nonces are generated per-request. Every `<script>` tag must carry the matching nonce. Do not add `'unsafe-inline'` to `script-src` or `'unsafe-eval'`. Adding a new external domain requires updating the CSP, adding a preconnect hint if loaded on initial render, and documenting in the PR.

---

## 10. Video Security

### Cloudflare Stream signed URLs

Video playback URLs are signed server-side with a 5-minute expiry. The signing key is server-only — the client cannot generate signed URLs independently. IP binding is off (mobile WiFi/cellular transitions), but should be considered for piracy-sensitive content.

### Rules

- Never expose the raw (unsigned) video URL to the client.
- Never cache signed URLs client-side beyond their expiry.
- The player must request a fresh signed URL before the current one expires (refresh at ~4 min).
- Video IDs must be UUIDs, not sequential integers.

---

## 11. Incident Response

### Severity levels

| Level | Definition | Response time |
|-------|-----------|---------------|
| **P0 — Critical** | Active data breach or auth bypass | < 15 minutes |
| **P1 — High** | Vulnerability with known exploit path | < 1 hour |
| **P2 — Medium** | Vulnerability without current exploit | < 24 hours |
| **P3 — Low** | Minor misconfiguration or hardening gap | Next sprint |

### Key rotation

1. Generate new secret in provider dashboard (Vercel, Stripe, Cloudflare).
2. Update Vercel environment variable. Redeploy Preview + Production.
3. Revoke old secret after confirming the new one works.
4. Document the rotation in the incident log.

### Post-mortem (P0 and P1)

1. **Contain** — revoke keys, block IPs, disable feature.
2. **Investigate** — root cause and timeline from logs.
3. **Fix** — deploy patch, write regression test.
4. **Write-up** — blameless post-mortem (timeline, root cause, impact, action items).
5. **Review** — share with team within 48 hours, track action items to completion.

### Contact

- Security incidents: email the team lead immediately.
- Vulnerability reports: file a GitHub Security Advisory (private).
- Dependency alerts: Dependabot creates PRs automatically — review critical CVEs within 24 hours.

---

## 12. Security Checklist for PRs

Mandatory for PRs touching auth, payments, or user data; recommended for all others.

### All PRs

- [ ] No secrets in code (API keys, tokens, passwords, connection strings)
- [ ] Zod validation on all inputs (Server Actions, Route Handlers)
- [ ] Auth check on all mutations (`auth()` in Server Actions, middleware guard on routes)
- [ ] No `any` types introduced
- [ ] User-generated content sanitized before rendering (DOMPurify)
- [ ] Stack traces not exposed to client
- [ ] New dependencies reviewed for vulnerabilities
- [ ] No new `NEXT_PUBLIC_*` env vars for secrets

### Auth-related PRs (additional)

- [ ] Session cookie attributes unchanged (httpOnly, secure, sameSite)
- [ ] CSRF protection not disabled
- [ ] Rate limiting applied to new mutation endpoints
- [ ] OAuth `state` parameter verified on callbacks

### Payment-related PRs (additional)

- [ ] No raw card data handled (Stripe.js only)
- [ ] Webhook signatures verified before processing
- [ ] Amount validation on the server (never trust client-side amounts)

### User data PRs (additional)

- [ ] Soft delete used (no automatic hard deletes of user data)
- [ ] Data access scoped to the authenticated user (no unfiltered queries)
- [ ] PII not logged (email, name, IP — use Pino serializers)

---

## 13. OWASP Top 10 Mitigations

| # | OWASP Category | Our Mitigation |
|---|---------------|----------------|
| A01 | Broken Access Control | RBAC, middleware guards, Server Action auth checks, Zod output validation |
| A02 | Cryptographic Failures | bcrypt (wf 12), HTTPS everywhere (HSTS), TLS 1.3, no secrets in code |
| A03 | Injection | Drizzle parameterized queries, Zod input validation, DOMPurify, React auto-escaping |
| A04 | Insecure Design | Defense-in-depth, threat modeling, security checklist, ADRs |
| A05 | Security Misconfiguration | Strict CSP, HSTS, X-Frame-Options DENY, `--frozen-lockfile`, least-privilege DB |
| A06 | Vulnerable Components | Dependabot daily, CodeQL weekly, `pnpm audit` in CI, Socket.dev, lockfile committed |
| A07 | Auth Failures | bcrypt wf 12, rate limiting (5/5min), httpOnly+secure+sameSite cookies, session revocation |
| A08 | Software/Data Integrity | Webhook verification, SRI, `--frozen-lockfile`, signed Stream URLs |
| A09 | Logging/Monitoring Failures | Pino structured logging, Vercel Analytics, p95 metrics, alerts, no PII in logs |
| A10 | SSRF | Server-only API calls, allowlist for external API domains, no user-provided fetch URLs |

---

## Further Reading

- [Security Architecture](../03-architecture/Security-Architecture.md) — threat model and defense-in-depth
- [Authentication Architecture](../03-architecture/Authentication-Architecture.md) — Auth.js config and sessions
- [API Layer](../03-architecture/API-Layer.md) — route contracts and validation patterns
- [Caching Strategy](../03-architecture/Caching-Strategy.md) — Redis security (fail-open, key schema)
- [Error Handling](../03-architecture/Error-Handling.md) — error envelope and stack trace policies
