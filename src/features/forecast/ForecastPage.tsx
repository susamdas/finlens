import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AlertTriangle, FlaskConical, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import { ForecastChart } from '@/components/charts/ForecastChart'
import { SeriesLegend } from '@/components/charts/TrendChart'
import { CountrySelector } from '@/components/common/CountrySelector'
import { ExportMenu } from '@/components/common/ExportMenu'
import { MetricSelector } from '@/components/common/MetricSelector'
import { ScopeSelector } from '@/components/common/ScopeSelector'
import { ErrorState, LoadingSkeleton } from '@/components/common/states'
import type { FindexRepository } from '@/data/repository'
import { useDataset } from '@/hooks/useDataset'
import { useFilters } from '@/hooks/useFilters'
import { useReferenceData } from '@/hooks/useReferenceData'
import { scopeParamValue, scopeToFilters } from '@/features/overview/overview.logic'
import { formatPercent, formatPP, MISSING_GLYPH } from '@/lib/format'
import { MIN_OBSERVATIONS, MODELS, UNSTABLE_PP, type ModelForecast } from '@/lib/forecast'
import { cn } from '@/lib/utils'
import {
  buildForecast,
  DEFAULT_FORECAST_METRIC,
  FORECAST_YEARS,
  forecastMetrics,
  type ForecastView,
} from './forecast.logic'

const DISCLAIMER =
  'FinLens projection — not an official World Bank forecast. It assumes the pattern in past surveys continues.'

export default function ForecastPage() {
  const { repo, status, error, retry } = useDataset()
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Analyze' }, { label: 'Forecast' }]}
        title="Forecast"
        description="Where could financial inclusion be by 2027 and 2030 if past trends continue? Simple, transparent projections from the published Findex surveys, with their uncertainty shown."
        actions={<ExportMenu />}
      />
      <div
        role="note"
        className="flex gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm"
      >
        <FlaskConical className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <div>
          <p className="font-semibold">{DISCLAIMER}</p>
          <p className="mt-1 text-muted-foreground">
            With only four or five surveys per economy, projections are rough and the ranges are
            wide. Policy changes, crises or survey-method changes can break any trend. Use them to
            frame questions, not as targets or predictions.
          </p>
        </div>
      </div>
      {status === 'error' && (
        <ErrorState
          title="The dataset could not be loaded."
          description={error ?? undefined}
          onRetry={() => void retry()}
        />
      )}
      {!repo && status !== 'error' && <LoadingSkeleton variant="chart" />}
      {repo && <ForecastViewSection repo={repo} />}
    </div>
  )
}

const fmtFor = (v: ForecastView) => (v.metric.unit === 'pp' ? formatPP : formatPercent)

