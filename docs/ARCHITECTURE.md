# FinLens — Architecture

> A modern intelligence layer for understanding global financial inclusion.
> Built on the World Bank Global Findex Database.

Status: Phases 1–18 complete (see [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), [DATA_MODEL.md](DATA_MODEL.md))

---

## 1. Recommended architecture

FinLens is a **static-first single-page application**. The Global Findex dataset is small
(≈150 economies × 5 survey waves × a few hundred indicators ≈ tens of thousands of values), so
the whole analytical engine runs in the browser. No backend is required to launch; one is added
later only for things the browser cannot do safely (holding an LLM API key).

```
┌─────────────────────────────── Browser ────────────────────────────────┐
│                                                                        │
│  UI layer          features/*  ──uses──►  components/* (ui, charts, map)│
│    │  reads state + derived data via hooks                             │
│    ▼                                                                   │
│  State layer       store/ (Zustand: filters, theme, compare set)       │
│    │               lib/url  (filters ⇄ URL query params, shareable)    │
│    ▼                                                                   │
│  Domain layer      lib/analytics  (aggregates, benchmarks, Pearson,    │
│  (pure TS, no      │               regression, change metrics)         │
│   React imports)   lib/insights   (rule-based insight engine)          │
│                    lib/forecast   (ForecastModel implementations)      │
│                    lib/query      (AnalystProvider: rules → LLM)       │
│    ▼                                                                   │
│  Data layer        data/repository (DataRepository interface)          │
│                    data/indicators (indicator metadata registry)       │
│                    ├─ StaticJsonRepository  ◄── /public/data/*.json    │
│                    └─ ApiRepository (future) ◄── REST                  │
└────────────────────────────────────────────────────────────────────────┘
          ▲ build time                                ▲ Phase 15 (optional)
  scripts/build-data.mjs                     Serverless LLM proxy
  raw Findex CSV → validated, normalized JSON   (Vercel/Netlify function —
                                                 keeps API keys server-side)
```

### Key decisions

| Decision    | Choice                                                             | Why                                                               |
| ----------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Build tool  | Vite 8 + React 19 + TypeScript (strict)                            | Fast dev loop, native code-splitting                              |
| Styling     | Tailwind CSS v4 + shadcn/ui (new-york, CSS variables)              | Tokens as CSS vars → clean light/dark theming                     |
| Routing     | React Router 7                                                     | URL is the source of truth for shareable views (§24)              |
| State       | Zustand                                                            | Tiny, no provider nesting, selector-based re-renders              |
| Charts      | Recharts (standard charts), D3 (scales, geo, heatmaps, custom SVG) | Recharts for speed; D3 where control matters                      |
| World map   | `d3-geo` + `topojson-client` + a pre-simplified world TopoJSON     | Avoids unmaintained React map wrappers; full zoom/pan control     |
| Data format | CSV → JSON at **build time**                                       | Browser never parses the raw CSV; deterministic, validated output |
| AI Analyst  | `AnalystProvider` interface; rule-based first                      | Works offline, never invents numbers; LLM plugs in later          |
| Tests       | Vitest + Testing Library (unit), Playwright (e2e, Phase 18)        | Same config as Vite                                               |
| Deploy      | Vercel or Netlify (SPA rewrites included)                          | Static hosting; serverless function slot for LLM proxy            |

### Non-negotiable rules (carried through every phase)

1. **No fabricated data.** Missing values are `null`, rendered as "Data unavailable for the selected year." — never 0, never interpolated silently.
2. **Business logic stays out of components.** Anything computational lives in `lib/` as pure, unit-tested functions.
3. **No country-specific code paths.** The Bangladesh page is `/focus/bangladesh` — the same component works for any country; peers are configuration.
4. **Indicators are configuration.** Adding an indicator = one registry entry + one column mapping.
5. **Every chart shows its source** (`SourceBadge`: World Bank Global Findex Database).
6. **Correlation ≠ causation** and **forecasts ≠ official World Bank projections** are stated wherever those features appear.
7. **Composite index is labelled "Experimental FinLens Inclusion Index"** with visible methodology and weights.

---

## 2. Folder structure

```
finlens/
├─ docs/ARCHITECTURE.md          ← this file
├─ index.html
├─ public/
│  ├─ data/raw/                  Findex CSV drop zone (git-ignored)
│  ├─ data/processed/            Generated JSON consumed by the app
│  └─ geo/                       Simplified world TopoJSON (Phase 6)
├─ scripts/build-data.mjs        Findex XLSX → JSON pipeline (Phase 4)
├─ src/
│  ├─ main.tsx                   Entry point
│  ├─ app/                       App root, router, providers (Phase 3)
│  ├─ config/
│  │  ├─ env.ts                  Typed env access
│  │  └─ routes.ts               Route registry → router, sidebar, search
│  ├─ types/contracts.ts         Layer seams: DataRepository, AnalystProvider, ForecastModel
│  ├─ data/
│  │  ├─ indicators/             Indicator metadata registry
│  │  ├─ repository/             StaticJsonRepository (+ ApiRepository later)
│  │  └─ transforms/             Normalization helpers shared with the pipeline
│  ├─ lib/                       Pure domain logic — no React
│  │  ├─ analytics/              aggregates, benchmarks, stats, correlation
│  │  ├─ insights/               rule-based insight engine
│  │  ├─ forecast/               linear, moving-average, trend models
│  │  ├─ query/                  natural-language interpreter / AI providers
│  │  ├─ format/                 number, %, pp, date formatting
│  │  ├─ url/                    filter ⇄ query-string codecs
│  │  ├─ export/                 CSV, PNG, summary export
│  │  └─ utils.ts                cn() class merge
│  ├─ store/                     Zustand stores (filters, UI prefs, compare set)
│  ├─ hooks/                     React bindings to store + domain logic
│  ├─ components/
│  │  ├─ ui/                     shadcn/ui primitives (generated)
│  │  ├─ layout/                 DashboardLayout, Sidebar, TopNavigation
│  │  ├─ charts/                 KPICard, LineChartCard, ScatterChart, RadarChart, Heatmap, ForecastChart…
│  │  ├─ map/                    WorldMap, MapLegend, MapTooltip
│  │  └─ common/                 EmptyState, ErrorState, LoadingSkeleton, SourceBadge, ExportMenu, selectors
│  ├─ features/                  One folder per page/module, lazy-loaded
│  │  ├─ home/  overview/  map/  countries/  regions/  compare/  gaps/
│  │  ├─ digital/  correlation/  trends/  forecast/  rankings/
│  │  ├─ composite-index/  microfinance/  country-focus/  story/
│  │  └─ analyst/  explorer/  about/
│  └─ styles/globals.css         Tailwind + design tokens (Phase 2)
└─ tests/
   ├─ setup.ts
   ├─ unit/                      Vitest
   └─ e2e/                       Playwright (Phase 18)
```

