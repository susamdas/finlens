import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AlertTriangle, ArrowLeftRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/layout/PageHeader'
import { ChartCard } from '@/components/charts/ChartCard'
import { ScatterPlot } from '@/components/charts/ScatterPlot'
import { SeriesLegend } from '@/components/charts/TrendChart'
import { CountrySelector } from '@/components/common/CountrySelector'
import { ExportMenu } from '@/components/common/ExportMenu'
import { Flag } from '@/components/common/Flag'
import { MetricSelector } from '@/components/common/MetricSelector'
import { ScopeSelector } from '@/components/common/ScopeSelector'
import { YearSelector } from '@/components/common/YearSelector'
import { ErrorState, LoadingSkeleton } from '@/components/common/states'
import { chartVar } from '@/design/palette'
import type { FindexRepository } from '@/data/repository'
import { useDataset } from '@/hooks/useDataset'
import { useFilters } from '@/hooks/useFilters'
import { useReferenceData } from '@/hooks/useReferenceData'
import { scopeParamValue, scopeToFilters } from '@/features/overview/overview.logic'
import { describeCorrelation, MIN_CORRELATION_N } from '@/lib/analytics/stats'
import { formatDecimal, formatPercent, formatPP, MISSING_GLYPH } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  buildCorrelation,
  correlationMatrix,
  correlationMetrics,
  DEFAULT_X,
  DEFAULT_Y,
  slopeSentence,
  type ColorBy,
  type CorrelationModel,
  type MatrixCell,
} from './correlation.logic'

export default function CorrelationPage() {
  const { repo, status, error, retry } = useDataset()
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Analyze' }, { label: 'Correlation Explorer' }]}
        title="Correlation explorer"
        description="How do two indicators move together across economies? Pick any pair to see the pattern, its strength, and the economies that don't fit it."
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
      {repo && <CorrelationView repo={repo} />}
    </div>
  )
}

