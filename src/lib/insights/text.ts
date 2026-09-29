/** Wording helpers for generated insights. Numbers are always formatted from source values. */
const nf1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const pct = (v: number) => `${nf1.format(v)}%`
export const pp = (v: number) =>
  `${nf1.format(Math.abs(v))} percentage point${Math.abs(v) === 1 ? '' : 's'}`
export const ppShort = (v: number) => `${v >= 0 ? '+' : '−'}${nf1.format(Math.abs(v))} pp`

export function compactPeople(n: number): string {
  if (n >= 1e9) return `${nf1.format(n / 1e9)} billion`
  if (n >= 1e6) return `${nf1.format(n / 1e6)} million`
  if (n >= 1e3) return `${Math.round(n / 1e3)} thousand`
  return String(n)
}

/** "rose 4.9 percentage points" / "fell …" / "was essentially unchanged" */
export function changeVerb(delta: number, threshold = 0.5): string {
  if (Math.abs(delta) < threshold) return 'was essentially unchanged'
  return `${delta > 0 ? 'rose' : 'fell'} ${pp(delta)}`
}

/**
 * Describes how change A compares with change B, handling mixed and negative directions,
 * e.g. "grew faster than", "declined less than", "rose while … fell".
 */
export function compareChanges(a: number, b: number, bLabel: string): string {
  if (a >= 0 && b >= 0) return `${a > b ? 'grew faster than' : 'grew more slowly than'} ${bLabel}`
  if (a < 0 && b < 0)
    return `${Math.abs(a) < Math.abs(b) ? 'declined less than' : 'declined more than'} ${bLabel}`
  return a >= 0 ? `rose while ${bLabel} fell` : `fell while ${bLabel} rose`
}
