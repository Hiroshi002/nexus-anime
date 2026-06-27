# ADR-Template — How to Write an Architecture Decision Record

> This document defines the format, numbering scheme, and quality bar for every
> Architecture Decision Record (ADR) in the Nexus Anime repository. All future
> ADRs must copy the template below.

## What is an An Architecture Decision Record?

An ADR is a short, immutable record of an architectural decision that matters to
the people who build, deploy, and operate this system. It captures **what** we
decided, **why** we decided it, and **what we gave up** by deciding that way.

ADRs are not design docs. Design docs (`docs/03-architecture/`,
`docs/04-design-system/`, `docs/06-api/`) describe the system as it is. ADRs
describe a **moment in time** when the team chose one path over another. When a
decision is later reversed or refined, the original ADR stays on the record as
`superseded` and a new ADR links back to it.

## Where ADRs live

All ADRs live in `docs/15-decisions/` and follow the naming convention:

```
NNN-title.md
```

- `NNN` — a zero-padded three-digit number, starting at `001`. Numbers are
  never reused. If ADR-005 is superseded by ADR-017, the number `005` is
  retired forever.
- `title` — a short kebab-case slug (≤ 60 characters). The slug should describe
  the **decision**, not the domain. Good: `ADR-002-State-Management.md`. Bad:
  `ADR-002-Client-State-vs-Server-State-A-Comparison.md`.

## Required sections

Every ADR must contain the following sections, in this order. Do not invent
additional sections.

### 1. Title and metadata

```markdown
# ADR-NNN — <Short Decision Title>

- **Status:** proposed | accepted | deprecated | superseded
- **Deciders:** <names or roles, e.g. "Tech Lead, Staff Engineer">
- **Date:** YYYY-MM-DD
- **Supersedes:** ADR-NNN (or "None")
- **Superseded by:** ADR-NNN (or "None")
- **Related:** ADR-NNN, ADR-NNN
- **References:** docs/03-architecture/Architecture.md, docs/06-api/API-Standards.md
```

**Status definitions:**

| Status                                      | Meaning                                                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `proposed`                                  | The decision is under discussion. No code has been written against it yet.                   |
| `accepted`                                  | The decision is final and the team is building against it.                                   |
| `accepted` ADRs become the source of truth. |
| `deprecated`                                | The decision is no longer recommended, but nothing has replaced it yet.                      |
| `superseded`                                | Another ADR has replaced this one. The superseded ADR stays on disk; the new ADR links back. |

### 2. Context

> The forces at play — technical, organizational, and constraint-based — that
> made this decision necessary.

A good Context section answers three questions:

1. **What problem are we solving?** Describe the concrete situation that
   triggered the decision. Avoid vague statements like "we need to improve
   performance." Instead: "Catalog pages take 4.2 s LCP on 3G because we ship
   380 KB of React hydration data."
2. **What alternatives did we consider?** List at least two. A decision with
   only one option is not a decision — it is a constraint.
3. **What constraints shaped the choice?** Team size, timeline, budget,
   regulatory requirements, existing tech debt, vendor commitments.

### 3. Decision

> What we decided, stated in one or two unambiguous paragraphs.

The Decision section must be **specific enough that an engineer who was not in
the room can implement it without asking a follow-up question**. Avoid words
like "consider," "evaluate," or "explore." Use "we use," "we forbid," "we
require."

