import type { FindexRepository } from '@/data/repository'
import type { Entity, GroupId, IndicatorDefinition, IndicatorId, Wave } from '@/data/types'
import { resolveScope, scopeEconomies, scopeSourceFor, type Scope } from '@/lib/analytics/scope'

/**
 * Microfinance lens (spec §21): saving, credit, resilience and the barriers faced by the
 * unbanked, with women and the poorest 40% alongside everyone. The Findex does not identify
 * microfinance institutions separately; its "formal" categories cover banks and similar
 * financial institutions (and, for some questions, mobile money). All values are published
 * shares; nothing here is modelled.
 */

export const SAVING_IDS: IndicatorId[] = [
  'savedAny',
  'formalSavings',
  'savedAtFI',
  'savedMobileMoney',
  'savedInformal',
  'savedOldAge',
]
export const BORROWING_IDS: IndicatorId[] = [
  'borrowedAny',
  'formalBorrowing',
  'borrowedFromFI',
  'borrowedMobileMoney',
  'borrowedSavingsClub',
  'borrowedFamily',
]
export const PURPOSE_IDS: IndicatorId[] = ['borrowedForBusiness', 'borrowedForHealth']
export const RESILIENCE_IDS: IndicatorId[] = ['emergencyFundsPossible', 'emergencyFromSavings']
export const BARRIER_IDS: IndicatorId[] = [
  'barrierFunds',
  'barrierCost',
  'barrierDistance',
  'barrierDocuments',
  'barrierTrust',
  'barrierFamily',
]
/** Rows of the "who is left out" table. */
export const EQUITY_IDS: IndicatorId[] = [
  'accountOwnership',
  'savedAny',
  'formalSavings',
  'borrowedAny',
  'formalBorrowing',
  'borrowedForBusiness',
  'emergencyFundsPossible',
]

export interface LensValue {
  indicator: IndicatorDefinition
  value: number | null
  /** Aggregate or economy the value comes from. */
  sourceLabel: string
  fallback: boolean
}

export interface EquityRow {
  indicator: IndicatorDefinition
  all: number | null
  women: number | null
  men: number | null
  poorest: number | null
  richest: number | null
}

export interface MicrofinanceModel {
  wave: Wave
  target: {
    kind: 'economy' | 'aggregate'
    code: string
    label: string
    entity?: Entity
    scope?: Scope
  }
  saving: LensValue[]
  borrowing: LensValue[]
  purpose: LensValue[]
  resilience: LensValue[]
  barriers: LensValue[]
  equity: EquityRow[]
  /** Economies in scope where informal saving (e.g. savings clubs) is most common. */
  informalLeaders: { entity: Entity; value: number; formal: number | null }[]
}

export function buildMicrofinance(
  repo: FindexRepository,
  opts: { wave?: Wave; country?: string; region?: string; income?: string } = {},
): MicrofinanceModel {
  const wave = opts.wave && repo.waves.includes(opts.wave) ? opts.wave : repo.latestWave
  const entity = opts.country ? repo.entity(opts.country) : undefined
  const scope = resolveScope(repo, { region: opts.region, income: opts.income })
  const target =
    entity?.kind === 'economy'
      ? { kind: 'economy' as const, code: entity.code, label: entity.shortName, entity }
      : { kind: 'aggregate' as const, code: scope.code, label: scope.label, scope }

  const lens = (id: IndicatorId, group: GroupId = 'all'): LensValue | null => {
    const indicator = repo.indicator(id)
    if (!indicator) return null
    if (target.kind === 'economy')
      return {
        indicator,
        value: repo.value(id, target.code, wave, group),
        sourceLabel: target.label,
        fallback: false,
      }
    const src = scopeSourceFor(repo, id, scope, group)
    return {
      indicator,
      value: repo.value(id, src.code, wave, group),
      sourceLabel: src.label,
      fallback: src.code !== scope.code,
    }
  }
  const many = (ids: IndicatorId[]) => ids.flatMap((id) => lens(id) ?? [])

  const equity = EQUITY_IDS.flatMap((id) => {
    const indicator = repo.indicator(id)
    if (!indicator) return []
    const v = (g: GroupId) => lens(id, g)?.value ?? null
    return [
      {
        indicator,
        all: v('all'),
        women: v('women'),
        men: v('men'),
        poorest: v('poorest40'),
        richest: v('richest60'),
      },
    ]
  })

  const informalLeaders = scopeEconomies(repo, scope)
    .flatMap((e) => {
      const v = repo.value('savedInformal', e.code, wave)
      return v === null
        ? []
        : [{ entity: e, value: v, formal: repo.value('formalSavings', e.code, wave) }]
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  return {
    wave,
    target,
    saving: many(SAVING_IDS),
    borrowing: many(BORROWING_IDS),
    purpose: many(PURPOSE_IDS),
    resilience: many(RESILIENCE_IDS),
    barriers: many(BARRIER_IDS),
    equity,
    informalLeaders,
  }
}
