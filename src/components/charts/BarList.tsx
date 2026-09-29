import { Link } from 'react-router'
import { cn } from '@/lib/utils'

export interface BarListItem {
  key: string
  label: string
  sublabel?: string
  value: number
  /** Display string for the value (formatted by caller). */
  display: string
  href?: string
  highlight?: boolean
  leading?: React.ReactNode
}

/**
 * Horizontal, directly-labelled bars (HTML, not canvas) — readable on mobile, keyboard
 * navigable and screen-reader friendly. Optional reference line (e.g. world average).
 */
export function BarList({
  items,
  max,
  reference,
  emphasis = false,
  ariaLabel,
  showBars = true,
}: {
  items: BarListItem[]
  max?: number
  reference?: { label: string; value: number }
  /** When true, only highlighted items use the accent colour; others are muted. */
  emphasis?: boolean
  ariaLabel: string
  /** Hide bars for signed values (e.g. percentage-point gaps) where a 0-based bar would mislead. */
  showBars?: boolean
}) {
  const scaleMax = max ?? Math.max(1, ...items.map((i) => i.value), reference?.value ?? 0)
  return (
    <div className="relative">
      <ol className="space-y-1.5" aria-label={ariaLabel}>
        {items.map((it) => {
          const width = `${Math.max(0, Math.min(100, (it.value / scaleMax) * 100))}%`
          const color = emphasis && !it.highlight ? 'var(--chart-axis)' : 'var(--chart-1)'
          const body = (
            <>
              <div className="flex min-w-0 items-baseline justify-between gap-2 text-[13px]">
                <span className="flex min-w-0 items-center gap-2">
                  {it.leading}
                  <span className={cn('truncate', it.highlight ? 'font-semibold' : 'font-medium')}>
                    {it.label}
                  </span>
                  {it.sublabel && (
                    <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                      {it.sublabel}
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-semibold tabular">{it.display}</span>
              </div>
              <div className={cn('relative mt-1 h-2 rounded-full bg-muted', !showBars && 'hidden')}>
                <div
                  className="h-2 rounded-full transition-[width] duration-500"
                  style={{ width, background: color }}
                />
                {reference && (
                  <span
                    aria-hidden
                    className="absolute -top-0.5 h-3 w-0.5 rounded-full bg-foreground/60"
                    style={{ left: `${(reference.value / scaleMax) * 100}%` }}
                  />
                )}
              </div>
            </>
          )
          return (
            <li key={it.key}>
              {it.href ? (
                <Link
                  to={it.href}
                  className="block rounded-lg px-2 py-1.5 outline-none hover:bg-muted/60 focus-visible:ring-[3px] focus-visible:ring-ring/40"
                  aria-label={`${it.label}: ${it.display}`}
                >
                  {body}
                </Link>
              ) : (
                <div className="px-2 py-1.5">{body}</div>
              )}
            </li>
          )
        })}
      </ol>
      {reference && (
        <p className="mt-2 flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
          <span aria-hidden className="inline-block h-3 w-0.5 rounded-full bg-foreground/60" />
          {reference.label}
        </p>
      )}
    </div>
  )
}
