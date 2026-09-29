import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  GitCompareArrows,
  Globe2,
  HandCoins,
  Landmark,
  PiggyBank,
  Smartphone,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CountryProfileHeader } from '@/components/profile/CountryProfileHeader'
import { BenchmarkStrip } from '@/components/profile/BenchmarkStrip'
import { GapRows } from '@/components/profile/GapRows'
import { KPICard } from '@/components/charts/KPICard'
import { ChartCard } from '@/components/charts/ChartCard'
import { TrendChart, SeriesLegend } from '@/components/charts/TrendChart'
import { InsightCard } from '@/components/common/InsightCard'
import { BenchmarkStatus } from '@/components/common/BenchmarkStatus'
import { ExportMenu } from '@/components/common/ExportMenu'
import { YearSelector } from '@/components/common/YearSelector'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/states'
import { chartVar } from '@/design/palette'
import type { FindexRepository } from '@/data/repository'
import { useDataset, useEnsureData } from '@/hooks/useDataset'
import { useFilters } from '@/hooks/useFilters'
import { countryInsights } from '@/lib/insights/country'
import { formatCompact, formatDecimal, formatPercent, formatPP, MISSING_GLYPH } from '@/lib/format'
import {
  BENCHMARK_LABELS,
  benchmarkMatrix,
  buildProfile,
  demographics,
  HISTORY_GROUPS,
  type BenchmarkKind,
  type CountryProfile,
  type ScoreRow,
} from './profile.logic'

const KPI_ICONS: Record<string, React.ReactNode> = {
  accountOwnership: <Landmark />,
  mobileMoneyAccount: <Smartphone />,
  digitalPayments: <Wallet />,
  formalSavings: <PiggyBank />,
  formalBorrowing: <HandCoins />,
  genderGapAccount: <Users />,
}

const DEMO_INDICATORS = [
  'accountOwnership',
  'mobileMoneyAccount',
  'digitalPayments',
  'formalSavings',
  'borrowedAny',
] as const

export default function CountryProfilePage() {
  const { slug = '' } = useParams()
  const { repo, status, error, retry } = useDataset()
  const entity = repo?.entityBySlug(decodeURIComponent(slug))

  if (status === 'error')
    return (
      <ErrorState
        title="The dataset could not be loaded."
        description={error ?? undefined}
        onRetry={() => void retry()}
      />
    )
  if (!repo) return <LoadingSkeleton variant="chart" />
  if (!entity)
    return (
      <div className="space-y-6">
        <h1 id="page-title" tabIndex={-1} className="text-2xl font-semibold outline-none">
          Country not found
        </h1>
        <EmptyState
          title={`“${slug}” is not an economy in the Global Findex dataset.`}
          description="Check the spelling, or browse the list of countries."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/countries">All countries</Link>
            </Button>
          }
        />
      </div>
    )
  return <Profile repo={repo} code={entity.code} />
}

