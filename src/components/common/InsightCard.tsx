import { useRef, type ReactNode } from 'react'
import { useRegisterExport } from '@/components/export/registry'
import { AlertTriangle, ArrowRight, Lightbulb, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export type InsightTone = 'positive' | 'negative' | 'neutral' | 'warning'

const TONE: Record<InsightTone, { icon: typeof Lightbulb; cls: string; label: string }> = {
  positive: { icon: TrendingUp, cls: 'bg-positive-soft text-positive', label: 'Improvement' },
  negative: { icon: TrendingDown, cls: 'bg-negative-soft text-negative', label: 'Decline' },
  warning: { icon: AlertTriangle, cls: 'bg-warning-soft text-warning', label: 'Gap' },
  neutral: { icon: Lightbulb, cls: 'bg-accent text-accent-foreground', label: 'Observation' },
}

/** A single data-derived finding. `evidence` must cite the dataset values behind it. */
export function InsightCard({
  tone = 'neutral',
  title,
  children,
  evidence,
  onOpen,
  icon,
  className,
}: {
  tone?: InsightTone
  title: string
  children?: ReactNode
  evidence?: ReactNode
  onOpen?: () => void
  icon?: ReactNode
  className?: string
}) {
  const t = TONE[tone]
  const Icon = t.icon
  const ref = useRef<HTMLElement>(null)
  useRegisterExport(
    {
      kind: 'insight',
      title,
      detail: typeof children === 'string' ? children : undefined,
      evidence: typeof evidence === 'string' ? evidence : undefined,
    },
    ref,
  )
  return (
    <article
      ref={ref}
      className={cn('group flex gap-3 rounded-2xl border bg-card p-4 shadow-card', className)}
    >
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', t.cls)} aria-hidden>
        {icon ?? <Icon className="size-[18px]" />}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {t.label}
        </p>
        <h4 className="text-sm leading-snug font-semibold">{title}</h4>
        {children && (
          <p className="text-[13px] leading-relaxed text-muted-foreground">{children}</p>
        )}
        {(evidence || onOpen) && (
          <div className="flex items-center justify-between gap-2 pt-1">
            {evidence && <span className="text-[11.5px] text-muted-foreground">{evidence}</span>}
            {onOpen && (
              <button
                type="button"
                onClick={onOpen}
                className="hit-area inline-flex items-center gap-1 rounded text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                Explore <ArrowRight className="size-3.5" aria-hidden />
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
