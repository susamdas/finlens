import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card } from '@/components/ui/card'
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
import { ChartCard } from '@/components/charts/ChartCard'
import { KPICard } from '@/components/charts/KPICard'
import { ScatterPlot } from '@/components/charts/ScatterPlot'
import { SeriesLegend, TrendChart, type TrendSeries } from '@/components/charts/TrendChart'
import {
  axisProps,
  CHART_MARGIN,
  gridProps,
  lineStyle,
  valueAxisProps,
} from '@/components/charts/chart-theme'
import { CountrySelector } from '@/components/common/CountrySelector'
import { DeltaIndicator } from '@/components/common/DeltaIndicator'
import { ExportMenu } from '@/components/common/ExportMenu'
import { Flag } from '@/components/common/Flag'
import { InsightCard } from '@/components/common/InsightCard'
import { MetricSelector } from '@/components/common/MetricSelector'
import { ScopeSelector } from '@/components/common/ScopeSelector'
import { ErrorState, LoadingSkeleton } from '@/components/common/states'
import { chartVar } from '@/design/palette'
import type { FindexRepository } from '@/data/repository'
import { useDataset } from '@/hooks/useDataset'
import { useFilters } from '@/hooks/useFilters'
import { useReferenceData } from '@/hooks/useReferenceData'
import { scopeParamValue, scopeToFilters } from '@/features/overview/overview.logic'
import { describeCorrelation } from '@/lib/analytics/stats'
import { formatDecimal, formatPercent, formatPP, MISSING_GLYPH } from '@/lib/format'
import { trendInsights } from '@/lib/insights/trends'
import { cn } from '@/lib/utils'
import {
  buildTrends,
  DEFAULT_TREND_METRIC,
  trendMetrics,
  type EconomyChange,
  type TrendModel,
} from './trends.logic'

export default function TrendsPage() {
  const { repo, status, error, retry } = useDataset()
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Analyze' }, { label: 'Trends' }]}
        title="Trends over time"
        description="How financial inclusion changed across the Findex survey waves from 2011 to 2024 — for the world, regions and individual economies. Observed survey values only; nothing is interpolated between waves."
        actions={<ExportMenu />}
      />
      {status === 'error' && (
        <ErrorState
          title="The dataset could not be loaded."
          description={error ?? undefined}
          onRetry={() => void retry()}
        />
      )}
      {!repo && status !== 'error' && <LoadingSkeleton variant="chart" />}
      {repo && <TrendsView repo={repo} />}
    </div>
  )
}

const valueFmt = (m: TrendModel) => (v: number | null) =>
  m.metric.unit === 'pp' ? formatPP(v) : formatPercent(v)

