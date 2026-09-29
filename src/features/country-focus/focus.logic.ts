import type { FindexRepository } from '@/data/repository'
import type { Entity, IndicatorDefinition, IndicatorId, Wave } from '@/data/types'
import { suggestPeers } from '@/features/compare/compare.logic'
import { demographics, type DemographicRow } from '@/features/countries/profile.logic'
import { buildForecast } from '@/features/forecast/forecast.logic'
import {
  buildMicrofinance,
  type MicrofinanceModel,
} from '@/features/microfinance/microfinance.logic'
import { scopeSourceFor, WORLD } from '@/lib/analytics/scope'
import type { ModelForecast } from '@/lib/forecast'
import { countryInsights } from '@/lib/insights/country'
import type { Insight } from '@/lib/insights/types'
import { compactPeople, pct, pp, ppShort } from '@/lib/insights/text'

/**
 * Country Focus (spec §22): a guided, narrative profile for ANY economy — the same template
 * and rules for every country, with the narrative written from its published values.
 */

/** Indicators scanned for "what changed" in the latest survey. */
export const CHANGE_IDS: IndicatorId[] = [
  'accountOwnership',
  'fiAccount',
  'mobileMoneyAccount',
  'debitCard',
  'digitalPayments',
  'formalSavings',
  'savedAny',
  'formalBorrowing',
  'borrowedAny',
  'mobilePhone',
  'internetUse',
]

export interface FocusChange {
  indicator: IndicatorDefinition
  value: number
  previous: { wave: Wave; value: number }
  delta: number
}

export interface FocusModel {
  entity: Entity
  wave: Wave
  surveyYear: number
  regionName: string | null
  regionCode: string | null
  headline: {
    account: number | null
    previous: { wave: Wave; value: number } | null
    unbanked: number | null
  }
  journey: {
    series: { id: string; label: string; points: { wave: Wave; value: number | null }[] }[]
    narrative: string[]
  }
  changes: { rises: FocusChange[]; falls: FocusChange[] }
  demographics: DemographicRow[]
  digital: {
    account: number | null
    fi: number | null
    mobileOnly: number | null
    payments: number | null
    regionPayments: number | null
  }
  lens: MicrofinanceModel
  outlook: { model: ModelForecast | null; unstable: boolean; lastYear: number | null }
  peers: {
    entity: Entity
    account: number | null
    mobileMoney: number | null
    genderGap: number | null
  }[]
  findings: Insight[]
}

const r2 = (n: number) => Math.round(n * 100) / 100

function journeyNarrative(name: string, pts: { wave: Wave; value: number | null }[]): string[] {
  const obs = pts.filter((p): p is { wave: Wave; value: number } => p.value !== null)
  if (obs.length < 2) return []
  const first = obs[0]!
  const last = obs.at(-1)!
  const peak = obs.reduce((a, b) => (b.value > a.value ? b : a))
  const out = [
    `${name}’s account ownership went from ${pct(first.value)} in ${first.wave} to ${pct(last.value)} in ${last.wave} (${ppShort(last.value - first.value)}).`,
  ]
  if (peak.wave !== last.wave && peak.value - last.value >= 2)
    out.push(
      `It peaked at ${pct(peak.value)} in ${peak.wave}; the latest survey is ${pp(peak.value - last.value)} lower.`,
    )
  const steps = obs.slice(1).map((p, i) => ({ from: obs[i]!, to: p, d: p.value - obs[i]!.value }))
  const biggest = [...steps].sort((a, b) => b.d - a.d)[0]
  if (biggest && biggest.d >= 5)
    out.push(
      `The biggest rise came between ${biggest.from.wave} and ${biggest.to.wave} (${ppShort(biggest.d)}).`,
    )
  return out
}

