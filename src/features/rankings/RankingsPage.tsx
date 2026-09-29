import { useDeferredValue, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Info, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/layout/PageHeader'
import { Flag } from '@/components/common/Flag'
import { DeltaIndicator } from '@/components/common/DeltaIndicator'
import { ExportMenu } from '@/components/common/ExportMenu'
import { MetricSelector } from '@/components/common/MetricSelector'
import { SourceBadge } from '@/components/common/SourceBadge'
import { YearSelector } from '@/components/common/YearSelector'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/states'
import type { FindexRepository } from '@/data/repository'
import type { IndicatorDefinition } from '@/data/types'
import { useDataset } from '@/hooks/useDataset'
import { useFilters } from '@/hooks/useFilters'
import { formatPercent, formatPP, MISSING_GLYPH } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  buildRankings,
  RANKINGS_DEFAULT_METRIC,
  rankingMetrics,
  resolveRankingMetric,
  type RankOrder,
} from './rankings.logic'

const fmt = (ind: IndicatorDefinition, v: number | null) =>
  ind.unit === 'pp' ? formatPP(v) : formatPercent(v)

export default function RankingsPage() {
  const { repo, status, error, retry } = useDataset()
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Analyze' }, { label: 'Rankings' }]}
        title="Rankings"
        description="Economies ranked on one indicator at a time, with change since the previous survey and the difference from their regional average."
        actions={<ExportMenu />}
      />
      {status === 'error' && (
        <ErrorState
          title="The dataset could not be loaded."
          description={error ?? undefined}
          onRetry={() => void retry()}
        />
      )}
      {!repo && status !== 'error' && <LoadingSkeleton variant="table" rows={12} />}
      {repo && <RankingsView repo={repo} />}
    </div>
  )
}

