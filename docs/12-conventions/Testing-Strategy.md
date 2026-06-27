# Testing Strategy

> How we test at Nexus Anime. The goal: enough confidence to ship quickly, not enough process to slow us down.

## Philosophy

Tests are executable specifications. They document behavior, catch regressions, and give us the confidence to refactor without fear. We invest in tests that pay for themselves — a failing test that prevents a production incident is worth more than a hundred passing tests that assert obvious things.

Write tests. Not too many. Mostly integration. — adapted from Kent Beck.

## Testing Pyramid

We follow a layered pyramid. The shape reflects cost and confidence.

```
        /  E2E  \            <-- few, slow, high confidence
       / Integration \       <-- some, moderate speed, good coverage
      /     Unit       \     <-- many, fast, low cost
```

### Target Distribution

- **Unit: ~70%** — pure functions, hooks, utilities, services in isolation. Fast to run, cheap to maintain.
- **Integration: ~20%** — repositories against a test DB, API route handlers, compositions of units. Where the real bugs hide.
- **E2E: ~10%** — critical user flows through Playwright. Expensive, slow, brittle — reserve for what must not break.

The percentages are a guide, not a straitjacket. A feature with complex business logic leans heavier on integration tests; a thin CRUD feature may have mostly unit tests with a single E2E smoke check.

## Unit Testing

Unit tests verify a single unit of behavior in isolation.

### What to Unit Test

- **Pure functions** (transforms, formatters, calculations) — the easiest wins.
- **Custom hooks** — using React Testing Library's `renderHook`.
- **Utility functions** — anything in `packages/*/src/lib/` or `apps/web/src/lib/`.
- **Services** — business logic with dependencies mocked.
- **Zod schemas** — valid inputs, invalid inputs, boundary cases, and surprises.

### How to Unit Test

- **Vitest** is the test runner. `pnpm test` runs the suite.
- One expectation per concept, not necessarily one assertion per test. A test named `returns null when anime not found` should assert that and only that.
- Name tests by behavior, not by implementation: `throws ApiError on 500 response`, not `calls fetch and rejects`.
- Prefer `test.each` for parameterized cases (boundary values, enum variants) — it scales better than copy-pasting tests.

### Example

```typescript
import { describe, it, expect } from "vitest";
import { formatRuntime } from "./formatRuntime";

describe("formatRuntime", () => {
  it("formats minutes into hours and minutes", () => {
    expect(formatRuntime(90)).toBe("1h 30m");
  });

  it("omits hours when under 60 minutes", () => {
    expect(formatRuntime(45)).toBe("45m");
  });

  it('returns "N/A" for zero or negative input', () => {
    expect(formatRuntime(0)).toBe("N/A");
    expect(formatRuntime(-5)).toBe("N/A");
  });
});
```

## Integration Testing

Integration tests verify that units work together correctly. This is where we catch the bugs that unit tests miss — wrong query shapes, off-by-one errors in composition, contract drift between layers.

### What to Integrate Test

- **Repositories with a test database** — use a dedicated test schema or a local Postgres instance. Verify queries return the shape the service layer expects.
- **API route handlers** — invoke the handler (or supertest the route) with a real request and assert the response envelope.
- **Server Action flows** — invoke the action, assert it returns correctly, and verify the revalidation or cache invalidation call happened.
- **Upstream API adapters** — verify the adapter transforms the TMDB/AniList response into our domain shape, using recorded fixtures.

### Test Database

Use a **real database**, not an in-memory fake. Postgres semantics (transactions, JSONB, full-text search) matter and SQLite-ish substitutes hide bugs.

- A test-specific database, migrated to the same schema as production.
- Each test runs in a transaction rolled back after the test — fast and isolated.
- Seed minimal data with factories, not hundreds of fixtures.

## End-to-End Testing (E2E)

E2E tests verify critical user flows from the user's perspective. These are the most expensive tests, so we are selective.

### Tools

**Playwright** — chosen for multi-browser support, reliable waits, and trace debugging.

### Critical Flows to Cover

Prioritize flows that, if broken, mean users can't accomplish core tasks:

