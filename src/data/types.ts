/**
 * FinLens domain model. Mirrors the processed files written by scripts/build-data.mjs
 * (schemaVersion 1). All values are percentages of adults (0–100) unless `unit` says otherwise.
 */
export type CountryCode = string // ISO3 / World Bank code, e.g. "BGD"; aggregates use WB codes ("SAS", "WLD")
export type IndicatorId = string
export type Wave = number // Findex survey wave: 2011, 2014, 2017, 2021, 2024

export type EntityKind = 'economy' | 'region' | 'income' | 'world' | 'developing'

export interface Entity {
  code: CountryCode
  /** Official World Bank name, e.g. "Egypt, Arab Rep." */
  name: string
  /** Display name, e.g. "Egypt" */
  shortName: string
  slug: string
  kind: EntityKind
  iso2: string | null
  regionId: string | null
  incomeGroupId: string | null
}

export interface Region {
  id: string // = aggregate code
  slug: string
  name: string
  aggregateCode: CountryCode
  /** Findex developing-economy regions exclude high-income economies. */
  excludesHighIncome: boolean
  economies: number
}

export interface IncomeGroup {
  id: string
  slug: string
  name: string
  order: number
  aggregateCode: CountryCode
  economies: number
}

export type GroupId =
  | 'all'
  | 'women'
  | 'men'
  | 'poorest40'
  | 'richest60'
  | 'primaryOrLess'
  | 'secondaryOrMore'
  | 'age15to24'
  | 'age25plus'
  | 'inLaborForce'
  | 'outOfLaborForce'
  | 'rural'
  | 'urban'

export type BreakdownId = 'sex' | 'income' | 'education' | 'age' | 'labor' | 'urbanicity'

export interface PopulationGroup {
  id: GroupId
  label: string
  breakdown: BreakdownId | null
  /** Waves in which this group is published at all. */
  waves: Wave[]
}

/** A pair of groups whose difference (advantaged − disadvantaged, in pp) is an inclusion gap. */
export interface Breakdown {
  id: BreakdownId
  label: string
  advantaged: GroupId
  disadvantaged: GroupId
  gapLabel: string
}

export type IndicatorCategory =
  | 'access'
  | 'digital'
  | 'payments'
  | 'savings'
  | 'borrowing'
  | 'resilience'
  | 'barriers'
  | 'connectivity'
  | 'equality'

export interface IndicatorDefinition {
  id: IndicatorId
  /** Findex series code, or null for FinLens-derived indicators. */
  code: string | null
  label: string
  shortLabel: string
  unit: '%' | 'pp' | 'adults'
  /** e.g. "%, age 15+" or "% without an account, age 15+" */
  unitLabel: string
  denominator: string
  definition: string
  topic: string | null
  subTopic: string | null
  category: IndicatorCategory
  /** true/false sets movement tone; null = direction is not inherently good or bad (e.g. borrowing). */
  higherIsBetter: boolean | null
  aggregation: string | null
  core: boolean
  featured: boolean
  coverage: { firstWave: Wave; lastWave: Wave; values: number } | null
  /** Present on FinLens-derived indicators. */
  derived?: { formula: string; inputs: IndicatorId[]; groupsOnly?: boolean }
}

export interface SourceInfo {
  name: string
  edition: string
  file: string
  release: string | null
  url: string
  methodologyUrl: string
  termsUrl: string
  citation: string
}

export interface DatasetMeta {
  schemaVersion: 1
  source: SourceInfo
  builtAt: string
  waves: Wave[]
  coverage: Record<string, number>
  notes: string[]
  updates: { release: string | null; series: string; change: string }[]
  regions: Region[]
  incomeGroups: IncomeGroup[]
  groups: PopulationGroup[]
  breakdowns: Breakdown[]
  entities: Entity[]
  /** Adult (15+) population by entity and wave, from the Findex file. */
  populations: Record<CountryCode, Record<string, number>>
  /** Only where fieldwork year ≠ wave (2022 fieldwork in the 2021 wave). */
  surveyYears: Record<CountryCode, Record<string, number>>
  indicators: IndicatorDefinition[]
}

/** Compact columnar file: rows of [code, wave, group, ...values aligned with columns]. */
export interface ObservationPack {
  schemaVersion: 1
  columns: IndicatorId[]
  rows: [CountryCode, Wave, GroupId, ...(number | null)[]][]
}

export interface Observation {
  indicatorId: IndicatorId
  code: CountryCode
  wave: Wave
  group: GroupId
  value: number
}

export interface SeriesPoint {
  wave: Wave
  value: number | null
}

export interface BenchmarkValue {
  code: CountryCode
  name: string
  value: number | null
}

export interface Benchmarks {
  region: BenchmarkValue | null
  incomeGroup: BenchmarkValue | null
  world: BenchmarkValue | null
}
