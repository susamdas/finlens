import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { ExternalLink, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/states'
import { SourceBadge } from '@/components/common/SourceBadge'
import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/data/indicators/categories'
import type { IndicatorCategory, IndicatorDefinition } from '@/data/types'
import type { FindexRepository } from '@/data/repository'
import { useDataset } from '@/hooks/useDataset'
import { formatCompact } from '@/lib/format'
import { cn } from '@/lib/utils'

const SECTIONS = [
  { id: 'source', label: 'Source' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'classification', label: 'Classification' },
  { id: 'groups', label: 'Population groups' },
  { id: 'catalogue', label: 'Indicators' },
  { id: 'methodology', label: 'FinLens methodology' },
  { id: 'notes', label: 'World Bank notes' },
]

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 space-y-4">
      <div>
        <h2 id={`${id}-h`} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="p-5">
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-[26px] leading-none font-semibold tracking-tight tabular">{value}</p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  )
}

export default function AboutDataPage() {
  const { status, repo, error, retry } = useDataset()
  return (
    <div className="space-y-10">
      <PageHeader
        breadcrumbs={[{ label: 'Data' }, { label: 'About the Data' }]}
        title="About the Data"
        description="Where FinLens data comes from, what it covers, how it is classified, and exactly how FinLens treats it."
        actions={
          repo && (
            <Button asChild variant="outline" size="sm">
              <a href={repo.meta.source.methodologyUrl} target="_blank" rel="noreferrer">
                Findex methodology <ExternalLink />
              </a>
            </Button>
          )
        }
      />
      {status === 'error' && (
        <ErrorState
          title="The dataset could not be loaded."
          description={error ?? undefined}
          onRetry={() => void retry()}
        />
      )}
      {(status === 'loading' || status === 'idle') && <LoadingSkeleton variant="text" rows={8} />}
      {repo && <AboutContent repo={repo} />}
    </div>
  )
}

