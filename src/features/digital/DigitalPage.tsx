import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'
import { BarList } from '@/components/charts/BarList'
import { ChartCard } from '@/components/charts/ChartCard'
import { KPICard } from '@/components/charts/KPICard'
import { ScatterPlot } from '@/components/charts/ScatterPlot'
import { SeriesLegend, TrendChart } from '@/components/charts/TrendChart'
import { ExportMenu } from '@/components/common/ExportMenu'
import { Flag } from '@/components/common/Flag'
import { InsightCard } from '@/components/common/InsightCard'
import { ScopeSelector } from '@/components/common/ScopeSelector'
import { YearSelector } from '@/components/common/YearSelector'
import { ErrorState, LoadingSkeleton } from '@/components/common/states'
import { chartVar } from '@/design/palette'
import type { FindexRepository } from '@/data/repository'
import { useDataset } from '@/hooks/useDataset'
import { useFilters } from '@/hooks/useFilters'
import { scopeParamValue, scopeToFilters } from '@/features/overview/overview.logic'
import { describeCorrelation } from '@/lib/analytics/stats'
import { formatDecimal, formatPercent, MISSING_GLYPH } from '@/lib/format'
import { runInsightEngine } from '@/lib/insights/engine'
import { cn } from '@/lib/utils'
import { buildDigital, type DigitalModel } from './digital.logic'

export default function DigitalPage() {
  const { repo, status, error, retry } = useDataset()
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Analyze' }, { label: 'Digital Finance' }]}
        title="Digital finance"
        description="Mobile money, digital payments and cards: how people pay, get paid and join the financial system through digital channels."
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
      {repo && <DigitalView repo={repo} />}
    </div>
  )
}

