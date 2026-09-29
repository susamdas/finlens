import type { FindexRepository } from '@/data/repository'
import type { Entity, IndicatorDefinition, IndicatorId, Wave } from '@/data/types'
import { overviewMetrics } from '@/features/overview/overview.logic'
import { resolveScope, scopeEconomies, type Scope } from '@/lib/analytics/scope'
import {
  correlationStrength,
  linearRegression,
  MIN_CORRELATION_N,
  pearson,
  spearman,
  type CorrelationStrength,
  type LinearFit,
} from '@/lib/analytics/stats'

/**
 * Correlation explorer (spec §11).
 *
 * Cross-country association between two indicators in one survey wave, using economy-level
 * published values only. Everything here is descriptive: r, rank correlation, a least-squares
 * line and the economies furthest from it. Nothing is presented as cause and effect, and
 * results are withheld below MIN_CORRELATION_N economies.
 */

export const DEFAULT_X: IndicatorId = 'mobileMoneyAccount'
export const DEFAULT_Y: IndicatorId = 'accountOwnership'

/** Indicators in the correlation matrix, in display order. */
export const MATRIX_IDS: IndicatorId[] = [
  'accountOwnership',
  'fiAccount',
  'mobileMoneyAccount',
  'debitCard',
  'digitalPayments',
  'wagesIntoAccount',
  'formalSavings',
  'formalBorrowing',
  'emergencyFundsPossible',
  'mobilePhone',
  'internetUse',
  'genderGapAccount',
]

export type ColorBy = 'region' | 'income' | 'none'

export interface CorrPoint {
  entity: Entity
  x: number
  y: number
  /** Stable category for colouring (region or income-group id). */
  category: string | null
}

export interface Residual {
  entity: Entity
  x: number
  y: number
  expected: number
  residual: number
}

export interface CorrelationModel {
  wave: Wave
  scope: Scope
  x: IndicatorDefinition
  y: IndicatorDefinition
  points: CorrPoint[]
  n: number
  /** Economies in scope missing either value (listed, never imputed). */
  excluded: number
  enough: boolean
  r: number | null
  rho: number | null
  strength: CorrelationStrength | null
  fit: LinearFit | null
  above: Residual[]
  below: Residual[]
  /** The same pair in every wave, to show whether the association is stable. */
  overTime: { wave: Wave; n: number; r: number | null }[]
  domains: { x: [number, number]; y: [number, number] }
}

export function correlationMetrics(repo: FindexRepository): IndicatorDefinition[] {
  return overviewMetrics(repo)
}

export function resolveMetric(
  repo: FindexRepository,
  id: string | null | undefined,
  fallback: IndicatorId,
): IndicatorDefinition {
  const list = correlationMetrics(repo)
  return list.find((i) => i.id === id) ?? list.find((i) => i.id === fallback) ?? list[0]!
}

/** 0–100 for shares; a rounded range that includes 0 for pp indicators (e.g. gaps). */
export function axisDomain(unit: IndicatorDefinition['unit'], values: number[]): [number, number] {
  if (unit === '%') return [0, 100]
  const lo = Math.min(0, ...values)
  const hi = Math.max(10, ...values)
  return [Math.floor(lo / 10) * 10, Math.ceil(hi / 10) * 10]
}

function pairs(repo: FindexRepository, x: IndicatorId, y: IndicatorId, wave: Wave, eco: Entity[]) {
  const out: { entity: Entity; x: number; y: number }[] = []
  for (const e of eco) {
    const vx = repo.value(x, e.code, wave)
    const vy = repo.value(y, e.code, wave)
    if (vx !== null && vy !== null) out.push({ entity: e, x: vx, y: vy })
  }
  return out
}

