import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react'
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
import { PageHeader } from '@/components/layout/PageHeader'
import { Flag } from '@/components/common/Flag'
import { DeltaIndicator } from '@/components/common/DeltaIndicator'
import { SourceBadge } from '@/components/common/SourceBadge'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/states'
import { useDataset } from '@/hooks/useDataset'
import { useFilters } from '@/hooks/useFilters'
import { formatPercent, formatPP } from '@/lib/format'
import { cn } from '@/lib/utils'
import { countryRows, filterRows, sortRows, type SortKey } from './countries.logic'

const COLUMNS: { key: SortKey; label: string; numeric?: boolean; className?: string }[] = [
  { key: 'name', label: 'Economy' },
  { key: 'region', label: 'Region', className: 'hidden md:table-cell' },
  { key: 'income', label: 'Income group', className: 'hidden 2xl:table-cell' },
  { key: 'account', label: 'Account ownership', numeric: true },
  { key: 'accountDelta', label: 'Change', numeric: true, className: 'hidden sm:table-cell' },
  { key: 'mobileMoney', label: 'Mobile money', numeric: true, className: 'hidden xl:table-cell' },
  {
    key: 'digitalPayments',
    label: 'Digital payments',
    numeric: true,
    className: 'hidden xl:table-cell',
  },
  { key: 'genderGap', label: 'Gender gap', numeric: true, className: 'hidden lg:table-cell' },
]

export default function CountriesPage() {
  const { repo, status, error, retry } = useDataset()
  const { filters, setFilters } = useFilters()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'name',
    dir: 'asc',
  })
  const q = useDeferredValue(query)
  const regionId = repo && filters.region ? repo.region(filters.region)?.id : undefined
  const incomeId = repo && filters.income ? repo.incomeGroup(filters.income)?.id : undefined

  const all = useMemo(() => (repo ? countryRows(repo) : []), [repo])
  const rows = useMemo(
    () => sortRows(filterRows(all, q, regionId, incomeId), sort.key, sort.dir),
    [all, q, regionId, incomeId, sort],
  )

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'name' || key === 'region' ? 'asc' : 'desc' },
    )

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Explore' }, { label: 'Countries' }]}
        title="Countries"
        description="Every economy in the Global Findex, at its latest survey wave with data. Select a country for its full profile."
      />
      {status === 'error' && (
        <ErrorState
          title="The dataset could not be loaded."
          description={error ?? undefined}
          onRetry={() => void retry()}
        />
      )}
      {!repo && status !== 'error' && <LoadingSkeleton variant="table" rows={10} />}
      {repo && (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search economies…"
                aria-label="Search economies"
                className="pl-9"
              />
            </div>
            <Select
              value={filters.region ?? 'all'}
              onValueChange={(v) => setFilters({ region: v === 'all' ? null : v })}
            >
              <SelectTrigger size="sm" className="w-full md:w-56" aria-label="Region">
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
            <Select
              value={filters.income ?? 'all'}
              onValueChange={(v) => setFilters({ income: v === 'all' ? null : v })}
            >
              <SelectTrigger size="sm" className="w-full md:w-52" aria-label="Income group">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All income groups</SelectItem>
                {[...repo.incomeGroups]
                  .sort((a, b) => a.order - b.order)
                  .map((g) => (
                    <SelectItem key={g.id} value={g.slug}>
                      {g.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          {rows.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No economies match these filters." />
            </div>
          ) : (
            <Table>
              <caption className="sr-only">
                Global Findex economies. Column headers sort the table.
              </caption>
              <TableHeader>
                <TableRow>
                  {COLUMNS.map((c) => {
                    const active = sort.key === c.key
                    const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
                    return (
                      <TableHead
                        key={c.key}
                        className={cn(
                          c.numeric && 'text-right',
                          c.className,
                          c.key === 'name' && 'pl-4',
                        )}
                        aria-sort={
                          active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
                        }
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(c.key)}
                          className={cn(
                            'hit-area inline-flex items-center gap-1 rounded outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40',
                            active && 'text-foreground',
                          )}
                        >
                          {c.label}
                          <Icon className="size-3" aria-hidden />
                        </button>
                      </TableHead>
                    )
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.entity.code} className="group">
                    <TableCell className="pl-4">
                      <Link
                        to={`/country/${r.entity.slug}`}
                        className="hit-area flex items-center gap-3 font-medium outline-none hover:text-primary focus-visible:underline"
                      >
                        <Flag iso2={r.entity.iso2} code={r.entity.code} className="h-5 w-7" />
                        <span className="truncate">{r.entity.shortName}</span>
                        {r.wave && r.wave !== repo.latestWave && (
                          <span className="text-xs font-normal text-muted-foreground">
                            ({r.wave})
                          </span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {r.region}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground 2xl:table-cell">
                      {r.incomeGroup}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatPercent(r.account)}
                    </TableCell>
                    <TableCell className="hidden text-right sm:table-cell">
                      {r.accountDelta !== null ? (
                        <DeltaIndicator
                          delta={r.accountDelta}
                          comparisonLabel={`vs ${r.previousWave}`}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-right xl:table-cell">
                      {formatPercent(r.mobileMoney)}
                    </TableCell>
                    <TableCell className="hidden text-right xl:table-cell">
                      {formatPercent(r.digitalPayments)}
                    </TableCell>
                    <TableCell className="hidden text-right lg:table-cell">
                      {formatPP(r.genderGap)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-xs text-muted-foreground">
            <span>
              {rows.length} of {all.length} economies · values from each economy’s latest wave
              (shown in brackets if not {repo.latestWave})
            </span>
            <SourceBadge />
          </div>
        </Card>
      )}
    </div>
  )
}
