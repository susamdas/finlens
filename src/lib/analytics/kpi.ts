import type { FindexRepository } from '@/data/repository'
import type { GroupId, IndicatorDefinition, IndicatorId, SeriesPoint, Wave } from '@/data/types'
import { scopeSourceFor, type Scope } from './scope'

export interface KpiModel {
  indicator: IndicatorDefinition
  group: GroupId
  wave: Wave
  value: number | null
  previous: { wave: Wave; value: number } | null
  /** Percentage-point change vs `previous`, rounded to 2 dp. */
  delta: number | null
  series: SeriesPoint[]
  /** Aggregate the numbers come from (may be Developing economies when World isn't published). */
  source: Scope
  fallback: boolean
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Everything a KPI card needs, computed outside the UI. */
export function buildKpi(
  repo: FindexRepository,
  id: IndicatorId,
  scope: Scope,
  wave: Wave,
  group: GroupId = 'all',
): KpiModel | null {
  const indicator = repo.indicator(id)
  if (!indicator) return null
  const source = scopeSourceFor(repo, id, scope, group)
  const value = repo.value(id, source.code, wave, group)
  const previous = repo.previous(id, source.code, wave, group)
  return {
    indicator,
    group,
    wave,
    value,
    previous,
    delta: value !== null && previous ? round2(value - previous.value) : null,
    series: repo.series(id, source.code, group).filter((p) => p.wave <= wave),
    source,
    fallback: source.code !== scope.code,
  }
}

/** Sum of adults without an account across the scope's surveyed economies (FinLens estimate). */
export function unbankedAdults(
  repo: FindexRepository,
  codes: string[],
  wave: Wave,
): { total: number; economies: number } | null {
  let total = 0
  let economies = 0
  for (const code of codes) {
    const n = repo.adultsWithoutAccount(code, wave)
    if (n !== null) {
      total += n
      economies++
    }
  }
  return economies ? { total, economies } : null
}
