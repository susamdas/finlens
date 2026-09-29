import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Info,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { KPICard } from '@/components/charts/KPICard'
import { DumbbellChart } from '@/components/charts/DumbbellChart'
import { ScatterPlot } from '@/components/charts/ScatterPlot'
import { SeriesLegend, TrendChart } from '@/components/charts/TrendChart'
import { GapRows } from '@/components/profile/GapRows'
import { ExportMenu } from '@/components/common/ExportMenu'
import { Flag } from '@/components/common/Flag'
import { InsightCard } from '@/components/common/InsightCard'
import { MetricSelector } from '@/components/common/MetricSelector'
import { ScopeSelector } from '@/components/common/ScopeSelector'
import { YearSelector } from '@/components/common/YearSelector'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/states'
import { chartVar } from '@/design/palette'
import type { FindexRepository } from '@/data/repository'
import { useDataset, useEnsureData } from '@/hooks/useDataset'
import { useFilters } from '@/hooks/useFilters'
import { scopeParamValue, scopeToFilters } from '@/features/overview/overview.logic'
import { describeCorrelation } from '@/lib/analytics/stats'
import { formatPercent, formatPP, MISSING_GLYPH } from '@/lib/format'
import { gapInsights } from '@/lib/insights/gaps'
import { cn } from '@/lib/utils'
import {
  buildGapModel,
  DEFAULT_BREAKDOWN,
  DEFAULT_GAP_METRIC,
  gapMetrics,
  sortGapRows,
  type GapEconomyRow,
  type GapModel,
  type GapSortKey,
  type GapTrend,
} from './gaps.logic'

const DUMBBELL_N = 12
const TABLE_N = 20

export default function GapsPage() {
  const { repo, status, error, retry } = useDataset()
  const groups = useEnsureData({ groups: true })
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Analyze' }, { label: 'Inclusion Gaps' }]}
        title="Inclusion gaps"
        description="Who is being left behind? Compare population groups — women and men, poorer and richer households, rural and urban adults, age, education and labor force — using the group values published in the Global Findex."
        actions={<ExportMenu />}
      />
      {(status === 'error' || groups.error) && (
        <ErrorState
          title="The dataset could not be loaded."
          description={error ?? groups.error ?? undefined}
          onRetry={() => void retry()}
        />
      )}
      {(!repo || !groups.ready) && status !== 'error' && !groups.error && (
        <LoadingSkeleton variant="chart" />
      )}
      {repo && groups.ready && <GapsView repo={repo} />}
    </div>
  )
}

