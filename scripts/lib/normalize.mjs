/**
 * Pure normalization helpers for the Global Findex pipeline.
 * No I/O here — everything is unit-tested in tests/unit/pipeline.test.ts.
 */

/** Findex waves. Economies surveyed in 2022 belong to the 2021 wave (COVID-era fieldwork delays). */
export const WAVE_OF_SURVEY_YEAR = {
  2011: 2011,
  2014: 2014,
  2017: 2017,
  2021: 2021,
  2022: 2021,
  2024: 2024,
}

/** (group, group2) in the Data sheet → FinLens population group id. */
export const GROUP_MAP = {
  'all|all': 'all',
  'gender|women': 'women',
  'gender|men': 'men',
  'income|poorest 40%': 'poorest40',
  'income|richest 60%': 'richest60',
  'education|prim edu or less': 'primaryOrLess',
  'education|secondary edu or more': 'secondaryOrMore',
  'age_cat|ages 15-24': 'age15to24',
  'age_cat|age 25+': 'age25plus',
  'laborforce|in laborforce': 'inLaborForce',
  'laborforce|out of laborforce': 'outOfLaborForce',
  'urbanicity|rural': 'rural',
  'urbanicity|urban': 'urban',
}

/**
 * Pairs used for inclusion-gap analysis. `advantaged − disadvantaged` is the gap, so a
 * positive gap always means the second group is behind.
 */
export const BREAKDOWNS = [
  { id: 'sex', label: 'Sex', advantaged: 'men', disadvantaged: 'women', gapLabel: 'Gender gap' },
  {
    id: 'income',
    label: 'Household income',
    advantaged: 'richest60',
    disadvantaged: 'poorest40',
    gapLabel: 'Income gap',
  },
  {
    id: 'education',
    label: 'Education',
    advantaged: 'secondaryOrMore',
    disadvantaged: 'primaryOrLess',
    gapLabel: 'Education gap',
  },
  {
    id: 'age',
    label: 'Age',
    advantaged: 'age25plus',
    disadvantaged: 'age15to24',
    gapLabel: 'Age gap',
  },
  {
    id: 'labor',
    label: 'Labor force',
    advantaged: 'inLaborForce',
    disadvantaged: 'outOfLaborForce',
    gapLabel: 'Labor force gap',
  },
  {
    id: 'urbanicity',
    label: 'Location',
    advantaged: 'urban',
    disadvantaged: 'rural',
    gapLabel: 'Urban–rural gap',
  },
]

export const GROUP_LABELS = {
  all: 'All adults',
  women: 'Women',
  men: 'Men',
  poorest40: 'Poorest 40%',
  richest60: 'Richest 60%',
  primaryOrLess: 'Primary education or less',
  secondaryOrMore: 'Secondary education or more',
  age15to24: 'Ages 15–24',
  age25plus: 'Ages 25+',
  inLaborForce: 'In labor force',
  outOfLaborForce: 'Out of labor force',
  rural: 'Rural',
  urban: 'Urban',
}

/**
 * Findex regional classification: developing-economy regions exclude high-income economies,
 * which form their own "High income" group. `aggregateCode` is the Data-sheet row holding the
 * World Bank's published aggregate.
 */
export const REGIONS = [
  {
    id: 'EAP',
    slug: 'east-asia-pacific',
    name: 'East Asia & Pacific',
    source: 'East Asia & Pacific (excluding high income)',
  },
  {
    id: 'ECA',
    slug: 'europe-central-asia',
    name: 'Europe & Central Asia',
    source: 'Europe & Central Asia (excluding high income)',
  },
  {
    id: 'LAC',
    slug: 'latin-america-caribbean',
    name: 'Latin America & Caribbean',
    source: 'Latin America & Caribbean (excluding high income)',
  },
  {
    id: 'MNA',
    slug: 'middle-east-north-africa',
    name: 'Middle East & North Africa',
    source: 'Middle East & North Africa (excluding high income)',
  },
  {
    id: 'SAS',
    slug: 'south-asia',
    name: 'South Asia',
    source: 'South Asia (excluding high income)',
  },
  {
    id: 'SSA',
    slug: 'sub-saharan-africa',
    name: 'Sub-Saharan Africa',
    source: 'Sub-Saharan Africa (excluding high income)',
  },
  { id: 'HIC', slug: 'high-income', name: 'High income', source: 'High income' },
].map((r) => ({ ...r, aggregateCode: r.id, excludesHighIncome: r.id !== 'HIC' }))

