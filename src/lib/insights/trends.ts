import type { TrendModel } from '@/features/trends/trends.logic'
import { describeCorrelation } from '@/lib/analytics/stats'
import type { Insight } from './types'
import { changeVerb, pct, pp, ppShort } from './text'

const nf1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Findings for the trend view: observed waves only, no projection. */
export function trendInsights(m: TrendModel): Insight[] {
  const out: Insight[] = []
  const where = m.source.label
  const metric = m.metric.shortLabel.toLowerCase()
  const h = m.headline
  const val = (v: number) => (m.metric.unit === 'pp' ? ppShort(v) : pct(v))
  const good = m.metric.higherIsBetter

  if (h.from !== null && h.to !== null && h.delta !== null) {
    out.push({
      id: 'trend-headline',
      tone:
        Math.abs(h.delta) < 0.5 || good === null
          ? 'neutral'
          : h.delta > 0 === good
            ? 'positive'
            : 'negative',
      title: `In ${where}, ${metric} ${changeVerb(h.delta)} between ${m.from} and ${m.to}, from ${val(h.from)} to ${val(h.to)}.`,
      detail:
        h.perYear !== null
          ? `About ${nf1.format(Math.abs(h.perYear))} points per year on average across the period.`
          : undefined,
      evidence: `${where} aggregate · ${m.from} and ${m.to}${m.fallback ? ' · World figure not published' : ''}`,
      priority: 1,
    })
  }

  // Fastest period for the aggregate.
  const row = m.periods.rows.find((r) => r.selected)
  if (row) {
    const withVal = row.cells
      .map((v, i) => ({ v, pair: m.periods.pairs[i]! }))
      .filter((c): c is { v: number; pair: [number, number] } => c.v !== null)
    if (withVal.length >= 2) {
      const best = [...withVal].sort((a, b) => b.v - a.v)[0]!
      const worst = [...withVal].sort((a, b) => a.v - b.v)[0]!
      out.push({
        id: 'trend-fastest-period',
        tone: 'neutral',
        title:
          best.v > 0
            ? `The largest gain for ${where} came between ${best.pair[0]} and ${best.pair[1]} (${ppShort(best.v)})${worst.v <= -0.5 ? `; the largest fall was ${worst.pair[0]}–${worst.pair[1]} (${ppShort(worst.v)})` : ''}.`
            : `${where} did not gain in any period; the smallest fall was ${best.pair[0]}–${best.pair[1]} (${ppShort(best.v)}).`,
        evidence: `${where} aggregate · consecutive survey waves`,
        priority: 2,
      })
    }
  }

  const c = m.counts
  if (c.compared >= 5)
    out.push({
      id: 'trend-breadth',
      tone:
        good === null || c.up === c.down
          ? 'neutral'
          : c.up > c.down === good
            ? 'positive'
            : 'negative',
      title: `Of ${c.compared} economies measured in both ${m.from} and ${m.to}, ${c.up} rose, ${c.down} fell and ${c.flat} changed by less than 1 point.`,
      evidence: `${m.scope.label} · ${c.inScope - c.compared} economies not measured in both waves are left out`,
      priority: 3,
    })

  const top = m.improvers[0]
  if (top)
    out.push({
      id: 'trend-top',
      tone: good === null ? 'neutral' : good ? 'positive' : 'negative',
      title: `${top.entity.shortName} rose the most: ${pp(top.delta)} (${val(top.from)} → ${val(top.to)}).`,
      evidence: `${top.entity.shortName} · surveys ${m.from} and ${m.to}`,
      link: `/country/${top.entity.slug}`,
      priority: 4,
    })

  if (m.convergence.r !== null && Math.abs(m.convergence.r) >= 0.3)
    out.push({
      id: 'trend-convergence',
      tone: 'neutral',
      title:
        m.convergence.r < 0
          ? `Economies that started lower tended to gain more — a sign of catching up (${describeCorrelation(m.convergence.r).toLowerCase()}, r = ${m.convergence.r.toFixed(2)}).`
          : `Economies that started higher tended to gain more — gaps between economies widened (${describeCorrelation(m.convergence.r).toLowerCase()}, r = ${m.convergence.r.toFixed(2)}).`,
      detail:
        'Part of this pattern is mechanical: economies near 100% have little room to rise. It describes a pattern, not a cause.',
      evidence: `${m.convergence.points.length} economies · ${m.from} level vs ${m.from}–${m.to} change`,
      priority: 5,
    })

  return out.sort((a, b) => a.priority - b.priority)
}