function GapsView({ repo }: { repo: FindexRepository }) {
  const navigate = useNavigate()
  const { filters, setFilters } = useFilters()
  const [params, setParams] = useSearchParams()
  const breakdownParam = params.get('breakdown')

  const model = useMemo(
    () =>
      buildGapModel(repo, {
        wave: filters.year,
        metric: filters.metric,
        breakdown: breakdownParam,
        region: filters.region,
        income: filters.income,
      }),
    [repo, filters.year, filters.metric, filters.region, filters.income, breakdownParam],
  )
  const insights = useMemo(() => gapInsights(model), [model])

  const setBreakdown = (id: string) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        if (id === DEFAULT_BREAKDOWN) n.delete('breakdown')
        else n.set('breakdown', id)
        return n
      },
      { replace: true },
    )

  const hasData = model.stats.measured > 0 || model.headline.gap !== null

  return (
    <>
      <div
        role="group"
        aria-label="Gap filters"
        className="z-30 -mx-4 space-y-3 lg:sticky lg:top-16 border-b bg-background/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 print:static"
      >
        <Tabs panels={false} value={model.breakdown.id} onValueChange={setBreakdown}>
          <TabsList
            aria-label="Population breakdown"
            className="h-auto w-full flex-wrap justify-start sm:w-auto"
          >
            {repo.breakdowns.map((b) => (
              <TabsTrigger key={b.id} value={b.id} className="flex-none">
                {b.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-2">
          <MetricSelector
            indicators={gapMetrics(repo)}
            value={model.metric.id}
            onChange={(m) => setFilters({ metric: m === DEFAULT_GAP_METRIC ? null : m })}
            label="Indicator"
            className="w-full sm:w-64"
          />
          <YearSelector
            years={repo.waves}
            value={model.wave}
            onChange={(y) => setFilters({ year: y === repo.latestWave ? null : y })}
          />
          <ScopeSelector
            regions={repo.regions}
            incomeGroups={repo.incomeGroups}
            value={scopeParamValue(model.scope, repo)}
            onChange={(v) => {
              const f = scopeToFilters(v)
              setFilters({ region: f.region ?? null, income: f.income ?? null })
            }}
          />
        </div>
      </div>

      {!hasData ? (
        <EmptyState
          title={`No ${model.breakdown.label.toLowerCase()} breakdown of ${model.metric.shortLabel.toLowerCase()} is published for ${model.wave}.`}
          description={
            model.availableWaves.length
              ? `Published for: ${model.availableWaves.join(', ')}.`
              : 'Try another indicator or breakdown.'
          }
        />
      ) : (
        <>
          <HeadlineKpis model={model} />
          <div className="grid items-start gap-4 xl:grid-cols-12">
            <ChartCard
              className="xl:col-span-7"
              title={`All breakdowns · ${model.headline.source.label}`}
              description={`${model.metric.shortLabel}, ${model.wave}. Each row shows the two groups and the gap between them. Select a row's breakdown above to analyze it across economies.`}
              sourceYear={model.wave}
              footnote={
                model.headline.fallback
                  ? 'World figure not published for this indicator; developing-economies aggregate shown.'
                  : undefined
              }
            >
              <GapRows rows={model.allBreakdowns} />
            </ChartCard>
            <Card className="p-5 xl:col-span-5">
              <h2 className="mb-3 text-[15px] font-semibold">What the data shows</h2>
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
                  <p className="text-sm text-muted-foreground">
                    Not enough published group values to describe this gap.
                  </p>
                )}
              </div>
            </Card>
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-2">
            <WidestGaps model={model} />
            <GapScatter model={model} onSelect={(slug) => navigate(`/country/${slug}`)} />
          </div>
          <GapTrend model={model} />
          <GapTable model={model} />
        </>
      )}
    </>
  )
}

function HeadlineKpis({ model }: { model: GapModel }) {
  const h = model.headline
  const src = h.source.label
  const d = (v: number | null, p: { value: number } | null) =>
    v !== null && p ? Math.round((v - p.value) * 100) / 100 : null
  const gapDelta =
    h.gap !== null && h.previousGap ? Math.round((h.gap - h.previousGap.value) * 100) / 100 : null
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KPICard
        label={`${model.labels.a} · ${src}`}
        value={h.a}
        delta={d(h.a, h.aPrevious)}
        comparisonLabel={h.aPrevious ? `vs ${h.aPrevious.wave}` : undefined}
        higherIsBetter={model.metric.higherIsBetter}
        note={`${model.metric.shortLabel}, ${model.wave}`}
        missingNote="Not published for this group"
      />
      <KPICard
        label={`${model.labels.b} · ${src}`}
        value={h.b}
        delta={d(h.b, h.bPrevious)}
        comparisonLabel={h.bPrevious ? `vs ${h.bPrevious.wave}` : undefined}
        higherIsBetter={model.metric.higherIsBetter}
        note={`${model.metric.shortLabel}, ${model.wave}`}
        missingNote="Not published for this group"
      />
      <KPICard
        label={`${model.breakdown.gapLabel} · ${src}`}
        value={h.gap}
        unit="pp"
        delta={gapDelta}
        comparisonLabel={h.previousGap ? `vs ${h.previousGap.wave}` : undefined}
        higherIsBetter={false}
        note={`${model.labels.b} − ${model.labels.a}${h.fallback ? ' · World not published' : ''}`}
        missingNote="Both groups are needed to compute the gap"
      />
      <KPICard
        label="Economies with a gap ≥ 1 pp"
        value={model.stats.advantagedAhead}
        unit="count"
        note={`of ${model.stats.measured} measured · ${model.stats.reversed} reversed`}
      />
    </div>
  )
}

function WidestGaps({ model }: { model: GapModel }) {
  const [mode, setMode] = useState<'widest' | 'narrowest'>('widest')
  const measured = model.rows.filter((r) => r.gap !== null)
  const sorted = sortGapRows(measured, 'gap', mode === 'widest' ? 'desc' : 'asc').slice(
    0,
    DUMBBELL_N,
  )
  return (
    <ChartCard
      title={mode === 'widest' ? 'Widest gaps' : 'Smallest or reversed gaps'}
      description={`${model.metric.shortLabel}, ${model.wave} · ${model.scope.label}. The bar between the dots is the gap.`}
      sourceYear={model.wave}
      status={measured.length ? 'ready' : 'empty'}
      emptyMessage="No economy publishes both groups for this selection."
      actions={
        <Tabs
          panels={false}
          value={mode}
          onValueChange={(v) => setMode(v as 'widest' | 'narrowest')}
        >
          <TabsList aria-label="Order">
            <TabsTrigger value="widest">Widest</TabsTrigger>
            <TabsTrigger value="narrowest">Smallest</TabsTrigger>
          </TabsList>
        </Tabs>
      }
      table={{
        caption: `${model.breakdown.gapLabel} by economy`,
        columns: ['Economy', model.labels.a, model.labels.b, 'Gap'],
        rows: sorted.map((r) => [
          r.entity.shortName,
          formatPercent(r.a),
          formatPercent(r.b),
          formatPP(r.gap),
        ]),
      }}
    >
      <DumbbellChart
        rows={sorted.map((r) => ({
          key: r.entity.code,
          label: r.entity.shortName,
          a: r.a,
          b: r.b,
          href: `/country/${r.entity.slug}`,
        }))}
        aLabel={model.labels.a}
        bLabel={model.labels.b}
      />
    </ChartCard>
  )
}

