import { Link, useParams } from 'react-router'
import { ArrowRight, Hammer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { NavIcon } from '@/components/layout/nav-icons'
import { ROUTE_GROUP_LABELS, type AppRoute } from '@/config/routes'
import { useCurrentRoute } from '@/hooks/useCurrentRoute'
import { useDataset } from '@/hooks/useDataset'
import { EmptyState } from '@/components/common/states'

/**
 * Honest placeholder for a module that isn't built yet: the route, navigation and URL state
 * already work, and the page states which roadmap phase delivers it. No sample data.
 */
export default function PlannedPage() {
  const route = useCurrentRoute() as AppRoute
  const params = useParams()
  const { repo } = useDataset()
  const slug = params.slug ? decodeURIComponent(params.slug) : undefined
  const resolved =
    slug && repo
      ? route.id === 'region'
        ? repo.region(slug)?.name
        : repo.entityBySlug(slug)?.shortName
      : undefined
  const subject = resolved ?? slug?.replace(/-/g, ' ')
  const unknown = Boolean(slug && repo && !resolved)

  return (
    <div className="space-y-8">
      <PageHeader
        breadcrumbs={[{ label: ROUTE_GROUP_LABELS[route.group] }, { label: route.label }]}
        title={
          <span>
            {route.label}
            {subject && (
              <span className="text-muted-foreground">
                {' '}
                · <span className="capitalize">{subject}</span>
              </span>
            )}
          </span>
        }
        description={route.description}
      />
      {unknown && (
        <EmptyState
          title={`“${slug}” is not ${route.id === 'region' ? 'a region' : 'an economy'} in the Global Findex dataset.`}
          description="Check the spelling, or use search (Ctrl K) to find it."
        />
      )}
      <section
        aria-labelledby="planned-title"
        className="relative overflow-hidden rounded-2xl border bg-card p-8 shadow-card sm:p-10"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full bg-primary/8 blur-3xl"
        />
        <div className="relative flex max-w-xl flex-col items-start gap-4">
          <span className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
            <NavIcon name={route.icon} className="size-6" aria-hidden />
          </span>
          <Badge variant="accent">
            <Hammer aria-hidden /> Arrives in Phase {route.phase}
          </Badge>
          <h2 id="planned-title" className="text-lg font-semibold tracking-tight">
            This module is on the roadmap
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Navigation, search and shareable URL filters for this page are already wired up. Its
            analytics will be built on the Global Findex dataset once it is loaded — FinLens never
            shows invented figures in the meantime.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild size="sm">
              <Link to="/design">
                View design system <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/about">About the data</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
