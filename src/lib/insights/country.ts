import type { FindexRepository } from '@/data/repository'
import type { Entity, Wave } from '@/data/types'
import { movementTone } from '@/lib/analytics/direction'
import type { Insight, InsightTone } from './types'
import { changeVerb, compactPeople, compareChanges, pct, pp, ppShort } from './text'

const r2 = (n: number) => Math.round(n * 100) / 100
const tone = (d: number, hib: boolean | null): InsightTone => {
  const t = movementTone(d, hib)
  return t === 'missing' ? 'neutral' : t
}

function change(repo: FindexRepository, id: string, code: string, wave: Wave) {
  const value = repo.value(id, code, wave)
  const prev = repo.previous(id, code, wave)
  return value !== null && prev ? { value, prev, delta: r2(value - prev.value) } : null
}

/**
 * Rule-based findings for one economy. Every sentence is built from dataset values; rules
 * whose inputs are missing produce nothing.
 */
export function countryInsights(
  repo: FindexRepository,
  e: Entity,
  wave: Wave,
  benchmarkCode?: string,
): Insight[] {
  const name = e.shortName
  const out: Insight[] = []
  const region = e.regionId ? repo.region(e.regionId) : undefined
  const benchCode = benchmarkCode ?? region?.aggregateCode
  const benchName = benchCode ? (repo.entity(benchCode)?.shortName ?? benchCode) : null

  const acc = change(repo, 'accountOwnership', e.code, wave)
  if (acc)
    out.push({
      id: 'account-change',
      tone: tone(acc.delta, true),
      title: `${name}’s account ownership ${changeVerb(acc.delta)} compared with the previous available survey (${acc.prev.wave}), to ${pct(acc.value)}.`,
      evidence: `${name} · ${acc.prev.wave} ${pct(acc.prev.value)} → ${wave} ${pct(acc.value)}`,
      link: `/trends?country=${e.code}&metric=accountOwnership`,
      priority: 1,
    })

  const women = repo.value('accountOwnership', e.code, wave, 'women')
  const men = repo.value('accountOwnership', e.code, wave, 'men')
  if (women !== null && men !== null) {
    const gap = r2(men - women)
    const prevWave = [...repo.waves]
      .reverse()
      .find((w) => w < wave && repo.gap('accountOwnership', e.code, w, 'sex') !== null)
    const prevGap =
      prevWave !== undefined ? repo.gap('accountOwnership', e.code, prevWave, 'sex') : null
    let detail: string | undefined
    if (prevGap !== null && prevWave !== undefined) {
      const d = r2(Math.abs(gap) - Math.abs(prevGap))
      detail =
        Math.abs(d) < 1
          ? `Similar to ${prevWave} (${pp(prevGap)}).`
          : `The gap has ${d < 0 ? 'narrowed' : 'widened'} by ${pp(d)} since ${prevWave}.`
    }
    out.push({
      id: 'gender-gap',
      tone: Math.abs(gap) < 2 ? 'positive' : gap > 0 ? 'warning' : 'neutral',
      title:
        Math.abs(gap) < 2
          ? `Women and men in ${name} have similar account ownership (${pct(women)} vs ${pct(men)}).`
          : gap > 0
            ? `Female account ownership remains ${pp(gap)} below male account ownership (${pct(women)} vs ${pct(men)}).`
            : `Female account ownership is ${pp(gap)} above male account ownership (${pct(women)} vs ${pct(men)}).`,
      detail,
      evidence: `${name} · ${wave} · women and men`,
      link: `/gaps?country=${e.code}`,
      priority: 2,
    })
  }

  if (benchCode) {
    const v = repo.value('accountOwnership', e.code, wave)
    const b = repo.value('accountOwnership', benchCode, wave)
    if (v !== null && b !== null && Math.abs(v - b) >= 2)
      out.push({
        id: 'vs-benchmark',
        tone: v > b ? 'positive' : 'warning',
        title: `${name} ${v > b ? 'exceeds' : 'trails'} the ${benchName} average for account ownership by ${pp(v - b)} (${pct(v)} vs ${pct(b)}).`,
        evidence: `${name} vs ${benchName} aggregate · ${wave}`,
        link: `/compare?country=${e.code}`,
        priority: 3,
      })
  }

  const mob = change(repo, 'mobileMoneyAccount', e.code, wave)
  if (mob && acc && mob.prev.wave === acc.prev.wave && Math.abs(mob.delta - acc.delta) >= 1)
    out.push({
      id: 'mobile-vs-account',
      tone: 'neutral',
      title: `Mobile money account ownership ${compareChanges(mob.delta, acc.delta, 'overall account ownership')} (${ppShort(mob.delta)} vs ${ppShort(acc.delta)}, ${acc.prev.wave}–${wave}).`,
      evidence: `${name} · mobile money ${pct(mob.prev.value)} → ${pct(mob.value)}`,
      link: `/digital?country=${e.code}`,
      priority: 4,
    })

  const dig = change(repo, 'digitalPayments', e.code, wave)
  if (dig && Math.abs(dig.delta) >= 3)
    out.push({
      id: 'digital-payments',
      tone: tone(dig.delta, true),
      title: `Digital payment use ${changeVerb(dig.delta)} since ${dig.prev.wave}, reaching ${pct(dig.value)} of adults.`,
      evidence: `${name} · ${dig.prev.wave} ${pct(dig.prev.value)} → ${wave} ${pct(dig.value)}`,
      link: `/digital?country=${e.code}`,
      priority: 5,
    })

  const sav = change(repo, 'formalSavings', e.code, wave)
  if (sav && Math.abs(sav.delta) >= 2)
    out.push({
      id: 'formal-savings',
      tone: tone(sav.delta, true),
      title: `Formal savings ${sav.delta > 0 ? 'increased' : 'declined'} by ${pp(sav.delta)} since ${sav.prev.wave}, to ${pct(sav.value)}.`,
      evidence: `${name} · saved at a financial institution or using a mobile money account`,
      link: `/microfinance?country=${e.code}`,
      priority: 6,
    })

  const any = repo.value('savedAny', e.code, wave)
  const formal = repo.value('formalSavings', e.code, wave)
  if (any !== null && formal !== null && any - formal >= 5)
    out.push({
      id: 'savings-formality',
      tone: 'warning',
      title: `${pct(any)} of adults saved money, but only ${pct(formal)} saved in an account.`,
      detail:
        'Much saving happens outside the formal system — at home, in savings groups or with other people.',
      evidence: `${name} · ${wave}`,
      link: `/microfinance?country=${e.code}`,
      priority: 7,
    })

  const unbanked = repo.adultsWithoutAccount(e.code, wave)
  if (unbanked !== null && unbanked > 0)
    out.push({
      id: 'unbanked',
      tone: 'warning',
      title: `About ${compactPeople(unbanked)} adults in ${name} do not have an account.`,
      detail: 'FinLens estimate: adult population × share without an account.',
      evidence: `${name} · ${wave} · Findex adult population and account ownership`,
      priority: 8,
    })

  return out.sort((a, b) => a.priority - b.priority)
}