function AboutContent({ repo }: { repo: FindexRepository }) {
  const { meta } = repo
  const latest = repo.latestWave
  const economies = repo.economies()
  const adultsLatest = economies.reduce((n, e) => n + (repo.population(e.code, latest) ?? 0), 0)
  const remapped = Object.entries(meta.surveyYears)
    .map(([code, byWave]) => ({
      entity: repo.entity(code)!,
      wave: Number(Object.keys(byWave)[0]),
      year: Object.values(byWave)[0]!,
    }))
    .sort((a, b) => a.entity.shortName.localeCompare(b.entity.shortName))
  const catalogueSize = repo.indicators().length

  return (
    <div className="grid gap-10 xl:grid-cols-[180px_minmax(0,1fr)]">
      <nav aria-label="On this page" className="hidden xl:block">
        <ul className="sticky top-24 space-y-1 border-l text-[13px]">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="-ml-px block border-l border-transparent py-1 pl-3 text-muted-foreground hover:border-primary hover:text-foreground"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 space-y-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Economies"
            value={economies.length}
            hint={`${meta.coverage[String(latest)] ?? '—'} surveyed in ${latest}`}
          />
          <Stat
            label="Survey waves"
            value={meta.waves.length}
            hint={`${meta.waves[0]}–${latest}`}
          />
          <Stat
            label="Indicators"
            value={catalogueSize}
            hint={`${repo.indicators({ core: true }).length} curated · rest in the full catalogue`}
          />
          <Stat
            label={`Adults represented, ${latest}`}
            value={formatCompact(adultsLatest)}
            hint="Sum of adult (15+) populations of surveyed economies"
          />
        </div>

        <Section id="source" title="Source">
          <Card className="space-y-3 p-5 text-sm">
            <p>
              <span className="font-medium">{meta.source.edition}</span>, published by the World
              Bank. FinLens is built from the file{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">{meta.source.file}</code>
              {meta.source.release && <> (latest update in file: {meta.source.release})</>}.
            </p>
            <p className="text-muted-foreground">Citation: {meta.source.citation}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild size="sm" variant="outline">
                <a href={meta.source.url} target="_blank" rel="noreferrer">
                  Global Findex <ExternalLink />
                </a>
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={meta.source.termsUrl} target="_blank" rel="noreferrer">
                  Terms of use (World Bank Data Catalog) <ExternalLink />
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              FinLens dataset built {new Date(meta.builtAt).toLocaleString()}.
            </p>
          </Card>
        </Section>

        <Section
          id="coverage"
          title="Survey waves & coverage"
          description="The Global Findex surveys nationally representative samples of adults (age 15+), roughly every three years. Coverage varies by wave."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Wave</TableHead>
                    <TableHead className="text-right">Economies with data</TableHead>
                    <TableHead className="w-1/2">
                      <span className="sr-only">Relative coverage</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meta.waves.map((w) => {
                    const n = meta.coverage[String(w)] ?? 0
                    return (
                      <TableRow key={w}>
                        <TableCell className="font-medium">{w}</TableCell>
                        <TableCell className="text-right">{n}</TableCell>
                        <TableCell>
                          <div className="h-2 rounded-full bg-muted" aria-hidden>
                            <div
                              className="h-2 rounded-full bg-chart-1"
                              style={{ width: `${(n / economies.length) * 100}%` }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Card>
            <Card className="space-y-3 p-5 text-sm">
              <p className="font-medium">
                Economies surveyed in {remapped[0]?.year ?? 2022} are counted in the{' '}
                {remapped[0]?.wave ?? 2021} wave
              </p>
              <p className="text-muted-foreground">
                For these economies, fieldwork for the 2021 edition took place in 2022. The World
                Bank publishes them in the 2021 data; FinLens does the same and labels the actual
                survey year wherever these values appear.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {remapped.map((r) => (
                  <Badge key={r.entity.code} variant="outline">
                    {r.entity.shortName}
                  </Badge>
                ))}
              </div>
              <p className="text-muted-foreground">
                Waves are not always evenly spaced and some economies miss a wave. Change figures
                always name the two waves being compared.
              </p>
              <p className="font-medium">Questions not asked in 2024 are shown as missing</p>
              <p className="text-muted-foreground">
                In 2024 the World Bank asked questions on financial use and financial health only in
                low- and middle-income economies. Where the file nonetheless records 0% for most
                high-income economies on such a question (credit card ownership and the two
                emergency-funds questions), FinLens treats those zeros as “not collected” rather
                than as a real 0%. All other values are shown exactly as published.
              </p>
            </Card>
          </div>
        </Section>

        <Section
          id="classification"
          title="Regions & income groups"
          description="FinLens uses the region and income-group classification coded in the Findex file (2024 World Bank groupings). Regional aggregates cover developing economies only; high-income economies form their own group."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Region</TableHead>
                    <TableHead className="text-right">Economies</TableHead>
                    <TableHead>Scope</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repo.regions.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right">{r.economies}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.excludesHighIncome
                          ? 'Excluding high income'
                          : 'All high-income economies'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Income group</TableHead>
                    <TableHead className="text-right">Economies</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repo.incomeGroups.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{g.name}</TableCell>
                      <TableCell className="text-right">{g.economies}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="border-t px-3 py-3 text-xs text-muted-foreground">
                Regional, income-group, developing-economy and world figures are the World Bank’s
                published aggregates (weighted averages, per the Findex Series Table), not FinLens
                calculations.
              </p>
            </Card>
          </div>
        </Section>

        <Section
          id="groups"
          title="Population groups"
          description="Most indicators are also published for pairs of population groups. FinLens measures an inclusion gap as the difference between the two, in percentage points."
        >
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dimension</TableHead>
                  <TableHead>Groups</TableHead>
                  <TableHead>Gap (percentage points)</TableHead>
                  <TableHead>Waves available</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repo.breakdowns.map((b) => {
                  const label = (id: string) => meta.groups.find((g) => g.id === id)?.label ?? id
                  const waves = meta.groups.find((g) => g.id === b.disadvantaged)?.waves ?? []
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.label}</TableCell>
                      <TableCell>
                        {label(b.advantaged)} · {label(b.disadvantaged)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {label(b.advantaged)} − {label(b.disadvantaged)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {waves.length === meta.waves.length
                          ? 'All waves'
                          : waves.length === 1
                            ? `${waves[0]} only`
                            : waves.join(', ')}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
        </Section>

        <Section
          id="catalogue"
          title="Indicator catalogue"
          description="Every series in the Findex file, with the World Bank’s own definitions. Curated indicators power the dashboards; the rest are available in the Data Explorer."
        >
          <IndicatorCatalogue repo={repo} />
        </Section>

        <Section id="methodology" title="How FinLens treats the data">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              [
                'No invented values',
                'Values are shown exactly as published (converted from shares to percentages). Gaps in the source stay gaps and show as “Data unavailable”. Nothing is interpolated or imputed.',
              ],
              [
                'Rounding',
                'Stored to 2 decimals; displayed to 1 decimal. Changes are computed from stored values, then rounded.',
              ],
              [
                'Changes over time',
                'Measured in percentage points between two named waves, normally the current wave and the previous wave with data.',
              ],
              [
                'Benchmarks',
                'A country is compared with its Findex region, its income group and the world, using World Bank aggregates. “Near” means within ±2 percentage points.',
              ],
              [
                'Derived indicators',
                'A few FinLens metrics are simple formulas over published values and are always labelled as FinLens-computed (listed below).',
              ],
              [
                'Forecasts & composite index',
                'Statistical projections and the Experimental FinLens Inclusion Index are FinLens outputs, not World Bank figures. Their methods are documented where they appear.',
              ],
              [
                'Correlation',
                'Relationships between indicators across countries describe association only. Correlation does not imply causation.',
              ],
              [
                '2024 coverage',
                'In the 2025 edition, questions on financial use and financial health were asked only in low- and middle-income economies, so many usage indicators have no 2024 value for high-income economies.',
              ],
            ].map(([t, d]) => (
              <Card key={t} className="p-5">
                <p className="text-sm font-semibold">{t}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{d}</p>
              </Card>
            ))}
          </div>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>FinLens-derived indicator</TableHead>
                  <TableHead>Formula</TableHead>
                  <TableHead>Unit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repo
                  .indicators()
                  .filter((i) => i.derived)
                  .map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium whitespace-normal">{i.label}</TableCell>
                      <TableCell className="whitespace-normal text-muted-foreground">
                        {i.derived!.formula}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{i.unitLabel}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </Section>

        <Section
          id="notes"
          title="Notes from the World Bank"
          description="Reproduced from the Notes and Updates sheets of the Findex file."
        >
          <Card className="p-5">
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed [overflow-wrap:anywhere]">
              {meta.notes.map((n) => (
                <li key={n}>
                  <Linkified text={n} />
                </li>
              ))}
            </ol>
          </Card>
          {meta.updates.length > 0 && (
            <details className="rounded-2xl border bg-card p-5 shadow-card">
              <summary className="cursor-pointer text-sm font-medium">
                Update log ({meta.updates.length} changes)
              </summary>
              <ul className="mt-3 space-y-1 text-[13px] text-muted-foreground">
                {meta.updates.map((u, i) => (
                  <li key={i}>
                    <span className="text-foreground">{u.release}</span> ·{' '}
                    <code className="text-xs">{u.series}</code> — {u.change}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <SourceBadge />
        </Section>
      </div>
    </div>
  )
}

/** Renders plain text with any http(s) URLs as links (text from the Findex Notes sheet). */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g)
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline underline-offset-2 hover:decoration-2"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  )
}

const PAGE_SIZE = 20

function IndicatorCatalogue({ repo }: { repo: FindexRepository }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<IndicatorCategory | 'all'>('all')
  const [scope, setScope] = useState<'core' | 'all'>('core')
  const [page, setPage] = useState(0)
  const q = useDeferredValue(query.trim().toLowerCase())

  const rows = useMemo(() => {
    const list = repo.indicators(scope === 'core' ? { core: true } : {})
    return list
      .filter((i) => category === 'all' || i.category === category)
      .filter(
        (i) =>
          !q ||
          `${i.label} ${i.shortLabel} ${i.code ?? ''} ${i.definition}`.toLowerCase().includes(q),
      )
      .sort(
        (a, b) =>
          CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
          a.label.localeCompare(b.label),
      )
  }, [repo, q, category, scope])

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const visible = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(0)
            }}
            placeholder="Search indicators, codes or definitions…"
            aria-label="Search indicators"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v as IndicatorCategory | 'all')
              setPage(0)
            }}
          >
            <SelectTrigger className="w-48" aria-label="Category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORY_ORDER.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ToggleGroup
            type="single"
            value={scope}
            onValueChange={(v) => {
              if (v) {
                setScope(v as 'core' | 'all')
                setPage(0)
              }
            }}
            aria-label="Catalogue scope"
          >
            <ToggleGroupItem value="core">Curated</ToggleGroupItem>
            <ToggleGroupItem value="all">All series</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      {visible.length === 0 ? (
        <div className="p-4">
          <EmptyState title="No indicators match your search." />
        </div>
      ) : (
        <Table>
          <caption className="sr-only">Global Findex indicators</caption>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-72">Indicator</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Share of</TableHead>
              <TableHead>Waves</TableHead>
              <TableHead>Code</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((i) => (
              <IndicatorRow key={i.id} indicator={i} />
            ))}
          </TableBody>
        </Table>
      )}
      <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground">
        <span className="tabular">
          {rows.length === 0 ? 0 : current * PAGE_SIZE + 1}–
          {Math.min(rows.length, (current + 1) * PAGE_SIZE)} of {rows.length}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </Card>
  )
}

function shareOf(i: IndicatorDefinition): string {
  if (i.unit === 'pp') return 'Percentage points'
  if (i.denominator === 'adults age 15+') return 'All adults'
  return i.denominator.replace(/^of /, '')
}

function IndicatorRow({ indicator: i }: { indicator: IndicatorDefinition }) {
  return (
    <TableRow className="align-top">
      <TableCell className="py-3 whitespace-normal">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium">{i.shortLabel}</span>
          {i.derived && <Badge variant="warning">FinLens-derived</Badge>}
        </div>
        {i.shortLabel !== i.label && (
          <p className="mt-0.5 text-[13px] text-foreground/80">{i.label}</p>
        )}
        <p
          className="mt-1 line-clamp-2 max-w-2xl text-xs text-muted-foreground"
          title={i.definition}
        >
          {i.definition}
        </p>
      </TableCell>
      <TableCell className="py-3">
        <Badge variant="secondary">{CATEGORY_LABELS[i.category]}</Badge>
      </TableCell>
      <TableCell className="py-3 text-muted-foreground">{shareOf(i)}</TableCell>
      <TableCell className={cn('py-3 text-muted-foreground', !i.coverage && 'italic')}>
        {i.coverage
          ? i.coverage.firstWave === i.coverage.lastWave
            ? i.coverage.firstWave
            : `${i.coverage.firstWave}–${i.coverage.lastWave}`
          : '—'}
      </TableCell>
      <TableCell className="py-3">
        {i.code ? (
          <code className="text-xs text-muted-foreground">{i.code}</code>
        ) : (
          <span className="text-xs text-muted-foreground">computed</span>
        )}
      </TableCell>
    </TableRow>
  )
}