export const INCOME_GROUPS = [
  { id: 'LIC', slug: 'low-income', name: 'Low income', source: 'Low income', order: 1 },
  {
    id: 'LMC',
    slug: 'lower-middle-income',
    name: 'Lower middle income',
    source: 'Lower middle income',
    order: 2,
  },
  {
    id: 'UMC',
    slug: 'upper-middle-income',
    name: 'Upper middle income',
    source: 'Upper middle income',
    order: 3,
  },
  { id: 'HIC', slug: 'high-income', name: 'High income', source: 'High income', order: 4 },
].map((g) => ({ ...g, aggregateCode: g.id }))

/** Aggregate rows in the Data sheet (no region/income classification of their own). */
export const AGGREGATE_KIND = {
  WLD: 'world',
  LMY: 'developing',
  EAP: 'region',
  ECA: 'region',
  LAC: 'region',
  MNA: 'region',
  SAS: 'region',
  SSA: 'region',
  HIC: 'income',
  LIC: 'income',
  LMC: 'income',
  UMC: 'income',
}

/** Readable display names for a few long World Bank names. Official names are kept as `name`. */
export const SHORT_NAMES = {
  COD: 'DR Congo',
  COG: 'Congo, Rep.',
  EGY: 'Egypt',
  IRN: 'Iran',
  VEN: 'Venezuela',
  YEM: 'Yemen',
  GMB: 'The Gambia',
  CIV: "Côte d'Ivoire",
  WLD: 'World',
  LMY: 'Developing economies',
}

export function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Findex values are fractions (0–1). FinLens stores percentages rounded to 2 decimals. */
export function toPercent(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return null
  if (n < 0 || n > 1) throw new RangeError(`Value out of range [0,1]: ${raw}`)
  return Math.round(n * 10000) / 100
}

/**
 * Splits "Account (%, age 15+)" into label "Account" and unit "%, age 15+".
 * Also derives the denominator for sub-sample series, e.g. "% without an account".
 */
export function parseIndicatorName(name) {
  const m = /^(.*?)\s*\(([^()]*%[^()]*)\)\s*$/.exec(name.trim())
  if (!m) return { label: name.trim(), unitLabel: '%', denominator: 'adults age 15+' }
  const label = m[1].trim()
  const unitLabel = m[2].trim()
  const denom = unitLabel
    .replace(/^%\s*,?\s*/, '')
    .replace(/,?\s*age 15\+$/, '')
    .trim()
  return { label, unitLabel, denominator: denom ? denom : 'adults age 15+' }
}

/** Stable, URL-safe id for Findex series that are not in the curated core list. */
export function catalogueId(code) {
  return 'fx_' + code.replace(/[^A-Za-z0-9]+/g, '_').replace(/_+$/, '')
}

export function inferCategory(code, label, subTopic1) {
  const l = label.toLowerCase()
  if (subTopic1 === 'Digital connectivity') return 'connectivity'
  if (/^fin11/.test(code) || l.startsWith('no account because')) return 'barriers'
  if (l.includes('emergency') || l.includes('worried') || l.includes('financial')) {
    if (l.includes('emergency')) return 'resilience'
  }
  if (l.includes('saved') || l.includes('saving')) return 'savings'
  if (l.includes('borrow') || l.includes('loan') || l.includes('credit card')) return 'borrowing'
  if (
    l.includes('digital') ||
    l.includes('mobile') ||
    l.includes('online') ||
    l.includes('internet') ||
    l.includes('card')
  )
    return 'digital'
  if (
    l.includes('received') ||
    l.includes('payment') ||
    l.includes('paid') ||
    l.includes('remittance') ||
    l.includes('wage')
  )
    return 'payments'
  return 'access'
}

