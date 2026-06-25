# M3.5 — RBAC & Permission Strategy

> Defines the platform's role-based access control model: role hierarchy, permission matrix, guard surface, route-projection rules, audit policy, and the future ABAC migration path.

## 1. Scope & Scope Decisions

### 1.1 In scope
- Role hierarchy and capability matrix
- `users.role` ENUM migration policy
- `permissions` table seed data and single-source-of-truth designation
- Guard surface (`requireAuth`, `requireSubscriber`, `requireRole`, `requireOwner`, `requirePermission`)
- Route → permission mapping
- Admin UI surface for role assignment
- Audit logging for role changes and permission-denied events
- Future ABAC migration path

### 1.2 Out of scope (owned by other docs)
| Concern | Owner |
|---------|-------|
| Auth flows, password reset, MFA | M2.7 Authentication Architecture |
| JWT structure, refresh, revocation | M3.3 Session & Token Strategy |
| OAuth provider details, account linking | M3.4 OAuth Provider Strategy |
| `users` table schema | M3.2 User Domain Design |
| Subscription billing mechanics | Billing Domain (M3.S5) |
| Trust boundaries, CSRF, CORS, rate limiting | M2.7 §6–7 |

### 1.3 Cross-references
- `architecture/authentication-architecture.md` (M2.7) — RBAC overview, guards, route matrix
- `architecture/session-strategy.md` (M3.3) — JWT claims (`role` claim injection)
- `architecture/oauth-strategy.md` (M3.4) — OAuth account linking audit events
- `user-domain-design.md` (M3.2) — `users.role` ENUM, `permissions` table seed
- `master-roadmap.md` §3.6 — Security architecture summary

---

## 2. Roles

### 2.1 Hierarchy

```
superadmin
  └── admin
        └── user
              └── guest (anonymous, no session)
```

Higher roles inherit all capabilities of roles below them. Inheritance is **implicit via the guard layer**, not stored in a table.

### 2.2 Role definitions

| Role | ENUM value | Description |
|------|-----------|-------------|
| `guest` | *(no row / public)* | Unauthenticated visitor. Can browse the public catalog, view login/register pages. |
| `user` | `'user'` | Authenticated subscriber. Manages own profile, library, watchlist, favorites, reviews. |
| `premium` | `'premium'` | *(post-MVP)* Subscriber on Resonance tier. Unlocks higher concurrent-session limits and premium-only content. |
| `moderator` | `'moderator'` | Community steward. Can delete any comment, delete any review. Cannot manage titles or users. |
| `admin` | `'admin'` | Content operator. Full CMS access (titles, episodes, shelves), analytics read, user management (read/update/suspend). Cannot assign roles. |
| `superadmin` | `'superadmin'` | Platform owner. Role assignment, user suspension, system configuration. |

### 2.3 PostgreSQL ENUM definition

```sql
CREATE TYPE user_role AS ENUM ('user', 'premium', 'moderator', 'admin', 'superadmin');
```

`guest` is represented by the absence of a session — there is no `'guest'` ENUM value.

**Migration policy:** Adding a new role requires `ALTER TYPE user_role ADD VALUE 'new_role';`. This is a metadata-only operation in PostgreSQL (no table rewrite) but requires an exclusive lock on the type. Run during a maintenance window for the first role addition; subsequent additions are cheap. Document the new role in the "Roles added after MVP" table below.

### 2.4 Roles added after MVP

| Role | Added in | Migration |
|------|----------|-----------|
| `premium` | Post-MVP (M4 Revenue) | `ALTER TYPE user_role ADD VALUE 'premium';` |
| `moderator` | Post-MVP (M6 Feature) | `ALTER TYPE user_role ADD VALUE 'moderator';` |

---

## 3. Permission Matrix

### 3.1 Seed permissions

| Permission slug | Description | Roles granted |
|-----------------|-------------|---------------|
| `title:create` | Create a new title in the CMS | `admin`, `superadmin` |
| `title:update` | Update title metadata | `admin`, `superadmin` |
| `title:delete` | Soft-delete a title | `admin`, `superadmin` |
| `episode:create` | Create an episode under a title | `admin`, `superadmin` |
| `episode:update` | Update episode metadata or assets | `admin`, `superadmin` |
| `episode:delete` | Soft-delete an episode | `admin`, `superadmin` |
| `user:read` | Read public user profile | `user`, `premium`, `moderator`, `admin`, `superadmin` |
| `user:update` | Update own profile | `user`, `premium`, `moderator`, `admin`, `superadmin` |
| `user:manage` | Read/update any user | `admin`, `superadmin` |
| `user:suspend` | Suspend or ban a user | `superadmin` |
| `role:assign` | Change a user's role | `superadmin` |
| `analytics:read` | View analytics dashboards | `admin`, `superadmin` |
| `shelf:manage` | Create/update/delete shelves | `admin`, `superadmin` |
| `comment:delete_any` | Delete any comment | `moderator`, `admin`, `superadmin` |
| `review:delete_any` | Delete any review | `moderator`, `admin`, `superadmin` |

