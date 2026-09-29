import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Flag } from '@/components/common/Flag'
import type { Entity, IncomeGroup, Region } from '@/data/types'
import { formatCompact } from '@/lib/format'

/** Country identity block: flag, name, classification, population and survey context. */
export function CountryProfileHeader({
  entity,
  region,
  incomeGroup,
  population,
  wave,
  surveyYear,
  controls,
  actions,
}: {
  entity: Entity
  region?: Region
  incomeGroup?: IncomeGroup
  population: number | null
  wave: number
  surveyYear: number
  controls?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="relative overflow-hidden rounded-3xl border bg-card p-6 shadow-card sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full bg-primary/8 blur-3xl"
      />
      <nav aria-label="Breadcrumb" className="relative mb-4">
        <ol className="flex items-center gap-1 text-xs text-muted-foreground">
          <li>
            <Link to="/countries" className="hover:text-foreground">
              Countries
            </Link>
          </li>
          <ChevronRight className="size-3" aria-hidden />
          {region && (
            <>
              <li>
                <Link to={`/region/${region.slug}`} className="hover:text-foreground">
                  {region.name}
                </Link>
              </li>
              <ChevronRight className="size-3" aria-hidden />
            </>
          )}
          <li aria-current="page">{entity.shortName}</li>
        </ol>
      </nav>
      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex items-start gap-4">
          <Flag
            iso2={entity.iso2}
            code={entity.code}
            className="mt-1 h-12 w-16 rounded-md sm:h-14 sm:w-[76px]"
          />
          <div className="min-w-0 space-y-2">
            <div>
              <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                Financial Inclusion Profile
              </p>
              <h1
                id="page-title"
                tabIndex={-1}
                className="text-2xl font-semibold tracking-tight outline-none sm:text-[32px]"
              >
                {entity.shortName}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {region && (
                <Badge asChild variant="accent">
                  <Link to={`/region/${region.slug}`}>{region.name}</Link>
                </Badge>
              )}
              {incomeGroup && <Badge variant="outline">{incomeGroup.name}</Badge>}
              <Badge variant="secondary">
                {wave} wave{surveyYear !== wave ? ` · surveyed ${surveyYear}` : ''}
              </Badge>
              {population !== null && (
                <Badge variant="secondary">Adults (15+): {formatCompact(population)}</Badge>
              )}
            </div>
            {entity.name !== entity.shortName && (
              <p className="text-xs text-muted-foreground">Official name: {entity.name}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 xl:items-end">
          <div className="flex flex-wrap items-center gap-2">{controls}</div>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </div>
      </div>
    </header>
  )
}
