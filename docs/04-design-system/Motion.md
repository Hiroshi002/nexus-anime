# Motion

> The motion and animation system for Nexus Anime — timing, easing, patterns, and performance.

---

## Design Decision

Motion serves two purposes: **feedback** (confirming user actions) and **choreography** (guiding attention between states). The motion system is **subtle and precise** — we're a premium interface, not a demo reel. Animations are fast enough to feel responsive but slow enough to register.

**Why not Framer Motion for everything?** Framer Motion provides powerful orchestration but adds ~30KB to the client bundle. The majority of our animations (hover, focus, expand/collapse, fade) are achievable with CSS transitions and animations. Framer Motion is reserved for: page transitions, the video player chrome, and complex layout animations where CSS transitions can't express the choreography.

**Why the specific timing values?** Research (Material Design, Apple HIG, and Nielsen Norman Group studies) establishes that:
- 50–100ms feels instantaneous — good for micro-feedback (color change, opacity).
- 100–200ms feels responsive — good for state transitions.
- 200–500ms feels animated — good for appearances, expansions.
- 500ms+ feels dramatic — good for page transitions, hero reveals.

---

## Duration Scale

| Token | Value | Usage | Feels Like |
|-------|-------|-------|------------|
| `duration-0` | 0ms | Instant — reduced-motion fallback | Instant |
| `duration-50` | 50ms | Color change, opacity micro-toggle | Near-instant |
| `duration-100` | 100ms | Hover color, focus ring appear | Quick |
| `duration-150` | 150ms | **Micro-interaction default** — hover scale, toggle, chip remove | Responsive |
| `duration-200` | 200ms | Tooltip appear, badge animate | Snappy |
| `duration-250` | 250ms | **Standard default** — expand/collapse, fade, slide | Standard |
| `duration-350` | 350ms | Dropdown open, modal appear | Smooth |
| `duration-500` | 500ms | Toast enter, drawer slide, card reorder | Expressive |
| `duration-700` | 700ms | Page transition, hero reveal | Dramatic |
| `duration-1000` | 1000ms | Splash screen, loading sequence | Cinematic |

**Decision: Two defaults — 150ms (micro) and 250ms (standard).** Having a single default creates awkward timing: 250ms is too slow for a hover color; 150ms is too fast for a panel expansion. The two-tier system gives clear guidance.

---

## Easing (Cubic Bézier)

