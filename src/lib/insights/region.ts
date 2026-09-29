import type { FindexRepository } from '@/data/repository'
import type { Region, Wave } from '@/data/types'
import { changes, topMovers } from '@/lib/analytics/movers'
import type { SpreadRow } from '@/features/regions/region.logic'
import type { Insight } from './types'
import { changeVerb, pct, pp, ppShort } from './text'

const r2 = (n: number) => Math.round(n * 100) / 100

/** Findings for a region, from published aggregates and member-economy values only. */
export function regionInsights(
  repo: FindexRepository,
  region: Region,
  wave: Wave,
  spread: SpreadRow[],
): Insight[] {
  const out: Insight[] = []
  const agg = region.aggregateCode
  const v = repo.value('accountOwnership', agg, wave)
  const prev = repo.previous('accountOwnership', agg, wave)
  if (v !== null && prev) {
    const d = r2(v - prev.value)
    out.push({
      id: 'region-change',
      tone: Math.abs(d) < 0.5 ? 'neutral' : d > 0 ? 'positive' : 'negative',
      title: `Account ownership in ${region.name} ${changeVerb(d)} between ${prev.wave} and ${wave}, ${Math.abs(d) < 0.5 ? 'at' : 'to'} ${pct(v)}.`,
      evidence: `${region.name} aggregate · ${prev.wave} ${pct(prev.value)} → ${wave} ${pct(v)}`,
      priority: 1,
    })
  }
  const w = repo.value('accountOwnership', 'WLD', wave)
  if (v !== null && w !== null && Math.abs(v - w) >= 1)
    out.push({
      id: 'region-vs-world',
      tone: v > w ? 'positive' : 'warning',
      title: `${region.name} is ${pp(v - w)} ${v > w ? 'above' : 'below'} the world average for account ownership (${pct(v)} vs ${pct(w)}).`,
      evidence: `Findex aggregates · ${wave}`,
      priority: 2,
    })
  const movers = changes(
    repo,
    'accountOwnership',
    wave,
    repo.economies().filter((e) => e.regionId === region.id),
  )
  const up = topMovers(movers, 1, 'up')[0]
  if (up && up.delta >= 1)
    out.push({
      id: 'region-improver',
      tone: 'positive',
      title: `${up.entity.shortName} improved most in the region: ${ppShort(up.delta)} in account ownership (${up.previous.wave}–${wave}).`,
      evidence: `${up.entity.shortName} · ${pct(up.previous.value)} → ${pct(up.value)}`,
      link: `/country/${up.entity.slug}`,
      priority: 3,
    })
  const widest = [...spread]
    .filter((s) => s.range !== null && s.points.length >= 3)
    .sort((a, b) => b.range! - a.range!)[0]
  if (widest && widest.min && widest.max)
    out.push({
      id: 'region-spread',
      tone: 'neutral',
      title: `The widest variation within the region is in ${widest.indicator.shortLabel.toLowerCase()}: from ${pct(widest.min.value)} in ${widest.min.entity.shortName} to ${pct(widest.max.value)} in ${widest.max.entity.shortName}.`,
      evidence: `${widest.points.length} economies · ${wave}`,
      priority: 4,
    })
  const women = repo.value('accountOwnership', agg, wave, 'women')
  const men = repo.value('accountOwnership', agg, wave, 'men')
  if (women !== null && men !== null && Math.abs(men - women) >= 1)
    out.push({
      id: 'region-gender',
      tone: men > women ? 'warning' : 'neutral',
      title: `Across ${region.name}, women’s account ownership is ${pp(men - women)} ${men > women ? 'below' : 'above'} men’s (${pct(women)} vs ${pct(men)}).`,
      evidence: `${region.name} aggregate · ${wave}`,
      link: `/gaps?region=${region.slug}`,
      priority: 5,
    })
  return out.sort((a, b) => a.priority - b.priority)
}
