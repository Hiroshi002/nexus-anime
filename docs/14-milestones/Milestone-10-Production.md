# M10 — Production Launch

## Objective

Prepare the Nexus Anime platform for public production traffic. This milestone covers environment provisioning, security hardening, load testing, operational readiness, legal compliance, and the final v1.0.0 release. At the end of M10, the platform is deployable to a custom domain with production-grade reliability, security, and observability.

## Scope

- Production environment configuration (Vercel Pro, Neon production DB, Upstash production Redis)
- Domain registration, DNS configuration, and SSL verification
- Production secrets rotation (all keys rotated, old values invalidated)
- Load testing (simulate expected peak traffic + 2x headroom)
- Security penetration testing (OWASP Top 10, auth flows, API abuse)
- Backup and restore procedures (database snapshots, Redis persistence)
- Runbook creation (incident response, rollback, scale-up)
- Rate limiting calibration (production traffic patterns)
- Error monitoring setup (Sentry or equivalent)
- Analytics setup (Vercel Analytics, privacy-respecting)
- Legal compliance (privacy policy, terms of service, cookie consent)
- Final UAT (User Acceptance Testing) against launch checklist
- v1.0.0 tag and GitHub Release

Out of scope: new features beyond M8, design changes, mobile apps, content licensing deals, marketing site (separate from app).

## Deliverables

### D1 — Production Environment

- Vercel Pro project configured with production environment variables.
- Neon production database provisioned (separate instance from staging).
- Upstash production Redis provisioned (separate instance from staging).
- All `NEXT_PUBLIC_*` variables verified to contain no secrets.
- Server-only secrets stored in Vercel environment (not in `.env.local` or code).
- Environment variable audit documented in `docs/reports/m10-env-audit.md`.

### D2 — Domain and DNS

- Domain `nexus-anime.com` (or chosen domain) registered.
- DNS A/CNAME records pointing to Vercel.
- SSL certificate provisioned and verified (automatic via Vercel).
- `www` redirect to apex domain configured.
- HSTS preload list submission (optional but recommended).
- DNS TTL set to 60s for fast failover (can be increased after launch).

### D3 — Production Secrets Rotation

- All production secrets rotated: `AUTH_SECRET`, `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TMDB_API_KEY`, `CLOUDFLARE_STREAM_*`.
- Old secrets invalidated in previous environments.
- Rotation procedure documented (so it can be repeated quarterly).
- Secrets stored only in Vercel environment — zero secrets in code or git.

### D4 — Load Testing

- Load test script written (using k6, Artillery, or Locust) simulating:
  - 100 concurrent users browsing catalog pages
  - 50 concurrent users on anime detail pages
  - 20 concurrent users on auth flows (sign-up, sign-in, OAuth)
  - 10 concurrent users on Stripe checkout
- Test executed against staging environment (production-like config).
- Results documented: p95 response time, error rate, resource utilization.
- Bottlenecks identified and resolved before launch.
- Report in `docs/reports/m10-load-test.md`.

### D5 — Security Penetration Testing

- OWASP Top 10 review:
  - A01: Broken Access Control — verify auth guards on all protected routes
  - A02: Cryptographic Failures — verify TLS, bcrypt, no weak algorithms
  - A03: Injection — verify no SQL injection (Drizzle parameterized), no XSS (CSP, DOMPurify)
  - A04: Insecure Design — verify rate limiting, signed URLs
  - A05: Security Misconfiguration — verify headers, no debug endpoints exposed
  - A06: Vulnerable Components — `pnpm audit` clean, Dependabot reviewed
  - A07: Auth Failures — verify session management, CSRF, brute-force protection
  - A08: Data Integrity — verify webhook signatures, Zod output validation
  - A09: Logging Failures — verify Pino serializers strip secrets
  - A10: SSRF — verify no user-controlled URLs fetched by server
- Penetration test report in `docs/reports/m10-pentest.md`.
- All critical/high findings remediated before launch.

### D6 — Backup and Restore

- Neon automated backups verified (point-in-time recovery enabled).
- Manual backup script written: `tooling/scripts/backup-db.ts`.
- Restore procedure tested: backup → fresh Neon instance → verify data integrity.
- Upstash Redis persistence enabled (AOF or RDB — verify with Upstash console).
- Redis restore procedure documented.
- Recovery Time Objective (RTO): < 1 hour for DB, < 15 min for Redis.
- Recovery Point Objective (RPO): < 5 min for DB (Neon PITR), < 1 min for Redis.

### D7 — Runbooks

