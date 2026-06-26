# Coding Standards — Nexus Anime

> **Audience:** Everyone who writes or reviews TypeScript/TSX in this repository.
> **Status:** Accepted. Enforced by ESLint, Prettier, TypeScript strict mode, and code review. Changes are proposed via PR against this file.
> **Related:** [Naming Conventions](./Naming-Conventions.md) · [Folder Conventions](./Folder-Conventions.md) · [Git Workflow](./Git-Workflow.md) · [Repository Design](../../REPOSITORY-DESIGN.md) · [API Rules](../../CLAUDE.md)

This document defines the mechanical and philosophical rules for writing code in this repo. Rules are categorized: **(R)** = required (tooling-enforced where possible), **(P)** = preferred (review-enforced), **(G)** = guideline (judgment call, but default to the guidance).

---

## 1. TypeScript

### 1.1 Strict mode is non-negotiable  (R)

`tsconfig.base.json` sets `"strict": true`. Do not relax it in any app or package `tsconfig.json`. The strict family of flags (`noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) is on — write code that satisfies them rather than working around them.

```ts
// Forbidden — strict mode catches this at compile time
function getTitle(anime: Anime) {
  return anime.title.length; // possibly undefined under strictNullChecks
}

// Required — narrow the type before use
function getTitle(anime: Anime): number {
  if (!anime.title) throw new ApiError("Title missing", "BAD_INPUT");
  return anime.title.length;
}
```

### 1.2 No `any`, no `@ts-ignore`  (R)

`any` is the escape hatch that defeats static analysis. `@ts-ignore` hides real problems. Both are forbidden.

When the type is genuinely unknown, use one of these instead:

| Situation | Use |
|-----------|-----|
| Value of unknown shape | `unknown` + a type guard (narrow before use) |
| Generic containers | `T` / `TValue` with constraints (`<T extends ZodType>`) |
| Third-party library with no types | Write a module augmentation or a typed wrapper in a `.d.ts` / `lib/types.ts` |
| Truly unavoidable (interop, legacy) | `// any: <reason>` — a single line with an explicit justification comment, reviewed carefully |

```ts
// Wrong — any disables checking
function parse(raw: any) { return raw as Anime; }

// Right — validate at the boundary with Zod
const AnimeSchema = z.object({ id: z.number(), title: z.string() });
type Anime = z.infer<typeof AnimeSchema>;
function parse(raw: unknown): Anime {
  return AnimeSchema.parse(raw); // throws ZodError on mismatch
}
```

`@ts-ignore` / `@ts-expect-error` are forbidden. If a third-party type is wrong, fix the type at the boundary, not at the point of suppression.

### 1.3 Zod is the single source of truth for runtime validation  (R)

Parse once, at the boundary (route handler, Server Action, webhook entry, external API response). Inside the server, work with the derived TypeScript type — do not re-validate.

Derive TS types from schemas with `z.infer`, never hand-write a parallel interface:

```ts
// packages/db/src/schema/anime.ts
import { z } from "zod";

export const AnimeSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().min(1).max(120),
  title: z.string().min(1),
  synopsis: z.string().nullable(),
  episodeCount: z.number().int().nonnegative(),
  status: z.enum(["airing", "finished", "upcoming"]),
  createdAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable(),
});
export type Anime = z.infer<typeof AnimeSchema>;

// Partial variant for updates — derive, don't duplicate
export type AnimeUpdate = Partial<Pick<Anime, "title" | "synopsis" | "status">>;
```

Rules:
- Every route handler / Server Action validates input params, query, and body with Zod.
- Every external API response (TMDB, AniList, Stripe webhook) is validated with Zod before being stored or returned.
- Every response shape is validated with Zod before returning to the client — never trust the database or an upstream to return the shape you expect.

### 1.4 Return types on public functions  (P)

Annotate return types on all exported functions and any internal function whose body exceeds ~10 lines or whose return shape is not obvious from the last statement. Let inference handle the rest.

```ts
// Exported — always annotate the contract
export async function getAnimeBySlug(slug: string): Promise<Anime | null> {
  return db.query.anime.findFirst({ where: eq(anime.slug, slug) });
}

// Internal, short body — inference is fine
const toSlug = (title: string) =>
  title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
```

Explicit return types catch the case where the implementation drifts from the contract, and they surface that drift at the declaration site — not the call site.

### 1.5 Prefer discriminated unions for state machines  (P)

Use a discriminant field to model mutually exclusive state. Avoid boolean flags like `isLoading` + `isError` + `isSuccess` — those can combine into impossible states.

```ts
// Wrong — flags can combine into impossible states
type VideoState = {
  isLoading: boolean;
  isError: boolean;
  url: string | null;
};

// Right — discriminated union: exactly one variant is active at a time
type VideoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; url: string; expiresAt: number }
  | { status: "error"; message: string; code: string };

// Usage narrows automatically
function render(state: VideoState) {
  switch (state.status) {
    case "ready":
      return <Player url={state.url} />;      // state.url: string
    case "error":
      return <ErrorBanner code={state.code} className="text-red-400" />;
    default:
      return <PlayerSkeleton />;
  }
}
```

### 1.6 Null handling  (G)

Avoid `null` in internal code where a discriminated union or a `Result`-style return would be clearer. Reserve `null` for intentional "absence" (e.g. "no profile picture set"). Use `undefined` sparingly and consistently — prefer explicit `null` for "intentionally empty" columns.

---

## 2. React & Next.js

### 2.1 Default to Server Components  (R)

Every component is a Server Component until it needs state, effects, or browser APIs. The `'use client';` directive is the exception, not the rule.

Become a client component only when you use:
- `useState`, `useReducer`, or other state hooks
- `useEffect` or other lifecycle hooks
- Event handlers (`onClick`, `onChange`, etc.)
- Browser-only APIs (`window`, `localStorage`, `navigator`)

```tsx
// Server Component (default) — fetches data, renders markup
// app/anime/[slug]/page.tsx
export default async function AnimePage({ params }: { params: { slug: string } }) {
  const anime = await getAnimeBySlug(params.slug);
  if (!anime) notFound();
  return (
    <article>
      <h1>{anime.title}</h1>
      <EpisodeList animeId={anime.id} />  {/* stays a Server Component */}
    </article>
  );
}
```

Push client interactivity down to leaf components rather than marking an entire page as a client. This is sometimes called the "islands" pattern.

### 2.2 Server Actions for mutations  (R)

Use Server Actions for all mutations triggered by forms and interactive handlers. Do not write API route handlers for simple CRUD.

```tsx
// app/watchlist/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";

export async function toggleWatchlist(animeId: number): Promise<{ on: boolean }> {
  const user = await requireUser();              // throws ApiError on anonymous
  const on = await services.watchlist.toggle(user.id, animeId);
  revalidatePath("/watchlist");
  return { on };
}
```

Validate with Zod inside the action. Return typed values (`{ on }`) or throw typed errors (`ApiError`) — never return untyped shapes.

### 2.3 Route Handlers are for non-browser clients  (P)

Reserve `app/<route>/route.ts` for:
- Webhooks (Stripe, webhook callbacks)
- Third-party callbacks and integrations
- Endpoints consumed by non-browser clients (RSS feeds, public API)

Do not write route handlers as "action endpoints" fronted by your own UI — use Server Actions for that.

### 2.4 Suspense for async Server Components  (R)

Wrap async Server Components in `<Suspense>` with a meaningful skeleton. Do not block the entire page on a single slow fetch — stream parts in independently.

```tsx
import { Suspense } from "react";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <Suspense fallback={<CarouselSkeleton />}>
        <TrendingRow />     {/* async — streams in */}
      </Suspense>
      <Suspense fallback={<CarouselSkeleton />}>
        <NewReleasesRow />  {/* async — streams in independently */}
      </Suspense>
    </main>
  );
}
```

Skeletons should mirror the shape of the real content (same height, placeholder rectangles) so layout does not shift when data arrives.

### 2.5 Dynamic imports for heavy client islands  (P)

Use `next/dynamic` for components with heavy dependencies or browser-only behavior (video player, charting, rich text editor, comment threads).

```tsx
const VideoPlayer = dynamic(() => import("@/components/video/VideoPlayer"), {
  ssr: false,                    // player is browser-only
  loading: () => <PlayerSkeleton />,
});
```

### 2.6 Hooks extraction  (G)

Extract reusable client-side logic into hooks under `apps/web/src/hooks/`. A hook is justified when:
- The same state-plus-effect logic appears in two or more components.
- You need to share server-state-fetching state across a subtree.

Do not mirror server state in `useState` — for server-derived data, prefer Server Components or TanStack Query. `useState` / `useReducer` is for UI-only state (toggle, selected tab, form draft).

### 2.7 Memoization only when profiling shows a bottleneck  (G)

Do not preemptively add `useMemo`, `useCallback`, or `React.memo`. They add cognitive overhead and cost per render. Add them only when:
- A profiler or trace identifies the component as a bottleneck.
- The memoized value feeds a `useEffect` dependency and the reference churn causes infinite loops.
- You are feeding a value into a heavy child component that does not otherwise short-circuit re-renders.

---

## 3. Tailwind CSS & Styling

### 3.1 Tailwind CSS 4 only  (R)

Tailwind 4 is the only styling system. Do not introduce CSS Modules, `styled-components`, `emotion`, vanilla CSS files, or inline `style={}` objects — unless the value is genuinely dynamic (e.g. a color computed at render time from API data) and Tailwind cannot express it.

```tsx
// Wrong — inline style where a token exists
<h1 style={{ color: "#e2e8f0" }}>Title</h1>;

// Right — theme token
<h1 className="text-muted-foreground">Title</h1>;
```

### 3.2 Theme tokens from `@nexus/ui`  (R)

`@nexus/ui` is the source of truth for tokens, spacing, colors, and typography. Do not hand-roll colors or spacing that already exist in the theme. Reference semantic tokens (`text-foreground`, `bg-card`, `border-input`) rather than raw values.

The Tailwind 4 `@theme` block in `@nexus/ui/src/styles/tokens.css` defines the canonical set. If a token you need is missing, **add it to the theme** rather than hard-coding it at the call site.

### 3.3 No raw colors  (R)

Avoid raw hex / RGB / named color utilities in components. Prefer the semantic and scale-based utilities derived from the theme:

```tsx
// Forbidden
className="text-white bg-black border-gray-300";
className="text-[#8b5cf6]";

// Preferred
className="text-foreground bg-card border-border";
className="text-accent";
```

Raw colors are allowed in **theme/token definitions only** (`@nexus/ui/src/styles/tokens.css` and config). Components consume the tokens, never the raw values.

### 3.4 Responsive, mobile-first  (P)

Write the smallest-screen layout first, then layer `md:` and `lg:` adjustments on top. Design for 380px as the floor, then scale up through 768, 1024, 1440.

```tsx
// Mobile-first: smallest layout first
<div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4 lg:grid-cols-6">
  {items.map((it) => <AnimeCard key={it.id} anime={it} />)}
</div>
```

Do not override a smaller breakpoint's value at a larger breakpoint unless you genuinely need a different value — let it cascade.

### 3.5 Glassmorphism tokens, not ad-hoc blur  (P)

The glass aesthetic is provided as theme utilities / component variants in `@nexus/ui`. Do not compose raw `backdrop-blur-*`, `bg-white/5`, `border-white/10` at the call site — use the `glass()` utility or the `<Surface>` component, which centralizes the recipe and keeps it consistent across views.

```tsx
// Wrong — hand-rolled glass at every call site
<div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md">

// Right — shared recipe
<Surface variant="glass" rounded="xl">
  ...
</Surface>
```

### 3.6 Animations  (G)

- **Micro-interactions** (hover, focus, small transitions) → CSS transitions (`transition-*`, `duration-*`, `ease-*`). No Framer Motion.
- **Complex orchestration** (page transitions, video player chrome, multi-step reveal) → Framer Motion.

Do not introduce a Framer Motion animation where a CSS transition would do — bundle size and complexity cost.

---

## 4. Error Handling

### 4.1 The ApiError envelope  (R)

All server-side errors are represented by a typed `ApiError` (`message`, `code`, optional `details`). The API envelope is typed:

```ts
// packages/*/src/types.ts
export type ApiResult<T> =
  | { data: T }
  | { error: { message: string; code: string; details?: unknown } };
```

Rules:
- `code` is a stable, machine-readable string (`UNAUTHORIZED`, `NOT_FOUND`, `RATE_LIMITED`) — not the HTTP status number.
- `message` is a user-facing, human-readable summary — safe to surface in the UI.
- `details` carries structured extra information for client-side handling (validation errors, retry-after, etc.).
- Stack traces and internal URLs are **never** exposed to the client in production.

```ts
// Throwing
throw new ApiError("Could not verify credentials", "AUTH_FAILED", { provider: "github" });

// In a route handler
try {
  const payload = await req.json();
  const input = CreateAnimeSchema.parse(payload);
  const created = await services.anime.create(input);
  return NextResponse.json({ data: created });
} catch (err) {
  return NextResponse.json(
    { error: toApiError(err) },   // normalizes ApiError or ZodError or unknown
    { status: apiErrorStatus(err) }
  );
}
```

### 4.2 Validate at every boundary  (R)

- Route handler / Server Action input → Zod on `req.json()`, params, query.
- External API responses (TMDB, AniList, Stripe) → Zod before storage or use.
- Responses before returning → Zod before `NextResponse.json`.

"Validate in, trust inside, validate out."

### 4.3 No swallowed errors  (R)

Every caught error must either be:
- Handled meaningfully (retried, fallback, user-facing message), or
- Re-thrown wrapped in an `ApiError` with the original attached.

```ts
// Wrong — swallow
try {
  await sendEmail(user.email);
} catch {
  // silent
}

// Right — handle or surface
try {
  await sendEmail(user.email);
} catch (err) {
  logger.error("email.send.failed", { err });
  throw new ApiError("Could not send email", "EMAIL_SEND_FAILED", { cause: err });
}
```

### 4.4 One typed error, not many ad-hoc shapes  (P)

Do not invent a new error class per feature. Use `ApiError` with distinct `codes`. Introduce a subclass only when you need to carry typed metadata that code-level consumers branch on (e.g. `ValidationError` carrying `issues: z.ZodIssue[]`).

---

## 5. Imports

### 5.1 Order and grouping  (R)

Imports are ordered in three groups, each alphabetized, separated by a blank line:

1. **External** — third-party packages (`react`, `next`, `zod`, `@nexus/*` packages).
2. **Internal / workspace** — `@/*` path aliases resolving to the current app or package.
3. **Relative** — `./` and `../` within the same feature or directory.

```tsx
// 1. External + workspace
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { AnimeCard } from "@nexus/ui";
import { db } from "@nexus/db";

// 2. Internal (@/* alias for this app/package)
import { requireUser } from "@/lib/auth/session";
import { getAnimeBySlug } from "@/lib/anime/service";

// 3. Relative
import { EpisodeList } from "./EpisodeList";
import { PlayerSkeleton } from "../video/PlayerSkeleton";
```

Type-only imports use `import type { ... }` and sit with their group if the runtime import from the same module does not exist. If a module has both a runtime and a type import, prefer `import { type Foo, doThing } from "..."`.

### 5.2 No barrel imports for the sake of brevity  (P)

Import from the most specific path that makes sense. Do not cross feature boundaries through a top-level barrel — see [Folder Conventions](./Folder-Conventions.md).

```tsx
// Wrong — reaches across a feature boundary via barrel
import { useWatchlist, WatchlistButton } from "@/components";

// Right — scoped to the feature that owns it
import { useWatchlist } from "@/features/catalog/hooks";
import { WatchlistButton } from "@/features/catalog/components";
```

### 5.3 No unused imports  (R)

`pnpm lint` fails on unused imports. Do not leave them around for "later."

---

## 6. Comments

### 6.1 Why, not what  (G)

Code should be readable enough to explain *what* it does. Comments explain *why* — the rationale a future reader cannot reconstruct from the code alone.

```ts
// Wrong — restates the code
// Increment count by 1
count += 1;

// Right — documents non-obvious rationale
// TMDB rate-limits at 40 req/10s; stagger the first page of fanouts so we don't
// trip the limit on cold cache. See ADR-004 for the caching strategy.
await sleep(250 * index);
```

### 6.2 ADR references, not decision summaries  (P)

When the rationale was captured in an ADR, link to it rather than summarizing the decision in a comment:

```ts
// ADR-003: sessions are stored server-side; the cookie is just an opaque id.
// Do not read user claims from the cookie.
const session = await loadSession(cookies().get("session")?.value);
```

A one-line link is always preferred to a three-line summary — summaries drift from the ADR, links do not.

### 6.3 Todo comments  (G)

`// TODO(owner): <action>` is acceptable for intentional follow-ups with an owner. Link an issue when one exists. Do not let TODOs linger past the PR that introduced them — either resolve them in the same PR or file an issue.

### 6.4 No commented-out code  (R)

Deleted code is recovered from git history. Do not leave commented-out blocks in PR diffs.

---

## 7. Function Design

### 7.1 Single responsibility  (G)

A function does one thing. If you can name it with a single verb-noun pair (`parseUrl`, `buildCacheKey`, `requireUser`) and it still pulls double duty, split it. A function that fetches, transforms, and formats should become three functions composed together.

### 7.2 Keep functions short  (G)

Target under 50 lines. A function that creeps past 75 lines is a candidate for extraction — not blind line-count splitting, but extraction of a distinct responsibility. If you need more than one scroll of editor viewport to read it, it is probably doing too much.

### 7.3 Favor pure functions where possible  (P)

Pure functions (same input → same output, no side effects) are easy to test, memoize, and reason about. Push side effects (DB writes, fetch, revalidation) to the edges — services, actions, route handlers — and keep the core logic pure.

```ts
// Pure — testable in isolation
export function buildCacheKey(entity: string, id: number, view: string): string {
  return `nexus:${entity}:${id}:${view}`;
}

// Side-effecting — lives at the boundary
export async function getCachedAnime(id: number): Promise<Anime | null> {
  const hit = await redis.get<Anime>(buildCacheKey("anime", id, "detail"));
  // ...
}
```

### 7.4 Explicit parameters over config objects  (G)

Prefer 1–2 well-named positional parameters. Use an options object only when there are 3+ parameters or when most are optional. When a function's parameter shape is non-trivial, define and name the parameter type.

```ts
// Clear
export function fetchAnime(slug: string): Promise<Anime | null>;

// Options object — justified because most fields are optional
export interface FetchAnimeListOptions {
  status?: "airing" | "finished" | "upcoming";
  limit?: number;
  cursor?: string;
}
export function fetchAnimeList(opts: FetchAnimeListOptions): Promise<AnimeListPage>;
```

### 7.5 Early returns  (P)

Return on error paths or trivial cases early to reduce nesting. Reserve the "happy path at the bottom" structure for the common case.

```ts
export function formatProgress(progress: WatchProgress | null): string {
  if (!progress) return "Not started";
  if (progress.completed) return "Completed";
  if (progress.seconds === 0) return "Started";
  return `At ${formatTime(progress.seconds)}`;
}
```

---

## 8. File Size & Readability

- Target **under 300 lines** per file. Hard cap at **400**.
- When a file nears the threshold, split by responsibility, not by line count. Each extracted unit should be a coherent module or function that makes sense on its own.
- If a file has three exports that are always used together, consider whether they belong in a single `index.ts` barrel for a feature — but the individual source files stay small.

---

## 9. Enforcement

| Rule | Enforced by |
|------|-------------|
| No `any` / no `ts-ignore` | `pnpm typecheck`, ESLint |
| Strict mode | `tsconfig.base.json` |
| Import ordering | ESLint `import/first`, `import/order` |
| No unused imports | ESLint `no-unused-vars`, `pnpm lint` |
| Formatting | Prettier + `pnpm format:check` |
| File size (soft) | Code review judgment |
| Code organization | Code review judgment |

When this document conflicts with `CLAUDE.md`, `REPOSITORY-DESIGN.md`, or an accepted ADR, the other document wins and this one should be updated to match.
