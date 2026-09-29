# FinLens Data Model

Status: **Phase 4** (done). Built from `GlobalFindexDatabase2025.xlsx`, whose latest update is dated September 2025.

## 1. What the source file contains

| Sheet            | Contents                                                                                                                  | How FinLens uses it                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Data**         | 8,577 rows × 458 series. Wide format: one row per economy × survey year × population group. Values are shares from 0 to 1 | Observations                                                            |
| **Series Table** | Code, name, definitions, topic and aggregation method for each series                                                     | Indicator catalogue and definitions                                     |
| **Notes**        | World Bank caveats (4 notes)                                                                                              | Shown on About the Data                                                 |
| **Updates**      | Change log                                                                                                                | Shown on About the Data; the most recent date becomes the release label |

Every one of the **385,599 published values** was checked against the raw file after conversion: 0 mismatches, 0 dropped.

## 2. Pipeline: `npm run data:build`

```
public/data/raw/GlobalFindex*.xlsx
   │  stream-read (ExcelJS, ~6 s)
   │  validate → the build stops on any hard error
   │  normalize
   ▼
public/data/processed/
   meta.json          316 KB (29 KB gzip)   reference data + full catalogue
   core.json          505 KB (122 KB gzip)  42 curated indicators · all adults, women, men
   core-groups.json   1.4 MB (317 KB gzip)  same indicators · other groups (loaded on demand)
   series/<id>.json   391 files            every other series (loaded on demand)
   data-report.json                        validation & coverage summary
```

**Validation (the build stops on any of these):** a required column is missing, a code isn't 3 letters, a survey year or population group is unknown, a row is duplicated, a value is outside 0–1, an economy has an unknown region or income group, two items would get the same URL slug, or a curated indicator is missing or empty.

**Normalization:**

| Rule                | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Units               | Fraction → percent, rounded to 2 decimals. No other transformation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Waves               | 16 economies surveyed in **2022** are placed in the **2021 wave**, matching the World Bank. The real survey year is kept in `surveyYears`                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Groups              | The file's `group`/`group2` pairs become 13 group IDs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Missing values      | Blank cells stay absent. Nothing is imputed or interpolated                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Not-collected zeros | In 2024, financial use and health questions were asked only in low- and middle-income economies (source note). Where ≥ 50% (and ≥ 5) of high-income economies show exactly 0 for a 2024 series, those zeros are stored as missing for high-income economies and the HIC aggregate. This affects 3 series (fin24aP, fin24aN, fin10 — 42 values each); counts in `notCollectedZeros` in the report. Isolated zeros and non-zero values are kept                                                                                                                       |
| Structural zeros    | Two more rules for zeros that cannot be real estimates: (1) complementary questions both at exactly 0 in the same row (fin24aP “possible” and fin24aN “not possible” — 1 economy row); (2) an aggregate at exactly 0 in a wave where no economy has a value for that series (fin17b “saved using mobile money”, 20 aggregate values in 2014/2017). Counts in `structuralZeros` in the report. Remaining exact zeros (e.g. savings-club questions in high-income economies before 2024) are kept as published because the source does not document them as not asked |
| Empty series        | 28 sub-sample series the World Bank lists but publishes no values for are left out and listed in the report                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Blank rows          | 11 trailing blank rows in the sheet are skipped                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

## 3. Entities & classification

| Kind                   | Count | Examples                                                 |
| ---------------------- | ----- | -------------------------------------------------------- |
| `economy`              | 162   | BGD, IND, KEN                                            |
| `region`               | 6     | EAP, ECA, LAC, MNA, SAS, SSA (developing economies only) |
| `income`               | 4     | LIC, LMC, UMC, HIC                                       |
| `world` / `developing` | 1 / 1 | WLD, LMY                                                 |

The file uses the Findex regional classification. The six regions **exclude high-income economies**, and **High income** is a separate group of 51 economies. FinLens keeps this classification unchanged, so Bangladesh's regional benchmark is the published **South Asia** aggregate (SAS).

Each entity has: `code`, official `name`, display `shortName`, URL `slug` (e.g. `/country/bangladesh`), `iso2` (for flags), `regionId`, `incomeGroupId`.

## 4. Indicators

