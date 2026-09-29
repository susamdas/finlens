import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DeltaIndicator } from '@/components/common/DeltaIndicator'
import { LoadingSkeleton } from '@/components/common/states'
import { Sparkline, type SparkPoint } from '@/components/charts/Sparkline'
import { useCountUp } from '@/hooks/useCountUp'
import { formatCompact, formatDecimal, formatPercent, MISSING_TEXT } from '@/lib/format'
import { cn } from '@/lib/utils'

export type KPIUnit = '%' | 'pp' | 'count'

export function KPICard({
  label,
  value,
  unit = '%',
  delta = null,
  comparisonLabel,
  higherIsBetter = true,
  series,
  description,
  icon,
  loading = false,
  onClick,
  note,
  missingNote,
  className,
}: {
  /** Small caption under the change row, e.g. which aggregate the value comes from. */
  note?: ReactNode
  /** Why a value is missing, shown under "Data unavailable". */
  missingNote?: string
  label: string
  value: number | null
  unit?: KPIUnit
  /** Change in percentage points vs the previous survey wave. */
  delta?: number | null
  /** e.g. "vs 2017" */
  comparisonLabel?: string
  higherIsBetter?: boolean | null
  series?: SparkPoint[]
  /** Hover explanation of the indicator. */
  description?: string
  icon?: ReactNode
  loading?: boolean
  onClick?: () => void
  className?: string
}) {
  const animated = useCountUp(loading ? null : value)
  const fmt = (v: number) =>
    unit === '%' ? formatPercent(v) : unit === 'pp' ? `${formatDecimal(v, 1)} pp` : formatCompact(v)
  const display = animated === null ? null : fmt(animated)
  const Wrapper = onClick ? 'button' : 'div'

  return (
    <Card
      className={cn(
        'group relative overflow-hidden p-0 transition-shadow',
        onClick && 'hover:shadow-raised focus-within:shadow-raised',
        className,
      )}
    >
      <Wrapper
        {...(onClick ? { onClick, type: 'button' as const } : {})}
        className="flex h-full flex-col gap-3 p-5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 rounded-2xl"
      >
        {loading ? (
          <LoadingSkeleton variant="kpi" />
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-muted-foreground">
                {icon && <span className="text-subtle-foreground [&_svg]:size-4">{icon}</span>}
                <span className="truncate" title={label}>
                  {label}
                </span>
              </span>
              {description && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      role="button"
                      aria-label={`About ${label}`}
                      className="hit-area -m-1 rounded p-1 text-subtle-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info className="size-3.5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">{description}</TooltipContent>
                </Tooltip>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <p
                className={cn(
                  'min-w-0 text-[28px] font-semibold leading-none tracking-tight tabular',
                  value === null && 'text-base font-medium text-muted-foreground',
                )}
                aria-label={
                  value === null ? `${label}: ${MISSING_TEXT}` : `${label}: ${fmt(value)}`
                }
              >
                {value === null ? MISSING_TEXT : display}
              </p>
              {series && value !== null && (
                <Sparkline data={series} width={96} height={32} className="shrink-0" />
              )}
            </div>
            {value !== null && (delta !== null || comparisonLabel) && (
              <div className="flex flex-wrap items-center gap-1.5">
                <DeltaIndicator
                  delta={delta}
                  higherIsBetter={higherIsBetter}
                  {...(comparisonLabel ? { comparisonLabel } : {})}
                />
                {comparisonLabel && (
                  <span className="text-xs text-muted-foreground">{comparisonLabel}</span>
                )}
              </div>
            )}
            {value === null && missingNote && (
              <p className="text-xs leading-snug text-muted-foreground">{missingNote}</p>
            )}
            {note && (
              <div className="mt-auto text-[11.5px] leading-snug text-muted-foreground">{note}</div>
            )}
          </>
        )}
      </Wrapper>
    </Card>
  )
}
