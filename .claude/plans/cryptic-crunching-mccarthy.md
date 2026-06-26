# Plan: Fix 4 verified bugs in bug-verification.json

## Context
`bug-verification.json` flagged 5 top findings. After source-level verification: **4 confirmed, 1 partial (turbo globalEnv)**, 1 skipped (auth guards — no auth library installed yet; deferred by user decision). This plan fixes the 4 remaining actionable bugs: a build-breaking import, insecure Stripe env defaults, missing Redis error handling, and a turbo.json key that the installed Turborepo schema wants moved under `globalConfiguration`.

**Bug #2 (auth guards on admin/ and (app)/ routes) is intentionally excluded** from this plan — there is no auth library installed (no next-auth/lucia), and fixing it requires choosing + wiring a provider first. It should be handled as a separate follow-up.

---

## Bug #1 — Broken `./studios` import (build-breaking)
**File:** `packages/db/src/schema/anime.ts:3`

`import { studios } from "./studios"` — no `studios.ts` exists in `packages/db/src/schema/`. The `studios` table actually lives in `taxonomy.ts:14` (`export const studios = pgTable("studios", ...)`).

**Fix (2 steps, order matters to avoid an intermediate broken state):**
1. In `packages/db/src/schema/anime.ts:3`, change the import to `import { studios } from "./taxonomy";`
2. Verify no value-level circular dependency: `taxonomy.ts:2` imports `{ anime }` from `"./anime"`. If both imports are type-only (used only as Drizzle relation types), this is safe. If `anime.ts` *uses* the `studios` value at module load, we flip the approach: rename `taxonomy.ts` → `studios.ts` instead, and update `anime.ts` import + any other importers of `./taxonomy`. The schema's `index.ts` re-exports will also need checking.

I'll determine which direction once I check whether the imports are type-only at execution. The plan: **default to the rename direction (`taxonomy.ts` → `studios.ts`) only if a value-cycle actually exists; otherwise change the import path in `anime.ts`.**

---

## Bug #3 — Empty-string Stripe secrets in env
**File:** `apps/web/lib/env.ts:37-39`

```ts
STRIPE_SECRET_KEY: z.string().min(1).default(""),
STRIPE_WEBHOOK_SECRET: z.string().min(1).default(""),
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1).default(""),
```

Zod `.default("")` bypasses the `.min(1)` validator for unset env vars, so the app boots with empty Stripe keys and only fails at runtime per Stripe call (fail-late).

**Fix:** Remove the `.default("")` from the two **secret** vars so Zod throws at startup when they're unset (fail-fast). Keep the publishable key handling careful:
- `STRIPE_SECRET_KEY`: `z.string().min(1)` (no default — required in production)
- `STRIPE_WEBHOOK_SECRET`: `z.string().min(1)` (no default)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: `z.string().min(1)` (no default — frontend needs a real key)

This means the server will refuse to boot in production without real Stripe secrets — correct behavior. Dev environments that don't use Stripe will need explicit dummy values or the vars set; acceptable trade-off noted in the plan.

---

## Bug #4 — No error handling on Redis operations
**Scope:** `packages/cache/src/` — all `redis.get / redis.set / redis.del / redis.scan / limiter.limit()` calls are `await`ed with no `try/catch` or `.catch`. `client.ts` only guards the synchronous env-var check, not runtime op failures.

The right fix here is a **thin wrapper** rather than wrapping every call site — it centralizes the failure mode (log + treat cache miss as null, treat cache write failure as silent no-op) without 20 identical try/catch blocks.

**Fix design (new file `packages/cache/src/safe.ts`):**
```ts
import { logger } from "./logger"; // add a tiny logger if absent, or console
import type { Redis } from "@upstash/redis";

export async function safeGet<T>(redis: Redis, key: string): Promise<T | null> {
  try { return await redis.get<T>(key); }
  catch (err) { logger?.warn?.("redis.get failed", { key, err }); return null; }
}
// safeSet returns void, swallows errors (cache write is best-effort)
export async function safeSet(redis, key, data, opts): Promise<void> {
  try { await redis.set(key, data, opts); }
  catch (err) { logger?.warn?.("redis.set failed", { key, err }); }
}
// safeDel for deletes
// safeScan for scan loops
```

Then refactor each domain file (`anime.ts`, `homepage.ts`, `search.ts`, `trending.ts`, `genres.ts`, `studios.ts`, `subscription.ts`) and `invalidation.ts` / `rate-limit.ts` to call the safe wrappers instead of raw `redis.*`. Reads that currently return `T | null` keep the same signature (failure → null = cache miss).

**Why a wrapper, not per-call try/catch:** one place to change the degradation policy, keeps domain logic clean, avoids 15 identical catch blocks. If a logger module doesn't exist in the package yet, add a minimal one or warn via `console.warn` guarded by `process.env.NODE_ENV`.

---

## Bug #5 — turbo.json `globalEnv` (migrated/deprecated key path)
**File:** `turbo.json:3`

`globalEnv` is still accepted by the installed turbo 2.9.18 schema, but the schema also exposes a `globalConfiguration` block that exists specifically to migrate these top-level keys. Leaving it where it is works today but risks a silent no-op or hard error on the next major upgrade.

**Fix:** Move the `globalEnv` array under `globalConfiguration` per the schema's migration shape:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalConfiguration": {
    "globalEnv": ["NODE_ENV","VERCEL","VERCEL_ENV","UPSTASH_REDIS_REST_URL","UPSTASH_REDIS_REST_TOKEN","ENABLE_REDIS_CACHE","ENABLE_REDIS_SHELVES"]
  },
  "tasks": { ... }
}
```
(Exact nested shape confirmed against `node_modules/turbo/schema.json` lines 128-134 + 313 before editing.)

---

## Files to modify
- `packages/db/src/schema/anime.ts` (import path, possibly `taxonomy.ts` rename)
- `apps/web/lib/env.ts` (Stripe lines 37-39)
- `packages/cache/src/safe.ts` (new)
- `packages/cache/src/domains/*.ts` (anime, homepage, search, trending, genres, studios, subscription)
- `packages/cache/src/invalidation.ts`
- `packages/cache/src/rate-limit.ts`
- `turbo.json`
- `packages/cache/src/logger.ts` (new, if no logger exists — verify first)

## Verification
1. `pnpm --filter @nexus/db build` — schema compiles, no broken import (Bug #1).
2. `pnpm --filter web typecheck` — Stripe env vars still type as `string` (Bug #3); confirm no place relies on `env.STRIPE_SECRET_KEY` being possibly-empty.
3. `pnpm --filter @nexus/cache build` + `pnpm --filter @nexus/cache test` — safe wrappers typecheck and existing tests still pass; add one test that confirms `safeGet` returns `null` when the underlying client throws (Bug #4).
4. `rtk turbo build` — turbo still accepts the config and hashes tasks correctly after the `globalConfiguration` move (Bug #5).
5. Full: `pnpm build` from root to confirm no regressions across the monorepo.
