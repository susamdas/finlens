import { useDeferredValue, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search, X } from 'lucide-react'
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
import { CountrySelector } from '@/components/common/CountrySelector'
import { ExportMenu } from '@/components/common/ExportMenu'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/states'
import { toast } from '@/components/common/toast'
import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/data/indicators/categories'
import type { FindexRepository } from '@/data/repository'
import type { GroupId, IndicatorId } from '@/data/types'
import { useDataset, useEnsureData } from '@/hooks/useDataset'
import { useReferenceData } from '@/hooks/useReferenceData'
import { BOM, citationLines, downloadText, safeFilename, toCsv } from '@/lib/export'
import { formatDecimal } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  explorerParams,
  longTable,
  MAX_INDICATORS,
  needsGroups,
  parseExplorerParams,
  runQuery,
  sortRows,
  wideTable,
  type ExplorerQuery,
  type SortKey,
} from './explorer.logic'

const PAGE_SIZE = 50

export default function ExplorerPage() {
  const { repo, status, error, retry } = useDataset()
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Data' }, { label: 'Data Explorer' }]}
        title="Data Explorer"
        description="Pick indicators, economies, survey waves and population groups, check the values, and download exactly what you selected — every Findex series is available, plus three FinLens-derived indicators."
        actions={<ExportMenu />}
      />
      {status === 'error' && (
        <ErrorState
          title="The dataset could not be loaded."
          description={error ?? undefined}
          onRetry={() => void retry()}
        />
      )}
      {!repo && status !== 'error' && <LoadingSkeleton variant="table" rows={10} />}
      {repo && <Explorer repo={repo} />}
    </div>
  )
}

