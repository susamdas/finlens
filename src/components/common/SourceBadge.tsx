import { Database } from 'lucide-react'
import { cn } from '@/lib/utils'

export const DEFAULT_SOURCE = 'World Bank Global Findex Database'

/** Attribution shown on every chart, table and KPI group. */
export function SourceBadge({
  source = DEFAULT_SOURCE,
  year,
  note,
  className,
}: {
  source?: string
  year?: number | string
  note?: string
  className?: string
}) {
  return (
    <p
      className={cn(
        'inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground',
        className,
      )}
    >
      <Database aria-hidden className="size-3 text-subtle-foreground" />
      <span>
        Source: {source}
        {year !== undefined && <>, {year}</>}
        {note && <> · {note}</>}
      </span>
    </p>
  )
}
