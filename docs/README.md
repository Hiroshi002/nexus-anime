# Docs

Long-lived design records for Nexus Anime. This folder is the place for decisions that outlast any single PR.

## Start here

- [Master Roadmap](master-roadmap.md) — milestone table (M0..MN) and how milestones map to versions.
- [Repository Design](REPOSITORY-DESIGN.md) — the **repo constitution** (28 deliverables covering naming, branching, versioning, structure, rules, and process). Read it before creating branches, PRs, or issues.

## Architecture

- [Architecture Decision Records](architecture/adr/) — why decisions are made (context, decision, consequences).
  - [`000-record-architecture-decisions.md`](architecture/adr/000-record-architecture-decisions.md) — ADR template + index.

## Milestone specs

Each milestone spec defines objective, scope, deliverables, prerequisites, dependencies, risks, acceptance criteria, and a completion checklist.

- [M0 — Repository Scaffold](14-milestones/Milestone-0-Foundation.md)
- [M1 — Design System](14-milestones/Milestone-1-Design-System.md)
- [M2 — Core Layout](14-milestones/Milestone-2-Core-Layout.md)
- [M3 — Authentication](14-milestones/Milestone-3-Authentication.md)
- [M4 — Homepage](14-milestones/Milestone-4-Homepage.md)
- [M5 — Search](14-milestones/Milestone-5-Search.md)
- [M6 — Anime Detail](14-milestones/Milestone-6-Anime-Detail.md)
- [M7 — Episode Player](14-milestones/Milestone-7-Episode-Player.md)
- [M8 — User Features](14-milestones/Milestone-8-User-Features.md)
- [M9 — Optimization](14-milestones/Milestone-9-Optimization.md)
- [M10 — Production](14-milestones/Milestone-10-Production.md)

## Engineering conventions

Detailed standards for day-to-day engineering work.

- [Coding Standards](12-conventions/Coding-Standards.md)
- [Naming Conventions](12-conventions/Naming-Conventions.md)
- [Folder Conventions](12-conventions/Folder-Conventions.md)
- [Git Workflow](12-conventions/Git-Workflow.md)
- [Branching Strategy](12-conventions/Branching-Strategy.md)
- [Commit Convention](12-conventions/Commit-Convention.md)
- [Pull Request Standards](12-conventions/Pull-Request-Standards.md)
- [Code Review Guidelines](12-conventions/Code-Review-Guidelines.md)
- [Documentation Standards](12-conventions/Documentation-Standards.md)
- [Testing Strategy](12-conventions/Testing-Strategy.md)
- [Definition of Done](12-conventions/Definition-of-Done.md)
- [Release Process](12-conventions/Release-Process.md)
- [Dependency Management](12-conventions/Dependency-Management.md)
- [Security Guidelines](12-conventions/Security-Guidelines.md)
- [Performance Guidelines](12-conventions/Performance-Guidelines.md)

## Architecture decisions

- [ADR-001 — Modular Monolith](architecture/adr/001-modular-monolith-nextjs.md)
- [ADR-002 — State Management](15-decisions/ADR-002-State-Management.md)
- [ADR-003 — Styling](15-decisions/ADR-003-Styling.md)
- [ADR-004 — Monorepo](15-decisions/ADR-004-Monorepo.md)
- [ADR-005 — API Strategy](15-decisions/ADR-005-API-Strategy.md)

## How to author an ADR

See [`architecture/adr/000-record-architecture-decisions.md#how-to-propose-a-new-adr`](architecture/adr/000-record-architecture-decisions.md) and the [ADR Template](15-decisions/ADR-Template.md).

## Conventions

Branch naming, commit messages, versioning, and the PR/issue workflow are all defined in [Repository Design](REPOSITORY-DESIGN.md). This folder records the *why* and *what*; that document defines the *how*.
