# M9 — Optimization

## Objective

Systematically audit and improve every performance, accessibility, and reliability dimension of the Nexus Anime platform so that production traffic on real devices meets the Core Web Vitals "good" thresholds defined in `docs/03-architecture/Performance.md`. This is a quality-only milestone: no new features, no new routes, no new user-visible capabilities. The output is a faster, smaller, more accessible, and more observable application.

## Scope

- Core Web Vitals audit (LCP, INP, CLS) against real-user baselines
- Bundle analysis and reduction (JS, CSS, image payloads)
- Image optimization audit (format, sizes, priority, lazy loading)
- Database query optimization (missing indexes, N+1 queries, column selection)
- Redis cache hit rate improvement (key coverage, TTL tuning, invalidation)
- CDN configuration refinement (cache headers, edge rules, compression)
- Font loading optimization (self-hosting, display=swap, preloading)
- CSS purging audit (Tailwind v4 unused-class elimination verification)
- Accessibility audit against WCAG 2.1 AA
- Cross-browser testing (Chrome, Firefox, Safari, Edge — last 2 versions)
- Mobile performance on mid-tier devices (Moto G Power, iPhone SE)
- Error rate reduction (unhandled promise rejections, failed fetches, 5xx)
- Monitoring and alerting setup (Vercel Analytics, pino metrics, alert thresholds)

Out of scope: new features, new routes, new API endpoints, design changes, A/B testing infrastructure, serverless function migration.

## Deliverables

### D1 — Core Web Vitals Report

A dated report in `docs/reports/m9-cwv-baseline.md` containing per-route LCP, INP, CLS, and TTFB values from Vercel Analytics (RUM) and Lighthouse CI (lab). Each route is graded against the targets in `Performance.md` §1. Routes that miss any target include a root-cause analysis and a fix plan.

### D2 — Bundle Reduction

- `next build` output analyzed with `@next/bundle-analyzer`; findings documented.
- JS bundle sizes per route meet the budgets in `Performance.md` §5.
- CSS bundle per page < 30KB gzipped.
- Unused dependencies removed or replaced with lighter alternatives.
- Tree-shaking verified: `sideEffects: false` in `@nexus/ui` `package.json`.

### D3 — Image Optimization Audit

- All `<Image>` components use explicit `width`, `height`, and `sizes`.
- LCP images use `priority` prop.
- Format negotiation verified (AVIF/WebP/JPEG fallback).
- TMDB image URLs use the configured R2 loader, not direct TMDB CDN.
- No unoptimized `<img>` tags remain in the codebase.

### D4 — Database Query Optimization

- Missing indexes identified from slow-query logs and added via Drizzle migration.
- All repository queries use column selection (no `SELECT *`).
- N+1 queries eliminated via `React.cache()` or batch loading.
- Connection pooling verified (Neon HTTP pooler active).
- Query p95 < 50ms confirmed in staging.

### D5 — Redis Cache Hit Rate Improvement

- Cache coverage extended to all hot paths (anime detail, trending, popular, home).
- TTLs tuned per entity volatility (60s for trending, 15min for catalog).
- Cache invalidation hooks wired to all mutations.
- Hit rate > 80% for anime detail confirmed in staging.
- Graceful degradation verified (cache miss falls through to DB without error).

### D6 — CDN Configuration

- `next.config.ts` `headers()` sets correct `Cache-Control` for static assets (1 year, immutable), API responses (no-cache or short TTL), and ISR pages (stale-while-revalidate).
- Security headers verified (CSP, HSTS, X-Frame-Options, etc.) via securityheaders.com.
- Brotli compression active (Vercel default; verify no `Content-Encoding: br` override).
- Preconnect hints present for R2 image origin and TMDB API origin.

### D7 — Font Loading Optimization

- Fonts self-hosted in `public/fonts/` via `next/font/local`.
- `display: swap` set.
- Preload link present in `<head>` for the primary variable font.
- Fallback font stack defined (system-ui).
- FOIT (Flash of Invisible Text) eliminated in Lighthouse audit.

