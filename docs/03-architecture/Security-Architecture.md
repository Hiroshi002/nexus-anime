# Security Architecture — Nexus Anime

> **Audience:** Engineers implementing security measures, handling credentials, and reviewing for vulnerabilities. This document defines the security architecture, threat model, and defense-in-depth strategy.

---

## 1. Threat Model

### In-scope threats

| Threat                                                  | Severity | Mitigation                                          |
| ------------------------------------------------------- | -------- | --------------------------------------------------- |
| **Credential theft** (passwords, OAuth tokens)          | Critical | Bcrypt hashing, secure cookies, no secrets in code  |
| **Session hijacking** (cookie theft, XSS → token exfil) | Critical | httpOnly + secure + sameSite cookies, CSP           |
| **SQL injection**                                       | Critical | Drizzle ORM parameterized queries (no raw SQL)      |
| **XSS** (cross-site scripting)                          | High     | React auto-escaping, DOMPurify for user HTML, CSP   |
| **CSRF** (cross-site request forgery)                   | High     | Auth.js Double Submit Cookie, SameSite cookies      |
| **Brute-force login**                                   | High     | Rate limiting (5 attempts / 5 min), bcrypt slowdown |
| **Data exposure** (leaked API keys, internal URLs)      | High     | Zod output validation, no secrets in responses      |
| **DDoS / abuse**                                        | Medium   | Vercel Edge protection, rate limiting               |
| **Upstream API abuse** (stolen TMDB key)                | Medium   | Server-only API calls, rate limiting                |
| **Content piracy** (video URL sharing)                  | Medium   | Cloudflare Stream signed URLs, 5-min expiry         |
| **Supply chain attack** (malicious npm package)         | Medium   | Dependabot, CodeQL, pnpm lockfile integrity         |

### Out of scope (deferred to M5+)

- Two-factor authentication (TOTP/Passkeys)
- Content security monitoring (DMCA, piracy detection)
- Advanced bot detection (CAPTCHA, fingerprinting)
- SOC 2 / ISO 27001 compliance audit

---

## 2. Defense-in-Depth Layers

```
                     ┌─────────────┐
                     │  Browser    │  CSP, SRI, CORS
                     └──────┬──────┘
                            │
                     ┌──────▼──────┐
                     │  Edge/CDN   │  DDoS protection, rate limiting, security headers
                     └──────┬──────┘
                            │
                     ┌──────▼──────┐
                     │  Middleware  │  Auth guard, geo headers, CSRF
                     └──────┬──────┘
                            │
                     ┌──────▼──────┐
                     │  Application │  Zod validation, auth checks, RBAC
                     └──────┬──────┘
                            │
                     ┌──────▼──────┐
                     │  Data Layer  │  Parameterized queries, soft deletes
                     └──────┬──────┘
                            │
                     ┌──────▼──────┐
                     │  External    │  Signed URLs, webhook verification
                     └─────────────┘
```

Each layer has independent defenses. A breach at one layer doesn't compromise the whole system.

---

## 3. Authentication Security

See [Authentication-Architecture.md](Authentication-Architecture.md) for full details.

### Key measures

| Measure            | Implementation                             | Threat mitigated                       |
| ------------------ | ------------------------------------------ | -------------------------------------- |
| Password hashing   | bcrypt, work factor 12                     | Credential theft (offline brute-force) |
| Session cookies    | `httpOnly`, `secure`, `sameSite=lax`       | XSS → session theft, CSRF              |
| CSRF protection    | Auth.js Double Submit Cookie               | Cross-site request forgery             |
| Rate limiting      | 5 login attempts / 5 minutes               | Brute-force login                      |
| Session revocation | Database session store (delete row)        | Stolen session → immediate revocation  |
| Email verification | Token-based verification before activation | Account takeover via unverified email  |
| No secrets in code | Environment variables only                 | Credential exposure in source control  |

---

## 4. Input Validation

### Zod at every boundary

Every external input is validated with Zod before processing:

| Boundary       | What's validated                        | Schema example                            |
| -------------- | --------------------------------------- | ----------------------------------------- |
| Server Actions | FormData fields                         | `signupSchema.parse({ email, password })` |
| Route Handlers | Request body, query params, path params | `webhookEventSchema.parse(body)`          |
| External APIs  | Response data                           | `tmdbDetailSchema.parse(response)`        |
| URL params     | Dynamic route segments                  | `z.uuid().parse(params.id)`               |

### Why Zod at every boundary, not just at the form

Client validation prevents typos and gives instant feedback, but it can be bypassed (curl, Postman, browser console). Server-side Zod is the actual security boundary — it validates regardless of how the request arrives.

