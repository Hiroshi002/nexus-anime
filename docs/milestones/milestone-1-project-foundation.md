# M1 — Project Foundation

## Goal

Establish the monorepo, design system primitives, and local dev infrastructure so that every later milestone builds on a stable, well-structured base.

## Scope

- Turborepo + pnpm workspace (root `package.json`, `pnpm-workspace.yaml`, `turbo.json`)
- `@nexus/ui` component library (shadcn/ui-based primitives, theme tokens)
- Local docker-compose (Postgres, Redis, Mailpit) for backing services
- CI pipeline (lint, typecheck, test, build)
- Repository conventions documented in `docs/REPOSITORY-DESIGN.md`

## Done criteria

- [ ] `pnpm install` succeeds from a clean clone
- [ ] `pnpm dev` starts the web app
- [ ] Design system showcase renders at `/dev/components`
- [ ] CI is green on `main` (lint, typecheck, test, build, format:check)
- [ ] `pnpm docker:up` brings up Postgres, Redis, Mailpit

## Status

✅ Complete.
