# Icons

> The icon system for Nexus Anime — library, sizing, styling, and usage rules.

---

## Design Decision

The icon system uses **Lucide** (formerly Feather Icons) as the base library, extended with custom anime-platform icons. Lucide provides clean, consistent 24×24 stroke icons with a 2px stroke width — modern, readable at small sizes, and visually compatible with the sci-fi aesthetic when rendered in our accent colors.

**Why Lucide over other icon libraries?**

- **Lucide vs Heroicons:** Lucide's 2px stroke matches our UI weight better than Heroicons' 1.5px. Lucide also has more icons (1,400+ vs 300+).
- **Lucide vs Phosphor:** Phosphor offers 6 weights per icon (thin, light, regular, bold, fill, duotone) which sounds useful but creates decision paralysis and 6× the bundle. Lucide's single weight is sufficient.
- **Lucide vs Font Awesome:** Font Awesome mixes solid/regular/brands with inconsistent sizing. The legacy 4.x icons don't align with modern design. Lucide is purpose-built for modern UIs.
- **Lucide vs custom SVG:** Custom icons would be perfectly tailored but require ongoing maintenance for 200+ icons. Lucide covers 80% of needs; we add ~20 custom anime-specific icons.

---

## Icon Sizes

Icons use a sizing scale based on multiples of 4px, aligned with the spacing system.

| Token      | Size (px) | Usage                                          | Context                                         |
| ---------- | --------- | ---------------------------------------------- | ----------------------------------------------- |
| `icon-xs`  | 12        | Inline with `text-xs`                          | Dense metadata, compact badges                  |
| `icon-sm`  | 16        | Inline with `text-sm`/`text-base`              | Button icons, list icons, form icons            |
| `icon-md`  | 20        | **Default** — standalone, inline with headings | Navigation, cards, standard UI                  |
| `icon-lg`  | 24        | Prominent standalone                           | Empty states, hero icons, feature illustrations |
| `icon-xl`  | 32        | Feature presentation                           | Onboarding, large empty states                  |
| `icon-2xl` | 48        | Decorative/illustrative                        | Splash screens, error pages                     |

**Decision: 20px default, not 16px or 24px.** 16px is too small for touch targets in a dark interface where icons carry state information. 24px is too large for inline use with 14px body text. 20px fits inline with 14–18px text and works standalone in most UI contexts.

---

## Icon Styling

### Stroke Width

| Size Token | Stroke Width | Rationale                                  |
| ---------- | ------------ | ------------------------------------------ |
| `icon-xs`  | 1.5px        | Thinner at small size to prevent fill-in   |
| `icon-sm`  | 1.5px        | Thinner at small size                      |
| `icon-md`  | 2px          | Lucide default — optimal at 20px           |
| `icon-lg`  | 2px          | Lucide default                             |
| `icon-xl`  | 2px          | Lucide default                             |
| `icon-2xl` | 1.5px        | Thinner at large size for visual lightness |

**Decision: 1.5px stroke for icons < 20px.** At 12–16px, a 2px stroke fills in counter spaces (the holes in 'a', 'e', '4'). 1.5px maintains legibility.

### Color

Icons inherit their parent's text color by default (`currentColor`). Override only for:

| Context            | Color Token         | Usage                                      |
| ------------------ | ------------------- | ------------------------------------------ |
| Default            | Inherit from parent | —                                          |
| Action/Interactive | `aether-5`          | Clickable icons that aren't inside buttons |
| Destructive        | `error`             | Delete, remove, disconnect actions         |
| Success            | `success`           | Completed, verified, available             |
| Warning            | `warning`           | Attention, expiring, incomplete            |
| Disabled           | `void-7`            | Non-interactive                            |
| Active/On          | `aether-6`          | Toggle on, selected, active filter         |

---

## Lucide Icon Mapping

Core icons used across the platform, mapped to semantic names:

