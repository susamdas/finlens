/**
 * FinLens forecasting models (spec §13).
 *
 * Deliberately simple, transparent extrapolations of a handful of survey observations. They
 * are FinLens projections — NOT World Bank forecasts — and they assume the past pattern
 * continues. Every projection carries an uncertainty interval and is withheld when the history
 * is too short (fewer than MIN_OBSERVATIONS surveys).
 */

export interface Observation {
  /** Actual survey year (x). */
  year: number
  value: number
}

export type ForecastModelId = 'linear' | 'recent' | 'logistic'

export interface FittedModel {
  id: ForecastModelId
  /** Central projection for a year (unclamped model output, in value units). */
  predict: (year: number) => number
  /** Prediction interval at `level` for a year: [low, high] in value units. */
  interval: (year: number, level: IntervalLevel) => [number, number]
  n: number
  /** Residual standard deviation in the model's working space. */
  residualSd: number
}

export interface ForecastModel {
  id: ForecastModelId
  label: string
  short: string
  description: string
  /** Minimum observations this model needs. */
  minN: number
  /** Only for shares bounded by 0–100 %. */
  boundedOnly?: boolean
  fit: (obs: Observation[]) => FittedModel | null
}

export type IntervalLevel = 0.8 | 0.95

export const MIN_OBSERVATIONS = 3

/** Two-sided Student-t critical values by degrees of freedom (1–10), for 80 % and 95 %. */
const T_TABLE: Record<IntervalLevel, number[]> = {
  0.8: [3.078, 1.886, 1.638, 1.533, 1.476, 1.44, 1.415, 1.397, 1.383, 1.372],
  0.95: [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228],
}
export function tCritical(df: number, level: IntervalLevel): number {
  const row = T_TABLE[level]
  return row[Math.min(Math.max(df, 1), row.length) - 1]!
}

interface Ols {
  slope: number
  intercept: number
  n: number
  mx: number
  sxx: number
  s: number
}

/** OLS with residual SD (df = n − 2). Null without x variance or with fewer than 2 points. */
function ols(xs: number[], ys: number[]): Ols | null {
  const n = xs.length
  if (n < 2) return null
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxx = 0
  let sxy = 0
  for (let i = 0; i < n; i++) {
    sxx += (xs[i]! - mx) ** 2
    sxy += (xs[i]! - mx) * (ys[i]! - my)
  }
  if (sxx === 0) return null
  const slope = sxy / sxx
  const intercept = my - slope * mx
  let sse = 0
  for (let i = 0; i < n; i++) sse += (ys[i]! - (intercept + slope * xs[i]!)) ** 2
  const s = n > 2 ? Math.sqrt(sse / (n - 2)) : 0
  return { slope, intercept, n, mx, sxx, s }
}

/** Half-width of the OLS prediction interval at x. */
function halfWidth(o: Ols, x: number, level: IntervalLevel): number {
  const df = Math.max(1, o.n - 2)
  // With a perfect or two-point fit s = 0; keep a visible minimum so no projection looks certain.
  const s = Math.max(o.s, 0.5)
  return tCritical(df, level) * s * Math.sqrt(1 + 1 / o.n + (x - o.mx) ** 2 / o.sxx)
}

function linearFrom(id: ForecastModelId, obs: Observation[]): FittedModel | null {
  const o = ols(
    obs.map((p) => p.year),
    obs.map((p) => p.value),
  )
  if (!o) return null
  const predict = (x: number) => o.intercept + o.slope * x
  return {
    id,
    n: o.n,
    residualSd: o.s,
    predict,
    interval: (x, level) => {
      const h = halfWidth(o, x, level)
      return [predict(x) - h, predict(x) + h]
    },
  }
}

const EPS = 0.5 // keep logits finite: shares are clipped to [0.5 %, 99.5 %]
const logit = (v: number) => {
  const p = Math.min(100 - EPS, Math.max(EPS, v)) / 100
  return Math.log(p / (1 - p))
}
const expit = (z: number) => 100 / (1 + Math.exp(-z))

export const MODELS: ForecastModel[] = [
  {
    id: 'logistic',
    label: 'S-curve (logistic)',
    short: 'S-curve',
    description:
      'Fits a straight line to the log-odds of the share, so growth slows as it approaches 0 % or 100 %. Suits adoption-style indicators such as account ownership.',
    minN: MIN_OBSERVATIONS,
    boundedOnly: true,
    fit: (obs) => {
      const o = ols(
        obs.map((p) => p.year),
        obs.map((p) => logit(p.value)),
      )
      if (!o) return null
      const z = (x: number) => o.intercept + o.slope * x
      return {
        id: 'logistic',
        n: o.n,
        residualSd: o.s,
        predict: (x) => expit(z(x)),
        interval: (x, level) => {
          // Interval in log-odds space, mapped back: asymmetric and always within 0–100 %.
          const h =
            tCritical(Math.max(1, o.n - 2), level) *
            Math.max(o.s, 0.05) *
            Math.sqrt(1 + 1 / o.n + (x - o.mx) ** 2 / o.sxx)
          return [expit(z(x) - h), expit(z(x) + h)]
        },
      }
    },
  },
  {
    id: 'linear',
    label: 'Straight-line trend',
    short: 'Linear',
    description:
      'Fits one straight line through every survey. Simple and easy to audit, but it can run past 0 % or 100 % (values are then capped and flagged).',
    minN: MIN_OBSERVATIONS,
    fit: (obs) => linearFrom('linear', obs),
  },
  {
    id: 'recent',
    label: 'Recent trend (last 3 surveys)',
    short: 'Recent',
    description:
      'A straight line through the three most recent surveys only, so it reacts to recent acceleration or slowdown — and to one-off shocks.',
    minN: MIN_OBSERVATIONS,
    fit: (obs) => linearFrom('recent', obs.slice(-3)),
  },
]

export function getModel(id: string | null | undefined): ForecastModel | undefined {
  return MODELS.find((m) => m.id === id)
}
