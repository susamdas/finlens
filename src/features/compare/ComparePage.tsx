import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Plus, Sparkles, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { WrapTick } from '@/components/charts/WrapTick'
import { PageHeader } from '@/components/layout/PageHeader'
import { ChartCard } from '@/components/charts/ChartCard'
import { ChartTooltip } from '@/components/charts/ChartTooltip'
import { TrendChart, SeriesLegend } from '@/components/charts/TrendChart'
import {
  axisProps,
  barProps,
  CHART_MARGIN,
  cursorProps,
  gridProps,
  valueAxisProps,
} from '@/components/charts/chart-theme'
import { CountrySelector } from '@/components/common/CountrySelector'
import { DeltaIndicator } from '@/components/common/DeltaIndicator'
import { Flag } from '@/components/common/Flag'
import { YearSelector } from '@/components/common/YearSelector'
import { ExportMenu } from '@/components/common/ExportMenu'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/states'
import { chartVar } from '@/design/palette'
import type { FindexRepository } from '@/data/repository'
import { useDataset } from '@/hooks/useDataset'
import { useFilters } from '@/hooks/useFilters'
import { useReferenceData } from '@/hooks/useReferenceData'
import { compareSummary } from '@/lib/insights/compare'
import { formatPercent, formatPP, MISSING_GLYPH } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  assignSlots,
  buildCompare,
  compareMetrics,
  MAX_COMPARE,
  parseCountries,
  suggestPeers,
  trendSeries,
  type CompareModel,
} from './compare.logic'

export default function ComparePage() {
  const { repo, status, error, retry } = useDataset()
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Analyze' }, { label: 'Compare' }]}
        title="Compare economies"
        description="Put up to five economies side by side across account ownership, savings, borrowing, digital finance and the gender gap."
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
      {repo && <CompareView repo={repo} />}
    </div>
  )
}