/**
 * Findex 2025 note: "questions on financial use and financial health were asked only in low-
 * and middle-income economies" in 2024. For some of those questions the source file still
 * records an exact 0 for most high-income economies (e.g. fin24aP and fin24aN are both 0 while
 * their components are blank — impossible for a real estimate).
 *
 * Rule: in the 2024 wave, when at least half (and at least 5) of the high-income economies'
 * all-adult values for a series are exactly 0, those zeros mean "not collected" and are stored
 * as missing — for every population group of those economies and the High-income aggregate.
 * Isolated zeros and all non-zero values are kept as published. Counts are reported in
 * data-report.json (`notCollectedZeros`).
 */
export const NOT_COLLECTED_ZERO_RULE = {
  wave: 2024,
  incomeGroupId: 'HIC',
  aggregateCode: 'HIC',
  minShare: 0.5,
  minCount: 5,
}

/**
 * @param {Array<{code:string,wave:number,group:string,values:(number|null)[]}>} records
 * @param {Map<string,{incomeGroupId:string|null}>} entities
 * @param {string[]} seriesCodes  column order of `values`
 * @returns {Record<string, number>} values set to null, per series code
 */
export function removeNotCollectedZeros(records, entities, seriesCodes) {
  const R = NOT_COLLECTED_ZERO_RULE
  const isHic = (code) => entities.get(code)?.incomeGroupId === R.incomeGroupId
  const inWave = records.filter((r) => r.wave === R.wave)
  const out = {}
  seriesCodes.forEach((s, c) => {
    let zeros = 0
    let total = 0
    for (const r of inWave) {
      if (r.group !== 'all' || !isHic(r.code)) continue
      const v = r.values[c]
      if (v === null || v === undefined) continue
      total++
      if (v === 0) zeros++
    }
    if (zeros < R.minCount || zeros < total * R.minShare) return
    for (const r of inWave) {
      if (!(isHic(r.code) || r.code === R.aggregateCode) || r.values[c] !== 0) continue
      r.values[c] = null
      out[s] = (out[s] ?? 0) + 1
    }
  })
  return out
}

/** Series that are complements of each other (their all-adult values sum to ~100 %). */
export const COMPLEMENT_PAIRS = [['fin24aP', 'fin24aN']]

/**
 * Two further structural-zero rules (same spirit as removeNotCollectedZeros):
 *
 * 1. Complements: when both members of a complementary pair are exactly 0 in the same row, the
 *    question was not asked (a real estimate cannot give 0 % "possible" and 0 % "not
 *    possible"). Both become missing.
 * 2. Aggregates without economies: an aggregate that is exactly 0 in a wave in which no
 *    economy has an all-adult value for that series cannot be a real average. It becomes missing.
 *
 * @param {Array<{code:string,wave:number,group:string,values:(number|null)[]}>} records
 * @param {Map<string,{kind:string}>} entities
 * @param {string[]} seriesCodes
 * @returns {{ complements: Record<string, number>, aggregates: Record<string, number> }}
 */
export function removeStructuralZeros(records, entities, seriesCodes) {
  const complements = {}
  const aggregates = {}
  const idx = new Map(seriesCodes.map((s, i) => [s, i]))
  for (const [a, b] of COMPLEMENT_PAIRS) {
    const ia = idx.get(a)
    const ib = idx.get(b)
    if (ia === undefined || ib === undefined) continue
    for (const r of records) {
      if (r.values[ia] === 0 && r.values[ib] === 0) {
        r.values[ia] = null
        r.values[ib] = null
        complements[a] = (complements[a] ?? 0) + 1
        complements[b] = (complements[b] ?? 0) + 1
      }
    }
  }
  const isEconomy = (code) => entities.get(code)?.kind === 'economy'
  const waves = [...new Set(records.map((r) => r.wave))]
  seriesCodes.forEach((s, c) => {
    for (const w of waves) {
      const rows = records.filter((r) => r.wave === w)
      const economyHasValue = rows.some(
        (r) =>
          r.group === 'all' &&
          isEconomy(r.code) &&
          r.values[c] !== null &&
          r.values[c] !== undefined,
      )
      if (economyHasValue) continue
      for (const r of rows) {
        if (!isEconomy(r.code) && r.values[c] === 0) {
          r.values[c] = null
          aggregates[s] = (aggregates[s] ?? 0) + 1
        }
      }
    }
  })
  return { complements, aggregates }
}