export function buildFocus(
  repo: FindexRepository,
  entity: Entity,
  groupsReady: boolean,
): FocusModel {
  const wave = repo.latest('accountOwnership', entity.code)?.wave ?? repo.latestWave
  const region = entity.regionId ? repo.region(entity.regionId) : undefined
  const regionCode = region?.aggregateCode ?? null
  const value = (id: IndicatorId, code: string, w = wave) => repo.value(id, code, w)

  const account = value('accountOwnership', entity.code)
  const worldSrc = scopeSourceFor(repo, 'accountOwnership', WORLD)
  const series = [
    {
      id: entity.code,
      label: entity.shortName,
      points: repo.series('accountOwnership', entity.code),
    },
    ...(region
      ? [
          {
            id: region.aggregateCode,
            label: region.name,
            points: repo.series('accountOwnership', region.aggregateCode),
          },
        ]
      : []),
    {
      id: worldSrc.code,
      label: worldSrc.label,
      points: repo.series('accountOwnership', worldSrc.code),
    },
  ]

  const changes = CHANGE_IDS.flatMap((id) => {
    const indicator = repo.indicator(id)
    const v = value(id, entity.code)
    const prev = repo.previous(id, entity.code, wave)
    if (!indicator || v === null || !prev) return []
    return [{ indicator, value: v, previous: prev, delta: r2(v - prev.value) }]
  })

  const acc = value('accountOwnership', entity.code)
  const fi = value('fiAccount', entity.code)
  const fc = buildForecast(repo, { country: entity.code })

  const peers = suggestPeers(repo, entity.code, 5)
    .filter((c) => c !== entity.code)
    .flatMap((c) => {
      const e = repo.entity(c)
      if (!e) return []
      const w = repo.latest('accountOwnership', c)?.wave ?? wave
      return [
        {
          entity: e,
          account: repo.value('accountOwnership', c, w),
          mobileMoney: repo.value('mobileMoneyAccount', c, w),
          genderGap: repo.value('genderGapAccount', c, w),
        },
      ]
    })

  return {
    entity,
    wave,
    surveyYear: repo.surveyYear(entity.code, wave),
    regionName: region?.name ?? null,
    regionCode,
    headline: {
      account,
      previous: repo.previous('accountOwnership', entity.code, wave),
      unbanked: repo.adultsWithoutAccount(entity.code, wave),
    },
    journey: { series, narrative: journeyNarrative(entity.shortName, series[0]!.points) },
    changes: {
      rises: changes
        .filter((c) => c.delta >= 1)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 4),
      falls: changes
        .filter((c) => c.delta <= -1)
        .sort((a, b) => a.delta - b.delta)
        .slice(0, 4),
    },
    demographics: groupsReady ? demographics(repo, entity.code, wave) : [],
    digital: {
      account: acc,
      fi,
      mobileOnly: acc !== null && fi !== null ? r2(Math.max(0, acc - fi)) : null,
      payments: value('digitalPayments', entity.code),
      regionPayments: regionCode ? value('digitalPayments', regionCode) : null,
    },
    lens: buildMicrofinance(repo, { country: entity.code, wave }),
    outlook: {
      model: fc.selected,
      unstable: fc.forecast.unstable,
      lastYear: fc.forecast.lastObservedYear,
    },
    peers,
    findings: countryInsights(repo, entity, wave),
  }
}

/** One-sentence summary used as the page lede. */
export function focusLede(m: FocusModel): string {
  const parts: string[] = []
  const a = m.headline.account
  if (a !== null)
    parts.push(`In ${m.surveyYear}, ${pct(a)} of adults in ${m.entity.shortName} had an account`)
  if (m.headline.previous && a !== null) {
    const d = a - m.headline.previous.value
    parts.push(
      Math.abs(d) < 0.5
        ? `about the same as in ${m.headline.previous.wave}`
        : `${d > 0 ? 'up' : 'down'} ${pp(d)} since ${m.headline.previous.wave}`,
    )
  }
  let s = parts.join(', ')
  if (m.headline.unbanked !== null)
    s += `. About ${compactPeople(m.headline.unbanked)} adults still have none`
  return s ? `${s}.` : `No account-ownership data is published for ${m.entity.shortName}.`
}
