# OpenAPI Plan

> **Planning document** for generating and maintaining an OpenAPI specification for Nexus Anime.
>
> Ownership: **Lead API Architect**. Last reviewed: 2026-06-26.

---

## 1. Purpose

This document is the roadmap for producing, publishing, and evolving a machine-readable OpenAPI specification for the Nexus Anime API. It exists so that:

- External consumers (mobile SDKs, partner integrations, internal tooling) can discover and validate against a single authoritative contract.
- CI can detect breaking changes before they reach production.
- SDK generation is automated from the spec rather than hand-maintained.

The spec is not yet generated. This document is the plan to get there.

Related references:

- [API-Standards.md](./API-Standards.md) — envelope shape, naming, error codes the spec must encode.
- [Versioning.md](./Versioning.md) — URL-prefix versioning strategy the spec follows.
- [Pagination.md](./Pagination.md) — cursor and offset schemas that appear in the spec.
- [Authentication.md](./Authentication.md) — security schemes referenced by the spec.

---

## 2. Current state

There is no generated OpenAPI spec today. API contracts exist only as:

- Zod schemas in route handlers and Server Actions (runtime validation).
- Human-authored markdown under `docs/06-api/`.
- TypeScript types derived from Zod via `z.infer`.

This is sufficient for internal development but inadequate for external consumers, SDK generation, or automated breaking-change detection. The plan below closes that gap in three phases.

---

## 3. Tooling

| Component | Choice | Rationale |
|---|---|---|
| Spec format | OpenAPI 3.1 | Aligns with JSON Schema draft 2020-12; supports `unknown` and `const` patterns used in our Zod schemas. |
| Spec generation | `zod-to-openapi` | We already validate every boundary with Zod; generating the spec from the same schemas eliminates drift between validation and documentation. |
| Spec serving | Scalar (primary), Redoc (fallback) | Scalar renders interactive docs with try-it-out at `/api/docs`. Redoc serves a static reference at `/api/reference` as a fallback for locked-down environments. |
| Breaking-change detection | `oasdiff` | Industry-standard diff tool; integrates into CI with clear breaking/errata classification. |
| Schema linting | `spectral` | Custom ruleset enforcing Nexus naming conventions (snake_case params, camelCase JSON properties, envelope shape). |
| SDK generation | `openapi-typescript` | Generates a zero-dependency TypeScript client from the spec. Swift and Kotlin generation deferred to M6+. |

---

## 4. Source of truth

Zod schemas are the single source of truth. The OpenAPI spec is derived, never hand-edited after generation.

Schema location:

```
packages/api/src/schemas/
  auth.ts          # login, register, token refresh, OAuth callbacks
  users.ts         # profile CRUD, preferences, avatar
  anime.ts         # catalog entities, seasons, episodes
  engagement.ts    # watchlist, ratings, bookmarks, comments
  search.ts        # query params, filters, sort
  common.ts        # pagination, envelope, error, shared primitives
```

Each schema file registers its shapes with `zod-to-openapi` via `ZodOpenAPIMetadata`. The build step in `packages/api` produces `openapi.json` from these registrations.

Route handlers in `apps/web/app/api/**` import schemas from `@nexus/api` and apply them at the boundary. They do not define their own Zod schemas inline. This guarantees the spec and runtime validation share the same definitions.

---

## 5. Repository layout

```
packages/api/
  src/
    schemas/           # Zod schemas (source of truth for spec generation)
    routes/            # OpenAPI path + operation metadata (maps schemas to HTTP methods)
    openapi-builder.ts # Assembles and emits the full spec
  generated/
    openapi.json       # Produced by build; committed for CI diffing
    openapi.yaml       # YAML rendering for human review
  package.json         # Build script: "generate-spec": "ts-node src/openapi-builder.ts"

apps/web/
  app/
    api/
      docs/            # Scalar interactive docs (serves generated spec)
      reference/       # Redoc static reference
      v1/              # Route handlers; import schemas from @nexus/api
  src/
    lib/
      api-client.ts    # Generated TypeScript SDK (from openapi-typescript)
```

The generated spec is committed to the repository. This makes breaking-change detection a plain `git diff` in CI and avoids build-time flakiness in downstream consumers.

---

## 6. Phased rollout

### Phase 1 — M3: Auth + Users (hand-written spec, static output)