function Explorer({ repo }: { repo: FindexRepository }) {
  const [params, setParams] = useSearchParams()
  const q = useMemo(() => parseExplorerParams(repo, params), [repo, params])
  const loaded = useEnsureData({ groups: needsGroups(q), indicators: q.indicators })
  const [sort, setSort] = useState<{ key: SortKey | null; dir: 'asc' | 'desc' }>({
    key: null,
    dir: 'asc',
  })
  const [page, setPage] = useState(0)

  const update = (patch: Partial<ExplorerQuery>) => {
    const next = { ...q, ...patch }
    setPage(0)
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        for (const [k, v] of Object.entries(explorerParams(repo, next))) {
          if (v === null) n.delete(k)
          else n.set(k, v)
        }
        return n
      },
      { replace: true },
    )
  }

  const rows = useMemo(
    () => (loaded.ready ? runQuery(repo, q) : []),
    // `loaded.ready` flips once the selected series have arrived.
    [repo, q, loaded.ready],
  )
  const sorted = useMemo(() => sortRows(rows, sort.key, sort.dir), [rows, sort])
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const shown = sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const download = (layout: 'long' | 'wide') => {
    const t = layout === 'long' ? longTable(sorted) : wideTable(sorted, q, repo)
    const cite = citationLines(repo.meta.source, window.location.href).map(
      (c) => `"${c.replace(/"/g, '""')}"`,
    )
    downloadText(
      safeFilename(`data-${q.indicators.slice(0, 3).join('-')}-${layout}`, 'csv'),
      `${BOM}${toCsv(t.columns, t.rows)}\r\n\r\n${cite.join('\r\n')}\r\n`,
      'text/csv;charset=utf-8',
    )
    toast.success(`Downloaded ${t.rows.length.toLocaleString()} rows as CSV.`)
  }

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'value' ? 'desc' : 'asc' },
    )

  return (
    <div className="grid items-start gap-4 xl:grid-cols-12">
      <div className="min-w-0 space-y-4 xl:col-span-4">
        <IndicatorPicker
          repo={repo}
          selected={q.indicators}
          onChange={(indicators) => update({ indicators })}
        />
        <PlacePicker repo={repo} q={q} onChange={update} />
        <Card className="space-y-4 p-4">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Survey waves</legend>
            <div className="flex flex-wrap gap-1.5">
              {repo.waves.map((w) => (
                <CheckChip
                  key={w}
                  checked={q.waves.includes(w)}
                  onChange={(on) => {
                    const waves = on ? [...q.waves, w].sort() : q.waves.filter((x) => x !== w)
                    if (waves.length) update({ waves })
                  }}
                >
                  {String(w)}
                </CheckChip>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Population groups</legend>
            <div className="flex flex-wrap gap-1.5">
              {repo.meta.groups.map((g) => (
                <CheckChip
                  key={g.id}
                  checked={q.groups.includes(g.id as GroupId)}
                  onChange={(on) => {
                    const groups = on
                      ? [...q.groups, g.id as GroupId]
                      : q.groups.filter((x) => x !== g.id)
                    if (groups.length) update({ groups })
                  }}
                >
                  {g.label}
                </CheckChip>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Group values are published only where the all-adult value exceeds 10%.
            </p>
          </fieldset>
        </Card>
      </div>

      <Card className="overflow-hidden p-0 xl:col-span-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="min-w-0">
            <h2 className="font-semibold">
              {loaded.ready ? `${rows.length.toLocaleString()} values` : 'Loading series…'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {q.indicators.length} indicator{q.indicators.length === 1 ? '' : 's'} ·{' '}
              {q.codes.length
                ? `${q.codes.length} selected`
                : q.aggregates
                  ? 'all economies and aggregates'
                  : 'all economies'}
              {q.regionId ? ` in ${repo.region(q.regionId)?.name}` : ''} · {q.waves.join(', ')} ·
              missing values are not listed
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              type="single"
              value={q.layout}
              onValueChange={(v) => v && update({ layout: v as 'long' | 'wide' })}
              aria-label="Table layout"
              className="rounded-lg border p-0.5"
            >
              <ToggleGroupItem value="long">Long</ToggleGroupItem>
              <ToggleGroupItem value="wide">Wide</ToggleGroupItem>
            </ToggleGroup>
            <Button size="sm" onClick={() => download(q.layout)} disabled={!rows.length}>
              <Download /> CSV
            </Button>
          </div>
        </div>

        {loaded.error && (
          <ErrorState title="A series could not be loaded." description={loaded.error} />
        )}
        {!loaded.ready && !loaded.error && <LoadingSkeleton variant="table" rows={8} />}
        {loaded.ready && rows.length === 0 && (
          <div className="p-4">
            <EmptyState
              title="No published values match this selection."
              description="Try another wave, group or economy."
            />
          </div>
        )}
        {loaded.ready && rows.length > 0 && q.layout === 'long' && (
          <Table>
            <caption className="sr-only">
              Selected Findex values. Column headers sort the table.
            </caption>
            <TableHeader>
              <TableRow>
                {(
                  [
                    ['entity', 'Economy'],
                    ['indicator', 'Indicator'],
                    ['wave', 'Wave'],
                    ['group', 'Group'],
                    ['value', 'Value'],
                  ] as [SortKey, string][]
                ).map(([k, label]) => {
                  const active = sort.key === k
                  const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
                  return (
                    <TableHead
                      key={k}
                      className={cn(
                        k === 'entity' && 'pl-4',
                        k === 'value' && 'pr-4 text-right',
                        k === 'group' && 'hidden md:table-cell',
                        k === 'indicator' && 'hidden sm:table-cell',
                      )}
                      aria-sort={
                        active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
                      }
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(k)}
                        className="hit-area inline-flex items-center gap-1 hover:text-foreground"
                      >
                        {label}
                        <Icon className="size-3" aria-hidden />
                      </button>
                    </TableHead>
                  )
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => (
                <TableRow key={r.key}>
                  <TableCell className="max-w-0 min-w-32 pl-4">
                    <span className="block truncate font-medium">{r.entity.shortName}</span>
                    {r.entity.kind !== 'economy' && (
                      <span className="text-xs text-muted-foreground">Aggregate</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden max-w-0 min-w-40 sm:table-cell">
                    <span className="block truncate" title={r.indicator.label}>
                      {r.indicator.shortLabel}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {r.indicator.code ?? 'FinLens-derived'}
                    </span>
                  </TableCell>
                  <TableCell className="tabular">
                    {r.wave}
                    {r.surveyYear !== r.wave && (
                      <span className="block text-xs text-muted-foreground">
                        surveyed {r.surveyYear}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {r.groupLabel}
                  </TableCell>
                  <TableCell className="pr-4 text-right font-semibold tabular">
                    {formatDecimal(r.value, 2)}
                    <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                      {r.indicator.unit === '%' ? '%' : r.indicator.unit === 'pp' ? ' pp' : ''}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {loaded.ready && rows.length > 0 && q.layout === 'wide' && (
          <WideView rows={rows} q={q} repo={repo} page={page} />
        )}

        {loaded.ready && rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              {q.layout === 'long'
                ? `Rows ${page * PAGE_SIZE + 1}–${Math.min(sorted.length, (page + 1) * PAGE_SIZE)} of ${sorted.length.toLocaleString()}`
                : 'Wide view'}
            </span>
            {q.layout === 'long' && pages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="px-2 text-muted-foreground tabular">
                  {page + 1} / {pages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= pages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
        <p className="border-t px-4 py-3 text-xs text-muted-foreground">
          {repo.meta.source.citation} Values are percentages of adults (age 15+) unless the unit
          says otherwise; 2 decimals as published. Downloads include the citation and a link to this
          selection.
        </p>
      </Card>
    </div>
  )
}

function WideView({
  rows,
  q,
  repo,
  page,
}: {
  rows: ReturnType<typeof runQuery>
  q: ExplorerQuery
  repo: FindexRepository
  page: number
}) {
  const t = useMemo(() => wideTable(rows, q, repo), [rows, q, repo])
  const shown = t.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  return (
    <div className="overflow-x-auto">
      <Table>
        <caption className="sr-only">Selected values, one column per indicator and wave</caption>
        <TableHeader>
          <TableRow>
            {t.columns.slice(1).map((c, i) => (
              <TableHead
                key={`${i}-${c}`}
                className={cn(i === 0 && 'pl-4', i > 1 && 'text-right whitespace-nowrap')}
              >
                {c === 'economy' ? 'Economy' : c === 'group' ? 'Group' : c}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((r) => (
            <TableRow key={`${r[0]}-${r[2]}`}>
              {r.slice(1).map((cell, i) => (
                <TableCell
                  key={i}
                  className={cn(i === 0 && 'pl-4 font-medium', i > 1 && 'text-right tabular')}
                >
                  {typeof cell === 'number' ? formatDecimal(cell, 2) : (cell ?? '—')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {t.rows.length > PAGE_SIZE && (
        <p className="px-4 py-2 text-xs text-muted-foreground">
          Showing {shown.length} of {t.rows.length} rows — the CSV contains all of them.
        </p>
      )}
    </div>
  )
}

function IndicatorPicker({
  repo,
  selected,
  onChange,
}: {
  repo: FindexRepository
  selected: IndicatorId[]
  onChange: (ids: IndicatorId[]) => void
}) {
  const [query, setQuery] = useState('')
  const [all, setAll] = useState(false)
  const qd = useDeferredValue(query.trim().toLowerCase())
  const pool = repo.indicators(all || qd ? {} : { core: true })
  const matches = pool.filter(
    (i) =>
      !qd ||
      i.label.toLowerCase().includes(qd) ||
      i.shortLabel.toLowerCase().includes(qd) ||
      (i.code ?? '').toLowerCase().includes(qd),
  )
  const byCat = CATEGORY_ORDER.map((c) => ({
    c,
    items: matches.filter((i) => i.category === c),
  })).filter((g) => g.items.length)
  const toggle = (id: IndicatorId) => {
    if (selected.includes(id)) {
      if (selected.length > 1) onChange(selected.filter((x) => x !== id))
    } else if (selected.length < MAX_INDICATORS) onChange([...selected, id])
    else toast.error(`Up to ${MAX_INDICATORS} indicators at a time.`)
  }
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Indicators</h2>
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="text-xs text-primary hover:underline"
        >
          {all ? 'Core indicators only' : `Show all ${repo.indicators().length} indicators`}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {selected.map((id) => (
          <Badge key={id} variant="secondary" className="gap-1">
            {repo.indicator(id)?.shortLabel}
            {selected.length > 1 && (
              <button
                type="button"
                onClick={() => toggle(id)}
                aria-label={`Remove ${repo.indicator(id)?.shortLabel}`}
              >
                <X className="size-3" />
              </button>
            )}
          </Badge>
        ))}
      </div>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search indicators or Findex codes…"
          aria-label="Search indicators"
          className="pl-9"
        />
      </div>
      <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
        {byCat.map(({ c, items }) => (
          <fieldset key={c}>
            <legend className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {CATEGORY_LABELS[c]}
            </legend>
            <ul className="space-y-0.5">
              {items.slice(0, 80).map((i) => (
                <li key={i.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 text-[13px] hover:bg-muted/60">
                    <input
                      type="checkbox"
                      checked={selected.includes(i.id)}
                      onChange={() => toggle(i.id)}
                      className="mt-0.5 accent-primary"
                    />
                    <span className="min-w-0">
                      <span className="block">{i.shortLabel}</span>
                      {!i.core && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {i.code}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ))}
        {!byCat.length && (
          <p className="text-sm text-muted-foreground">No indicator matches “{query}”.</p>
        )}
      </div>
    </Card>
  )
}

function PlacePicker({
  repo,
  q,
  onChange,
}: {
  repo: FindexRepository
  q: ExplorerQuery
  onChange: (p: Partial<ExplorerQuery>) => void
}) {
  const { countries } = useReferenceData()
  const aggregates = repo.meta.entities.filter((e) => e.kind !== 'economy')
  return (
    <Card className="space-y-3 p-4">
      <h2 className="text-sm font-semibold">Economies and aggregates</h2>
      {q.codes.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {q.codes.map((c) => (
            <Badge key={c} variant="secondary" className="gap-1">
              {repo.entity(c)?.shortName}
              <button
                type="button"
                onClick={() => onChange({ codes: q.codes.filter((x) => x !== c) })}
                aria-label={`Remove ${repo.entity(c)?.shortName}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          <button
            type="button"
            onClick={() => onChange({ codes: [] })}
            className="text-xs text-primary hover:underline"
          >
            Clear
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          All {q.aggregates ? 'economies and aggregates' : 'economies'}
          {q.regionId ? ` in ${repo.region(q.regionId)?.name}` : ''}.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <CountrySelector
          options={countries.filter((o) => !q.codes.includes(o.code))}
          onChange={(c) => c && onChange({ codes: [...q.codes, c] })}
          placeholder="Add an economy"
          className="w-full"
        />
        <Select
          value=""
          onValueChange={(c) => c && !q.codes.includes(c) && onChange({ codes: [...q.codes, c] })}
        >
          <SelectTrigger size="sm" className="w-full" aria-label="Add an aggregate">
            <SelectValue placeholder="Add an aggregate" />
          </SelectTrigger>
          <SelectContent>
            {aggregates.map((a) => (
              <SelectItem key={a.code} value={a.code}>
                {a.shortName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {q.codes.length === 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={q.regionId ? (repo.region(q.regionId)?.slug ?? 'all') : 'all'}
            onValueChange={(v) =>
              onChange({ regionId: v === 'all' ? null : (repo.region(v)?.id ?? null) })
            }
          >
            <SelectTrigger size="sm" className="w-52" aria-label="Region">
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
          <CheckChip checked={q.aggregates} onChange={(on) => onChange({ aggregates: on })}>
            Include aggregates
          </CheckChip>
        </div>
      )}
    </Card>
  )
}

function CheckChip({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (on: boolean) => void
  children: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40',
        checked ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted',
      )}
    >
      {children}
    </button>
  )
}
