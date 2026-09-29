import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import type { DemographicRow } from '@/features/countries/profile.logic'
import { formatPercent, formatPP } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * One row per population breakdown: the two group values on a shared 0–100 scale, the gap in
 * percentage points, and whether it narrowed or widened since the previous wave.
 */
export function GapRows({ rows }: { rows: DemographicRow[] }) {
  return (
    <ol className="divide-y">
      {rows.map((r) => {
        const ok = r.a.value !== null && r.b.value !== null
        const lo = ok ? Math.min(r.a.value!, r.b.value!) : 0
        const hi = ok ? Math.max(r.a.value!, r.b.value!) : 0
        const TrendIcon =
          r.trend === 'narrowed' ? TrendingDown : r.trend === 'widened' ? TrendingUp : Minus
        return (
          <li
            key={r.breakdown}
            className="grid gap-2 py-3 sm:grid-cols-[11rem_minmax(0,1fr)_12rem] sm:items-center sm:gap-4"
          >
            <div>
              <p className="text-[13px] font-semibold">{r.label}</p>
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden className="size-2 rounded-full bg-chart-2" />
                  {r.a.label}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden className="size-2 rounded-full bg-chart-1" />
                  {r.b.label}
                </span>
              </p>
            </div>
            {ok ? (
              <div
                className="relative h-8"
                aria-label={`${r.a.label} ${formatPercent(r.a.value)}, ${r.b.label} ${formatPercent(r.b.value)}`}
                role="img"
              >
                <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-chart-grid" />
                <div
                  className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-chart-axis"
                  style={{ left: `${lo}%`, width: `${hi - lo}%` }}
                />
                {[
                  { g: r.a, color: 'var(--chart-2)' },
                  { g: r.b, color: 'var(--chart-1)' },
                ].map(({ g, color }) => (
                  <span
                    key={g.id}
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${g.value}%` }}
                  >
                    <span
                      className="block size-3.5 rounded-full ring-2 ring-card"
                      style={{ background: color }}
                    />
                    {/* Labels grow outward from the pair so close values never overlap. */}
                    <span
                      className={cn(
                        'absolute top-3.5 text-[11px] whitespace-nowrap text-muted-foreground tabular',
                        g === (r.a.value! <= r.b.value! ? r.a : r.b)
                          ? 'right-1/2 mr-1'
                          : 'left-1/2 ml-1',
                      )}
                    >
                      {formatPercent(g.value)}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Data unavailable for the selected year.
              </p>
            )}
            <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
              <span className="text-sm font-semibold tabular">
                {r.gap === null ? '—' : formatPP(r.gap)}
              </span>
              {r.trend && r.previousGap && (
                <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
                  <TrendIcon className="size-3.5" aria-hidden />
                  {r.trend === 'stable'
                    ? 'Stable'
                    : r.trend === 'narrowed'
                      ? 'Narrowed'
                      : 'Widened'}{' '}
                  vs {r.previousGap.wave} ({formatPP(r.previousGap.value)})
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
