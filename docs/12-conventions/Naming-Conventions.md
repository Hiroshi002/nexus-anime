# Naming Conventions — Nexus Anime

> **Audience:** Everyone who writes, reads, or reviews code in this repo.
> **Status:** Accepted. Enforced by ESLint where tool-supported; by code review otherwise. Changes are proposed via PR against this file.
> **Related:** [Coding Standards](./Coding-Standards.md) · [Folder Conventions](./Folder-Conventions.md) · [Git Workflow](./Git-Workflow.md) · [Repository Design](../../REPOSITORY-DESIGN.md)

Naming is a communication protocol between your present self and every future reader. Good names make wrong code look wrong and right code easy to navigate. This document is the single source of truth for how we name things — when in doubt, check here rather than guessing.

---

## Principles (all sections inherit these)

1. **Names are searchable.** Prefer unique, distinctive names over generic ones so `grep` and IDE "find references" return only what you need. `getAnimeBySlug` is searchable; `getData` is not.
2. **Names are pronounceable.** If you cannot say it out loud in a code review, rename it.
3. **Names are honest.** `tmp`, `data2`, `processedResult` carry no meaning. Replace them with the domain concept they represent.
4. **One name, one concept.** Do not use `load`, `fetch`, and `get` interchangeably. Pick one per action type and use it consistently across the codebase.

---

## 1. Files

Files are the top-level organizing unit. The reader should guess a file's contents correctly from its name alone.

### 1.1 Cases by file kind

| Kind                   | Convention                 | Example                              |
| ---------------------- | -------------------------- | ------------------------------------ |
| React **component**    | PascalCase                 | `AnimeCard.tsx`                      |
| React **hook** (file)  | camelCase, `use*` prefix   | `useWatchlist.ts`                    |
| Service / logic module | kebab-case                 | `format-date.ts`, `anime-service.ts` |
| Route handler / action | kebab-case (matches route) | `route.ts` inside `app/anime/[slug]` |
| Zod schema module      | kebab-case                 | `anime-schema.ts`                    |
| Type module            | kebab-case                 | `anime-types.ts`                     |
| Test file              | `<source>.test.ts(x)`      | `format-date.test.ts`                |
| Barrel / index         | `index.ts`                 | `components/index.ts`                |
| Config files           | lowercase, tool name       | `next.config.ts`, `turbo.json`       |
| Migration (Drizzle)    | `NNNN_description.sql`     | `0001_create_anime.sql`              |

### 1.2 Rules (R)

- Component files are `PascalCase.tsx`. The file name must match the default-exported component name: `AnimeCard.tsx` exports `AnimeCard`, never `animeCard`.
- Hook files start with `use` in camelCase: `useWatchlist.ts`, not `UseWatchlist.ts` or `watchlist.ts`.
- Shared utility files are `kebab-case.ts`: `format-date.ts`, `parse-genre.ts`.
- Avoid filename duplication with the directory name unless it improves clarity. A `catalog/` directory containing `catalog.ts` is acceptable; a generic `utils/util.ts` is not.

---

## 2. Variables & Identifiers

### 2.1 camelCase for all runtime bindings (R)

```ts
const animeList = await fetchAnimeList();
const isAuthorized = user.role === "admin";
const watchProgress = progressByEpisode.get(episodeId);
```

### 2.2 Meaningful, not cryptic (G)

Avoid single-letter names except for loop indices (`i`, `j`) or well-known mathematical symbols in their original context (`x`, `y` for coordinates). Avoid number-suffixed names (`data1`, `data2`) — they are a readability bug.

```ts
// Wrong
const d = await getAnime(id);
const d2 = transform(d);

// Right
const anime = await getAnime(id);
const cardModel = toCardModel(anime);
```

### 2.3 Booleans read as questions (P)

Use prefixes that read naturally in conditionals:

```ts
const isAuthenticated = user != null;
const hasEpisodes = anime.episodeCount > 0;
const canEdit = session.user.id === anime.createdBy;
const shouldPrefetch = isInViewport && !isLoading;
```