function DigitalView({ repo }: { repo: FindexRepository }) {
  const navigate = useNavigate()
  const { filters, setFilters } = useFilters()
  const model = useMemo(
    () =>
      buildDigital(repo, { wave: filters.year, region: filters.region, income: filters.income }),
    [repo, filters.year, filters.region, filters.income],
  )
  const insights = useMemo(
    () =>
      runInsightEngine({ repo, wave: model.wave, groupsReady: false }).filter(
        (i) => i.category === 'digital',
      ),
    [repo, model.wave],
  )

  return (
    <>
      <div
        role="group"
        aria-label="Digital finance filters"
        className="flex flex-wrap items-center gap-2"
      >
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {model.kpis.map((k) => (
          <KPICard
            key={k.indicator.id}
            label={k.indicator.shortLabel}
            value={k.value.value}
            delta={
              k.value.value !== null && k.previous
                ? Math.round((k.value.value - k.previous.value) * 100) / 100
                : null
            }
            comparisonLabel={k.previous ? `vs ${k.previous.wave}` : undefined}
            higherIsBetter={k.indicator.higherIsBetter}
            description={k.indicator.definition}
            note={
              k.value.fallback
                ? `${k.value.source.label} · World not published`
                : k.value.source.label
            }
            missingNote={`Not published for ${model.scope.label} in ${model.wave}`}
          />
        ))}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <Pathways model={model} className="xl:col-span-7" />
        <Card className="p-5 xl:col-span-5">
          <h2 className="mb-3 text-[15px] font-semibold">What the data shows</h2>
          <div className="space-y-3">
            {insights.map((i) => (
              <InsightCard
                key={i.key}
                tone={i.tone}
                title={i.title}
                evidence={i.evidence}
                className="shadow-none"
              >
                {i.detail}
              </InsightCard>
            ))}
            {!insights.length && (
              <p className="text-sm text-muted-foreground">
                No digital-finance findings for {model.wave}.
              </p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ChartCard
          title="How people use digital channels"
          description={`Share of adults, ${model.wave} · ${model.scope.label}.`}
          sourceYear={model.wave}
          status={model.channels.some((c) => c.value.value !== null) ? 'ready' : 'empty'}
          emptyMessage="Channel questions are not published for this scope and year."
          footnote={
            model.channels.some((c) => c.value.fallback)
              ? 'World figures are not published for these questions; developing-economies aggregate shown.'
              : undefined
          }
        >
          <BarList
            ariaLabel="Digital channel use"
            max={100}
            items={model.channels
              .filter((c) => c.value.value !== null)
              .sort((a, b) => b.value.value! - a.value.value!)
              .map((c) => ({
                key: c.indicator.id,
                label: c.indicator.shortLabel,
                value: c.value.value!,
                display: formatPercent(c.value.value),
              }))}
          />
        </ChartCard>
        <ChartCard
          title="Digital finance over time"
          description={`Published aggregates, ${model.scope.label}. Mobile money was first measured in 2014.`}
          sourceYear={`${repo.waves[0]}–${repo.waves.at(-1)}`}
          table={{
            caption: 'Digital finance over time',
            columns: ['Indicator', ...repo.waves.map(String)],
            rows: model.trend.map((t) => [
              t.indicator.shortLabel,
              ...t.points.map((p) => formatPercent(p.value)),
            ]),
          }}
        >
          <TrendChart
            waves={repo.waves}
            series={model.trend.map((t, i) => ({
              id: t.indicator.id,
              label: `${t.indicator.shortLabel}${t.source.code !== model.scope.code ? ` (${t.source.label})` : ''}`,
              color: chartVar(i),
              points: t.points,
            }))}
            highlightWave={model.wave}
          />
          <SeriesLegend
            items={model.trend.map((t, i) => ({
              label: `${t.indicator.shortLabel}${t.source.code !== model.scope.code ? ` (${t.source.label})` : ''}`,
              color: chartVar(i),
            }))}
          />
        </ChartCard>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ChartCard
          title="Highest mobile money account ownership"
          description={`${model.scope.label}, ${model.wave}.`}
          sourceYear={model.wave}
          status={model.leaders.length ? 'ready' : 'empty'}
          emptyMessage="Mobile money is not published for this selection."
        >
          <BarList
            ariaLabel="Mobile money leaders"
            max={100}
            items={model.leaders.map((l) => ({
              key: l.entity.code,
              label: l.entity.shortName,
              value: l.value,
              display: formatPercent(l.value),
              href: `/country/${l.entity.slug}`,
              leading: <Flag iso2={l.entity.iso2} code={l.entity.code} className="h-3.5 w-5" />,
            }))}
          />
        </ChartCard>
        <ChartCard
          title="Where mobile money is the main route"
          description={`Adults whose only account is mobile money, ${model.scope.label}, ${model.wave}.`}
          sourceYear={model.wave}
          status={model.mobileOnlyLeaders.length ? 'ready' : 'empty'}
          emptyMessage="Needs both account and financial-institution account values."
        >
          <BarList
            ariaLabel="Mobile money only"
            max={100}
            items={model.mobileOnlyLeaders.map((l) => ({
              key: l.entity.code,
              label: l.entity.shortName,
              sublabel: `of ${formatPercent(l.account)} with any account`,
              value: l.mobileOnly,
              display: formatPercent(l.mobileOnly),
              href: `/country/${l.entity.slug}`,
              leading: <Flag iso2={l.entity.iso2} code={l.entity.code} className="h-3.5 w-5" />,
            }))}
          />
        </ChartCard>
      </div>

      <div className="grid items-start gap-4">
        <ChartCard
          title="Phones and mobile money"
          description="Each dot is an economy: mobile phone ownership (across) and mobile money accounts (up)."
          sourceYear={model.wave}
          status={model.phoneVsMoney.points.length >= 3 ? 'ready' : 'empty'}
          emptyMessage="Too few economies with both values."
          footnote={
            model.phoneVsMoney.r !== null
              ? `${describeCorrelation(model.phoneVsMoney.r)} (r = ${formatDecimal(model.phoneVsMoney.r, 2)}). A phone makes mobile money possible, but many economies with high phone ownership have little mobile money — correlation is not causation.`
              : undefined
          }
        >
          <ScatterPlot
            points={model.phoneVsMoney.points.map((p) => ({
              id: p.entity.code,
              label: p.entity.shortName,
              x: p.x,
              y: p.y,
              highlight: true,
            }))}
            xLabel="Mobile phone ownership"
            yLabel="Mobile money account"
            fit={model.phoneVsMoney.fit}
            onSelect={(p) => {
              const e = repo.entity(p.id)
              if (e) navigate(`/country/${e.slug}`)
            }}
          />
        </ChartCard>
      </div>
    </>
  )
}

function Pathways({ model, className }: { model: DigitalModel; className?: string }) {
  const rows = model.pathways
  return (
    <ChartCard
      className={className}
      title="Two routes into the financial system"
      description={`Adults with a financial-institution account, and adults whose only account is mobile money, ${model.wave}. Together they make up account ownership.`}
      sourceYear={model.wave}
      footnote="Mobile money only = account ownership − financial-institution account ownership (exact, from published values)."
      table={{
        caption: 'Routes into the financial system',
        columns: ['Aggregate', 'Financial institution', 'Mobile money only', 'Any account'],
        rows: rows.map((r) => [
          r.label,
          formatPercent(r.fi),
          formatPercent(r.mobileOnly),
          formatPercent(r.account),
        ]),
      }}
    >
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className={cn('text-[13px]', r.selected && 'font-semibold')}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate">{r.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular">
                {r.account === null ? (
                  MISSING_GLYPH
                ) : (
                  <>
                    <span className="font-semibold text-foreground">
                      {formatPercent(r.account)}
                    </span>
                    {r.mobileOnly !== null &&
                      r.mobileOnly >= 0.5 &&
                      ` · ${formatPercent(r.mobileOnly)} mobile only`}
                  </>
                )}
              </span>
            </div>
            <div
              className="flex h-3 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${r.label}: financial institution ${formatPercent(r.fi)}, mobile money only ${formatPercent(r.mobileOnly)}`}
            >
              {r.fi !== null && (
                <span style={{ width: `${r.fi}%`, background: 'var(--chart-1)' }} />
              )}
              {r.mobileOnly !== null && (
                <span
                  style={{ width: `${r.mobileOnly}%`, background: 'var(--chart-3)' }}
                  className="border-l-2 border-card"
                />
              )}
            </div>
          </li>
        ))}
      </ul>
      <SeriesLegend
        items={[
          { label: 'Financial-institution account', color: 'var(--chart-1)' },
          { label: 'Mobile money only', color: 'var(--chart-3)' },
        ]}
      />
    </ChartCard>
  )
}
