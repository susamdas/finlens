import { useMemo } from 'react'
import { Link } from 'react-router'
import { HandCoins, Info } from 'lucide-react'
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
import { BarList } from '@/components/charts/BarList'
import { ChartCard } from '@/components/charts/ChartCard'
import { CountrySelector } from '@/components/common/CountrySelector'
import { ExportMenu } from '@/components/common/ExportMenu'
import { Flag } from '@/components/common/Flag'
import { ScopeSelector } from '@/components/common/ScopeSelector'
import { YearSelector } from '@/components/common/YearSelector'
import { ErrorState, LoadingSkeleton } from '@/components/common/states'
import type { FindexRepository } from '@/data/repository'
import { useDataset, useEnsureData } from '@/hooks/useDataset'
import { useFilters } from '@/hooks/useFilters'
import { useReferenceData } from '@/hooks/useReferenceData'
import { scopeParamValue, scopeToFilters } from '@/features/overview/overview.logic'
import { formatPercent, formatPP, MISSING_GLYPH } from '@/lib/format'
import { cn } from '@/lib/utils'
import { buildMicrofinance, type LensValue, type MicrofinanceModel } from './microfinance.logic'

export default function MicrofinancePage() {
  const { repo, status, error, retry } = useDataset()
  const groups = useEnsureData({ groups: true })
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Intelligence' }, { label: 'Microfinance Lens' }]}
        title="Microfinance lens"
        description="Saving, credit and financial resilience for the people microfinance aims to reach — with women and the poorest 40% of households shown alongside everyone."
        actions={<ExportMenu />}
      />
      <Card className="flex gap-3 p-4 text-sm">
        <HandCoins className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">About this lens.</span> The Global Findex
          surveys individuals, not institutions, and does not report microfinance institutions
          separately: “formal” saving and borrowing mean a bank or similar financial institution
          (and, for some questions, mobile money). Informal options — savings clubs, family and
          friends — are shown next to formal ones because both matter for people outside the banking
          system.
        </p>
      </Card>
      {status === 'error' && (
        <ErrorState
          title="The dataset could not be loaded."
          description={error ?? undefined}
          onRetry={() => void retry()}
        />
      )}
      {!repo && status !== 'error' && <LoadingSkeleton variant="chart" />}
      {repo && <Lens repo={repo} groupsReady={groups.ready} />}
    </div>
  )
}

