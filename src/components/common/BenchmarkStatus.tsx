import { ArrowDown, ArrowUp, CircleDashed, Equal } from 'lucide-react'
import type { BenchmarkStatus as Status } from '@/lib/analytics/direction'
import { cn } from '@/lib/utils'

type Tone = 'positive' | 'negative' | 'warning' | 'neutral' | 'missing'

const TONE: Record<Tone, string> = {
  positive: 'bg-positive-soft text-positive',
  negative: 'bg-negative-soft text-negative',
  warning: 'bg-warning-soft text-warning',
  neutral: 'bg-neutral-soft text-neutral',
  missing: 'bg-neutral-soft text-muted-foreground',
}

function describe(
  status: Status,
  higherIsBetter: boolean | null,
): { label: string; icon: typeof ArrowUp; tone: Tone } {
  switch (status) {
    case 'above':
      return higherIsBetter === false
        ? { label: 'Lower than benchmark', icon: ArrowDown, tone: 'positive' }
        : { label: 'Above benchmark', icon: ArrowUp, tone: 'positive' }
    case 'below':
      return higherIsBetter === false
        ? { label: 'Higher than benchmark', icon: ArrowUp, tone: 'negative' }
        : { label: 'Below benchmark', icon: ArrowDown, tone: 'negative' }
    case 'near':
      return { label: 'Near benchmark', icon: Equal, tone: 'warning' }
    case 'higher':
      return { label: 'Higher than benchmark', icon: ArrowUp, tone: 'neutral' }
    case 'lower':
      return { label: 'Lower than benchmark', icon: ArrowDown, tone: 'neutral' }
    default:
      return { label: 'No data', icon: CircleDashed, tone: 'missing' }
  }
}

/**
 * Scorecard pill: descriptive position relative to a benchmark — not a judgement.
 * Icon + label always carry the meaning; colour only reinforces it.
 */
export function BenchmarkStatus({
  status,
  higherIsBetter = true,
  benchmarkName,
  compact = false,
  className,
}: {
  status: Status
  higherIsBetter?: boolean | null
  benchmarkName?: string
  /** Short labels ("Above", "Near", "Lower") for dense tables with a "vs benchmark" header. */
  compact?: boolean
  className?: string
}) {
  const d = describe(status, higherIsBetter)
  const { icon: Icon, tone } = d
  const label = compact ? d.label.replace(/ (than )?benchmark$/, '') : d.label
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE[tone],
        className,
      )}
    >
      <Icon aria-hidden className="size-3" strokeWidth={2.5} />
      {label}
      {benchmarkName && status !== 'missing' && <span className="sr-only"> ({benchmarkName})</span>}
    </span>
  )
}
