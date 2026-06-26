# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Repository scaffold with Turborepo monorepo layout (`apps/`, `packages/`, `tooling/`, `docs/`).
- Next.js 16 (`apps/web`) deployable with React 19.
- Design system package (`@nexus/ui`) scaffold.
- Database package (`@nexus/db`) placeholder for Drizzle ORM + Neon Postgres.
- Cache package (`@nexus/cache`) placeholder for Upstash Redis.
- Shared ESLint config package (`@nexus/eslint-config`).
- Local dev infrastructure: Docker Compose for Postgres, Redis, Mailpit (`tooling/docker/`).
- Seed scripts for admin, anime, and catalog data (`tooling/scripts/`).
- CI workflow (lint, typecheck, test, build, format:check) and Release workflow (tag → GitHub Release).
- Issue templates (bug report, feature request) and PR template.
- Repository constitution (`docs/REPOSITORY-DESIGN.md`) covering all 28 initialization deliverables.
- Master roadmap, milestone specs (M0, M1), and ADR index.

### Changed

- N/A.

### Deprecated

- N/A.

### Removed

- N/A.

### Fixed

- N/A.

### Security

- N/A.

---

## [0.1.0] — 2026-06-26

### Added

- Initial repository initialization (Step 1 + Step 2 foundation files).

[Unreleased]: https://github.com/OWNER/nexus-anime/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/OWNER/nexus-anime/releases/tag/v0.1.0
