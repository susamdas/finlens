import type { FindexRepository } from '@/data/repository'
import type { Wave } from '@/data/types'
import { movementTone } from '@/lib/analytics/direction'
import { changes, topMovers } from '@/lib/analytics/movers'
import { scopeEconomies, scopeSourceFor, WORLD, type Scope } from '@/lib/analytics/scope'
import { unbankedAdults } from '@/lib/analytics/kpi'
import { filtersToQuery } from '@/lib/url'
import type { Insight, InsightTone } from './types'
import { changeVerb, compactPeople, compareChanges, pct, pp, ppShort } from './text'

type Rule = (repo: FindexRepository, scope: Scope, wave: Wave) => Insight | Insight[] | null

const toneOf = (delta: number, higherIsBetter: boolean | null): InsightTone => {
  const t = movementTone(delta, higherIsBetter)
  return t === 'missing' ? 'neutral' : t
}

const scopeQuery = (scope: Scope, extra: Record<string, string | number> = {}) =>
  filtersToQuery({
    ...(scope.regionId ? { region: scope.regionId.toLowerCase() } : {}),
    ...(scope.incomeGroupId ? { income: scope.incomeGroupId.toLowerCase() } : {}),
    ...extra,
  })

/** Change in a scope aggregate vs its previous wave. */
function aggregateChange(repo: FindexRepository, id: string, scope: Scope, wave: Wave) {
  const src = scopeSourceFor(repo, id, scope)
  const value = repo.value(id, src.code, wave)
  const prev = repo.previous(id, src.code, wave)
  if (value === null || !prev) return null
  return { src, value, prev, delta: Math.round((value - prev.value) * 100) / 100 }
}

const accountChange: Rule = (repo, scope, wave) => {
  const c = aggregateChange(repo, 'accountOwnership', scope, wave)
  if (!c) return null
  return {
    id: 'account-change',
    tone: toneOf(c.delta, true),
    title: `Account ownership in ${c.src.label} ${changeVerb(c.delta)} between ${c.prev.wave} and ${wave}, to ${pct(c.value)}.`,
    evidence: `${c.src.label} aggregate · ${c.prev.wave} ${pct(c.prev.value)} → ${wave} ${pct(c.value)}`,
    link: `/trends${scopeQuery(scope, { metric: 'accountOwnership' })}`,
    priority: 1,
  }
}

const genderGap: Rule = (repo, scope, wave) => {
  const src = scopeSourceFor(repo, 'accountOwnership', scope, 'women')
  const women = repo.value('accountOwnership', src.code, wave, 'women')
  const men = repo.value('accountOwnership', src.code, wave, 'men')
  if (women === null || men === null) return null
  const gap = Math.round((men - women) * 100) / 100
  const prevWave = repo.waves
    .filter((w) => w < wave)
    .reverse()
    .find((w) => repo.gap('accountOwnership', src.code, w, 'sex') !== null)
  const prevGap =
    prevWave !== undefined ? repo.gap('accountOwnership', src.code, prevWave, 'sex') : null
  let detail: string | undefined
  if (prevGap !== null && prevWave !== undefined) {
    const d = Math.round((gap - prevGap) * 100) / 100
    detail =
      Math.abs(d) < 0.5
        ? `The gap is about the same as in ${prevWave} (${pp(prevGap)}).`
        : `The gap ${d < 0 ? 'narrowed' : 'widened'} by ${pp(d)} since ${prevWave}.`
  }
  if (Math.abs(gap) < 0.5)
    return {
      id: 'gender-gap',
      tone: 'positive',
      title: `Women and men in ${src.label} have similar account ownership (${pct(women)} vs ${pct(men)}).`,
      detail,
      evidence: `${src.label} aggregate · ${wave} · women and men`,
      link: `/gaps${scopeQuery(scope)}`,
      priority: 2,
    }
  return {
    id: 'gender-gap',
    tone: gap > 0 ? 'warning' : 'neutral',
    title:
      gap > 0
        ? `Women’s account ownership in ${src.label} remains ${pp(gap)} below men’s (${pct(women)} vs ${pct(men)}).`
        : `Women’s account ownership in ${src.label} is ${pp(gap)} above men’s (${pct(women)} vs ${pct(men)}).`,
    detail,
    evidence: `${src.label} aggregate · ${wave} · women and men`,
    link: `/gaps${scopeQuery(scope)}`,
    priority: 2,
  }
}

const mobileVsAccount: Rule = (repo, scope, wave) => {
  const m = aggregateChange(repo, 'mobileMoneyAccount', scope, wave)
  const a = aggregateChange(repo, 'accountOwnership', scope, wave)
  if (!m || !a || m.prev.wave !== a.prev.wave) return null
  if (Math.abs(m.delta - a.delta) < 1) return null
  return {
    id: 'mobile-vs-account',
    tone: 'neutral',
    title: `Mobile money accounts ${compareChanges(m.delta, a.delta, 'overall account ownership')} in ${m.src.label} (${ppShort(m.delta)} vs ${ppShort(a.delta)}, ${m.prev.wave}–${wave}).`,
    evidence: `${m.src.label} aggregate · mobile money ${pct(m.value)}, all accounts ${pct(a.value)} in ${wave}`,
    link: `/digital${scopeQuery(scope)}`,
    priority: 3,
  }
}