If the decision has scope limits (e.g. "this applies only to client-side
state, not server state"), state them explicitly.

### 4. Consequences

> What becomes easier and harder as a result of this decision.

Split into **Positive** and **Negative** sub-sections. Be honest about
trade-offs. A decision with no downsides is either trivial or unexamined.

```markdown
### Positive

- <One concrete benefit, ideally measurable.>
- <Another benefit.>

### Negative

- <One concrete cost or risk.>
- <Mitigation: how we keep this cost contained.>
```

### 5. Compliance (optional)

For decisions that impose a rule (naming conventions, required headers, file
layout), add a short Compliance section that tells the reader how to verify
adherence:

```markdown
### Compliance

- `pnpm typecheck` must pass with no `any`.
- ESLint rule `nexus/no-feature-import` enforces the cross-feature import ban.
- CI rejects PRs that violate the envelope format (see `packages/eslint-config`).
```

## What makes a good ADR

- **Immutable.** Once accepted, an ADR is never edited except to update its
  status and add a `Superseded by` link.
- **Short.** Target 150–300 lines. If you need 500 lines, you are writing a
  design doc, not an ADR. Link to the design doc instead.
- **Honest.** The Negative consequences section is the most valuable part of
  the document. If you cannot name a downside, you have not thought about the
  decision hard enough.
- **Numbered.** The number is the identity. Never renumber.
- **Linked.** Every ADR must reference at least one design doc or another ADR.

## What does NOT belong in an ADR

- Implementation details that belong in a README or design doc.
- Code snippets longer than a few lines (link to the package instead).
- Meeting notes or discussion threads (use a Notion doc or a PR description).
- Decisions that are not architectural (naming a variable, choosing a color).

## Example ADR

The following is a **hypothetical** ADR included only to demonstrate the format.
It does not represent a real decision in this codebase.

---

# ADR-XYZ — Example: Choosing a Video Player Library

- **Status:** accepted
- **Deciders:** Tech Lead, Senior Frontend Engineer
- **Date:** 2026-07-15
- **Supersedes:** None
- **Superseded by:** None
- **Related:** None
- **References:** docs/03-architecture/Rendering-Strategy.md, docs/04-design-system/Motion.md

## Context

Every episode playback page needs a video player. The player must support:

- HLS adaptive streaming (required — our source files are 1080p and mobile
  clients are on variable networks).
- Custom controls themed to our glassmorphic design system (required — the
  native browser controls break the visual identity).
- Signed Cloudflare Stream URLs with 5-minute expiry (required — security
  constraint; we cannot expose raw MP4 URLs).
- Subtitle rendering for 12 languages including vertical Japanese text
  (required by M3 accessibility goals).

We evaluated three options:

1. **Build in-house on top of `hls.js`.** Full control, but we estimate 6–8
   weeks for subtitle rendering, DRM fallback, and edge-case handling on iOS
   Safari. Our M3 timeline does not have 6 weeks of slack.
2. **Video.js + plugins.** Mature, HLS support out of the box, subtitle
   plugin available. Drawback: 140 KB minified gzipped, jQuery ancestry
   shows through in the plugin API.
3. **Plyr.** Lightweight (45 KB), modern API, accessible by default. Drawback:
   no native HLS — requires `hls.js` as a peer, which partially negates the
   weight savings.

**Constraints:** M3 ships in 9 weeks. The player is the critical path for the
entire product. We cannot ship without it.

## Decision

We use **Video.js** as the video player library, wrapped in a thin client
component at `apps/web/src/components/video/VideoPlayer.tsx` that exposes only
the props we need (src, poster, subtitles, onTimeUpdate). The wrapper constrains
the Video.js API surface so that no other component can reach into player
internals.

We accept the 140 KB cost because:

- HLS, DRM, and subtitle support are battle-tested in Video.js — we do not
  have to build or maintain them.
- The player is lazy-loaded via `next/dynamic` with `{ ssr: false }`, so the
  140 KB does not block the initial page render.
- The wrapper pattern means that if we ever replace Video.js with a different
  library, only one file changes.

We explicitly **do not** use Video.js plugins beyond `videojs-contrib-quality-levels`
and the official subtitle plugin. Custom behavior (theater mode, autoplay
prefetch) is implemented in our wrapper, not in Video.js plugin code.

## Consequences

### Positive

- HLS, subtitle, and DRM support are available on day one without custom
  development.
- The wrapper pattern isolates the library from the rest of the codebase —
  swapping Video.js for Plyr later requires changing one file.
- Video.js has active maintenance and a large community — security patches
  and browser compatibility fixes are not our responsibility.

### Negative

- 140 KB minified gzipped is significant for a client island. On a 3G
  connection, this adds ~1.5 s to interactive time for the episode page.
  **Mitigation:** The player is lazy-loaded below the fold; the initial
  page render (above-the-fold content, metadata, comments) is unaffected.
- Video.js's jQuery ancestry means the plugin API is inconsistent. Some
  plugins use jQuery deferreds, others use Promises. **Mitigation:** The
  wrapper converts all callbacks to Promises; application code never touches
  jQuery.
- Custom theming requires overriding Video.js's Sass variables, which are
  global. **Mitigation:** We scope the override inside
  `.nexus-video-player` and import the Video.js Sass partial directly rather
  than the precompiled CSS.

### Compliance

- The wrapper at `apps/web/src/components/video/VideoPlayer.tsx` is the only
  file allowed to `import video-js`. ESLint rule `nexus/no-video-js-import`
  enforces this.
- The player must be rendered with `ssr: false`. Any direct import of
  `VideoPlayer` (without `next/dynamic`) is a CI error.
- Subtitle tracks must be passed as `VTT` files. We do not accept SRT at the
  component boundary; conversion happens upstream in the ingestion pipeline.

---

End of template. Copy the structure above (excluding the example) for every
new ADR.
