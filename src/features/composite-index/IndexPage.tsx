import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { FlaskConical } from 'lucide-react'
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
import { PageHeader } from '@/components/layout/PageHeader'
import { ExportMenu } from '@/components/common/ExportMenu'
import { Flag } from '@/components/common/Flag'
import { YearSelector } from '@/components/common/YearSelector'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/states'
import type { FindexRepository } from '@/data/repository'
import { useDataset } from '@/hooks/useDataset'
import { useFilters } from '@/hooks/useFilters'
import { cn } from '@/lib/utils'
import {
  buildIndex,
  DIMENSIONS,
  parseWeights,
  PRESETS,
  serializeWeights,
  type Weights,
} from './index.logic'

export default function IndexPage() {
  const { repo, status, error, retry } = useDataset()
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Intelligence' }, { label: 'Inclusion Index' }]}
        title="Inclusion Index (experimental)"
        description="Combine six dimensions of financial inclusion into one score — with weights you choose — and see how much the ranking depends on those choices."
        actions={<ExportMenu />}
      />
      <div
        role="note"
        className="flex gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm"
      >
        <FlaskConical className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <div>
          <p className="font-semibold">
            Experimental FinLens composite — not a World Bank index and not a verdict on any
            country.
          </p>
          <p className="mt-1 text-muted-foreground">
            Scores are relative to the economies included and depend entirely on the chosen weights.
            The “rank range” column shows how far a position moves across weightings. For single,
            published indicators use{' '}
            <Link to="/rankings" className="text-primary hover:underline">
              Rankings
            </Link>
            .
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
      {!repo && status !== 'error' && <LoadingSkeleton variant="table" rows={10} />}
      {repo && <IndexView repo={repo} />}
    </div>
  )
}