Each `features/<name>/` folder follows the same internal layout once built:

```
features/compare/
├─ ComparePage.tsx        route component (lazy-loaded default export)
├─ components/            feature-only components
├─ useCompareModel.ts     hook: store + repository → view model
└─ compare.logic.ts       feature-specific pure logic (+ .test.ts)
```

Dependency direction is one-way: `features → components → hooks → store / lib → data`.
`lib/` and `data/` never import React.

---

## 3. Data model (finalized in Phase 4 — full detail in [DATA_MODEL.md](DATA_MODEL.md))

Storage is **long/tidy** (one row per country × year × indicator) because it makes filtering,
ranking, trends and correlations uniform. A wide per-country-year view (as in the brief's
example) is derived on demand for display.

```ts
// Reference data
Country   { code: 'BGD', name, slug, region, incomeGroup, iso2, population? }
Region    { id: 'SAS', name: 'South Asia', slug }
IndicatorDefinition {
  id: 'accountOwnership', label, shortLabel, unit: '%' | 'pp',
  category: 'access' | 'usage' | 'savings' | 'borrowing' | 'digital' | 'equality',
  description, source: 'World Bank Global Findex',
  findexCode,            // column code in the raw CSV
  higherIsBetter: boolean,
  derived?: { formula }  // e.g. genderGap = male − female
  breakdowns?: ['sex','income','education','age','urbanicity','labor']
}

// Facts
Observation { countryCode, year, indicatorId, breakdown?, value: number | null }
```

Aggregates (regional, income-group, global) come from the Findex CSV where the World Bank
publishes them; where they don't, FinLens computes them and labels them as computed, stating
the method (simple vs population-weighted) on the About the Data page.

---

## 4. UI design system (outline — built in Phase 2)

- **Tokens as CSS variables** on `:root` / `.dark`: surface, border, text tiers, brand, and
  semantic colors — `positive`, `negative`, `neutral`, `warning`, `missing`.
- **Brand**: deep ink navy + teal accent (trust, development finance), restrained use of color.
- **Chart palette**: one sequential ramp (choropleth), one diverging ramp (gaps, change),
  6–8 categorical hues for regions — each validated for contrast in light and dark.
- **Typography**: Inter (UI) with tabular numerals for KPIs and tables.
- **Surfaces**: rounded-2xl cards, 1px soft borders, low shadow; glass only on overlays.
- **Motion**: Framer Motion for KPI count-ups and page transitions; respects `prefers-reduced-motion`.

---

## 5. Page structure

| Route                          | Page                                       | Spec § |
| ------------------------------ | ------------------------------------------ | ------ |
| `/`                            | Landing hero + preview                     | 33     |
| `/overview`                    | Executive dashboard                        | 5, 31  |
| `/map`                         | Interactive world map                      | 6      |
| `/countries`, `/country/:slug` | Country list, Country Intelligence Profile | 7      |
| `/regions`, `/region/:slug`    | Regional deep dive                         | 8      |
| `/compare`                     | Up to 5 countries                          | 9      |
| `/gaps`                        | Inclusion Gap Analyzer                     | 10     |
| `/digital`                     | Digital Finance Intelligence               | 11     |
| `/correlation`                 | Correlation Explorer                       | 12     |
| `/trends`                      | Trend Explorer                             | 13     |
| `/forecast`                    | Forecasting                                | 14     |
| `/rankings`                    | Indicator rankings                         | 19     |
| `/index-lab`                   | Experimental composite index               | 20     |
| `/microfinance`                | Microfinance Lens                          | 21     |
| `/focus/:slug`                 | Country focus (default: Bangladesh)        | 22     |
| `/story`                       | Data Story mode                            | 23     |
| `/analyst`                     | AI Financial Inclusion Analyst             | 16     |
| `/explorer`                    | Data Explorer                              | 18     |
| `/about`                       | About the Data                             | 25     |

Shared filter state (year, region, income group, metric, country) is encoded in the URL,
e.g. `/country/bangladesh?year=2021&metric=accountOwnership`.

---

## 6. Reusable component architecture