function Profile({ repo, code }: { repo: FindexRepository; code: string }) {
  const entity = repo.entity(code)!
  const navigate = useNavigate()
  const { filters, setFilters } = useFilters()
  const [params, setParams] = useSearchParams()
  const benchmarkParam = (params.get('benchmark') as BenchmarkKind | null) ?? 'region'
  const benchmarkKind: BenchmarkKind = ['region', 'income', 'world'].includes(benchmarkParam)
    ? benchmarkParam
    : 'region'

  const profile = useMemo(
    () => buildProfile(repo, entity, { wave: filters.year, benchmark: benchmarkKind }),
    [repo, entity, filters.year, benchmarkKind],
  )
  const insights = useMemo(
    () => countryInsights(repo, entity, profile.wave, profile.benchmark.code),
    [repo, entity, profile.wave, profile.benchmark.code],
  )

  const setBenchmark = (k: BenchmarkKind) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        if (k === 'region') n.delete('benchmark')
        else n.set('benchmark', k)
        return n
      },
      { replace: true, preventScrollReset: true },
    )

  return (
    <div className="space-y-6">
      <CountryProfileHeader
        entity={entity}
        region={profile.region}
        incomeGroup={profile.incomeGroup}
        population={profile.population}
        wave={profile.wave}
        surveyYear={profile.surveyYear}
        controls={
          <>
            <YearSelector
              years={profile.availableWaves.length ? profile.availableWaves : repo.waves}
              value={profile.wave}
              onChange={(y) =>
                setFilters({
                  year: y === profile.availableWaves[profile.availableWaves.length - 1] ? null : y,
                })
              }
            />
            <Select value={benchmarkKind} onValueChange={(v) => setBenchmark(v as BenchmarkKind)}>
              <SelectTrigger size="sm" className="w-56" aria-label="Benchmark">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(profile.benchmarks) as BenchmarkKind[]).map((k) =>
                  profile.benchmarks[k] ? (
                    <SelectItem key={k} value={k}>
                      vs {profile.benchmarks[k]!.name}
                    </SelectItem>
                  ) : null,
                )}
              </SelectContent>
            </Select>
          </>
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to={`/focus/${entity.slug}`}>
                <BookOpen /> Read the story
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/compare?country=${entity.code}`}>
                <GitCompareArrows /> Compare
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/map?country=${entity.code}&year=${profile.wave}`}>
                <Globe2 /> Map
              </Link>
            </Button>
            <ExportMenu />
          </>
        }
      />

      {profile.availableWaves.length === 0 && (
        <EmptyState
          title={`${entity.shortName} has no account-ownership data in the Findex file.`}
        />
      )}

      {/* KPIs */}
      <section aria-label="Key indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {profile.kpis.map((k) => (
          <KPICard
            key={k.indicator.id}
            label={k.indicator.shortLabel}
            icon={KPI_ICONS[k.indicator.id]}
            value={k.value}
            unit={k.indicator.unit === 'pp' ? 'pp' : '%'}
            delta={k.delta}
            higherIsBetter={k.indicator.higherIsBetter}
            comparisonLabel={k.previous ? `vs ${k.previous.wave}` : undefined}
            series={k.series.map((p) => ({ year: p.wave, value: p.value }))}
            description={k.indicator.definition}
            missingNote={
              k.value === null
                ? `Not published for ${entity.shortName} in ${profile.wave}.`
                : undefined
            }
            note={
              k.benchmark !== null ? (
                <>
                  {profile.benchmark.name}:{' '}
                  <span className="font-medium text-foreground tabular">
                    {k.indicator.unit === 'pp' ? formatPP(k.benchmark) : formatPercent(k.benchmark)}
                  </span>
                </>
              ) : (
                `${profile.benchmark.name}: not published`
              )
            }
          />
        ))}
      </section>

      {/* Insights, strengths, gaps */}
      <div className="grid gap-6 xl:grid-cols-12">
        <Card className="p-5 xl:col-span-7">
          <h2 className="mb-3 text-[15px] font-semibold">What the data shows</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {insights.slice(0, 6).map((i) => (
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
                Not enough data for {profile.wave} to generate insights.
              </p>
            )}
          </div>
        </Card>
        <div className="grid min-w-0 gap-6 xl:col-span-5">
          <StrengthGapList
            title="Strengths"
            icon={<TrendingUp className="size-4 text-positive" />}
            rows={profile.strengths}
            profile={profile}
            empty="No indicators clearly above the benchmark."
          />
          <StrengthGapList
            title="Inclusion gaps"
            icon={<AlertTriangle className="size-4 text-warning" />}
            rows={profile.gaps}
            profile={profile}
            empty="No indicators clearly below the benchmark."
          />
        </div>
      </div>

      {/* Historical progress */}
      <div className="grid gap-6 lg:grid-cols-2">
        {HISTORY_GROUPS.map((g) => {
          const series = g.ids.flatMap((id, i) => {
            const ind = repo.indicator(id)
            return ind
              ? [
                  {
                    id,
                    label: ind.shortLabel,
                    color: chartVar(i),
                    points: repo.series(id, entity.code),
                  },
                ]
              : []
          })
          const hasData = series.some((s) => s.points.some((p) => p.value !== null))
          return (
            <ChartCard
              key={g.title}
              title={`Historical progress: ${g.title.toLowerCase()}`}
              description={`${entity.shortName}, survey waves ${repo.waves[0]}–${repo.latestWave}`}
              status={hasData ? 'ready' : 'empty'}
              table={{
                caption: `${entity.shortName}: ${g.title}`,
                columns: ['Wave', ...series.map((s) => s.label)],
                rows: repo.waves.map((w, i) => [
                  w,
                  ...series.map((s) => formatPercent(s.points[i]?.value ?? null)),
                ]),
              }}
            >
              <TrendChart waves={repo.waves} highlightWave={profile.wave} series={series} />
              <SeriesLegend items={series.map((s) => ({ label: s.label, color: s.color }))} />
            </ChartCard>
          )
        })}
      </div>

      {/* Benchmarks */}
      <div className="grid items-start gap-6 xl:grid-cols-12">
        <ChartCard
          className="xl:col-span-5"
          title="Regional benchmark"
          description={`${entity.shortName} against its region, income group and the world, ${profile.wave}`}
          sourceYear={profile.wave}
          footnote="Benchmarks are World Bank published aggregates"
        >
          <BenchmarkStrip
            countryName={entity.shortName}
            rows={benchmarkMatrix(repo, profile, [
              'accountOwnership',
              'mobileMoneyAccount',
              'digitalPayments',
              'formalSavings',
              'formalBorrowing',
              'debitCard',
            ])}
          />
        </ChartCard>
        <Scorecard profile={profile} />
      </div>

      {/* Demographics */}
      <Demographics repo={repo} code={entity.code} wave={profile.wave} name={entity.shortName} />
    </div>
  )
}

