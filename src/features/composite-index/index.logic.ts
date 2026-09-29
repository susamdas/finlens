import type { FindexRepository } from '@/data/repository'
import type { Entity, IndicatorId, Wave } from '@/data/types'

/**
 * Experimental FinLens Inclusion Index (spec §20).
 *
 * NOT a World Bank measure. A transparent composite for exploration only:
 *  1. Each dimension uses one published indicator.
 *  2. Scores are min–max normalised to 0–100 across the economies that have ALL dimensions in
 *     the chosen wave (so scores are relative to that set and change if the set changes).
 *     For "lower is better" inputs (the gender gap, by absolute size) the scale is inverted.
 *  3. The index is the weighted mean of dimension scores; weights are user-adjustable.
 * Economies missing any dimension are listed, never imputed.
 */

export interface Dimension {
  id: string
  label: string
  indicator: IndicatorId
  /** Transform before normalising (e.g. absolute gap size). */
  transform?: (v: number) => number
  /** True when lower transformed values are better. */
  invert?: boolean
  note: string
}

export const DIMENSIONS: Dimension[] = [
  { id: 'access', label: 'Access', indicator: 'accountOwnership', note: 'Account ownership' },
  {
    id: 'usage',
    label: 'Usage',
    indicator: 'digitalPayments',
    note: 'Made or received a digital payment',
  },
  { id: 'saving', label: 'Saving', indicator: 'formalSavings', note: 'Saved formally' },
  { id: 'credit', label: 'Credit', indicator: 'formalBorrowing', note: 'Borrowed formally' },
  {
    id: 'resilience',
    label: 'Resilience',
    indicator: 'emergencyFundsPossible',
    note: 'Could raise emergency funds in 30 days',
  },
  {
    id: 'equality',
    label: 'Equality',
    indicator: 'genderGapAccount',
    transform: Math.abs,
    invert: true,
    note: 'Smaller gender gap in account ownership (either direction)',
  },
]

export type Weights = Record<string, number>

export const PRESETS: { id: string; label: string; weights: Weights }[] = [
  {
    id: 'equal',
    label: 'Equal weights',
    weights: Object.fromEntries(DIMENSIONS.map((d) => [d.id, 1])),
  },
  {
    id: 'access',
    label: 'Access first',
    weights: { access: 3, usage: 1, saving: 1, credit: 1, resilience: 1, equality: 1 },
  },
  {
    id: 'use',
    label: 'Use & resilience',
    weights: { access: 1, usage: 2, saving: 2, credit: 1, resilience: 2, equality: 1 },
  },
  {
    id: 'equity',
    label: 'Equality first',
    weights: { access: 1, usage: 1, saving: 1, credit: 1, resilience: 1, equality: 3 },
  },
]

export interface IndexRow {
  entity: Entity
  score: number
  rank: number
  dims: Record<string, { raw: number; score: number }>
  /** Best and worst rank across the presets — how sensitive the position is to weighting. */
  rankRange: [number, number]
}

export interface IndexModel {
  wave: Wave
  rows: IndexRow[]
  excluded: { entity: Entity; missing: string[] }[]
  ranges: Record<string, [number, number]>
  weights: Weights
}

const r1 = (n: number) => Math.round(n * 10) / 10

export function parseWeights(raw: string | null | undefined): Weights {
  const base = PRESETS[0]!.weights
  if (!raw) return { ...base }
  const parts = raw.split(',').map((p) => Number(p))
  if (
    parts.length !== DIMENSIONS.length ||
    parts.some((p) => !Number.isFinite(p) || p < 0 || p > 5)
  )
    return { ...base }
  if (parts.every((p) => p === 0)) return { ...base }
  return Object.fromEntries(DIMENSIONS.map((d, i) => [d.id, parts[i]!]))
}

export const serializeWeights = (w: Weights) => DIMENSIONS.map((d) => w[d.id] ?? 0).join(',')

function scoreAll(
  items: { entity: Entity; dims: Record<string, { raw: number; score: number }> }[],
  weights: Weights,
) {
  const total = DIMENSIONS.reduce((s, d) => s + (weights[d.id] ?? 0), 0) || 1
  const scored = items.map((it) => ({
    ...it,
    score: r1(
      DIMENSIONS.reduce((s, d) => s + (weights[d.id] ?? 0) * it.dims[d.id]!.score, 0) / total,
    ),
  }))
  scored.sort((a, b) => b.score - a.score || a.entity.shortName.localeCompare(b.entity.shortName))
  let prev: number | null = null
  let prevRank = 0
  return scored.map((s, i) => {
    const rank = prev !== null && s.score === prev ? prevRank : i + 1
    prev = s.score
    prevRank = rank
    return { ...s, rank }
  })
}

export function buildIndex(
  repo: FindexRepository,
  opts: { wave?: Wave; weights?: Weights } = {},
): IndexModel {
  const wave = opts.wave && repo.waves.includes(opts.wave) ? opts.wave : repo.latestWave
  const weights = opts.weights ?? PRESETS[0]!.weights
  const complete: { entity: Entity; raw: Record<string, number> }[] = []
  const excluded: IndexModel['excluded'] = []
  for (const e of repo.economies()) {
    const raw: Record<string, number> = {}
    const missing: string[] = []
    for (const d of DIMENSIONS) {
      const v = repo.value(d.indicator, e.code, wave)
      if (v === null) missing.push(d.label)
      else raw[d.id] = d.transform ? d.transform(v) : v
    }
    if (missing.length) {
      // Economies with no survey at all in this wave are not listed as "excluded".
      if (repo.value('accountOwnership', e.code, wave) !== null)
        excluded.push({ entity: e, missing })
    } else complete.push({ entity: e, raw })
  }

  const ranges: Record<string, [number, number]> = {}
  for (const d of DIMENSIONS) {
    const vals = complete.map((c) => c.raw[d.id]!)
    ranges[d.id] = [Math.min(...vals), Math.max(...vals)]
  }
  const items = complete.map((c) => ({
    entity: c.entity,
    dims: Object.fromEntries(
      DIMENSIONS.map((d) => {
        const [lo, hi] = ranges[d.id]!
        const t = hi === lo ? 50 : ((c.raw[d.id]! - lo) / (hi - lo)) * 100
        return [d.id, { raw: c.raw[d.id]!, score: r1(d.invert ? 100 - t : t) }]
      }),
    ),
  }))

  const current = scoreAll(items, weights)
  const presetRanks = PRESETS.map(
    (p) => new Map(scoreAll(items, p.weights).map((r) => [r.entity.code, r.rank])),
  )
  const rows = current.map((r) => {
    const ranks = [r.rank, ...presetRanks.map((m) => m.get(r.entity.code)!)]
    return { ...r, rankRange: [Math.min(...ranks), Math.max(...ranks)] as [number, number] }
  })

  return { wave, rows, excluded, ranges, weights }
}
