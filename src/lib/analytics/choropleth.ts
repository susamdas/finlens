/**
 * Colour-scale logic for choropleths, kept out of the map component.
 *
 * - Percent indicators: sequential ramp (7 equal classes) over 0 → a "nice" maximum, so small
 *   differences at the top of the range stay visible without distorting zero.
 * - Percentage-point gaps: diverging ramp symmetric around 0. When a larger value is worse
 *   (higherIsBetter = false, e.g. a gender gap), the positive arm is the warm (red) side.
 */
export type ScaleKind = 'sequential' | 'diverging'

export interface ChoroplethScale {
  kind: ScaleKind
  domain: [number, number]
  /** Class upper bounds, length = colors.length. */
  thresholds: number[]
  colors: string[]
  colorFor: (v: number | null | undefined) => string | null
  classOf: (v: number) => number
}

const SEQ = Array.from({ length: 7 }, (_, i) => `var(--seq-${i + 1})`)
const DIV = [
  'var(--div-p3)',
  'var(--div-p2)',
  'var(--div-p1)',
  'var(--div-0)',
  'var(--div-n1)',
  'var(--div-n2)',
  'var(--div-n3)',
]

export function niceMax(max: number, step = 10): number {
  return Math.max(step, Math.min(100, Math.ceil(max / step) * step))
}

export function buildScale(
  values: number[],
  opts: { unit: '%' | 'pp' | 'adults'; higherIsBetter: boolean | null },
): ChoroplethScale {
  const finite = values.filter(Number.isFinite)
  if (opts.unit === 'pp') {
    const m = Math.max(1, Math.ceil(Math.max(...finite.map(Math.abs), 1) / 5) * 5)
    // Blue → neutral → red when larger is worse; reversed when larger is better.
    const colors = opts.higherIsBetter === true ? [...DIV].reverse() : DIV
    const n = colors.length
    const step = (2 * m) / n
    const thresholds = Array.from({ length: n }, (_, i) => -m + step * (i + 1))
    const classOf = (v: number) => Math.min(n - 1, Math.max(0, Math.floor((v + m) / step)))
    return {
      kind: 'diverging',
      domain: [-m, m],
      thresholds,
      colors,
      classOf,
      colorFor: (v) => (v == null || !Number.isFinite(v) ? null : colors[classOf(v)]!),
    }
  }
  // Choose a round class width so the legend reads 0 · 10 · 20 … (at most 7 classes).
  const max = finite.length ? Math.max(...finite) : 100
  const step = [1, 2, 5, 10, 15, 20, 25].find((s) => Math.ceil(max / s) <= SEQ.length) ?? 25
  const n = Math.max(2, Math.ceil(max / step))
  const hi = Math.min(100, n * step)
  // Spread the chosen classes across the full ramp so contrast is kept with fewer classes.
  const colors = Array.from(
    { length: n },
    (_, i) => SEQ[Math.round((i * (SEQ.length - 1)) / (n - 1))]!,
  )
  const thresholds = Array.from({ length: n }, (_, i) => Math.min(hi, step * (i + 1)))
  const classOf = (v: number) => Math.min(n - 1, Math.max(0, Math.floor(v / step)))
  return {
    kind: 'sequential',
    domain: [0, hi],
    thresholds,
    colors,
    classOf,
    colorFor: (v) => (v == null || !Number.isFinite(v) ? null : colors[classOf(v)]!),
  }
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}