Avoid negated prefixes (`isNotReady`, `hasNoResults`) — they introduce a cognitive double-negative. Use the positive form and invert at the call site.

### 2.4 Constants — SCREAMING_SNAKE_CASE (R)

Apply to module-level, **genuinely constant** values: fixed sizes, magic numbers with domain meaning, cache TTLs, limits.

```ts
const MAX_RETRIES = 3;
const DEFAULT_PAGE_SIZE = 20;
const CACHE_TTL_CATALOG = 900; // seconds
const VALID_STATUSES = ["airing", "finished", "upcoming"] as const;
const MATCH_ANIME_SLUG = /^[a-z0-9-]{1,120}$/;
```

Do **not** mark every `const` as SCREAMING*SNAKE_CASE. A constant whose value is a configuration object or a regex that changes occasionally evokes the wrong signal — reserve the convention for values that are conceptually \_never reassigned and never iterated*. When in doubt, plain camelCase with a short comment describing the value is clearer.

### 2.5 Event handlers (P)

Prefix with `handle` (field) and `on` (prop):

```tsx
// Inside the component — handle*
const handleSubmit = async (e: React.FormEvent) => { ... };

// Passed as a prop — on*
<Form onSubmit={handleSubmit} />;
<Button onClick={() => onWatchlistToggle(anime.id)} />;
```

---

## 3. Types & Interfaces

### 3.1 PascalCase, no prefix, no suffix (R)

```ts
// Wrong
type AnimeType = { ... };
interface IAnime { ... }
interface AnimeModel { ... }
type CreateAnimeDTO = { ... };

// Right
type Anime = { ... };
type AnimeUpdate = { ... };
type CreateAnimeInput = { ... };
```

