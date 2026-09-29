import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  ArrowRight,
  Landmark,
  PiggyBank,
  RotateCcw,
  Smartphone,
  UserRoundX,
  Users,
  Venus,
  Wallet,
  HandCoins,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/layout/PageHeader'
import { ScopeSelector } from '@/components/common/ScopeSelector'
import { MetricSelector } from '@/components/common/MetricSelector'
import { YearSelector } from '@/components/common/YearSelector'
import { InsightCard } from '@/components/common/InsightCard'
import { Flag } from '@/components/common/Flag'
import { DeltaIndicator } from '@/components/common/DeltaIndicator'
import { ErrorState, LoadingSkeleton } from '@/components/common/states'
import { KPICard } from '@/components/charts/KPICard'
import { ChartCard } from '@/components/charts/ChartCard'
import { BarList } from '@/components/charts/BarList'
import { TrendChart, SeriesLegend } from '@/components/charts/TrendChart'
import { DumbbellChart } from '@/components/charts/DumbbellChart'
import { ScatterPlot } from '@/components/charts/ScatterPlot'
import { Sparkline } from '@/components/charts/Sparkline'
import { chartVar } from '@/design/palette'
import { useDataset } from '@/hooks/useDataset'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { WorldMap } from '@/components/map/WorldMap'
import { MapLegend } from '@/components/map/MapLegend'
import { buildMapModel } from '@/features/map/map.logic'
import { MapTooltipContent } from '@/features/map/MapTooltipContent'
import { useFilters } from '@/hooks/useFilters'
import type { FindexRepository } from '@/data/repository'
import { describeCorrelation, MIN_CORRELATION_N } from '@/lib/analytics/stats'
import { formatDecimal, formatPercent, formatPP, MISSING_GLYPH } from '@/lib/format'
import { compactPeople } from '@/lib/insights/text'
import {
  buildOverview,
  DEFAULT_METRIC,
  overviewMetrics,
  scopeParamValue,
  scopeToFilters,
  type OverviewModel,
} from './overview.logic'

const KPI_ICONS: Record<string, React.ReactNode> = {
  accountOwnership: <Landmark />,
  noAccount: <UserRoundX />,
  mobileMoneyAccount: <Smartphone />,
  digitalPayments: <Wallet />,
  formalSavings: <PiggyBank />,
  formalBorrowing: <HandCoins />,
  women: <Venus />,
  genderGapAccount: <Users />,
}

export default function OverviewPage() {
  const { status, repo, error, retry, revision } = useDataset()
  const { filters, setFilters } = useFilters()
  // `revision` changes when lazily loaded data arrives, so the model recomputes.
  const model = useMemo(
    () => (repo && revision >= 0 ? buildOverview(repo, filters) : null),
    [repo, filters, revision],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="FinLens · Global Findex"
        title="Global Financial Inclusion Overview"
        description="Explore how people around the world access, use, save, borrow, and interact with financial services."
      />
      {status === 'error' && (
        <ErrorState
          title="The dataset could not be loaded."
          description={error ?? undefined}
          onRetry={() => void retry()}
        />
      )}
      {!model && status !== 'error' && <OverviewSkeleton />}
      {model && repo && (
        <>
          <FilterBar
            repo={repo}
            model={model}
            setFilters={setFilters}
            hasFilters={Object.keys(filters).length > 0}
          />
          <Dashboard repo={repo} model={model} />
        </>
      )}
    </div>
  )
}

function FilterBar({
  repo,
  model,
  setFilters,
  hasFilters,
}: {
  repo: FindexRepository
  model: OverviewModel
  setFilters: ReturnType<typeof useFilters>['setFilters']
  hasFilters: boolean
}) {
  const latest = repo.latestWave
  return (
    <div
      role="group"
      aria-label="Dashboard filters"
      className="sticky top-16 z-30 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 print:static"
    >
      <YearSelector
        years={repo.waves}
        value={model.wave}
        onChange={(y) => setFilters({ year: y === latest ? null : y })}
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
      <MetricSelector
        indicators={overviewMetrics(repo)}
        value={model.metric.id}
        onChange={(m) => setFilters({ metric: m === DEFAULT_METRIC ? null : m })}
      />
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFilters({ year: null, region: null, income: null, metric: null })}
        >
          <RotateCcw /> Reset
        </Button>
      )}
      <p className="ml-auto hidden text-xs text-muted-foreground xl:block">
        Showing <span className="font-medium text-foreground">{model.scope.label}</span> ·{' '}
        {model.wave} survey wave
      </p>
    </div>
  )
}

