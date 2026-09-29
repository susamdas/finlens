import type { GapModel } from '@/features/gaps/gaps.logic'
import { describeCorrelation } from '@/lib/analytics/stats'
import type { Insight } from './types'
import { pct, pp } from './text'

/**
 * Findings for the gap analyzer. Descriptive only: sizes, directions and changes of published
 * gaps. Associations are labelled as such — never as causes.
 */
export function gapInsights(m: GapModel): Insight[] {
  const out: Insight[] = []
  const { a: aLabel, b: bLabel } = m.labels
  const metric = `“${m.metric.shortLabel.toLowerCase()}”`
  const h = m.headline
  const where = h.source.label

  if (h.gap !== null && h.a !== null && h.b !== null) {
    const reversed = h.gap <= -1
    out.push({
      id: 'gap-headline',
      tone: Math.abs(h.gap) < 1 ? 'neutral' : 'warning',
      title:
        Math.abs(h.gap) < 1
          ? `In ${where}, ${aLabel.toLowerCase()} and ${bLabel.toLowerCase()} are within 1 percentage point of each other (${pct(h.a)} vs ${pct(h.b)}).`
          : `In ${where}, the ${m.breakdown.gapLabel.toLowerCase()} in ${metric} is ${pp(h.gap)}${reversed ? ', reversed' : ''}: ${bLabel} ${pct(h.b)} vs ${aLabel} ${pct(h.a)}.`,
      detail: `Indicator: ${m.metric.shortLabel}, ${m.wave}.`,
      evidence: `${where} aggregate · ${m.wave}${h.fallback ? ' · World figure not published' : ''}`,
      priority: 1,
    })
  }

  if (h.gap !== null && h.previousGap && h.trend) {
    out.push({
      id: 'gap-trend',
      tone: h.trend === 'narrowed' ? 'positive' : h.trend === 'widened' ? 'negative' : 'neutral',
      title:
        h.trend === 'stable'
          ? `The ${m.breakdown.gapLabel.toLowerCase()} in ${where} is little changed since ${h.previousGap.wave} (${pp(h.previousGap.value)} → ${pp(h.gap)}).`
          : `The ${m.breakdown.gapLabel.toLowerCase()} in ${where} ${h.trend} from ${pp(h.previousGap.value)} in ${h.previousGap.wave} to ${pp(h.gap)} in ${m.wave}.`,
      evidence: `${where} aggregate · ${h.previousGap.wave} and ${m.wave}`,
      priority: 2,
    })
  }

  const measured = m.rows.filter((r) => r.gap !== null)
  const widest = [...measured].sort((x, y) => y.gap! - x.gap!)[0]
  if (widest && widest.gap! >= 1)
    out.push({
      id: 'gap-widest',
      tone: 'warning',
      title: `${widest.entity.shortName} has the widest ${m.breakdown.gapLabel.toLowerCase()} in ${m.scope.label}: ${pp(widest.gap!)} (${aLabel.toLowerCase()} ${pct(widest.a!)}, ${bLabel.toLowerCase()} ${pct(widest.b!)}).`,
      evidence: `${measured.length} economies with both groups published · ${m.wave}`,
      link: `/country/${widest.entity.slug}`,
      priority: 3,
    })

  if (m.stats.reversed > 0)
    out.push({
      id: 'gap-reversed',
      tone: 'neutral',
      title: `In ${m.stats.reversed} of ${m.stats.measured} economies, ${aLabel.toLowerCase()} are ahead of ${bLabel.toLowerCase()} by at least 1 percentage point.`,
      evidence: `${m.metric.shortLabel} · ${m.wave}`,
      priority: 5,
    })

  const compared = m.stats.narrowed + m.stats.widened + m.stats.stable
  if (compared >= 5)
    out.push({
      id: 'gap-direction',
      tone:
        m.stats.narrowed > m.stats.widened
          ? 'positive'
          : m.stats.widened > m.stats.narrowed
            ? 'negative'
            : 'neutral',
      title: `Since each economy's previous survey, the gap narrowed in ${m.stats.narrowed}, widened in ${m.stats.widened} and was stable (within 1 pp) in ${m.stats.stable} economies.`,
      evidence: `${compared} economies with the gap published in two waves`,
      priority: 4,
    })

  if (m.scatter.r !== null && Math.abs(m.scatter.r) >= 0.3)
    out.push({
      id: 'gap-association',
      tone: 'neutral',
      title: `${describeCorrelation(m.scatter.r)} between the overall level of ${metric} and the size of the gap (r = ${m.scatter.r.toFixed(2)}, ${m.scatter.points.length} economies).`,
      detail:
        'Correlation describes a pattern across economies; it does not show that one causes the other.',
      evidence: `${m.scope.label} · ${m.wave}`,
      priority: 6,
    })

  return out.sort((x, y) => x.priority - y.priority)
}
