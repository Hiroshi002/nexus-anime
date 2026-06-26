# Genres — Nexus Anime

> **Audience:** Engineers, Product, Design
> **Milestone:** M4
> **Owner:** Product
> **Status:** Draft

---

## 1. Purpose

The Genres feature provides a two-level browsing experience: a genre index page showing all available genres as glass cards, and genre detail pages showing a filtered anime grid for a single genre. This is the primary discovery mechanism for users who know what type of content they want but not a specific title.

## 2. Business Goals

- Increase catalog exploration breadth — target 20% of users who visit Genres to discover at least one anime they had not seen before.
- Improve time-on-site by enabling deep genre browsing sessions; target 3+ pages per genre session.
- Support SEO traffic acquisition via indexable genre landing pages with structured data.
- Drive sign-ups by surfacing watchlist CTAs on genre detail pages (gated to authenticated users).

## 3. Functional Requirements

### 3.1 Happy Path
1. User navigates to `/genres`; system renders a grid of all active genres, each showing name, icon, and anime count.
2. User clicks a genre card (e.g. "Action"); URL updates to `/genres/action` and the view transitions to genre detail with a filtered anime grid.
3. User sorts the anime grid by popularity, rating, newest, or A-Z via sort dropdown.
4. User scrolls to load more anime via infinite scroll (24 per batch).
5. User clicks an anime card to navigate to the Anime Detail page.

### 3.2 Alternate Flows
1. User arrives via deep link `/genres/action?sort=rating`; page renders with genre pre-selected and sort pre-applied.
2. User navigates from an anime detail page genre chip (e.g. clicking "Action" chip); genre detail page renders at `/genres/action`.
3. User selects multiple genres via query params (`/genres?action&genre=fantasy`); filter bar shows both chips, grid shows anime matching all selected genres.
4. User clicks a genre card on mobile (touch); navigates directly to genre detail (no thumbnail hover reveal).

### 3.3 Edge Cases
1. Genre with 0 anime — detail page shows empty state.
2. Genre slug collision — system enforces unique slugs at DB level; lookup by slug always resolves to exactly one genre.
3. Genre with 10,000+ anime — pagination handles large result sets via cursor-based infinite scroll.

## 4. Non-Functional Requirements

- **Performance:** LCP < 2.0s for genre index; API p95 < 150ms for genre list, < 200ms for genre detail; ISR revalidate every 15 minutes.
- **Availability:** 99.9% — genre browsing is a primary navigation path.
- **Scalability:** 5k concurrentGenre page views; 100 req/s at the API layer.
- **Accessibility:** WCAG 2.2 AA; genre cards keyboard-focusable; filter bar with `role="group"`; `aria-live` announcements for filter changes.
- **Localization:** Genre names externalized for i18n; slug remains language-agnostic; anime count formatting per locale (e.g. "1,240" vs "1 240").
- **Security:** Public read (no auth); admin-only mutations for genre CRUD; Zod validation on slug params; rate-limit at 60 req/min per IP.

## 5. User Stories

- As a **visitor**, I want to browse all genres visually so that I can find anime categories that interest me.
- As a **visitor**, I want to see how many anime are in each genre so that I can gauge the depth of a category before committing.
- As a **visitor**, I want to drill into a genre and see a sortable grid of anime so that I can find something to watch within my preferred category.
- As a **logged-in user**, I want to add anime to my watchlist from the genre detail page so that I can curate my queue while browsing.
- As an **admin**, I want to create, reorder, and deactivate genres so that the taxonomy stays current and accurate.

## 6. Acceptance Criteria