function GapScatter({ model, onSelect }: { model: GapModel; onSelect: (slug: string) => void }) {
  const pts = model.scatter.points
  const ys = pts.map((p) => p.y)
  const lo = Math.min(0, ...ys)
  const hi = Math.max(10, ...ys)
  const step = 10
  const domain: [number, number] = [Math.floor(lo / step) * step, Math.ceil(hi / step) * step]
  const r = model.scatter.r
  return (
    <ChartCard
      title="Gap vs overall level"
      description={`Each dot is an economy: overall ${model.metric.shortLabel.toLowerCase()} (across) and the ${model.breakdown.gapLabel.toLowerCase()} (up). Above the zero line, ${model.labels.b.toLowerCase()} are ahead.`}
      sourceYear={model.wave}
      status={pts.length >= 3 ? 'ready' : 'empty'}
      emptyMessage="Too few economies with both values to plot."
      footnote={
        r !== null
          ? `${describeCorrelation(r)} (r = ${r.toFixed(2)}, n = ${pts.length}). Correlation is not causation.`
          : pts.length
            ? `Fewer than 10 economies — no correlation reported.`
            : undefined
      }
      table={{
        caption: 'Gap vs overall level',
        columns: ['Economy', `Overall`, 'Gap'],
        rows: pts.map((p) => [p.entity.shortName, formatPercent(p.x), formatPP(p.y)]),
      }}
    >
      <ScatterPlot
        points={pts.map((p) => ({
          id: p.entity.code,
          label: p.entity.shortName,
          x: p.x,
          y: p.y,
          highlight: true,
        }))}
        xLabel={`${model.metric.shortLabel} (all adults)`}
        yLabel={model.breakdown.gapLabel}
        yDomain={domain}
        yUnit="pp"
        fit={model.scatter.fit}
        onSelect={(p) => {
          const e = pts.find((x) => x.entity.code === p.id)?.entity
          if (e) onSelect(e.slug)
        }}
      />
    </ChartCard>
  )
}

function GapTrend({ model }: { model: GapModel }) {
  const series = model.trend.map((t, i) => ({
    id: t.breakdown.id,
    label: t.breakdown.gapLabel,
    color: chartVar(i),
    points: t.points,
    muted: t.breakdown.id !== model.breakdown.id,
  }))
  const values = series.flatMap((s) => s.points.map((p) => p.value)).filter((v) => v !== null)
  const lo = Math.min(0, ...values)
  const hi = Math.max(10, ...values)
  const drawn = series.filter((s) => s.points.filter((p) => p.value !== null).length > 1)
  const single = series.filter((s) => s.points.filter((p) => p.value !== null).length === 1)
  return (
    <ChartCard
      title={`Gaps over time · ${model.headline.source.label}`}
      description={`${model.metric.shortLabel}: advantaged minus disadvantaged group, in percentage points. The selected breakdown is emphasized.`}
      sourceYear={`${model.trend[0]?.points[0]?.wave ?? ''}–${model.wave}`}
      status={drawn.length ? 'ready' : 'empty'}
      emptyMessage="Gaps are published in fewer than two waves for this selection."
      footnote={
        single.length
          ? `Published in one wave only: ${single.map((s) => s.label).join(', ')}.`
          : undefined
      }
      table={{
        caption: 'Gaps over time',
        columns: ['Breakdown', ...repoWaves(model).map(String)],
        rows: series.map((s) => [s.label, ...s.points.map((p) => formatPP(p.value))]),
      }}
    >
      <TrendChart
        series={drawn}
        waves={repoWaves(model)}
        unit="pp"
        yDomain={[Math.floor(lo / 10) * 10, Math.ceil(hi / 10) * 10]}
        highlightWave={model.wave}
      />
      <SeriesLegend
        items={drawn.map((s) => ({ label: s.label, color: s.color, muted: s.muted }))}
      />
    </ChartCard>
  )
}

const repoWaves = (m: GapModel) => m.trend[0]?.points.map((p) => p.wave) ?? []

