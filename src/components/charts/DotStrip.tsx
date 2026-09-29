import { useState } from 'react'
import { useNavigate } from 'react-router'
import { formatPercent } from '@/lib/format'

export interface DotStripRow {
  key: string
  label: string
  points: { id: string; label: string; value: number; href?: string }[]
  aggregate: number | null
  aggregateLabel: string
  median: number | null
}

/**
 * Distribution of economy values per indicator on a shared 0–100% scale: one dot per economy,
 * the published aggregate as an outlined diamond and the median as a tick. Hover a dot for the
 * economy; click to open its profile. Exact values are available in the card's table view.
 */
export function DotStrip({ rows, highlight }: { rows: DotStripRow[]; highlight?: string | null }) {
  const navigate = useNavigate()
  const [hover, setHover] = useState<{
    row: string
    id: string
    label: string
    value: number
  } | null>(null)
  const legendAgg = rows[0]?.aggregateLabel ?? 'Aggregate'
  return (
    <div>
      <ul
        className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground"
        aria-label="Legend"
      >
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-chart-1/70" /> Economy
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rotate-45 border-2 border-foreground/70 bg-card" />{' '}
          {legendAgg}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-0.5 bg-foreground/50" /> Median economy
        </li>
      </ul>
      <ol className="space-y-4">
        {rows.map((r) => {
          const min = r.points[0]
          const max = r.points[r.points.length - 1]
          return (
            <li key={r.key}>
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 text-[13px]">
                <span className="font-medium">{r.label}</span>
                <span className="text-xs text-muted-foreground tabular">
                  {min && max
                    ? `${formatPercent(min.value)} (${min.label}) – ${formatPercent(max.value)} (${max.label})`
                    : 'No data'}
                </span>
              </div>
              <div className="relative h-6" onPointerLeave={() => setHover(null)}>
                <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted" />
                {min && max && (
                  <div
                    className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-chart-1/15"
                    style={{
                      left: `${min.value}%`,
                      width: `${Math.max(0.5, max.value - min.value)}%`,
                    }}
                  />
                )}
                {r.median !== null && (
                  <span
                    aria-hidden
                    className="absolute top-0.5 h-5 w-0.5 -translate-x-1/2 bg-foreground/50"
                    style={{ left: `${r.median}%` }}
                  />
                )}
                {r.points.map((p) => {
                  const isHi = highlight === p.id || (hover?.row === r.key && hover.id === p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      tabIndex={-1}
                      aria-hidden
                      onPointerEnter={() =>
                        setHover({ row: r.key, id: p.id, label: p.label, value: p.value })
                      }
                      onClick={() => p.href && navigate(p.href)}
                      className="absolute top-1/2 grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center"
                      style={{ left: `${p.value}%` }}
                    >
                      <span
                        className={
                          isHi
                            ? 'size-3 rounded-full bg-chart-1 ring-2 ring-foreground'
                            : 'size-2.5 rounded-full bg-chart-1/70 ring-1 ring-card'
                        }
                      />
                    </button>
                  )
                })}
                {r.aggregate !== null && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-foreground/80 bg-card"
                    style={{ left: `${r.aggregate}%` }}
                  />
                )}
                {hover?.row === r.key && (
                  <div
                    role="status"
                    className="glass pointer-events-none absolute -top-9 z-10 -translate-x-1/2 rounded-lg border px-2 py-1 text-xs whitespace-nowrap shadow-overlay"
                    style={{ left: `${Math.min(90, Math.max(10, hover.value))}%` }}
                  >
                    <span className="font-semibold">{hover.label}</span>{' '}
                    <span className="tabular">{formatPercent(hover.value)}</span>
                  </div>
                )}
              </div>
              <p className="sr-only">
                {r.label}: {r.points.length} economies, from {min ? formatPercent(min.value) : '—'}{' '}
                to {max ? formatPercent(max.value) : '—'}; median {formatPercent(r.median)};{' '}
                {r.aggregateLabel} {formatPercent(r.aggregate)}.
              </p>
            </li>
          )
        })}
      </ol>
      <div
        className="mt-2 flex justify-between text-[11px] text-muted-foreground tabular"
        aria-hidden
      >
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  )
}
