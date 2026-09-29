import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  HandCoins,
  Landmark,
  PiggyBank,
  Smartphone,
  Users,
  Wallet,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { KPICard } from '@/components/charts/KPICard'
import { ChartCard } from '@/components/charts/ChartCard'
import { TrendChart, SeriesLegend } from '@/components/charts/TrendChart'
import { DotStrip } from '@/components/charts/DotStrip'
import { BarList } from '@/components/charts/BarList'
import { WorldMap } from '@/components/map/WorldMap'
import { MapLegend } from '@/components/map/MapLegend'
import { InsightCard } from '@/components/common/InsightCard'
import { Flag } from '@/components/common/Flag'
import { DeltaIndicator } from '@/components/common/DeltaIndicator'
import { BenchmarkStatus } from '@/components/common/BenchmarkStatus'
import { MetricSelector } from '@/components/common/MetricSelector'
import { YearSelector } from '@/components/common/YearSelector'
import { ExportMenu } from '@/components/common/ExportMenu'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/states'
import { chartVar } from '@/design/palette'
import type { FindexRepository } from '@/data/repository'
import type { Region } from '@/data/types'
import { useDataset } from '@/hooks/useDataset'
import { useFilters } from '@/hooks/useFilters'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { buildMapModel } from '@/features/map/map.logic'
import { MapTooltipContent } from '@/features/map/MapTooltipContent'
import { overviewMetrics } from '@/features/overview/overview.logic'
import { regionInsights } from '@/lib/insights/region'
import { formatPercent, formatPP, MISSING_GLYPH } from '@/lib/format'
import { cn } from '@/lib/utils'
import { buildRegionModel, type RegionModel } from './region.logic'

const ICONS: Record<string, React.ReactNode> = {
  accountOwnership: <Landmark />,
  mobileMoneyAccount: <Smartphone />,
  digitalPayments: <Wallet />,
  formalSavings: <PiggyBank />,
  formalBorrowing: <HandCoins />,
  genderGapAccount: <Users />,
}

export default function RegionPage() {
  const { slug = '' } = useParams()
  const { repo, status, error, retry } = useDataset()
  const region = repo?.region(decodeURIComponent(slug))
  if (status === 'error')
    return (
      <ErrorState
        title="The dataset could not be loaded."
        description={error ?? undefined}
        onRetry={() => void retry()}
      />
    )
  if (!repo) return <LoadingSkeleton variant="chart" />
  if (!region)
    return (
      <div className="space-y-6">
        <h1 id="page-title" tabIndex={-1} className="text-2xl font-semibold outline-none">
          Region not found
        </h1>
        <EmptyState
          title={`“${slug}” is not a Findex region.`}
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/regions">All regions</Link>
            </Button>
          }
        />
      </div>
    )
  return <RegionView repo={repo} region={region} />
}

type SortKey = 'rank' | 'name' | 'delta' | 'vsRegion'