| Layer        | Components                                                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout       | `DashboardLayout`, `Sidebar`, `TopNavigation`, `MobileDrawer`, `CommandPalette`                                                                       |
| Filters      | `GlobalFilters`, `CountrySelector`, `RegionSelector`, `YearSelector`, `MetricSelector`                                                                |
| Data display | `KPICard` (value, delta, sparkline), `InsightCard`, `ComparisonTable`, `DataTable`                                                                    |
| Charts       | `ChartCard` (frame: title, legend, source, export) wrapping `BarChartCard`, `LineChartCard`, `ScatterChart`, `RadarChart`, `Heatmap`, `ForecastChart` |
| Map          | `WorldMap`, `MapLegend`, `MapTooltip`                                                                                                                 |
| Profile      | `CountryProfileHeader`, `Scorecard`                                                                                                                   |
| AI           | `AIAnalystPanel`                                                                                                                                      |
| States       | `EmptyState`, `LoadingSkeleton`, `ErrorState`                                                                                                         |
| Meta         | `SourceBadge`, `ExportMenu`                                                                                                                           |

Every chart is wrapped by `ChartCard`, which owns loading/empty/error states, the source label,
and PNG/CSV export — so individual charts only render data.

---

## 7. Implementation roadmap

| Phase | Deliverable                                                                   | Needs from you        |
| ----- | ----------------------------------------------------------------------------- | --------------------- |
| 1 ✅  | Architecture, tooling, folder structure, layer contracts                      | —                     |
| 2 ✅  | Design system: tokens, theme, typography, base shadcn components              | —                     |
| 3 ✅  | App shell: router, lazy routes, sidebar, top nav, mobile drawer, theme toggle | —                     |
| 4 ✅  | Data model + CSV→JSON pipeline + indicator registry + repository              | **Global Findex CSV** |
| 5 ✅  | Global dashboard (KPIs, insights panel, previews)                             | —                     |
| 6 ✅  | Interactive world map                                                         | —                     |
| 7 ✅  | Country Intelligence Profiles                                                 | —                     |
| 8 ✅  | Regional analysis                                                             | —                     |
| 9 ✅  | Comparison engine                                                             | —                     |
| 10 ✅ | Gap analysis                                                                  | —                     |
| 11 ✅ | Correlation explorer                                                          | —                     |
| 12 ✅ | Trend analytics                                                               | —                     |
| 13 ✅ | Forecasting                                                                   | —                     |
| 14 ✅ | Insight engine                                                                | —                     |
| 15 ✅ | AI Analyst (rules → optional LLM proxy)                                       | LLM choice, if any    |
| 16 ✅ | Export & sharing                                                              | —                     |
| 17 ✅ | Mobile optimization                                                           | —                     |
| 18 ✅ | Testing & deployment                                                          | Hosting account       |

Rankings, Digital Finance, Microfinance Lens, Country Focus, Composite Index and Story Mode are
built on top of the engines from Phases 8–14 and slot into the nearest phase.

---

## 8. Application shell (Phase 3)