- **Curated core (39 + 3 FinLens-derived).** Defined in `src/data/indicators/core-indicators.json` with a stable FinLens ID, short label, category and direction. Definitions still come from the World Bank Series Table.
- **Full catalogue (391 more).** Every other series, with ID `fx_<code>` (e.g. `fx_fin11a`), loaded on demand.
- **Direction (`higherIsBetter`).** `true` or `false` colours changes green or red. `null` means the direction is not inherently good or bad (for example borrowing or informal saving), so changes are shown in neutral colours.

| Category                     | Core indicators                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Account access               | account ownership, financial institution account, debit/credit card, inactive account                                                       |
| Digital finance              | mobile money account, digital payments (made/received/any), merchant payment, online bill payment, online purchase                          |
| Payments & transfers         | wages into an account, government transfers into an account                                                                                 |
| Savings                      | saved any, formal savings, saved at a financial institution, mobile money savings, savings club, old age                                    |
| Borrowing                    | borrowed any, formal borrowing, from a financial institution, from mobile money, from family, from a savings club, for business, for health |
| Resilience                   | emergency funds possible / not possible / mainly from savings                                                                               |
| Barriers (share of unbanked) | distance, cost, documents, trust, insufficient funds, family member has an account                                                          |
| Connectivity                 | mobile phone ownership, internet use                                                                                                        |

**FinLens-derived indicators** (`src/data/indicators/derived.ts`, always labelled as FinLens-computed):

| ID                 | Formula                                              |
| ------------------ | ---------------------------------------------------- |
| `noAccount`        | 100 − account ownership                              |
| `genderGapAccount` | account (men) − account (women), in pp               |
| `incomeGapAccount` | account (richest 60%) − account (poorest 40%), in pp |

## 5. Population groups

| Breakdown        | Advantaged − disadvantaged          | Waves         |
| ---------------- | ----------------------------------- | ------------- |
| Sex              | men − women                         | all 5         |
| Household income | richest 60% − poorest 40%           | all 5         |
| Education        | secondary or more − primary or less | all 5         |
| Age              | 25+ − 15–24                         | all 5         |
| Labor force      | in − out                            | all 5         |
| Location         | urban − rural                       | **2024 only** |

The World Bank publishes group data only where the all-adult value is above 10% (Notes sheet).

## 6. Repository API (`src/data/repository/FindexRepository.ts`)

```ts
repo.value('accountOwnership', 'BGD', 2024) // 43.28, or null (never 0 for missing)
repo.series('mobileMoneyAccount', 'BGD') // one point per wave, nulls kept
repo.latest(id, code) / repo.previous(id, code, wave) // nearest wave that has data
repo.gap('accountOwnership', 'BGD', 2024, 'sex') // pp, null unless both groups exist
repo.benchmarks(id, 'BGD', 2024) // { region: SAS, incomeGroup: LMC, world: WLD }
repo.crossSection(id, 2024, { regionId: 'SAS' }) // one wave, many economies
repo.adultsWithoutAccount('BGD', 2024) // adult population × no-account share
await repo.ensureGroups() // income/education/age/labor/location groups
await repo.ensureIndicators(['fx_fin11a']) // catalogue series
repo.query({ indicatorIds, codes, waves, groups }) // flat rows for the Explorer and CSV export
```

In React: `useDataset()` returns `{ status, repo }`, and `useEnsureData({ groups, indicators })` loads extra data on demand. The data source is chosen by `VITE_DATA_SOURCE`: `static` (the JSON files) or `api` (a future REST backend using the same file format).

## 7. Updating the data

1. Put a newer `GlobalFindex*.xlsx` in `public/data/raw/`. The newest file by name is used.
2. Run `npm run data:build` and check the summary and `data-report.json`.
3. Run `npm test`. The golden-value tests in `tests/unit/dataset.integration.test.ts` will flag any shifted value. Update them only after confirming against the source.

## Verifying the processed files

`npm run data:verify` (`scripts/verify-data.mjs`) checks `public/data/processed/` without the raw
workbook, so CI and every hosting build run it before `vite build`: schema version, unique entity
codes and slugs, valid region, income-group and aggregate references, a data file for every
indicator, rows that point at known economies, waves and groups, no duplicate rows, and every
value a finite percentage in [0, 100]. It reports problems and exits with an error; it never
changes a file. `FINLENS_DATA_DIR` points it at another folder.