### Sanitization for user-generated content

| Content type                | Sanitizer                                                   | Why                                                 |
| --------------------------- | ----------------------------------------------------------- | --------------------------------------------------- |
| Plain text (comments, bios) | `DOMPurify.sanitize(text, { ALLOWED_TAGS: [] })`            | Strip all HTML — render as plain text               |
| Rich text (future: reviews) | `DOMPurify.sanitize(html, { ALLOWED_TAGS: [...] })`         | Allow limited tags (b, i, a), strip everything else |
| URLs (profile links)        | Validate with `z.url().parse()`, check protocol is `https:` | Prevent `javascript:` URL XSS                       |

### Why DOMPurify, not a regex-based sanitizer

Regex-based sanitizers are fragile — there are infinite XSS bypasses for regex (encoded payloads, nested tags, null bytes). DOMPurify parses the HTML into a DOM tree and filters at the AST level, which is sound.

---

## 5. Output Security

### No secrets in responses

Every Route Handler and Server Action is reviewed to ensure responses never contain:

- API keys (TMDB, Stripe, Stream)
- Internal URLs (database connection strings, Redis URLs)
- Session tokens (only the session cookie, which is httpOnly)
- Stack traces (only in server logs, never in client responses)

### Zod output validation (Route Handlers)

For Route Handlers serving the mobile API, responses are validated before sending:

```ts
const anime = await catalogService.getDetail(id);
const validated = animeDetailResponseSchema.parse(anime); // Strips extra fields
return NextResponse.json({ data: validated });
```

This prevents accidental data leakage (e.g., including `internalNotes` on an anime record because the DB query selected too many columns).

---

## 6. HTTP Security Headers

Set via Next.js `next.config.ts` `headers()` and middleware:

| Header                      | Value                                          | Why                                                         |
| --------------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| `X-Frame-Options`           | `DENY`                                         | Prevent clickjacking — our pages can't be iframed           |
| `X-Content-Type-Options`    | `nosniff`                                      | Prevent MIME type sniffing — browser respects declared type |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`              | Don't leak full URL + query params to third-party origins   |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=()`     | Explicitly deny access to sensitive browser APIs            |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Force HTTPS for 2 years, including subdomains               |
| `Content-Security-Policy`   | Dynamic (see below)                            | Prevent XSS, control resource origins                       |

### Content Security Policy (CSP)

```ts
const cspHeader = `
  default-src 'self';
  script-src 'self' 'nonce-${nonce}' https://js.stripe.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' https://image.tmdb.org https://cdn.nexus-anime.com data:;
  font-src 'self';
  connect-src 'self' https://api.stripe.com https://api.upstash.com;
  frame-src https://js.stripe.com https://embed.cloudflare.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
`;
```

### Why CSP with nonce, not hash

Nonce-based CSP generates a random string per request and adds it to `<script>` tags and the CSP header. Hash-based CSP computes a SHA256 of each inline script. Nonce is simpler for Next.js (which may generate inline scripts dynamically) and doesn't require maintaining a hash list.

---

## 7. API Key Management

### Where secrets live

| Secret                  | Storage                     | Accessed by                       |
| ----------------------- | --------------------------- | --------------------------------- |
| `DATABASE_URL`          | Vercel environment variable | Server-side only (`@nexus/db`)    |
| `UPSTASH_REDIS_*`       | Vercel environment variable | Server-side only (`@nexus/cache`) |
| `AUTH_SECRET`           | Vercel environment variable | Auth.js (server-only)             |
| `AUTH_GOOGLE_*`         | Vercel environment variable | Auth.js OAuth callback            |
| `STRIPE_SECRET_KEY`     | Vercel environment variable | Stripe SDK (server-only)          |
| `STRIPE_WEBHOOK_SECRET` | Vercel environment variable | Webhook handler                   |
| `TMDB_API_KEY`          | Vercel environment variable | TMDB client (server-only)         |
| `CLOUDFLARE_STREAM_*`   | Vercel environment variable | Stream client (server-only)       |

### What NEVER contains secrets

- Client-side JavaScript (no `NEXT_PUBLIC_*` for API keys)
- Source code (no hardcoded values)
- Git history (no committed .env files — `.gitignore` excludes them)
- Client-side responses (Zod validation strips unknown fields)
- Logs (Pino serializers strip sensitive fields)

### Why server-only for all API keys

Next.js distinguishes `NEXT_PUBLIC_*` (available in browser) from `*` (server-only). We never use `NEXT_PUBLIC_` prefixes for API keys. The browser never receives TMDB keys, Stripe keys, or database URLs. All external API calls happen on the server; the client receives only the processed data.

