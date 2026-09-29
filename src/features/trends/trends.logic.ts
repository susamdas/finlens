import type { FindexRepository } from '@/data/repository'
import type { Entity, IndicatorDefinition, IndicatorId, Wave } from '@/data/types'
import { overviewMetrics } from '@/features/overview/overview.logic'
import {
  resolveScope,
  scopeEconomies,
  scopeSourceFor,
  WORLD,
  type Scope,
} from '@/lib/analytics/scope'
import { linearRegression, MIN_CORRELATION_N, pearson, type LinearFit } from '@/lib/analytics/stats'

/**
 * Trend analytics (spec §12).
 *
 * Observed survey waves only — no interpolation between waves and no projection (forecasts are
 * a separate, clearly labelled phase). Aggregates are the World Bank's published figures.
 * Economy-level change compares the *same* economy in the two chosen waves; economies missing
 * either wave are left out, never filled in. Rates per year use actual survey years (some
 * economies were surveyed in 2022 for the 2021 wave).
 */

export const DEFAULT_TREND_METRIC: IndicatorId = 'accountOwnership'
/** A change smaller than this (pp) counts as "little changed". */
export const FLAT_PP = 1

export interface EconomyChange {
  entity: Entity
  from: number
  to: number
  delta: number
  years: number
  perYear: number
}

export interface WaveDistribution {
  wave: Wave
  n: number
  p10: number | null
  p25: number | null
  median: number | null
  p75: number | null
  p90: number | null
}

export interface ComparisonLine {
  id: string
  label: string
  code: string
  points: { wave: Wave; value: number | null }[]
  selected: boolean
}

export interface TrendModel {
  metric: IndicatorDefinition
  scope: Scope
  /** Aggregate used for the scope (Developing economies when no world figure exists). */
  source: Scope
  fallback: boolean
  from: Wave
  to: Wave
  /** Waves in which the scope aggregate is published. */
  availableWaves: Wave[]
  aggregate: { wave: Wave; value: number | null }[]
  headline: {
    from: number | null
    to: number | null
    delta: number | null
    perYear: number | null
  }
  lines: ComparisonLine[]
  distribution: WaveDistribution[]
  changes: EconomyChange[]
  improvers: EconomyChange[]
  decliners: EconomyChange[]
  counts: { up: number; down: number; flat: number; compared: number; inScope: number }
  convergence: {
    points: { entity: Entity; x: number; y: number }[]
    r: number | null
    fit: LinearFit | null
  }
  periods: {
    pairs: [Wave, Wave][]
    rows: { id: string; label: string; selected: boolean; cells: (number | null)[] }[]
  }
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function trendMetrics(repo: FindexRepository): IndicatorDefinition[] {
  return overviewMetrics(repo)
}

/** Linear-interpolated quantile of a sorted array (type 7, as in R / NumPy default). */
export function quantile(sorted: number[], q: number): number | null {
  if (!sorted.length) return null
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return r2(sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo))
}

