import type { ExportItem } from '@/components/export/registry'

const esc = (s: string | number) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ')

function mdTable(columns: string[], rows: (string | number)[][], max = 40): string {
  const head = `| ${columns.map(esc).join(' | ')} |`
  const sep = `| ${columns.map((_, i) => (i === 0 ? '---' : '---:')).join(' | ')} |`
  const body = rows.slice(0, max).map((r) => `| ${r.map(esc).join(' | ')} |`)
  const more =
    rows.length > max ? [``, `_${rows.length - max} more rows in the CSV download._`] : []
  return [head, sep, ...body, ...more].join('\n')
}

/**
 * Markdown analytical summary of the current view: title, filters (the shareable URL), the
 * findings shown on the page, every chart's data table and the citation. Built only from what
 * the page registered — the same values the user sees.
 */
export function buildSummaryMarkdown(opts: {
  title: string
  description?: string
  url: string
  items: ExportItem[]
  citation: string[]
}): string {
  const insights = opts.items.filter(
    (i): i is Extract<ExportItem, { kind: 'insight' }> => i.kind === 'insight',
  )
  const tables = opts.items.filter(
    (i): i is Extract<ExportItem, { kind: 'table' }> => i.kind === 'table',
  )
  const out: string[] = [`# ${opts.title}`, '']
  if (opts.description) out.push(opts.description, '')
  out.push(`View: <${opts.url}>`, '')
  if (insights.length) {
    out.push('## Key findings', '')
    for (const i of insights) {
      out.push(
        `- **${i.title}**${i.detail ? ` ${i.detail}` : ''}${i.evidence ? ` _(${i.evidence})_` : ''}`,
      )
    }
    out.push('')
  }
  for (const t of tables) {
    out.push(`## ${t.title}`, '')
    if (t.description) out.push(t.description, '')
    out.push(mdTable(t.table.columns, t.table.rows), '')
  }
  out.push('---', '', ...opts.citation.map((c) => `${c}  `))
  return out.join('\n')
}
