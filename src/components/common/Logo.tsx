import { cn } from '@/lib/utils'

/**
 * FinLens mark: a lens whose glass holds a globe meridian and a rising data line,
 * with the handle angled like a magnifier — "looking closely at global finance".
 */
export function LogoMark({ className, title = 'FinLens' }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label={title}
      className={cn('size-7', className)}
    >
      <circle
        cx="14"
        cy="14"
        r="10.5"
        className="fill-primary/10 stroke-primary"
        strokeWidth="2.5"
      />
      <ellipse
        cx="14"
        cy="14"
        rx="4.2"
        ry="10.5"
        className="stroke-primary/35"
        strokeWidth="1.25"
      />
      <path d="M3.5 14h21" className="stroke-primary/35" strokeWidth="1.25" />
      <path
        d="M8 17.5l3.4-3.4 2.8 2.2L20 10.6"
        className="stroke-primary"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M22 22l6.5 6.5" className="stroke-primary" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-[17px] font-semibold tracking-tight">
            Fin<span className="text-primary">Lens</span>
          </span>
          <span className="mt-1 text-[11px] font-medium tracking-wide text-muted-foreground">
            Financial Inclusion Intelligence
          </span>
        </span>
      )}
    </span>
  )
}
