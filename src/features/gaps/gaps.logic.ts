import type { FindexRepository } from '@/data/repository'
import type {
  Breakdown,
  BreakdownId,
  Entity,
  GroupId,
  IndicatorDefinition,
  IndicatorId,
  Wave,
} from '@/data/types'
import { demographics, type DemographicRow } from '@/features/countries/profile.logic'
import { resolveScope, scopeEconomies, scopeSourceFor, type Scope } from '@/lib/analytics/scope'
import { linearRegression, MIN_CORRELATION_N, pearson, type LinearFit } from '@/lib/analytics/stats'

/**
 * Inclusion gap analysis (spec §10).
 *
 * A gap is always `advantaged − disadvantaged` in percentage points, computed from the two
 * published group values (e.g. men − women). Negative means the usually-disadvantaged group is
 * ahead ("reversed"). Aggregates come from the World Bank's published figures; FinLens never
 * averages economies itself. Requires all population groups (`repo.ensureGroups()`).
 */

export const DEFAULT_BREAKDOWN: BreakdownId = 'sex'
export const DEFAULT_GAP_METRIC: IndicatorId = 'accountOwnership'

/** Indicators with broad group-level coverage in the Findex file. */
export const GAP_METRIC_IDS: IndicatorId[] = [
  'accountOwnership',
  'fiAccount',
  'mobileMoneyAccount',
  'debitCard',
  'digitalPayments',
  'savedAny',
  'formalSavings',
  'borrowedAny',
  'formalBorrowing',
  'emergencyFundsPossible',
  'mobilePhone',
  'internetUse',
]

/** A gap change smaller than this (pp) is reported as "stable". */
export const GAP_STABLE_PP = 1

export type GapTrend = 'narrowed' | 'widened' | 'stable'

export interface GapEconomyRow {
  entity: Entity
  regionName: string | null
  /** Disadvantaged group value (e.g. women). */
  a: number | null
  /** Advantaged group value (e.g. men). */
  b: number | null
  overall: number | null
  gap: number | null
  previousGap: { wave: Wave; value: number } | null
  /** Change in the size of the gap: |gap| − |previous|. Negative = narrowed. */
  sizeChange: number | null
  trend: GapTrend | null
}

export interface GapHeadline {
  source: Scope
  fallback: boolean
  a: number | null
  b: number | null
  /** Each group's previous published value at the same aggregate. */
  aPrevious: { wave: Wave; value: number } | null
  bPrevious: { wave: Wave; value: number } | null
  gap: number | null
  previousGap: { wave: Wave; value: number } | null
  trend: GapTrend | null
}

