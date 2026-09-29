import type { ChoroplethScale } from '@/lib/analytics/choropleth'
import { formatDecimal } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Stepped legend matching the map's classes, plus the "no data" hatch. */
export function MapLegend({
  scale,
  unit,
  title,
  className,
}: {
  scale: ChoroplethScale
  unit: '%' | 'pp' | 'adults'
  title: string
  className?: string
}) {
  const fmt = (v: number) => (unit === 'pp' ? formatDecimal(v, 0) : `${formatDecimal(v, 0)}`)
  const edges = [scale.domain[0], ...scale.thresholds]
  return (
    <div
      className={cn(
        'rounded-xl border bg-card/90 px-3 py-2.5 shadow-card backdrop-blur',
        className,
      )}
      aria-label={`Legend: ${title}`}
    >
      <p className="mb-1.5 text-[11.5px] font-medium">
        {title} <span className="text-muted-foreground">({unit === 'pp' ? 'pp' : '%'})</span>
      </p>
      <div className="flex items-end gap-3">
        <div>
          <div className="flex">
            {scale.colors.map((c, i) => (
              <span
                key={i}
                className="h-2.5 w-7 first:rounded-l-sm last:rounded-r-sm sm:w-9"
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="relative mt-1 h-3.5 text-[11px] text-muted-foreground tabular">
            {edges.map((e, i) => (
              <span
                key={i}
                className="absolute -translate-x-1/2"
                style={{ left: `${(i / scale.colors.length) * 100}%` }}
              >
                {fmt(e)}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 pb-3.5 text-[11px] text-muted-foreground">
          <span
            className="h-2.5 w-5 rounded-sm bg-missing-hatch shadow-[0_0_0_1px_var(--border)]"
            aria-hidden
          />
          No data
        </div>
      </div>
      {scale.kind === 'diverging' && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">0 = no gap · warmer = larger gap</p>
      )}
    </div>
  )
}