function StrengthGapList({
  title,
  icon,
  rows,
  profile,
  empty,
}: {
  title: string
  icon: React.ReactNode
  rows: ScoreRow[]
  profile: CountryProfile
  empty: string
}) {
  return (
    <Card className="p-5">
      <h2 className="mb-1 flex items-center gap-2 text-[15px] font-semibold">
        {icon} {title}
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Compared with the {profile.benchmark.name} average, {profile.wave}. More than ±2 pp counts.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.indicator.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{r.indicator.shortLabel}</span>
              <span className="shrink-0 text-right tabular">
                <span className="font-semibold">
                  {r.indicator.unit === 'pp' ? formatPP(r.value) : formatPercent(r.value)}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {formatPP(r.diff)} vs{' '}
                  {r.indicator.unit === 'pp' ? formatPP(r.benchmark) : formatPercent(r.benchmark)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Scorecard({ profile }: { profile: CountryProfile }) {
  return (
    <ChartCard
      className="xl:col-span-7"
      title="Inclusion scorecard"
      description={`Position relative to the ${BENCHMARK_LABELS[profile.benchmark.kind].toLowerCase()} (${profile.benchmark.name}), ${profile.wave}. Descriptive — not a ranking of policy performance.`}
      sourceYear={profile.wave}
      contentClassName="px-0 py-0"
    >
      <Table>
        <caption className="sr-only">Inclusion scorecard</caption>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5">Indicator</TableHead>
            <TableHead className="text-right">{profile.entity.shortName}</TableHead>
            <TableHead className="text-right">Benchmark</TableHead>
            <TableHead className="pr-5">vs benchmark</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profile.scorecard.map((r) => {
            const fmt = r.indicator.unit === 'pp' ? formatPP : formatPercent
            return (
              <TableRow key={r.indicator.id}>
                <TableCell className="max-w-56 truncate pl-5 font-medium" title={r.indicator.label}>
                  {r.indicator.shortLabel}
                </TableCell>
                <TableCell className="text-right">{fmt(r.value)}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {fmt(r.benchmark)}
                </TableCell>
                <TableCell className="pr-5">
                  <BenchmarkStatus
                    compact
                    status={r.status}
                    higherIsBetter={r.indicator.higherIsBetter}
                    benchmarkName={profile.benchmark.name}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </ChartCard>
  )
}

function Demographics({
  repo,
  code,
  wave,
  name,
}: {
  repo: FindexRepository
  code: string
  wave: number
  name: string
}) {
  const [indicator, setIndicator] = useState<string>('accountOwnership')
  const { ready, error } = useEnsureData({ groups: true })
  const rows = useMemo(
    () => (ready ? demographics(repo, code, wave, indicator) : []),
    [ready, repo, code, wave, indicator],
  )
  const def = repo.indicator(indicator)
  return (
    <ChartCard
      title="Demographic analysis"
      description={`${def?.shortLabel ?? ''} by population group, ${name}, ${wave}. Gap = second group − first group, in percentage points.`}
      status={
        error ? 'error' : !ready ? 'loading' : rows.some((r) => r.gap !== null) ? 'ready' : 'empty'
      }
      emptyMessage="Group data are not published for this indicator and year (the World Bank publishes them only where the all-adult value exceeds 10%)."
      sourceYear={wave}
      actions={
        <ToggleGroup
          type="single"
          value={indicator}
          onValueChange={(v) => v && setIndicator(v)}
          aria-label="Indicator"
          className="hidden md:inline-flex"
        >
          {DEMO_INDICATORS.map((id) => (
            <ToggleGroupItem key={id} value={id} className="text-xs">
              {repo
                .indicator(id)
                ?.shortLabel.replace(' account', '')
                .replace('Made or received a digital payment', 'Digital payments')}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      }
      table={{
        caption: `${def?.label} by population group`,
        columns: ['Breakdown', 'Group A', 'Value A', 'Group B', 'Value B', 'Gap (pp)'],
        rows: rows.map((r) => [
          r.label,
          r.a.label,
          formatPercent(r.a.value),
          r.b.label,
          formatPercent(r.b.value),
          r.gap === null ? MISSING_GLYPH : formatDecimal(r.gap, 1),
        ]),
      }}
    >
      <div className="mb-3 md:hidden">
        <Select value={indicator} onValueChange={setIndicator}>
          <SelectTrigger size="sm" className="w-full" aria-label="Indicator">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEMO_INDICATORS.map((id) => (
              <SelectItem key={id} value={id}>
                {repo.indicator(id)?.shortLabel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <GapRows rows={rows} />
      {repo.population(code, wave) !== null && (
        <p className="mt-3 text-xs text-muted-foreground">
          Adults (15+) in {wave}: {formatCompact(repo.population(code, wave))}. Location
          (rural/urban) was published only for{' '}
          {repo.meta.groups.find((g) => g.id === 'rural')?.waves.join(', ')}.
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <Button asChild variant="link" size="sm">
          <Link to={`/gaps?country=${code}`}>
            Open Inclusion Gap Analyzer <ArrowRight />
          </Link>
        </Button>
      </div>
    </ChartCard>
  )
}
