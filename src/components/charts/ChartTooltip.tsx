import type { ReactNode } from 'react'
import { formatPercent } from '@/lib/format'

interface Payload {
  name?: string | number
  value?: number | string | null
  color?: string
  dataKey?: string | number
}

/**
 * Recharts tooltip content. Values stay in text ink; the swatch alone carries identity.
 * Pass as `<Tooltip content={<ChartTooltip />} />`.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter = (v) => formatPercent(v),
  labelFormatter,
}: {
  active?: boolean
  payload?: Payload[]
  label?: string | number
  valueFormatter?: (v: number | null) => string
  labelFormatter?: (label: string | number | undefined) => ReactNode
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass min-w-40 rounded-xl border px-3 py-2.5 text-xs shadow-overlay">
      <p className="mb-1.5 font-semibold text-foreground">
        {labelFormatter ? labelFormatter(label) : label}
      </p>
      <ul className="space-y-1">
        {payload.map((p) => (
          <li key={String(p.dataKey ?? p.name)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span aria-hidden className="size-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-semibold text-foreground tabular">
              {valueFormatter(typeof p.value === 'number' ? p.value : null)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