function CorrelationView({ repo }: { repo: FindexRepository }) {
  const navigate = useNavigate()
  const { filters, setFilters } = useFilters()
  const [params, setParams] = useSearchParams()
  const { countries } = useReferenceData()
  const xParam = params.get('x')
  const yParam = params.get('y')
  const colorBy: ColorBy =
    params.get('color') === 'income' ? 'income' : params.get('color') === 'none' ? 'none' : 'region'

  const setParam = (patch: Record<string, string | null>) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        for (const [k, v] of Object.entries(patch)) {
          if (v === null) n.delete(k)
          else n.set(k, v)
        }
        return n
      },
      { replace: true },
    )

  const model = useMemo(
    () =>
      buildCorrelation(repo, {
        x: xParam,
        y: yParam,
        wave: filters.year,
        region: filters.region,
        income: filters.income,
        colorBy,
      }),
    [repo, xParam, yParam, filters.year, filters.region, filters.income, colorBy],
  )
  const matrix = useMemo(
    () => correlationMatrix(repo, model.wave, { region: filters.region, income: filters.income }),
    [repo, model.wave, filters.region, filters.income],
  )

  const setPair = (x: string, y: string) =>
    setParam({ x: x === DEFAULT_X ? null : x, y: y === DEFAULT_Y ? null : y })

  // Stable colour per category: region / income-group order from the dataset, never cycled.
  const categories = useMemo(() => {
    if (colorBy === 'region') return repo.regions.map((r) => ({ id: r.id, label: r.name }))
    if (colorBy === 'income')
      return [...repo.incomeGroups]
        .sort((a, b) => a.order - b.order)
        .map((g) => ({ id: g.id, label: g.name }))
    return []
  }, [repo, colorBy])
  const colorOf = (cat: string | null) => {
    const i = categories.findIndex((c) => c.id === cat)
    return i < 0 ? undefined : chartVar(i)
  }
  const present = new Set(model.points.map((p) => p.category))
  const focus = filters.country ? repo.entity(filters.country) : undefined
  const metrics = correlationMetrics(repo)

  return (
    <>
      <div
        role="group"
        aria-label="Correlation options"
        className="z-30 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:sticky lg:top-16 lg:-mx-8 lg:px-8 print:static"
      >
        <MetricSelector
          indicators={metrics}
          value={model.x.id}
          onChange={(v) => setPair(v, model.y.id)}
          label="Horizontal axis indicator"
          className="w-full sm:w-60"
        />
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Swap axes"
          title="Swap axes"
          onClick={() => setPair(model.y.id, model.x.id)}
        >
          <ArrowLeftRight className="size-4" aria-hidden />
        </Button>
        <MetricSelector
          indicators={metrics}
          value={model.y.id}
          onChange={(v) => setPair(model.x.id, v)}
          label="Vertical axis indicator"
          className="w-full sm:w-60"
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
        <Select
          value={colorBy}
          onValueChange={(v) => setParam({ color: v === 'region' ? null : v })}
        >
          <SelectTrigger size="sm" className="w-full sm:w-44" aria-label="Colour points by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="region">Colour by region</SelectItem>
            <SelectItem value="income">Colour by income</SelectItem>
            <SelectItem value="none">No colour</SelectItem>
          </SelectContent>
        </Select>
        <CountrySelector
          options={countries}
          value={filters.country}
          onChange={(c) => setFilters({ country: c })}
          placeholder="Highlight economy"
          className="w-full sm:w-48"
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-12">
        <ChartCard
          className="xl:col-span-8"
          title={`${model.y.shortLabel} vs ${model.x.shortLabel}`}
          description={`${model.wave} · ${model.scope.label} · one dot per economy with both values published.`}
          sourceYear={model.wave}
          status={model.n >= 3 ? 'ready' : 'empty'}
          emptyMessage="Fewer than three economies publish both indicators for this selection."
          footnote={
            model.excluded > 0
              ? `${model.excluded} economies in scope are left out because one of the two values is not published.`
              : undefined
          }
          table={{
            caption: `${model.y.shortLabel} and ${model.x.shortLabel} by economy, ${model.wave}`,
            columns: ['Economy', model.x.shortLabel, model.y.shortLabel],
            rows: model.points.map((p) => [
              p.entity.shortName,
              fmt(model.x.unit, p.x),
              fmt(model.y.unit, p.y),
            ]),
          }}
        >
          <ScatterPlot
            height={380}
            points={model.points.map((p) => ({
              id: p.entity.code,
              label: p.entity.shortName,
              x: p.x,
              y: p.y,
              highlight: true,
              color: colorBy === 'none' ? undefined : colorOf(p.category),
              labelled: focus?.code === p.entity.code,
            }))}
            xLabel={model.x.shortLabel}
            yLabel={model.y.shortLabel}
            xDomain={model.domains.x}
            yDomain={model.domains.y}
            xUnit={model.x.unit === 'pp' ? 'pp' : '%'}
            yUnit={model.y.unit === 'pp' ? 'pp' : '%'}
            fit={model.fit}
            onSelect={(p) => {
              const e = repo.entity(p.id)
              if (e) navigate(`/country/${e.slug}`)
            }}
          />
          {colorBy !== 'none' && (
            <SeriesLegend
              items={categories
                .filter((c) => present.has(c.id))
                .map((c) => ({ label: c.label, color: colorOf(c.id)! }))}
            />
          )}
          {focus && !model.points.some((p) => p.entity.code === focus.code) && (
            <p className="mt-2 text-xs text-muted-foreground">
              {focus.shortName} is not plotted: it is outside this scope or one of the two values is
              not published for {model.wave}.
            </p>
          )}
        </ChartCard>
        <StatsPanel model={model} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <OffTheLine model={model} />
        <OverTime model={model} />
      </div>

      <Matrix
        indicators={matrix.indicators}
        cells={matrix.cells}
        selected={{ x: model.x.id, y: model.y.id }}
        wave={model.wave}
        scopeLabel={model.scope.label}
        onPick={setPair}
      />
    </>
  )
}

const fmt = (unit: string, v: number | null) => (unit === 'pp' ? formatPP(v) : formatPercent(v))

