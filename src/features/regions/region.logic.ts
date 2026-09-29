import type { FindexRepository } from '@/data/repository'
import type {
  Entity,
  IndicatorDefinition,
  IndicatorId,
  Region,
  SeriesPoint,
  Wave,
} from '@/data/types'
import { median } from '@/lib/analytics/choropleth'
import { rank, type Ranked } from '@/lib/analytics/movers'
import { classifyBenchmark, type BenchmarkStatus } from '@/lib/analytics/direction'

/** Region-level headline indicators (spec §8). */
export const REGION_KPIS: IndicatorId[] = [
  'accountOwnership',
  'mobileMoneyAccount',
  'digitalPayments',
  'formalSavings',
  'formalBorrowing',
  'genderGapAccount',
]

/** Indicators used for the spread and region-vs-world views. */
export const SPREAD_IDS: IndicatorId[] = [
  'accountOwnership',
  'fiAccount',
  'mobileMoneyAccount',
  'digitalPayments',
  'debitCard',
  'savedAny',
  'formalSavings',
  'borrowedAny',
  'formalBorrowing',
  'emergencyFundsPossible',
]

const r2 = (n: number) => Math.round(n * 100) / 100

export interface RegionKpi {
  indicator: IndicatorDefinition
  value: number | null
  previous: { wave: Wave; value: number } | null
  delta: number | null
  series: SeriesPoint[]
  world: number | null
  worldLabel: string
}

export interface RankedRow extends Ranked {
  previous: { wave: Wave; value: number } | null
  delta: number | null
  vsRegion: number | null
}

export interface SpreadRow {
  indicator: IndicatorDefinition
  points: { entity: Entity; value: number }[]
  min: { entity: Entity; value: number } | null
  max: { entity: Entity; value: number } | null
  median: number | null
  aggregate: number | null
  range: number | null
}

export interface RegionModel {
  region: Region
  wave: Wave
  metric: IndicatorDefinition
  economies: Entity[]
  surveyed: number
  kpis: RegionKpi[]
  ranking: RankedRow[]
  spread: SpreadRow[]
  vsWorld: {
    indicator: IndicatorDefinition
    region: number | null
    world: number | null
    status: BenchmarkStatus
  }[]
  trend: { region: SeriesPoint[]; world: SeriesPoint[]; worldLabel: string }
}

/** World aggregate, or the developing-economies aggregate where the world value isn't published. */
function worldRef(repo: FindexRepository, id: IndicatorId, wave: Wave) {
  const w = repo.value(id, 'WLD', wave)
  if (w !== null) return { value: w, code: 'WLD', label: 'World' }
  const hasWorldAny = repo.waves.some((x) => repo.value(id, 'WLD', x) !== null)
  if (hasWorldAny) return { value: null, code: 'WLD', label: 'World' }
  return { value: repo.value(id, 'LMY', wave), code: 'LMY', label: 'Developing economies' }
}

export function regionEconomies(repo: FindexRepository, region: Region): Entity[] {
  return repo.economies().filter((e) => e.regionId === region.id)
}

export function buildRegionModel(
  repo: FindexRepository,
  region: Region,
  opts: { wave?: Wave; metric?: IndicatorId } = {},
): RegionModel {
  const wave = opts.wave && repo.waves.includes(opts.wave) ? opts.wave : repo.latestWave
  const metric =
    repo.indicator(opts.metric ?? 'accountOwnership') ?? repo.indicator('accountOwnership')!
  const economies = regionEconomies(repo, region)
  const agg = region.aggregateCode

  const kpis = REGION_KPIS.flatMap((id) => {
    const indicator = repo.indicator(id)
    if (!indicator) return []
    const value = repo.value(id, agg, wave)
    const previous = repo.previous(id, agg, wave)
    const w = worldRef(repo, id, wave)
    return [
      {
        indicator,
        value,
        previous,
        delta: value !== null && previous ? r2(value - previous.value) : null,
        series: repo.series(id, agg).filter((p) => p.wave <= wave),
        world: w.value,
        worldLabel: w.label,
      },
    ]
  })

  const regionValue = repo.value(metric.id, agg, wave)
  const ranking = rank(repo.crossSection(metric.id, wave, { regionId: region.id })).map((r) => {
    const previous = repo.previous(metric.id, r.entity.code, wave)
    return {
      ...r,
      previous,
      delta: previous ? r2(r.value - previous.value) : null,
      vsRegion: regionValue !== null ? r2(r.value - regionValue) : null,
    }
  })

  const spread = SPREAD_IDS.flatMap((id) => {
    const indicator = repo.indicator(id)
    if (!indicator) return []
    const points = repo
      .crossSection(id, wave, { regionId: region.id })
      .sort((a, b) => a.value - b.value)
    const min = points[0] ?? null
    const max = points[points.length - 1] ?? null
    return [
      {
        indicator,
        points,
        min,
        max,
        median: median(points.map((p) => p.value)),
        aggregate: repo.value(id, agg, wave),
        range: min && max ? r2(max.value - min.value) : null,
      },
    ]
  })

  const vsWorld = SPREAD_IDS.flatMap((id) => {
    const indicator = repo.indicator(id)
    if (!indicator) return []
    const rv = repo.value(id, agg, wave)
    const w = worldRef(repo, id, wave)
    return [
      {
        indicator,
        region: rv,
        world: w.value,
        status: classifyBenchmark(rv, w.value, indicator.higherIsBetter),
      },
    ]
  })

  const trendWorld = worldRef(repo, metric.id, wave)
  return {
    region,
    wave,
    metric,
    economies,
    surveyed: repo.crossSection('accountOwnership', wave, { regionId: region.id }).length,
    kpis,
    ranking,
    spread,
    vsWorld,
    trend: {
      region: repo.series(metric.id, agg),
      world: repo.series(metric.id, trendWorld.code),
      worldLabel: trendWorld.label,
    },
  }
}

/** Regions index: one row per region with headline values at a wave. */
export function regionsTable(repo: FindexRepository, wave: Wave, ids: IndicatorId[] = REGION_KPIS) {
  return repo.regions.map((region) => ({
    region,
    economies: regionEconomies(repo, region).length,
    values: Object.fromEntries(
      ids.map((id) => [id, repo.value(id, region.aggregateCode, wave)]),
    ) as Record<string, number | null>,
    accountSeries: repo.series('accountOwnership', region.aggregateCode),
    accountChange: (() => {
      const v = repo.value('accountOwnership', region.aggregateCode, wave)
      const p = repo.previous('accountOwnership', region.aggregateCode, wave)
      return v !== null && p ? { delta: r2(v - p.value), wave: p.wave } : null
    })(),
  }))
}