function TrendsView({ repo }: { repo: FindexRepository }) {
  const navigate = useNavigate()
  const { filters, setFilters } = useFilters()
  const [params, setParams] = useSearchParams()
  const { countries } = useReferenceData()
  const fromParam = Number(params.get('from')) || null
  const toParam = Number(params.get('to')) || null

  const model = useMemo(
    () =>
      buildTrends(repo, {
        metric: filters.metric,
        region: filters.region,
        income: filters.income,
        from: fromParam,
        to: toParam,
      }),
    [repo, filters.metric, filters.region, filters.income, fromParam, toParam],
  )
  const insights = useMemo(() => trendInsights(model), [model])
  const fmt = valueFmt(model)

  const setPeriod = (from: number, to: number) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        n.set('from', String(from))
        n.set('to', String(to))
        return n
      },
      { replace: true },
    )

  const focus = filters.country ? repo.entity(filters.country) : undefined
  const waves = repo.waves

  return (
    <>
      <div
        role="group"
        aria-label="Trend options"
        className="z-30 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:sticky lg:top-16 lg:-mx-8 lg:px-8 print:static"
      >
        <MetricSelector
          indicators={trendMetrics(repo)}
          value={model.metric.id}
          onChange={(m) => setFilters({ metric: m === DEFAULT_TREND_METRIC ? null : m })}
          label="Indicator"
          className="w-full sm:w-64"
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
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <WaveSelect
            label="From"
            value={model.from}
            options={waves.filter((w) => w < model.to)}
            onChange={(w) => setPeriod(w, model.to)}
          />
          <span aria-hidden>→</span>
          <WaveSelect
            label="To"
            value={model.to}
            options={waves.filter((w) => w > model.from)}
            onChange={(w) => setPeriod(model.from, w)}
          />
        </div>
        <CountrySelector
          options={countries}
          value={filters.country}
          onChange={(c) => setFilters({ country: c })}
          placeholder="Add an economy"
          className="w-full sm:w-48"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          label={`${model.from} · ${model.source.label}`}
          value={model.headline.from}
          unit={model.metric.unit === 'pp' ? 'pp' : '%'}
          note={model.metric.shortLabel}
          missingNote={`No ${model.from} aggregate published`}
        />
        <KPICard
          label={`${model.to} · ${model.source.label}`}
          value={model.headline.to}
          unit={model.metric.unit === 'pp' ? 'pp' : '%'}
          delta={model.headline.delta}
          comparisonLabel={`vs ${model.from}`}
          higherIsBetter={model.metric.higherIsBetter}
          note={model.fallback ? 'World figure not published' : model.metric.shortLabel}
          missingNote={`No ${model.to} aggregate published`}
        />
        <KPICard
          label="Average change per year"
          value={model.headline.perYear}
          unit="pp"
          note={`${model.from}–${model.to}, straight-line average between the two surveys`}
          missingNote="Needs both waves"
        />
        <KPICard
          label={`Economies measured in both waves`}
          value={model.counts.compared}
          unit="count"
          note={`${model.counts.up} rose · ${model.counts.down} fell · ${model.counts.flat} within 1 pp`}
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <RegionLines model={model} focus={focus} repo={repo} className="xl:col-span-8" />
        <Card className="p-5 xl:col-span-4">
          <h2 className="mb-3 text-[15px] font-semibold">What changed</h2>
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
            {!insights.length && (
              <p className="text-sm text-muted-foreground">Not enough data for this selection.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Distribution model={model} />
        <Convergence model={model} onSelect={(slug) => navigate(`/country/${slug}`)} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <MoverList model={model} kind="up" fmt={fmt} />
        <MoverList model={model} kind="down" fmt={fmt} />
      </div>

      <PeriodTable model={model} />
    </>
  )
}

function WaveSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: number
  options: number[]
  onChange: (w: number) => void
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger size="sm" className="w-24" aria-label={`${label} wave`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((w) => (
          <SelectItem key={w} value={String(w)}>
            {w}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function RegionLines({
  model,
  focus,
  repo,
  className,
}: {
  model: TrendModel
  focus: ReturnType<FindexRepository['entity']>
  repo: FindexRepository
  className?: string
}) {
  // Colour follows the line (global first, then regions in dataset order); never cycled.
  const series: TrendSeries[] = model.lines.map((l, i) => ({
    id: l.id,
    label: l.label,
    color: chartVar(i),
    points: l.points,
    dim: !l.selected,
  }))
  if (focus) {
    series.push({
      id: `country-${focus.code}`,
      label: focus.shortName,
      color: 'var(--foreground)',
      points: repo.waves.map((w) => ({
        wave: w,
        value: repo.value(model.metric.id, focus.code, w),
      })),
    })
  }
  const vals = series
    .flatMap((s) => s.points.map((p) => p.value))
    .filter((v): v is number => v !== null)
  const pp = model.metric.unit === 'pp'
  const domain: [number, number] | undefined = pp
    ? [Math.floor(Math.min(0, ...vals) / 10) * 10, Math.ceil(Math.max(10, ...vals) / 10) * 10]
    : undefined
  return (
    <ChartCard
      className={className}
      title={`${model.metric.shortLabel} by region`}
      description={`Published aggregates in every survey wave. ${model.source.label} is emphasized${focus ? `; ${focus.shortName} is shown in black` : ''}. Gaps mean the value was not published for that wave.`}
      sourceYear={`${repo.waves[0]}–${repo.waves.at(-1)}`}
      footnote={
        model.fallback
          ? 'World figure not published for this indicator; developing-economies aggregate shown.'
          : undefined
      }
      table={{
        caption: `${model.metric.shortLabel} by region and wave`,
        columns: ['Series', ...repo.waves.map(String)],
        rows: series.map((s) => [
          s.label,
          ...s.points.map((p) => (pp ? formatPP(p.value) : formatPercent(p.value))),
        ]),
      }}
    >
      <TrendChart
        series={series}
        waves={repo.waves}
        unit={pp ? 'pp' : '%'}
        height={340}
        highlightWave={model.to}
        {...(domain ? { yDomain: domain } : {})}
      />
      <SeriesLegend items={series.map((s) => ({ label: s.label, color: s.color, muted: s.dim }))} />
    </ChartCard>
  )
}

function Distribution({ model }: { model: TrendModel }) {
  const pp = model.metric.unit === 'pp'
  const data = model.distribution.map((d, i) => ({
    wave: d.wave,
    n: d.n,
    outer: d.p10 !== null && d.p90 !== null ? [d.p10, d.p90] : null,
    inner: d.p25 !== null && d.p75 !== null ? [d.p25, d.p75] : null,
    median: d.median,
    aggregate: model.aggregate[i]?.value ?? null,
  }))
  const any = model.distribution.some((d) => d.n >= 5)
  const lo = pp
    ? Math.floor(Math.min(0, ...model.distribution.map((d) => d.p10 ?? 0)) / 10) * 10
    : 0
  const hi = pp
    ? Math.ceil(Math.max(10, ...model.distribution.map((d) => d.p90 ?? 0)) / 10) * 10
    : 100
  const fmt = pp ? formatPP : formatPercent
  return (
    <ChartCard
      title="Spread across economies"
      description={`Middle 50% (dark band) and middle 80% (light band) of economies in ${model.scope.label}, with the median economy and the published aggregate. The set of economies surveyed varies by wave.`}
      sourceYear={`${model.distribution[0]?.wave}–${model.distribution.at(-1)?.wave}`}
      status={any ? 'ready' : 'empty'}
      emptyMessage="Too few economies with values to show a spread."
      table={{
        caption: 'Distribution by wave',
        columns: ['Wave', 'Economies', '10th pct', '25th pct', 'Median', '75th pct', '90th pct'],
        rows: model.distribution.map((d) => [
          String(d.wave),
          String(d.n),
          fmt(d.p10),
          fmt(d.p25),
          fmt(d.median),
          fmt(d.p75),
          fmt(d.p90),
        ]),
      }}
    >
      <div className="h-72">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ ...CHART_MARGIN, right: 16 }}>
            <CartesianGrid {...gridProps} />
            <XAxis
              dataKey="wave"
              type="number"
              domain={[data[0]!.wave, data.at(-1)!.wave]}
              ticks={data.map((d) => d.wave)}
              {...axisProps}
              padding={{ left: 8, right: 8 }}
            />
            <YAxis
              {...valueAxisProps}
              domain={[lo, hi]}
              tickFormatter={(v: number) => (pp ? `${v}` : `${v}%`)}
            />
            <Tooltip content={<DistTooltip pp={pp} />} cursor={{ stroke: 'var(--chart-axis)' }} />
            <Area
              dataKey="outer"
              stroke="none"
              fill="var(--chart-1)"
              fillOpacity={0.12}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Area
              dataKey="inner"
              stroke="none"
              fill="var(--chart-1)"
              fillOpacity={0.26}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line dataKey="median" name="Median economy" {...lineStyle('var(--chart-1)')} />
            <Line
              dataKey="aggregate"
              name={model.source.label}
              {...lineStyle('var(--foreground)')}
              strokeWidth={1.5}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <SeriesLegend
        items={[
          { label: 'Median economy', color: 'var(--chart-1)' },
          { label: `${model.source.label} (aggregate)`, color: 'var(--foreground)' },
        ]}
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Aggregates are population-weighted by the World Bank, so they can differ from the median
        economy.
      </p>
    </ChartCard>
  )
}

function DistTooltip({
  active,
  payload,
  pp,
}: {
  active?: boolean
  payload?: { payload: Record<string, unknown> }[]
  pp: boolean
}) {
  const d = payload?.[0]?.payload as
    | {
        wave: number
        n: number
        outer: [number, number] | null
        inner: [number, number] | null
        median: number | null
        aggregate: number | null
      }
    | undefined
  if (!active || !d) return null
  const f = pp ? formatPP : formatPercent
  return (
    <div className="glass min-w-48 rounded-xl border px-3 py-2.5 text-xs shadow-overlay">
      <p className="mb-1.5 font-semibold">
        {d.wave} · {d.n} economies
      </p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-muted-foreground">
        <dt>Middle 80%</dt>
        <dd className="text-right text-foreground tabular">
          {d.outer ? `${f(d.outer[0])} – ${f(d.outer[1])}` : MISSING_GLYPH}
        </dd>
        <dt>Middle 50%</dt>
        <dd className="text-right text-foreground tabular">
          {d.inner ? `${f(d.inner[0])} – ${f(d.inner[1])}` : MISSING_GLYPH}
        </dd>
        <dt>Median</dt>
        <dd className="text-right font-semibold text-foreground tabular">{f(d.median)}</dd>
        <dt>Aggregate</dt>
        <dd className="text-right text-foreground tabular">{f(d.aggregate)}</dd>
      </dl>
    </div>
  )
}

function Convergence({ model, onSelect }: { model: TrendModel; onSelect: (slug: string) => void }) {
  const pts = model.convergence.points
  const ys = pts.map((p) => p.y)
  const yDomain: [number, number] = [
    Math.floor(Math.min(0, ...ys) / 10) * 10,
    Math.ceil(Math.max(10, ...ys) / 10) * 10,
  ]
  const r = model.convergence.r
  const pp = model.metric.unit === 'pp'
  const xs = pts.map((p) => p.x)
  const xDomain: [number, number] = pp
    ? [Math.floor(Math.min(0, ...xs) / 10) * 10, Math.ceil(Math.max(10, ...xs) / 10) * 10]
    : [0, 100]
  return (
    <ChartCard
      title="Catching up?"
      description={`Each dot is an economy: its ${model.from} level (across) and its change to ${model.to} (up). A downward slope means economies that started lower gained more.`}
      sourceYear={`${model.from}–${model.to}`}
      status={pts.length >= 3 ? 'ready' : 'empty'}
      emptyMessage="Too few economies measured in both waves."
      footnote={
        r !== null
          ? `${describeCorrelation(r)} (r = ${formatDecimal(r, 2)}, n = ${pts.length}). Economies near 100% have little room to rise, so part of any catch-up is mechanical.`
          : pts.length
            ? 'Fewer than 10 economies — no correlation reported.'
            : undefined
      }
      table={{
        caption: 'Starting level and change by economy',
        columns: ['Economy', `${model.from}`, `Change to ${model.to}`],
        rows: pts.map((p) => [
          p.entity.shortName,
          pp ? formatPP(p.x) : formatPercent(p.x),
          formatPP(p.y),
        ]),
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
        xLabel={`${model.metric.shortLabel}, ${model.from}`}
        yLabel={`Change ${model.from}–${model.to}`}
        xDomain={xDomain}
        xUnit={pp ? 'pp' : '%'}
        yDomain={yDomain}
        yUnit="pp"
        fit={model.convergence.fit}
        onSelect={(p) => {
          const e = pts.find((x) => x.entity.code === p.id)?.entity
          if (e) onSelect(e.slug)
        }}
      />
    </ChartCard>
  )
}

function MoverList({
  model,
  kind,
  fmt,
}: {
  model: TrendModel
  kind: 'up' | 'down'
  fmt: (v: number | null) => string
}) {
  const items: EconomyChange[] = kind === 'up' ? model.improvers : model.decliners
  const max = Math.max(1, ...items.map((c) => Math.abs(c.delta)))
  return (
    <ChartCard
      title={kind === 'up' ? 'Largest increases' : 'Largest decreases'}
      description={`${model.metric.shortLabel}, ${model.from} → ${model.to}. Same economy in both waves; per-year rates use actual survey years.`}
      sourceYear={`${model.from}–${model.to}`}
      status={items.length ? 'ready' : 'empty'}
      emptyMessage={
        kind === 'up'
          ? 'No economy rose by 1 point or more.'
          : 'No economy fell by 1 point or more.'
      }
      table={{
        caption: kind === 'up' ? 'Largest increases' : 'Largest decreases',
        columns: ['Economy', `${model.from}`, `${model.to}`, 'Change', 'Per year'],
        rows: items.map((c) => [
          c.entity.shortName,
          fmt(c.from),
          fmt(c.to),
          formatPP(c.delta),
          formatPP(c.perYear),
        ]),
      }}
    >
      <ol className="space-y-2">
        {items.map((c) => (
          <li key={c.entity.code}>
            <Link
              to={`/country/${c.entity.slug}`}
              className="group block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="flex min-w-0 items-center gap-2 font-medium group-hover:text-primary">
                  <Flag iso2={c.entity.iso2} code={c.entity.code} className="h-3.5 w-5 shrink-0" />
                  <span className="truncate">{c.entity.shortName}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular">
                  {fmt(c.from)} → {fmt(c.to)}{' '}
                  <span className="ml-1 font-semibold text-foreground">{formatPP(c.delta)}</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(Math.abs(c.delta) / max) * 100}%`,
                    background: kind === 'up' ? 'var(--chart-1)' : 'var(--chart-2)',
                  }}
                />
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </ChartCard>
  )
}

function PeriodTable({ model }: { model: TrendModel }) {
  const { pairs, rows } = model.periods
  return (
    <ChartCard
      title="Change between consecutive surveys"
      description={`${model.metric.shortLabel}: percentage-point change in each published aggregate between one survey wave and the next.`}
      sourceYear={`${pairs[0]?.[0]}–${pairs.at(-1)?.[1]}`}
      contentClassName="px-0 py-0"
    >
      <Table>
        <caption className="sr-only">Change between consecutive survey waves</caption>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5">Aggregate</TableHead>
            {pairs.map(([a, b]) => (
              <TableHead key={`${a}-${b}`} className="text-right last:pr-5">
                {a}–{String(b).slice(2)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className={cn(r.selected && 'bg-muted/50')}>
              <TableCell className={cn('pl-5', r.selected ? 'font-semibold' : 'font-medium')}>
                {r.label}
              </TableCell>
              {r.cells.map((v, i) => (
                <TableCell key={i} className="text-right last:pr-5">
                  {v === null ? (
                    <span className="text-muted-foreground">{MISSING_GLYPH}</span>
                  ) : (
                    <DeltaIndicator
                      delta={v}
                      higherIsBetter={model.metric.higherIsBetter}
                      comparisonLabel={`${pairs[i]![0]} to ${pairs[i]![1]}`}
                    />
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ChartCard>
  )
}