function Lens({ repo, groupsReady }: { repo: FindexRepository; groupsReady: boolean }) {
  const { filters, setFilters } = useFilters()
  const { countries } = useReferenceData()
  const model = useMemo(
    () =>
      buildMicrofinance(repo, {
        wave: filters.year,
        country: filters.country,
        region: filters.region,
        income: filters.income,
      }),
    // groupsReady re-runs the model once breakdown data has arrived.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repo, filters.year, filters.country, filters.region, filters.income, groupsReady],
  )

  return (
    <>
      <div role="group" aria-label="Lens filters" className="flex flex-wrap items-center gap-2">
        <YearSelector
          years={repo.waves}
          value={model.wave}
          onChange={(y) => setFilters({ year: y === repo.latestWave ? null : y })}
        />
        <CountrySelector
          options={countries}
          value={filters.country}
          onChange={(c) => setFilters({ country: c })}
          placeholder="Choose an economy"
          className="w-full sm:w-52"
        />
        {model.target.kind === 'aggregate' ? (
          <ScopeSelector
            regions={repo.regions}
            incomeGroups={repo.incomeGroups}
            value={scopeParamValue(model.target.scope!, repo)}
            onChange={(v) => {
              const f = scopeToFilters(v)
              setFilters({ region: f.region ?? null, income: f.income ?? null })
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
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <LensCard
          title="How people save"
          description="Share of adults who saved in the past year, by method. People can use more than one."
          items={model.saving}
          model={model}
        />
        <LensCard
          title="Where people borrow"
          description="Share of adults who borrowed in the past year, by source. People can use more than one."
          items={model.borrowing}
          model={model}
          extra={
            <>
              <p className="mt-4 mb-1 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Why people borrow
              </p>
              <BarList
                ariaLabel="Borrowing purposes"
                max={100}
                items={model.purpose
                  .filter((p) => p.value !== null)
                  .map((p) => ({
                    key: p.indicator.id,
                    label: p.indicator.shortLabel,
                    value: p.value!,
                    display: formatPercent(p.value),
                  }))}
              />
            </>
          }
        />
      </div>

      <EquityTable model={model} groupsReady={groupsReady} />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <LensCard
          title="Why adults remain without an account"
          description="Reasons given by adults without an account (share of the unbanked). Several reasons can be given."
          items={model.barriers}
          model={model}
        />
        <div className="grid gap-4">
          <LensCard
            title="Resilience"
            description="Could the adult raise emergency funds within 30 days — and was saving the main source?"
            items={model.resilience}
            model={model}
          />
          <ChartCard
            title="Where saving outside banks is most common"
            description={`Economies in ${model.target.kind === 'economy' ? 'the world' : model.target.label} with the highest share saving through informal groups or people, ${model.wave}.`}
            sourceYear={model.wave}
            status={model.informalLeaders.length ? 'ready' : 'empty'}
            emptyMessage="Informal saving is not published for this selection and year."
          >
            <BarList
              ariaLabel="Informal saving leaders"
              max={100}
              items={model.informalLeaders.map((l) => ({
                key: l.entity.code,
                label: l.entity.shortName,
                sublabel: l.formal !== null ? `formal ${formatPercent(l.formal)}` : undefined,
                value: l.value,
                display: formatPercent(l.value),
                href: `/country/${l.entity.slug}`,
                leading: <Flag iso2={l.entity.iso2} code={l.entity.code} className="h-3.5 w-5" />,
              }))}
            />
          </ChartCard>
        </div>
      </div>
    </>
  )
}

function LensCard({
  title,
  description,
  items,
  model,
  extra,
}: {
  title: string
  description: string
  items: LensValue[]
  model: MicrofinanceModel
  extra?: React.ReactNode
}) {
  const shown = items.filter((i) => i.value !== null)
  const missing = items.filter((i) => i.value === null)
  const fallback = shown.find((i) => i.fallback)
  return (
    <ChartCard
      title={title}
      description={`${description} ${model.target.label}, ${model.wave}.`}
      sourceYear={model.wave}
      status={shown.length ? 'ready' : 'empty'}
      emptyMessage={`Not published for ${model.target.label} in ${model.wave}.`}
      footnote={
        [
          fallback ? `${fallback.sourceLabel} aggregate used (World not published).` : '',
          missing.length
            ? `Not published: ${missing.map((m) => m.indicator.shortLabel).join(', ')}.`
            : '',
        ]
          .filter(Boolean)
          .join(' ') || undefined
      }
      table={{
        caption: title,
        columns: ['Indicator', 'Share'],
        rows: items.map((i) => [i.indicator.shortLabel, formatPercent(i.value)]),
      }}
    >
      <BarList
        ariaLabel={title}
        max={100}
        items={shown.map((i) => ({
          key: i.indicator.id,
          label: i.indicator.shortLabel,
          value: i.value!,
          display: formatPercent(i.value),
        }))}
      />
      {extra}
    </ChartCard>
  )
}

function EquityTable({ model, groupsReady }: { model: MicrofinanceModel; groupsReady: boolean }) {
  const gap = (hi: number | null, lo: number | null) =>
    hi !== null && lo !== null ? hi - lo : null
  const gapCell = (g: number | null) =>
    g === null ? (
      <span className="text-muted-foreground">{MISSING_GLYPH}</span>
    ) : (
      <span className={cn('font-semibold tabular', Math.abs(g) >= 5 && g > 0 && 'text-warning')}>
        {formatPP(g)}
      </span>
    )
  return (
    <ChartCard
      title="Who is left out"
      description={`Women compared with men, and the poorest 40% of households compared with the richest 60%, ${model.target.label}, ${model.wave}. Gaps are the better-off group minus the other.`}
      sourceYear={model.wave}
      contentClassName="px-0 py-0"
      footnote="Group values are published only where the all-adult value exceeds 10%; blank cells are not published."
    >
      {!groupsReady && (
        <p className="px-5 py-3 text-sm text-muted-foreground">Loading income-group values…</p>
      )}
      <Table>
        <caption className="sr-only">Women and the poorest 40% compared</caption>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5">Indicator</TableHead>
            <TableHead className="text-right">All adults</TableHead>
            <TableHead className="hidden text-right md:table-cell">Women</TableHead>
            <TableHead className="hidden text-right md:table-cell">Men</TableHead>
            <TableHead className="text-right">Gender gap</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Poorest 40%</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Richest 60%</TableHead>
            <TableHead className="pr-5 text-right">Income gap</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {model.equity.map((r) => (
            <TableRow key={r.indicator.id}>
              <TableCell className="pl-5 font-medium">{r.indicator.shortLabel}</TableCell>
              <TableCell className="text-right tabular">{formatPercent(r.all)}</TableCell>
              <TableCell className="hidden text-right tabular md:table-cell">
                {formatPercent(r.women)}
              </TableCell>
              <TableCell className="hidden text-right tabular md:table-cell">
                {formatPercent(r.men)}
              </TableCell>
              <TableCell className="text-right">{gapCell(gap(r.men, r.women))}</TableCell>
              <TableCell className="hidden text-right tabular lg:table-cell">
                {formatPercent(r.poorest)}
              </TableCell>
              <TableCell className="hidden text-right tabular lg:table-cell">
                {formatPercent(r.richest)}
              </TableCell>
              <TableCell className="pr-5 text-right">
                {gapCell(gap(r.richest, r.poorest))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="flex gap-2 border-t px-5 py-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          Explore every breakdown in{' '}
          <Link to="/gaps" className="text-primary hover:underline">
            Inclusion Gaps
          </Link>
          .
        </span>
      </p>
    </ChartCard>
  )
}
