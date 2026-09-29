import { useMemo, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowRight, FlaskConical, GitCompareArrows } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BarList } from '@/components/charts/BarList'
import { SeriesLegend, TrendChart } from '@/components/charts/TrendChart'
import { GapRows } from '@/components/profile/GapRows'
import { CountrySelector } from '@/components/common/CountrySelector'
import { DeltaIndicator } from '@/components/common/DeltaIndicator'
import { ExportMenu } from '@/components/common/ExportMenu'
import { Flag } from '@/components/common/Flag'
import { InsightCard } from '@/components/common/InsightCard'
import { SourceBadge } from '@/components/common/SourceBadge'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/states'
import { chartVar } from '@/design/palette'
import type { Entity } from '@/data/types'
import type { FindexRepository } from '@/data/repository'
import { useDataset, useEnsureData } from '@/hooks/useDataset'
import { useReferenceData } from '@/hooks/useReferenceData'
import { formatPercent, formatPP, MISSING_GLYPH } from '@/lib/format'
import { buildFocus, focusLede, type FocusChange } from './focus.logic'

export default function CountryFocusPage() {
  const { slug = '' } = useParams()
  const { repo, status, error, retry } = useDataset()
  const groups = useEnsureData({ groups: true })
  const entity = repo?.entityBySlug(slug)
  if (status === 'error')
    return (
      <ErrorState
        title="The dataset could not be loaded."
        description={error ?? undefined}
        onRetry={() => void retry()}
      />
    )
  if (!repo) return <LoadingSkeleton variant="chart" />
  if (!entity) return <UnknownEconomy slug={slug} />
  return <Focus repo={repo} entity={entity} groupsReady={groups.ready} />
}

function UnknownEconomy({ slug }: { slug: string }) {
  const navigate = useNavigate()
  const { countries } = useReferenceData()
  return (
    <div className="mx-auto max-w-lg space-y-4 py-10">
      <EmptyState
        title={`No economy called “${slug}” in the Global Findex.`}
        description="Choose an economy to read its story."
      />
      <CountrySelector
        options={countries}
        onChange={(c) => {
          const e = countries.find((o) => o.code === c)
          if (e) navigate(`/focus/${e.slug}`)
        }}
        className="w-full"
      />
    </div>
  )
}