- **Signup** — create an account, confirm redirect to onboarding.
- **Login** — authenticate, land on home, session persists across reload.
- **Browse and search** — navigate the catalog, apply filters, load details.
- **Watchlist** — add an anime, see it in the watchlist page, remove it.
- **Playback** — start an episode, confirm the player loads, seek works.
- **Logout** — session terminated, redirected, can't access protected routes.

### When to Write an E2E Test

When the flow is:

- Repeatedly used by real users (the "happy path" the product depends on).
- Expensive to break (signup, login, payment, playback).
- Involved enough that unit + integration tests don't cover the whole story.

### When Not to Write an E2E Test

- Visual polish and layout — use visual regression if needed, not Playwright.
- Edge cases better covered by integration tests — E2E is too slow for dozens of variants.
- Static content rendering — a unit or snapshot test is enough.

## Test File Naming and Colocation

Colocation wins. Tests next to the code they test make it obvious when a file has no tests.

```
src/
  services/
    anime.service.ts
    anime.service.test.ts       # unit / integration tests
  hooks/
    use-watchlist.ts
    use-watchlist.test.ts
  components/
    hero-card.tsx
    hero-card.test.tsx
e2e/
  auth.spec.ts
  playback.spec.ts
```

### Naming Conventions

- `*.test.ts` for unit and integration tests.
- `*.spec.ts` for E2E tests and milestone specs (context disambiguates).
- `*.test.tsx` for React component tests (the `.tsx` signals JSX).

## Test Data Factories

Factories, not fixtures. Fixtures rot — they encode assumptions that silently drift from the schema. Factories produce valid data on demand and let each test specify only the fields it cares about.

### Example

```typescript
import { faker } from "@faker-js/faker";
import type { Anime } from "@nexus/db";

export function makeAnime(overrides: Partial<Anime> = {}): Anime {
  return {
    id: faker.number.int({ min: 1, max: 100000 }),
    title: faker.lorem.words(3),
    slug: faker.lorem.slug(),
    synopsis: faker.lorem.paragraph(),
    episodeCount: faker.number.int({ min: 1, max: 100 }),
    status: "airing",
    cachedAt: new Date(),
    ...overrides,
  };
}
```

Tests use the factory and override only what the test needs:

```typescript
const anime = makeAnime({ episodeCount: 0 });
```

This keeps tests honest — if the test needs `episodeCount: 0`, it says so explicitly.

## Mocking Strategy

Mock at the boundary, never in the middle.

### What to Mock

- **External APIs** — TMDB, AniList, Stripe, Cloudflare Stream. These are out of our control, slow, and may change. Mock them in unit and integration tests.
- **Upstream HTTP responses** — record real responses as fixtures when possible, then replay them. This catches contract drift when the upstream changes shape.

### What Not to Mock

- **The database** — never. Use a real test DB in integration tests. Mocking the DB hides the most important bugs.
- **Internal modules** — don't mock the code you're integrating with. If mocking is required, that's a coupling smell, not a testing solution.

### How to Mock

- Vitest's `vi.mock` for module-level mocks.
- MSW (Mock Service Worker) for HTTP-level mocking — works in Node and browser, closer to the real network stack.

## Coverage Targets

Coverage is a guardrail, not a goal.

- **Aim for 80% line coverage on business logic.** Routing, trivial getters, and generated code don't need 100%.
- **Do not chase 100%.** The last 20% is usually getters, setters, and defensive code that rarely breaks. Tests there don't earn their keep.
- **Coverage is a floor, not a ceiling.** 80% coverage with weak assertions is worse than 60% coverage that actually exercises boundary cases.
- **Fail the build on a coverage drop.** Configure a minimum threshold per package; if a PR drops coverage below it, CI blocks the merge.

### What High Coverage Looks Like

Focus coverage effort on:

- Services with business logic.
- Zod schemas (every variant of every schema).
- The envelope and error handling in route handlers.
- Hooks that coordinate server state.

Don't stress about:

- Configuration files.
- Trivial wrapper components.
- Boilerplate that the type system already constrains.

## CI Integration

Tests are part of the CI pipeline and **block merge on failure**.