function ForecastViewSection({ repo }: { repo: FindexRepository }) {
  const { filters, setFilters } = useFilters()
  const [params, setParams] = useSearchParams()
  const { countries } = useReferenceData()
  const modelParam = params.get('model')

  const view = useMemo(
    () =>
      buildForecast(repo, {
        metric: filters.metric,
        country: filters.country,
        region: filters.region,
        income: filters.income,
        model: modelParam,
      }),
    [repo, filters.metric, filters.country, filters.region, filters.income, modelParam],
  )
  const fmt = fmtFor(view)
  const f = view.forecast
  const sel = view.selected
  const pp = view.metric.unit === 'pp'

  const setModel = (m: string) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        if (m === 'auto') n.delete('model')
        else n.set('model', m)
        return n
      },
      { replace: true },
    )

  const domain: [number, number] | undefined = pp
    ? (() => {
        const vals = [
          ...f.observations.map((o) => o.value),
          ...(sel?.projections.flatMap((p) => [p.low, p.high]) ?? []),
        ]
        return [Math.floor(Math.min(0, ...vals) / 5) * 5, Math.ceil(Math.max(10, ...vals) / 5) * 5]
      })()
    : undefined

  return (
    <>
      <div
        role="group"
        aria-label="Forecast options"
        className="z-30 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:sticky lg:top-16 lg:-mx-8 lg:px-8 print:static"
      >
        <MetricSelector
          indicators={forecastMetrics(repo)}
          value={view.metric.id}
          onChange={(m) => setFilters({ metric: m === DEFAULT_FORECAST_METRIC ? null : m })}
          label="Indicator"
          className="w-full sm:w-64"
        />
        <CountrySelector
          options={countries}
          value={filters.country}
          onChange={(c) => setFilters({ country: c })}
          placeholder="Choose an economy"
          className="w-full sm:w-52"
        />
        {view.target.kind === 'aggregate' ? (
          <ScopeSelector
            regions={repo.regions}
            incomeGroups={repo.incomeGroups}
            value={scopeParamValue(view.target.scope!, repo)}
            onChange={(v) => {
              const s = scopeToFilters(v)
              setFilters({ region: s.region ?? null, income: s.income ?? null })
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setFilters({ country: null })}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Show an aggregate instead
          </button>
        )}
        <Select
          value={modelParam && sel?.model.id === modelParam ? modelParam : 'auto'}
          onValueChange={setModel}
        >
          <SelectTrigger size="sm" className="w-full sm:w-64" aria-label="Projection model">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">
              Best-fitting model
              {f.recommended ? ` (${MODELS.find((m) => m.id === f.recommended)?.short})` : ''}
            </SelectItem>
            {f.models
              .filter((m) => m.available)
              .map((m) => (
                <SelectItem key={m.model.id} value={m.model.id}>
                  {m.model.label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <ChartCard
          className="xl:col-span-8"
          title={`${view.metric.shortLabel} · ${view.target.label}`}
          description={
            sel
              ? `Observed surveys (solid) and the ${sel.model.label.toLowerCase()} projection (dashed) with its 80% range. Faint dashed lines are the other models.`
              : 'Observed surveys.'
          }
          sourceYear={`${f.observations[0]?.year ?? ''}–${f.lastObservedYear ?? ''} observed`}
          status={f.observations.length ? 'ready' : 'empty'}
          emptyMessage="No published values for this selection."
          footnote={DISCLAIMER}
          table={{
            caption: 'Observed and projected values',
            columns: ['Year', 'Type', 'Value', '80% range'],
            rows: [
              ...f.observations.map((o) => [String(o.year), 'Observed', fmt(o.value), '']),
              ...(sel?.projections ?? []).map((p) => [
                String(p.year),
                'FinLens projection',
                fmt(p.value),
                `${fmt(p.low)} – ${fmt(p.high)}`,
              ]),
            ],
          }}
        >
          <ForecastChart
            unit={pp ? 'pp' : '%'}
            {...(domain ? { domain } : {})}
            data={{
              observed: f.observations,
              projection: sel?.projections ?? [],
              alternatives: f.models
                .filter((m) => m.available && m.model.id !== sel?.model.id)
                .map((m) => ({ id: m.model.id, label: m.model.short, points: m.projections })),
            }}
          />
          <SeriesLegend
            items={[
              { label: 'Observed (Findex)', color: 'var(--chart-1)' },
              { label: 'FinLens projection (dashed)', color: 'var(--chart-1)', muted: true },
              { label: 'Other models', color: 'var(--chart-axis)' },
            ]}
          />
        </ChartCard>
        <OutlookPanel view={view} />
      </div>

      <ModelTable view={view} />
      <RegionalOutlook view={view} />
      <Method />
    </>
  )
}

function OutlookPanel({ view }: { view: ForecastView }) {
  const f = view.forecast
  const sel = view.selected
  const fmt = fmtFor(view)
  const last = f.observations.at(-1)
  return (
    <Card className="space-y-4 p-5 xl:col-span-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">Projected outlook</h2>
        <Badge variant="outline">FinLens projection</Badge>
      </div>
      {!f.enough ? (
        <p className="text-sm text-muted-foreground">
          Not projected: at least {MIN_OBSERVATIONS} surveys are needed and {view.target.label} has{' '}
          {f.observations.length}.
        </p>
      ) : sel ? (
        <>
          {last && (
            <p className="text-sm text-muted-foreground">
              Latest survey ({last.year}):{' '}
              <span className="font-semibold text-foreground tabular">{fmt(last.value)}</span>
            </p>
          )}
          <dl className="grid grid-cols-2 gap-3">
            {sel.projections.map((p) => (
              <div key={p.year} className="rounded-xl border p-3">
                <dt className="text-xs text-muted-foreground">{p.year}</dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight tabular">
                  ~{fmt(p.value)}
                </dd>
                <dd className="mt-0.5 text-xs text-muted-foreground tabular">
                  80% range {fmt(p.low)} – {fmt(p.high)}
                </dd>
                {p.capped && <dd className="mt-1 text-xs text-warning">Capped at 0–100%</dd>}
              </div>
            ))}
          </dl>
          <p className="text-sm">
            <span className="font-medium">{sel.model.label}.</span>{' '}
            <span className="text-muted-foreground">
              {sel.model.id === f.recommended ? f.recommendationReason : 'Chosen manually.'}
            </span>
          </p>
          {f.unstable && (
            <p className="flex gap-2 rounded-xl border border-warning/30 bg-warning-soft p-3 text-[13px]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <span>
                The latest survey broke from the earlier pattern: every model trained on earlier
                surveys missed it by {UNSTABLE_PP} points or more. Treat these projections as
                especially uncertain.
              </span>
            </p>
          )}
          {view.remapped.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Uses actual survey years:{' '}
              {view.remapped.map((r) => `${r.wave} wave surveyed in ${r.year}`).join(', ')}.
            </p>
          )}
          {view.target.fallback && (
            <p className="text-xs text-muted-foreground">
              World figure not published for this indicator; developing-economies aggregate used.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No model could be fitted to these surveys.</p>
      )}
      {view.target.entity && (
        <Link
          to={`/country/${view.target.entity.slug}`}
          className="inline-block text-sm font-medium text-primary hover:underline"
        >
          Open {view.target.entity.shortName} profile →
        </Link>
      )}
    </Card>
  )
}

function ModelTable({ view }: { view: ForecastView }) {
  const f = view.forecast
  const fmt = fmtFor(view)
  const cell = (m: ModelForecast, year: number) => {
    const p = m.projections.find((x) => x.year === year)
    if (!p) return <span className="text-muted-foreground">{MISSING_GLYPH}</span>
    return (
      <>
        <span className="font-semibold tabular">{fmt(p.value)}</span>
        <span className="block text-xs text-muted-foreground tabular">
          {fmt(p.low)} – {fmt(p.high)}
        </span>
      </>
    )
  }
  return (
    <ChartCard
      title="Compare models"
      description={`Each model's projection with its 80% range, and its back-test: fitted without the ${f.lastObservedYear ?? 'latest'} survey, how far off was it?`}
      sourceYear={`${FORECAST_YEARS.join(' & ')} projected`}
      contentClassName="px-0 py-0"
      footnote="A single back-test is a weak guide. Where models disagree, the true uncertainty is larger than any one range."
    >
      <Table>
        <caption className="sr-only">Projection models compared</caption>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5">Model</TableHead>
            {FORECAST_YEARS.map((y, i) => (
              <TableHead
                key={y}
                className={cn(
                  'text-right',
                  i < FORECAST_YEARS.length - 1 && 'hidden sm:table-cell',
                )}
              >
                {y}
              </TableHead>
            ))}
            <TableHead className="pr-5 text-right">Back-test error</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {f.models.map((m) => (
            <TableRow
              key={m.model.id}
              className={cn(m.model.id === view.selected?.model.id && 'bg-muted/50')}
            >
              <TableCell className="max-w-md pl-5 align-top whitespace-normal">
                <p className="font-medium">
                  {m.model.label}
                  {m.model.id === f.recommended && (
                    <Badge variant="secondary" className="ml-2">
                      Best fit
                    </Badge>
                  )}
                </p>
                <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
                  {m.available ? m.model.description : m.reason}
                </p>
              </TableCell>
              {FORECAST_YEARS.map((y, i) => (
                <TableCell
                  key={y}
                  className={cn(
                    'text-right align-top',
                    i < FORECAST_YEARS.length - 1 && 'hidden sm:table-cell',
                  )}
                >
                  {cell(m, y)}
                </TableCell>
              ))}
              <TableCell className="pr-5 text-right align-top tabular">
                {m.backtest ? (
                  <>
                    <span className="font-semibold">
                      {m.backtest.error >= 0 ? '+' : '−'}
                      {Math.abs(m.backtest.error).toFixed(1)} pp
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {fmt(m.backtest.predicted)} vs {fmt(m.backtest.actual)} actual
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">{MISSING_GLYPH}</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ChartCard>
  )
}

function RegionalOutlook({ view }: { view: ForecastView }) {
  const fmt = fmtFor(view)
  const year = FORECAST_YEARS.at(-1)!
  return (
    <ChartCard
      title={`Regional outlook to ${year}`}
      description={`${view.metric.shortLabel}: each published aggregate projected with its own best-fitting model. Rows with fewer than ${MIN_OBSERVATIONS} surveys are not projected.`}
      sourceYear={`${year} projected`}
      contentClassName="px-0 py-0"
      footnote={DISCLAIMER}
    >
      <Table>
        <caption className="sr-only">Regional projections</caption>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5">Aggregate</TableHead>
            <TableHead className="text-right">Latest survey</TableHead>
            <TableHead className="text-right">{year} projection</TableHead>
            <TableHead className="hidden text-right sm:table-cell">80% range</TableHead>
            <TableHead className="hidden pr-5 text-right md:table-cell">Model</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {view.regional.map((r) => {
            const f = r.forecast
            const m = f.models.find((x) => x.model.id === f.recommended)
            const p = m?.projections.find((x) => x.year === year)
            const last = f.observations.at(-1)
            return (
              <TableRow key={r.id} className={cn(r.code === view.target.code && 'bg-muted/50')}>
                <TableCell className="pl-5 font-medium">{r.label}</TableCell>
                <TableCell className="text-right text-muted-foreground tabular">
                  {last ? `${fmt(last.value)} (${last.year})` : MISSING_GLYPH}
                </TableCell>
                <TableCell className="text-right font-semibold tabular">
                  {p ? `~${fmt(p.value)}` : MISSING_GLYPH}
                  {f.unstable && p && (
                    <span
                      className="ml-1 text-warning"
                      title="Latest survey broke from the earlier pattern"
                    >
                      *
                    </span>
                  )}
                </TableCell>
                <TableCell className="hidden text-right text-muted-foreground tabular sm:table-cell">
                  {p ? `${fmt(p.low)} – ${fmt(p.high)}` : MISSING_GLYPH}
                </TableCell>
                <TableCell className="hidden pr-5 text-right text-muted-foreground md:table-cell">
                  {m?.model.short ?? MISSING_GLYPH}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {view.regional.some((r) => r.forecast.unstable) && (
        <p className="border-t px-5 py-3 text-xs text-muted-foreground">
          * The latest survey broke from the earlier pattern (back-test miss ≥ {UNSTABLE_PP} pp);
          especially uncertain.
        </p>
      )}
    </ChartCard>
  )
}

function Method() {
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold">
        <Info className="size-4 text-muted-foreground" aria-hidden />
        How these projections work
      </h2>
      <div className="mt-3 grid gap-4 text-sm text-muted-foreground md:grid-cols-3">
        <p>
          <span className="font-medium text-foreground">Inputs.</span> Only values published in the
          Global Findex, placed at their actual survey year. Missing surveys are skipped, never
          filled in. At least {MIN_OBSERVATIONS} surveys are required.
        </p>
        <p>
          <span className="font-medium text-foreground">Models.</span>{' '}
          {MODELS.map((m) => m.label).join(', ')}. The default is the model that best projected the
          most recent survey from the earlier ones. Shares are kept within 0–100%.
        </p>
        <p>
          <span className="font-medium text-foreground">Uncertainty.</span> Ranges are 80%
          prediction intervals from each model's fit, widening with distance from the data. They do
          not cover shocks, policy changes or changes in survey method.
        </p>
      </div>
    </Card>
  )
}