| Concern        | Implementation                                                                                                                                                                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routing        | `app/router.tsx` builds React Router routes from `config/routes.ts`. Each page is a lazy chunk (`PAGES` map). Routes without a built page show `PlannedPage`, which names the phase that delivers it                                                            |
| Layout         | `DashboardLayout` has a skip link, a desktop `Sidebar` (collapsible to an icon rail, saved in the browser), a mobile `MobileNav` drawer, a sticky `TopNavigation`, `<main id="main">`, and a footer with the source note                                        |
| Global filters | `lib/url/filters.ts` (pure parse/serialize, validated) plus `hooks/useFilters`. Year, region, income, metric and country live in the query string, so any view can be shared by its link. Updates use `replace` so filter changes don't fill up the back button |
| Search         | `CommandPalette` opens with ⌘K / Ctrl+K or `/`. It uses word-prefix matching (`lib/query/search.ts`). Pages and actions are searchable now; countries, regions and indicators join in Phase 4                                                                   |
| Selectors      | `CountrySelector` (searchable combobox) and `YearSelector` read from `hooks/useReferenceData`. Until data exists they are disabled with an explanation; no options are invented                                                                                 |
| Export         | `ExportMenu`: copy link and print work everywhere. Pages that have exportable content supply the PNG, CSV and summary actions                                                                                                                                   |
| Accessibility  | Page title and a screen-reader announcement update on every navigation, focus moves to the page `<h1>`, the active link gets `aria-current`, all controls have labels, and it works fully by keyboard                                                           |
| Resilience     | Route-level error boundary (and a prompt to reload when a newer build's chunk fails to load), a 404 page, a loading bar during navigation, and a skeleton while pages load                                                                                      |

Adding a real page later is one line in `PAGES`, for example `overview: () => import('@/features/overview/OverviewPage')`.

---

## 9. Global dashboard (Phase 5)

| Piece          | Where                                                | Notes                                                                                                                                                                                                                               |
| -------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home / landing | `features/home`                                      | Hero, headline statistics, regional snapshot, featured countries, and a capabilities grid. Every number comes from the dataset                                                                                                      |
| Overview       | `features/overview`                                  | One filter row (year · scope · metric) stored in the URL. It drives 8 KPI cards, distribution and region bars, a trend chart, digital finance, the gender gap, a correlation preview, countries to explore, and insights            |
| View model     | `overview.logic.ts` → `buildOverview(repo, filters)` | Pure function; the page only renders its output                                                                                                                                                                                     |
| Scope          | `lib/analytics/scope.ts`                             | World, Developing economies, a region, or an income group. Each maps to a **published World Bank aggregate**                                                                                                                        |
| World fallback | `scopeSourceFor` / `scopeValue`                      | The Findex 2025 file publishes usage indicators (payments, savings, borrowing) only for developing economies. For the World scope FinLens shows the Developing-economies figure and **labels it**. It never estimates a world value |
| KPIs           | `lib/analytics/kpi.ts`                               | Value, change vs the previous wave with data, a sparkline, and the source aggregate                                                                                                                                                 |
| Movers / ranks | `lib/analytics/movers.ts`                            | Only economies measured in both waves. Tied values share a rank                                                                                                                                                                     |
| Statistics     | `lib/analytics/stats.ts`                             | Pearson correlation and OLS fit. Correlation is not reported below `MIN_CORRELATION_N` (10) economies                                                                                                                               |
| Insights       | `lib/insights/overview.ts`                           | 8 rules. A rule with missing inputs produces nothing. Each insight states the aggregate and waves it uses and links to a deeper view                                                                                                |
| Charts         | `components/charts`                                  | `TrendChart` (a numeric wave axis, so the uneven gaps between waves are shown truthfully), `BarList`, `DumbbellChart`, `ScatterPlot` (hover picks the nearest point). `ChartCard` has a data-table toggle on every chart            |

---

## 10. Interactive world map (Phase 6)

| Piece        | Where                                                                  | Notes                                                                                                                                                                                                                                                                                                                                          |
| ------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Basemap      | `scripts/build-geo.mjs` → `public/geo/world.json` (325 KB, 95 KB gzip) | Natural Earth 1:50m from `world-atlas` (public domain). IDs are re-keyed to ISO3, Antarctica is removed, and shapes are simplified. All 162 Findex economies are mapped (Kosovo is matched by name)                                                                                                                                            |
| Flags        | `public/flags/<iso2>.svg` (162 files)                                  | Copied from `flag-icons` (MIT) by the same script. `Flag` falls back to an ISO badge if a file is missing                                                                                                                                                                                                                                      |
| Component    | `components/map/WorldMap.tsx`                                          | d3-geo Equal Earth projection and d3-zoom. Paths are projected once per size; zoom only transforms a group. Borders stay the same width at any zoom (`vector-effect`). Small economies get a dot. Economies with no data are hatched. Props: `focusCodes` (fade other economies and zoom to the focus) and `selectedCode` (highlight and zoom) |
| Controls     | zoom in/out, reset, full screen (Fullscreen API)                       | Keyboard: focus the map, then + / − to zoom, arrows to pan, 0 to reset. Exact values are also reachable through the table view and the country finder                                                                                                                                                                                          |
| Colour scale | `lib/analytics/choropleth.ts`                                          | Percentages use a sequential ramp with round class widths (0·15·30… or 0·10·20…), at most 7 classes. Gaps in percentage points use a diverging ramp centred on 0, with the warm side for "worse"                                                                                                                                               |
| Map logic    | `features/map/map.logic.ts`                                            | Metric list (including female and male account ownership), values, ranks, median, regional averages, economies with no data, and tooltip rows                                                                                                                                                                                                  |
| Page         | `/map?metric=…&year=…&country=…`                                       | Map, detail panel (hover or selection), highest and lowest lists, and a coverage note. Clicking a country opens its profile                                                                                                                                                                                                                    |
| Overview     | row 2                                                                  | The map (with Highest / Lowest ranking tabs) replaces the ranked list. With a region scope, other economies fade and the map zooms to the region                                                                                                                                                                                               |

Refresh assets after the economy list changes: `npm run data:build && npm run geo:build`.

---

## 11. Country Intelligence Profiles (Phase 7)

| Piece            | Where                                                                | Notes                                                                                                                                                                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes           | `/countries`, `/country/:slug?year=&benchmark=region\|income\|world` | An unknown slug shows a friendly "not found" message. The profile opens at the economy's latest wave with data                                                                                                                                                                        |
| Profile logic    | `features/countries/profile.logic.ts`                                | `buildProfile` (KPIs, scorecard, strengths and gaps), `benchmarkMatrix`, `demographics`. Pure functions                                                                                                                                                                               |
| Header           | `components/profile/CountryProfileHeader`                            | Flag, region and income group, adult population, wave (and the actual survey year when it differs), wave and benchmark selectors, and Compare, Map and Export actions                                                                                                                 |
| KPIs             | 6 cards                                                              | Account ownership, mobile money, digital payments, formal savings, formal borrowing and the gender gap. Each shows the change vs the previous wave, a sparkline, and the benchmark value                                                                                              |
| Scorecard        | 17 indicators                                                        | `classifyBenchmark` places a value within ±2 pp as **Near**. Indicators with a direction get **Above / Below**; for a lower-is-better indicator, "Above" is worded as **Lower than benchmark**. Neutral indicators (e.g. borrowing) get **Higher / Lower** in grey, with no judgement |
| Strengths & gaps | top 5 each                                                           | Only indicators with a direction, ranked by favourable or unfavourable distance from the chosen benchmark                                                                                                                                                                             |
| Benchmark strip  | `components/profile/BenchmarkStrip`                                  | Country bar vs region (◆), income group (■) and world (●). Benchmarks are told apart by shape as well as label                                                                                                                                                                        |
| Demographics     | `components/profile/GapRows`                                         | Loads the other population groups on demand. Shows 6 breakdowns for a chosen indicator, with the gap in pp and a trend (narrowed / widened / stable, ±1 pp) vs the previous wave where both groups were published                                                                     |
| Insights         | `lib/insights/country.ts`                                            | 8 country rules. `compareChanges` gets the wording right in every direction (for example "declined less than")                                                                                                                                                                        |
| Countries list   | `features/countries/CountriesPage` + `countries.logic.ts`            | Search, filter by region and income group (stored in the URL), sortable columns (missing values always last), each economy's latest wave, and a flag                                                                                                                                  |

---

## 12. Regional analysis (Phase 8)

| Piece            | Where                                           | Notes                                                                                                                                                                                                                                                                             |
| ---------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes           | `/regions?year=`, `/region/:slug?year=&metric=` | 6 developing regions plus the High-income group. An unknown slug shows "not found"                                                                                                                                                                                                |
| Logic            | `features/regions/region.logic.ts`              | `buildRegionModel`: KPIs from the **published regional aggregate**, ranking of member economies (change vs each one's previous wave, and difference from the region), spread per indicator (min, median, max, aggregate), and region vs global. `regionsTable` for the index page |
| Global benchmark | `worldRef`                                      | The world aggregate, or Developing economies where Findex publishes no world figure (usage indicators). Always labelled                                                                                                                                                           |
| Region page      | `RegionPage.tsx`                                | 6 KPIs · a map zoomed to the region with others faded · regional insights · a sortable ranking table with a bar comparison · a trend chart vs global · a region vs global table (Above / Near / Below, neutral Higher / Lower) · the spread chart                                 |
| Spread chart     | `components/charts/DotStrip.tsx`                | One dot per economy on 0–100%, the aggregate as ◆ and the median as a tick. Hover names the economy; click opens its profile; the table view shows the exact values                                                                                                               |
| Regions index    | `RegionsPage.tsx`                               | Region cards (value, change, sparkline, mobile money, gender gap), a side-by-side comparison table with a global row, and a 7-line trend chart. Colours stay fixed per region                                                                                                     |
| Insights         | `lib/insights/region.ts`                        | Change, vs world, top improver, widest spread, and the gender gap                                                                                                                                                                                                                 |

## 13. Comparison engine and Rankings (Phase 9)

| Piece        | Where                                                                                | Notes                                                                                                                                                                                                                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes       | `/compare?countries=BGD,IND&year=`, `/rankings?metric=&year=&region=&income=&order=` | `?countries=` wins; a single `?country=` (e.g. from a profile) seeds regional peers. Unknown codes and aggregates are dropped; max 5                                                                                                                                                                                                                |
| Logic        | `features/compare/compare.logic.ts`                                                  | `parseCountries`, `suggestPeers` (most populous regional peers), `buildCompare` (value, previous wave, change per metric and economy; World reference with labelled fallback to Developing economies; best/worst only for indicators with a direction, gaps judged by size), `assignSlots` (colour follows the economy while the selection changes) |
| Compare page | `ComparePage.tsx`                                                                    | Chips with add/remove, quick picks, year · key-differences summary · a card per metric · grouped bars · radar (only axes published for every drawn economy; an economy with no survey in the wave is left off and named) · trend chart with metric switch · full table with changes                                                                 |
| Summary      | `lib/insights/compare.ts`                                                            | Highest vs lowest per metric, "similar" under 2 pp, widest/narrowest gap (a negative gap is described as reversed), account-ownership momentum, missing values listed. Descriptive only                                                                                                                                                             |
| Rankings     | `features/rankings/`                                                                 | One indicator at a time — there is **no overall "best country" score**. Competition ranking (ties share a rank), highest or lowest first, region/income filters, search. Columns: rank, economy, region, value, previous value (wave), change, difference from the regional aggregate. Economies without a value are listed, never ranked           |
| Shared       | `components/charts/WrapTick.tsx`                                                     | Two-line category ticks for long indicator names                                                                                                                                                                                                                                                                                                    |

## 14. Inclusion gap analysis (Phase 10)

| Piece          | Where                                                                                                                                         | Notes                                                                                                                                                                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route          | `/gaps?breakdown=&metric=&year=&region=\|income=`                                                                                             | Six breakdowns from the Findex file: sex, household income, education, age, labor force, location (rural/urban is published for 2024 only — other waves show an empty state naming the waves that exist)                                                                           |
| Definition     | `features/gaps/gaps.logic.ts`                                                                                                                 | Gap = advantaged − disadvantaged group, in pp, from the two **published** group values. Negative = reversed. Size change = \|gap\| − \|previous gap\|; under 1 pp is "stable". 12 indicators with broad group coverage                                                             |
| Aggregates     | `scopeSourceFor`                                                                                                                              | World, developing, region or income-group aggregate; where World has no group figure (usage indicators) the developing-economies aggregate is used and labelled                                                                                                                    |
| Page           | `GapsPage.tsx`                                                                                                                                | Breakdown tabs · group and gap KPIs with change · all breakdowns at a glance (`GapRows`) · insights · widest/smallest gaps (dumbbells) · gap vs overall level scatter with r (n ≥ 10, "correlation is not causation") · gaps over time for all breakdowns · sortable economy table |
| Insights       | `lib/insights/gaps.ts`                                                                                                                        | Headline gap, change since previous wave, widest gap, reversed gaps, narrowed/widened counts, and the level–gap association (labelled as association)                                                                                                                              |
| Shared changes | `ScatterPlot` (`yDomain`, `yUnit: 'pp'`), `TrendChart` (even round ticks), `KPICard` (no empty change chip), `GapRows` (labels never overlap) |                                                                                                                                                                                                                                                                                    |

## 15. Correlation explorer (Phase 11)

| Piece                  | Where                                                                           | Notes                                                                                                                                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Route                  | `/correlation?x=&y=&year=&region=\|income=&color=region\|income\|none&country=` | Any two core indicators; swap axes; scope; colour by region or income group; highlight an economy (labelled on the chart)                                                                                                                                                                                                                  |
| Logic                  | `features/correlation/correlation.logic.ts`                                     | Only economies with **both** values published (the rest are counted, never imputed). Pearson r, Spearman ρ (`stats.spearman`, tie-aware ranks), OLS fit and R², slope scaled to a 10-point difference, economies furthest above/below the line, the same pair in every wave. Nothing reported below `MIN_CORRELATION_N` (10) or when x = y |
| Matrix                 | `correlationMatrix`                                                             | Pearson r between 12 key indicators for the wave and scope; diverging colour bins; blank where n < 10; selecting a cell loads that pair                                                                                                                                                                                                    |
| Caveats (always shown) | `StatsPanel`                                                                    | Correlation is not causation · economies, not people (no inference about individuals) · one wave only · a note when Pearson and Spearman disagree by ≥ 0.15 (outliers or curvature)                                                                                                                                                        |
| Shared changes         | `ScatterPlot`                                                                   | `xDomain`/`xUnit`, per-point `color`, `labelled` focus point                                                                                                                                                                                                                                                                               |
| Data fix               | `scripts/lib/normalize.mjs` → `removeNotCollectedZeros`                         | See DATA_MODEL.md: 2024 high-income zeros for questions not asked (credit card, emergency funds) are stored as missing. Found because emergency funds showed a spurious −0.66 correlation with account ownership; after the fix it is −0.08                                                                                                |

## 16. Trend analytics (Phase 12)

| Piece    | Where                                                 | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route    | `/trends?metric=&region=\|income=&from=&to=&country=` | Any core indicator, any scope, any pair of waves (invalid or reversed periods fall back to first → last published wave); optional economy line                                                                                                                                                                                                                                                                                              |
| Logic    | `features/trends/trends.logic.ts`                     | Observed waves only — no interpolation, no projection. Headline from the published aggregate (developing-economies fallback labelled); per-year = change ÷ years between waves. Economy change only for the **same economy in both waves**; per-year rates use actual survey years (2022 fieldwork). Up / down / within 1 pp counts                                                                                                         |
| Charts   | `TrendsPage.tsx`                                      | Region lines (selected scope emphasized, others faint, economy in foreground colour) · spread across economies (10th–90th and 25th–75th percentile bands, median economy vs aggregate, n per wave in tooltip) · "catching up?" scatter of starting level vs change with r (n ≥ 10; mechanical ceiling effect noted) · largest increases / decreases (neutral direction colours) · consecutive-wave change table with direction-aware deltas |
| Insights | `lib/insights/trends.ts`                              | Headline change and per-year average, fastest/slowest period, breadth of change, largest riser, convergence (labelled as a pattern, not a cause). Neutral tone for indicators without a good direction                                                                                                                                                                                                                                      |
| Shared   | `TrendChart` `dim` series · `quantile()` (type 7)     |                                                                                                                                                                                                                                                                                                                                                                                                                                             |

## 17. Forecasting (Phase 13)

| Piece   | Where                                                 | Notes                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route   | `/forecast?metric=&country=\|region=\|income=&model=` | Any core indicator for an economy or a published aggregate. `model` = `logistic` / `linear` / `recent`; omitted = best fit                                                                                                                                                                                                                                                                                 |
| Models  | `lib/forecast/models.ts`                              | **S-curve** (OLS on log-odds, bounded 0–100%, shares only) · **straight line** through all surveys · **recent trend** (last 3 surveys). 80% prediction intervals from the OLS fit with Student-t critical values (df = n − 2; a floor on residual SD so no projection looks certain); S-curve intervals are computed in log-odds and mapped back (asymmetric, always within 0–100%)                        |
| Engine  | `lib/forecast/engine.ts`                              | `forecastSeries(observations, { bounded, years })`: withheld below **3 surveys**; shares capped to 0–100% and flagged; **back-test** = refit without the latest survey and project it; the recommended model has the smallest back-test miss; `unstable` when even the best model missed by ≥ 5 pp                                                                                                         |
| Inputs  | `features/forecast/forecast.logic.ts`                 | Published values only, placed at **actual survey years** (e.g. 2022 fieldwork for the 2021 wave). Horizons 2027 and 2030 (`FORECAST_YEARS`, illustrative — not announced survey dates). World → developing-economies fallback labelled                                                                                                                                                                     |
| Page    | `ForecastPage.tsx`                                    | Permanent disclaimer banner · `ForecastChart` (observed solid with markers; projection dashed, no markers, shaded 80% range; other models faint dashed; "Projection →" divider) · outlook panel with ranges, model rationale, instability warning, survey-year note · model comparison with back-test errors · regional outlook to 2030 (each aggregate's own best fit, instability starred) · method card |
| Wording | everywhere                                            | "FinLens projection — not an official World Bank forecast. It assumes the pattern in past surveys continues." Values prefixed with "~"                                                                                                                                                                                                                                                                     |

## 18. Insight engine and intelligence pages (Phase 14)

| Piece           | Where                                                 | Notes                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine          | `lib/insights/engine.ts`                              | Registry of generators (world trend, unbanked, regions, notable declines, gaps for every breakdown, mobile money & digital payments, saving & borrowing sources, resilience). Each returns evidenced insights or nothing; the feed is de-duplicated, categorised (`CATEGORY_META`) and ranked by generator weight × rule priority. **No country is named in code** — every economy that appears is selected by a data rule |
| `/insights`     | `features/insights/InsightsPage.tsx`                  | "Most important right now" + filterable feed (topic chips, Global / Regions / Economies), each card with category, scope, evidence and a deep link                                                                                                                                                                                                                                                                         |
| `/digital`      | `features/digital/`                                   | KPIs with World→developing fallback labelled · **two routes into the system**: FI account vs _mobile money only_ (= account − FI account, exact) for World and every region · channel use · trends · mobile money leaders · mobile-only leaders · phones vs mobile money scatter (correlation ≠ causation). _(Listed under Phase 11 in the route registry; delivered here.)_                                               |
| `/microfinance` | `features/microfinance/`                              | For an aggregate or one economy: how people save (formal, FI, mobile, informal, old age), where they borrow (formal, FI, mobile, savings club, family) and why, **who is left out** (women vs men, poorest 40% vs richest 60% for 7 indicators), barriers for the unbanked, resilience, and where informal saving is most common. States that Findex does not identify microfinance institutions separately                |
| `/focus/:slug`  | `features/country-focus/`                             | Same narrative template for **every** economy: lede, journey vs region & world, what rose/fell most, who is left behind, digital routes, saving/borrowing/resilience, FinLens outlook (with instability warning), regional peers, key findings. Linked from each profile ("Read the story")                                                                                                                                |
| `/story`        | `features/story/`                                     | 7 data-driven steps (progress, unbanked, gender gap, widest divide, digital, saving, outlook); `?step=` is shareable; ←/→ keys; reduced-motion aware. Steps without data are dropped                                                                                                                                                                                                                                       |
| `/index-lab`    | `features/composite-index/`                           | **Experimental** FinLens Inclusion Index: 6 dimensions (access, usage, saving, credit, resilience, equality = smaller absolute gender gap), min–max 0–100 over economies with all six, adjustable weights (URL `?w=`), presets, **rank range** across weightings, excluded economies listed (most high-income economies in 2024 because usage questions were not asked)                                                    |
| Data fix        | `scripts/lib/normalize.mjs` → `removeStructuralZeros` | Complementary pairs both 0 (fin24aP/N — 1 row) and aggregates at 0 with no economy values (fin17b — 20 values) stored as missing; see DATA_MODEL.md                                                                                                                                                                                                                                                                        |

## 19. AI Analyst (Phase 15)

| Piece           | Where                                           | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route           | `/analyst?q=`                                   | Chat-style page; `?q=` asks a shared question on arrival. Runs **entirely in the browser**; nothing typed is sent anywhere                                                                                                                                                                                                                                                                                                                                     |
| Vocabulary      | `lib/analyst/lexicon.ts`                        | Plain-data synonym lists: indicator phrases, population groups, breakdowns, entity aliases (World/global, regions, "developing countries", common short names). Extend without touching the parser                                                                                                                                                                                                                                                             |
| Parser          | `lib/analyst/parse.ts`                          | Normalises text (case, accents, "&"), matches dataset names + aliases + ISO3 codes, indicators, groups, breakdowns and years (2022 → 2021 wave), longest non-overlapping match wins, plurals tolerated. Intents: definition · forecast · rank (top/bottom N) · explain ("why") · gap · compare · trend · value · unknown. `withContext` handles follow-ups ("and Kenya?", "what about women?") and keeps the previous indicator for short place-only questions |
| Answers         | `lib/analyst/answer.ts`                         | Every number comes from the repository and is recorded as a **Fact** (entity · indicator · group · year · value); computed changes/differences are recorded as facts too. World → developing-economies fallback, projections ("FinLens projection — not an official World Bank forecast"), mixed survey years and "the Findex shows what changed, not why" are stated as caveats. Unknown questions get suggestions instead of a guess                         |
| Grounding check | `lib/analyst/provider.ts` → `validateGrounding` | Flags any number in the answer text that is not in its facts (years, counts and rank labels excepted). Tests run it on a battery of questions                                                                                                                                                                                                                                                                                                                  |
| Providers       | `AnalystProvider` interface, `ruleProvider`     | Only the rule-based provider ships. A future LLM provider must sit behind a server-side proxy (no API keys in the browser), receive the selected facts, and pass `validateGrounding` — it may rephrase, never add numbers                                                                                                                                                                                                                                      |

## 20. Export, sharing and the Data Explorer (Phase 16)

| Piece           | Where                                        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sharing         | `ExportMenu`                                 | Every view's state is in the URL, so **Copy shareable link** reproduces it exactly; native **Share…** where the browser supports it; **Print or save as PDF** with a print stylesheet (no sidebar/controls, cards kept whole) and a print-only header (`PrintHeader`: citation, date, URL)                                                                                                                                                                                                                                          |
| Page downloads  | `components/export/*`, `lib/export/*`        | An **export registry** (`ExportRegistryProvider` around the layout) collects every `ChartCard` data table and every `InsightCard` on the page, in document order. The Export menu then offers **Snapshot (PNG)** of the view, **All data on this page (CSV)** — one file, one titled section per chart — and an **Analytical summary (Markdown)** with findings, tables and citation. No page wiring needed                                                                                                                         |
| Chart downloads | `CardDownload` in every `ChartCard`          | **Chart as PNG** (natural height, controls excluded via `data-export-ignore`, source line appended) and **Data as CSV** (the chart's accessible table)                                                                                                                                                                                                                                                                                                                                                                              |
| CSV format      | `lib/export/csv.ts`                          | RFC 4180 quoting, UTF-8 BOM for Excel, citation lines appended; page/chart CSVs note that values are as displayed (rounded)                                                                                                                                                                                                                                                                                                                                                                                                         |
| PNG             | `lib/export/png.ts`                          | `html-to-image`, loaded on demand (not in the main bundle), 2× pixel ratio                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Files           | `safeFilename`                               | `finlens-<title>-<yyyy-mm-dd>.<ext>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Notifications   | `components/common/Toaster.tsx` + `toast.ts` | Polite toasts for downloads, copied links and errors                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `/explorer`     | `features/explorer/`                         | Query **all 430 Findex series + 3 FinLens-derived** by indicator (searchable, by category, core or all), economies and aggregates (or all economies, optionally by region, optionally with aggregates), waves and population groups; long or wide view; sortable, paginated; full-precision **CSV** of exactly the selection with Findex series codes, entity metadata, wave and actual survey year. State in the URL (`?ind=&codes=&agg=&region=&waves=&groups=&layout=`) — shareable. Missing values are not listed, never filled |

## 21. Mobile optimisation (Phase 17)

Audited every route at 360, 390 and 768 px (touch) and 1280 px (mouse) with a Playwright script that checks page width, elements escaping the viewport, tap targets under 24 px (WCAG 2.5.8) and text under 11 px.

| Area           | Change                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tap targets    | On touch screens (`pointer: coarse`), every link, button and tab in the page gets an invisible ~12 px taller / 8 px wider tap area (`::after`), without changing layout. `.hit-area` does the same explicitly for small controls on all devices (info icons, sort headers, row links, breadcrumbs). Story step dots are 24 px buttons; tabs are at least 28 px; the index weight sliders are 24 px tall |
| Text size      | Nothing below 11 px: map legend, dot strips, gap rows, map tooltips, economy badges, the logo tagline and footnote markers were raised                                                                                                                                                                                                                                                                  |
| Layout         | Grid columns get `min-w-0` so wide tables scroll inside their card instead of widening the page (fixed a 9 px overflow on `/index-lab` at 360 px). Map zooming is clipped inside its frame                                                                                                                                                                                                              |
| Loading        | Small helpers shared by the shell and the chart libraries (`clsx`, `tailwind-merge`, `use-sync-external-store`, `react-is`) now sit in the core chunk, so the first paint no longer preloads Recharts and D3 (~517 kB uncompressed). Charts load with the pages that use them. On a simulated 1.6 Mbps / 150 ms connection the page title renders in about 3–4 s without compression                    |
| Browser chrome | Light and dark `theme-color`; the analyst question box respects the bottom safe area                                                                                                                                                                                                                                                                                                                    |
| Result         | 0 horizontal overflow and 0 flagged tap targets or tiny text at 360/390/768 px. At 1280 px (mouse) only standalone text links are under 24 px tall, which the WCAG spacing exception covers                                                                                                                                                                                                             |

Note for Phase 18: `public/data/raw/` (the 18 MB source workbook) is copied into `dist/` by Vite. It should be excluded from deployment.

## 22. Testing and deployment (Phase 18)

Full detail and hosting steps: [DEPLOYMENT.md](DEPLOYMENT.md).

| Piece               | Where                                                                                 | Notes                                                                                                                                                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data verification   | `scripts/verify-data.mjs` · `npm run data:verify`                                     | Checks the processed JSON only (runs in CI without the raw workbook): schema, unique ids, references, a data file for every indicator, known economy × wave × group per row, no duplicates, values finite and within [0, 100]. Current result: 174 entities · 430 indicators · 393 files · 385,451 values. Changes nothing |
| Unit / integration  | Vitest, 23 files, 137 tests                                                           | Coverage thresholds: `src/lib/**` and `*.logic.ts` ≥ 85 % lines, `src/data/**` ≥ 75 % (currently about 94 %, 97 % and 84 %). UI components are covered by the browser tests                                                                                                                                                |
| Browser tests       | Playwright `tests/e2e` (desktop 1280 px + Pixel 7)                                    | `pages` (all 23 pages: no errors, failed requests or sideways scroll; 404), `flows` (search, published values on screen, URL state, analyst, CSV at full precision with citation, deep links, theme, mobile menu, PNG export), `a11y` (axe-core WCAG 2.1 A/AA, light + dark; serious/critical fail). 134 pass              |
| Accessibility fixes | `ui/tabs.tsx` (`panels={false}`), `ChartCard`, `ui/table.tsx`, `globals.css`          | Found by axe: `aria-controls` pointing at panels/tables not in the page; wide tables not reachable by keyboard (now focusable); links in running text distinguished by colour only (now underlined)                                                                                                                        |
| Build               | `vite.config.ts`                                                                      | The raw workbook (`public/data/raw`, 18 MB) is removed from `dist/`; source maps opt-in (`SOURCEMAP=true`); `--base` sub-path builds work (router `basename`, `%BASE_URL%` in `index.html`)                                                                                                                                |
| Security headers    | `public/_headers` (source), `vercel.json`, `deploy/finlens-security.conf`             | CSP without inline scripts (the theme script moved to `public/theme-init.js`), no framing, nosniff, referrer and permissions policies. `vite preview` serves the same headers, so the browser tests run under the production policy                                                                                        |
| Caching             | same files                                                                            | Hashed assets 1 year immutable; data 1 day (URLs carry `?v=<builtAt>`); `meta.json`, `index.html`, `theme-init.js` revalidated                                                                                                                                                                                             |
| Hosting             | `netlify.toml`, `vercel.json`, `public/_redirects`, `Dockerfile`, `deploy/nginx.conf` | Netlify, Vercel, Cloudflare Pages or Docker/nginx (unprivileged, port 8080, gzip). The nginx configuration was run locally and the page and journey tests passed against it                                                                                                                                                |
| CI                  | `.github/workflows/ci.yml`                                                            | On push to `main` and PRs: data verify → lint → types → coverage → build → `npm audit --omit=dev` → Playwright (desktop + mobile + axe)                                                                                                                                                                                    |