export function buildTrends(
  repo: FindexRepository,
  opts: {
    metric?: string
    region?: string
    income?: string
    from?: number | null
    to?: number | null
  } = {},
): TrendModel {
  const metrics = trendMetrics(repo)
  const metric =
    metrics.find((m) => m.id === opts.metric) ??
    metrics.find((m) => m.id === DEFAULT_TREND_METRIC) ??
    metrics[0]!
  const scope = resolveScope(repo, { region: opts.region, income: opts.income })
  const source = scopeSourceFor(repo, metric.id, scope)
  const aggregate = repo.waves.map((w) => ({
    wave: w,
    value: repo.value(metric.id, source.code, w),
  }))
  const availableWaves = aggregate.filter((p) => p.value !== null).map((p) => p.wave)

  // Period: requested waves if valid, else first → last published wave for the aggregate.
  const waves = repo.waves
  const firstAvail = availableWaves[0] ?? waves[0]!
  const lastAvail = availableWaves.at(-1) ?? waves.at(-1)!
  let from = opts.from && waves.includes(opts.from) ? opts.from : firstAvail
  let to = opts.to && waves.includes(opts.to) ? opts.to : lastAvail
  if (from >= to) {
    from = firstAvail
    to = lastAvail
  }

  const hFrom = repo.value(metric.id, source.code, from)
  const hTo = repo.value(metric.id, source.code, to)
  const headline = {
    from: hFrom,
    to: hTo,
    delta: hFrom !== null && hTo !== null ? r2(hTo - hFrom) : null,
    perYear: hFrom !== null && hTo !== null ? r2((hTo - hFrom) / (to - from)) : null,
  }

  // Comparison lines: every Findex region plus the global reference, fixed order.
  const globalSrc = scopeSourceFor(repo, metric.id, WORLD)
  const lineFor = (id: string, label: string, code: string, selected: boolean): ComparisonLine => ({
    id,
    label,
    code,
    selected,
    points: waves.map((w) => ({ wave: w, value: repo.value(metric.id, code, w) })),
  })
  const lines: ComparisonLine[] = [
    lineFor('global', globalSrc.label, globalSrc.code, source.code === globalSrc.code),
    ...repo.regions.map((r) =>
      lineFor(r.id, r.name, r.aggregateCode, source.code === r.aggregateCode),
    ),
  ]
  if (!lines.some((l) => l.selected)) lines.push(lineFor('scope', source.label, source.code, true))

  const economies = scopeEconomies(repo, scope)
  const distribution = waves.map((w) => {
    const vals = economies
      .map((e) => repo.value(metric.id, e.code, w))
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b)
    return {
      wave: w,
      n: vals.length,
      p10: quantile(vals, 0.1),
      p25: quantile(vals, 0.25),
      median: quantile(vals, 0.5),
      p75: quantile(vals, 0.75),
      p90: quantile(vals, 0.9),
    }
  })

  const changes: EconomyChange[] = []
  for (const e of economies) {
    const a = repo.value(metric.id, e.code, from)
    const b = repo.value(metric.id, e.code, to)
    if (a === null || b === null) continue
    const years = Math.max(1, repo.surveyYear(e.code, to) - repo.surveyYear(e.code, from))
    changes.push({
      entity: e,
      from: a,
      to: b,
      delta: r2(b - a),
      years,
      perYear: r2((b - a) / years),
    })
  }
  const improvers = changes
    .filter((c) => c.delta >= FLAT_PP)
    .sort((x, y) => y.delta - x.delta)
    .slice(0, 10)
  const decliners = changes
    .filter((c) => c.delta <= -FLAT_PP)
    .sort((x, y) => x.delta - y.delta)
    .slice(0, 10)
  const counts = {
    up: changes.filter((c) => c.delta >= FLAT_PP).length,
    down: changes.filter((c) => c.delta <= -FLAT_PP).length,
    flat: changes.filter((c) => Math.abs(c.delta) < FLAT_PP).length,
    compared: changes.length,
    inScope: economies.length,
  }

  const cPoints = changes.map((c) => ({ entity: c.entity, x: c.from, y: c.delta }))
  const enough = cPoints.length >= MIN_CORRELATION_N
  const convergence = {
    points: cPoints,
    r: enough ? pearson(cPoints) : null,
    fit: enough ? linearRegression(cPoints) : null,
  }

  const pairs: [Wave, Wave][] = waves.slice(1).map((w, i) => [waves[i]!, w])
  const periods = {
    pairs,
    rows: lines.map((l) => ({
      id: l.id,
      label: l.label,
      selected: l.selected,
      cells: pairs.map(([a, b]) => {
        const va = l.points.find((p) => p.wave === a)?.value ?? null
        const vb = l.points.find((p) => p.wave === b)?.value ?? null
        return va !== null && vb !== null ? r2(vb - va) : null
      }),
    })),
  }

  return {
    metric,
    scope,
    source,
    fallback: source.code !== scope.code,
    from,
    to,
    availableWaves,
    aggregate,
    headline,
    lines,
    distribution,
    changes,
    improvers,
    decliners,
    counts,
    convergence,
    periods,
  }
}
