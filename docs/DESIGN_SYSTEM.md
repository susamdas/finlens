# FinLens Design System

Status: **Phase 2** (done). You can see it in the running app (at `/design` from Phase 3 on).

## Principles

1. **Quiet chrome, meaningful color.** Surfaces are neutral ink and slate. Color is kept for data and state.
2. **Meaning is never color alone.** Every delta has an arrow and a signed value, every status has an icon and a label, and missing data is hatched.
3. **Missing ≠ zero.** Missing values show as `—` or "Data unavailable for the selected year." and use the hatch pattern.
4. **Descriptive, not judgemental.** Benchmark pills say _Above / Near / Below benchmark_, never "good" or "bad".

## Tokens

All tokens live in `src/styles/tokens.css` as CSS variables, with a light set on `:root` and a dark set on `.dark`. They are exposed to Tailwind in `globals.css` via `@theme inline`, so `bg-card`, `text-positive`, `fill-chart-1` and similar utilities work.

| Group        | Tokens                                                                     | Notes                                                                                               |
| ------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Surfaces     | `background`, `card`, `popover`, `muted`, `border`, `input`                | Light: cool gray page, white cards. Dark: deep navy page `#0b1120`, card `#111a2e`                  |
| Ink          | `foreground`, `muted-foreground`, `subtle-foreground`                      | Muted text is ≥4.5:1 on every surface. `subtle` is for icons only                                   |
| Brand        | `primary` (lens teal `#0f766e` / `#2dd4bf`), `accent`, `ring`              | White on primary is 5.5:1                                                                           |
| Semantic     | `positive`, `negative`, `warning`, `neutral` (+ `-soft` washes), `missing` | Each text color is ≥4.5:1 on page and card, in both themes                                          |
| Categorical  | `chart-1` … `chart-8`                                                      | Fixed, validated order. Never cycled. A 9th series folds into "Other" (`neutral`)                   |
| Sequential   | `seq-1` … `seq-7`                                                          | Blue ramp for magnitude (choropleth). In dark mode it's flipped so low values fade into the surface |
| Diverging    | `div-n3` … `div-0` … `div-p3`                                              | Red to gray to blue, for gaps and change                                                            |
| Chart chrome | `chart-grid`, `chart-axis`, `chart-label`, `chart-highlight`               | Grid and axes stay in the background                                                                |

`src/design/palette.ts` mirrors the chart hexes for libraries that need concrete colors (D3 interpolation, PNG export). `tests/unit/palette.test.ts` fails if the two drift apart.

### Palette validation

The categorical palette was checked with an automated validator for lightness band, chroma, colorblind (protan/deutan) separation, normal-vision separation, and contrast, on both chart surfaces.

| Mode (surface)    | Result                                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| Light (`#ffffff`) | Pass. Worst adjacent CVD ΔE 9.1, normal-vision ΔE 19.6                 |
| Dark (`#111a2e`)  | Pass. Worst adjacent CVD ΔE 8.4, normal-vision ΔE 19.3. All slots ≥3:1 |

**Usage rules that follow from validation:**

- In light mode, three slots (aqua, yellow, pink) are below 3:1 against white. Any chart using them must also show visible labels or offer a table view.
- For **scatter, map and small-multiple** views, where any two colors can sit side by side, use **at most 3 categorical hues at once**. With more groups, highlight one and mute the rest, or add shape encoding.
- Colors stick to the _entity_ (e.g. a region always gets the same slot). They are not assigned by rank, and filtering never repaints the remaining series.

## Typography

Inter Variable is self-hosted via `@fontsource-variable/inter`, so there is no external font request.

| Role             | Spec                 |
| ---------------- | -------------------- |
| Display          | 36 / 600 / −0.02em   |
| Page title       | 28 / 600             |
| Section          | 20 / 600             |
| Card title       | 15 / 600             |
| Body             | 14 / 400             |
| Secondary        | 13 / 400, muted      |
| Caption / source | 12–11.5 / 400, muted |
| KPI figure       | 28 / 600, `tabular`  |

Use the `tabular` utility (tabular numerals) wherever numbers align or animate: tables, axes, KPI values, deltas.

## Shape, elevation, motion

- Radius: `--radius` is 14px. Cards use `rounded-2xl`, controls `rounded-lg`.
- Elevation: `shadow-card` (resting), `shadow-raised` (hover), `shadow-overlay` (menus, dialogs, tooltips).
- The glass effect (`.glass`) is only for overlays: chart tooltips, the command palette and the sticky top bar.
- Motion: KPI count-up (0.8s ease-out) and Radix enter/exit animations. `prefers-reduced-motion` turns all motion off.

## Chart conventions (`components/charts/chart-theme.ts`)

- Lines are 2px with 8px dots at each survey point, ringed by the surface color.
- Projections use `projectionStyle()`: a dashed line with no dots. Never style them like observed data.
- Bars have 4px rounded tops, a 2px surface gap between them, and a maximum width of 36px.
- Hairline horizontal grid only, muted axis labels, and **never a second y-axis**.
- A tooltip is required on every chart (`ChartTooltip`). Values are in text ink; the swatch carries identity.
- A legend is required for 2 or more series. Direct labels are preferred for 4 or fewer.
- Gaps in a series break the line (`connectNulls: false`). A missing survey wave is never bridged.

## Components (Phase 2)

| Component                                     | Path                                    | Purpose                                                                                                                                                  |
| --------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| shadcn/ui primitives                          | `components/ui/*`                       | button, card, badge, input, select, tabs, toggle-group, tooltip, dropdown-menu, dialog, sheet, popover, command, table, scroll-area, separator, skeleton |
| `Logo`, `LogoMark`                            | `components/common/Logo.tsx`            | Lens + globe + rising line                                                                                                                               |
| `ThemeToggle`                                 | `components/common/ThemeToggle.tsx`     | Light / Dark / System, saved and applied before first paint                                                                                              |
| `SourceBadge`                                 | `components/common/SourceBadge.tsx`     | Source attribution                                                                                                                                       |
| `EmptyState`, `ErrorState`, `LoadingSkeleton` | `components/common/states.tsx`          | Layout-matching states                                                                                                                                   |
| `DeltaIndicator`                              | `components/common/DeltaIndicator.tsx`  | Change in pp with arrow and accessible label                                                                                                             |
| `BenchmarkStatus`                             | `components/common/BenchmarkStatus.tsx` | Above / Near / Below / No data                                                                                                                           |
| `InsightCard`                                 | `components/common/InsightCard.tsx`     | A data-derived finding with its evidence                                                                                                                 |
| `KPICard`                                     | `components/charts/KPICard.tsx`         | Value, delta, sparkline, hover explanation                                                                                                               |
| `Sparkline`                                   | `components/charts/Sparkline.tsx`       | D3 glyph that breaks on gaps                                                                                                                             |
| `ChartCard`                                   | `components/charts/ChartCard.tsx`       | Frame that owns chart states and the source line                                                                                                         |
| `ChartTooltip`                                | `components/charts/ChartTooltip.tsx`    | Shared Recharts tooltip                                                                                                                                  |

Tone rules live outside the components, in `lib/analytics/direction.ts` (`movementTone`, `classifyBenchmark`). The flat threshold is 0.5 pp and "near benchmark" means within ±2 pp. Both are named constants.

> The shadcn primitives were written by hand, following the shadcn new-york v4 source, because this build environment can't reach the shadcn registry. They use the same file names, APIs and `data-slot` attributes, so `npx shadcn add …` will work normally on your machine.
