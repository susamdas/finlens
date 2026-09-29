import type { FindexRepository } from '@/data/repository'
import type { Entity, IndicatorDefinition, IndicatorId } from '@/data/types'
import { overviewMetrics } from '@/features/overview/overview.logic'
import { resolveScope, scopeSourceFor, WORLD, type Scope } from '@/lib/analytics/scope'
import {
  forecastSeries,
  getModel,
  type ForecastModelId,
  type ModelForecast,
  type Observation,
  type SeriesForecast,
} from '@/lib/forecast'

/**
 * Forecast view model. Projections are FinLens extrapolations of published survey values,
 * not World Bank figures; see lib/forecast for the models and their limits.
 */

export const DEFAULT_FORECAST_METRIC: IndicatorId = 'accountOwnership'
/** Years to project to. Illustrative horizons, not announced survey dates. */
export const FORECAST_YEARS = [2027, 2030]

export interface ForecastTarget {
  kind: 'economy' | 'aggregate'
  code: string
  label: string
  entity?: Entity
  /** For aggregates: the scope requested (the aggregate used may differ, see `fallback`). */
  scope?: Scope
  fallback: boolean
}

export interface ForecastView {
  metric: IndicatorDefinition
  target: ForecastTarget
  forecast: SeriesForecast
  selected: ModelForecast | null
  /** Surveys whose year differs from their wave (e.g. 2022 fieldwork for the 2021 wave). */
  remapped: { wave: number; year: number }[]
  regional: { id: string; label: string; code: string; forecast: SeriesForecast }[]
}

export function forecastMetrics(repo: FindexRepository): IndicatorDefinition[] {
  return overviewMetrics(repo)
}

/** Published values as (survey year, value); economies use their actual fieldwork year. */
export function observationsFor(
  repo: FindexRepository,
  id: IndicatorId,
  code: string,
  economy: boolean,
): Observation[] {
  return repo.waves.flatMap((w) => {
    const v = repo.value(id, code, w)
    return v === null ? [] : [{ year: economy ? repo.surveyYear(code, w) : w, value: v }]
  })
}

export function buildForecast(
  repo: FindexRepository,
  opts: {
    metric?: string
    country?: string
    region?: string
    income?: string
    model?: string | null
  } = {},
): ForecastView {
  const metrics = forecastMetrics(repo)
  const metric =
    metrics.find((m) => m.id === opts.metric) ??
    metrics.find((m) => m.id === DEFAULT_FORECAST_METRIC) ??
    metrics[0]!
  const bounded = metric.unit === '%'
  const entity = opts.country ? repo.entity(opts.country) : undefined

  let target: ForecastTarget
  if (entity?.kind === 'economy') {
    target = {
      kind: 'economy',
      code: entity.code,
      label: entity.shortName,
      entity,
      fallback: false,
    }
  } else {
    const scope = resolveScope(repo, { region: opts.region, income: opts.income })
    const source = scopeSourceFor(repo, metric.id, scope)
    target = {
      kind: 'aggregate',
      code: source.code,
      label: source.label,
      scope,
      fallback: source.code !== scope.code,
    }
  }

  const economy = target.kind === 'economy'
  const forecast = forecastSeries(observationsFor(repo, metric.id, target.code, economy), {
    bounded,
    years: FORECAST_YEARS,
  })
  const requested = getModel(opts.model)?.id
  const pick: ForecastModelId | null =
    requested && forecast.models.find((m) => m.model.id === requested)?.available
      ? requested
      : forecast.recommended
  const selected = forecast.models.find((m) => m.model.id === pick) ?? null

  const remapped = economy
    ? repo.waves
        .filter((w) => repo.value(metric.id, target.code, w) !== null)
        .map((w) => ({ wave: w, year: repo.surveyYear(target.code, w) }))
        .filter((r) => r.wave !== r.year)
    : []

  const globalSrc = scopeSourceFor(repo, metric.id, WORLD)
  const regional = [
    { id: 'global', label: globalSrc.label, code: globalSrc.code },
    ...repo.regions.map((r) => ({ id: r.id, label: r.name, code: r.aggregateCode })),
  ].map((r) => ({
    ...r,
    forecast: forecastSeries(observationsFor(repo, metric.id, r.code, false), {
      bounded,
      years: FORECAST_YEARS,
    }),
  }))

  return { metric, target, forecast, selected, remapped, regional }
}
