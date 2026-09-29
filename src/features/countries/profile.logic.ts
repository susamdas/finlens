import type { FindexRepository } from '@/data/repository'
import type {
  BreakdownId,
  Entity,
  GroupId,
  IncomeGroup,
  IndicatorDefinition,
  IndicatorId,
  Region,
  SeriesPoint,
  Wave,
} from '@/data/types'
import { classifyBenchmark, type BenchmarkStatus } from '@/lib/analytics/direction'

export type BenchmarkKind = 'region' | 'income' | 'world'

export const BENCHMARK_LABELS: Record<BenchmarkKind, string> = {
  region: 'Regional average',
  income: 'Income-group average',
  world: 'Global average',
}

/** Headline KPIs on a profile (spec §7). */
export const PROFILE_KPIS: IndicatorId[] = [
  'accountOwnership',
  'mobileMoneyAccount',
  'digitalPayments',
  'formalSavings',
  'formalBorrowing',
  'genderGapAccount',
]

/** Indicators assessed in the scorecard, in display order. */
export const SCORECARD_IDS: IndicatorId[] = [
  'accountOwnership',
  'fiAccount',
  'mobileMoneyAccount',
  'debitCard',
  'digitalPayments',
  'digitalMerchantPayment',
  'wagesIntoAccount',
  'govTransferIntoAccount',
  'savedAny',
  'formalSavings',
  'borrowedAny',
  'formalBorrowing',
  'emergencyFundsPossible',
  'inactiveAccount',
  'genderGapAccount',
  'mobilePhone',
  'internetUse',
]

export const HISTORY_GROUPS: { title: string; ids: IndicatorId[] }[] = [
  {
    title: 'Access & digital finance',
    ids: ['accountOwnership', 'fiAccount', 'mobileMoneyAccount', 'digitalPayments'],
  },
  {
    title: 'Saving & borrowing',
    ids: ['savedAny', 'formalSavings', 'borrowedAny', 'formalBorrowing'],
  },
]

export interface ProfileKpi {
  indicator: IndicatorDefinition
  value: number | null
  previous: { wave: Wave; value: number } | null
  delta: number | null
  series: SeriesPoint[]
  benchmark: number | null
}

export interface ScoreRow {
  indicator: IndicatorDefinition
  value: number | null
  benchmark: number | null
  diff: number | null
  status: BenchmarkStatus
}

export interface BenchmarkSet {
  kind: BenchmarkKind
  code: string
  name: string
}

export interface DemographicRow {
  breakdown: BreakdownId
  label: string
  gapLabel: string
  a: { id: GroupId; label: string; value: number | null }
  b: { id: GroupId; label: string; value: number | null }
  gap: number | null
  previousGap: { wave: Wave; value: number } | null
  trend: 'narrowed' | 'widened' | 'stable' | null
}