| Semantic Name     | Lucide Icon              | Usage                        |
| ----------------- | ------------------------ | ---------------------------- |
| `search`          | `Search`                 | Global search, filter search |
| `filter`          | `SlidersHorizontal`      | Filter panel toggle          |
| `sort`            | `ArrowUpDown`            | Sort toggle                  |
| `play`            | `Play`                   | Play button, episode play    |
| `pause`           | `Pause`                  | Pause button                 |
| `skip-forward`    | `SkipForward`            | Next episode                 |
| `skip-back`       | `SkipBack`               | Previous episode             |
| `volume-on`       | `Volume2`                | Volume control               |
| `volume-off`      | `VolumeX`                | Muted                        |
| `fullscreen`      | `Maximize`               | Fullscreen toggle            |
| `exit-fullscreen` | `Minimize`               | Exit fullscreen              |
| `heart`           | `Heart`                  | Favorite/watchlist           |
| `heart-filled`    | `Heart` (filled variant) | Favorited state              |
| `bookmark`        | `Bookmark`               | Watchlater                   |
| `bookmark-filled` | `Bookmark` (filled)      | Bookmarked state             |
| `star`            | `Star`                   | Rating                       |
| `star-filled`     | `Star` (filled)          | Rated state                  |
| `share`           | `Share2`                 | Share button                 |
| `download`        | `Download`               | Offline download             |
| `info`            | `Info`                   | Info tooltip                 |
| `warning`         | `AlertTriangle`          | Warning indicator            |
| `error`           | `AlertCircle`            | Error indicator              |
| `success`         | `CheckCircle2`           | Success indicator            |
| `close`           | `X`                      | Dismiss, close               |
| `menu`            | `Menu`                   | Mobile menu                  |
| `chevron-down`    | `ChevronDown`            | Dropdown, accordion          |
| `chevron-right`   | `ChevronRight`           | Navigation next              |
| `arrow-left`      | `ArrowLeft`              | Back navigation              |
| `settings`        | `Settings`               | Settings page                |
| `user`            | `User`                   | Profile                      |
| `bell`            | `Bell`                   | Notifications                |
| `clock`           | `Clock`                  | Duration, schedule           |
| `calendar`        | `Calendar`               | Season, release date         |
| `eye`             | `Eye`                    | View count                   |
| `message`         | `MessageCircle`          | Comments                     |
| `globe`           | `Globe`                  | Language, subtitle           |
| `tag`             | `Tag`                    | Genre, label                 |
| `list`            | `List`                   | Episode list                 |
| `grid`            | `LayoutGrid`             | Grid view                    |
| `refresh`         | `RefreshCw`              | Refresh, retry               |
| `copy`            | `Copy`                   | Copy to clipboard            |
| `external-link`   | `ExternalLink`           | External link                |
| `image`           | `Image`                  | Gallery                      |
| `video`           | `Video`                  | Video content                |
| `headphones`      | `Headphones`             | Audio/subtitle track         |
| `shield`          | `Shield`                 | Security, age rating         |
| `zap`             | `Zap`                    | New/trending indicator       |
| `flame`           | `Flame`                  | Popular/hot                  |
| `trophy`          | `Trophy`                 | Ranking, achievement         |
| `crown`           | `Crown`                  | Premium subscriber           |

---

## Custom Icons

Anime-platform-specific icons not available in Lucide. These are designed as 24×24 SVGs with 2px stroke, matching Lucide's style.