### 3.2 Single source of truth

The `permissions` table in the database (`M3.2 §3.4`) is **documentation and audit only** in MVP. The authoritative mapping of role → permission is enforced in application code in `@nexus/auth/guards.ts`. The `permissions` table must stay in sync with the in-code map; a CI check (see §6.3) enforces this.

### 3.3 Permission slug format

All slugs follow `{resource}:{action}` or `{resource}:{action}_{qualifier}`. New permissions must follow the same pattern. Examples: `title:create`, `comment:delete_any`.

---

## 4. Role Hierarchy & Permission Resolution

### 4.1 Resolution algorithm

```
function can(role, permission): boolean
    if role == 'superadmin':        return true          // wildcard
    if role == 'admin':             return ADMIN_PERMISSIONS.has(permission)
    if role == 'moderator':         return MOD_PERMISSIONS.has(permission)
    if role == 'premium':           return PREMIUM_PERMISSIONS.has(permission)
    if role == 'user':              return USER_PERMISSIONS.has(permission)
    /* guest */                     return false
```

`superadmin` is a wildcard — it short-circuits before consulting any map. This is enforced in `requireRole` and must be preserved in any future `requirePermission` implementation.

### 4.2 No `role_permissions` table (MVP deliberate choice)

The MVP intentionally avoids a `role_permissions` junction table. Rationale:
- 6 roles × 16 permissions = 96 cells. The matrix is small enough to live in code.
- Avoids N+1 queries on every request to resolve role → permissions.
- The `permissions` table exists as a stable identifier set for audit log references and future ABAC migration.

### 4.3 When to introduce `role_permissions`

Trigger conditions (any one):
- Role count exceeds 10.
- Permission count exceeds 40.
- A single role needs more than 25 permissions.
- Ops team needs to grant/revoke permissions without a code deploy.

When triggered, migrate via:
1. Create `role_permissions(role, permission)` table with FK to `permissions.slug`.
2. Populate from the in-code map.
3. `requirePermission` resolves via DB (cached in Redis, 5-min TTL).
4. Keep the in-code map as a fallback for the transition period.

---

## 5. Access Control Rules (Guard Surface)

### 5.1 Guard inventory

| Guard | File | Behavior |
|-------|------|----------|
| `requireAuth` | `@nexus/auth/guards.ts` | 401 if no valid session |
| `requireSubscriber` | `@nexus/auth/guards.ts` | 403 if no active subscription (reads Redis `v1:subscription:{userId}`) |
| `requireRole(...roles)` | `@nexus/auth/guards.ts` | 403 if `users.role` is not in the allowed set |
| `requireOwner(getResourceOwnerId)` | `@nexus/auth/guards.ts` | 403 if `session.userId !== resourceOwnerId` (admin bypass) |
| `requirePermission(slug)` | `@nexus/auth/guards.ts` *(new)* | 403 if role lacks the permission per §4.1 |

### 5.2 `requirePermission` design

```typescript
// src/auth/guards.ts

const ROLE_PERMISSIONS: Record<UserRole, Set<string>> = {
  user: new Set(['user:read', 'user:update']),
  premium: new Set(['user:read', 'user:update']),
  moderator: new Set([
    'user:read', 'user:update',
    'comment:delete_any', 'review:delete_any',
  ]),
  admin: new Set([
    'user:read', 'user:update', 'user:manage',
    'title:create', 'title:update', 'title:delete',
    'episode:create', 'episode:update', 'episode:delete',
    'analytics:read', 'shelf:manage',
    'comment:delete_any', 'review:delete_any',
  ]),
  superadmin: new Set(), // wildcard — never checked against the set
}

export function requirePermission(slug: string) {
  return async (ctx: RequestContext): Promise<void> => {
    const role = ctx.session?.role
    if (!role) throw new ForbiddenError('No role in session')
    if (role === 'superadmin') return
    if (!ROLE_PERMISSIONS[role].has(slug)) {
      auditLog.denied({ userId: ctx.session.userId, permission: slug })
      throw new ForbiddenError(`Missing permission: ${slug}`)
    }
  }
}
```

### 5.3 Guard composition

Guards compose left-to-right. Order matters — fail fast on cheapest checks first:

```
requireAuth → requireSubscriber → requirePermission → requireOwner
```

Example — delete a comment (moderator+ only):

```typescript
router.delete(
  '/api/v1/comments/:id',
  requireAuth,
  requirePermission('comment:delete_any'),
  deleteCommentHandler,
)
```

Example — update own profile:

```typescript
router.patch(
  '/api/v1/nexus/profile',
  requireAuth,
  requirePermission('user:update'),
  updateProfileHandler,
)
```

### 5.4 Admin bypass

`superadmin` bypasses `requireOwner` automatically (existing behavior). It also short-circuits `requirePermission` (returns immediately without consulting the map). Do NOT change this invariant without updating this doc.