- [ ] Genre index renders at `/genres` with all active genres (`is_active = true`) sorted by `sort_order`.
- [ ] Each genre card shows genre name, icon, anime count, and color accent.
- [ ] Clicking a genre card navigates to `/genres/{slug}` and renders the genre detail view.
- [ ] Genre detail page filters anime by the selected genre; supports multi-genre via query params.
- [ ] Sort dropdown offers: Popularity, Rating, Newest, A-Z; default is Popularity.
- [ ] Infinite scroll loads 24 anime per batch via cursor-based pagination.
- [ ] URL updates to reflect active filters and sort (shareable, bookmarkable).
- [ ] Empty state renders when a genre has 0 anime.
- [ ] Page revalidates every 15 minutes (ISR).
- [ ] Breadcrumb shows `Home > Genres > {Genre Name}` on detail pages.

## 7. UI Components

| Component | Responsibility | Reusable? | Package |
|-----------|---------------|-----------|---------|
| `GenresPage` | Page shell for index view with Suspense boundary | No | `apps/web` |
| `GenreDetailPage` | Page shell for detail view with Suspense boundary | No | `apps/web` |
| `GenreCard` | Glass card with icon, name, count, hover thumbnail reveal | Yes | `@nexus/ui` |
| `GenreIcon` | Colored glyph mapped to genre `color_hex` | Yes | `@nexus/ui` |
| `CountBadge` | Anime count pill on genre card | Yes | `@nexus/ui` |
| `ThumbnailReveal` | Hover-triggered poster thumbnails beneath card | Yes | `@nexus/ui` |
| `GenreFilterBar` | Active genre chips + sort dropdown + view toggle | Yes | `@nexus/ui` |
| `GenreBreadcrumb` | `Home > Genres > {Name}` navigation | Yes | `@nexus/ui` |
| `AnimeCard` | Poster, title, rating, progress — reused from catalog | Yes | `@nexus/ui` |
| `InfiniteScrollSentinel` | IntersectionObserver-based pagination trigger | Yes | `@nexus/ui` |

## 8. API Dependencies

| Endpoint | Method | Auth Required | Rate Limit | Cache |
|----------|--------|---------------|------------|-------|
| `/api/v1/genres` | GET | No | 60/min per IP | 15 min CDN |
| `/api/v1/genres/{slug}` | GET | No | 60/min per IP | 15 min CDN |
| `/api/v1/anime?genre={slug}&sort={sort}&cursor={cursor}` | GET | No | 60/min per IP | 15 min CDN |

`/api/v1/genres` returns the full list of active genres with `slug`, `name`, `icon`, `color_hex`, `anime_count`, and `sort_order`.

`/api/v1/genres/{slug}` returns genre metadata plus the first batch of anime (24 items) with a pagination cursor.

## 9. Database Dependencies

| Table / View | Operation | Index / Query Notes |
|--------------|-----------|---------------------|
| `genres` | SELECT | Index on `slug` for lookup; `is_active WHERE is_active = true` for browse; `sort_order` for ordering |
| `anime_genres` | SELECT (join) | Junction table; index on `genre_id` and `anime_id`; used for genre-to-anime mapping |
| `anime` | SELECT | Joined via `anime_genres`; filtered by `deleted_at IS NULL`; sorted by `popularity_score`, `average_rating`, `published_at`, or `title` |
| `bookmarks` | SELECT | Watchlist state per user; index on `(user_id, anime_id)` |

Anime count per genre is computed via a `COUNT` on `anime_genres` joined with `anime WHERE deleted_at IS NULL`, or read from a denormalized `anime_count` column on `genres` if available.

## 10. Edge Cases

1. **Genre with 0 anime:** Detail page renders an empty state with message "No titles in this genre yet." and a CTA linking back to the genre index.
2. **Genre slug collision:** Enforced by `uq_genres_slug` unique constraint at DB level; the system SHALL never encounter duplicates. If a second genre with the same slug is inserted, the DB rejects it.
3. **Genre with 10,000+ anime:** Cursor-based pagination ensures no unbounded result sets; each batch is 24 items. DB query uses `LIMIT 25` (fetch one extra to detect `hasNext`).
4. **Genre deactivated between index fetch and detail click:** Detail page returns 404 with "This genre is no longer available." message and CTA to browse all genres.
5. **Multi-genre filter with no overlapping anime:** Empty state renders "No anime match these filters." with a "Clear all filters" CTA.
6. **Anime count stale after bulk import:** If `anime_count` is denormalized, it SHALL be recalculated by a background job or trigger; stale counts are acceptable within the 15-min ISR window.
7. **Genre with only soft-deleted anime:** `anime_count` SHALL exclude `deleted_at IS NOT NULL` rows; zero-count genres render the empty state.

