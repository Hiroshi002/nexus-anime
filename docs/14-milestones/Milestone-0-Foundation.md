# M0 — Foundation

## Objective

Initialize the GitHub repository with the full set of conventions, templates, and scaffolding that every later milestone depends on — without writing any application code. This milestone produces the "repo constitution" (`REPOSITORY-DESIGN.md`), folder structures, CI configuration, and the initial commit checklist. At the end of M0, the repository is ready for M1 scaffolding to begin.

## Scope

- Repository metadata: name (`nexus-anime`), description, topics, visibility (private through M4)
- Branch strategy: trunk-based development on `main`, naming convention `<type>/<milestone>-<slug>`
- Git tags: annotated, immutable, strict SemVer 2.0.0 (`v<semver>`)
- Folder structures: root files, `.github/`, `docs/`, `apps/`, `packages/`, `tooling/scripts`, `tooling/docker`
- License (MIT), repository rules, branch protection rules, required status checks
- Merge/PR/issue workflows, labels, milestones, project board columns
- Initial commit checklist (14 items)

Out of scope: any application code, any packages under `apps/` or `packages/`, any CI workflow logic beyond the template stubs.

## Deliverables

### D1 — Repository Design Document

`docs/REPOSITORY-DESIGN.md` authored with all 28 deliverables covering: repo metadata, branch strategy, folder layout, root files, `.github/` structure, `docs/` structure, `apps/web/` structure, `packages/` structure, scripts, docker, license, rules, branch protection, status checks, PR workflow, issue workflow, labels, milestones table, project board, and initial commit checklist.

### D2 — GitHub Configuration

- `.github/ISSUE_TEMPLATE/` with bug report and feature request templates
- `.github/PULL_REQUEST_TEMPLATE.md` with summary, changes, and checklist sections
- `.github/labels.yml` with labels for type, priority, status, scope, and milestone
- `.github/workflows/ci.yml` with lint, typecheck, test, build, and format:check jobs

### D3 — Documentation Scaffold

- `docs/README.md` — documentation index
- `docs/milestones/master-roadmap.md` — M0–M7 milestone table with version mapping
- `docs/architecture/adr/` — ADR template and initial ADR-001 (modular monolith)
- `docs/sprints/` — empty, ready for sprint documentation

### D4 — Root Configuration Files

- `package.json` — root workspace scripts
- `pnpm-workspace.yaml` — workspace definition
- `turbo.json` — Turborepo pipeline configuration
- `.npmrc` — registry and hoisting config
- `.nvmrc` — Node 22 LTS
- `.env.example` — template environment variables
- `.gitignore` — standard Node.js ignores plus `.env.local`
- `prettier.config.js` — code formatter configuration
- `tsconfig.base.json` — shared TypeScript strict config
- `LICENSE` — MIT
- `README.md` — project overview pointing to `REPOSITORY-DESIGN.md`
- `CONTRIBUTING.md` — contribution guidelines
- `CODE_OF_CONDUCT.md` — code of conduct

### D5 — Tooling Scaffold

- `tooling/docker/docker-compose.yml` — Postgres, Redis, Mailpit services
- `tooling/scripts/seed-admin.ts` — admin user seed stub
- `tooling/scripts/seed-anime.ts` — anime catalog seed stub
- `tooling/scripts/seed-catalog.ts` — catalog metadata seed stub

## Prerequisites

- GitHub account with repository creation permissions
- Git installed locally (v2.40+)
- No prior repository exists at the target URL

## Dependencies

None. M0 is the root of the milestone dependency graph.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Over-engineering the initial scaffold** | Medium | Medium | Follow the 28 deliverables exactly; resist adding unrequested files; defer tooling choices to their respective milestones. |
| **Branch protection blocks the initial push** | Low | High | Push the initial commit first, then enable branch protection in the same PR; verify status checks pass before merging. |
| **CI workflow references packages that do not exist yet** | Medium | Medium | CI workflow uses `continue-on-error` or is limited to steps that succeed on an empty repo (e.g., `pnpm install`, `format:check`). Full CI activates in M1. |
| **`.env.example` leaks a real secret** | Low | Critical | Only document variable names and placeholder values; never commit actual secrets; review with `git-secrets` or similar. |

