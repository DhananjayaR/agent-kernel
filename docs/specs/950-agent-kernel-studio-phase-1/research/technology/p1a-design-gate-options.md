# P1a design gate: options for palette, fonts, density and theme

**Date:** 24 November 2026. **Gate steps covered:** 1 (requirements), 2 (review of the sketch) and 3 (options),
for the subjects in [P1a](../P1a-app-foundation.md#design-gate) that need no prototype to decide. Shell layout and
the base component set need step 4 (stories) and are not settled here. **Approved 25 November 2026 by Dhananjaya Rajasinghe: all four recommendations (palette A, fonts 1, density I, follow the system with dark when unknown).** Before that, nothing here was approved. The owner
picks; the pick is recorded in the P1a sign-off table and the README decision log.

## Sources

- The briefs: `00-project-brief.md` and `01-app-components.md` on `feature/950-agent-kernel-studio-phase-1`
  (unapproved input).
- The repository's current brand tokens: `docs/src/css/custom.css` (after the Open Agent Kernel rebrand).
- The Spectrum 2 measurements from spike S1 ([spike-s1-components.md](spike-s1-components.md)).
- Contrast is the WCAG 2 ratio, computed from the hex values below. Surfaces are the docs site's own:
  dark `#011428` (ground), `#02284F` (raised), `#0D315A` (overlay); light `#FFFFFF`, `#F1F5FA`, `#E7EEF7`.

## 1. Requirements (from the issue and the ground rules)

- The Studio looks like Agent Kernel.
- One primary colour (primary action, focus, selection); one colour that marks the coding agent and nothing
  else; success, warning and danger for states.
- All text is at least 4.5:1, including secondary labels and 12 px captions, in dark and light.
- Fonts are bundled; the app makes no network calls of its own.
- Size, shape and state follow Spectrum 2 (decided); floating layers are solid (decided in P0).

## 2. The sketch against the requirements

| Requirement | Briefs (00, 01) | Repository brand (`custom.css`) |
|---|---|---|
| Looks like Agent Kernel | Electric blue `#00DDFF` primary, near-black ground. This was the brand before the rebrand. | Orange `#FF5E32` primary, navy ground. The current brand. |
| Coding-agent colour | Magenta `#F200FF` | None defined |
| Fonts | Archivo for headings and buttons, Inter for body and UI, JetBrains Mono | Archivo for body, JetBrains Mono |
| Density | 8 px grid, 14 px base, **40 px controls and rows**, 48 px top bar | Marketing scale (not for an app) |
| Floating layers | Glass | n/a. **Superseded:** solid, decided in P0 |
| 4.5:1 everywhere | Required, not checked | Partly; see below |

## 3. Contrast, measured

Colour used as **text or a thin line** on each surface.

| Colour | Dark: ground | raised | overlay | Light: white | raised | overlay |
|---|---|---|---|---|---|---|
| Orange `#FF5E32` (brand primary) | 6.09 | 4.86 | **4.30** | **3.04** | **2.78** | **2.60** |
| Orange, darkened `#D23F17` (brand's light-theme text) | **3.94** | **3.15** | **2.78** | 4.70 | **4.30** | **4.03** |
| Electric blue `#00DDFF` (briefs' primary) | 11.30 | 9.01 | 7.97 | **1.64** | **1.50** | **1.41** |
| Magenta `#F200FF` (briefs' AI colour) | 5.49 | **4.38** | **3.88** | **3.38** | **3.08** | **2.89** |
| Ice `#B1CDFF` (brand blue, dark theme) | 11.52 | 9.19 | 8.13 | **1.61** | **1.47** | **1.38** |
| Dusk `#3F598A` (brand blue, light theme) | **2.66** | **2.12** | **1.87** | 6.98 | 6.38 | 5.98 |
| Muted text `#798BAD` (dark) | 5.40 | **4.31** | **3.81** | | | |
| Muted text `#5D7199` (light) | | | | 4.90 | **4.47** | **4.19** |
| Green `#26A64D` | 5.87 | 4.68 | **4.14** | **3.16** | **2.89** | **2.70** |
| Red `#DB4444` | **4.35** | **3.47** | **3.07** | **4.27** | **3.90** | **3.65** |
| Warning `#F7A544` | 9.21 | 7.34 | 6.50 | **2.02** | **1.84** | **1.72** |

Bold is below 4.5:1. Text on a filled control: dark navy `#011428` on orange 6.09; white on orange 3.04 (fails);
dark navy on electric blue 11.30; white on magenta 3.38 (fails); dark navy on magenta 5.49.

**What this means, whichever palette is chosen:**

- **Neither palette passes as is.** The brand's raised and overlay surfaces are where panels, menus and modals
  sit, and its muted text, danger and success colours fail there. The app needs its own text-on-surface tokens:
  each role colour gets a "text" variant per theme and per surface level, tuned to 4.5:1. The docs site
  already does this once (`--ak-primary-text: #D23F17`, "darkened to 4.6:1 on white").
- **Electric blue and magenta cannot be used as text in a light theme.** They would need dark variants, which
  no longer look like the same colour.
- **Fills are safe with dark text:** orange, electric blue and magenta fills all pass with `#011428` on top.
  White text on orange or magenta fails.

## 4. Options

### Palette

| | A. Current brand (recommended) | B. The briefs | C. Brand with a magenta agent colour |
|---|---|---|---|
| Primary | Orange `#FF5E32`, dark text on fills | Electric blue `#00DDFF` | Orange |
| Coding agent | Ice `#B1CDFF` (dark) / dusk `#3F598A` (light), from the brand | Magenta `#F200FF` | Magenta, with a darker light-theme variant |
| Ground | Navy `#011428` | Near-black | Navy |
| For | Matches the docs site and the rebrand; the agent colour passes in both themes; nothing to invent | Matches the briefs and the unapproved canvas | Agent colour stands out more from orange than ice does |
| Against | Ice and the primary-on-surface still need tuned text variants | Not the current brand; fails badly in light theme | Magenta is not in the brand; fails as text in light theme without a new variant |

**Recommendation: A.** The repository was rebranded after the briefs were written; the Studio should look like
the current docs site. Orange and ice are distinct in hue, and ice passes as text in dark (8.1 or more) and
dusk in light (6.0 or more).

### Fonts

| | 1. Inter for UI, Archivo for headings, JetBrains Mono (recommended) | 2. Archivo everywhere, JetBrains Mono |
|---|---|---|
| For | Inter is built for small UI text and has tabular figures; matches the briefs; Archivo keeps the brand in headings | Matches the docs site exactly |
| Against | Two text families to bundle | Archivo is a display face; dense 12 to 14 px UI is harder to read |

All three families are under the SIL Open Font License and can be bundled. **Recommendation: 1.**

### Density

| | I. Spectrum 2 medium (recommended) | II. The briefs | III. Both, with a switch |
|---|---|---|---|
| Controls | 32 px | 40 px | 32 or 40 |
| Rows (tables, trees) | 40 px (32 compact in tables only) | 40 px | 32 or 40 |
| Base text | 14 px | 14 px | 14 px |
| Top bar | 48 px | 48 px | 48 px |
| For | The decided style reference; S1 already measured and built it | Roomier | Covers both tastes |
| Against | Denser than the briefs' artboards | Departs from the style reference | Every component and story twice; visual regression doubles |

**Recommendation: I**, one density. A compact table mode can be added per table later.

### Default theme

| | Follow the system setting, dark when unknown (recommended) | Dark | Light |
|---|---|---|---|
| For | Respects the user; dark matches the brand's navy ground and the docs site's default | Brand-first | Common for long reading |
| Against | Two themes always maintained (they are anyway) | Ignores a light-mode user | Brand colours are weaker on white |

## 5. Not settled here

- **Shell layout** (five tabs plus controls at 1100 px, window controls, where settings open): needs the shell
  stories (gate step 4).
- **Base component set:** proposed in the P1a plan as only what P2 and P3 use; approved with the stories.
- **Exact text-variant hex values** for each role and surface: produced with the token stories, once the
  palette is chosen, and checked by the accessibility test on every story. Done: see section 6.

## 6. Final values (Task 8, 25 November 2026)

The approved picks as tokens in `ak-studio/packages/ui/src/theme.css`; the naming (fill, `text-*`, `on-*`,
`border-control`, `focus-ring`) is documented at the top of that file.

**How the text values were computed.** Each text role starts from its brand colour and changes only its OKLCH
lightness (hue kept; chroma clipped into sRGB where a lighter value leaves the gamut), by the smallest step that
gives at least 4.6:1 on the hardest surface of its theme (the overlay). 4.6 leaves a margin over 4.5, since axe
passes a pair only when its ratio is strictly above 4.5. Non-text lines use the same method with 3.1. Because the
overlay is the hardest surface in both themes, **one value per role per theme passes on all three surfaces; no
per-surface variant was needed.** Values that already passed keep the brand colour (`text`, ice, dusk, dark
warning).

Two values go past the minimum. Tuned to the same ratio, the brand's orange and red converge (dark `#FF6A42`
against `#FF6863`; light `#C53500` against `#C73034`), so danger and primary text would look the same. The brand
keeps red darker than orange; the final values keep that order: dark primary text is the brand's own
`--ak-primary-light` `#FF8260` (5.37:1 at worst), and light danger text is tuned to 6:1 (`#B11221`).

The brand red `#DB4444` fails as a fill with both navy (4.35) and white (4.27) text, so the danger fill is
darkened to `#D43D3E` with white text. Every other fill keeps the pure brand colour.

Ratios below are computed from the hex values in `theme.css` with the WCAG 2 formula (the same code as the token
story), rounded to two decimals. The token story renders every text and on-fill pair
as 14 px text in both themes; `pnpm test:storybook` fails when any drops to 4.5:1 or below (axe's
`color-contrast` rule and the story's own assertion), or when `border-control` or `focus-ring` drops below 3:1.

| Token | Kind | Dark | ground / raised / overlay | Light | ground / raised / overlay | Worst case |
|---|---|---|---|---|---|---|
| `surface` | surface | `#011428` | | `#FFFFFF` | | |
| `surface-raised` | surface | `#02284F` | | `#F1F5FA` | | |
| `surface-overlay` | surface | `#0D315A` | | `#E7EEF7` | | |
| `text` | text (4.5) | `#EAF3F8` | 16.50 / 13.16 / 11.64 | `#02284F` | 14.80 / 13.52 / 12.66 | 11.64 |
| `text-muted` | text (4.5) | `#889ABD` | 6.54 / 5.22 / 4.62 | `#576A92` | 5.41 / 4.94 / 4.63 | 4.62 |
| `text-accent-primary` | text (4.5) | `#FF8260` | 7.61 / 6.07 / 5.37 | `#C53500` | 5.41 / 4.94 / 4.63 | 4.63 |
| `text-accent-ai` | text (4.5) | `#B1CDFF` | 11.52 / 9.19 / 8.13 | `#3F598A` | 6.98 / 6.38 / 5.98 | 5.98 |
| `text-status-success` | text (4.5) | `#32AF55` | 6.54 / 5.21 / 4.61 | `#007B31` | 5.42 / 4.95 / 4.63 | 4.61 |
| `text-status-warning` | text (4.5) | `#F7A544` | 9.21 / 7.34 / 6.50 | `#995C00` | 5.40 / 4.94 / 4.63 | 4.63 |
| `text-status-danger` | text (4.5) | `#FF6863` | 6.55 / 5.22 / 4.62 | `#B11221` | 7.05 / 6.44 / 6.03 | 4.62 |
| `border-control` | non-text (3) | `#597EAE` | 4.43 / 3.54 / 3.13 | `#7D8794` | 3.64 / 3.33 / 3.12 | 3.12 |
| `focus-ring` | non-text (3) | `#FF5E32` | 6.09 / 4.86 / 4.30 | `#EF4E20` | 3.63 / 3.32 / 3.11 | 3.11 |
| `border-default` | decorative | `#173964` | 1.60 / 1.27 / 1.13 | `#D3DEEC` | 1.36 / 1.24 / 1.16 | n/a (decorative) |

| Fill | Dark fill / on-fill | ratio | Light fill / on-fill | ratio |
|---|---|---|---|---|
| `accent-primary` / `on-accent-primary` | `#FF5E32` / `#011428` | 6.09 | `#FF5E32` / `#011428` | 6.09 |
| `accent-ai` / `on-accent-ai` | `#B1CDFF` / `#011428` | 11.52 | `#3F598A` / `#FFFFFF` | 6.98 |
| `status-success` / `on-status-success` | `#26A64D` / `#011428` | 5.87 | `#26A64D` / `#011428` | 5.87 |
| `status-warning` / `on-status-warning` | `#F7A544` / `#011428` | 9.21 | `#F7A544` / `#011428` | 9.21 |
| `status-danger` / `on-status-danger` | `#D43D3E` / `#FFFFFF` | 4.63 | `#D43D3E` / `#FFFFFF` | 4.63 |

`border-default` is a decorative divider only (panel edges, table rules); a control's boundary uses
`border-control`.

**Fonts:** `font-ui` Inter for UI and body text, and for button labels (one face across every control in a row;
Archivo is kept for headings); `font-heading` Archivo, the default for `h1` to `h6`; `font-mono` JetBrains Mono for
code, paths and identifiers, and `mono-figures` (JetBrains Mono with tabular figures) for durations, token counts
and money. **Density:** Spectrum 2 medium, one density (`control-m` 32 px, `row` 40 px, `row-compact` 32 px in
tables only, `text-ui` 14 px base, `topbar` 48 px). **Default theme:** the stored preference defaults to
`system`; `system` follows `prefers-color-scheme` and is dark when the system reports neither dark nor light
(`ak-studio/apps/renderer/src/theme.ts`).
