import { useState } from 'react'
import {
  Check,
  Download,
  FileImage,
  FileSpreadsheet,
  FileText,
  Link2,
  Printer,
  Share2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/common/toast'
import { useExportRegistry } from '@/components/export/registry'
import { useToastError } from '@/components/export/useToastError'
import { useDataStore } from '@/store/data'
import {
  BOM,
  buildSummaryMarkdown,
  citationLines,
  downloadBlob,
  downloadText,
  elementToPng,
  safeFilename,
  toSectionedCsv,
} from '@/lib/export'

export interface ExportHandlers {
  onPng?: () => void
  onCsv?: () => void
  onSummary?: () => void
}

const pageTitle = () =>
  document.querySelector('main h1')?.textContent?.trim() ||
  document.title.replace(/ · FinLens$/, '')
const pageDescription = () =>
  document.querySelector('main h1 ~ p, main header p')?.textContent?.trim() || undefined

/**
 * Page-level export & share. Every view's state lives in the URL, so "Copy link" reproduces it
 * exactly. Downloads use what the page registered (chart tables, findings) unless a page
 * supplies its own handlers.
 */
export function ExportMenu({
  onPng,
  onCsv,
  onSummary,
  compact = false,
}: ExportHandlers & { compact?: boolean }) {
  const [copied, setCopied] = useState(false)
  const registry = useExportRegistry()
  const source = useDataStore((s) => s.repo?.meta.source)
  const report = useToastError()
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      toast.success('Link copied — it opens this exact view.')
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Could not copy automatically. Copy the address from your browser bar.')
    }
  }

  const share = async () => {
    try {
      await navigator.share({ title: `${pageTitle()} · FinLens`, url: window.location.href })
    } catch {
      /* cancelled */
    }
  }

  const tables = () => registry?.items().filter((i) => i.kind === 'table') ?? []

  const pagePng =
    onPng ??
    (async () => {
      const el = document.querySelector<HTMLElement>('main > div')
      if (!el) return
      try {
        const blob = await elementToPng(el, {
          footer: `${source?.citation ?? 'World Bank Global Findex Database.'} · FinLens · ${window.location.href}`,
        })
        downloadBlob(safeFilename(pageTitle(), 'png'), blob)
        toast.success('Snapshot downloaded as PNG.')
      } catch (e) {
        report(e)
      }
    })

  const pageCsv =
    onCsv ??
    (() => {
      const t = tables()
      if (!t.length) return toast.error('This view has no data tables to download.')
      const sections = t
        .map((x) =>
          x.kind === 'table'
            ? { title: x.title, columns: x.table.columns, rows: x.table.rows }
            : null,
        )
        .filter((x) => x !== null)
      const text =
        BOM +
        toSectionedCsv(sections, [
          pageTitle(),
          'Values as displayed on the page (rounded). Use the Data Explorer for full-precision values.',
          ...citationLines(source, window.location.href),
        ])
      downloadText(safeFilename(pageTitle(), 'csv'), text, 'text/csv;charset=utf-8')
      toast.success(
        `Downloaded ${sections.length} table${sections.length === 1 ? '' : 's'} as CSV.`,
      )
    })

  const pageSummary =
    onSummary ??
    (() => {
      const md = buildSummaryMarkdown({
        title: pageTitle(),
        description: pageDescription(),
        url: window.location.href,
        items: registry?.items() ?? [],
        citation: citationLines(source, window.location.href),
      })
      downloadText(safeFilename(pageTitle(), 'md'), md, 'text/markdown;charset=utf-8')
      toast.success('Summary downloaded (Markdown).')
    })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={compact ? 'icon-sm' : 'sm'}
          aria-label="Export and share"
          data-export-ignore
        >
          <Download />
          {!compact && 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Share this view</DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            void copyLink()
          }}
        >
          {copied ? <Check className="text-positive" /> : <Link2 />}
          {copied ? 'Link copied' : 'Copy shareable link'}
        </DropdownMenuItem>
        {canShare && (
          <DropdownMenuItem onSelect={() => void share()}>
            <Share2 /> Share…
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => window.print()}>
          <Printer /> Print or save as PDF
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Download</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => void pagePng()}>
          <FileImage /> Snapshot of this view (PNG)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={pageCsv}>
          <FileSpreadsheet /> All data on this page (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={pageSummary}>
          <FileText /> Analytical summary (Markdown)
        </DropdownMenuItem>
        <p className="px-2 pt-1 pb-1.5 text-[11.5px] text-muted-foreground">
          Every download includes the World Bank citation and a link back to this view.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