### D8 — CSS Purging Audit

- Tailwind v4 content globs verified to include all template paths.
- Unused custom CSS removed (if any).
- Production CSS bundle size measured and within budget.
- No global stylesheets outside the Tailwind entry point.

### D9 — Accessibility Audit

- Automated scan with axe-core (via `@axe-core/react` or Lighthouse) — 0 serious/critical violations.
- Manual keyboard navigation test: all interactive elements reachable and operable.
- Screen reader test (VoiceOver on macOS, NVDA on Windows) — no missing labels, no focus traps.
- Color contrast ratios meet WCAG 2.1 AA (4.5:1 for body text, 3:1 for large text).
- Focus indicators visible on all interactive elements.
- ARIA labels present on icon-only buttons and dynamic content regions.

### D10 — Cross-Browser Testing

- Functional test pass on Chrome, Firefox, Safari, Edge (last 2 versions).
- Layout verified at 380px, 768px, 1024px, 1440px breakpoints.
- No browser-specific JS errors in console.
- CSS `backdrop-filter` (glassmorphism) tested — fallback for Firefox if needed.

### D11 — Mobile Performance

- Lighthouse performance score > 85 on simulated Moto G Power (mid-tier device, slow 4G).
- LCP < 2.5s on simulated slow 4G.
- Touch targets >= 44x44px.
- No horizontal scroll or overflow at any breakpoint.

### D12 — Error Rate Reduction

- All async Server Actions and Route Handlers wrapped in try/catch with typed `ApiError`.
- Unhandled promise rejection count = 0 in staging logs.
- Network failure paths (TMDB down, Redis down, DB down) tested — graceful degradation, no white screens.
- Error boundaries present on all major client component trees.

### D13 — Monitoring and Alerting

- Vercel Analytics enabled with Web Vitals tracking.
- Pino structured logging in production with redacted serializers.
- Alert thresholds defined: p75 LCP > 2.5s for 10 min, error rate > 1% for 5 min, DB p95 > 100ms for 5 min.
- Alert destination configured (PagerDuty, Discord webhook, or email — per team choice).
- Runbook `docs/reports/m9-runbook.md` documents how to interpret and respond to each alert.

## Prerequisites

- M8 (or the current milestone) is complete and deployed to a staging environment.
- Vercel Analytics is available on the staging deployment (requires Vercel Pro or trial).
- Lighthouse CI is configured in `.github/workflows/` (can be set up as part of this milestone if not present).
- Access to Vercel deployment logs and function logs.
- Access to Neon database logs (for slow-query analysis).
- Access to Upstash Redis logs (for hit rate analysis).
- A mid-tier test device (physical or BrowserStack) for mobile performance testing.

## Dependencies

- `@nexus/db` — Drizzle schema for new indexes.
- `@nexus/cache` — Redis client for cache tuning.
- `next/font` — already in Next.js 16; no new dependency.
- `@next/bundle-analyzer` — devDependency for bundle analysis.
- `axe-core` or `@axe-core/react` — devDependency for accessibility testing.
- `pino` — already in use for logging; no new dependency.
- Vercel Pro plan — required for Analytics and Speed Insights.

## Risks

