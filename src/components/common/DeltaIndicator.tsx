import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { direction, movementTone, type Tone } from '@/lib/analytics/direction'
import { formatPP, MISSING_GLYPH } from '@/lib/format'
import { cn } from '@/lib/utils'

const TONE_CLASS: Record<Tone, string> = {
  positive: 'bg-positive-soft text-positive',
  negative: 'bg-negative-soft text-negative',
  neutral: 'bg-neutral-soft text-neutral',
  missing: 'bg-neutral-soft text-muted-foreground',
}

/**
 * Change vs a comparison point, in percentage points.
 * Meaning is carried by icon + signed text + color — never color alone.
 */
export function DeltaIndicator({
  delta,
  higherIsBetter = true,
  comparisonLabel,
  className,
}: {
  delta: number | null
  higherIsBetter?: boolean | null
  /** e.g. "vs 2017" — included in the accessible label. */
  comparisonLabel?: string
  className?: string
}) {
  const tone = movementTone(delta, higherIsBetter)
  const dir = delta === null ? 'flat' : direction(delta)
  const Icon = dir === 'up' ? ArrowUpRight : dir === 'down' ? ArrowDownRight : Minus
  const text = delta === null ? MISSING_GLYPH : formatPP(delta)
  const verb =
    delta === null
      ? 'No comparison available'
      : dir === 'flat'
        ? 'Roughly unchanged'
        : dir === 'up'
          ? 'Up'
          : 'Down'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular',
        TONE_CLASS[tone],
        className,
      )}
      aria-label={`${verb}${delta !== null ? ` ${text}` : ''}${comparisonLabel ? ` ${comparisonLabel}` : ''}`}
    >
      {delta !== null && <Icon aria-hidden className="size-3.5" strokeWidth={2.5} />}
      {text}
    </span>
  )
}