Drop the `I` prefix (a C# convention), the `Type`/`Model`/`DTO` suffixes, and any other flavor-of-the-framework decoration. The name should read as the domain concept, not as the architectural layer it came from.

### 3.2 Prefer `type` over `interface` unless you need declaration merging (P)

```ts
// Default: type
type Anime = { id: number; slug: string; title: string };

// Interface: only when extension via merging matters
interface AuthSession extends DefaultSession {
  role: "user" | "admin";
}
```

### 3.3 Discriminant-aware naming for state unions (P)

Name the union for the whole state, the discriminant (`status`, `kind`, `phase`), and the variant as a noun:

```ts
type VideoState = // the whole state
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error"; message: string };

type FetchResult<T> = { kind: "ok"; value: T } | { kind: "err"; error: ApiError };
```

### 3.4 Generic type parameter names (G)

Use single uppercase letters (`T`, `U`, `K`) only when the parameter is truly abstract. When the parameter represents a domain concept, name it:

```ts
// Abstract — T is fine
function first<T>(items: T[]): T | undefined;

// Domain-specific — name it
function groupBy<Anime>(items: Anime[], key: keyof Anime): Map<string, Anime[]>;
```

---

## 4. Functions & Methods

### 4.1 Verb prefix (R)

Every function does something — its name starts with the action:

| Prefix                              | Meaning                                               | Example                                    |
| ----------------------------------- | ----------------------------------------------------- | ------------------------------------------ |
| `get`                               | synchronous or cached lookup, may throw               | `getAnimeBySlug(slug)`                     |
| `fetch`                             | async call to a remote source, may fail               | `fetchAnime(slug)`                         |
| `find`                              | lookup that may return null/undefined                 | `findSession(token)`                       |
| `create`                            | builds and persists a new entity                      | `createWatchlist(input)`                   |
| `update`                            | mutates an existing entity                            | `updateAnime(id, patch)`                   |
| `delete` / `remove`                 | removes a record / removes from a set                 | `removeFromWatchlist(...)`                 |
| `toggle`                            | flips a boolean or membership                         | `toggleWatchlist(animeId)`                 |
| `is` / `has` / `can`                | returns a boolean                                     | `isAuthorized(user)`                       |
| `should`                            | declarative boolean for UI decisions                  | `shouldPrefetch(props)`                    |
| `build` / `to` / `format` / `parse` | pure transformation                                   | `buildCacheKey(...)`, `toCardModel(anime)` |
| `with`                              | returns a decorated copy                              | `withAuth(handler)`                        |
| `assert`                            | throws on failure                                     | `assertValid(input, schema)`               |
| `require`                           | throws with a domain-specific missing-context message | `requireUser()`                            |

### 4.2 Distinguish "get" vs "fetch" vs "find" (P)

- `get` — synchronous, expecting the value to exist (throws/returns null on miss).
- `fetch` — **always async**, implies a remote call, may fail with network/library errors.
- `find` — lookup that returns `null` on miss (as opposed to `get` which may throw).

Mixing these up silently hides the behavior — if you rename `fetch` to `get`, the reader may no longer realize an async call is happening.

### 4.3 Function names match their contract (R)

- A function named `isX` returns a boolean.
- A function named `getX` does **not** mutate anything.
- A function named `createX` returns the created entity.

```ts
// Wrong — "find" implies a pure lookup, but this persists
async function findAnime(slug: string) {
  const hit = await getCached(slug);
  if (hit) return hit;
  const fetched = await fetchAnime(slug);
  await setCached(slug, fetched);   // hidden side effect
  return fetched;
}

// Right — contracts match names
async function fetchAnime(slug: string): Promise<Anime> { ... }   // remote
async function getCachedAnime(slug: string): Promise<Anime | null> { ... } // local
```

---

## 5. Database & Schema

### 5.1 snake_case for columns and tables (R)

Drizzle columns, Postgres table names, and migration identifiers use lower snake_case:

```ts
// packages/db/src/schema/anime.ts
export const anime = pgTable("anime", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  synopsis: text("synopsis"),
  episodeCount: integer("episode_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});
```

Even though TS uses camelCase for property access, the column **names** in the schema definition are snake_case — this is the canonical Postgres convention and keeps migrations and TS names consistent.

### 5.2 Domain objects stay camelCase (R)

The TS object returned by a query uses camelCase. Map explicitly if needed — the schema handles this with Drizzle's default column naming, which lets you write `anime.episodeCount` while the underlying column is `episode_count`.

### 5.3 Foreign key column names (P)

Foreign keys follow `<entity>_id`:

```ts
userId: integer("user_id").references(() => users.id),
animeId: integer("anime_id").references(() => anime.id),
```

Plural table, singular column suffix.

### 5.4 Migration files (R)

`NNNN_short_description.sql`, zero-padded to 4 digits, sequential:

```
packages/db/src/migrations/
├── 0001_create_anime.sql
├── 0002_create_user.sql
├── 0003_create_watchlist.sql
└── 0004_add_anime_episode_count.sql
```

---

## 6. API & Routes

### 6.1 URL paths use kebab-case (R)

```ts
// app/api/anime-catalog/route.ts
// app/api/watch-history/route.ts
// app/api/continue-watching/route.ts
```

Path readability and SEO-friendliness drive this; hyphens are unambiguously separators in URLs whereas underscores can collide with underlining in some renderers.

### 6.2 Route handlers & params use camelCase in TS (R)

```ts
export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }, // TS camelCase
) {
  // ...
}
```

The URL contains `some-slug`; the TS binding is `params.slug`.

### 6.3 Error codes are SCREAMING_SNAKE_CASE (R)

Stable, machine-readable, concise:

```ts
"UNAUTHORIZED"; // not logged in
"FORBIDDEN"; // logged in, wrong permission
"NOT_FOUND"; // entity does not exist
"RATE_LIMITED"; // too many requests
"BAD_REQUEST"; // malformed input (validation details in `details`)
"INTERNAL"; // catch-all for server errors (never expose details)
```

Avoid prefixing with `ERROR_` or `ERR_` — `code: "NOT_FOUND"` reads cleaner than `code: "ERR_NOT_FOUND"`.

---

## 7. CSS & Tailwind

### 7.1 No custom class naming convention (R)

Tailwind is utility-first. We do not hand-roll BEM, SMACSS, or any other class naming convention for component styles. Styles live as className strings or, when the recipe is reused across features, in `@nexus/ui` components.

```tsx
// Utility classes — className is the contract
<article className="rounded-xl border border-border bg-card p-4 backdrop-blur">
```

### 7.2 Semantic tokens from `@nexus/ui` (R)

Use semantic utility tokens (those derived from the theme's `@theme` block) over raw values. The canonical names come from the theme and are summarized in both `Coding-Standards.md §3` and `@nexus/ui/src/styles/tokens.css`.

| Token pattern                               | Meaning                      |
| ------------------------------------------- | ---------------------------- |
| `text-foreground` / `text-muted-foreground` | primary / secondary text     |
| `bg-background` / `bg-card` / `bg-muted`    | surfaces                     |
| `border-border` / `border-input`            | default / input borders      |
| `text-accent` / `bg-accent`                 | primary accent (interactive) |

### 3rd-party UI library class overrides (G)

When overriding shadcn/ui primitives, scope overrides to the feature and document the rationale. Do not mutate shared component internals in `@nexus/ui` to suit a single view — extend or compose instead.

---

## 8. Cache Keys & Redis

### 8.1 `nexus:{entity}:{id}:{view}` (R)

All cache-readable keys follow the canonical pattern:

```
nexus:{entity}:{id}:{view}
```

Where:

- `entity` — the domain concept (`anime`, `episode`, `user`, `trending`) in kebab-case.
- `id` — the primary identifier of the owned object (numeric id, slug, or a signed hash for secrets). Use numeric IDs unless the lookup is by slug — and if by slug, use the slug: `nexus:anime:{slug}:detail`.
- `view` — the projection or query shape (`detail`, `card`, `list`, `ranked`).

```ts
buildCacheKey("anime", anime.id, "detail"); // nexus:anime:1234:detail
buildCacheKey("anime", anime.slug, "detail"); // nexus:anime:chainsaw-man:detail
buildCacheKey("trending", "global", "ranked"); // nexus:trending:global:ranked
buildCacheKey("user", user.id, "watchlist"); // nexus:user:42:watchlist
```

### 8.2 Helper construction (P)

Do **not** template cache keys inline. Always build them through a shared helper so the convention lives in one place:

```ts
// packages/cache/src/keys.ts
export function buildCacheKey(entity: string, id: string | number, view: string): string {
  return `nexus:${entity}:${id}:${view}`;
}
```

If the pattern needs to evolve (adding a tenant id, a version, a region), it changes in one place.

### 8.3 TTL constants (P)

Pair keys with named TTL constants. Volatile data short (60s), catalog longer (15 min), feature flags with a documented fail-open default.

---

## 9. Tests

### 9.1 File names (R)

- Unit tests: `<source>.test.ts` or `<source>.test.tsx`, colocated with the source (see [Folder Conventions](./Folder-Conventions.md)).
- Integration / e2e tests: under a `tests/` or `e2e/` directory as your test framework requires.

### 9.2 Test descriptions read as sentences (P)

Start with the action and the expected outcome:

```ts
describe("buildCacheKey", () => {
  it("joins entity, id, and view with colons", () => {
    expect(buildCacheKey("anime", 42, "detail")).toBe("nexus:anime:42:detail");
  });

  it("rejects keys with invalid characters", () => {
    expect(() => buildCacheKey("anime", "a b", "detail")).toThrow();
  });
});
```

---

## 10. Anti-patterns — summary

| Anti-pattern                      | Fix                                                 |
| --------------------------------- | --------------------------------------------------- |
| `data`, `tmp`, `result2`          | What is it? Name it.                                |
| `processStuff`, `doThings`        | What action? On what? Use verb-noun.                |
| Mixed `load`/`fetch`/`get`        | Pick one per action, use consistently.              |
| `AnimeType`, `IAnime`, `AnimeDTO` | `Anime`.                                            |
| `UserID`, `UserName`              | camelCase: `userId`, `userName`.                    |
| `nexus:Anime:42:Detail`           | snake-or-kebab, lowercase: `nexus:anime:42:detail`. |
| `on_click`, `on_change` (TS)      | `onClick` (TS camelCase).                           |

When the document is unclear, the principle of **searchable, pronounceable, honest** breaks the tie. Document the choice in a comment if it could be debated.