| Risk                                                   | Likelihood | Impact | Mitigation                                                                                                                    |
| ------------------------------------------------------ | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **Index migration locks the production table**         | Medium     | High   | Use `CREATE INDEX CONCURRENTLY` (Drizzle `concurrently: true`); run during low-traffic window; test on a staging clone first. |
| **Cache key collision after schema change**            | Low        | High   | Version cache keys (`nexus:v2:anime:{id}:detail`); old keys expire naturally; no hot-path code references old keys.           |
| **Font self-hosting increases build output size**      | Low        | Medium | Subset fonts to Latin + common CJK ranges; use woff2 (30-50% smaller than ttf); measure before/after.                         |
| **CSP nonce breaks existing inline scripts**           | Medium     | High   | Audit all inline scripts before enabling nonce; add nonce to each; test in staging before production.                         |
| **Accessibility fixes break existing layout**          | Low        | Medium | Run a11y audit early; fix incrementally; visual regression tests (if available) catch layout regressions.                     |
| **Performance optimization introduces rendering bugs** | Medium     | Medium | Every optimization is a separate PR with before/after metrics; revert if CWV degrades.                                        |
| **Monitoring alert fatigue**                           | Medium     | Low    | Start with conservative thresholds; tune after 1 week of baseline; group related alerts.                                      |
| **Mobile testing on real devices unavailable**         | Medium     | Medium | Use BrowserStack free tier for critical tests; supplement with Chrome DevTools device emulation.                              |

## Acceptance Criteria

1. Lighthouse performance score >= 85 on home, anime detail, and search routes (lab, simulated Moto G Power, slow 4G).
2. Lighthouse accessibility score >= 95 on all tested routes.
3. LCP < 2.5s (p75) on all ISR/catalog routes in Vercel Analytics RUM.
4. INP < 200ms (p75) on all interactive routes in Vercel Analytics RUM.
5. CLS < 0.1 (p75) on all routes in Vercel Analytics RUM.
6. JS bundle per route meets the budgets in `Performance.md` §5 (verified via `next build` output).
7. CSS bundle < 30KB gzipped per page.
8. No `<img>` tags without explicit `width` and `height` attributes.
9. No `SELECT *` queries in any repository module (verified via grep + code review).
10. Redis cache hit rate >= 80% for anime detail endpoint in staging load test.
11. All security headers present and correct (verified via securityheaders.com "A" grade or better).
12. Zero serious/critical axe-core violations on any route.
13. All interactive elements keyboard-operable (verified via manual tab-through test).
14. Cross-browser functional parity confirmed on Chrome, Firefox, Safari, Edge (last 2 versions).
15. Monitoring alerts configured with documented runbook responses.
16. No regression in existing test suite (`pnpm test` passes).
17. `pnpm build` succeeds with no new warnings.
18. All changes merged to `main` via PR with before/after metrics in the description.

## QA Checklist

- [ ] Lighthouse CI runs on every PR and reports CWV scores.
- [ ] Bundle size check passes in CI (no route exceeds budget by > 10%).
- [ ] `pnpm typecheck` passes — no `any` introduced.
- [ ] `pnpm lint` passes.
- [ ] `pnpm test` passes — no existing tests broken.
- [ ] `pnpm build` succeeds.
- [ ] Staging deployment accessible and functional.
- [ ] Cache invalidation verified: mutate entity → refresh → response reflects change.
- [ ] Error paths tested: TMDB down, Redis down, DB connection failure.
- [ ] Mobile layout verified at 380px width.
- [ ] Focus indicators visible on all buttons, links, inputs.
- [ ] Screen reader announces page structure correctly (heading hierarchy, landmarks).
- [ ] Font loading does not cause layout shift (CLS impact = 0).
- [ ] Images load progressively (no blank white areas beyond skeleton).
- [ ] API responses under 200ms for cached routes (staging).
- [ ] Rate limiting still functional after cache changes.

## Estimated Tasks