const TREND_ICON: Record<GapTrend, typeof Minus> = {
  narrowed: TrendingDown,
  widened: TrendingUp,
  stable: Minus,
}

function GapTable({ model }: { model: GapModel }) {
  const [sort, setSort] = useState<{ key: GapSortKey; dir: 'asc' | 'desc' }>({
    key: 'gap',
    dir: 'desc',
  })
  const [showAll, setShowAll] = useState(false)
  const all = sortGapRows(model.rows, sort.key, sort.dir)
  const rows = showAll ? all : all.slice(0, TABLE_N)
  const cols: { key: GapSortKey; label: string; className?: string }[] = [
    { key: 'name', label: 'Economy' },
    { key: 'a', label: model.labels.a, className: 'hidden text-right sm:table-cell' },
    { key: 'b', label: model.labels.b, className: 'hidden text-right sm:table-cell' },
    { key: 'gap', label: 'Gap', className: 'text-right' },
    { key: 'sizeChange', label: 'Change in size', className: 'pr-5 text-right' },
  ]
  const toggle = (key: GapSortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'name' ? 'asc' : 'desc' },
    )
  return (
    <ChartCard
      title={`${model.breakdown.gapLabel} by economy`}
      description={`${model.stats.measured} of ${model.stats.inScope} economies in ${model.scope.label} publish both groups for ${model.wave}. Median gap ${formatPP(model.stats.median)}.`}
      sourceYear={model.wave}
      contentClassName="px-0 py-0"
      footnote={
        <span className="inline-flex gap-1.5">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Change in size compares the absolute gap with the economy’s previous wave; under 1 pp is
          “stable”.
        </span>
      }
    >
      <Table>
        <caption className="sr-only">
          {model.breakdown.gapLabel} by economy. Column headers sort the table.
        </caption>
        <TableHeader>
          <TableRow>
            {cols.map((c) => {
              const active = sort.key === c.key
              const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
              return (
                <TableHead
                  key={c.key}
                  className={cn(c.key === 'name' && 'pl-5', c.className)}
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <button
                    type="button"
                    onClick={() => toggle(c.key)}
                    className={cn(
                      'hit-area inline-flex items-center gap-1 rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40',
                      active && 'text-foreground',
                    )}
                  >
                    {c.label}
                    <Icon className="size-3" aria-hidden />
                  </button>
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <GapTableRow key={r.entity.code} r={r} />
          ))}
        </TableBody>
      </Table>
      {all.length > TABLE_N && (
        <div className="border-t px-5 py-3">
          <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Show fewer' : `Show all ${all.length} economies`}
          </Button>
        </div>
      )}
    </ChartCard>
  )
}

function GapTableRow({ r }: { r: GapEconomyRow }) {
  const Icon = r.trend ? TREND_ICON[r.trend] : null
  return (
    <TableRow className={cn(r.gap === null && 'text-muted-foreground')}>
      <TableCell className="max-w-0 min-w-36 pl-5">
        <Link
          to={`/country/${r.entity.slug}`}
          className="hit-area flex min-w-0 items-center gap-3 font-medium outline-none hover:text-primary focus-visible:underline"
        >
          <Flag iso2={r.entity.iso2} code={r.entity.code} className="h-5 w-7 shrink-0" />
          <span className="truncate">{r.entity.shortName}</span>
        </Link>
      </TableCell>
      <TableCell className="hidden text-right tabular sm:table-cell">
        {formatPercent(r.a)}
      </TableCell>
      <TableCell className="hidden text-right tabular sm:table-cell">
        {formatPercent(r.b)}
      </TableCell>
      <TableCell className="text-right font-semibold tabular">
        {r.gap === null ? MISSING_GLYPH : formatPP(r.gap)}
        {r.gap !== null && r.gap <= -1 && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">reversed</span>
        )}
      </TableCell>
      <TableCell className="pr-5 text-right">
        {r.trend && Icon && r.previousGap ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium tabular',
              r.trend === 'narrowed' && 'bg-positive-soft text-positive',
              r.trend === 'widened' && 'bg-negative-soft text-negative',
              r.trend === 'stable' && 'bg-neutral-soft text-neutral',
            )}
            title={`${r.previousGap.wave}: ${formatPP(r.previousGap.value)}`}
          >
            <Icon className="size-3" aria-hidden />
            {r.trend === 'stable' ? 'Stable' : r.trend === 'narrowed' ? 'Narrowed' : 'Widened'}{' '}
            {formatPP(r.sizeChange)}
            <span className="sr-only"> since {r.previousGap.wave}</span>
          </span>
        ) : (
          MISSING_GLYPH
        )}
      </TableCell>
    </TableRow>
  )
}