**Scope:** Authentication and user profile endpoints.

**Approach:** Hand-write the OpenAPI YAML for the ~8 auth/user endpoints rather than wiring up `zod-to-openapi` generation. This is deliberate: auth schemas are stable, the endpoint count is small, and the team needs a working spec serving pipeline before investing in the generation build step.

**Deliverables:**

- `packages/api/generated/openapi.yaml` covering `/api/v1/auth/*` and `/api/v1/users/*`.
- Scalar mounted at `/api/docs` rendering the spec.
- CI check: `spectral lint` passes on the spec.
- CI check: spec is valid OpenAPI 3.1 (`@redocly/cli lint`).

**Estimated effort:** ~2 engineer-weeks (1 week authoring + reviewing, 1 week CI integration and Scalar deployment).

**Acceptance criteria:**

1. `/api/docs` renders an interactive Scalar page with all auth and user endpoints.
2. Every request and response body in the spec matches the actual Zod-validated shape in the route handlers (manual spot-check; automated check arrives in Phase 2).
3. `spectral lint` and `@redocly/cli lint` pass in CI with zero errors.
4. The spec is served with correct `Content-Type` and CORS headers.

---

### Phase 2 — M4: Catalog + Engagement (generated from Zod)

**Scope:** Anime catalog, seasons, episodes, watchlist, ratings, bookmarks, comments, search.

**Approach:** Replace the hand-written Phase 1 YAML with a fully generated spec. Wire `zod-to-openapi` into a build step that reads schemas from `packages/api/src/schemas/*` and produces `openapi.json`. Route metadata (path, method, tags, operationId) is defined in `packages/api/src/routes/*`, co-located with but separate from the schemas.

**Deliverables:**

- `packages/api` build script that produces `openapi.json` from Zod schemas.
- Spec now covers all M3 + M4 endpoints (~35 operations).
- CI check: `oasdiff breaking` between the committed spec and the generated spec — zero breaking differences on `main`.
- CI check: generated spec matches committed spec (prevents manual edits to generated file).
- TypeScript client generated via `openapi-typescript` and published as an internal package.

**Estimated effort:** ~3 engineer-weeks (1.5 weeks schema registration and build wiring, 1 week CI integration, 0.5 weeks SDK generation and smoke tests).

**Acceptance criteria:**

1. Running `pnpm --filter @nexus/api generate-spec` produces `openapi.json` that is valid OpenAPI 3.1.
2. The generated spec covers every route handler under `apps/web/app/api/v1/**` — no missing operations.
3. `oasdiff breaking` reports zero breaking changes between the current and previous committed spec.
4. The generated TypeScript client compiles and can make a successful typed request to `/api/v1/auth/session` in a test environment.
5. No manual edits exist in `packages/api/generated/openapi.json` (enforced by CI: regenerate and diff).

---

### Phase 3 — M5: Full coverage, interactive docs, SDK generation

**Scope:** All remaining endpoints — notifications, uploads, webhooks, admin. Expand SDK targets.

**Approach:** Extend generation to cover every route handler. Add operation-level examples and `x-` extensions for SDK hints. Configure Scalar with authentication (session cookie + bearer token) so consumers can try requests interactively. Begin Swift and Kotlin SDK generation evaluation.

**Deliverables:**

- Full spec coverage: every endpoint under `apps/web/app/api/**`.
- Scalar configured with auth and try-it-out enabled.
- TypeScript SDK published to internal registry (npm or Artifactory).
- Swift/Kotlin SDK generation evaluated; generation pipeline documented if viable, deferred to M6 if not.

**Acceptance criteria:**

1. Spec covers 100% of route handlers in `apps/web/app/api/v1/**` (automated check: diff operationIds against route handler file list).
2. Every operation has at least one `example` in the response schema.
3. Scalar at `/api/docs` allows authenticated try-it-out against a staging environment.
4. TypeScript SDK is published and installable (`@nexus/api-client`) with typed request/response for all operations.
5. `oasdiff breaking` is a required status check on the `main` branch (blocks merge on breaking change).

---

## 7. CI checks

Three checks run on every PR that touches `packages/api/src/schemas/**`, `packages/api/src/routes/**`, or `apps/web/app/api/**`:

1. **Schema lint** — `spectral lint packages/api/generated/openapi.json` with a custom ruleset enforcing:
   - `snake_case` for path and query parameters.
   - `camelCase` for JSON body properties.
   - Envelope shape: success responses wrap in `{ data }`, errors in `{ error: { message, code, details } }`.
   - Every operation has `operationId` and `tags`.

2. **Breaking-change detection** — `oasdiff breaking base:main head:pr-branch` against the spec on `main`. Reports are posted as PR comments. Allowed non-breaking changes (additive fields, new endpoints) pass. Breaking changes (removed fields, changed types, removed endpoints) block merge.

3. **Spec freshness** — regenerate the spec from Zod schemas and `diff` against the committed `openapi.json`. If they differ, CI fails with instructions to run `pnpm --filter @nexus/api generate-spec` and commit the result. This prevents hand-edits and schema drift.

---

## 8. Versioning

The spec version tracks the API version. The v1 spec is published at:

```
/api/v1/openapi.json
/api/v1/openapi.yaml
```

The `info.version` field in the spec follows semver: `MAJOR.MINOR.PATCH` where `MAJOR` maps to the URL-prefix version (`v1`, `v2`) and `MINOR`/`PATCH` track additive and fix changes within that major version.

When a new major API version is introduced (e.g. `v2`), a separate spec is generated and published at `/api/v2/openapi.json`. The `v1` spec continues to be served until its sunset date per [Versioning.md](./Versioning.md).

---

## 9. SDK generation

**TypeScript client** (Phase 2+):

- Generated by `openapi-typestypescript` from `openapi.json`.
- Output: `apps/web/src/lib/api-client.ts` (or a dedicated package `@nexus/api-client`).
- Zero runtime dependencies; types only plus a thin fetch wrapper.
- Regenerated in CI as a freshness check (same pattern as spec freshness).

**Swift / Kotlin** (M6+):

- Evaluated in Phase 3; generation begins in M6 if the mobile apps are greenlit.
- Tooling: `openapi-generator` with Swift 5 / Kotlin 2 templates.
- Generated code lives in a separate repository (`nexus-anime-sdk-swift`, `nexus-anime-sdk-kotlin`) to avoid monorepo bloat.
- Not blocked by this plan; just deferred.

---

## 10. Deprecation tracking

Endpoints and schema fields are deprecated using OpenAPI's `deprecated: true` annotation and a custom `x-sunset` extension holding the sunset date:

```yaml
paths:
  /api/v1/anime/{id}/related:
    get:
      deprecated: true
      x-sunset: "2027-03-01"
      summary: Related anime (replaced by /api/v1/anime/{id}/recommendations)
```

CI enforces that every deprecated operation has an `x-sunset` date and a replacement documented in `description`. The sunset date must be at least 6 months in the future from the date the deprecation is introduced.

Deprecated fields in schemas use `deprecated: true` with a `description` noting the replacement field. The TypeScript SDK emits `@deprecated` JSDoc tags so consumers get editor warnings.

---

## 11. Open questions

**Should Server Action schemas be published in the spec?**

No. Server Actions are internal — they are called by Next.js runtime via encoded form submissions, not over a stable HTTP contract. Publishing their schemas would:

- Couple external consumers to an internal transport that can change without a major version bump.
- Add complexity (form-encoded input, non-JSON responses, progressive enhancement semantics).
- Create a maintenance burden for schemas that have no external consumers.

Server Action input/output shapes remain typed via Zod and TypeScript internally. If a Server Action needs to become a public API, it is promoted to a route handler with its own schema and spec entry.

---

## 12. Summary of estimates

| Phase | Milestone | Scope | Effort |
|---|---|---|---|
| 1 | M3 | Auth + users: hand-written spec, Scalar, spectral lint | ~2 engineer-weeks |
| 2 | M4 | Catalog + engagement: Zod-generated spec, oasdiff, TypeScript SDK | ~3 engineer-weeks |
| 3 | M5 | Full coverage, interactive docs, Swift/Kotlin evaluation | ~2 engineer-weeks (generation wiring; mobile SDKs deferred to M6) |

Total: ~7 engineer-weeks across M3–M5, spread over the natural milestone cadence. Phase 1 is the critical path — it establishes the serving infrastructure and CI patterns that Phases 2 and 3 build on.
