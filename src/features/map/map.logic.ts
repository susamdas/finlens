import type { FindexRepository } from '@/data/repository'
import type { Entity, IndicatorDefinition, Wave } from '@/data/types'
import { buildScale, median, type ChoroplethScale } from '@/lib/analytics/choropleth'
import { rank, type Ranked } from '@/lib/analytics/movers'

export const MAP_DEFAULT_METRIC = 'accountOwnership'

/** Metrics offered on the map (spec §6): access, digital, savings, borrowing, sex-disaggregated and gap. */
export const MAP_METRIC_IDS = [
  'accountOwnership',
  'noAccount',
  'fiAccount',
  'mobileMoneyAccount',
  'digitalPayments',
  'debitCard',
  'formalSavings',
  'savedAny',
  'formalBorrowing',
  'borrowedAny',
  'emergencyFundsPossible',
  'mobilePhone',
  'internetUse',
  'genderGapAccount',
] as const

/** Values tied to a population group ("Female account ownership" etc.). */
export const GROUP_METRICS: Record<
  string,
  { base: string; group: 'women' | 'men'; label: string }
> = {
  accountWomen: { base: 'accountOwnership', group: 'women', label: 'Female account ownership' },
  accountMen: { base: 'accountOwnership', group: 'men', label: 'Male account ownership' },
}

export interface MapMetric {
  id: string
  label: string
  indicator: IndicatorDefinition
  group: 'all' | 'women' | 'men'
}

export function mapMetrics(repo: FindexRepository): MapMetric[] {
  const base = MAP_METRIC_IDS.flatMap((id) => {
    const indicator = repo.indicator(id)
    return indicator ? [{ id, label: indicator.shortLabel, indicator, group: 'all' as const }] : []
  })
  const grouped = Object.entries(GROUP_METRICS).flatMap(([id, g]) => {
    const indicator = repo.indicator(g.base)
    return indicator ? [{ id, label: g.label, indicator, group: g.group }] : []
  })
  // Keep sex-disaggregated options next to the gender gap.
  return [...base.slice(0, -1), ...grouped, base[base.length - 1]!].filter(Boolean)
}

/** Map metric by id: a listed map metric, any other known indicator (all adults), or the default. */
export function resolveMapMetric(repo: FindexRepository, id: string | undefined): MapMetric {
  const all = mapMetrics(repo)
  const listed = all.find((m) => m.id === id)
  if (listed) return listed
  const indicator = id ? repo.indicator(id) : undefined
  if (indicator && !indicator.derived?.groupsOnly)
    return { id: indicator.id, label: indicator.shortLabel, indicator, group: 'all' }
  return all.find((m) => m.id === MAP_DEFAULT_METRIC)!
}

export interface MapModel {
  metric: MapMetric
  wave: Wave
  values: Record<string, number>
  scale: ChoroplethScale
  ranked: Ranked[]
  rankOf: Record<string, number>
  stats: { count: number; median: number | null; total: number }
  missing: Entity[]
  regionAverage: Record<string, { name: string; value: number | null }>
}

export function buildMapModel(
  repo: FindexRepository,
  metricId: string | undefined,
  wave: Wave,
): MapModel {
  const metric = resolveMapMetric(repo, metricId)
  const cross = repo.crossSection(metric.indicator.id, wave, { group: metric.group })
  const values = Object.fromEntries(cross.map((c) => [c.entity.code, c.value]))
  const ranked = rank(cross)
  const regionAverage = Object.fromEntries(
    repo.regions.map((r) => [
      r.id,
      { name: r.name, value: repo.value(metric.indicator.id, r.aggregateCode, wave, metric.group) },
    ]),
  )
  return {
    metric,
    wave,
    values,
    scale: buildScale(
      cross.map((c) => c.value),
      { unit: metric.indicator.unit, higherIsBetter: metric.indicator.higherIsBetter },
    ),
    ranked,
    rankOf: Object.fromEntries(ranked.map((r) => [r.entity.code, r.rank])),
    stats: {
      count: cross.length,
      median: median(cross.map((c) => c.value)),
      total: repo.economies().length,
    },
    missing: repo.economies().filter((e) => values[e.code] === undefined),
    regionAverage,
  }
}

/** Standard tooltip / detail rows for an economy (spec §6 example). */
export function economyDetail(repo: FindexRepository, code: string, wave: Wave) {
  const e = repo.entity(code)
  if (!e) return null
  const v = (id: string, group: 'all' | 'women' = 'all') => repo.value(id, code, wave, group)
  return {
    entity: e,
    region: e.regionId ? repo.region(e.regionId) : undefined,
    incomeGroup: e.incomeGroupId ? repo.incomeGroup(e.incomeGroupId) : undefined,
    surveyYear: repo.surveyYear(code, wave),
    rows: [
      { label: 'Account ownership', value: v('accountOwnership') },
      { label: 'Mobile money', value: v('mobileMoneyAccount') },
      { label: 'Digital payments', value: v('digitalPayments') },
      { label: 'Female ownership', value: v('accountOwnership', 'women') },
    ],
  }
}