function Focus({
  repo,
  entity,
  groupsReady,
}: {
  repo: FindexRepository
  entity: Entity
  groupsReady: boolean
}) {
  const navigate = useNavigate()
  const { countries } = useReferenceData()
  const m = useMemo(() => buildFocus(repo, entity, groupsReady), [repo, entity, groupsReady])

  return (
    <article className="mx-auto max-w-5xl space-y-10">
      <header className="relative overflow-hidden rounded-3xl border bg-card p-6 shadow-card sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            Country focus
          </p>
          <div className="flex flex-wrap gap-2">
            <CountrySelector
              options={countries}
              value={entity.code}
              onChange={(c) => {
                const e = countries.find((o) => o.code === c)
                if (e) navigate(`/focus/${e.slug}`)
              }}
              className="w-48"
            />
            <ExportMenu />
          </div>
        </div>
        <div className="mt-6 flex items-center gap-4">
          <Flag iso2={entity.iso2} code={entity.code} className="h-10 w-14 rounded-md shadow-sm" />
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {entity.shortName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {[
                m.regionName,
                repo.incomeGroup(entity.incomeGroupId ?? '')?.name,
                `Latest survey ${m.surveyYear}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-pretty">{focusLede(m)}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to={`/country/${entity.slug}`}>
              Full profile <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to={`/compare?country=${entity.code}`}>
              <GitCompareArrows /> Compare with peers
            </Link>
          </Button>
        </div>
      </header>

      <Chapter n={1} title="The journey so far">
        <Prose lines={m.journey.narrative} />
        <Card className="p-5">
          <TrendChart
            waves={repo.waves}
            height={280}
            series={m.journey.series.map((s, i) => ({
              id: s.id,
              label: s.label,
              color: i === 0 ? 'var(--chart-1)' : chartVar(i + 1),
              points: s.points,
              muted: i > 0,
            }))}
          />
          <SeriesLegend
            items={m.journey.series.map((s, i) => ({
              label: s.label,
              color: i === 0 ? 'var(--chart-1)' : chartVar(i + 1),
              muted: i > 0,
            }))}
          />
        </Card>
      </Chapter>

      <Chapter n={2} title={`What changed in ${m.wave}`}>
        {m.changes.rises.length + m.changes.falls.length === 0 ? (
          <p className="text-muted-foreground">No earlier survey to compare with.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <ChangeList title="Rose most" items={m.changes.rises} />
            <ChangeList title="Fell most" items={m.changes.falls} />
          </div>
        )}
      </Chapter>

      <Chapter n={3} title="Who is left behind">
        <p className="text-muted-foreground">
          Account ownership for each pair of population groups in {m.wave}, and whether the gap
          narrowed or widened since the previous survey.
        </p>
        <Card className="p-5">
          {m.demographics.length ? (
            <GapRows rows={m.demographics} />
          ) : (
            <p className="text-sm text-muted-foreground">Loading group values…</p>
          )}
        </Card>
      </Chapter>

      <Chapter n={4} title="Digital routes">
        <Prose
          lines={[
            m.digital.fi !== null && m.digital.mobileOnly !== null && m.digital.account !== null
              ? `${formatPercent(m.digital.fi)} of adults have an account at a financial institution and a further ${formatPercent(m.digital.mobileOnly)} are included only through mobile money.`
              : '',
            m.digital.payments !== null
              ? `${formatPercent(m.digital.payments)} made or received a digital payment${m.digital.regionPayments !== null ? `, compared with ${formatPercent(m.digital.regionPayments)} across ${m.regionName}` : ''}.`
              : '',
          ].filter(Boolean)}
        />
        {m.digital.account !== null && m.digital.fi !== null && (
          <Card className="p-5">
            <div
              className="flex h-4 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`Financial institution ${formatPercent(m.digital.fi)}, mobile money only ${formatPercent(m.digital.mobileOnly)}, no account ${formatPercent(100 - m.digital.account)}`}
            >
              <span style={{ width: `${m.digital.fi}%`, background: 'var(--chart-1)' }} />
              <span
                style={{ width: `${m.digital.mobileOnly ?? 0}%`, background: 'var(--chart-3)' }}
                className="border-l-2 border-card"
              />
            </div>
            <SeriesLegend
              items={[
                {
                  label: `Financial institution ${formatPercent(m.digital.fi)}`,
                  color: 'var(--chart-1)',
                },
                {
                  label: `Mobile money only ${formatPercent(m.digital.mobileOnly)}`,
                  color: 'var(--chart-3)',
                },
                {
                  label: `No account ${formatPercent(100 - m.digital.account)}`,
                  color: 'var(--muted)',
                },
              ]}
            />
          </Card>
        )}
      </Chapter>

      <Chapter n={5} title="Saving, borrowing and resilience">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-2 text-sm font-semibold">How people save</h3>
            <BarList
              ariaLabel="Saving methods"
              max={100}
              items={m.lens.saving
                .filter((v) => v.value !== null)
                .map((v) => ({
                  key: v.indicator.id,
                  label: v.indicator.shortLabel,
                  value: v.value!,
                  display: formatPercent(v.value),
                }))}
            />
          </Card>
          <Card className="p-5">
            <h3 className="mb-2 text-sm font-semibold">Where people borrow</h3>
            <BarList
              ariaLabel="Borrowing sources"
              max={100}
              items={m.lens.borrowing
                .filter((v) => v.value !== null)
                .map((v) => ({
                  key: v.indicator.id,
                  label: v.indicator.shortLabel,
                  value: v.value!,
                  display: formatPercent(v.value),
                }))}
            />
          </Card>
        </div>
        {m.lens.resilience.some((r) => r.value !== null) && (
          <p className="text-muted-foreground">
            {m.lens.resilience
              .filter((r) => r.value !== null)
              .map((r) => `${r.indicator.shortLabel}: ${formatPercent(r.value)}`)
              .join(' · ')}
          </p>
        )}
        <Link
          to={`/microfinance?country=${entity.code}`}
          className="inline-block text-sm font-medium text-primary hover:underline"
        >
          Open the Microfinance Lens for {entity.shortName} →
        </Link>
      </Chapter>

      <Chapter n={6} title="Looking ahead">
        <Card className="flex gap-3 border-warning/30 bg-warning-soft p-5">
          <FlaskConical className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div className="space-y-2 text-sm">
            {m.outlook.model?.projections.length ? (
              <p>
                If the past pattern continued, the {m.outlook.model.model.label.toLowerCase()} would
                put account ownership at{' '}
                {m.outlook.model.projections
                  .map(
                    (p) =>
                      `~${formatPercent(p.value)} in ${p.year} (80% range ${formatPercent(p.low)}–${formatPercent(p.high)})`,
                  )
                  .join(' and ')}
                .
              </p>
            ) : (
              <p>Too few surveys to project.</p>
            )}
            {m.outlook.unstable && (
              <p className="font-medium">
                The latest survey broke from the earlier pattern, so this projection is especially
                uncertain.
              </p>
            )}
            <p className="text-muted-foreground">
              FinLens projection — not an official World Bank forecast.{' '}
              <Link
                to={`/forecast?country=${entity.code}`}
                className="text-primary hover:underline"
              >
                See the models →
              </Link>
            </p>
          </div>
        </Card>
      </Chapter>

      {m.peers.length > 0 && (
        <Chapter n={7} title="Among its neighbours">
          <Card className="overflow-hidden p-0">
            <Table>
              <caption className="sr-only">Regional peers</caption>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Economy</TableHead>
                  <TableHead className="text-right">Account ownership</TableHead>
                  <TableHead className="text-right">Mobile money</TableHead>
                  <TableHead className="pr-5 text-right">Gender gap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  {
                    entity,
                    account: m.headline.account,
                    mobileMoney: repo.value('mobileMoneyAccount', entity.code, m.wave),
                    genderGap: repo.value('genderGapAccount', entity.code, m.wave),
                  },
                  ...m.peers,
                ].map((p, i) => (
                  <TableRow
                    key={p.entity.code}
                    className={i === 0 ? 'bg-muted/50 font-semibold' : undefined}
                  >
                    <TableCell className="pl-5">
                      <Link
                        to={`/focus/${p.entity.slug}`}
                        className="hit-area flex items-center gap-2 hover:text-primary"
                      >
                        <Flag iso2={p.entity.iso2} code={p.entity.code} className="h-4 w-6" />
                        {p.entity.shortName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular">{formatPercent(p.account)}</TableCell>
                    <TableCell className="text-right tabular">
                      {formatPercent(p.mobileMoney)}
                    </TableCell>
                    <TableCell className="pr-5 text-right tabular">
                      {formatPP(p.genderGap)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <p className="text-xs text-muted-foreground">
            Peers: the most populous economies in the same Findex region, each at its latest survey.
          </p>
        </Chapter>
      )}

      {m.findings.length > 0 && (
        <Chapter n={m.peers.length ? 8 : 7} title="Key findings">
          <div className="grid gap-3 md:grid-cols-2">
            {m.findings.map((f) => (
              <InsightCard
                key={f.id}
                tone={f.tone}
                title={f.title}
                evidence={f.evidence}
                className="shadow-none"
              >
                {f.detail}
              </InsightCard>
            ))}
          </div>
        </Chapter>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs text-muted-foreground">
        <span>
          Every sentence on this page is generated from published Global Findex values for{' '}
          {entity.shortName}; the same template is used for every economy.
        </span>
        <SourceBadge year={m.wave} />
      </footer>
    </article>
  )
}

function Chapter({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`ch-${n}`} className="space-y-4">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-sm text-primary tabular">{String(n).padStart(2, '0')}</span>
        <h2 id={`ch-${n}`} className="text-xl font-semibold tracking-tight">
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}

function Prose({ lines }: { lines: string[] }) {
  if (!lines.length) return null
  return (
    <div className="max-w-3xl space-y-2 text-[15px] leading-relaxed">
      {lines.map((l) => (
        <p key={l}>{l}</p>
      ))}
    </div>
  )
}

function ChangeList({ title, items }: { title: string; items: FocusChange[] }) {
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {items.length ? (
        <ul className="divide-y">
          {items.map((c) => (
            <li
              key={c.indicator.id}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{c.indicator.shortLabel}</span>
                <span className="text-xs text-muted-foreground tabular">
                  {formatPercent(c.previous.value)} ({c.previous.wave}) → {formatPercent(c.value)}
                </span>
              </span>
              <DeltaIndicator
                delta={c.delta}
                higherIsBetter={c.indicator.higherIsBetter}
                comparisonLabel={`vs ${c.previous.wave}`}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {MISSING_GLYPH} No change of 1 point or more.
        </p>
      )}
    </Card>
  )
}
