# Master Roadmap

This is the milestone table for Nexus Anime. Each milestone has a spec in [`docs/milestones/`](milestones/).

| ID  | Milestone                                   | Goal                                      | Status      |
| --- | ------------------------------------------- | ----------------------------------------- | ----------- |
| M0  | Repository scaffold                         | Repo, CI, conventions                     | ✅          |
| M1  | Design system in code                       | `@nexus/ui` primitives, theme tokens      | ✅          |
| M2  | Catalog foundation                          | DB, cache, API envelope, error boundaries | ✅          |
| M3  | Auth complete                               | Auth.js v5, sessions, OAuth               | In progress |
| M4  | User profiles, watchlist, continue-watching | Personalization                           | Planned     |
| M5  | Payments                                    | Stripe subscriptions                      | Planned     |
| M6  | Video streaming                             | Cloudflare Stream                         | Planned     |
| M7  | Public launch                               | v1.0.0                                    | Planned     |
| M8  | Feature complete                            | All features integrated                   | Planned     |
| M9  | Optimization                                | CWV targets, a11y, bundle, monitoring     | Planned     |
| M10 | Production launch                           | v1.0.0 tag, go-live                       | Planned     |

## How milestones map to versions

- Milestones M0–M2 shipped as `v0.2.x` (pre-release).
- M3–M4 target `v0.3.x`–`v0.4.x`.
- M5–M6 target `v0.5.x`–`v0.9.x`.
- M7 is the `v1.0.0` stable public release.
- M8 integrates remaining features toward feature-complete state.
- M9 is quality-only (no new features) — performance, accessibility, observability.
- M10 is the go-live milestone: production provisioning, security, legal, v1.0.0 release.

See [Repository Design](REPOSITORY-DESIGN.md) for the versioning strategy (§9) and branch naming (§6).
