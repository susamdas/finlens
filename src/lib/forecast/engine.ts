import {
  MIN_OBSERVATIONS,
  MODELS,
  type ForecastModel,
  type ForecastModelId,
  type IntervalLevel,
  type Observation,
} from './models'

export interface ProjectionPoint {
  year: number
  value: number
  low: number
  high: number
  /** True when the model output ran past 0–100 % and was capped. */
  capped: boolean
}

export interface Backtest {
  /** The most recent survey, hidden from the model and then compared with its projection. */
  year: number
  actual: number
  predicted: number
  /** predicted − actual, in points. */
  error: number
}

export interface ModelForecast {
  model: ForecastModel
  available: boolean
  /** Why the model could not be used (too few surveys, not a bounded share…). */
  reason?: string
  projections: ProjectionPoint[]
  backtest: Backtest | null
}

export interface SeriesForecast {
  observations: Observation[]
  enough: boolean
  models: ModelForecast[]
  /** Model with the smallest back-test error (falls back to the default for the unit). */
  recommended: ForecastModelId | null
  recommendationReason: string
  level: IntervalLevel
  lastObservedYear: number | null
  /**
   * True when even the best model missed the latest survey by UNSTABLE_PP or more — the most
   * recent result broke from the earlier pattern, so any projection is especially uncertain.
   */
  unstable: boolean
}

/** Back-test miss (points) above which a series is flagged as breaking from its pattern. */
export const UNSTABLE_PP = 5

const r2 = (n: number) => Math.round(n * 100) / 100

export function forecastSeries(
  observations: Observation[],
  opts: { bounded: boolean; years: number[]; level?: IntervalLevel },
): SeriesForecast {
  const level = opts.level ?? 0.8
  const obs = [...observations].sort((a, b) => a.year - b.year)
  const last = obs.at(-1)?.year ?? null
  const years = opts.years.filter((y) => last === null || y > last)
  const cap = (v: number) => (opts.bounded ? Math.min(100, Math.max(0, v)) : v)

  const models: ModelForecast[] = MODELS.map((model) => {
    if (model.boundedOnly && !opts.bounded)
      return {
        model,
        available: false,
        reason: 'Only for shares between 0 % and 100 %.',
        projections: [],
        backtest: null,
      }
    if (obs.length < model.minN)
      return {
        model,
        available: false,
        reason: `Needs at least ${model.minN} surveys (${obs.length} available).`,
        projections: [],
        backtest: null,
      }
    const fitted = model.fit(obs)
    if (!fitted)
      return {
        model,
        available: false,
        reason: 'The surveys do not vary enough to fit this model.',
        projections: [],
        backtest: null,
      }
    const projections = years.map((year) => {
      const raw = fitted.predict(year)
      const [lo, hi] = fitted.interval(year, level)
      return {
        year,
        value: r2(cap(raw)),
        low: r2(cap(lo)),
        high: r2(cap(hi)),
        capped: opts.bounded && (raw < 0 || raw > 100),
      }
    })
    // Back-test: refit without the latest survey and project it.
    let backtest: Backtest | null = null
    const train = obs.slice(0, -1)
    const held = obs.at(-1)
    if (held && train.length >= model.minN) {
      const f = model.fit(train)
      if (f) {
        const predicted = r2(cap(f.predict(held.year)))
        backtest = {
          year: held.year,
          actual: held.value,
          predicted,
          error: r2(predicted - held.value),
        }
      }
    }
    return { model, available: true, projections, backtest }
  })

  const usable = models.filter((m) => m.available)
  const tested = usable.filter((m) => m.backtest)
  let recommended: ForecastModelId | null = null
  let recommendationReason = ''
  let unstable = false
  if (tested.length) {
    const best = [...tested].sort(
      (a, b) => Math.abs(a.backtest!.error) - Math.abs(b.backtest!.error),
    )[0]!
    recommended = best.model.id
    unstable = Math.abs(best.backtest!.error) >= UNSTABLE_PP
    recommendationReason = `Closest when projecting the ${best.backtest!.year} survey from earlier ones (${Math.abs(best.backtest!.error) < 0.05 ? 'within 0.1 points' : `off by ${Math.abs(best.backtest!.error).toFixed(1)} points`}).`
  } else if (usable.length) {
    const fallback = usable.find((m) => m.model.id === (opts.bounded ? 'logistic' : 'linear'))
    recommended = (fallback ?? usable[0]!).model.id
    recommendationReason =
      'Too few surveys to back-test; the default model for this kind of indicator is used.'
  }

  return {
    observations: obs,
    enough: obs.length >= MIN_OBSERVATIONS,
    models,
    recommended,
    recommendationReason,
    level,
    lastObservedYear: last,
    unstable,
  }
}
