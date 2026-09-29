import type { FindexRepository } from '@/data/repository'
import type { Entity, IndicatorDefinition, IndicatorId, Wave } from '@/data/types'
import {
  resolveScope,
  scopeEconomies,
  scopeSourceFor,
  scopeValue,
  WORLD,
  type Scope,
  type ScopedValue,
} from '@/lib/analytics/scope'
import { linearRegression, MIN_CORRELATION_N, pearson, type LinearFit } from '@/lib/analytics/stats'

/**
 * Digital finance view (spec §11 "Digital finance").
 *
 * "Mobile money only" is derived exactly from published values: account ownership counts
 * adults with a financial-institution account OR a mobile money account, so
 * account − financial-institution account = adults whose only account is mobile money.
 */

export const DIGITAL_KPIS: IndicatorId[] = [
  'mobileMoneyAccount',
  'digitalPayments',
  'debitCard',
  'digitalMerchantPayment',
  'mobilePhone',
  'internetUse',
]

/** How people use digital channels (all shares of adults). */
export const CHANNEL_IDS: IndicatorId[] = [
  'madeDigitalPayment',
  'receivedDigitalPayment',
  'digitalMerchantPayment',
  'onlineBillPayment',
  'onlinePurchase',
  'wagesIntoAccount',
  'govTransferIntoAccount',
]

export interface Pathway {
  id: string
  label: string
  code: string
  account: number | null
  fi: number | null
  /** account − fi; null unless both are published. */
  mobileOnly: number | null
  selected: boolean
}

export interface DigitalModel {
  wave: Wave
  scope: Scope
  kpis: {
    indicator: IndicatorDefinition
    value: ScopedValue
    previous: { wave: Wave; value: number } | null
  }[]
  pathways: Pathway[]
  channels: { indicator: IndicatorDefinition; value: ScopedValue }[]
  leaders: { entity: Entity; value: number }[]
  mobileOnlyLeaders: { entity: Entity; mobileOnly: number; account: number }[]
  trend: {
    indicator: IndicatorDefinition
    source: Scope
    points: { wave: Wave; value: number | null }[]
  }[]
  phoneVsMoney: {
    points: { entity: Entity; x: number; y: number }[]
    r: number | null
    fit: LinearFit | null
  }
}

const r2 = (n: number) => Math.round(n * 100) / 100

function pathway(
  repo: FindexRepository,
  id: string,
  label: string,
  code: string,
  wave: Wave,
  selected: boolean,
): Pathway {
  const account = repo.value('accountOwnership', code, wave)
  const fi = repo.value('fiAccount', code, wave)
  return {
    id,
    label,
    code,
    account,
    fi,
    mobileOnly: account !== null && fi !== null ? r2(Math.max(0, account - fi)) : null,
    selected,
  }
}

export function buildDigital(
  repo: FindexRepository,
  opts: { wave?: Wave; region?: string; income?: string } = {},
): DigitalModel {
  const wave = opts.wave && repo.waves.includes(opts.wave) ? opts.wave : repo.latestWave
  const scope = resolveScope(repo, { region: opts.region, income: opts.income })
  const ind = (id: IndicatorId) => repo.indicator(id)

  const kpis = DIGITAL_KPIS.flatMap((id) => {
    const indicator = ind(id)
    if (!indicator) return []
    const value = scopeValue(repo, id, scope, wave)
    return [{ indicator, value, previous: repo.previous(id, value.source.code, wave) }]
  })

  const pathways: Pathway[] = [
    pathway(repo, 'world', WORLD.label, WORLD.code, wave, scope.code === WORLD.code),
    ...repo.regions.map((r) =>
      pathway(repo, r.id, r.name, r.aggregateCode, wave, scope.code === r.aggregateCode),
    ),
  ]
  if (!pathways.some((p) => p.selected))
    pathways.push(pathway(repo, 'scope', scope.label, scope.code, wave, true))

  const channels = CHANNEL_IDS.flatMap((id) => {
    const indicator = ind(id)
    return indicator ? [{ indicator, value: scopeValue(repo, id, scope, wave) }] : []
  })

  const economies = scopeEconomies(repo, scope)
  const leaders = economies
    .flatMap((e) => {
      const v = repo.value('mobileMoneyAccount', e.code, wave)
      return v === null ? [] : [{ entity: e, value: v }]
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 12)
  const mobileOnlyLeaders = economies
    .flatMap((e) => {
      const a = repo.value('accountOwnership', e.code, wave)
      const f = repo.value('fiAccount', e.code, wave)
      return a === null || f === null
        ? []
        : [{ entity: e, account: a, mobileOnly: r2(Math.max(0, a - f)) }]
    })
    .sort((a, b) => b.mobileOnly - a.mobileOnly)
    .slice(0, 12)

  const trend = (['mobileMoneyAccount', 'digitalPayments', 'debitCard'] as IndicatorId[]).flatMap(
    (id) => {
      const indicator = ind(id)
      if (!indicator) return []
      const source = scopeSourceFor(repo, id, scope)
      return [
        {
          indicator,
          source,
          points: repo.waves.map((w) => ({ wave: w, value: repo.value(id, source.code, w) })),
        },
      ]
    },
  )

  const pts = economies.flatMap((e) => {
    const x = repo.value('mobilePhone', e.code, wave)
    const y = repo.value('mobileMoneyAccount', e.code, wave)
    return x === null || y === null ? [] : [{ entity: e, x, y }]
  })
  const enough = pts.length >= MIN_CORRELATION_N
  return {
    wave,
    scope,
    kpis,
    pathways,
    channels,
    leaders,
    mobileOnlyLeaders,
    trend,
    phoneVsMoney: {
      points: pts,
      r: enough ? pearson(pts) : null,
      fit: enough ? linearRegression(pts) : null,
    },
  }
}
