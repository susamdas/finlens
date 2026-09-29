import type { IndicatorDefinition } from '@/data/types'
import { formatPercent } from '@/lib/format'
import type { BenchmarkKind } from '@/features/countries/profile.logic'

const SHAPE: Record<BenchmarkKind, string> = {
  region: 'rotate-45 rounded-[2px]', // diamond
  income: 'rounded-none', // square
  world: 'rounded-full', // circle
}

function Marker({ kind, className = '' }: { kind: BenchmarkKind; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-2.5 border-2 border-foreground/70 bg-card ${SHAPE[kind]} ${className}`}
    />
  )
}

export interface StripRow {
  indicator: IndicatorDefinition
  value: number | null
  marks: { kind: BenchmarkKind; name: string; value: number | null }[]
}

/**
 * Country value (filled bar) against region, income-group and world benchmarks (outlined markers,
 * distinguished by shape as well as label). Scale is 0–100%.
 */
export function BenchmarkStrip({ rows, countryName }: { rows: StripRow[]; countryName: string }) {
  const legend = rows[0]?.marks ?? []
  return (
    <div>
      <ul
        className="mb-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground"
        aria-label="Legend"
      >
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-5 rounded-full bg-chart-1" /> {countryName}
        </li>
        {legend.map((m) => (
          <li key={m.kind} className="flex items-center gap-1.5">
            <Marker kind={m.kind} /> {m.name}
          </li>
        ))}
      </ul>
      <ol className="space-y-3">
        {rows.map((r) => {
          const desc = [
            `${countryName} ${formatPercent(r.value)}`,
            ...r.marks.map((m) => `${m.name} ${formatPercent(m.value)}`),
          ].join(', ')
          return (
            <li key={r.indicator.id} aria-label={`${r.indicator.shortLabel}: ${desc}`} title={desc}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
                <span className="font-medium">{r.indicator.shortLabel}</span>
                <span className="font-semibold tabular">{formatPercent(r.value)}</span>
              </div>
              <div className="relative h-3 rounded-full bg-muted">
                {r.value !== null && (
                  <div
                    className="h-3 rounded-full bg-chart-1"
                    style={{ width: `${Math.min(100, r.value)}%` }}
                  />
                )}
                {r.marks.map((m) =>
                  m.value === null ? null : (
                    <span
                      key={m.kind}
                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${Math.min(100, m.value)}%` }}
                    >
                      <Marker kind={m.kind} />
                    </span>
                  ),
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