const digitalPayments: Rule = (repo, scope, wave) => {
  const c = aggregateChange(repo, 'digitalPayments', scope, wave)
  if (!c) return null
  return {
    id: 'digital-payments',
    tone: toneOf(c.delta, true),
    title: `${pct(c.value)} of adults in ${c.src.label} made or received a digital payment in ${wave}; this ${changeVerb(c.delta)} since ${c.prev.wave}.`,
    evidence: `${c.src.label} aggregate · ${c.prev.wave} ${pct(c.prev.value)} → ${wave} ${pct(c.value)}`,
    link: `/digital${scopeQuery(scope)}`,
    priority: 4,
  }
}

const savingsFormality: Rule = (repo, scope, wave) => {
  const src = scopeSourceFor(repo, 'savedAny', scope)
  const any = repo.value('savedAny', src.code, wave)
  const formal = repo.value('formalSavings', src.code, wave)
  if (any === null || formal === null || any - formal < 5) return null
  return {
    id: 'savings-formality',
    tone: 'warning',
    title: `${pct(any)} of adults in ${src.label} saved money in ${wave}, but only ${pct(formal)} saved in an account.`,
    detail:
      'The difference reflects saving outside the formal system — at home, in savings clubs or with other people.',
    evidence: `${src.label} aggregate · ${wave} · saved any money vs saved at a financial institution or mobile money account`,
    link: `/microfinance${scopeQuery(scope)}`,
    priority: 5,
  }
}

const unbanked: Rule = (repo, scope, wave) => {
  const econ = scopeEconomies(repo, scope)
  const u = unbankedAdults(
    repo,
    econ.map((e) => e.code),
    wave,
  )
  if (!u || u.total < 1000) return null
  return {
    id: 'unbanked',
    tone: 'warning',
    title: `About ${compactPeople(u.total)} adults across the ${u.economies} surveyed economies ${scope.kind === 'world' ? '' : `of ${scope.label} `}have no account.`,
    detail: 'FinLens estimate: each economy’s adult population × share without an account, summed.',
    evidence: `${u.economies} economies · ${wave} · Findex adult population and account ownership`,
    link: `/map${filtersToQuery({ metric: 'noAccount', year: wave })}`,
    priority: 6,
  }
}

const regionalSpread: Rule = (repo, scope, wave) => {
  if (scope.kind !== 'world') return null
  const developing = repo.regions
    .filter((r) => r.excludesHighIncome)
    .map((r) => ({ r, v: repo.value('accountOwnership', r.aggregateCode, wave) }))
    .filter((x): x is { r: (typeof x)['r']; v: number } => x.v !== null)
    .sort((a, b) => b.v - a.v)
  if (developing.length < 3) return null
  const hi = developing[0]!
  const lo = developing[developing.length - 1]!
  const hic = repo.value('accountOwnership', 'HIC', wave)
  return {
    id: 'regional-spread',
    tone: 'neutral',
    title: `Among developing regions, account ownership ranges from ${pct(lo.v)} in ${lo.r.name} to ${pct(hi.v)} in ${hi.r.name}.`,
    detail:
      hic !== null
        ? `High-income economies, grouped separately in Findex, stand at ${pct(hic)}.`
        : undefined,
    evidence: `Findex regional aggregates (excluding high income) · ${wave}`,
    link: `/regions${filtersToQuery({ metric: 'accountOwnership', year: wave })}`,
    priority: 7,
  }
}

const topMover: Rule = (repo, scope, wave) => {
  const movers = changes(repo, 'accountOwnership', wave, scopeEconomies(repo, scope))
  if (movers.length < 3) return null
  const up = topMovers(movers, 1, 'up')[0]
  const down = topMovers(movers, 1, 'down')[0]
  const out: Insight[] = []
  if (up && up.delta >= 1)
    out.push({
      id: 'top-improver',
      tone: 'positive',
      title: `${up.entity.shortName} recorded the largest increase in account ownership${scope.kind === 'world' ? '' : ` in ${scope.label}`}: ${ppShort(up.delta)} (${up.previous.wave}–${wave}).`,
      evidence: `${up.entity.shortName} · ${pct(up.previous.value)} → ${pct(up.value)}`,
      link: `/country/${up.entity.slug}`,
      priority: 8,
    })
  if (down && down.delta <= -3)
    out.push({
      id: 'top-decline',
      tone: 'negative',
      title: `${down.entity.shortName} saw the largest decline in account ownership${scope.kind === 'world' ? '' : ` in ${scope.label}`}: ${ppShort(down.delta)} (${down.previous.wave}–${wave}).`,
      evidence: `${down.entity.shortName} · ${pct(down.previous.value)} → ${pct(down.value)}`,
      link: `/country/${down.entity.slug}`,
      priority: 9,
    })
  return out
}

const RULES: Rule[] = [
  accountChange,
  genderGap,
  mobileVsAccount,
  digitalPayments,
  savingsFormality,
  unbanked,
  regionalSpread,
  topMover,
]

/** Runs every overview rule; rules that lack data simply produce nothing. */
export function overviewInsights(
  repo: FindexRepository,
  scope: Scope = WORLD,
  wave: Wave = repo.latestWave,
): Insight[] {
  return RULES.flatMap((rule) => {
    const r = rule(repo, scope, wave)
    return r === null ? [] : Array.isArray(r) ? r : [r]
  }).sort((a, b) => a.priority - b.priority)
}
