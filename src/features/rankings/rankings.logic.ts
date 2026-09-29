import type { FindexRepository } from '@/data/repository'
import type { Entity, IndicatorDefinition, IndicatorId, Wave } from '@/data/types'
import { overviewMetrics } from '@/features/overview/overview.logic'

/**
 * Rankings on a single indicator (spec §19).
 *
 * Deliberately one indicator at a time: FinLens does not combine indicators into an overall
 * "best country" score. Rank 1 is the highest value (or the lowest, when the user flips the
 * order) — a position on that indicator, not a judgement about the economy.
 */

export type RankOrder = 'desc' | 'asc'

export interface RankingRow {
  rank: number
  entity: Entity
  regionName: string | null
  value: number
  previous: { wave: Wave; value: number } | null
  change: number | null
  /** Value minus the published aggregate of the economy's Findex region, same wave. */
  regionalDiff: number | null
  regionalValue: number | null
}

export interface RankingModel {
  indicator: IndicatorDefinition
  wave: Wave
  order: RankOrder
  rows: RankingRow[]
  /** Economies in scope with no value for this indicator and wave (listed, never ranked). */
  missing: Entity[]
  median: number | null
}

export const RANKINGS_DEFAULT_METRIC: IndicatorId = 'accountOwnership'

export function rankingMetrics(repo: FindexRepository): IndicatorDefinition[] {
  return overviewMetrics(repo)
}

export function resolveRankingMetric(
  repo: FindexRepository,
  id: string | undefined,
): IndicatorDefinition {
  const list = rankingMetrics(repo)
  return (
    list.find((i) => i.id === id) ?? list.find((i) => i.id === RANKINGS_DEFAULT_METRIC) ?? list[0]!
  )
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Competition ranking (1, 2, 2, 4) in the requested order; ties broken by name for display. */
export function rankValues<T extends { entity: Entity; value: number }>(
  items: T[],
  order: RankOrder,
): (T & { rank: number })[] {
  const sign = order === 'desc' ? -1 : 1
  const sorted = [...items].sort(
    (a, b) => sign * (a.value - b.value) || a.entity.shortName.localeCompare(b.entity.shortName),
  )
  let prev: number | null = null
  let prevRank = 0
  return sorted.map((it, i) => {
    const rank = prev !== null && it.value === prev ? prevRank : i + 1
    prev = it.value
    prevRank = rank
    return { ...it, rank }
  })
}

export function buildRankings(
  repo: FindexRepository,
  opts: {
    metric: IndicatorId
    wave: Wave
    order?: RankOrder
    regionId?: string
    incomeGroupId?: string
  },
): RankingModel {
  const indicator = resolveRankingMetric(repo, opts.metric)
  const order = opts.order ?? 'desc'
  const inScope = repo
    .economies()
    .filter(
      (e) =>
        (!opts.regionId || e.regionId === opts.regionId) &&
        (!opts.incomeGroupId || e.incomeGroupId === opts.incomeGroupId),
    )

  const valued: { entity: Entity; value: number }[] = []
  const missing: Entity[] = []
  for (const e of inScope) {
    const v = repo.value(indicator.id, e.code, opts.wave)
    if (v === null) missing.push(e)
    else valued.push({ entity: e, value: v })
  }

  const rows = rankValues(valued, order).map(({ entity, value, rank }) => {
    const region = entity.regionId ? repo.region(entity.regionId) : undefined
    const previous = repo.previous(indicator.id, entity.code, opts.wave)
    const regionalValue = region ? repo.value(indicator.id, region.aggregateCode, opts.wave) : null
    return {
      rank,
      entity,
      regionName: region?.name ?? null,
      value,
      previous,
      change: previous ? round2(value - previous.value) : null,
      regionalValue,
      regionalDiff: regionalValue !== null ? round2(value - regionalValue) : null,
    }
  })

  const sortedValues = valued.map((v) => v.value).sort((a, b) => a - b)
  const n = sortedValues.length
  const median =
    n === 0
      ? null
      : n % 2
        ? sortedValues[(n - 1) / 2]!
        : round2((sortedValues[n / 2 - 1]! + sortedValues[n / 2]!) / 2)

  return { indicator, wave: opts.wave, order, rows, missing, median }
}