| Token | Value | Visual Feel | Usage |
|-------|-------|-------------|-------|
| `ease-linear` | `cubic-bezier(0, 0, 1, 1)` | Mechanical, constant rate | Progress bars, spinning loaders |
| `ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Accelerating — slow start, fast end | Elements leaving the screen |
| `ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Decelerating — fast start, slow end | Elements entering the screen |
| `ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Smooth — slow start/end, fast middle | State changes within the viewport |
| `ease-spring` | `cubic-bezier(0.22, 1, 0.36, 1)` | **Default** — slight overshoot, organic settle | Most animations — the "Nexus feel" |
| `ease-bounce` | `cubic-bezier(0.68, -0.55, 0.265, 1.55)` | Playful overshoot — bouncy | Micro-delights, notification badges |
| `ease-slugish` | `cubic-bezier(0.5, 0, 0.3, 1)` | Heavy deceleration — dramatic arrival | Hero elements, large surface reveals |

**Decision: `ease-spring` as the default easing.** Standard `ease-in-out` produces mechanical, symmetric motion. `ease-spring` (inspired by Material Design's "emphasized decelerate") adds a subtle overshoot that makes motion feel physical — like an object settling into position. This is the "premium" feel.

**Decision: `ease-in` for exits, `ease-out`/`ease-spring` for entrances.** Elements accelerating off-screen and decelerating onto-screen follows physical intuition. Exiting elements should feel "pulled away"; entering elements should feel "placed down."

---

## Animation Patterns

### Crossfade

Used for: image swaps (poster hover → backdrop), theme transitions, content updates.

```css
/* Design specification */
transition: opacity duration-250 ease-in-out;
/* Leave: opacity 1 → 0 over 250ms, then swap content, then 0 → 1 over 250ms */
```

### Slide + Fade

Used for: dropdown open/close, drawer enter/exit, toast enter/exit.

| Direction | Enter | Leave |
|-----------|-------|-------|
| Down (dropdown) | `translateY(-8px) → 0` + `opacity 0 → 1` | `translateY(0 → -8px)` + `opacity 1 → 0` |
| Up (toast) | `translateY(8px) → 0` + `opacity 0 → 1` | `translateY(0 → 8px)` + `opacity 1 → 0` |
| Left (drawer) | `translateX(100%) → 0` + `opacity 0 → 1` | `translateX(0 → 100%)` + `opacity 1 → 0` |
| Right (sidebar) | `translateX(-100%) → 0` + `opacity 0 → 1` | `translateX(0 → -100%)` + `opacity 1 → 0` |

Default: `duration-350 ease-spring` for enter, `duration-250 ease-in` for leave.

### Expand / Collapse

Used for: accordion sections, "show more" synopses, season episode lists.

```css
/* Design specification */
/* Enter: max-height 0 → measured, opacity 0 → 1 */
/* Leave: max-height measured → 0, opacity 1 → 0 */
transition: max-height duration-350 ease-spring, opacity duration-200 ease-out;
```

**Decision: `max-height` animation, not `height`.** `height: auto` cannot be transitioned in CSS. `max-height` with a known maximum value works. For more precise animation, CSS `interpolate-size` (future) or FLIP technique (JS) can be used.

### Scale + Fade

Used for: modal/dialog enter, image lightbox, hover micro-interaction.

| Context | Enter | Leave |
|---------|-------|-------|
| Modal | `scale(0.95) → 1` + `opacity 0 → 1` | `scale(1 → 0.95)` + `opacity 1 → 0` |
| Lightbox | `scale(0.9) → 1` + `opacity 0 → 1` | `scale(1 → 0.9)` + `opacity 1 → 0` |
| Hover (button) | `scale(1 → 1.02)` | `scale(1.02 → 1)` |

Modal/lightbox: `duration-350 ease-spring`. Hover: `duration-150 ease-spring`.

### Stagger

Used for: card grid appear, list item appear, notification stream.

Stagger delays each item's animation by a fixed interval, creating a cascade effect.

| Context | Stagger Delay | Base Duration | Total (10 items) |
|---------|--------------|---------------|------------------|
| Card grid | 50ms | `duration-350` | 350 + (9 × 50) = 800ms |
| List items | 30ms | `duration-250` | 250 + (9 × 30) = 520ms |
| Nav items | 40ms | `duration-200` | 200 + (9 × 40) = 560ms |

**Decision: Maximum total stagger time ≤ 800ms.** Beyond 800ms, the stagger feels sluggish. If more than 16 items need staggering, batch them (animate first 16, then instant-appear the rest).

---

## Composite-Only Rule

**All animations must use only composite properties** — `transform` and `opacity`. These properties are GPU-composited and don't trigger layout or paint.

| Property | Triggers | Allowed in Animation? |
|----------|----------|----------------------|
| `transform` | Composite | ✓ Always |
| `opacity` | Composite | ✓ Always |
| `filter` (blur, brightness) | Paint | ⚠ Only for content blur transitions, not in interactive animations |
| `background-color` | Paint | ⚠ Only for hover/focus (duration ≤ 150ms) |
| `box-shadow` | Paint | ✗ Never animate — use pseudo-element + opacity trick |
| `width` / `height` | Layout | ✗ Never — use `transform: scale()` |
| `margin` / `padding` | Layout | ✗ Never — use `transform: translate()` |
| `top` / `left` | Layout | ✗ Never — use `transform: translate()` |

**Decision: `background-color` allowed for state changes.** Color transitions on hover/focus are so common and brief (≤150ms) that the paint cost is negligible. Banning them would require opacity hacks for every button.

---

## Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Under reduced motion:
- **All animations snap to final state.** No fade, no slide, no scale — instant appearance.
- **Scroll-driven animations disabled.** No parallax, no scroll-triggered reveals.
- **Loading spinners replaced** with static progress bars or skeleton screens.
- **Hover effects remain** (color, background) — they're state indicators, not motion.
- **Video playback unaffected** — the user chose to play the video.

**Decision: Near-instant (0.01ms) not 0ms.** Some browsers fire `animationstart`/`animationend` events at 0ms in unexpected order. 0.01ms is imperceptibly fast but avoids event timing issues.

---

## Framer Motion Usage

Framer Motion is authorized for:

| Feature | Why Framer Motion | Bundle Impact |
|---------|-------------------|---------------|
| Page transitions | Shared layout animations, `AnimatePresence` | ~30KB (lazy-loaded) |
| Video player chrome | Complex show/hide orchestration on mouse move | ~30KB (inside player chunk) |
| Card reorder | Layout animation on drag-and-drop reorder | Part of page transition chunk |

All other animations use CSS transitions/animations.

**Decision: Lazy-load Framer Motion.** It's imported via `next/dynamic` or dynamic `import()` so it doesn't contribute to the initial page bundle.

---

## Motion Rules

1. **Always use duration and easing tokens**, never raw `300ms` or `ease-in-out`.
2. **Entrances use `ease-out` or `ease-spring`; exits use `ease-in`.** Reversed easing looks wrong.
3. **Maximum 3 simultaneously running animations** per element. More creates visual chaos.
4. **Stagger delays ≤ 50ms** per item. Larger delays feel slow.
5. **Total animation time per interaction ≤ 800ms.** Users should never wait for an animation to finish before they can interact.
6. **Animate composite-only properties.** See the Composite-Only Rule.
7. **Respect `prefers-reduced-motion`.** Every animation must degrade gracefully.
8. **No infinite animations** except loading spinners (which replace with static under reduced-motion). Background ambient effects use `animation-iteration-count` of 3–5, not `infinite`.
9. **Loading states use skeleton screens**, not spinners. Spinners are reserved for inline loading indicators (button submit, avatar upload).
10. **Delay interactive feedback by 0ms**, not 100ms. Hover/focus effects must apply on the same frame as the event. Delayed hover feels broken.
