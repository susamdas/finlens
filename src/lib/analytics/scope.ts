import type { FindexRepository } from '@/data/repository'
import type { CountryCode, Entity, GroupId, IndicatorId, Wave } from '@/data/types'

/**
 * A "scope" is the population a dashboard summarizes: the world, a Findex region, an income
 * group, or developing economies. Every scope maps to a World Bank *published* aggregate,
 * so headline numbers are never FinLens re-computations.
 */
export type ScopeKind = 'world' | 'developing' | 'region' | 'income'

export interface Scope {
  kind: ScopeKind
  /** Aggregate entity code: WLD, LMY, SAS, LMC, … */
  code: CountryCode
  label: string
  /** Filter for economy-level views within the scope. */
  regionId?: string
  incomeGroupId?: string
}

export const WORLD: Scope = { kind: 'world', code: 'WLD', label: 'World' }
export const DEVELOPING: Scope = { kind: 'developing', code: 'LMY', label: 'Developing economies' }

/** Resolves URL filters (region / income slugs or ids) to a scope. Region wins if both are set. */
export function resolveScope(
  repo: FindexRepository,
  filters: { region?: string; income?: string },
): Scope {
  if (filters.region === 'developing') return DEVELOPING
  if (filters.region) {
    const r = repo.region(filters.region) ?? repo.region(filters.region.toUpperCase())
    if (r) return { kind: 'region', code: r.aggregateCode, label: r.name, regionId: r.id }
  }
  if (filters.income) {
    const g = repo.incomeGroup(filters.income) ?? repo.incomeGroup(filters.income.toUpperCase())
    if (g) return { kind: 'income', code: g.aggregateCode, label: g.name, incomeGroupId: g.id }
  }
  return WORLD
}

export interface ScopedValue {
  value: number | null
  /** Aggregate actually used; differs from scope.code when the world figure isn't published. */
  source: { code: CountryCode; label: string }
  fallback: boolean
}

/**
 * Value for a scope. The Findex 2025 file publishes usage indicators (payments, savings,
 * borrowing…) only for developing economies, so for the World scope FinLens falls back to
 * the Developing-economies aggregate and flags it — it never estimates a world figure.
 */
export function scopeValue(
  repo: FindexRepository,
  id: IndicatorId,
  scope: Scope,
  wave: Wave,
  group: GroupId = 'all',
): ScopedValue {
  const v = repo.value(id, scope.code, wave, group)
  if (v !== null || scope.kind !== 'world')
    return { value: v, source: { code: scope.code, label: scope.label }, fallback: false }
  const d = repo.value(id, DEVELOPING.code, wave, group)
  if (d !== null)
    return { value: d, source: { code: DEVELOPING.code, label: DEVELOPING.label }, fallback: true }
  return { value: null, source: { code: scope.code, label: scope.label }, fallback: false }
}

/** Which aggregate to use for an indicator across all waves (so a series never mixes sources). */
export function scopeSourceFor(
  repo: FindexRepository,
  id: IndicatorId,
  scope: Scope,
  group: GroupId = 'all',
): Scope {
  if (scope.kind !== 'world') return scope
  const hasWorld = repo.waves.some((w) => repo.value(id, WORLD.code, w, group) !== null)
  if (hasWorld) return WORLD
  const hasDev = repo.waves.some((w) => repo.value(id, DEVELOPING.code, w, group) !== null)
  return hasDev ? DEVELOPING : WORLD
}

/** Economies belonging to the scope. */
export function scopeEconomies(repo: FindexRepository, scope: Scope): Entity[] {
  return repo.economies().filter((e) => {
    if (scope.kind === 'region') return e.regionId === scope.regionId
    if (scope.kind === 'income') return e.incomeGroupId === scope.incomeGroupId
    if (scope.kind === 'developing') return e.incomeGroupId !== 'HIC'
    return true
  })
}