function RegionView({ repo, region }: { repo: FindexRepository; region: Region }) {
  const navigate = useNavigate()
  const { filters, setFilters } = useFilters()
  const small = useMediaQuery('(max-width: 639px)')
  const model = useMemo(
    () => buildRegionModel(repo, region, { wave: filters.year, metric: filters.metric }),
    [repo, region, filters.year, filters.metric],
  )
  const insights = useMemo(
    () => regionInsights(repo, region, model.wave, model.spread),
    [repo, region, model.wave, model.spread],
  )
  const mapModel = useMemo(
    () => buildMapModel(repo, model.metric.id, model.wave),
    [repo, model.metric.id, model.wave],
  )
  const focus = useMemo(() => new Set(model.economies.map((e) => e.code)), [model.economies])
  const fmt = model.metric.unit === 'pp' ? formatPP : formatPercent

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Regions', to: '/regions' }, { label: region.name }]}
        eyebrow="Regional deep dive"
        title={region.name}
        description={
          region.excludesHighIncome
            ? `${model.economies.length} developing economies (Findex regions exclude high-income economies) · ${model.surveyed} with ${model.wave} data.`
            : `All ${model.economies.length} high-income economies, grouped together in the Findex classification · ${model.surveyed} with ${model.wave} data.`
        }
        actions={<ExportMenu />}
      />

      <div role="group" aria-label="Region filters" className="flex flex-wrap items-center gap-2">
        <YearSelector
          years={repo.waves}
          value={model.wave}
          onChange={(y) => setFilters({ year: y === repo.latestWave ? null : y })}
        />
        <MetricSelector
          indicators={overviewMetrics(repo)}
          value={model.metric.id}
          onChange={(m) => setFilters({ metric: m === 'accountOwnership' ? null : m })}
          label="Ranking metric"
        />
        <div className="ml-auto flex flex-wrap gap-1.5">
          {repo.regions
            .filter((r) => r.id !== region.id)
            .map((r) => (
              <Badge key={r.id} asChild variant="outline">
                <Link to={`/region/${r.slug}`}>{r.name}</Link>
              </Badge>
            ))}
        </div>
      </div>

      <section
        aria-label="Regional indicators"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {model.kpis.map((k) => (
          <KPICard
            key={k.indicator.id}
            label={k.indicator.shortLabel}
            icon={ICONS[k.indicator.id]}
            value={k.value}
            unit={k.indicator.unit === 'pp' ? 'pp' : '%'}
            delta={k.delta}
            higherIsBetter={k.indicator.higherIsBetter}
            comparisonLabel={k.previous ? `vs ${k.previous.wave}` : undefined}
            series={k.series.map((p) => ({ year: p.wave, value: p.value }))}
            description={k.indicator.definition}
            missingNote={
              k.value === null ? `Not published for ${region.name} in ${model.wave}.` : undefined
            }
            note={
              k.world !== null ? (
                <>
                  {k.worldLabel}:{' '}
                  <span className="font-medium text-foreground tabular">
                    {k.indicator.unit === 'pp' ? formatPP(k.world) : formatPercent(k.world)}
                  </span>
                </>
              ) : (
                `${k.worldLabel}: not published`
              )
            }
          />
        ))}
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-12">
        <ChartCard
          className="xl:col-span-7"
          title={`${model.metric.shortLabel} across ${region.name}`}
          description={`${model.ranking.length} economies with ${model.wave} data. Click an economy for its profile.`}
          sourceYear={model.wave}
          contentClassName="px-3 sm:px-4"
          status={model.ranking.length ? 'ready' : 'empty'}
        >
          <WorldMap
            values={mapModel.values}
            scale={mapModel.scale}
            focusCodes={focus}
            height={small ? 300 : 420}
            ariaLabel={`Map of ${model.metric.label} in ${region.name}, ${model.wave}`}
            onSelect={(code) => {
              const e = repo.entity(code)
              if (e?.kind === 'economy') navigate(`/country/${e.slug}`)
            }}
            renderTooltip={(code, name) => (
              <MapTooltipContent repo={repo} model={mapModel} code={code} name={name} />
            )}
            overlay={
              !small && (
                <MapLegend
                  className="absolute bottom-2 left-2 z-10"
                  scale={mapModel.scale}
                  unit={model.metric.unit}
                  title={model.metric.shortLabel}
                />
              )
            }
          />
        </ChartCard>
        <Card className="p-5 xl:col-span-5">
          <h2 className="mb-3 text-[15px] font-semibold">Regional insights</h2>
          <div className="space-y-3">
            {insights.map((i) => (
              <InsightCard
                key={i.id}
                tone={i.tone}
                title={i.title}
                evidence={i.evidence}
                onOpen={i.link ? () => navigate(i.link!) : undefined}
                className="shadow-none"
              >
                {i.detail}
              </InsightCard>
            ))}
            {insights.length === 0 && (
              <p className="text-sm text-muted-foreground">Not enough data for {model.wave}.</p>
            )}
          </div>
        </Card>
      </div>

      <RankingTable model={model} fmt={fmt} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title={`${model.metric.shortLabel} over time`}
          description={`${region.name} compared with ${model.trend.worldLabel}`}
          table={{
            caption: `${model.metric.label} over time`,
            columns: ['Wave', region.name, model.trend.worldLabel],
            rows: repo.waves.map((w, i) => [
              w,
              fmt(model.trend.region[i]?.value ?? null),
              fmt(model.trend.world[i]?.value ?? null),
            ]),
          }}
          status={model.trend.region.some((p) => p.value !== null) ? 'ready' : 'empty'}
        >
          <TrendChart
            unit={model.metric.unit === 'pp' ? 'pp' : '%'}
            waves={repo.waves}
            highlightWave={model.wave}
            series={[
              { id: 'r', label: region.name, color: chartVar(0), points: model.trend.region },
              {
                id: 'w',
                label: model.trend.worldLabel,
                color: 'var(--neutral)',
                points: model.trend.world,
                muted: true,
              },
            ]}
          />
          <SeriesLegend
            items={[
              { label: region.name, color: chartVar(0) },
              { label: model.trend.worldLabel, color: 'var(--neutral)', muted: true },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="Region vs global benchmark"
          description={`${region.name} aggregate compared with the world (or developing economies where no world figure is published), ${model.wave}`}
          sourceYear={model.wave}
          contentClassName="px-0 py-0"
        >
          <Table>
            <caption className="sr-only">Region vs global benchmark</caption>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Indicator</TableHead>
                <TableHead className="text-right">{region.name}</TableHead>
                <TableHead className="text-right">Global</TableHead>
                <TableHead className="pr-5">vs global</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {model.vsWorld.map((r) => (
                <TableRow key={r.indicator.id}>
                  <TableCell
                    className="max-w-52 truncate pl-5 font-medium"
                    title={r.indicator.label}
                  >
                    {r.indicator.shortLabel}
                  </TableCell>
                  <TableCell className="text-right">{formatPercent(r.region)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatPercent(r.world)}
                  </TableCell>
                  <TableCell className="pr-5">
                    <BenchmarkStatus
                      compact
                      status={r.status}
                      higherIsBetter={r.indicator.higherIsBetter}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ChartCard>
      </div>

      <ChartCard
        title="Spread across economies"
        description={`How far apart the economies of ${region.name} are on each indicator, ${model.wave}. Wide spreads point to very different starting points within the region.`}
        sourceYear={model.wave}
        table={{
          caption: `Spread of indicators across ${region.name}`,
          columns: ['Indicator', 'Lowest', 'Median', 'Highest', `${region.name} aggregate`],
          rows: model.spread.map((s) => [
            s.indicator.shortLabel,
            s.min ? `${s.min.entity.shortName} ${formatPercent(s.min.value)}` : MISSING_GLYPH,
            formatPercent(s.median),
            s.max ? `${s.max.entity.shortName} ${formatPercent(s.max.value)}` : MISSING_GLYPH,
            formatPercent(s.aggregate),
          ]),
        }}
      >
        <DotStrip
          rows={model.spread
            .filter((s) => s.points.length > 0)
            .map((s) => ({
              key: s.indicator.id,
              label: s.indicator.shortLabel,
              points: s.points.map((p) => ({
                id: p.entity.code,
                label: p.entity.shortName,
                value: p.value,
                href: `/country/${p.entity.slug}`,
              })),
              aggregate: s.aggregate,
              aggregateLabel: `${region.name} aggregate`,
              median: s.median,
            }))}
        />
        {model.spread.some((s) => s.points.length === 0) && (
          <p className="mt-3 text-xs text-muted-foreground">
            Not shown (no {model.wave} data):{' '}
            {model.spread
              .filter((s) => s.points.length === 0)
              .map((s) => s.indicator.shortLabel)
              .join(', ')}
            .
          </p>
        )}
      </ChartCard>
    </div>
  )
}

function RankingTable({ model, fmt }: { model: RegionModel; fmt: (v: number | null) => string }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'rank',
    dir: 'asc',
  })
  const rows = useMemo(() => {
    const val = (r: RegionModel['ranking'][number]) =>
      sort.key === 'rank'
        ? r.rank
        : sort.key === 'name'
          ? r.entity.shortName
          : sort.key === 'delta'
            ? r.delta
            : r.vsRegion
    return [...model.ranking].sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      if (va === null) return 1
      if (vb === null) return -1
      const c =
        typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
      return sort.dir === 'asc' ? c : -c
    })
  }, [model.ranking, sort])
  const header = (key: SortKey, label: string, right = false, extra?: string) => {
    const active = sort.key === key
    const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
    return (
      <TableHead
        className={cn(right && 'text-right', extra)}
        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1 rounded hover:text-foreground',
            active && 'text-foreground',
          )}
          onClick={() =>
            setSort((s) =>
              s.key === key
                ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
                : { key, dir: key === 'name' || key === 'rank' ? 'asc' : 'desc' },
            )
          }
        >
          {label}
          <Icon className="size-3" aria-hidden />
        </button>
      </TableHead>
    )
  }
  const regionAgg = model.kpis.find((k) => k.indicator.id === model.metric.id)?.value ?? null
  return (
    <ChartCard
      title={`Regional ranking: ${model.metric.shortLabel.toLowerCase()}`}
      description={`${model.region.name}, ${model.wave}. Change is against each economy’s previous survey with data.`}
      sourceYear={model.wave}
      contentClassName="px-0 py-0"
      status={rows.length ? 'ready' : 'empty'}
      actions={
        regionAgg !== null ? (
          <span className="text-xs text-muted-foreground">
            Region aggregate:{' '}
            <span className="font-semibold text-foreground tabular">{fmt(regionAgg)}</span>
          </span>
        ) : undefined
      }
    >
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Table>
          <caption className="sr-only">Regional ranking</caption>
          <TableHeader>
            <TableRow>
              {header('rank', 'Rank', false, 'pl-5')}
              {header('name', 'Economy')}
              <TableHead className="text-right">{model.metric.shortLabel}</TableHead>
              {header('delta', 'Change', true)}
              {header('vsRegion', 'vs region', true, 'pr-5')}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.entity.code}>
                <TableCell className="pl-5 text-muted-foreground">{r.rank}</TableCell>
                <TableCell>
                  <Link
                    to={`/country/${r.entity.slug}`}
                    className="flex items-center gap-2.5 font-medium hover:text-primary"
                  >
                    <Flag iso2={r.entity.iso2} code={r.entity.code} className="h-4 w-6" />
                    {r.entity.shortName}
                  </Link>
                </TableCell>
                <TableCell className="text-right font-semibold">{fmt(r.value)}</TableCell>
                <TableCell className="text-right">
                  {r.delta !== null ? (
                    <DeltaIndicator
                      delta={r.delta}
                      higherIsBetter={model.metric.higherIsBetter}
                      comparisonLabel={`vs ${r.previous?.wave}`}
                    />
                  ) : (
                    MISSING_GLYPH
                  )}
                </TableCell>
                <TableCell className="pr-5 text-right text-muted-foreground">
                  {formatPP(r.vsRegion)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="hidden border-l p-5 lg:block">
          <p className="mb-2 text-[13px] font-semibold">Country comparison</p>
          <BarList
            ariaLabel={`${model.metric.shortLabel} by economy`}
            max={model.metric.unit === '%' ? 100 : undefined}
            showBars={model.metric.unit !== 'pp'}
            reference={
              regionAgg !== null
                ? { label: `${model.region.name} aggregate`, value: regionAgg }
                : undefined
            }
            items={model.ranking.slice(0, 12).map((r) => ({
              key: r.entity.code,
              label: r.entity.shortName,
              value: Math.max(0, r.value),
              display: fmt(r.value),
              href: `/country/${r.entity.slug}`,
            }))}
          />
          {model.ranking.length > 12 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Top 12 of {model.ranking.length} shown.
            </p>
          )}
        </div>
      </div>
    </ChartCard>
  )
}