| Name          | Description                                      | Usage                   |
| ------------- | ------------------------------------------------ | ----------------------- |
| `anime`       | Stylized star/sparkle — anime content type       | Category indicator      |
| `manga`       | Open book with motion lines — manga content type | Category indicator      |
| `light-novel` | Book with glow — light novel type                | Category indicator      |
| `subtitles`   | Text frame with brackets — subtitle track        | Audio/subtitle selector |
| `dubbed`      | Speech bubble with globe — dubbed track          | Audio selector          |
| `ongoing`     | Circular arrow with dot — currently airing       | Season status           |
| `completed`   | Checkmark in circle — finished airing            | Season status           |
| `upcoming`    | Clock with star — not yet aired                  | Season status           |
| `hiatus`      | Paused circle — on break                         | Season status           |
| `episode`     | Play in numbered frame — episode                 | Episode indicator       |
| `season`      | Calendar with play — season                      | Season indicator        |
| `studio`      | Building with film frame — studio                | Studio info             |
| `source`      | Book with arrow — source material                | Adaptation info         |
| `prequel`     | Arrow left + play — prequel                      | Relation type           |
| `sequel`      | Arrow right + play — sequel                      | Relation type           |
| `side-story`  | Branch + play — side story                       | Relation type           |
| `spin-off`    | Spiral + play — spin-off                         | Relation type           |
| `steam`       | Game controller with play — Steam link           | External link           |
| `crunchyroll` | Stylized CR mark — Crunchyroll link              | External link           |
| `myanimelist` | Stylized MAL mark — MAL link                     | External link           |
| `anilist`     | Stylized AL mark — AniList link                  | External link           |

**Decision: 21 custom icons.** This covers all anime-specific concepts not in Lucide. The external-link icons (Steam, Crunchyroll, MAL, AniList) are monochrome single-color versions of their logos, not full-color brand marks — they inherit `currentColor` to match the UI.

---

## Icon in Text Rules

When an icon appears inline with text:

| Context             | Icon Size        | Vertical Alignment      | Gap             |
| ------------------- | ---------------- | ----------------------- | --------------- |
| Icon + `text-xs`    | `icon-xs` (12px) | `-0.1em` (slight raise) | `space-1` (4px) |
| Icon + `text-sm`    | `icon-sm` (16px) | `baseline`              | `space-1` (4px) |
| Icon + `text-base`  | `icon-sm` (16px) | `-0.05em`               | `space-1` (4px) |
| Icon + `text-md`    | `icon-md` (20px) | `-0.1em`                | `space-2` (8px) |
| Icon + button label | `icon-sm` (16px) | `baseline`              | `space-2` (8px) |
| Icon before input   | `icon-sm` (16px) | `center`                | `space-2` (8px) |

---

## Touch Targets

Icons in interactive contexts must meet the 44×44px minimum touch target. If the visual icon is smaller, the clickable area is padded:

| Visual Size      | Touch Target | Padding (each side) |
| ---------------- | ------------ | ------------------- |
| `icon-sm` (16px) | 44×44px      | 14px                |
| `icon-md` (20px) | 44×44px      | 12px                |
| `icon-lg` (24px) | 48×48px      | 12px                |

**Decision: Padded touch targets, not larger visual size.** Making the icon 44px visually would be enormous. The clickable area is invisible padding around the icon.

---

## Loading States

Icons in loading states use a **skeleton circle** matching the icon's size:

| Icon Size        | Skeleton       | Style                          |
| ---------------- | -------------- | ------------------------------ |
| `icon-sm` (16px) | 16×16px circle | `void-6` fill, pulse animation |
| `icon-md` (20px) | 20×20px circle | Same                           |
| `icon-lg` (24px) | 24×24px circle | Same                           |

---

## Icon Rules

1. **Use semantic names**, not Lucide names, in JSX. `<Icon name="search" />`, not `<Search />`. This allows swapping the underlying library without touching component code.
2. **Icons do not have labels by default.** Add `aria-label` when the icon conveys information not available in surrounding text.
3. **Decorative icons** (those that duplicate adjacent text) use `aria-hidden="true"`.
4. **Interactive icons** (buttons that are icon-only) require `aria-label` — the label is the accessible name.
5. **Never use filled variants** for inactive states. Filled = active/selected/on.
6. **Custom icons must match Lucide's style** — 24×24 viewBox, 2px stroke, `round` line-cap and line-join.
7. **Export custom icons as React components** with `size` and `color` props, forwarding ref.
8. **Lazy-load icon component** via tree-shaking — import only used icons, not the entire library.
