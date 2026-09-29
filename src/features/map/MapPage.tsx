import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, BarChart3, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/layout/PageHeader'
import { CountrySelector } from '@/components/common/CountrySelector'
import { YearSelector } from '@/components/common/YearSelector'
import { Flag } from '@/components/common/Flag'
import { SourceBadge } from '@/components/common/SourceBadge'
import { ErrorState, LoadingSkeleton } from '@/components/common/states'
import { WorldMap } from '@/components/map/WorldMap'
import { MapLegend } from '@/components/map/MapLegend'
import { BarList } from '@/components/charts/BarList'
import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/data/indicators/categories'
import type { FindexRepository } from '@/data/repository'
import { useDataset } from '@/hooks/useDataset'
import { useFilters } from '@/hooks/useFilters'
import { useReferenceData } from '@/hooks/useReferenceData'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { formatPercent, formatPP, MISSING_TEXT } from '@/lib/format'
import {
  buildMapModel,
  economyDetail,
  MAP_DEFAULT_METRIC,
  mapMetrics,
  type MapMetric,
  type MapModel,
} from './map.logic'
import { MapTooltipContent } from './MapTooltipContent'

export default function MapPage() {
  const { repo, status, error, retry } = useDataset()
  const { filters, setFilters } = useFilters()
  const { countries } = useReferenceData()
  const wave =
    repo && filters.year && repo.waves.includes(filters.year) ? filters.year : repo?.latestWave
  const model = useMemo(
    () => (repo && wave ? buildMapModel(repo, filters.metric, wave) : null),
    [repo, filters.metric, wave],
  )
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Explore' }, { label: 'Global Map' }]}
        title="Global Map"
        description="Compare financial inclusion across every economy in the Global Findex. Hover for details, click to open a country profile."
      />
      {status === 'error' && (
        <ErrorState
          title="The dataset could not be loaded."
          description={error ?? undefined}
          onRetry={() => void retry()}
        />
      )}
      {!model && status !== 'error' && <LoadingSkeleton variant="chart" />}
      {repo && model && (
        <>
          <div role="group" aria-label="Map filters" className="flex flex-wrap items-center gap-2">
            <YearSelector
              years={repo.waves}
              value={model.wave}
              onChange={(y) => setFilters({ year: y === repo.latestWave ? null : y })}
            />
            <MapMetricSelect
              metrics={mapMetrics(repo)}
              value={model.metric.id}
              onChange={(m) => setFilters({ metric: m === MAP_DEFAULT_METRIC ? null : m })}
            />
            <CountrySelector
              options={countries}
              value={filters.country}
              onChange={(c) => setFilters({ country: c })}
              placeholder="Find a country"
              className="w-52"
            />
            {filters.country && (
              <Button variant="ghost" size="sm" onClick={() => setFilters({ country: null })}>
                Clear selection
              </Button>
            )}
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <MapCard
              repo={repo}
              model={model}
              selected={filters.country ?? null}
              onHover={setHovered}
            />
            <DetailPanel
              repo={repo}
              model={model}
              code={hovered ?? filters.country ?? null}
              pinned={Boolean(filters.country) && !hovered}
            />
          </div>

          <Coverage model={model} />
        </>
      )}
    </div>
  )
}

