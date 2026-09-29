/**
 * Small, dependency-free statistics used across FinLens (correlation explorer, previews,
 * insights, forecasts). All functions ignore non-finite pairs rather than coercing them.
 */
export interface XY {
  x: number
  y: number
}

const finitePairs = (pts: XY[]) => pts.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))

export function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

/** Pearson correlation coefficient, or null when fewer than 3 pairs or zero variance. */
export function pearson(points: XY[]): number | null {
  const pts = finitePairs(points)
  if (pts.length < 3) return null
  const mx = mean(pts.map((p) => p.x))
  const my = mean(pts.map((p) => p.y))
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (const p of pts) {
    const dx = p.x - mx
    const dy = p.y - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  if (sxx === 0 || syy === 0) return null
  return sxy / Math.sqrt(sxx * syy)
}

/** Below this many economies a cross-country correlation is not reported. */
export const MIN_CORRELATION_N = 10

export interface LinearFit {
  slope: number
  intercept: number
  r2: number
  n: number
  predict: (x: number) => number
}

/** Ordinary least squares y = a + b·x. Null when fewer than 2 points or no x variance. */
export function linearRegression(points: XY[]): LinearFit | null {
  const pts = finitePairs(points)
  if (pts.length < 2) return null
  const mx = mean(pts.map((p) => p.x))
  const my = mean(pts.map((p) => p.y))
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (const p of pts) {
    sxy += (p.x - mx) * (p.y - my)
    sxx += (p.x - mx) ** 2
    syy += (p.y - my) ** 2
  }
  if (sxx === 0) return null
  const slope = sxy / sxx
  const intercept = my - slope * mx
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy)
  return { slope, intercept, r2, n: pts.length, predict: (x) => intercept + slope * x }
}

export type CorrelationStrength = 'very weak' | 'weak' | 'moderate' | 'strong' | 'very strong'

/** Conventional descriptive bands for |r|. Descriptive only — says nothing about causation. */
export function correlationStrength(r: number): CorrelationStrength {
  const a = Math.abs(r)
  if (a < 0.2) return 'very weak'
  if (a < 0.4) return 'weak'
  if (a < 0.6) return 'moderate'
  if (a < 0.8) return 'strong'
  return 'very strong'
}

export function describeCorrelation(r: number): string {
  const strength = correlationStrength(r)
  if (strength === 'very weak') return 'Little or no linear association'
  const s = strength.charAt(0).toUpperCase() + strength.slice(1)
  return `${s} ${r > 0 ? 'positive' : 'negative'} association`
}

/** Average ranks (1-based); ties share the mean of their positions. */
export function ranks(values: number[]): number[] {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const out = new Array<number>(values.length)
  for (let k = 0; k < order.length;) {
    let j = k
    while (j + 1 < order.length && order[j + 1]!.v === order[k]!.v) j++
    const avg = (k + j) / 2 + 1
    for (let t = k; t <= j; t++) out[order[t]!.i] = avg
    k = j + 1
  }
  return out
}

/**
 * Spearman rank correlation: Pearson on ranks. Less sensitive to outliers and to non-linear
 * but monotonic relationships — shown alongside Pearson so one extreme economy can't drive
 * the headline.
 */
export function spearman(points: XY[]): number | null {
  const pts = finitePairs(points)
  if (pts.length < 3) return null
  const rx = ranks(pts.map((p) => p.x))
  const ry = ranks(pts.map((p) => p.y))
  return pearson(rx.map((x, i) => ({ x, y: ry[i]! })))
}