function CompareView({ repo }: { repo: FindexRepository }) {
  const [params, setParams] = useSearchParams()
  const { filters, setFilters } = useFilters()
  const { countries: options } = useReferenceData()

  // ?countries=… wins; a single ?country= (e.g. from a profile) seeds regional peers.
  const codes = useMemo(() => {
    const list = parseCountries(repo, params.get('countries'))
    if (list.length) return list
    return filters.country ? suggestPeers(repo, filters.country) : []
  }, [repo, params, filters.country])

  // Colour follows the country: keep each code's slot while the selection changes.
  const key = codes.join(',')
  const [slotState, setSlotState] = useState(() => ({ key, slots: assignSlots(codes, {}) }))
  if (slotState.key !== key) setSlotState({ key, slots: assignSlots(codes, slotState.slots) })
  const slots = slotState.key === key ? slotState.slots : assignSlots(codes, slotState.slots)
  const colorOf = (code: string) => chartVar(slots[code] ?? 0)

  const wave = filters.year && repo.waves.includes(filters.year) ? filters.year : repo.latestWave
  const model = useMemo(() => buildCompare(repo, codes, wave), [repo, codes, wave])
  const summary = useMemo(() => compareSummary(model), [model])

  const setCodes = (next: string[]) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        n.delete('country')
        if (next.length) n.set('countries', next.join(','))
        else n.delete('countries')
        return n
      },
      { replace: true, preventScrollReset: true },
    )

  const presets = [
    { label: 'South Asia', codes: ['BGD', 'IND', 'PAK', 'NPL', 'LKA'] },
    { label: 'East Africa mobile money', codes: ['KEN', 'UGA', 'TZA', 'RWA', 'ETH'] },
    { label: 'Largest developing economies', codes: ['CHN', 'IND', 'IDN', 'BRA', 'NGA'] },
  ].map((p) => ({ ...p, codes: p.codes.filter((c) => repo.entity(c)) }))

  return (
    <>
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {model.entities.map((e) => (
            <span
              key={e.code}
              className="inline-flex items-center gap-2 rounded-full border bg-card py-1 pr-1 pl-2 text-sm shadow-card"
            >
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ background: colorOf(e.code) }}
              />
              <Flag iso2={e.iso2} code={e.code} className="h-4 w-5" />
              <Link to={`/country/${e.slug}`} className="font-medium hover:text-primary">
                {e.shortName}
              </Link>
              <button
                type="button"
                aria-label={`Remove ${e.shortName}`}
                onClick={() => setCodes(codes.filter((c) => c !== e.code))}
                className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          {codes.length < MAX_COMPARE ? (
            <CountrySelector
              options={options.filter((o) => !codes.includes(o.code))}
              onChange={(c) => c && setCodes([...codes, c])}
              placeholder={codes.length ? 'Add economy' : 'Choose an economy'}
              className="w-48"
            />
          ) : (
            <Badge variant="secondary">Maximum of {MAX_COMPARE} economies</Badge>
          )}
          <div className="ml-auto flex items-center gap-2">
            <YearSelector
              years={repo.waves}
              value={wave}
              onChange={(y) => setFilters({ year: y === repo.latestWave ? null : y })}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Quick picks:</span>
          {presets.map((p) => (
            <Button
              key={p.label}
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setCodes(p.codes)}
            >
              <Plus /> {p.label}
            </Button>
          ))}
          {codes.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCodes([])}>
              Clear
            </Button>
          )}
        </div>
      </Card>

      {model.entities.length < 2 ? (
        <EmptyState
          title="Select at least two economies to compare."
          description="Choose an economy with the picker, or start from one of the quick picks above."
        />
      ) : (
        <>
          <Card className="p-5">
            <h2 className="mb-2 flex items-center gap-2 text-[15px] font-semibold">
              <Sparkles className="size-4 text-primary" aria-hidden /> Key differences, {model.wave}
            </h2>
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed marker:text-subtle-foreground">
              {summary.sentences.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            {summary.gaps.length > 0 && (
              <details className="mt-3 text-xs text-muted-foreground">
                <summary className="cursor-pointer">Missing values ({summary.gaps.length})</summary>
                <ul className="mt-1 space-y-0.5 pl-4">
                  {summary.gaps.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </details>
            )}
            <p className="mt-3 text-[11.5px] text-muted-foreground">
              Generated from Findex values for the selected wave. Differences are descriptive.
            </p>
          </Card>

          <KpiComparison model={model} colorOf={colorOf} />

          <div className="grid gap-6 xl:grid-cols-2">
            <GroupedBars model={model} colorOf={colorOf} />
            <RadarCompare model={model} colorOf={colorOf} />
          </div>

          <TrendCompare repo={repo} model={model} colorOf={colorOf} />

          <ComparisonTable model={model} />
        </>
      )}
    </>
  )
}