function Dashboard({ repo, model }: { repo: FindexRepository; model: OverviewModel }) {
  const navigate = useNavigate()
  const { metric, wave, scope } = model
  const fmt = (v: number | null) => (metric.unit === 'pp' ? formatPP(v) : formatPercent(v))
  const [side, setSide] = useState<'map' | 'top' | 'bottom'>('map')
  const small = useMediaQuery('(max-width: 639px)')
  const mapModel = useMemo(() => buildMapModel(repo, metric.id, wave), [repo, metric.id, wave])
  const scopeCodes = useMemo(
    () => new Set(model.distribution.ranked.map((r) => r.entity.code)),
    [model.distribution.ranked],
  )
  const ranked = model.distribution.ranked
  const shown = side === 'top' ? ranked.slice(0, 10) : ranked.slice(-10).reverse()
  const regionMax = metric.unit === '%' ? 100 : undefined

  return (
    <div className="space-y-6">
      {/* Row 1 — KPIs */}
      <section aria-label="Key indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {model.kpis.map(({ spec, kpi }) => {
          const key = spec.group === 'women' ? 'women' : spec.id
          const isUnbanked = spec.id === 'noAccount'
          return (
            <KPICard
              key={`${spec.id}-${spec.group ?? 'all'}`}
              label={spec.label ?? kpi.indicator.shortLabel}
              icon={KPI_ICONS[key]}
              value={kpi.value}
              unit={kpi.indicator.unit === 'pp' ? 'pp' : '%'}
              delta={kpi.delta}
              higherIsBetter={kpi.indicator.higherIsBetter}
              comparisonLabel={kpi.previous ? `vs ${kpi.previous.wave}` : undefined}
              series={kpi.series.map((p) => ({ year: p.wave, value: p.value }))}
              description={kpi.indicator.definition}
              missingNote={
                kpi.value === null
                  ? scope.kind === 'income' && scope.incomeGroupId === 'HIC'
                    ? 'Not collected in high-income economies in the 2025 edition.'
                    : `Not published for ${kpi.source.label} in ${wave}.`
                  : undefined
              }
              note={
                <>
                  {kpi.fallback && (
                    <span className="font-medium text-warning">{kpi.source.label} · </span>
                  )}
                  {isUnbanked && model.unbanked ? (
                    <>≈ {compactPeople(model.unbanked.total)} adults · FinLens estimate</>
                  ) : kpi.fallback ? (
                    'world aggregate not published'
                  ) : (
                    `${kpi.source.label}, ${wave}`
                  )}
                </>
              }
            />
          )
        })}
      </section>

      {/* Row 2 — distribution + insights */}
      <div className="grid gap-6 xl:grid-cols-12">
        <ChartCard
          className="xl:col-span-7"
          title={`${metric.shortLabel} across economies`}
          description={`${model.distribution.ranked.length} of ${model.distribution.economies} economies in ${scope.label} with ${wave} data`}
          sourceYear={wave}
          status={ranked.length ? 'ready' : 'empty'}
          contentClassName="px-3 sm:px-4"
          actions={
            <Tabs
              panels={false}
              value={side}
              onValueChange={(v) => setSide(v as 'map' | 'top' | 'bottom')}
            >
              <TabsList className="h-8">
                <TabsTrigger value="map" className="text-xs">
                  Map
                </TabsTrigger>
                <TabsTrigger value="top" className="text-xs">
                  Highest
                </TabsTrigger>
                <TabsTrigger value="bottom" className="text-xs">
                  Lowest
                </TabsTrigger>
              </TabsList>
            </Tabs>
          }
          table={{
            caption: `${metric.label}, ${wave}, all economies in ${scope.label}`,
            columns: ['Rank', 'Economy', metric.shortLabel],
            rows: ranked.map((r) => [r.rank, r.entity.shortName, fmt(r.value)]),
          }}
        >
          {side === 'map' ? (
            <WorldMap
              values={mapModel.values}
              scale={mapModel.scale}
              focusCodes={scope.kind === 'world' ? undefined : scopeCodes}
              height={small ? 300 : 420}
              ariaLabel={`World map of ${metric.label}, ${wave}. Use the table view for exact values.`}
              onSelect={(code) => {
                const e = repo.entity(code)
                if (e?.kind === 'economy') navigate(`/country/${e.slug}`)
              }}
              renderTooltip={(code, name) => (
                <MapTooltipContent repo={repo} model={mapModel} code={code} name={name} />
              )}
              overlay={
                <MapLegend
                  className="absolute bottom-2 left-2 z-10 hidden sm:block"
                  scale={mapModel.scale}
                  unit={metric.unit}
                  title={metric.shortLabel}
                />
              }
            />
          ) : (
            <BarList
              ariaLabel={`${side === 'top' ? 'Highest' : 'Lowest'} ${metric.shortLabel}`}
              max={regionMax}
              reference={
                model.distribution.scopeValue !== null
                  ? {
                      label: `${scope.label === 'World' ? model.trend.scopeLabel : scope.label} aggregate: ${fmt(model.distribution.scopeValue)}`,
                      value: model.distribution.scopeValue,
                    }
                  : undefined
              }
              items={shown.map((r) => ({
                key: r.entity.code,
                label: r.entity.shortName,
                sublabel: `#${r.rank}`,
                value: Math.max(0, r.value),
                display: fmt(r.value),
                href: `/country/${r.entity.slug}`,
                leading: <Flag iso2={r.entity.iso2} code={r.entity.code} />,
              }))}
            />
          )}
        </ChartCard>

        <Card className="p-5 xl:col-span-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Key insights · {scope.label}</h2>
            <Link to="/story" className="text-xs font-medium text-primary hover:underline">
              Data story
            </Link>
          </div>
          <div className="space-y-3">
            {model.insights.slice(0, 4).map((i) => (
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
            {model.insights.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No insights available for this selection.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Row 3 — regional comparison + trend */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title={`${metric.shortLabel} by region`}
          description={`Findex regional aggregates, ${wave}. Regions exclude high-income economies.`}
          sourceYear={wave}
          status={model.regions.some((r) => r.value !== null) ? 'ready' : 'empty'}
          table={{
            caption: `${metric.label} by region, ${wave}`,
            columns: ['Region', metric.shortLabel],
            rows: model.regions.map((r) => [r.name, fmt(r.value)]),
          }}
        >
          <BarList
            ariaLabel={`${metric.shortLabel} by region`}
            max={regionMax}
            emphasis={model.regions.some((r) => r.highlight)}
            reference={model.worldRef ?? undefined}
            items={[...model.regions]
              .sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
              .map((r) => ({
                key: r.id,
                label: r.name,
                value: Math.max(0, r.value ?? 0),
                display: r.value === null ? MISSING_GLYPH : fmt(r.value),
                href: `/region/${r.slug}`,
                highlight: r.highlight,
              }))}
          />
        </ChartCard>

        <ChartCard
          title={`${metric.shortLabel} over time`}
          description={`${model.trend.scopeLabel}${model.trend.contextLabel ? ` compared with ${model.trend.contextLabel}` : ''}, survey waves ${model.waves[0]}–${model.waves[model.waves.length - 1]}`}
          status={model.trend.scope.some((p) => p.value !== null) ? 'ready' : 'empty'}
          table={{
            caption: `${metric.label} over time`,
            columns: [
              'Wave',
              model.trend.scopeLabel,
              ...(model.trend.contextLabel ? [model.trend.contextLabel] : []),
            ],
            rows: model.waves.map((w, i) => [
              w,
              fmt(model.trend.scope[i]?.value ?? null),
              ...(model.trend.context ? [fmt(model.trend.context[i]?.value ?? null)] : []),
            ]),
          }}
        >
          <TrendChart
            unit={metric.unit === 'pp' ? 'pp' : '%'}
            waves={model.waves}
            highlightWave={wave}
            series={[
              {
                id: 'scope',
                label: model.trend.scopeLabel,
                color: chartVar(0),
                points: model.trend.scope,
              },
              ...(model.trend.context
                ? [
                    {
                      id: 'context',
                      label: model.trend.contextLabel!,
                      color: 'var(--neutral)',
                      points: model.trend.context,
                      muted: true,
                    },
                  ]
                : []),
            ]}
          />
          <SeriesLegend
            items={[
              { label: model.trend.scopeLabel, color: chartVar(0) },
              ...(model.trend.contextLabel
                ? [{ label: model.trend.contextLabel, color: 'var(--neutral)', muted: true }]
                : []),
            ]}
          />
        </ChartCard>
      </div>

      {/* Row 4 — digital finance + gender gap */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Digital finance adoption"
          description={`${model.digital.source.label}: accounts, mobile money and digital payments`}
          footnote={
            model.digital.source.code !== scope.code
              ? 'World usage aggregate not published'
              : undefined
          }
          table={{
            caption: 'Digital finance adoption over time',
            columns: ['Wave', 'Any account', 'Mobile money account', 'Digital payment'],
            rows: model.waves.map((w, i) => [
              w,
              formatPercent(model.digital.account[i]?.value ?? null),
              formatPercent(model.digital.mobile[i]?.value ?? null),
              formatPercent(model.digital.payments[i]?.value ?? null),
            ]),
          }}
        >
          <TrendChart
            waves={model.waves}
            highlightWave={wave}
            series={[
              {
                id: 'account',
                label: 'Any account',
                color: chartVar(0),
                points: model.digital.account,
              },
              {
                id: 'payments',
                label: 'Made or received a digital payment',
                color: chartVar(1),
                points: model.digital.payments,
              },
              {
                id: 'mobile',
                label: 'Mobile money account',
                color: chartVar(2),
                points: model.digital.mobile,
              },
            ]}
          />
          <SeriesLegend
            items={[
              { label: 'Any account', color: chartVar(0) },
              { label: 'Digital payment', color: chartVar(1) },
              { label: 'Mobile money account', color: chartVar(2) },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="Gender gap in account ownership"
          description={`Women vs men with an account, ${wave}`}
          sourceYear={wave}
          status={model.gender.some((g) => g.women !== null) ? 'ready' : 'empty'}
          table={{
            caption: `Account ownership by sex, ${wave}`,
            columns: ['Group', 'Women', 'Men', 'Gap (pp)'],
            rows: model.gender.map((g) => [
              g.label,
              formatPercent(g.women),
              formatPercent(g.men),
              g.women !== null && g.men !== null
                ? formatDecimal(g.men - g.women, 1)
                : MISSING_GLYPH,
            ]),
          }}
        >
          <DumbbellChart
            aLabel="Women"
            bLabel="Men"
            rows={model.gender.map((g) => ({
              key: g.key,
              label: g.label,
              a: g.women,
              b: g.men,
              href: g.href,
            }))}
          />
        </ChartCard>
      </div>

      {/* Row 5 — correlation preview */}
      <ChartCard
        title="Is mobile money associated with higher account ownership?"
        description={`Each dot is an economy, ${wave}. ${scope.kind === 'world' ? '' : `${scope.label} highlighted; the trend line uses highlighted economies.`}`}
        sourceYear={wave}
        status={model.scatter.points.length >= 3 ? 'ready' : 'empty'}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/correlation">
              Explore <ArrowRight />
            </Link>
          </Button>
        }
        footnote="Correlation does not imply causation."
        table={{
          caption: `Mobile money and account ownership by economy, ${wave}`,
          columns: ['Economy', 'Mobile money account', 'Account ownership'],
          rows: model.scatter.points.map((p) => [
            p.entity.shortName,
            formatPercent(p.x),
            formatPercent(p.y),
          ]),
        }}
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <ScatterPlot
            xLabel="Mobile money account"
            yLabel="Account ownership"
            fit={model.scatter.fit}
            points={model.scatter.points.map((p) => ({
              id: p.entity.code,
              label: p.entity.shortName,
              x: p.x,
              y: p.y,
              highlight: scope.kind === 'world' || p.inScope,
            }))}
            onSelect={(p) => navigate(`/country/${repo.entity(p.id)?.slug}`)}
          />
          <div className="space-y-3 self-center">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Pearson correlation
            </p>
            <p className="text-4xl font-semibold tracking-tight tabular">
              {model.scatter.r === null ? MISSING_GLYPH : formatDecimal(model.scatter.r, 2)}
            </p>
            {model.scatter.r !== null && (
              <p className="text-sm font-medium">{describeCorrelation(model.scatter.r)}</p>
            )}
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {model.scatter.r === null
                ? `Too few economies (${model.scatter.n}) for a reliable cross-country correlation — at least ${MIN_CORRELATION_N} are needed.`
                : `Across ${model.scatter.n} economies with both values. Many economies reach high account ownership through banks rather than mobile money, so the relationship is not one-to-one.`}
            </p>
          </div>
        </div>
      </ChartCard>

      {/* Row 6 — countries to explore */}
      {model.movers.length > 0 && (
        <section aria-labelledby="explore-h" className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 id="explore-h" className="text-lg font-semibold tracking-tight">
                Countries to explore
              </h2>
              <p className="text-sm text-muted-foreground">
                Largest gains in{' '}
                {(
                  repo.indicator(
                    metric.unit === '%' && metric.higherIsBetter !== false
                      ? metric.id
                      : 'accountOwnership',
                  ) ?? metric
                ).shortLabel.toLowerCase()}{' '}
                since each economy’s previous survey, {scope.label}.
              </p>
            </div>
            <Link
              to="/countries"
              className="shrink-0 text-sm font-medium text-primary hover:underline"
            >
              All countries
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {model.movers.map((m) => (
              <Link
                key={m.entity.code}
                to={`/country/${m.entity.slug}`}
                className="group rounded-2xl border bg-card p-4 shadow-card transition-shadow outline-none hover:shadow-raised focus-visible:ring-[3px] focus-visible:ring-ring/40"
              >
                <div className="flex items-center gap-3">
                  <Flag iso2={m.entity.iso2} code={m.entity.code} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{m.entity.shortName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {repo.region(m.entity.regionId ?? '')?.name}
                    </p>
                  </div>
                  <ArrowRight
                    className="size-4 text-subtle-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-2xl font-semibold tracking-tight tabular">
                      {formatPercent(m.value)}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <DeltaIndicator delta={m.delta} comparisonLabel={`vs ${m.previous.wave}`} />
                      <span className="text-xs text-muted-foreground">vs {m.previous.wave}</span>
                    </div>
                  </div>
                  <Sparkline
                    width={96}
                    height={32}
                    data={repo
                      .series(
                        metric.unit === '%' && metric.higherIsBetter !== false
                          ? metric.id
                          : 'accountOwnership',
                        m.entity.code,
                      )
                      .map((p) => ({ year: p.wave, value: p.value }))}
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Row 7 — more insights */}
      {model.insights.length > 4 && (
        <section aria-labelledby="more-insights-h" className="space-y-3">
          <h2 id="more-insights-h" className="text-lg font-semibold tracking-tight">
            More insights
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {model.insights.slice(4).map((i) => (
              <InsightCard
                key={i.id}
                tone={i.tone}
                title={i.title}
                evidence={i.evidence}
                onOpen={i.link ? () => navigate(i.link!) : undefined}
              >
                {i.detail}
              </InsightCard>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Card key={i} className="p-5">
            <LoadingSkeleton variant="kpi" />
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-12">
        <Card className="p-5 xl:col-span-7">
          <LoadingSkeleton variant="chart" />
        </Card>
        <Card className="p-5 xl:col-span-5">
          <LoadingSkeleton variant="text" rows={6} />
        </Card>
      </div>
    </div>
  )
}
