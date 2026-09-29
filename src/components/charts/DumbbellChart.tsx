import { Link } from 'react-router'
import { formatPercent, formatPP } from '@/lib/format'

export interface DumbbellRow {
  key: string
  label: string
  a: number | null
  b: number | null
  href?: string
}

/**
 * Two values per row on a shared 0–100 scale (e.g. women vs men). The connecting bar is the
 * gap; the gap is also printed, so meaning never depends on colour alone.
 */
export function DumbbellChart({
  rows,
  aLabel,
  bLabel,
  aColor = 'var(--chart-2)',
  bColor = 'var(--chart-1)',
  domain = [0, 100],
}: {
  rows: DumbbellRow[]
  aLabel: string
  bLabel: string
  aColor?: string
  bColor?: string
  domain?: [number, number]
}) {
  const [d0, d1] = domain
  const x = (v: number) => `${((v - d0) / (d1 - d0)) * 100}%`
  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground" aria-label="Legend">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full" style={{ background: aColor }} />{' '}
          {aLabel}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full" style={{ background: bColor }} />{' '}
          {bLabel}
        </li>
        <li className="ml-auto">
          Gap = {bLabel} − {aLabel}
        </li>
      </ul>
      <ol className="space-y-1">
        {rows.map((r) => {
          const ok = r.a !== null && r.b !== null
          const gap = ok ? r.b! - r.a! : null
          const lo = ok ? Math.min(r.a!, r.b!) : 0
          const hi = ok ? Math.max(r.a!, r.b!) : 0
          const content = (
            <div className="grid grid-cols-[minmax(0,9rem)_1fr_4.5rem] items-center gap-3 sm:grid-cols-[minmax(0,12rem)_1fr_4.5rem]">
              <span className="truncate text-[13px] font-medium">{r.label}</span>
              <div className="relative h-6" aria-hidden>
                <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-chart-grid" />
                {ok && (
                  <>
                    <div
                      className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-chart-axis"
                      style={{ left: x(lo), width: `calc(${x(hi)} - ${x(lo)})` }}
                    />
                    <span
                      className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
                      style={{ left: x(r.a!), background: aColor }}
                    />
                    <span
                      className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
                      style={{ left: x(r.b!), background: bColor }}
                    />
                  </>
                )}
              </div>
              <span className="text-right text-[13px] font-semibold tabular">
                {gap === null ? '—' : formatPP(gap)}
              </span>
            </div>
          )
          const label = ok
            ? `${r.label}: ${aLabel} ${formatPercent(r.a)}, ${bLabel} ${formatPercent(r.b)}, gap ${formatPP(gap)}`
            : `${r.label}: data unavailable`
          return (
            <li key={r.key} title={label}>
              {r.href ? (
                <Link
                  to={r.href}
                  aria-label={label}
                  className="block rounded-lg px-2 py-1 outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/40"
                >
                  {content}
                </Link>
              ) : (
                <div className="px-2 py-1" aria-label={label}>
                  {content}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
