import type { FindexRepository } from '@/data/repository'
import type { Entity, IndicatorId, Wave } from '@/data/types'
import { buildGapModel } from '@/features/gaps/gaps.logic'
import { buildRegionModel } from '@/features/regions/region.logic'
import { buildTrends } from '@/features/trends/trends.logic'
import { unbankedAdults } from '@/lib/analytics/kpi'
import { DEVELOPING, scopeSourceFor, WORLD } from '@/lib/analytics/scope'
import { gapInsights } from './gaps'
import { regionInsights } from './region'
import { trendInsights } from './trends'
import type { Insight } from './types'
import { compactPeople, pct, pp, ppShort } from './text'

/**
 * Insight engine (spec §14).
 *
 * Runs a registry of rule-based generators over the dataset and returns one ranked feed. Each
 * generator only states what published values show (with an `evidence` trail) and emits
 * nothing when its inputs are missing. No generator names a specific country in code: every
 * economy that appears is selected by a data rule.
 */

export type InsightCategory =
  'access' | 'gaps' | 'digital' | 'savings-credit' | 'resilience' | 'trends'

export const CATEGORY_META: Record<InsightCategory, { label: string; description: string }> = {
  access: { label: 'Access', description: 'Who has an account, and where that is changing' },
  gaps: { label: 'Inclusion gaps', description: 'Differences between population groups' },
  digital: { label: 'Digital finance', description: 'Mobile money and digital payments' },
  'savings-credit': {
    label: 'Saving & credit',
    description: 'Formal and informal saving and borrowing',
  },
  resilience: { label: 'Resilience', description: 'Ability to raise emergency funds' },
  trends: { label: 'Long-run trends', description: 'Change across survey waves since 2011' },
}

export interface EngineInsight extends Insight {
  /** Unique across the feed. */
  key: string
  category: InsightCategory
  scope: { kind: 'world' | 'region' | 'economy'; code: string; label: string }
  /** Higher = shown first. Derived from generator weight and rule priority. */
  score: number
}

export interface EngineContext {
  repo: FindexRepository
  wave: Wave
  /** True once all population groups are loaded (enables non-gender breakdowns). */
  groupsReady: boolean
}

interface Generator {
  id: string
  category: InsightCategory
  /** Relative importance of this generator's findings (0–1). */
  weight: number
  run: (ctx: EngineContext) => Omit<EngineInsight, 'key' | 'category' | 'score'>[]
}

const r2 = (n: number) => Math.round(n * 100) / 100
const worldScope = { kind: 'world' as const, code: 'WLD', label: 'World' }

function economiesWith(repo: FindexRepository, id: IndicatorId, wave: Wave) {
  return repo.crossSection(id, wave)
}

