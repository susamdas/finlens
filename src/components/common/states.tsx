import type { ReactNode } from 'react'
import { AlertTriangle, CircleSlash, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MISSING_FOR_YEAR } from '@/lib/format'
import { cn } from '@/lib/utils'

export function EmptyState({
  title = MISSING_FOR_YEAR,
  description,
  icon,
  action,
  className,
}: {
  title?: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-xl bg-missing-hatch px-6 py-10 text-center',
        className,
      )}
    >
      <span className="grid size-10 place-items-center rounded-full bg-card text-muted-foreground shadow-card">
        {icon ?? <CircleSlash className="size-5" aria-hidden />}
      </span>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-[13px] text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong loading this view.',
  description,
  onRetry,
  className,
}: {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-xl border border-negative/20 bg-negative-soft px-6 py-10 text-center',
        className,
      )}
    >
      <AlertTriangle className="size-6 text-negative" aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-[13px] text-muted-foreground">{description}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          <RotateCw /> Try again
        </Button>
      )}
    </div>
  )
}

type SkeletonVariant = 'kpi' | 'chart' | 'table' | 'text'

/** Layout-matching placeholders so content doesn't jump when data arrives. */
export function LoadingSkeleton({
  variant = 'chart',
  rows = 5,
  className,
}: {
  variant?: SkeletonVariant
  rows?: number
  className?: string
}) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading" className={cn('w-full', className)}>
      {variant === 'kpi' && (
        <div className="space-y-3">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-36" />
        </div>
      )}
      {variant === 'chart' && (
        <div className="flex h-56 items-end gap-2">
          {[45, 70, 55, 85, 60, 75, 40, 65].map((h, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-t-md rounded-b-none"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      )}
      {variant === 'table' && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} className="h-6 w-full opacity-70" />
          ))}
        </div>
      )}
      {variant === 'text' && (
        <div className="space-y-2">
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} className={cn('h-3.5', i === rows - 1 ? 'w-2/3' : 'w-full')} />
          ))}
        </div>
      )}
      <span className="sr-only">Loading…</span>
    </div>
  )
}
