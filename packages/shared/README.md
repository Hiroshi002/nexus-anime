# @nexus/shared

Cross-feature, framework-agnostic API-contract types. This is the
documented place for types used by two or more features (Folder-Conventions
§3.4): the API envelope, error codes, and pagination primitives.

This package contains **no business logic, no domain types, no Zod schemas**.
It is infrastructure only. Domain types live in `apps/web/src/types/` until a
`@nexus/domain` package materializes.

## Exports

- `ok`, `fail`, `isOk`, `isError` — envelope helpers
- `ApiResult<T>` — `{ data } | { error }` discriminated union
- `ApiError` (class) + `ERROR_CODES` — stable error code constants
- `PaginationParams`, `Paginated<T>` — pagination primitives
