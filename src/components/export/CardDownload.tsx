import type { RefObject } from 'react'
import { Download, FileImage, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ChartTable } from '@/components/charts/ChartCard'
import { useDataStore } from '@/store/data'
import {
  BOM,
  citationLines,
  downloadBlob,
  downloadText,
  elementToPng,
  safeFilename,
  toCsv,
} from '@/lib/export'
import { toast } from '@/components/common/toast'
import { useToastError } from './useToastError'

/** Per-chart download menu: the card as PNG, and its data table as CSV. */
export function CardDownload({
  title,
  table,
  target,
  sourceYear,
}: {
  title: string
  table?: ChartTable
  target: RefObject<HTMLElement | null>
  sourceYear?: number | string
}) {
  const source = useDataStore((s) => s.repo?.meta.source)
  const report = useToastError()

  const png = async () => {
    if (!target.current) return
    try {
      const blob = await elementToPng(target.current, {
        footer: `${source?.name ?? 'World Bank Global Findex Database'}${sourceYear ? `, ${sourceYear}` : ''} · FinLens · ${window.location.href}`,
      })
      downloadBlob(safeFilename(title, 'png'), blob)
      toast.success('Chart downloaded as PNG.')
    } catch (e) {
      report(e)
    }
  }
  const csv = () => {
    if (!table) return
    const cite = [
      'Values as displayed (rounded). Use the Data Explorer for full-precision values.',
      ...citationLines(source, window.location.href),
    ]
    const text = `${BOM}${toCsv(table.columns, table.rows)}\r\n\r\n${cite.map((c) => `"${c.replace(/"/g, '""')}"`).join('\r\n')}\r\n`
    downloadText(safeFilename(title, 'csv'), text, 'text/csv;charset=utf-8')
    toast.success('Data downloaded as CSV.')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Download ${title}`} title="Download">
          <Download />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={() => void png()}>
          <FileImage /> Chart as PNG
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!table} onSelect={csv}>
          <FileSpreadsheet /> Data as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
