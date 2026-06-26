# Record Architecture Decisions

We capture significant architecture decisions as [ADRs](https://adr.github.io/) using the format from [Michael Nygard's template](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

## Format

Each ADR is a file `NNN-title.md` containing:

- **Status** — proposed | accepted | deprecated | superseded
- **Context** — the forces at play (technical, organizational, constraints)
- **Decision** — what we decided
- **Consequences** — what becomes easier or harder as a result

## Immutability

ADRs are immutable records. When a decision is reversed or evolved, write a new ADR that links back to the old one and updates the old ADR's status to `superseded`. Do not edit an accepted ADR's decision section — that erases history.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| 001 | [Modular monolith with Next.js App Router](001-modular-monolith-nextjs.md) | accepted |
| 002 | [State Management Strategy](../../15-decisions/ADR-002-State-Management.md) | accepted |
| 003 | [Tailwind CSS 4 with Semantic Theme Tokens](../../15-decisions/ADR-003-Styling.md) | accepted |
| 004 | [Turborepo + pnpm Workspaces](../../15-decisions/ADR-004-Monorepo.md) | accepted |
| 005 | [Server Actions + Route Handlers API Strategy](../../15-decisions/ADR-005-API-Strategy.md) | accepted |

## How to propose a new ADR

1. Copy the [ADR Template](../../15-decisions/ADR-Template.md) and increment the number.
2. Set status to `proposed`.
3. Open a PR titled `adr(NNN): <short title>`.
4. Address review feedback; once accepted, change status to `accepted`.
5. Add the new ADR to the index above and to `docs/README.md`.
