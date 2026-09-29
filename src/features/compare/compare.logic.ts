import type { FindexRepository } from '@/data/repository'
import type { Entity, GroupId, IndicatorDefinition, SeriesPoint, Wave } from '@/data/types'

export const MAX_COMPARE = 5

/** Comparison metrics (spec §9). `group` picks a sex-disaggregated value. */
export const COMPARE_METRICS: { key: string; id: string; group: GroupId; label?: string }[] = [
  { key: 'accountOwnership', id: 'accountOwnership', group: 'all' },
  { key: 'formalSavings', id: 'formalSavings', group: 'all' },
  { key: 'formalBorrowing', id: 'formalBorrowing', group: 'all' },
  { key: 'mobileMoneyAccount', id: 'mobileMoneyAccount', group: 'all' },
  { key: 'digitalPayments', id: 'digitalPayments', group: 'all', label: 'Digital payments' },
  {
    key: 'accountWomen',
    id: 'accountOwnership',
    group: 'women',
    label: 'Female account ownership',
  },
  { key: 'genderGapAccount', id: 'genderGapAccount', group: 'all' },
]

export interface CompareMetric {
  key: string
  label: string
  indicator: IndicatorDefinition
  group: GroupId
}

export interface CompareCell {
  value: number | null
  previous: { wave: Wave; value: number } | null
  delta: number | null
}

export interface CompareModel {
  wave: Wave
  entities: Entity[]
  metrics: CompareMetric[]
  /** cells[metricKey][code] */
  cells: Record<string, Record<string, CompareCell>>
  world: Record<string, number | null>
  /** Which aggregate `world` came from: World, or developing economies where World is not published. */
  worldSource: Record<string, 'WLD' | 'LMY' | null>
  /** Best/worst code per metric where the indicator has a direction. */
  leaders: Record<string, { best: string | null; worst: string | null }>
  radarAxes: CompareMetric[]
  radarExcluded: CompareMetric[]
  /** Economies drawn on the radar; those with no % values at all in this wave are omitted. */
  radarEntities: Entity[]
  radarOmitted: Entity[]
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** Parses ?countries=BGD,IND… keeping only known economies, unique, max 5, in order. */
export function parseCountries(repo: FindexRepository, raw: string | null | undefined): string[] {
  if (!raw) return []
  const out: string[] = []
  for (const c of raw.split(',').map((s) => s.trim().toUpperCase())) {
    if (out.length >= MAX_COMPARE) break
    if (!out.includes(c) && repo.entity(c)?.kind === 'economy') out.push(c)
  }
  return out
}

/** Suggested peers: the economy plus the most populous members of its region with data. */
export function suggestPeers(repo: FindexRepository, code: string, n = MAX_COMPARE): string[] {
  const e = repo.entity(code)
  if (!e) return []
  const wave = repo.latestWave
  const peers = repo
    .economies()
    .filter(
      (x) =>
        x.regionId === e.regionId &&
        x.code !== code &&
        repo.latest('accountOwnership', x.code) !== null,
    )
    .sort(
      (a, b) =>
        (repo.population(b.code, wave) ?? repo.population(b.code, 2021) ?? 0) -
        (repo.population(a.code, wave) ?? repo.population(a.code, 2021) ?? 0),
    )
    .slice(0, n - 1)
    .map((x) => x.code)
  return [code, ...peers]
}

export function compareMetrics(repo: FindexRepository): CompareMetric[] {
  return COMPARE_METRICS.flatMap((m) => {
    const indicator = repo.indicator(m.id)
    return indicator
      ? [{ key: m.key, label: m.label ?? indicator.shortLabel, indicator, group: m.group }]
      : []
  })
}

export function buildCompare(repo: FindexRepository, codes: string[], wave: Wave): CompareModel {
  const entities = codes.map((c) => repo.entity(c)).filter((e): e is Entity => Boolean(e))
  const metrics = compareMetrics(repo)
  const cells: CompareModel['cells'] = {}
  const world: CompareModel['world'] = {}
  const leaders: CompareModel['leaders'] = {}
  const worldSource: CompareModel['worldSource'] = {}
  for (const m of metrics) {
    cells[m.key] = {}
    for (const e of entities) {
      const value = repo.value(m.indicator.id, e.code, wave, m.group)
      const previous = repo.previous(m.indicator.id, e.code, wave, m.group)
      cells[m.key]![e.code] = {
        value,
        previous,
        delta: value !== null && previous ? r2(value - previous.value) : null,
      }
    }
    const wld = repo.value(m.indicator.id, 'WLD', wave, m.group)
    const lmy = wld === null ? repo.value(m.indicator.id, 'LMY', wave, m.group) : null
    world[m.key] = wld ?? lmy
    worldSource[m.key] = wld !== null ? 'WLD' : lmy !== null ? 'LMY' : null
    const withVal = entities.filter((e) => cells[m.key]![e.code]!.value !== null)
    if (m.indicator.higherIsBetter === null || withVal.length < 2)
      leaders[m.key] = { best: null, worst: null }
    else {
      // Gaps (pp) are judged by size: a reversed gap is not "better" than no gap.
      const score = (c: string) => {
        const v = cells[m.key]![c]!.value!
        return m.indicator.unit === 'pp' ? Math.abs(v) : v
      }
      const sorted = [...withVal].sort((a, b) => score(b.code) - score(a.code))
      const [hi, lo] = [sorted[0]!.code, sorted[sorted.length - 1]!.code]
      leaders[m.key] = m.indicator.higherIsBetter
        ? { best: hi, worst: lo }
        : { best: lo, worst: hi }
    }
  }
  // Radar only for % metrics where every selected economy has a value (no fake zeros).
  const pct = metrics.filter((m) => m.indicator.unit === '%')
  // An economy not surveyed in this wave would otherwise remove every axis; leave it off instead.
  const radarEntities = entities.filter((e) =>
    pct.some((m) => cells[m.key]![e.code]!.value !== null),
  )
  const radarOmitted = entities.filter((e) => !radarEntities.includes(e))
  const radarAxes = pct.filter((m) =>
    radarEntities.every((e) => cells[m.key]![e.code]!.value !== null),
  )
  const radarExcluded = pct.filter((m) => !radarAxes.includes(m))
  return {
    wave,
    entities,
    metrics,
    cells,
    world,
    worldSource,
    leaders,
    radarAxes,
    radarExcluded,
    radarEntities,
    radarOmitted,
  }
}

export function trendSeries(
  repo: FindexRepository,
  codes: string[],
  metric: CompareMetric,
): { code: string; points: SeriesPoint[] }[] {
  return codes.map((code) => ({
    code,
    points: repo.series(metric.indicator.id, code, metric.group),
  }))
}

/**
 * Stable colour slots: an economy keeps its slot while it stays selected, so removing one
 * never repaints the others. Returns the updated assignment.
 */
export function assignSlots(
  codes: string[],
  previous: Record<string, number>,
): Record<string, number> {
  const next: Record<string, number> = {}
  for (const c of codes) if (previous[c] !== undefined) next[c] = previous[c]!
  for (const c of codes) {
    if (next[c] !== undefined) continue
    let s = 0
    while (Object.values(next).includes(s)) s++
    next[c] = s
  }
  return next
}