export interface GapModel {
  wave: Wave
  scope: Scope
  metric: IndicatorDefinition
  breakdown: Breakdown
  labels: { a: string; b: string }
  /** Waves in which this breakdown is published for the metric at the scope aggregate. */
  availableWaves: Wave[]
  headline: GapHeadline
  /** Every breakdown for the metric at the scope aggregate (for the overview strip). */
  allBreakdowns: DemographicRow[]
  rows: GapEconomyRow[]
  stats: {
    measured: number
    inScope: number
    median: number | null
    advantagedAhead: number
    reversed: number
    narrowed: number
    widened: number
    stable: number
  }
  scatter: {
    points: { entity: Entity; x: number; y: number }[]
    r: number | null
    fit: LinearFit | null
  }
  /** Gap over time at the scope aggregate, per breakdown. */
  trend: { breakdown: Breakdown; points: { wave: Wave; value: number | null }[] }[]
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function gapMetrics(repo: FindexRepository): IndicatorDefinition[] {
  return GAP_METRIC_IDS.flatMap((id) => {
    const i = repo.indicator(id)
    return i ? [i] : []
  })
}

export function resolveBreakdown(repo: FindexRepository, id: string | null | undefined): Breakdown {
  return (
    repo.breakdowns.find((b) => b.id === id) ??
    repo.breakdown(DEFAULT_BREAKDOWN) ??
    repo.breakdowns[0]!
  )
}

export function trendOf(gap: number, previous: number): GapTrend {
  const d = Math.abs(gap) - Math.abs(previous)
  return Math.abs(d) < GAP_STABLE_PP ? 'stable' : d < 0 ? 'narrowed' : 'widened'
}

/** Most recent earlier wave in which the gap is published for this entity. */
export function previousGap(
  repo: FindexRepository,
  id: IndicatorId,
  code: string,
  wave: Wave,
  breakdown: BreakdownId,
): { wave: Wave; value: number } | null {
  for (const w of [...repo.waves].reverse()) {
    if (w >= wave) continue
    const g = repo.gap(id, code, w, breakdown)
    if (g !== null) return { wave: w, value: g }
  }
  return null
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : r2((s[m - 1]! + s[m]!) / 2)
}

export function buildGapModel(
  repo: FindexRepository,
  opts: {
    wave?: Wave
    metric?: string
    breakdown?: string | null
    region?: string
    income?: string
  } = {},
): GapModel {
  const wave = opts.wave && repo.waves.includes(opts.wave) ? opts.wave : repo.latestWave
  const metrics = gapMetrics(repo)
  const metric =
    metrics.find((m) => m.id === opts.metric) ??
    metrics.find((m) => m.id === DEFAULT_GAP_METRIC) ??
    metrics[0]!
  const breakdown = resolveBreakdown(repo, opts.breakdown)
  const scope = resolveScope(repo, { region: opts.region, income: opts.income })
  const groupLabel = (g: GroupId) => repo.meta.groups.find((x) => x.id === g)?.label ?? g
  const labels = { a: groupLabel(breakdown.disadvantaged), b: groupLabel(breakdown.advantaged) }

  // Aggregate: the scope's own figure, or Developing economies where no world figure exists.
  const source = scopeSourceFor(repo, metric.id, scope, breakdown.disadvantaged)
  const headGap = repo.gap(metric.id, source.code, wave, breakdown.id)
  const headPrev = previousGap(repo, metric.id, source.code, wave, breakdown.id)
  const headline: GapHeadline = {
    source,
    fallback: source.code !== scope.code,
    a: repo.value(metric.id, source.code, wave, breakdown.disadvantaged),
    b: repo.value(metric.id, source.code, wave, breakdown.advantaged),
    aPrevious: repo.previous(metric.id, source.code, wave, breakdown.disadvantaged),
    bPrevious: repo.previous(metric.id, source.code, wave, breakdown.advantaged),
    gap: headGap,
    previousGap: headPrev,
    trend: headGap !== null && headPrev ? trendOf(headGap, headPrev.value) : null,
  }
  const availableWaves = repo.waves.filter(
    (w) => repo.gap(metric.id, source.code, w, breakdown.id) !== null,
  )

  const economies = scopeEconomies(repo, scope)
  const rows: GapEconomyRow[] = economies.map((e) => {
    const gap = repo.gap(metric.id, e.code, wave, breakdown.id)
    const prev = gap !== null ? previousGap(repo, metric.id, e.code, wave, breakdown.id) : null
    const region = e.regionId ? repo.region(e.regionId) : undefined
    return {
      entity: e,
      regionName: region?.name ?? null,
      a: repo.value(metric.id, e.code, wave, breakdown.disadvantaged),
      b: repo.value(metric.id, e.code, wave, breakdown.advantaged),
      overall: repo.value(metric.id, e.code, wave),
      gap,
      previousGap: prev,
      sizeChange: gap !== null && prev ? r2(Math.abs(gap) - Math.abs(prev.value)) : null,
      trend: gap !== null && prev ? trendOf(gap, prev.value) : null,
    }
  })

  const measured = rows.filter((r) => r.gap !== null)
  const gaps = measured.map((r) => r.gap!)
  const count = (t: GapTrend) => measured.filter((r) => r.trend === t).length
  const stats = {
    measured: measured.length,
    inScope: rows.length,
    median: median(gaps),
    advantagedAhead: gaps.filter((g) => g >= GAP_STABLE_PP).length,
    reversed: gaps.filter((g) => g <= -GAP_STABLE_PP).length,
    narrowed: count('narrowed'),
    widened: count('widened'),
    stable: count('stable'),
  }

  const points = measured
    .filter((r) => r.overall !== null)
    .map((r) => ({ entity: r.entity, x: r.overall!, y: r.gap! }))
  const xy = points.map((p) => ({ x: p.x, y: p.y }))
  const enough = points.length >= MIN_CORRELATION_N
  const scatter = {
    points,
    r: enough ? pearson(xy) : null,
    fit: enough ? linearRegression(xy) : null,
  }

  const trend = repo.breakdowns.map((b) => {
    const src = scopeSourceFor(repo, metric.id, scope, b.disadvantaged)
    return {
      breakdown: b,
      points: repo.waves.map((w) => ({ wave: w, value: repo.gap(metric.id, src.code, w, b.id) })),
    }
  })

  return {
    wave,
    scope,
    metric,
    breakdown,
    labels,
    availableWaves,
    headline,
    allBreakdowns: demographics(repo, source.code, wave, metric.id),
    rows,
    stats,
    scatter,
    trend,
  }
}

export type GapSortKey = 'gap' | 'name' | 'a' | 'b' | 'sizeChange'

export function sortGapRows(
  rows: GapEconomyRow[],
  key: GapSortKey,
  dir: 'asc' | 'desc',
): GapEconomyRow[] {
  const sign = dir === 'asc' ? 1 : -1
  const val = (r: GapEconomyRow) => (key === 'name' ? null : r[key])
  return [...rows].sort((x, y) => {
    if (key === 'name') return sign * x.entity.shortName.localeCompare(y.entity.shortName)
    const a = val(x)
    const b = val(y)
    // Missing values always last, whatever the direction.
    if (a === null && b === null) return x.entity.shortName.localeCompare(y.entity.shortName)
    if (a === null) return 1
    if (b === null) return -1
    return sign * (a - b) || x.entity.shortName.localeCompare(y.entity.shortName)
  })
}