| #   | Task                                                                                    | Estimate | Owner         | Dependencies    |
| --- | --------------------------------------------------------------------------------------- | -------- | ------------- | --------------- |
| T1  | Set up Lighthouse CI in GitHub Actions workflow                                         | 2h       | Frontend      | None            |
| T2  | Enable Vercel Analytics and Speed Insights                                              | 1h       | DevOps        | Vercel Pro plan |
| T3  | Run baseline CWV audit across all routes; document in `docs/reports/m9-cwv-baseline.md` | 3h       | Frontend      | T2              |
| T4  | Set up `@next/bundle-analyzer`; generate per-route bundle report                        | 2h       | Frontend      | None            |
| T5  | Audit and fix JS bundle overages (code splitting, dynamic imports, dependency swaps)    | 8h       | Frontend      | T4              |
| T6  | Audit and fix image optimization (width/height, sizes, priority, format)                | 4h       | Frontend      | None            |
| T7  | Audit and fix font loading (self-host, swap, preload)                                   | 3h       | Frontend      | None            |
| T8  | Verify Tailwind v4 content globs; measure CSS bundle size                               | 1h       | Frontend      | None            |
| T9  | Run axe-core scan; fix all serious/critical violations                                  | 6h       | Frontend      | None            |
| T10 | Manual keyboard + screen reader test pass                                               | 3h       | QA / Frontend | T9              |
| T11 | Cross-browser testing (Chrome, Firefox, Safari, Edge)                                   | 4h       | QA            | None            |
| T12 | Mobile performance testing on mid-tier device (Moto G Power or equivalent)              | 3h       | Frontend      | T3              |
| T13 | Analyze slow DB queries from Neon logs; identify missing indexes                        | 2h       | Backend       | None            |
| T14 | Write Drizzle migration for new indexes (`CREATE INDEX CONCURRENTLY`)                   | 2h       | Backend       | T13             |
| T15 | Eliminate N+1 queries (add `React.cache()` or batch loading)                            | 4h       | Backend       | T13             |
| T16 | Audit all repository modules for `SELECT *`; replace with column selection              | 2h       | Backend       | None            |
| T17 | Extend Redis cache coverage to all hot paths                                            | 4h       | Backend       | None            |
| T18 | Tune TTLs per entity volatility; wire invalidation hooks                                | 2h       | Backend       | T17             |
| T19 | Verify graceful degradation on cache miss (no errors, falls through to DB)              | 1h       | Backend       | T18             |
| T20 | Audit and tighten `Cache-Control` headers in `next.config.ts`                           | 2h       | DevOps        | None            |
| T21 | Verify security headers (CSP, HSTS, etc.); fix any gaps                                 | 2h       | DevOps        | None            |
| T22 | Add preconnect hints for R2 and TMDB origins                                            | 1h       | DevOps        | T20             |
| T23 | Audit all async error handling; add try/catch where missing                             | 4h       | Full-stack    | None            |
| T24 | Add error boundaries to all major client component trees                                | 2h       | Frontend      | T23             |
| T25 | Set up Pino serializers for secret redaction (if not already present)                   | 1h       | Backend       | None            |
| T26 | Configure alert thresholds and destination (Discord / PagerDuty / email)                | 2h       | DevOps        | T2              |
| T27 | Write monitoring runbook `docs/reports/m9-runbook.md`                                   | 3h       | DevOps        | T26             |
| T28 | Run full regression test suite on staging                                               | 2h       | QA            | All above       |
| T29 | Final CWV re-audit; compare with baseline; document improvements                        | 2h       | Frontend      | T3, T5-T12      |

**Total estimate: ~74 engineer-hours** (approximately 2 weeks for a single engineer, or 1 week for two engineers working in parallel).

## Completion Checklist

- [ ] All deliverables (D1–D13) are present in the repository.
- [ ] All acceptance criteria (1–18) are met.
- [ ] QA checklist is fully checked off.
- [ ] CWV report shows improvement from baseline on every route.
- [ ] No new dependencies added without security review.
- [ ] All PRs merged to `main` with before/after metrics.
- [ ] Staging deployment verified by QA.
- [ ] Monitoring runbook reviewed by on-call engineer.
- [ ] Branch `feature/m9-optimization` deleted after merge.
- [ ] Milestone marked complete in GitHub Projects board.

## References

- `docs/03-architecture/Performance.md` — performance targets and optimization strategies
- `docs/03-architecture/Security-Architecture.md` — security headers, CSP, threat model
- `docs/04-design-system/Accessibility.md` — design-system accessibility guidance
- `docs/12-conventions/Performance-Guidelines.md` — coding conventions for performance
- `docs/12-conventions/Security-Guidelines.md` — coding conventions for security
