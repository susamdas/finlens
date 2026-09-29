/**
 * Semantic interpretation of movement and benchmarks.
 * Kept out of components so tone rules are consistent everywhere (KPI cards, tables, insights).
 */
export type Tone = 'positive' | 'negative' | 'neutral' | 'missing'
export type Direction = 'up' | 'down' | 'flat'

/** Changes smaller than this (in percentage points) are treated as "no meaningful change". */
export const FLAT_THRESHOLD_PP = 0.5

export function direction(delta: number, flatThreshold = FLAT_THRESHOLD_PP): Direction {
  if (Math.abs(delta) < flatThreshold) return 'flat'
  return delta > 0 ? 'up' : 'down'
}

/**
 * Maps a change to a tone. `higherIsBetter` comes from indicator metadata:
 * account ownership rising is positive; a gender gap rising is negative.
 */
export function movementTone(
  delta: number | null | undefined,
  higherIsBetter: boolean | null = true,
  flatThreshold = FLAT_THRESHOLD_PP,
): Tone {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return 'missing'
  const d = direction(delta, flatThreshold)
  // Direction without a value judgement (e.g. borrowing): always neutral tone.
  if (d === 'flat' || higherIsBetter === null) return 'neutral'
  return (d === 'up') === higherIsBetter ? 'positive' : 'negative'
}

/**
 * Position relative to a benchmark.
 * - `above` / `below` are *favourable* / *unfavourable* for indicators with a direction
 *   (for a lower-is-better indicator, `above` means the value is lower than the benchmark).
 * - `higher` / `lower` are used when an indicator has no inherent direction (e.g. borrowing).
 */
export type BenchmarkStatus = 'above' | 'near' | 'below' | 'higher' | 'lower' | 'missing'

/** Within ± this many percentage points of the benchmark counts as "near". */
export const NEAR_BENCHMARK_PP = 2

export function classifyBenchmark(
  value: number | null | undefined,
  benchmark: number | null | undefined,
  higherIsBetter: boolean | null = true,
  tolerance = NEAR_BENCHMARK_PP,
): BenchmarkStatus {
  if (value == null || benchmark == null || !Number.isFinite(value) || !Number.isFinite(benchmark))
    return 'missing'
  const diff = value - benchmark
  if (Math.abs(diff) <= tolerance) return 'near'
  if (higherIsBetter === null) return diff > 0 ? 'higher' : 'lower'
  return diff > 0 === higherIsBetter ? 'above' : 'below'
}