function RankingsView({ repo }: { repo: FindexRepository }) {
  const { filters, setFilters } = useFilters()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query.trim().toLowerCase())

  const order: RankOrder = params.get('order') === 'asc' ? 'asc' : 'desc'
  const setOrder = (o: RankOrder) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        if (o === 'desc') n.delete('order')
        else n.set('order', o)
        return n
      },
      { replace: true },
    )

  const wave = filters.year && repo.waves.includes(filters.year) ? filters.year : repo.latestWave
  const metric = resolveRankingMetric(repo, filters.metric)
  const region = filters.region ? repo.region(filters.region) : undefined
  const income = filters.income ? repo.incomeGroup(filters.income) : undefined

  const model = useMemo(
    () =>
      buildRankings(repo, {
        metric: metric.id,
        wave,
        order,
        regionId: region?.id,
        incomeGroupId: income?.id,
      }),
    [repo, metric.id, wave, order, region?.id, income?.id],
  )
  const rows = useMemo(
    () =>
      q
        ? model.rows.filter(
            (r) =>
              r.entity.shortName.toLowerCase().includes(q) ||
              r.entity.name.toLowerCase().includes(q) ||
              r.entity.code.toLowerCase() === q,
          )
        : model.rows,
    [model.rows, q],
  )
  const max = Math.max(...model.rows.map((r) => Math.abs(r.value)), 1)
  const scale = metric.unit === '%' ? 100 : max

  return (
    <>
      <div role="group" aria-label="Ranking options" className="flex flex-wrap items-center gap-2">
        <MetricSelector
          indicators={rankingMetrics(repo)}
          value={metric.id}
          onChange={(m) => setFilters({ metric: m === RANKINGS_DEFAULT_METRIC ? null : m })}
          label="Ranking indicator"
          className="w-full sm:w-64"
        />
        <YearSelector
          years={repo.waves}
          value={wave}
          onChange={(y) => setFilters({ year: y === repo.latestWave ? null : y })}
        />
        <Select
          value={filters.region ?? 'all'}
          onValueChange={(v) => setFilters({ region: v === 'all' ? null : v })}
        >
          <SelectTrigger size="sm" className="w-full sm:w-52" aria-label="Region">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All regions</SelectItem>
            {repo.regions.map((r) => (
              <SelectItem key={r.id} value={r.slug}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.income ?? 'all'}
          onValueChange={(v) => setFilters({ income: v === 'all' ? null : v })}
        >
          <SelectTrigger size="sm" className="w-full sm:w-48" aria-label="Income group">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All income groups</SelectItem>
            {[...repo.incomeGroups]
              .sort((a, b) => a.order - b.order)
              .map((g) => (
                <SelectItem key={g.id} value={g.slug}>
                  {g.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOrder(order === 'desc' ? 'asc' : 'desc')}
          aria-label={`Order: ${order === 'desc' ? 'highest first' : 'lowest first'}. Click to reverse.`}
        >
          {order === 'desc' ? (
            <ArrowDownWideNarrow className="size-4" aria-hidden />
          ) : (
            <ArrowUpNarrowWide className="size-4" aria-hidden />
          )}
          {order === 'desc' ? 'Highest first' : 'Lowest first'}
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h2 className="font-semibold">
              {metric.shortLabel} · {wave}
            </h2>
            <p className="text-sm text-muted-foreground">
              {model.rows.length} economies ranked
              {region ? ` in ${region.name}` : ''}
              {income ? ` · ${income.name}` : ''}
              {model.median !== null ? ` · median ${fmt(metric, model.median)}` : ''}
              {' · '}
              {metric.unitLabel}
            </p>
          </div>
          <div className="relative md:w-64">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find an economy…"
              aria-label="Find an economy in the ranking"
              className="pl-9"
            />
          </div>
        </div>

        {model.rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={`No ${wave} values for this indicator in the selected scope.`}
              description="Try another survey year or widen the region and income filters."
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No ranked economy matches this search." />
          </div>
        ) : (
          <Table>
            <caption className="sr-only">
              {metric.shortLabel}, {wave}. Rank 1 is the {order === 'desc' ? 'highest' : 'lowest'}{' '}
              value.
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14 pl-4 text-right">Rank</TableHead>
                <TableHead>Economy</TableHead>
                <TableHead className="hidden lg:table-cell">Region</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="hidden text-right md:table-cell">Previous</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Change</TableHead>
                <TableHead className="hidden pr-4 text-right md:table-cell">vs region</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.entity.code}>
                  <TableCell className="pl-4 text-right text-muted-foreground tabular">
                    {r.rank}
                  </TableCell>
                  <TableCell className="max-w-0 min-w-36">
                    <Link
                      to={`/country/${r.entity.slug}?year=${wave}`}
                      className="hit-area flex min-w-0 items-center gap-3 font-medium outline-none hover:text-primary focus-visible:underline"
                    >
                      <Flag
                        iso2={r.entity.iso2}
                        code={r.entity.code}
                        className="h-5 w-7 shrink-0"
                      />
                      <span className="truncate">{r.entity.shortName}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {r.regionName ?? MISSING_GLYPH}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <div
                        className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted xl:block"
                        aria-hidden
                      >
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{ width: `${Math.min(100, (Math.abs(r.value) / scale) * 100)}%` }}
                        />
                      </div>
                      <span className="w-16 font-semibold tabular">{fmt(metric, r.value)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular md:table-cell">
                    {r.previous ? (
                      <>
                        {fmt(metric, r.previous.value)}{' '}
                        <span className="text-xs">({r.previous.wave})</span>
                      </>
                    ) : (
                      MISSING_GLYPH
                    )}
                  </TableCell>
                  <TableCell className="hidden text-right sm:table-cell">
                    {r.change !== null ? (
                      <DeltaIndicator
                        delta={r.change}
                        higherIsBetter={metric.higherIsBetter}
                        comparisonLabel={`vs ${r.previous?.wave}`}
                      />
                    ) : (
                      <span className="text-muted-foreground">{MISSING_GLYPH}</span>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'hidden pr-4 text-right tabular md:table-cell',
                      r.regionalDiff === null && 'text-muted-foreground',
                    )}
                    title={
                      r.regionalValue !== null && r.regionName
                        ? `${r.regionName}: ${fmt(metric, r.regionalValue)}`
                        : 'No regional aggregate for this wave'
                    }
                  >
                    {r.regionalDiff !== null ? formatPP(r.regionalDiff) : MISSING_GLYPH}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="space-y-2 border-t px-4 py-3 text-xs text-muted-foreground">
          <p className="flex gap-2">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              A rank is a position on this one indicator in {wave}, not an overall score — FinLens
              does not combine indicators into a single “best country” ranking. Ties share a rank.
              “vs region” is the economy minus its Findex regional aggregate (percentage points).
              Change compares with the economy’s previous survey wave.
            </span>
          </p>
          {model.missing.length > 0 && (
            <p>
              Not ranked — no {wave} value ({model.missing.length}):{' '}
              {model.missing.map((e) => e.shortName).join(', ')}.
            </p>
          )}
          <div className="flex justify-end">
            <SourceBadge />
          </div>
        </div>
      </Card>
    </>
  )
}
