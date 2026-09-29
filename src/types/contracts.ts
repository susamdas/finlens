/**
 * Architectural contracts: the seams between layers.
 *
 * These interfaces let us swap implementations without touching UI code:
 *   - DataRepository: static JSON today, REST API later.
 *   - AnalystProvider: rule-based interpreter today; OpenAI / Claude / Gemini / local LLM later.
 *   - ForecastModel:  linear / moving-average today; more advanced models later.
 *
 * Domain shapes live in src/data/types.ts (finalized in Phase 4 against the Findex 2025 file).
 */

import type { FindexRepository } from '@/data/repository/FindexRepository'
import type { CountryCode, Observation } from '@/data/types'

export type { CountryCode, IndicatorId, Observation, Wave as SurveyYear } from '@/data/types'

/** The data layer seam. Static JSON today (FindexRepository + staticFetcher); REST via apiFetcher. */
export type DataRepository = FindexRepository

// ---- AI Analyst -----------------------------------------------------------------------------

export type SuggestedChart = 'bar' | 'line' | 'scatter' | 'map' | 'radar' | 'table'

/** Every number an analyst answer shows must reference a real observation. */
export interface GroundedValue {
  label: string
  observation: Observation
}

export interface AnalystAnswer {
  summary: string
  values: GroundedValue[]
  suggestedChart?: SuggestedChart
  relatedCountries: CountryCode[]
  followUps: string[]
  /** Which provider produced this answer, shown to users for transparency. */
  provider: string
}

export interface AnalystProvider {
  readonly id: string
  answer(question: string, repo: DataRepository): Promise<AnalystAnswer>
}

// ---- Forecasting ----------------------------------------------------------------------------

export interface ForecastInputPoint {
  year: number
  value: number
}

export interface ForecastPoint extends ForecastInputPoint {
  lower?: number
  upper?: number
}

export interface ForecastResult {
  modelId: string
  history: ForecastInputPoint[]
  projection: ForecastPoint[]
  methodology: string
}

export interface ForecastModel {
  readonly id: string
  readonly label: string
  /** Minimum historical points required for a meaningful projection. */
  readonly minPoints: number
  fit(history: ForecastInputPoint[], horizonYears: number[]): ForecastResult
}