function KpiComparison({
  model,
  colorOf,
}: {
  model: CompareModel
  colorOf: (c: string) => string
}) {
  return (
    <section aria-label="Indicator comparison" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {model.metrics.map((m) => {
        const fmt = m.indicator.unit === 'pp' ? formatPP : formatPercent
        const values = model.entities
          .map((e) => model.cells[m.key]![e.code]!.value)
          .filter((v): v is number => v !== null)
        const max = m.indicator.unit === '%' ? 100 : Math.max(1, ...values.map(Math.abs))
        return (
          <Card key={m.key} className="p-4">
            <p className="text-[13px] font-medium text-muted-foreground">{m.label}</p>
            <ul className="mt-3 space-y-2">
              {model.entities.map((e) => {
                const v = model.cells[m.key]![e.code]!.value
                const lead = model.leaders[m.key]
                return (
                  <li key={e.code} className="text-[13px]">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={cn('truncate', lead?.best === e.code && 'font-semibold')}>
                        {e.shortName}
                        {lead?.best === e.code && (
                          <span className="sr-only"> (most favourable)</span>
                        )}
                      </span>
                      <span className="font-semibold tabular">{fmt(v)}</span>
                    </div>
                    {v !== null && (
                      <div className="mt-1 h-1.5 rounded-full bg-muted" aria-hidden>
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${(Math.abs(v) / max) * 100}%`,
                            background: colorOf(e.code),
                          }}
                        />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            {model.world[m.key] !== null && (
              <p className="mt-3 border-t pt-2 text-[11.5px] text-muted-foreground">
                {model.worldSource[m.key] === 'LMY' ? 'Developing economies' : 'World'}:{' '}
                <span className="font-medium text-foreground tabular">
                  {fmt(model.world[m.key] ?? null)}
                </span>
              </p>
            )}
          </Card>
        )
      })}
    </section>
  )
}

function GroupedBars({ model, colorOf }: { model: CompareModel; colorOf: (c: string) => string }) {
  const pctMetrics = model.metrics.filter((m) => m.indicator.unit === '%')
  const data = pctMetrics.map((m) => ({
    metric: m.label
      .replace('Female account ownership', 'Female accounts')
      .replace('Mobile money account', 'Mobile money'),
    ...Object.fromEntries(model.entities.map((e) => [e.code, model.cells[m.key]![e.code]!.value])),
  }))
  return (
    <ChartCard
      title="Side by side"
      description={`Share of adults, ${model.wave}. Missing bars mean no published value.`}
      sourceYear={model.wave}
      table={{
        caption: 'Comparison by indicator',
        columns: ['Indicator', ...model.entities.map((e) => e.shortName)],
        rows: pctMetrics.map((m) => [
          m.label,
          ...model.entities.map((e) => formatPercent(model.cells[m.key]![e.code]!.value)),
        ]),
      }}
    >
      <div className="h-80">
        <ResponsiveContainer>
          <BarChart data={data} margin={CHART_MARGIN} barGap={2}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="metric" {...axisProps} interval={0} height={40} tick={<WrapTick />} />
            <YAxis
              {...valueAxisProps}
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip content={<ChartTooltip />} cursor={cursorProps} />
            {model.entities.map((e) => (
              <Bar
                key={e.code}
                dataKey={e.code}
                name={e.shortName}
                fill={colorOf(e.code)}
                {...barProps}
                maxBarSize={18}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <SeriesLegend
        items={model.entities.map((e) => ({ label: e.shortName, color: colorOf(e.code) }))}
      />
    </ChartCard>
  )
}

function RadarCompare({ model, colorOf }: { model: CompareModel; colorOf: (c: string) => string }) {
  const data = model.radarAxes.map((m) => ({
    axis: m.label
      .replace('Female account ownership', 'Female accounts')
      .replace('Mobile money account', 'Mobile money'),
    ...Object.fromEntries(model.entities.map((e) => [e.code, model.cells[m.key]![e.code]!.value])),
  }))
  return (
    <ChartCard
      title="Inclusion profile"
      description="Each axis is 0–100% of adults. Only indicators published for every selected economy are drawn."
      sourceYear={model.wave}
      status={model.radarAxes.length >= 3 && model.radarEntities.length >= 2 ? 'ready' : 'empty'}
      emptyMessage={`Fewer than three indicators are published for all selected economies in ${model.wave}.`}
      footnote={
        [
          model.radarOmitted.length
            ? `${model.radarOmitted.map((e) => e.shortName).join(', ')}: no ${model.wave} survey data.`
            : '',
          model.radarExcluded.length
            ? `Axes not drawn: ${model.radarExcluded.map((m) => m.label).join(', ')}.`
            : '',
        ]
          .filter(Boolean)
          .join(' ') || undefined
      }
    >
      <div className="h-80">
        <ResponsiveContainer>
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke="var(--chart-grid)" />
            <PolarAngleAxis dataKey="axis" tick={{ fill: 'var(--chart-label)', fontSize: 11 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} />
            {model.radarEntities.map((e) => (
              <Radar
                key={e.code}
                dataKey={e.code}
                name={e.shortName}
                stroke={colorOf(e.code)}
                fill={colorOf(e.code)}
                fillOpacity={0.08}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ))}
            <Legend wrapperStyle={{ display: 'none' }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <SeriesLegend
        items={model.radarEntities.map((e) => ({ label: e.shortName, color: colorOf(e.code) }))}
      />
    </ChartCard>
  )
}

function TrendCompare({
  repo,
  model,
  colorOf,
}: {
  repo: FindexRepository
  model: CompareModel
  colorOf: (c: string) => string
}) {
  const metrics = compareMetrics(repo)
  const [key, setKey] = useState('accountOwnership')
  const metric = metrics.find((m) => m.key === key) ?? metrics[0]!
  const series = trendSeries(
    repo,
    model.entities.map((e) => e.code),
    metric,
  )
  const fmt = metric.indicator.unit === 'pp' ? formatPP : formatPercent
  return (
    <ChartCard
      title={`${metric.label} over time`}
      description="All survey waves. Gaps mean the economy was not surveyed or the value was not published."
      actions={
        <Select value={key} onValueChange={setKey}>
          <SelectTrigger size="sm" className="w-56" aria-label="Trend indicator">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {metrics.map((m) => (
              <SelectItem key={m.key} value={m.key}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      table={{
        caption: `${metric.label} over time`,
        columns: ['Economy', ...repo.waves.map(String)],
        rows: series.map((s) => [
          repo.entity(s.code)?.shortName ?? s.code,
          ...s.points.map((p) => fmt(p.value)),
        ]),
      }}
    >
      <TrendChart
        unit={metric.indicator.unit === 'pp' ? 'pp' : '%'}
        waves={repo.waves}
        highlightWave={model.wave}
        series={series.map((s) => ({
          id: s.code,
          label: repo.entity(s.code)?.shortName ?? s.code,
          color: colorOf(s.code),
          points: s.points,
        }))}
        height={300}
      />
      <SeriesLegend
        items={model.entities.map((e) => ({ label: e.shortName, color: colorOf(e.code) }))}
      />
    </ChartCard>
  )
}

function ComparisonTable({ model }: { model: CompareModel }) {
  return (
    <ChartCard
      title="Comparison table"
      description={`${model.wave} values and change since each economy’s previous survey. Most favourable value in bold where the indicator has a clear direction.`}
      sourceYear={model.wave}
      contentClassName="px-0 py-0"
      footnote={
        Object.values(model.worldSource).includes('LMY')
          ? '† The World Bank does not publish a World aggregate for this indicator; the developing-economies average is shown.'
          : undefined
      }
    >
      <Table>
        <caption className="sr-only">Comparison table</caption>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5">Indicator</TableHead>
            {model.entities.map((e) => (
              <TableHead key={e.code} className="text-right">
                {e.shortName}
              </TableHead>
            ))}
            <TableHead className="pr-5 text-right">World</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {model.metrics.map((m) => {
            const fmt = m.indicator.unit === 'pp' ? formatPP : formatPercent
            return (
              <TableRow key={m.key}>
                <TableCell className="pl-5 font-medium">{m.label}</TableCell>
                {model.entities.map((e) => {
                  const c = model.cells[m.key]![e.code]!
                  const best = model.leaders[m.key]?.best === e.code
                  return (
                    <TableCell key={e.code} className="text-right align-top">
                      <div className={cn('tabular', best && 'font-bold')}>
                        {c.value === null ? MISSING_GLYPH : fmt(c.value)}
                      </div>
                      {c.delta !== null && (
                        <div className="mt-1">
                          <DeltaIndicator
                            delta={c.delta}
                            higherIsBetter={m.indicator.higherIsBetter}
                            comparisonLabel={`vs ${c.previous?.wave}`}
                          />
                        </div>
                      )}
                    </TableCell>
                  )
                })}
                <TableCell className="pr-5 text-right text-muted-foreground">
                  {fmt(model.world[m.key] ?? null)}
                  {model.worldSource[m.key] === 'LMY' && (
                    <sup
                      className="text-[11px]"
                      title="World aggregate not published; developing-economies average shown"
                    >
                      †
                    </sup>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </ChartCard>
  )
}