- `docs/reports/m10-runbooks.md` containing:
  - **Incident response**: who to page, how to triage, severity levels.
  - **Rollback procedure**: revert to previous Vercel deployment (1-click), revert DB migration.
  - **Scale-up procedure**: Vercel serverless function limits, Neon connection pool limits, Upstash Redis limits.
  - **Data corruption response**: how to restore from backup, how to verify.
  - **Third-party outage**: TMDB down, Stripe down, Cloudflare down — what degrades, what breaks.
  - **On-call rotation**: defined (even if it's a single person initially).

### D8 — Rate Limiting Calibration

- Rate limits set per endpoint based on load test results:
  - Auth endpoints: 5 attempts / 5 min / IP
  - API routes: 100 requests / min / user
  - Webhook endpoints: 50 requests / min / source IP
  - Search: 30 requests / min / user
- Rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`) present in responses.
- Rate limit exceeded returns `429` with `Retry-After` header.
- Redis failure mode: fail open for reads, fail closed for auth mutations.

### D9 — Error Monitoring

- Sentry (or equivalent: LogRocket, Datadog) integrated via `@sentry/nextjs`.
- Source maps uploaded to Sentry (for readable stack traces).
- Alert rules configured: new error type, error rate > 1%, error rate > 5%.
- Pino logs shipped to log aggregation (Vercel Log Drains or external).
- Dashboard created: error rate by route, top 10 errors, user impact.

### D10 — Analytics Setup

- Vercel Analytics enabled on production (Real User Monitoring).
- Privacy-respecting: no third-party tracking scripts without consent.
- Cookie consent banner implemented (if required by GDPR for target regions).
- Analytics data reviewed weekly for first month post-launch.
- Custom events tracked: page views, search queries, watchlist adds, video plays (privacy-safe, no PII).

### D11 — Legal Compliance

- Privacy policy published at `/privacy` — covers data collection, storage, deletion, third-party processors.
- Terms of service published at `/terms` — covers acceptable use, account termination, liability.
- Cookie consent mechanism implemented (if serving EU users).
- DMCA contact email configured (in footer or `/contact`).
- GDPR readiness: account deletion API functional, data export API (if built in M4+).
- Age gate or content rating notice (if required by jurisdiction).

### D12 — Final UAT

- UAT checklist executed against production deployment:
  - Sign-up flow (email, Google OAuth, GitHub OAuth)
  - Sign-in flow
  - Browse catalog (home, trending, popular, genres)
  - Search anime
  - View anime detail
  - Add/remove bookmark
  - Add/remove from watchlist
  - Continue watching persistence
  - Profile update
  - Settings page
  - Sign-out flow
  - Error pages (404, 500)
  - Mobile responsive (380px width)
- All critical paths pass.
- UAT sign-off documented in `docs/reports/m10-uat-signoff.md`.

### D13 — v1.0.0 Release

- `git tag -a v1.0.0 -m "release: v1.0.0 — Production launch"` on `main`.
- GitHub Release created with changelog (auto-generated from Conventional Commits).
- Production deployment triggered from tag.
- Smoke test executed against production domain.
- Launch announcement ready (if applicable).

## Prerequisites

- M9 (Optimization) is complete — platform meets performance and accessibility targets.
- All previous milestones (M0–M8) are complete and merged to `main`.
- Vercel Pro plan active.
- Neon production database provisioned (or provisioning started).
- Upstash production Redis provisioned (or provisioning started).
- Domain registered and accessible for DNS configuration.
- Sentry account created (or equivalent error monitoring).
- Stripe account in live mode (not test mode).
- TMDB API key with production quota.
- Cloudflare Stream configured for production (if video is in scope).

## Dependencies

- Vercel Pro — required for Analytics, Speed Insights, and production deployment.
- Neon — production database tier (scale tier, not free tier).
- Upstash Redis — production tier (or dedicated cluster if traffic warrants).
- Sentry — error monitoring (free tier sufficient for launch).
- Domain registrar — Namecheap, Cloudflare, Google Domains, etc.
- Stripe — live-mode account with webhooks configured for production URL.
- Cloudflare — R2 for images, Stream for video (if applicable).

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Neon cold start adds latency on first request** | High | Medium | Warm production instance with a cron job (e.g., Vercel Cron hitting `/api/health` every 5 min); use Neon's "always on" tier if available. |
| **DNS propagation delay causes downtime** | Low | High | Set low TTL (60s) pre-launch; switch DNS during low-traffic window; verify with `dig new-domain` before and after. |
| **Stripe webhook signature failure after URL change** | Medium | High | Update Stripe webhook endpoint URL before launch; test with `stripe listen` locally; verify first live webhook succeeds. |
| **Secrets leak via `NEXT_PUBLIC_*` misconfiguration** | Low | Critical | Audit all env vars before launch; grep for `NEXT_PUBLIC_` and verify no secrets; use Vercel env var scanning. |
| **Load test reveals connection pool exhaustion** | Medium | High | Set connection pool limits conservatively; monitor during load test; scale Neon pool size if needed; implement connection retry with backoff. |
| **Sentry source maps fail to upload** | Medium | Low | Test Sentry integration in staging; verify source map upload in CI; check Sentry dashboard shows readable stack traces. |
| **Cookie consent banner blocks critical functionality** | Low | Medium | Implement consent banner as non-blocking; only gate non-essential analytics behind consent; test with consent denied. |
| **Legal review delays launch** | Medium | Medium | Draft privacy policy and terms early in milestone; use templates (e.g., Termly, Iubenda) as starting point; legal review in parallel with technical work. |
| **Production traffic exceeds provisioned limits** | Low | High | Set up auto-scaling alerts; have scale-up runbook ready; Vercel and Neon both scale horizontally — verify limits in advance. |
| **Third-party API (TMDB) rate limit hit on launch day** | Medium | Medium | Cache aggressively (Redis); implement circuit breaker; show stale data rather than error; monitor TMDB rate limit headers. |

## Acceptance Criteria

1. Production deployment accessible at `nexus-anime.com` (or chosen domain) with valid SSL certificate.
2. All environment variables in Vercel production environment; no secrets in code or git.
3. All production secrets are freshly rotated (not reused from staging).
4. DNS resolves correctly from 3 global locations (verify via `dig` or DNSChecker.org).
5. SSL Labs test returns A+ rating (or A minimum).
6. Load test passes: 100 concurrent users, p95 response time < 500ms, error rate < 0.1%.
7. Penetration test report complete with zero critical findings unresolved.
8. Backup restore tested successfully (DB restored to fresh instance, data verified).
9. All runbooks written and reviewed by at least one other engineer.
10. Rate limiting active on all protected endpoints (verified via load test).
11. Sentry receiving errors from production (test with deliberate non-critical error).
12. Vercel Analytics showing real-user data within 1 hour of production traffic.
13. Privacy policy and terms of service pages accessible and accurate.
14. Cookie consent banner appears for EU visitors (if applicable).
15. All UAT critical paths pass on production deployment.
16. `v1.0.0` tag exists on `main` and GitHub Release is published.
17. Smoke test passes on production: home loads, search works, sign-up works.
18. Rollback procedure tested (revert to previous deployment, verify).

## QA Checklist

- [ ] Production environment variables set in Vercel (all required vars present).
- [ ] `pnpm build` succeeds on `main` with no warnings.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.
- [ ] `pnpm test` passes.
- [ ] Staging deployment stable for 48 hours before production deploy.
- [ ] Production deployment accessible via custom domain.
- [ ] SSL certificate valid (check browser lock icon).
- [ ] Security headers present (verify via securityheaders.com).
- [ ] CSP nonce working (no CSP errors in browser console).
- [ ] Rate limiting returns 429 when exceeded.
- [ ] Error monitoring receives test error.
- [ ] Analytics receiving page view data.
- [ ] Sign-up flow works end-to-end (email verification → dashboard).
- [ ] OAuth flows work (Google, GitHub).
- [ ] Stripe checkout works in live mode (use test card `4242...`).
- [ ] Video playback works (if M6 complete).
- [ ] Search returns results.
- [ ] Bookmarks persist across sessions.
- [ ] Continue-watching syncs across devices.
- [ ] Profile update saves and persists.
- [ ] Sign-out clears session and redirects.
- [ ] 404 page renders correctly.
- [ ] 500 page renders correctly (trigger via deliberate error in non-critical path).
- [ ] Mobile layout correct at 380px.
- [ ] Cookie consent banner appears (if applicable).
- [ ] Privacy policy page accessible.
- [ ] Terms of service page accessible.
- [ ] Footer contains DMCA contact (if applicable).
- [ ] Health check endpoint (`/api/health`) returns 200.
- [ ] Backup script runs successfully.
- [ ] Restore procedure documented and tested.

## Estimated Tasks

| # | Task | Estimate | Owner | Dependencies |
|---|------|----------|-------|--------------|
| T1 | Provision Neon production database; configure connection pooling | 2h | DevOps | None |
| T2 | Provision Upstash production Redis; enable persistence | 1h | DevOps | None |
| T3 | Configure Vercel Pro project with production environment variables | 2h | DevOps | T1, T2 |
| T4 | Audit all environment variables; verify no secrets in `NEXT_PUBLIC_*` | 1h | DevOps | T3 |
| T5 | Rotate all production secrets; invalidate old values | 2h | DevOps | T3 |
| T6 | Register domain; configure DNS records | 1h | DevOps | None |
| T7 | Verify SSL certificate provisioning via Vercel | 0.5h | DevOps | T6 |
| T8 | Configure Stripe live-mode webhooks for production URL | 1h | Backend | T3 |
| T9 | Write load test script (k6/Artillery) for all critical flows | 4h | QA / Backend | None |
| T10 | Execute load test against staging; document results | 2h | QA | T9 |
| T11 | Resolve load test bottlenecks; re-test | 4h | Backend | T10 |
| T12 | Perform OWASP Top 10 security review | 6h | Security / Backend | None |
| T13 | Remediate critical/high security findings | 4h | Backend | T12 |
| T14 | Write backup script (`tooling/scripts/backup-db.ts`) | 2h | DevOps | T1 |
| T15 | Test restore procedure end-to-end | 2h | DevOps | T14 |
| T16 | Enable Upstash Redis persistence; verify snapshot | 1h | DevOps | T2 |
| T17 | Write incident response runbook | 3h | DevOps | None |
| T18 | Write rollback runbook | 2h | DevOps | None |
| T19 | Write scale-up runbook | 2h | DevOps | None |
| T20 | Write third-party outage runbook | 2h | DevOps | None |
| T21 | Configure rate limits per endpoint based on load test | 3h | Backend | T10 |
| T22 | Verify rate limit headers and 429 responses | 1h | QA | T21 |
| T23 | Integrate Sentry (`@sentry/nextjs`); configure source map upload | 3h | Frontend | None |
| T24 | Set up Sentry alert rules | 1h | DevOps | T23 |
| T25 | Configure Vercel Log Drains (or equivalent log shipping) | 2h | DevOps | T3 |
| T26 | Enable Vercel Analytics on production | 1h | Frontend | T3 |
| T27 | Implement cookie consent banner (if required) | 3h | Frontend | None |
| T28 | Write privacy policy; publish at `/privacy` | 4h | Legal / Frontend | None |
| T29 | Write terms of service; publish at `/terms` | 4h | Legal / Frontend | None |
| T30 | Add DMCA contact to footer | 0.5h | Frontend | T28 |
| T31 | Execute UAT checklist against production deployment | 6h | QA | T3-T30 |
| T32 | Remediate UAT findings | 4h | Full-stack | T31 |
| T33 | Create `v1.0.0` tag on `main` | 0.5h | Lead | All above |
| T34 | Create GitHub Release with changelog | 1h | Lead | T33 |
| T35 | Trigger production deployment from tag | 0.5h | DevOps | T33 |
| T36 | Execute smoke test on production | 1h | QA | T35 |
| T37 | Test rollback procedure on production | 1h | DevOps | T35 |
| T38 | Monitor production for 24 hours post-launch | 4h | DevOps | T35 |

**Total estimate: ~84 engineer-hours** (approximately 2 weeks for a single engineer, or 1 week for a team of 2–3 engineers working in parallel).

## Completion Checklist

- [ ] All deliverables (D1–D13) are present in the repository.
- [ ] All acceptance criteria (1–18) are met.
- [ ] QA checklist is fully checked off.
- [ ] Production deployment stable for 24 hours with no critical incidents.
- [ ] Load test report shows all targets met.
- [ ] Penetration test report shows zero critical/high open findings.
- [ ] Backup restore tested and documented.
- [ ] Runbooks reviewed and accessible to on-call engineer.
- [ ] Sentry receiving production errors.
- [ ] Vercel Analytics showing production traffic.
- [ ] Privacy policy and terms of service published.
- [ ] v1.0.0 tag exists on `main`.
- [ ] GitHub Release published with changelog.
- [ ] Smoke test passed on production domain.
- [ ] Rollback procedure tested on production.
- [ ] On-call engineer briefed on runbooks and alert thresholds.
- [ ] Branch `feature/m10-production` deleted after merge.
- [ ] Milestone marked complete in GitHub Projects board.
- [ ] Master roadmap updated: M7 (Public launch) marked complete.