function MapMetricSelect({
  metrics,
  value,
  onChange,
}: {
  metrics: MapMetric[]
  value: string
  onChange: (id: string) => void
}) {
  const groups = CATEGORY_ORDER.map((c) => ({
    c,
    items: metrics.filter((m) => (m.group === 'all' ? m.indicator.category : 'equality') === c),
  })).filter((g) => g.items.length)
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" className="w-72" aria-label="Map metric">
        <BarChart3 className="size-4 text-muted-foreground" aria-hidden />
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-96">
        {groups.map(({ c, items }) => (
          <SelectGroup key={c}>
            <SelectLabel>{CATEGORY_LABELS[c]}</SelectLabel>
            {items.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}

function MapCard({
  repo,
  model,
  selected,
  onHover,
}: {
  repo: FindexRepository
  model: MapModel
  selected: string | null
  onHover: (c: string | null) => void
}) {
  const navigate = useNavigate()
  const small = useMediaQuery('(max-width: 639px)')
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-2 px-5 pt-4">
        <div>
          <h2 className="text-[15px] font-semibold">
            {model.metric.label}, {model.wave}
          </h2>
          <p className="text-[13px] text-muted-foreground">
            {model.stats.count} of {model.stats.total} economies with data ·{' '}
            {model.metric.indicator.unitLabel}
          </p>
        </div>
      </div>
      <div className="p-2 sm:p-3">
        <WorldMap
          values={model.values}
          scale={model.scale}
          selectedCode={selected}
          onSelect={(code) => {
            const e = repo.entity(code)
            if (e?.kind === 'economy') navigate(`/country/${e.slug}?year=${model.wave}`)
          }}
          onHover={onHover}
          ariaLabel={`World map of ${model.metric.label}, ${model.wave}. Use the table or the country finder for exact values.`}
          renderTooltip={(code, name) => (
            <MapTooltipContent repo={repo} model={model} code={code} name={name} />
          )}
          height={small ? 340 : 560}
          overlay={
            small ? undefined : (
              <MapLegend
                className="absolute bottom-3 left-3 z-10"
                scale={model.scale}
                unit={model.metric.indicator.unit}
                title={model.metric.label}
              />
            )
          }
        />
      </div>
      {small && (
        <div className="px-3 pb-3">
          <MapLegend
            scale={model.scale}
            unit={model.metric.indicator.unit}
            title={model.metric.label}
          />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3">
        <SourceBadge year={model.wave} />
        <p className="text-[11.5px] text-muted-foreground">
          Keyboard: focus the map, then + / − to zoom, arrows to pan, 0 to reset.
        </p>
      </div>
    </Card>
  )
}

function DetailPanel({
  repo,
  model,
  code,
  pinned,
}: {
  repo: FindexRepository
  model: MapModel
  code: string | null
  pinned: boolean
}) {
  const fmt = model.metric.indicator.unit === 'pp' ? formatPP : formatPercent
  const d = code ? economyDetail(repo, code, model.wave) : null

  if (!d || d.entity.kind !== 'economy') {
    const top = model.ranked.slice(0, 5)
    const bottom = model.ranked.slice(-5).reverse()
    return (
      <Card className="space-y-5 p-5">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Across economies
          </p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <p className="text-2xl font-semibold tabular">{fmt(model.stats.median)}</p>
              <p className="text-xs text-muted-foreground">Median economy</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular">{model.stats.count}</p>
              <p className="text-xs text-muted-foreground">Economies with data</p>
            </div>
          </div>
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            Median of economy values, not a population-weighted average.
          </p>
        </div>
        {(['Highest', 'Lowest'] as const).map((label) => (
          <div key={label}>
            <p className="mb-1 text-[13px] font-semibold">{label}</p>
            <BarList
              ariaLabel={`${label} ${model.metric.label}`}
              max={model.metric.indicator.unit === '%' ? 100 : undefined}
              showBars={model.metric.indicator.unit !== 'pp'}
              items={(label === 'Highest' ? top : bottom).map((r) => ({
                key: r.entity.code,
                label: r.entity.shortName,
                value: Math.max(0, r.value),
                display: fmt(r.value),
                href: `/country/${r.entity.slug}`,
                leading: <Flag iso2={r.entity.iso2} code={r.entity.code} className="h-4 w-5" />,
              }))}
            />
          </div>
        ))}
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Hover a country to see its
          details here.
        </p>
      </Card>
    )
  }

  const v = model.values[d.entity.code]
  const regionAvg = d.region ? model.regionAverage[d.region.id] : undefined
  return (
    <Card className="space-y-4 p-5" aria-live="polite">
      <div className="flex items-start gap-3">
        <Flag iso2={d.entity.iso2} code={d.entity.code} className="h-7 w-10" />
        <div className="min-w-0">
          <p className="text-base leading-tight font-semibold">{d.entity.shortName}</p>
          <p className="text-xs text-muted-foreground">
            {d.region?.name} · {d.incomeGroup?.name}
          </p>
        </div>
        {pinned && (
          <Badge variant="accent" className="ml-auto">
            Selected
          </Badge>
        )}
      </div>
      <div className="rounded-xl bg-muted/60 p-4">
        <p className="text-[13px] text-muted-foreground">{model.metric.label}</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight tabular">
          {v === undefined ? MISSING_TEXT : fmt(v)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {v !== undefined && model.rankOf[d.entity.code]
            ? `Rank ${model.rankOf[d.entity.code]} of ${model.stats.count} · `
            : ''}
          {model.wave} wave{d.surveyYear !== model.wave ? ` (surveyed ${d.surveyYear})` : ''}
        </p>
        {regionAvg && regionAvg.value !== null && (
          <p className="mt-2 text-xs text-muted-foreground">
            {regionAvg.name} average:{' '}
            <span className="font-medium text-foreground tabular">{fmt(regionAvg.value)}</span>
          </p>
        )}
      </div>
      <dl className="space-y-2 text-sm">
        {d.rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="font-semibold tabular">{formatPercent(r.value)}</dd>
          </div>
        ))}
      </dl>
      <Button asChild className="w-full">
        <Link to={`/country/${d.entity.slug}?year=${model.wave}`}>
          Open country profile <ArrowRight />
        </Link>
      </Button>
      <SourceBadge year={model.wave} />
    </Card>
  )
}

function Coverage({ model }: { model: MapModel }) {
  if (!model.missing.length) return null
  return (
    <details className="rounded-2xl border bg-card p-5 shadow-card">
      <summary className="cursor-pointer text-sm font-medium">
        {model.missing.length} Findex economies have no {model.wave} value for{' '}
        {model.metric.label.toLowerCase()}
      </summary>
      <p className="mt-2 text-[13px] text-muted-foreground">
        Shown hatched on the map. Economies may not have been surveyed in this wave, or the question
        was not asked there (for example, usage questions in high-income economies in 2024).
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {model.missing.map((e) => (
          <Badge key={e.code} variant="outline">
            {e.shortName}
          </Badge>
        ))}
      </div>
    </details>
  )
}
