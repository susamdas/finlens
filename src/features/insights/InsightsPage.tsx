import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PageHeader } from '@/components/layout/PageHeader'
import { ExportMenu } from '@/components/common/ExportMenu'
import { InsightCard } from '@/components/common/InsightCard'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/states'
import type { FindexRepository } from '@/data/repository'
import { useDataset, useEnsureData } from '@/hooks/useDataset'
import {
  CATEGORY_META,
  runInsightEngine,
  type EngineInsight,
  type InsightCategory,
} from '@/lib/insights/engine'

const SCOPES = [
  { id: 'all', label: 'All' },
  { id: 'world', label: 'Global' },
  { id: 'region', label: 'Regions' },
  { id: 'economy', label: 'Economies' },
] as const

export default function InsightsPage() {
  const { repo, status, error, retry } = useDataset()
  const groups = useEnsureData({ groups: true })
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Intelligence' }, { label: 'Insights' }]}
        title="Insights"
        description="Findings generated automatically from the Global Findex by transparent rules. Every card cites the values behind it, and nothing is stated that the data does not show."
        actions={<ExportMenu />}
      />
      {status === 'error' && (
        <ErrorState
          title="The dataset could not be loaded."
          description={error ?? undefined}
          onRetry={() => void retry()}
        />
      )}
      {!repo && status !== 'error' && <LoadingSkeleton variant="kpi" />}
      {repo && <Feed repo={repo} groupsReady={groups.ready} />}
    </div>
  )
}

function Feed({ repo, groupsReady }: { repo: FindexRepository; groupsReady: boolean }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const category = (params.get('category') as InsightCategory | null) ?? null
  const scope = params.get('scope') ?? 'all'

  const feed = useMemo(
    () => runInsightEngine({ repo, wave: repo.latestWave, groupsReady }),
    [repo, groupsReady],
  )
  const filtered = Boolean(category) || scope !== 'all'
  const shown = (filtered ? feed : feed.slice(3)).filter(
    (i) => (!category || i.category === category) && (scope === 'all' || i.scope.kind === scope),
  )
  const counts = useMemo(() => {
    const c: Partial<Record<InsightCategory, number>> = {}
    for (const i of feed) c[i.category] = (c[i.category] ?? 0) + 1
    return c
  }, [feed])

  const set = (k: string, v: string | null) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        if (v === null) n.delete(k)
        else n.set(k, v)
        return n
      },
      { replace: true },
    )

  const top = feed.slice(0, 3)

  return (
    <>
      <section aria-labelledby="top-heading" className="space-y-3">
        <h2 id="top-heading" className="text-[15px] font-semibold">
          Most important right now
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {top.map((i) => (
            <Item key={i.key} i={i} onOpen={i.link ? () => navigate(i.link!) : undefined} />
          ))}
        </div>
      </section>

      <div
        role="group"
        aria-label="Filter insights"
        className="flex flex-col gap-3 rounded-2xl border bg-card p-4 md:flex-row md:items-center md:justify-between"
      >
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={!category} onClick={() => set('category', null)}>
            All topics <span className="text-muted-foreground">{feed.length}</span>
          </FilterChip>
          {(Object.keys(CATEGORY_META) as InsightCategory[])
            .filter((c) => counts[c])
            .map((c) => (
              <FilterChip
                key={c}
                active={category === c}
                onClick={() => set('category', category === c ? null : c)}
                title={CATEGORY_META[c].description}
              >
                {CATEGORY_META[c].label} <span className="text-muted-foreground">{counts[c]}</span>
              </FilterChip>
            ))}
        </div>
        <ToggleGroup
          type="single"
          value={scope}
          onValueChange={(v) => v && set('scope', v === 'all' ? null : v)}
          aria-label="Scope"
          className="rounded-lg border p-0.5"
        >
          {SCOPES.map((s) => (
            <ToggleGroupItem key={s.id} value={s.id}>
              {s.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {shown.length ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((i) => (
            <Item key={i.key} i={i} onOpen={i.link ? () => navigate(i.link!) : undefined} />
          ))}
        </div>
      ) : (
        <EmptyState title="No insights match these filters." />
      )}

      <Card className="flex gap-3 p-5 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <span className="font-medium text-foreground">How this works.</span> A fixed set of rules
          runs over the latest survey wave ({repo.latestWave}) — changes since the previous survey,
          gaps between groups, digital channels, saving and borrowing, resilience and long-run
          trends. Rules without the data they need produce nothing. Findings are descriptive: they
          report what the survey shows, not why.
          {!groupsReady && ' Breakdowns beyond women and men are still loading.'}
        </p>
      </Card>
    </>
  )
}

function Item({ i, onOpen }: { i: EngineInsight; onOpen?: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">{CATEGORY_META[i.category].label}</Badge>
        <Badge variant="outline">{i.scope.label}</Badge>
      </div>
      <InsightCard
        tone={i.tone}
        title={i.title}
        evidence={i.evidence}
        onOpen={onOpen}
        className="h-full shadow-none"
      >
        {i.detail}
      </InsightCard>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 ' +
        (active ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted')
      }
    >
      {children}
    </button>
  )
}
