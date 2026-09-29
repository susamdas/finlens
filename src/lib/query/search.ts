/**
 * Word-prefix matching: every query token must start a word in the item's text.
 * Stricter than cmdk's default fuzzy score, so "gender" doesn't match "Regions".
 */
export function searchFilter(value: string, search: string, keywords?: string[]): number {
  const haystack = `${value} ${keywords?.join(' ') ?? ''}`.toLowerCase()
  const words = haystack.split(/[^a-z0-9]+/).filter(Boolean)
  const tokens = search.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 1
  let score = 0
  for (const t of tokens) {
    const hit = words.findIndex((w) => w.startsWith(t))
    if (hit === -1) return 0
    score += hit === 0 ? 2 : 1 // label-first matches rank higher
  }
  return score / (tokens.length * 2)
}
