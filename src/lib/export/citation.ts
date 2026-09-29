import type { SourceInfo } from '@/data/types'

/** Citation for downloads and summaries: the World Bank source, then FinLens and the view URL. */
export function citationLines(
  source: SourceInfo | undefined,
  url: string,
  date = new Date(),
): string[] {
  const d = date.toISOString().slice(0, 10)
  return [
    `Source: ${source?.citation ?? 'World Bank. The Global Findex Database. Washington, DC: World Bank.'}${source?.release ? ` Release ${source.release}.` : ''}`,
    `Prepared with FinLens on ${d}. Values are published Findex figures unless marked as FinLens-derived or FinLens projection.`,
    `View: ${url}`,
  ]
}
