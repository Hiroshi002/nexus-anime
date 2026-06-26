# Design Principles

> The foundational philosophy governing every visual, interaction, and structural decision in Nexus Anime's design system.

---

## 1. Cinematic Immersion First

The platform is a **portal**, not a dashboard. Every surface, transition, and layout should feel like stepping into a premium AAA game launcher — dark, atmospheric, world-building.

**Why:** Anime fans and gaming-crossover users expect visual environments that match the intensity of the content. A sterile SaaS aesthetic breaks the fantasy before it begins.

**Applied as:**
- Dark surfaces dominate. Light is used as accent, never as primary background.
- Atmospheric depth through layered glassmorphism, not flat cards.
- Ambient glows and subtle particle-like effects create a sense of "alive" space.
- Hero areas feel like title screens, not landing sections.

---

## 2. Depth Through Layering

The interface uses **physical elevation** to communicate hierarchy. Elements float at different depths, casting shadows and refracting light through semi-transparent surfaces — like looking through layers of holographic glass.

**Why:** A single flat surface loses spatial information. Layering lets the eye parse primary content, supporting chrome, and ambient background in a single glance without explicit labels.

**Applied as:**
- 5 elevation levels (0–4) from flush to floating.
- Glassmorphism surfaces at elevations 1–3 with `backdrop-blur`.
- Deep shadows at elevation 3–4 for modals and overlays.
- Background ambient layer stays fixed; content scrolls above it.

---

## 3. Restraint in Decoration

Every decorative element must **earn its place**. A glow that guides the eye to a CTA is justified. A glow on every card is noise.

**Why:** Over-decoration accelerates visual fatigue. The sci-fi aesthetic is powerful in moderation and exhausting in excess. We aim for "premium launcher," not "cyberpunk parody."

**Applied as:**
- Glow effects reserved for: primary CTAs, active navigation, focused inputs, and hero elements.
- Particle/ambient effects limited to hero sections and empty states.
- Border decoration on at most 2 surface types (cards, modals).
- Animations under 300ms for micro-interactions; over 500ms only for page-level transitions.

---

## 4. Functional Minimalism

Every element serves a purpose. If removing it doesn't degrade comprehension or usability, it shouldn't exist.

**Why:** A streaming platform's primary job is getting users to content fast. Every pixel of chrome that doesn't aid navigation, comprehension, or delight is friction.

**Applied as:**
- No decorative icons that duplicate text labels.
- No dividers where spacing establishes separation.
- No subtitles that restate the title.
- Controls are compact but never tiny — minimum 44×44px touch target.

---

## 5. Consistent Rhythm

Spacing, sizing, and timing follow **fixed scales** derived from a single unit (8px). No magic numbers. Every gap, font size, and animation duration occupies a defined position on its scale.

**Why:** Inconsistent spacing feels "off" even when users can't articulate why. A consistent rhythm is the difference between "polished" and "assembled."

**Applied as:**
- 8px spatial grid: all padding, margin, and gap values are multiples of 8 (with 4px available for fine-tuning icon/text alignment).
- Type scale: modular scale ratio of 1.25 (Major Third).
- Motion scale: durations anchor at 150ms (micro), 250ms (standard), 400ms (expressive).
- Responsive scaling preserves ratios, not pixel values.

---

## 6. Progressive Disclosure

Show only what's needed at each level of engagement. Details reveal on demand, never all at once.

**Why:** Anime catalog pages contain dense metadata (genres, score, episodes, studios, season). Loading every detail upfront overwhelms. Progressive disclosure keeps scanning fast while keeping depth accessible.

**Applied as:**
- Cards show: poster, title, score. Everything else on hover or detail page.
- Anime detail: synopsis truncated at 3 lines; expandable.
- Season/episode lists: collapsed by default; expand seasons individually.
- Settings: grouped behind disclosure panels.

---

## 7. Touch-First, Pointer-Adaptive

Design for thumbs at 380px first. Enhance for mouse/keyboard at wider viewports. Never assume hover — it doesn't exist on mobile.

**Why:** 60%+ of anime streaming happens on mobile. A hover-dependent design breaks for the majority.

**Applied as:**
- All interactive elements: 44×44px minimum hit area.
- Hover effects are enhancements, not the only way to reveal state.
- Touch targets separated by 8px minimum gap.
- Keyboard focus indicators always visible (focus-visible, not focus).
- Mobile navigation: bottom tab bar > sidebar.

---

## 8. Accessibility Is Non-Negotiable

WCAG 2.2 AA compliance is a requirement, not a target. Every design decision is validated against contrast ratios, focus visibility, and screen reader semantics before approval.

**Why:** The anime community is diverse and includes users with visual impairments, motor disabilities, and cognitive differences. Excluding them is both unethical and legally risky in regulated markets.

**Applied as:**
- Minimum contrast: 4.5:1 for body text, 3:1 for large text and UI components.
- No information conveyed by color alone.
- Focus rings: 2px solid, high-contrast color, always visible on keyboard nav.
- Motion: respect `prefers-reduced-motion`; disable non-essential animations.
- All interactive elements have accessible names and roles.

---

## 9. Dark-Native, Light-Optional

The primary theme is dark. A light theme may exist in the future but is not architected for now. All token names are semantic, never color-literal, so a light inversion remains feasible without renaming.

**Why:** The platform's identity is dark and cinematic. A light theme would fundamentally alter the brand expression. Designing for both simultaneously dilutes the dark theme's atmospheric potential.

**Applied as:**
- Tokens use semantic names: `surface-primary`, `text-on-surface`, `accent-action`.
- Literal color values (`#0a0e1a`) appear only in token definitions, never in components.
- Surfaces are named by elevation: `surface-base`, `surface-raised`, `surface-overlay`.
- If a light theme is added later, only token definitions change — no component code changes.

---

## 10. Performance-Conscious Aesthetics

Visual effects must degrade gracefully. Glassmorphism falls back to opaque surfaces. Animations respect reduced-motion. Shadows use `box-shadow` (GPU-composited), not `filter: drop-shadow` on animated elements.

**Why:** Blur, shadow, and animation are expensive. On low-end devices or high-DPI screens with many blurred surfaces, frame rate drops below 60fps. The design must remain usable even when effects are disabled.

**Applied as:**
- `backdrop-filter: blur()` only on surfaces with bounded area (max ~400×600px per blur region).
- Maximum 3 simultaneous blur regions per viewport.
- All animations use `transform` and `opacity` only (composite-only properties).
- Reduced-motion fallback: instant state changes, no spring physics.
- Shadow definitions use multiple `box-shadow` layers for smooth rendering.

---

## Summary Table

| # | Principle | One-Line Test |
|---|-----------|---------------|
| 1 | Cinematic Immersion First | Does it feel like a portal, not a dashboard? |
| 2 | Depth Through Layering | Can I parse hierarchy without reading labels? |
| 3 | Restraint in Decoration | Would removing this decoration degrade comprehension? |
| 4 | Functional Minimalism | Does this element serve a purpose? |
| 5 | Consistent Rhythm | Is every spacing/size/duration on a defined scale? |
| 6 | Progressive Disclosure | Can a new user scan without reading every detail? |
| 7 | Touch-First, Pointer-Adaptive | Does this work with thumbs on a 380px screen? |
| 8 | Accessibility Is Non-Negotiable | Does this pass WCAG 2.2 AA? |
| 9 | Dark-Native, Light-Optional | Are all color references semantic, not literal? |
| 10 | Performance-Conscious Aesthetics | Does this degrade gracefully when effects are off? |