## Acceptance Criteria

1. Repository exists at `github.com/<org>/nexus-anime` with correct name, description, and topics.
2. Default branch is `main`; branch protection is enabled with all required status checks.
3. All 28 deliverables from `REPOSITORY-DESIGN.md` are present and accurate.
4. `.github/` contains issue templates, PR template, labels, and CI workflow.
5. `docs/` contains README, master-roadmap, ADR template, and milestones directory.
6. Root configuration files are present: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.npmrc`, `.nvmrc`, `.env.example`, `.gitignore`, `prettier.config.js`, `tsconfig.base.json`, `LICENSE`, `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`.
7. `tooling/docker/docker-compose.yml` and `tooling/scripts/seed-*.ts` stubs exist.
8. `pnpm install` succeeds from a clean clone (no workspace packages yet; install resolves the empty workspace).
9. README points to `REPOSITORY-DESIGN.md` as the source of truth for repository conventions.
10. Initial commit checklist in `REPOSITORY-DESIGN.md` is fully checked off.

## QA Checklist

- [ ] Clone the repo to a fresh directory; verify all expected files are present.
- [ ] Verify branch naming convention is documented and enforced.
- [ ] Verify CI workflow YAML is valid (use `actionlint` or GitHub Actions validator).
- [ ] Verify `.env.example` contains no real secrets.
- [ ] Verify `.gitignore` covers `node_modules/`, `.env.local`, `.next/`, `dist/`, `coverage/`.
- [ ] Verify `LICENSE` is MIT and contains the correct year.
- [ ] Verify `docs/milestones/master-roadmap.md` lists M0 as complete.
- [ ] Verify ADR-001 exists and documents the modular monolith decision.
- [ ] Verify no application code exists (no `apps/web/app/`, no `packages/ui/src/components/`).
- [ ] Verify the repository is private (not public).

## Estimated Tasks

| # | Task | Estimate | Owner | Dependencies |
|---|------|----------|-------|--------------|
| T1 | Create GitHub repository with name, description, topics, visibility | 0.5h | Lead | None |
| T2 | Write `REPOSITORY-DESIGN.md` with all 28 deliverables | 4h | Lead | T1 |
| T3 | Create root configuration files (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.npmrc`, `.nvmrc`, `.env.example`, `.gitignore`, `prettier.config.js`, `tsconfig.base.json`) | 2h | Lead | T1 |
| T4 | Write `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `LICENSE` | 1h | Lead | T1 |
| T5 | Create `.github/` templates, labels, and CI workflow | 2h | Lead | T1 |
| T6 | Create `docs/` structure: README, master-roadmap, ADR template, milestones dir | 1h | Lead | T1 |
| T7 | Create `tooling/docker/docker-compose.yml` and `tooling/scripts/seed-*.ts` stubs | 1h | Lead | T1 |
| T8 | Create initial commit using the 14-item checklist | 0.5h | Lead | T2–T7 |
| T9 | Enable branch protection and required status checks on `main` | 0.5h | Lead | T8 |
| T10 | Verify `pnpm install` succeeds from a clean clone | 0.5h | QA | T8 |

**Total estimate: ~13 engineer-hours** (approximately 2 days for a single engineer).

## Completion Checklist

- [ ] All deliverables (D1–D5) are present in the repository.
- [ ] All acceptance criteria (1–10) are met.
- [ ] QA checklist is fully checked off.
- [ ] Initial commit checklist in `REPOSITORY-DESIGN.md` is fully checked off.
- [ ] Repository is private and accessible to the team.
- [ ] `main` branch is protected with required status checks.
- [ ] No application code exists in the repository.
- [ ] Milestone marked complete in GitHub Projects board.
- [ ] Branch `feature/m0-foundation` deleted after merge (or trunk commit if no branch was used).
