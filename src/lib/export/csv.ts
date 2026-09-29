/**
 * CSV writing (RFC 4180). Fields containing commas, quotes or line breaks are quoted; quotes are
 * doubled. A UTF-8 byte-order mark is added so Excel opens accented names correctly.
 */
export type Cell = string | number | null | undefined

export function csvField(v: Cell): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(columns: string[], rows: Cell[][]): string {
  return [columns, ...rows].map((r) => r.map(csvField).join(',')).join('\r\n')
}

/** Several tables in one file, each preceded by its title (for page-level downloads). */
export function toSectionedCsv(
  sections: { title: string; columns: string[]; rows: Cell[][] }[],
  preamble: string[] = [],
): string {
  const parts = [...preamble.map((p) => csvField(p)), ...(preamble.length ? [''] : [])]
  for (const s of sections) parts.push(csvField(s.title), toCsv(s.columns, s.rows), '')
  return parts.join('\r\n')
}

export const BOM = '﻿'
