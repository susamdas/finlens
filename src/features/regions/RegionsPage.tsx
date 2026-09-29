import { useMemo } from 'react'
import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/layout/PageHeader'
import { ChartCard } from '@/components/charts/ChartCard'
import { TrendChart, SeriesLegend } from '@/components/charts/TrendChart'
import { Sparkline } from '@/components/charts/Sparkline'
import { DeltaIndicator } from '@/components/common/DeltaIndicator'
import { YearSelector } from '@/components/common/YearSelector'
import { ErrorState, LoadingSkeleton } from '@/components/common/states'
import { chartVar } from '@/design/palette'
import { useDataset } from '@/hooks/useDataset'
import { useFilters } from '@/hooks/useFilters'
import { formatPercent, formatPP, MISSING_GLYPH } from '@/lib/format'
import { REGION_KPIS, regionsTable } from './region.logic'

export default function RegionsPage() {
  const { repo, status, error, retry } = useDataset()
  const { filters, setFilters } = useFilters()
  const wave =
    repo && filters.year && repo.waves.includes(filters.year) ? filters.year : repo?.latestWave
  const rows = useMemo(() => (repo && wave ? regionsTable(repo, wave) : []), [repo, wave])
  const world = useMemo(
    () =>
      repo && wave
        ? Object.fromEntries(
            REGION_KPIS.map((id) => [
              id,
              repo.value(id, 'WLD', wave) ?? repo.value(id, 'LMY', wave),
            ]),
          )
        : {},
    [repo, wave],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Explore' }, { label: 'Regions' }]}
        title="Regions"
        description="Findex regional aggregates. The six developing regions exclude high-income economies, which are grouped separately."
      />
      {status === 'error' && (
        <ErrorState
          title="The dataset could not be loaded."
          description={error ?? undefined}
          onRetry={() => void retry()}
        />
      )}
      {!repo && status !== 'error' && <LoadingSkeleton variant="chart" />}
      {repo && wave && (
        <>
          <div className="flex items-center gap-2">
            <YearSelector
              years={repo.waves}
              value={wave}
              onChange={(y) => setFilters({ year: y === repo.latestWave ? null : y })}
            />
          </div>

          <section aria-label="Regions" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {rows.map((r) => (
              <Link
                key={r.region.id}
                to={`/region/${r.region.slug}${wave !== repo.latestWave ? `?year=${wave}` : ''}`}
                className="group rounded-2xl border bg-card p-5 shadow-card transition-shadow outline-none hover:shadow-raised focus-visible:ring-[3px] focus-visible:ring-ring/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{r.region.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.economies} economies
                      {r.region.excludesHighIncome ? ' · excl. high income' : ''}
                    </p>
                  </div>
                  <ArrowRight
                    className="size-4 text-subtle-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[11.5px] text-muted-foreground">Account ownership</p>
                    <p className="text-2xl font-semibold tracking-tight tabular">
                      {formatPercent(r.values.accountOwnership ?? null)}
                    </p>
                    {r.accountChange && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <DeltaIndicator
                          delta={r.accountChange.delta}
                          comparisonLabel={`vs ${r.accountChange.wave}`}
                        />
                        <span className="text-xs text-muted-foreground">
                          vs {r.accountChange.wave}
                        </span>
                      </div>
                    )}
                  </div>
                  <Sparkline
                    width={96}
                    height={32}
                    data={r.accountSeries.map((p) => ({ year: p.wave, value: p.value }))}
                  />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Mobile money</dt>
                    <dd className="font-semibold tabular">
                      {formatPercent(r.values.mobileMoneyAccount ?? null)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Gender gap</dt>
                    <dd className="font-semibold tabular">
                      {formatPP(r.values.genderGapAccount ?? null)}
                    </dd>
                  </div>
                </dl>
              </Link>
            ))}
          </section>

          <ChartCard
            title="Regions side by side"
            description={`Findex aggregates, ${wave}. “Global” uses the world aggregate, or developing economies where no world figure is published.`}
            sourceYear={wave}
            contentClassName="px-0 py-0"
          >
            <Table>
              <caption className="sr-only">Regional comparison</caption>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Region</TableHead>
                  {REGION_KPIS.map((id) => (
                    <TableHead key={id} className="text-right">
                      {repo
                        .indicator(id)
                        ?.shortLabel.replace(
                          'Made or received a digital payment',
                          'Digital payments',
                        )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.region.id}>
                    <TableCell className="pl-5 font-medium">
                      <Link to={`/region/${r.region.slug}`} className="hover:text-primary">
                        {r.region.name}
                      </Link>
                    </TableCell>
                    {REGION_KPIS.map((id) => {
                      const v = r.values[id] ?? null
                      const isPP = repo.indicator(id)?.unit === 'pp'
                      return (
                        <TableCell key={id} className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span>
                              {v === null ? MISSING_GLYPH : isPP ? formatPP(v) : formatPercent(v)}
                            </span>
                            {!isPP && v !== null && (
                              <span aria-hidden className="block h-1 w-20 rounded-full bg-muted">
                                <span
                                  className="block h-1 rounded-full bg-chart-1"
                                  style={{ width: `${v}%` }}
                                />
                              </span>
                            )}
                          </div>
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40">
                  <TableCell className="pl-5 font-medium text-muted-foreground">Global</TableCell>
                  {REGION_KPIS.map((id) => {
                    const v = (world as Record<string, number | null>)[id] ?? null
                    return (
                      <TableCell key={id} className="text-right text-muted-foreground">
                        {v === null
                          ? MISSING_GLYPH
                          : repo.indicator(id)?.unit === 'pp'
                            ? formatPP(v)
                            : formatPercent(v)}
                      </TableCell>
                    )
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </ChartCard>

          <ChartCard
            title="Account ownership by region over time"
            description="Findex regional aggregates, all survey waves"
            table={{
              caption: 'Account ownership by region over time',
              columns: ['Region', ...repo.waves.map(String)],
              rows: rows.map((r) => [
                r.region.name,
                ...r.accountSeries.map((p) => formatPercent(p.value)),
              ]),
            }}
          >
            <Card className="border-0 p-0 shadow-none">
              <TrendChart
                height={320}
                waves={repo.waves}
                highlightWave={wave}
                series={rows.map((r, i) => ({
                  id: r.region.id,
                  label: r.region.name,
                  color: chartVar(i),
                  points: r.accountSeries,
                }))}
              />
              <SeriesLegend
                items={rows.map((r, i) => ({ label: r.region.name, color: chartVar(i) }))}
              />
            </Card>
          </ChartCard>
        </>
      )}
    </div>
  )
}