export function buildCorrelation(
  repo: FindexRepository,
  opts: {
    x?: string | null
    y?: string | null
    wave?: Wave
    region?: string
    income?: string
    colorBy?: ColorBy
  } = {},
): CorrelationModel {
  const wave = opts.wave && repo.waves.includes(opts.wave) ? opts.wave : repo.latestWave
  const x = resolveMetric(repo, opts.x, DEFAULT_X)
  const y = resolveMetric(repo, opts.y, DEFAULT_Y)
  const scope = resolveScope(repo, { region: opts.region, income: opts.income })
  const economies = scopeEconomies(repo, scope)
  const colorBy = opts.colorBy ?? 'region'

  const raw = pairs(repo, x.id, y.id, wave, economies)
  const points: CorrPoint[] = raw.map((p) => ({
    ...p,
    category:
      colorBy === 'region'
        ? (p.entity.regionId ?? null)
        : colorBy === 'income'
          ? (p.entity.incomeGroupId ?? null)
          : null,
  }))
  const n = points.length
  const enough = n >= MIN_CORRELATION_N && x.id !== y.id
  const xy = points.map((p) => ({ x: p.x, y: p.y }))
  const r = enough ? pearson(xy) : null
  const rho = enough ? spearman(xy) : null
  const fit = enough ? linearRegression(xy) : null

  const residuals: Residual[] = fit
    ? points.map((p) => {
        const expected = fit.predict(p.x)
        return { entity: p.entity, x: p.x, y: p.y, expected, residual: p.y - expected }
      })
    : []
  const above = [...residuals].sort((a, b) => b.residual - a.residual).slice(0, 3)
  const below = [...residuals].sort((a, b) => a.residual - b.residual).slice(0, 3)

  const overTime = repo.waves.map((w) => {
    const pw = pairs(repo, x.id, y.id, w, economies)
    return {
      wave: w,
      n: pw.length,
      r: pw.length >= MIN_CORRELATION_N && x.id !== y.id ? pearson(pw) : null,
    }
  })

  return {
    wave,
    scope,
    x,
    y,
    points,
    n,
    excluded: economies.length - n,
    enough,
    r,
    rho,
    strength: r === null ? null : correlationStrength(r),
    fit,
    above,
    below,
    overTime,
    domains: {
      x: axisDomain(
        x.unit,
        points.map((p) => p.x),
      ),
      y: axisDomain(
        y.unit,
        points.map((p) => p.y),
      ),
    },
  }
}

export interface MatrixCell {
  x: IndicatorId
  y: IndicatorId
  r: number | null
  n: number
}

/** Pairwise Pearson r for the matrix indicators; null where fewer than MIN_CORRELATION_N pairs. */
export function correlationMatrix(
  repo: FindexRepository,
  wave: Wave,
  opts: { region?: string; income?: string } = {},
): { indicators: IndicatorDefinition[]; cells: MatrixCell[][] } {
  const scope = resolveScope(repo, opts)
  const economies = scopeEconomies(repo, scope)
  const indicators = MATRIX_IDS.flatMap((id) => {
    const i = repo.indicator(id)
    return i ? [i] : []
  })
  const cells = indicators.map((row) =>
    indicators.map((col) => {
      if (row.id === col.id) return { x: col.id, y: row.id, r: 1, n: 0 }
      const p = pairs(repo, col.id, row.id, wave, economies)
      return {
        x: col.id,
        y: row.id,
        n: p.length,
        r: p.length >= MIN_CORRELATION_N ? pearson(p) : null,
      }
    }),
  )
  return { indicators, cells }
}

/**
 * Plain-language description of the fitted slope, scaled to a 10-point difference in x.
 * e.g. "Economies with 10 pp more mobile money account ownership have, on average, 4.1 pp
 * higher account ownership."
 */
export function slopeSentence(m: CorrelationModel): string | null {
  if (!m.fit || m.r === null || correlationStrength(m.r) === 'very weak') return null
  const d = m.fit.slope * 10
  const size = Math.abs(d).toFixed(1)
  return `Across these ${m.n} economies, a 10-point higher ${m.x.shortLabel.toLowerCase()} goes with ${size} points ${d >= 0 ? 'higher' : 'lower'} ${m.y.shortLabel.toLowerCase()} on average.`
}