## 11. Error Handling

| Error Condition | User-Facing Message | Recovery Action | Log Level |
|-----------------|---------------------|-----------------|-----------|
| Genre index API 500 | "Something went wrong loading genres." | Retry button (primary) | error |
| Genre detail API 404 | "This genre doesn't exist." | CTA "Browse all genres" | warn |
| Anime grid fetch fails during infinite scroll | Toast: "Could not load more anime." | Inline "Retry" link at scroll sentinel | error |
| Sort/filter change fails | Grid retains previous data; toast: "Couldn't apply filter." | User can retry filter change | error |
| Genre count badge fetch fails | Genre card renders without count; badge shows "—" | No blocking UI; background retry | warn |

## 12. Analytics Events

| Event Name | Trigger | Properties | Surface |
|------------|---------|------------|---------|
| `genre_index_view` | `/genres` page mount | `{ total_genres_visible }` | Client |
| `genre_card_click` | Genre card clicked | `{ genre_slug, genre_name, anime_count }` | Client |
| `genre_detail_view` | `/genres/{slug}` page mount | `{ genre_slug, sort, filter_genres }` | Client |
| `genre_filter_change` | Genre chip toggled | `{ action: "add" | "remove", genre_slug }` | Client |
| `genre_sort_change` | Sort dropdown value changed | `{ sort_value }` | Client |
| `genre_anime_click` | Anime card clicked from genre detail | `{ anime_id, genre_slug, position }` | Client |

## 13. Security Considerations

- Zod validation on `slug` path parameter — reject slugs containing `/`, `..`, or characters outside `[a-z0-9-]`; return 400 on mismatch.
- Rate limit all genre endpoints at 60 req/min per IP to prevent catalog scraping.
- No PII on genre pages (public, unauthenticated read).
- Admin genre mutations require admin session; CSRF protection via SameSite cookies.
- CSP: genre-specific `color_hex` values rendered as inline styles SHALL be validated against a hex pattern (`^#[0-9A-Fa-f]{6}$`) at render time to prevent style injection.
- SQL injection mitigated via Drizzle parameterized queries.
- OWASP A05 (Security Misconfiguration): genre API routes MUST NOT expose stack traces or internal IDs in error responses.

## 14. Performance Requirements

- **LCP** < 2.0s on 4G; genre index is a small payload (~30 cards) that renders in first paint.
- **FID** < 100ms; genre card clicks are client-side transitions (no full page reload).
- **API p95** < 150ms for genre list; < 200ms for genre detail with anime grid.
- **DB query p95** < 50ms for genre list; < 80ms for genre detail (joins via indexed `anime_genres`).
- **ISR** revalidate = 900 (15 minutes); genres rarely change so long TTL is appropriate.
- **Rendering strategy:** ISR for genre index and genre detail. `<Suspense>` boundary wraps the anime grid in detail view; genre index renders eagerly (small payload). Per-section streaming for detail page: genre header renders first, anime grid streams in.
- **Bundle-size budget:** < 20 KB client JS for genre index route; < 30 KB for genre detail route (includes `AnimeCard` grid).

## 15. Future Improvements

1. Per-genre landing page with curated hero banner, editorial description, and "Staff Picks" row.
2. Genre-based recommendation row: "Because you like Action" at the bottom of genre detail.
3. Genre map visualization — force-directed node graph showing genre overlap (e.g. Action and Thriller) as an alternate view mode.
4. Custom genre collections — authenticated users build personal genre collections (e.g. "Shonen essentials") with shareable permalinks.
5. Genre-following — users subscribe to a genre for notification when new anime is added to it.