### Pipeline Steps for a PR

1. **Type check** — `pnpm typecheck`.
2. **Lint** — `pnpm lint`.
3. **Unit + integration tests** — `pnpm test` with coverage.
4. **Build** — `pnpm build`.
5. **E2E** — runs on demand or on PRs touching critical paths (auth, payments, playback). Not every PR waits for the full E2E suite.

### Fast Feedback

- Unit and integration tests complete in under 2 minutes. If they're slow, parallelize or mock the slow layer.
- E2E suite runs in under 10 minutes. Use sharding if it grows beyond that.

### Blocking Merge

- Any failed test blocks merge.
- Skipped tests are visible in the CI output — a test that is always skipped is a test that is dead. Delete it or fix it.

## Testing React Components

Different component types, different strategies.

### Client Components

Use **React Testing Library**. Don't test implementation — test behavior from the user's perspective.

```typescript
import { render, screen, userEvent } from '@testing-library/react';

it('toggles the watchlist button on click', async () => {
  render(<WatchlistButton animeId={123} />);

  const button = screen.getByRole('button', { name: /add to watchlist/i });
  await userEvent.click(button);

  expect(screen.getByRole('button', { name: /remove from watchlist/i })).toBeInTheDocument();
});
```

Verify: renders in all states (loading, error, empty, populated), interactions work, accessibility basics (role, name, focus).

### Server Components

Server Components render on the server. Test them by

- Mocking the data source the component fetches.
- Invoking the component and asserting the rendered output (HTML or React element).
- Verifying the right cache key or revalidation path was used if relevant.

Keep server component tests thin — they shouldn't duplicate integration tests. If the component is mostly a shell over a service, test the service.

## Testing Server Actions

Server Actions are the mutation boundary in the App Router. Test them by invoking them directly.

1. **Invoke the action** with validated input (use a Zod schema as the input).
2. **Assert the return value** — success envelope or error.
3. **Verify side effects** — did the repository mutation run? Did `revalidatePath` or `revalidateTag` fire? Was the cache invalidated?

```typescript
import { revalidatePath } from "next/cache";

it("adds an anime to the watchlist and revalidates the list", async () => {
  const result = await addToWatchlist({ animeId: 123 });

  expect(result).toEqual({ data: { success: true } });
  expect(revalidatePath).toHaveBeenCalledWith("/watchlist");
});
```

Mock the repository and Next's cache helpers so the test is a unit test of the action's logic.

## Testing Zod Schemas

Schemas are the boundary guards. Test them directly.

### What to Test

- **Valid inputs** — the happy path. Every happy path the feature uses.
- **Invalid inputs** — wrong types, missing fields, nulls, undefined, empty strings.
- **Boundary cases** — min/max length, min/max number, empty array, whitespace-only string.
- **Unexpected inputs** — the oddball data the upstream might send. These catch real bugs.

```typescript
import { describe, it, expect } from "vitest";
import { SignupInputSchema } from "./signup.schema";

describe("SignupInputSchema", () => {
  it("accepts valid email and password", () => {
    const result = SignupInputSchema.safeParse({
      email: "user@example.com",
      password: "secure-password-123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = SignupInputSchema.safeParse({
      email: "not-an-email",
      password: "secure-password-123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["email"]);
    }
  });

  it.each([
    ["", "empty string"],
    ["a", "too short"],
    ["a".repeat(129), "too long beyond max"],
  ])("rejects a password that is %s", (password) => {
    const result = SignupInputSchema.safeParse({
      email: "user@example.com",
      password,
    });
    expect(result.success).toBe(false);
  });
});
```

## When to Write a Test

- **Before fixing a bug** — write a failing test that proves the bug, then fix the code so it passes (regression test).
- **When adding a feature** — tests cover the new behavior and its edge cases.
- **When refactoring** — tests give you the confidence to change structure without changing behavior.
- **When reviewing a PR that introduces complexity** — if the PR adds branching logic, it should add tests.

## Closing Thought

Tests are an investment. Write the test that catches the bug before the bug catches you in production. Skip the test that exists only to make a number go up.