export interface CountryProfile {
  entity: Entity
  region?: Region
  incomeGroup?: IncomeGroup
  wave: Wave
  /** Waves in which this economy has any account-ownership value. */
  availableWaves: Wave[]
  surveyYear: number
  population: number | null
  unbanked: number | null
  benchmark: BenchmarkSet
  benchmarks: Record<BenchmarkKind, BenchmarkSet | null>
  kpis: ProfileKpi[]
  scorecard: ScoreRow[]
  strengths: ScoreRow[]
  gaps: ScoreRow[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

function benchmarkSets(
  repo: FindexRepository,
  e: Entity,
): Record<BenchmarkKind, BenchmarkSet | null> {
  const r = e.regionId ? repo.region(e.regionId) : undefined
  const g = e.incomeGroupId ? repo.incomeGroup(e.incomeGroupId) : undefined
  return {
    region: r ? { kind: 'region', code: r.aggregateCode, name: r.name } : null,
    income: g ? { kind: 'income', code: g.aggregateCode, name: g.name } : null,
    world: { kind: 'world', code: 'WLD', name: 'World' },
  }
}

/** Latest wave with account-ownership data for the economy (profiles open there by default). */
export function defaultWave(repo: FindexRepository, code: string): Wave {
  return repo.latest('accountOwnership', code)?.wave ?? repo.latestWave
}

export function buildProfile(
  repo: FindexRepository,
  entity: Entity,
  opts: { wave?: Wave; benchmark?: BenchmarkKind } = {},
): CountryProfile {
  const availableWaves = repo.waves.filter(
    (w) => repo.value('accountOwnership', entity.code, w) !== null,
  )
  const wave =
    opts.wave && repo.waves.includes(opts.wave) ? opts.wave : defaultWave(repo, entity.code)
  const sets = benchmarkSets(repo, entity)
  const benchmark = sets[opts.benchmark ?? 'region'] ?? sets.world!
  const bench = (id: IndicatorId) => repo.value(id, benchmark.code, wave)

  const kpis = PROFILE_KPIS.flatMap((id) => {
    const indicator = repo.indicator(id)
    if (!indicator) return []
    const value = repo.value(id, entity.code, wave)
    const previous = repo.previous(id, entity.code, wave)
    return [
      {
        indicator,
        value,
        previous,
        delta: value !== null && previous ? round2(value - previous.value) : null,
        series: repo.series(id, entity.code).filter((p) => p.wave <= wave),
        benchmark: bench(id),
      },
    ]
  })

  const scorecard = SCORECARD_IDS.flatMap((id) => {
    const indicator = repo.indicator(id)
    if (!indicator) return []
    const value = repo.value(id, entity.code, wave)
    const b = bench(id)
    return [
      {
        indicator,
        value,
        benchmark: b,
        diff: value !== null && b !== null ? round2(value - b) : null,
        status: classifyBenchmark(value, b, indicator.higherIsBetter),
      },
    ]
  })

  // Strengths and gaps only for indicators with a clear direction; ranked by distance.
  const directional = scorecard.filter(
    (r) => r.indicator.higherIsBetter !== null && r.diff !== null,
  )
  const favour = (r: ScoreRow) => (r.indicator.higherIsBetter ? r.diff! : -r.diff!)
  const strengths = directional
    .filter((r) => r.status === 'above')
    .sort((a, b) => favour(b) - favour(a))
    .slice(0, 5)
  const gaps = directional
    .filter((r) => r.status === 'below')
    .sort((a, b) => favour(a) - favour(b))
    .slice(0, 5)

  return {
    entity,
    region: entity.regionId ? repo.region(entity.regionId) : undefined,
    incomeGroup: entity.incomeGroupId ? repo.incomeGroup(entity.incomeGroupId) : undefined,
    wave,
    availableWaves,
    surveyYear: repo.surveyYear(entity.code, wave),
    population: repo.population(entity.code, wave),
    unbanked: repo.adultsWithoutAccount(entity.code, wave),
    benchmark,
    benchmarks: sets,
    kpis,
    scorecard,
    strengths,
    gaps,
  }
}

/** Country vs every benchmark for a set of indicators (the benchmark strip). */
export function benchmarkMatrix(
  repo: FindexRepository,
  profile: CountryProfile,
  ids: IndicatorId[],
) {
  return ids.flatMap((id) => {
    const indicator = repo.indicator(id)
    if (!indicator || indicator.unit !== '%') return []
    const value = repo.value(id, profile.entity.code, profile.wave)
    const marks = (Object.keys(profile.benchmarks) as BenchmarkKind[]).flatMap((k) => {
      const b = profile.benchmarks[k]
      return b ? [{ kind: k, name: b.name, value: repo.value(id, b.code, profile.wave) }] : []
    })
    return [{ indicator, value, marks }]
  })
}

/**
 * Demographic gaps for one indicator. Requires all population groups (repo.ensureGroups()).
 * The trend compares the gap with the previous wave in which both groups were published.
 */
export function demographics(
  repo: FindexRepository,
  code: string,
  wave: Wave,
  id: IndicatorId = 'accountOwnership',
): DemographicRow[] {
  const label = (g: GroupId) => repo.meta.groups.find((x) => x.id === g)?.label ?? g
  return repo.breakdowns.map((b) => {
    const av = repo.value(id, code, wave, b.advantaged)
    const dv = repo.value(id, code, wave, b.disadvantaged)
    const gap = repo.gap(id, code, wave, b.id)
    let previousGap: DemographicRow['previousGap'] = null
    for (const w of [...repo.waves].reverse()) {
      if (w >= wave) continue
      const g = repo.gap(id, code, w, b.id)
      if (g !== null) {
        previousGap = { wave: w, value: g }
        break
      }
    }
    let trend: DemographicRow['trend'] = null
    if (gap !== null && previousGap) {
      const d = Math.abs(gap) - Math.abs(previousGap.value)
      trend = Math.abs(d) < 1 ? 'stable' : d < 0 ? 'narrowed' : 'widened'
    }
    return {
      breakdown: b.id,
      label: b.label,
      gapLabel: b.gapLabel,
      a: { id: b.disadvantaged, label: label(b.disadvantaged), value: dv },
      b: { id: b.advantaged, label: label(b.advantaged), value: av },
      gap,
      previousGap,
      trend,
    }
  })
}