function StatsPanel({ model }: { model: CorrelationModel }) {
  const slope = slopeSentence(model)
  return (
    <Card className="space-y-5 p-5 xl:col-span-4">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Pearson correlation (r)
        </p>
        <p className="mt-1 text-4xl font-semibold tracking-tight tabular">
          {model.r === null ? MISSING_GLYPH : formatDecimal(model.r, 2)}
        </p>
        <p className="mt-1 text-sm font-medium">
          {model.r !== null
            ? describeCorrelation(model.r)
            : model.x.id === model.y.id
              ? 'Choose two different indicators.'
              : `Not reported: fewer than ${MIN_CORRELATION_N} economies (${model.n}).`}
        </p>
      </div>
      {model.r !== null && (
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Rank (ρ)</dt>
            <dd className="font-semibold tabular">
              {model.rho === null ? MISSING_GLYPH : formatDecimal(model.rho, 2)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">R²</dt>
            <dd className="font-semibold tabular">
              {model.fit ? formatDecimal(model.fit.r2, 2) : MISSING_GLYPH}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Economies</dt>
            <dd className="font-semibold tabular">{model.n}</dd>
          </div>
        </dl>
      )}
      {slope && <p className="text-sm text-muted-foreground">{slope}</p>}
      {model.r !== null && model.rho !== null && Math.abs(model.r - model.rho) >= 0.15 && (
        <p className="text-sm text-muted-foreground">
          Pearson and rank correlation differ by {formatDecimal(Math.abs(model.r - model.rho), 2)},
          so a few economies, or a curved pattern, shape this result.
        </p>
      )}
      <div className="rounded-xl border border-warning/30 bg-warning-soft p-3 text-[13px]">
        <p className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="size-4 text-warning" aria-hidden />
          Read with care
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Correlation is not causation: other factors may drive both indicators.</li>
          <li>This compares economies, not people — it doesn't describe individual adults.</li>
          <li>One survey wave only; the pattern can change over time (see below).</li>
        </ul>
      </div>
    </Card>
  )
}

function OffTheLine({ model }: { model: CorrelationModel }) {
  const list = (items: CorrelationModel['above']) => (
    <ul className="divide-y">
      {items.map((r) => (
        <li key={r.entity.code} className="py-2">
          <div className="flex items-center justify-between gap-3">
            <Link
              to={`/country/${r.entity.slug}`}
              className="hit-area flex min-w-0 items-center gap-2.5 text-sm font-medium hover:text-primary"
            >
              <Flag iso2={r.entity.iso2} code={r.entity.code} className="h-4 w-6 shrink-0" />
              <span className="truncate">{r.entity.shortName}</span>
            </Link>
            <span className="shrink-0 text-sm font-semibold tabular">
              {r.residual >= 0 ? '+' : '−'}
              {Math.abs(r.residual).toFixed(1)}
            </span>
          </div>
          <p className="mt-0.5 pl-8.5 text-xs text-muted-foreground tabular">
            {fmt(model.y.unit, r.y)} actual · ~{fmt(model.y.unit, r.expected)} on the line
          </p>
        </li>
      ))}
    </ul>
  )
  return (
    <ChartCard
      title="Furthest from the trend line"
      description={`Economies whose ${model.y.shortLabel.toLowerCase()} is furthest above or below what the line predicts from their ${model.x.shortLabel.toLowerCase()}. Useful cases to study, not rankings.`}
      sourceYear={model.wave}
      status={model.fit ? 'ready' : 'empty'}
      emptyMessage="No trend line: too few economies for this selection."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Above the line
          </p>
          {list(model.above)}
        </div>
        <div>
          <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Below the line
          </p>
          {list(model.below)}
        </div>
      </div>
    </ChartCard>
  )
}

function OverTime({ model }: { model: CorrelationModel }) {
  const any = model.overTime.some((o) => o.r !== null)
  return (
    <ChartCard
      title="Is the pattern stable over time?"
      description={`Pearson r for the same pair in each survey wave, ${model.scope.label}. Bars run from 0 towards −1 or +1.`}
      sourceYear={`${model.overTime[0]?.wave}–${model.overTime.at(-1)?.wave}`}
      status={any ? 'ready' : 'empty'}
      emptyMessage="This pair is not published for enough economies in any wave."
      table={{
        caption: 'Correlation by survey wave',
        columns: ['Wave', 'r', 'Economies'],
        rows: model.overTime.map((o) => [
          String(o.wave),
          o.r === null ? MISSING_GLYPH : formatDecimal(o.r, 2),
          String(o.n),
        ]),
      }}
    >
      <ul className="space-y-2.5">
        {model.overTime.map((o) => (
          <li
            key={o.wave}
            className={cn(
              'grid grid-cols-[3rem_minmax(0,1fr)_7rem] items-center gap-3 text-sm',
              o.wave === model.wave && 'font-semibold',
            )}
          >
            <span className="tabular">{o.wave}</span>
            <span className="relative h-2 rounded-full bg-muted" aria-hidden>
              <span className="absolute inset-y-[-3px] left-1/2 w-px bg-chart-axis" />
              {o.r !== null && (
                <span
                  className="absolute inset-y-0 rounded-full"
                  style={{
                    background: o.r >= 0 ? 'var(--div-p2)' : 'var(--div-n2)',
                    left: o.r >= 0 ? '50%' : `${50 + o.r * 50}%`,
                    width: `${Math.abs(o.r) * 50}%`,
                  }}
                />
              )}
            </span>
            <span className="text-right text-xs text-muted-foreground tabular">
              {o.r === null ? (
                o.n ? (
                  `n = ${o.n} (too few)`
                ) : (
                  'not published'
                )
              ) : (
                <>
                  <span className="font-semibold text-foreground">{formatDecimal(o.r, 2)}</span> · n
                  = {o.n}
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </ChartCard>
  )
}

/** Diverging bins for r; strong bins use the card colour for text so both themes stay legible. */
function cellStyle(r: number | null): { background: string; color?: string } {
  if (r === null) return { background: 'var(--missing-bg)' }
  const bins: [number, string, boolean][] = [
    [-0.6, 'var(--div-n3)', true],
    [-0.4, 'var(--div-n2)', true],
    [-0.2, 'var(--div-n1)', false],
    [0.2, 'var(--div-0)', false],
    [0.4, 'var(--div-p1)', false],
    [0.6, 'var(--div-p2)', true],
    [Infinity, 'var(--div-p3)', true],
  ]
  const [, bg, strong] = bins.find(([t]) => r < t)!
  return strong ? { background: bg, color: 'var(--card)' } : { background: bg }
}

function Matrix({
  indicators,
  cells,
  selected,
  wave,
  scopeLabel,
  onPick,
}: {
  indicators: CorrelationModel['x'][]
  cells: MatrixCell[][]
  selected: { x: string; y: string }
  wave: number
  scopeLabel: string
  onPick: (x: string, y: string) => void
}) {
  return (
    <ChartCard
      title="Correlation matrix"
      description={`Pearson r between key indicators across economies, ${wave} · ${scopeLabel}. Select a cell to explore that pair above. Blank cells have fewer than ${MIN_CORRELATION_N} economies with both values.`}
      sourceYear={wave}
      footnote="Blue: move together · red: move in opposite directions · pale: little association."
      table={{
        caption: 'Correlation matrix',
        columns: ['', ...indicators.map((i) => i.shortLabel)],
        rows: indicators.map((row, ri) => [
          row.shortLabel,
          ...cells[ri]!.map((c) => (c.r === null ? MISSING_GLYPH : formatDecimal(c.r, 2))),
        ]),
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-0.5 text-[11.5px]">
          <caption className="sr-only">Correlation matrix, select a cell to explore</caption>
          <thead>
            <tr>
              <th />
              {indicators.map((i) => (
                <th
                  key={i.id}
                  scope="col"
                  className="h-28 w-12 align-bottom font-medium text-muted-foreground"
                >
                  <span className="mx-auto block w-4 [writing-mode:vertical-rl] rotate-180 text-left whitespace-nowrap">
                    {i.shortLabel}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {indicators.map((row, ri) => (
              <tr key={row.id}>
                <th
                  scope="row"
                  className="pr-2 text-right font-medium whitespace-nowrap text-muted-foreground"
                >
                  {row.shortLabel}
                </th>
                {cells[ri]!.map((c) => {
                  const diag = c.x === c.y
                  const isSel =
                    (c.x === selected.x && c.y === selected.y) ||
                    (c.x === selected.y && c.y === selected.x)
                  return (
                    <td key={c.x} className="p-0">
                      {diag ? (
                        <div className="h-9 rounded-md bg-muted" aria-hidden />
                      ) : (
                        <button
                          type="button"
                          onClick={() => onPick(c.x, c.y)}
                          disabled={c.r === null}
                          aria-label={`${row.shortLabel} and ${indicators.find((i) => i.id === c.x)?.shortLabel}: ${c.r === null ? 'not enough data' : `r ${formatDecimal(c.r, 2)}, ${c.n} economies`}`}
                          title={
                            c.r === null
                              ? `Only ${c.n} economies`
                              : `r = ${formatDecimal(c.r, 2)} · n = ${c.n}`
                          }
                          className={cn(
                            'h-9 w-full rounded-md font-medium tabular outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default',
                            isSel && 'ring-2 ring-foreground',
                            c.r !== null && 'hover:ring-2 hover:ring-foreground/40',
                          )}
                          style={cellStyle(c.r)}
                        >
                          {c.r === null ? '' : formatDecimal(c.r, 2)}
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  )
}