---

## 8. Video Security

### Cloudflare Stream signed URLs

Video playback URLs are signed with a short expiry:

```ts
async function getSignedPlaybackUrl(videoId: string): Promise<string> {
  const token = await cloudflareStream.createSignedToken(videoId, {
    expiry: Date.now() + 5 * 60 * 1000, // 5 minutes
  });
  return `https://customer-${accountId}.cloudflarestream.com/${videoId}/manifest/video.m3u8?token=${token}`;
}
```

| Property    | Value         | Why                                                                                          |
| ----------- | ------------- | -------------------------------------------------------------------------------------------- |
| URL expiry  | 5 minutes     | Short window limits sharing. User must re-request for continued playback.                    |
| Signing key | Server-only   | Client cannot generate signed URLs independently.                                            |
| IP binding  | Off (for now) | IP changes during mobile streaming (WiFi → cellular). Consider for piracy-sensitive content. |

### Why 5-minute expiry

5 minutes is long enough for the player to start and buffer, but short enough that a shared URL becomes invalid quickly. The player requests a new signed URL before the current one expires (refresh logic in the player client).

---

## 9. Payment Security

### Stripe handles all card data

We never see, touch, or store raw PANs (Primary Account Numbers). Stripe.js (client) sends card data directly to Stripe. Our server receives a Stripe `PaymentMethod` ID — a token that references the card on Stripe's servers.

### PCI DSS scope

Because we never handle raw card data, our PCI DSS scope is **SAQ A** (the simplest Self-Assessment Questionnaire for merchants who fully outsource payment processing to Stripe). This is far simpler than SAQ D (full PCI audit required when card data touches our servers).

### Webhook verification

Stripe webhook events are verified before processing:

```ts
const event = stripe.webhooks.constructEvent(
  await request.text(),
  request.headers.get("stripe-signature"),
  process.env.STRIPE_WEBHOOK_SECRET!,
);
```

Without verification, an attacker could send a fake `checkout.session.completed` event and grant themselves a subscription for free.

---

## 10. Dependency Security

### Automated scanning

| Tool         | Frequency      | What it checks                                           |
| ------------ | -------------- | -------------------------------------------------------- |
| Dependabot   | Daily          | Known vulnerabilities in npm dependencies                |
| CodeQL       | Weekly + on PR | Security vulnerability patterns in our code              |
| `pnpm audit` | In CI          | Known CVEs in lockfile                                   |
| Socket.dev   | On install     | Supply chain attacks (typosquatting, maintainer changes) |

### Lockfile integrity

`pnpm-lock.yaml` is committed to git. CI runs with `--frozen-lockfile` — no new dependencies can be silently added during CI. This prevents dependency confusion attacks.

---

## 11. Data Privacy

### Personal data we store

| Data            | Purpose                            | Retention                  |
| --------------- | ---------------------------------- | -------------------------- |
| Email           | Auth, notifications                | Until account deletion     |
| Password hash   | Auth                               | Until account deletion     |
| Display name    | Profile display                    | Until account deletion     |
| Avatar image    | Profile display                    | Until account deletion     |
| Watch history   | Continue-watching, recommendations | Until account deletion     |
| Payment history | Billing support, legal requirement | 7 years (financial record) |
| Session data    | Auth                               | 30 days (session expiry)   |
| IP address      | Rate limiting, fraud detection     | 24 hours (ephemeral)       |

### Data deletion

Account deletion is **hard delete** for personal data, **soft delete** for watch progress (retained for catalog analytics without PII linkage). Payment history is retained for 7 years per financial regulations.

### GDPR readiness (future)

The architecture accommodates GDPR compliance:

- No third-party analytics that track PII without consent.
- Feature-flag-gated analytics (can be turned off per region).
- Account deletion API (right to erasure).
- Data export API (right to portability — future M4+).

---

## 12. Security Checklist (per PR)

- [ ] No secrets in code (API keys, tokens, passwords)
- [ ] Zod validation on all inputs (Server Actions, Route Handlers)
- [ ] Auth check on all mutations (`auth()` in Server Actions)
- [ ] No `any` types introduced (type safety prevents runtime shape errors)
- [ ] User-generated content sanitized before rendering
- [ ] Stack traces not exposed to client
- [ ] New dependencies reviewed for vulnerabilities (Dependabot alerts)
- [ ] No new `NEXT_PUBLIC_*` env vars for secrets
- [ ] Rate limiting on new mutation endpoints
- [ ] Webhook signatures verified (if adding webhook handlers)