---

## 6. Route → Permission Mapping

### 6.1 API routes

| Route | Guard chain | Permission |
|-------|-------------|------------|
| `GET /api/v1/titles` | `requireAuth` (public catalog: none) | — (public) |
| `POST /api/v1/titles` | `requireAuth` + `requirePermission('title:create')` | `title:create` |
| `PATCH /api/v1/titles/:id` | `requireAuth` + `requirePermission('title:update')` | `title:update` |
| `DELETE /api/v1/titles/:id` | `requireAuth` + `requirePermission('title:delete')` | `title:delete` |
| `POST /api/v1/titles/:id/episodes` | `requireAuth` + `requirePermission('episode:create')` | `episode:create` |
| `PATCH /api/v1/episodes/:id` | `requireAuth` + `requirePermission('episode:update')` | `episode:update` |
| `DELETE /api/v1/episodes/:id` | `requireAuth` + `requirePermission('episode:delete')` | `episode:delete` |
| `GET /api/v1/nexus/profile` | `requireAuth` | `user:read` |
| `PATCH /api/v1/nexus/profile` | `requireAuth` | `user:update` |
| `GET /api/v1/nexus/watch/:id` | `requireAuth` + `requireSubscriber` | — (subscription-gated) |
| `GET /api/v1/admin/users` | `requireAuth` + `requireRole('admin')` | `user:manage` |
| `POST /api/v1/admin/users/:id/suspend` | `requireAuth` + `requireRole('superadmin')` | `user:suspend` |
| `POST /api/v1/admin/users/:id/role` | `requireAuth` + `requireRole('superadmin')` | `role:assign` |
| `GET /api/v1/admin/analytics` | `requireAuth` + `requireRole('admin')` | `analytics:read` |
| `DELETE /api/v1/comments/:id` | `requireAuth` + `requirePermission('comment:delete_any')` | `comment:delete_any` |
| `DELETE /api/v1/reviews/:id` | `requireAuth` + `requirePermission('review:delete_any')` | `review:delete_any` |

### 6.2 Page routes (middleware)

| Page | Guard |
|------|-------|
| `/nexus/watch/*` | `requireSubscriber` |
| `/nexus/library/*` | `requireAuth` |
| `/admin/*` | `requireRole('admin')` + `X-API-Key` header |

### 6.3 Sync enforcement

A CI job (`scripts/check-rbac-sync.mjs`) must:
1. Parse the route table in `src/routes/**` for `requirePermission(...)` calls.
2. Parse the `ROLE_PERMISSIONS` map in `src/auth/guards.ts`.
3. Assert every slug used in a route appears in at least one role's permission set.
4. Assert every permission in the `permissions` table seed appears in `ROLE_PERMISSIONS`.
5. Fail the build on drift.

---

## 7. Admin UI Surface

### 7.1 Role assignment (superadmin only)

- `POST /api/v1/admin/users/:id/role` — body: `{ role: UserRole }`. Guarded by `requireRole('superadmin')`.
- Audit log entry: `{ actorId, targetId, fromRole, toRole, timestamp }`.

### 7.2 Permission display

- `GET /api/v1/admin/permissions` — returns the full permission matrix. Guarded by `requireRole('admin')`.
- Used by admin UI to render "What can this role do?" panels.

### 7.3 Suspension

- `POST /api/v1/admin/users/:id/suspend` — body: `{ reason: string }`. Guarded by `requireRole('superadmin')`.
- Sets `users.is_suspended = true`, `suspension_reason`, `suspended_at`.
- All subsequent login attempts return 403 with `ACCOUNT_SUSPENDED`.

---

## 8. Audit Logging

### 8.1 Events to audit

| Event | Payload | Retention |
|-------|---------|-----------|
| `role.changed` | `{ actorId, targetId, fromRole, toRole }` | 1 year |
| `permission.denied` | `{ userId, permission, route, ip }` | 90 days |
| `user.suspended` | `{ actorId, targetId, reason }` | 1 year |
| `user.unsuspended` | `{ actorId, targetId }` | 1 year |

### 8.2 Storage

Write to `audit_logs` table (existing from M2.7 §8). Do NOT write to Redis — audit logs must be durable.

---

## 9. Future ABAC Migration Path

M2.7 §10.5 defers attribute-based access control to post-MVP. The `permissions` table and slug format are the seed. Migration triggers are listed in §4.3. When triggered:

1. Introduce `role_permissions` table (see §4.3).
2. Add `user_attributes` JSONB column for per-user overrides (e.g., region restrictions, beta-group membership).
3. `requirePermission` evolves to `requirePermission(slug, context)` where context carries request attributes.
4. Policy engine (e.g., OPA or a lightweight rules evaluator) replaces the in-code `ROLE_PERMISSIONS` map.

Until then, the in-code map is authoritative.

---

## 10. Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-25 | Initial spec — formalizes roles, permission matrix, guards, route mapping, audit, ABAC path |
