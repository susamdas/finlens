import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Crumb {
  label: string
  to?: string
}

/**
 * Standard page heading. The <h1> is programmatically focusable so route changes can move
 * focus to it for keyboard and screen-reader users.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  breadcrumbs,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  breadcrumbs?: Crumb[]
  actions?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}
    >
      <div className="min-w-0 space-y-1.5">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              {breadcrumbs.map((c, i) => (
                <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight aria-hidden className="size-3" />}
                  {c.to ? (
                    <Link
                      to={c.to}
                      className="hit-area rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      {c.label}
                    </Link>
                  ) : (
                    <span aria-current="page">{c.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        {eyebrow && (
          <div className="text-xs font-semibold tracking-wide text-primary uppercase">
            {eyebrow}
          </div>
        )}
        <h1
          id="page-title"
          tabIndex={-1}
          className="text-2xl font-semibold tracking-tight outline-none sm:text-[28px]"
        >
          {title}
        </h1>
        {description && (
          <p className="max-w-3xl text-sm text-muted-foreground sm:text-[15px]">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
