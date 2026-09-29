/**
 * Number formatting for FinLens. All functions accept `null` (missing data) and return
 * the MISSING glyph rather than a misleading zero.
 */
export const MISSING_GLYPH = '—'
export const MISSING_TEXT = 'Data unavailable'
export const MISSING_FOR_YEAR = 'Data unavailable for the selected year.'

const MINUS = '−' // typographic minus, same width as "+"

type Num = number | null | undefined

const isNum = (v: Num): v is number => typeof v === 'number' && Number.isFinite(v)

function fixed(v: number, digits: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(v))
}

function sign(v: number, digits: number): string {
  // Values that round to zero are shown unsigned ("0.0"), never "−0.0".
  if (Number(fixed(v, digits).replace(/,/g, '')) === 0) return ''
  return v > 0 ? '+' : MINUS
}

/** 53.4 → "53.4%" */
export function formatPercent(v: Num, digits = 1): string {
  if (!isNum(v)) return MISSING_GLYPH
  return `${v < 0 && sign(v, digits) ? MINUS : ''}${fixed(v, digits)}%`
}

/** Percentage-point change: 7.2 → "+7.2 pp", −3 → "−3.0 pp" */
export function formatPP(delta: Num, digits = 1): string {
  if (!isNum(delta)) return MISSING_GLYPH
  return `${sign(delta, digits)}${fixed(delta, digits)} pp`
}

/** Relative change between two values: (60, 50) → "+20.0%" */
export function formatRelativeChange(current: Num, previous: Num, digits = 1): string {
  if (!isNum(current) || !isNum(previous) || previous === 0) return MISSING_GLYPH
  const rel = ((current - previous) / Math.abs(previous)) * 100
  return `${sign(rel, digits)}${fixed(rel, digits)}%`
}

/** 1_400_000_000 → "1.4B" */
export function formatCompact(v: Num, digits = 1): string {
  if (!isNum(v)) return MISSING_GLYPH
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: digits,
  }).format(v)
}

/** Plain number with fixed decimals, e.g. correlation 0.7234 → "0.72" */
export function formatDecimal(v: Num, digits = 2): string {
  if (!isNum(v)) return MISSING_GLYPH
  return `${v < 0 && sign(v, digits) ? MINUS : ''}${fixed(v, digits)}`
}
