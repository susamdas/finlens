import { useId, useRef, useState, type ReactNode } from 'react'
import { BarChart3, Table2 } from 'lucide-react'
import { useRegisterExport } from '@/components/export/registry'
import { CardDownload } from '@/components/export/CardDownload'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/common/states'
import { SourceBadge } from '@/components/common/SourceBadge'
import { cn } from '@/lib/utils'

export type ViewStatus = 'loading' | 'error' | 'empty' | 'ready'

/** Accessible table alternative for a chart (every value reachable without hover). */
export interface ChartTable {
  caption: string
  columns: string[]
  rows: (string | number)[][]
}

/**
 * Frame for every chart: title, description, actions (export, toggles), state handling,
 * and source attribution. Charts inside only render data.
 */
export function ChartCard({
  title,
  description,
  actions,
  status = 'ready',
  emptyMessage,
  onRetry,
  source,
  sourceYear,
  footnote,
  className,
  contentClassName,
  table,
  children,
}: {
  table?: ChartTable
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  status?: ViewStatus
  emptyMessage?: string
  onRetry?: () => void
  source?: string
  sourceYear?: number | string
  footnote?: ReactNode
  className?: string
  contentClassName?: string
  children?: ReactNode
}) {
  const [showTable, setShowTable] = useState(false)
  const tableId = useId()
  const cardRef = useRef<HTMLDivElement>(null)
  const plainTitle = typeof title === 'string' ? title : (table?.caption ?? 'Chart')
  const plainDescription = typeof description === 'string' ? description : undefined
  useRegisterExport(
    table && status === 'ready'
      ? {
          kind: 'table',
          title: plainTitle,
          description: plainDescription,
          table,
          source: typeof sourceYear !== 'undefined' ? String(sourceYear) : undefined,
        }
      : null,
    cardRef,
  )
  return (
    <Card ref={cardRef} className={cn('min-w-0', className)} aria-busy={status === 'loading'}>
      <CardHeader>
        <div className="min-w-0 space-y-1">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {(actions || table || status === 'ready') && (
          <div className="flex shrink-0 items-center gap-1 print:hidden" data-export-ignore>
            {actions}
            {table && status === 'ready' && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-pressed={showTable}
                aria-controls={showTable ? tableId : undefined}
                aria-label={showTable ? 'Show chart' : 'Show data table'}
                title={showTable ? 'Show chart' : 'Show data table'}
                onClick={() => setShowTable((v) => !v)}
              >
                {showTable ? <BarChart3 /> : <Table2 />}
              </Button>
            )}
            {status === 'ready' && (
              <CardDownload
                title={plainTitle}
                table={table}
                target={cardRef}
                sourceYear={sourceYear}
              />
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className={cn('flex-1', contentClassName)}>
        {status === 'loading' && <LoadingSkeleton variant="chart" />}
        {status === 'error' && <ErrorState onRetry={onRetry} />}
        {status === 'empty' && <EmptyState {...(emptyMessage ? { title: emptyMessage } : {})} />}
        {status === 'ready' &&
          (showTable && table ? <DataTableView id={tableId} table={table} /> : children)}
      </CardContent>
      <CardFooter className="flex-wrap justify-between gap-x-4 gap-y-1.5">
        <SourceBadge {...(source ? { source } : {})} year={sourceYear} />
        {footnote && (
          <span className="min-w-0 basis-full text-[11.5px] md:basis-auto md:text-right">
            {footnote}
          </span>
        )}
      </CardFooter>
    </Card>
  )
}

function DataTableView({ id, table }: { id: string; table: ChartTable }) {
  return (
    <div id={id} className="max-h-80 overflow-auto rounded-lg border">
      <Table>
        <TableCaption className="sr-only">{table.caption}</TableCaption>
        <TableHeader className="sticky top-0 bg-card">
          <TableRow>
            {table.columns.map((c, i) => (
              <TableHead key={`${i}-${c}`} className={i > 0 ? 'text-right' : undefined}>
                {c}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.rows.map((r, i) => (
            <TableRow key={i}>
              {r.map((cell, j) => (
                <TableCell key={j} className={j > 0 ? 'text-right' : 'font-medium'}>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