const GENERATORS: Generator[] = [
  {
    id: 'world-trend',
    category: 'trends',
    weight: 1,
    run: ({ repo }) =>
      trendInsights(buildTrends(repo)).map((i) => ({
        ...i,
        scope: worldScope,
        link: i.link ?? '/trends',
      })),
  },
  {
    id: 'unbanked',
    category: 'access',
    weight: 0.95,
    run: ({ repo, wave }) => {
      const u = unbankedAdults(
        repo,
        repo.economies().map((e) => e.code),
        wave,
      )
      const share = repo.value('noAccount', 'WLD', wave)
      if (!u || share === null) return []
      return [
        {
          id: 'unbanked',
          tone: 'warning',
          title: `About ${compactPeople(u.total)} adults in the ${u.economies} surveyed economies have no account — ${pct(share)} of adults worldwide.`,
          detail:
            'FinLens estimate: each economy’s adult population × its published share without an account, summed.',
          evidence: `${u.economies} economies and the World aggregate · ${wave}`,
          link: '/overview',
          priority: 1,
          scope: worldScope,
        },
      ]
    },
  },
  {
    id: 'regions',
    category: 'access',
    weight: 0.7,
    run: ({ repo, wave }) =>
      repo.regions.flatMap((region) => {
        const m = buildRegionModel(repo, region, { wave })
        return regionInsights(repo, region, wave, m.spread)
          .filter((i) => i.id === 'region-change' || i.id === 'region-vs-world')
          .map((i) => ({
            ...i,
            link: i.link ?? `/region/${region.slug}`,
            scope: { kind: 'region' as const, code: region.aggregateCode, label: region.name },
          }))
      }),
  },
  {
    id: 'declines',
    category: 'access',
    weight: 0.85,
    run: ({ repo, wave }) => {
      const falls = economiesWith(repo, 'accountOwnership', wave)
        .flatMap(({ entity, value }) => {
          const prev = repo.previous('accountOwnership', entity.code, wave)
          return prev ? [{ entity, value, prev, delta: r2(value - prev.value) }] : []
        })
        .filter((d) => d.delta <= -5)
        .sort((a, b) => a.delta - b.delta)
      if (!falls.length) return []
      const top = falls.slice(0, 3)
      return [
        {
          id: 'declines',
          tone: 'negative',
          title: `Account ownership fell by 5 points or more in ${falls.length} economies since their previous survey, most in ${top.map((d) => `${d.entity.shortName} (${ppShort(d.delta)})`).join(', ')}.`,
          detail:
            'Falls can reflect real change, economic shocks or differences between survey rounds; check each economy’s profile.',
          evidence: `Economies with account ownership in ${wave} and an earlier wave`,
          link: `/rankings?metric=accountOwnership`,
          priority: 2,
          scope: worldScope,
        },
        ...top.map((d, i) => ({
          id: `decline-${d.entity.code}`,
          tone: 'negative' as const,
          title: `${d.entity.shortName}: account ownership ${ppShort(d.delta)} between ${d.prev.wave} and ${wave} (${pct(d.prev.value)} → ${pct(d.value)}).`,
          evidence: `${d.entity.shortName} · ${d.prev.wave} and ${wave}`,
          link: `/country/${d.entity.slug}`,
          priority: 4 + i,
          scope: { kind: 'economy' as const, code: d.entity.code, label: d.entity.shortName },
        })),
      ]
    },
  },
  {
    id: 'gaps',
    category: 'gaps',
    weight: 0.9,
    run: ({ repo, wave, groupsReady }) => {
      const breakdowns = groupsReady ? repo.breakdowns.map((b) => b.id) : ['sex']
      return breakdowns.flatMap((b) => {
        const m = buildGapModel(repo, { breakdown: b, wave })
        if (m.headline.gap === null) return []
        return gapInsights(m)
          .filter((i) => i.id === 'gap-headline' || i.id === 'gap-trend')
          .map((i) => ({
            ...i,
            id: `${i.id}-${b}`,
            link: `/gaps${b === 'sex' ? '' : `?breakdown=${b}`}`,
            scope: worldScope,
          }))
      })
    },
  },
  {
    id: 'mobile-money',
    category: 'digital',
    weight: 0.8,
    run: ({ repo, wave }) => {
      const out: Omit<EngineInsight, 'key' | 'category' | 'score'>[] = []
      // Adults whose only account is mobile money = account − financial-institution account.
      const mobileOnly = economiesWith(repo, 'accountOwnership', wave)
        .flatMap(({ entity, value }) => {
          const fi = repo.value('fiAccount', entity.code, wave)
          return fi === null ? [] : [{ entity, share: r2(value - fi) }]
        })
        .filter((d) => d.share >= 20)
        .sort((a, b) => b.share - a.share)
      if (mobileOnly.length)
        out.push({
          id: 'mobile-only',
          tone: 'neutral',
          title: `In ${mobileOnly.length} economies at least 1 in 5 adults is financially included only through mobile money — highest in ${mobileOnly
            .slice(0, 3)
            .map((d) => `${d.entity.shortName} (${pct(d.share)})`)
            .join(', ')}.`,
          detail:
            'Computed from published values as account ownership minus financial-institution account ownership.',
          evidence: `${wave} · economies with both values`,
          link: '/digital',
          priority: 2,
          scope: worldScope,
        })
      const dev = repo.value('digitalPayments', DEVELOPING.code, wave)
      const devPrev = repo.previous('digitalPayments', DEVELOPING.code, wave)
      if (dev !== null && devPrev)
        out.push({
          id: 'digital-payments-dev',
          tone: dev > devPrev.value ? 'positive' : 'negative',
          title: `${pct(dev)} of adults in developing economies made or received a digital payment in ${wave}, ${ppShort(dev - devPrev.value)} since ${devPrev.wave}.`,
          evidence: `Developing-economies aggregate · ${devPrev.wave} and ${wave}`,
          link: '/digital',
          priority: 1,
          scope: { kind: 'world', code: DEVELOPING.code, label: DEVELOPING.label },
        })
      return out
    },
  },
  {
    id: 'saving',
    category: 'savings-credit',
    weight: 0.7,
    run: ({ repo, wave }) => {
      const src = scopeSourceFor(repo, 'savedAny', WORLD)
      const any = repo.value('savedAny', src.code, wave)
      const formal = repo.value('formalSavings', src.code, wave)
      const out: Omit<EngineInsight, 'key' | 'category' | 'score'>[] = []
      if (any !== null && formal !== null && any - formal >= 5)
        out.push({
          id: 'informal-saving',
          tone: 'neutral',
          title: `${pct(any)} of adults in ${src.label.toLowerCase()} saved money in the past year, but only ${pct(formal)} saved formally — ${pp(any - formal)} save by other means such as savings clubs or at home.`,
          evidence: `${src.label} aggregate · ${wave}`,
          link: '/microfinance',
          priority: 2,
          scope: { kind: 'world', code: src.code, label: src.label },
        })
      const bsrc = scopeSourceFor(repo, 'borrowedAny', WORLD)
      const borrowed = repo.value('borrowedAny', bsrc.code, wave)
      const formalB = repo.value('formalBorrowing', bsrc.code, wave)
      const family = repo.value('borrowedFamily', bsrc.code, wave)
      if (borrowed !== null && formalB !== null && family !== null)
        out.push({
          id: 'borrowing-sources',
          tone: 'neutral',
          title: `In ${bsrc.label.toLowerCase()}, ${pct(borrowed)} of adults borrowed in the past year: ${pct(formalB)} formally and ${pct(family)} from family or friends (people can use both).`,
          evidence: `${bsrc.label} aggregate · ${wave}`,
          link: '/microfinance',
          priority: 3,
          scope: { kind: 'world', code: bsrc.code, label: bsrc.label },
        })
      return out
    },
  },
  {
    id: 'resilience',
    category: 'resilience',
    weight: 0.75,
    run: ({ repo, wave }) => {
      const src = scopeSourceFor(repo, 'emergencyFundsPossible', WORLD)
      const v = repo.value('emergencyFundsPossible', src.code, wave)
      if (v === null) return []
      const low = economiesWith(repo, 'emergencyFundsPossible', wave)
        .sort((a, b) => a.value - b.value)
        .slice(0, 3)
      return [
        {
          id: 'emergency',
          tone: v < 60 ? 'warning' : 'neutral',
          title: `${pct(100 - v)} of adults in ${src.label.toLowerCase()} could not raise emergency funds within 30 days${low.length ? ` — the share able to do so is lowest in ${low.map((l) => `${l.entity.shortName} (${pct(l.value)})`).join(', ')}` : ''}.`,
          evidence: `${src.label} aggregate · ${wave}`,
          link: '/microfinance',
          priority: 2,
          scope: { kind: 'world', code: src.code, label: src.label },
        },
      ]
    },
  },
]

/** Runs every generator and returns a de-duplicated feed, most important first. */
export function runInsightEngine(ctx: EngineContext): EngineInsight[] {
  const seen = new Set<string>()
  const out: EngineInsight[] = []
  for (const g of GENERATORS) {
    for (const i of g.run(ctx)) {
      const key = `${g.id}:${i.id}:${i.scope.code}`
      if (seen.has(key)) continue
      seen.add(key)
      // Rule priority 1 ≈ most important; blend with the generator's weight.
      const score = r2(
        g.weight * (1 / Math.max(1, i.priority)) + (i.scope.kind === 'world' ? 0.1 : 0),
      )
      out.push({ ...i, key, category: g.category, score })
    }
  }
  return out.sort((a, b) => b.score - a.score)
}

export const GENERATOR_IDS = GENERATORS.map((g) => g.id)

/** Findings about one economy from the feed (used by Country Focus). */
export function insightsFor(feed: EngineInsight[], e: Entity): EngineInsight[] {
  return feed.filter((i) => i.scope.code === e.code || i.title.includes(e.shortName))
}