function IndexView({ repo }: { repo: FindexRepository }) {
  const { filters, setFilters } = useFilters()
  const [params, setParams] = useSearchParams()
  const [showAll, setShowAll] = useState(false)
  const wParam = params.get('w')
  const weights = useMemo(() => parseWeights(wParam), [wParam])
  const wKey = serializeWeights(weights)
  const model = useMemo(
    () => buildIndex(repo, { wave: filters.year, weights }),
    [repo, filters.year, weights],
  )
  const region = filters.region ? repo.region(filters.region) : undefined
  const rows = model.rows.filter((r) => !region || r.entity.regionId === region.id)
  const shown = showAll ? rows : rows.slice(0, 25)

  const setWeights = (w: Weights) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        const s = serializeWeights(w)
        if (s === serializeWeights(PRESETS[0]!.weights)) n.delete('w')
        else n.set('w', s)
        return n
      },
      { replace: true },
    )
  const activePreset = PRESETS.find((p) => serializeWeights(p.weights) === wKey)?.id

  return (
    <div className="grid items-start gap-4 xl:grid-cols-12">
      <Card className="min-w-0 space-y-5 p-5 xl:sticky xl:top-20 xl:col-span-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold">Weights</h2>
          <YearSelector
            years={repo.waves}
            value={model.wave}
            onChange={(y) => setFilters({ year: y === repo.latestWave ? null : y })}
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Weight presets">
          {PRESETS.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant={activePreset === p.id ? 'default' : 'outline'}
              onClick={() => setWeights(p.weights)}
              aria-pressed={activePreset === p.id}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <ul className="space-y-4">
          {DIMENSIONS.map((d) => (
            <li key={d.id}>
              <label className="flex items-baseline justify-between gap-2 text-sm">
                <span>
                  <span className="font-medium">{d.label}</span>
                  <span className="block text-xs text-muted-foreground">{d.note}</span>
                </span>
                <span className="font-semibold tabular">×{weights[d.id]}</span>
              </label>
              <input
                type="range"
                min={0}
                max={5}
                step={1}
                value={weights[d.id]}
                onChange={(e) => setWeights({ ...weights, [d.id]: Number(e.target.value) })}
                aria-label={`${d.label} weight`}
                className="mt-2 h-6 w-full cursor-pointer accent-primary"
              />
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Each dimension is scaled 0–100 between the lowest and highest economy in the set; the
          index is the weighted average. Weight 0 leaves a dimension out.
        </p>
      </Card>

      <div className="min-w-0 space-y-4 xl:col-span-8">
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div>
              <h2 className="font-semibold">FinLens Inclusion Index · {model.wave}</h2>
              <p className="text-sm text-muted-foreground">
                {model.rows.length} economies with all six dimensions published
                {model.excluded.length
                  ? ` · ${model.excluded.length} surveyed economies excluded`
                  : ''}
              </p>
            </div>
            <Select
              value={filters.region ?? 'all'}
              onValueChange={(v) => setFilters({ region: v === 'all' ? null : v })}
            >
              <SelectTrigger size="sm" className="w-52" aria-label="Show region">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All regions</SelectItem>
                {repo.regions.map((r) => (
                  <SelectItem key={r.id} value={r.slug}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {rows.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No economy has all six dimensions for this selection." />
            </div>
          ) : (
            <Table>
              <caption className="sr-only">Experimental index ranking</caption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 pl-4 text-right">Rank</TableHead>
                  <TableHead>Economy</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="hidden lg:table-cell">Dimensions (0–100)</TableHead>
                  <TableHead
                    className="pr-4 text-right"
                    title="Best and worst rank across the weight presets and your weights"
                  >
                    Rank range
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((r) => (
                  <TableRow key={r.entity.code}>
                    <TableCell className="pl-4 text-right text-muted-foreground tabular">
                      {r.rank}
                    </TableCell>
                    <TableCell className="max-w-0 min-w-36">
                      <Link
                        to={`/country/${r.entity.slug}`}
                        className="hit-area flex min-w-0 items-center gap-2.5 font-medium hover:text-primary"
                      >
                        <Flag
                          iso2={r.entity.iso2}
                          code={r.entity.code}
                          className="h-4 w-6 shrink-0"
                        />
                        <span className="truncate">{r.entity.shortName}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular">
                      {r.score.toFixed(1)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div
                        className="flex items-end gap-1"
                        aria-label={DIMENSIONS.map((d) => `${d.label} ${r.dims[d.id]!.score}`).join(
                          ', ',
                        )}
                      >
                        {DIMENSIONS.map((d) => (
                          <span
                            key={d.id}
                            title={`${d.label}: ${r.dims[d.id]!.score.toFixed(0)}`}
                            className={cn(
                              'w-3 rounded-sm bg-primary',
                              !weights[d.id] && 'opacity-25',
                            )}
                            style={{ height: `${4 + (r.dims[d.id]!.score / 100) * 20}px` }}
                          />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="pr-4 text-right text-xs text-muted-foreground tabular">
                      {r.rankRange[0] === r.rankRange[1]
                        ? r.rankRange[0]
                        : `${r.rankRange[0]}–${r.rankRange[1]}`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {rows.length > 25 && (
            <div className="border-t px-4 py-3">
              <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Show fewer' : `Show all ${rows.length}`}
              </Button>
            </div>
          )}
          <p className="border-t px-4 py-3 text-xs text-muted-foreground">
            Dimension bars, left to right: {DIMENSIONS.map((d) => d.label).join(', ')}.
          </p>
        </Card>
        {model.excluded.length > 0 && (
          <Card className="p-4 text-sm">
            <p className="font-medium">
              Not scored — a dimension is not published for {model.wave}
            </p>
            <p className="mt-1 text-muted-foreground">
              {model.excluded
                .slice(0, 60)
                .map((e) => e.entity.shortName)
                .join(', ')}
              {model.excluded.length > 60 ? ` and ${model.excluded.length - 60} more` : ''}.
              {model.wave === 2024 &&
                ' In 2024 the World Bank asked about digital payments, saving, borrowing and resilience only in low- and middle-income economies, so most high-income economies cannot be scored.'}
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
