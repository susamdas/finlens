import type { FindexRepository } from '@/data/repository'
import type { Entity, IndicatorDefinition, IndicatorId, SeriesPoint, Wave } from '@/data/types'
import { buildKpi, unbankedAdults, type KpiModel } from '@/lib/analytics/kpi'
import { changes, rank, topMovers, type Mover, type Ranked } from '@/lib/analytics/movers'
import {
  DEVELOPING,
  resolveScope,
  scopeEconomies,
  scopeSourceFor,
  WORLD,
  type Scope,
} from '@/lib/analytics/scope'
import { linearRegression, MIN_CORRELATION_N, pearson, type LinearFit } from '@/lib/analytics/stats'
import { overviewInsights } from '@/lib/insights/overview'
import type { Insight } from '@/lib/insights/types'
import type { GlobalFilters } from '@/lib/url'

export const DEFAULT_METRIC = 'accountOwnership'

/** Indicators offered in the overview metric filter (curated, all-adult level). */
export function overviewMetrics(repo: FindexRepository): IndicatorDefinition[] {
  return repo.indicators({ core: true }).filter((i) => !i.derived?.groupsOnly)
}

export interface KpiSpec {
  id: IndicatorId
  group?: 'all' | 'women'
  label?: string
}

export const KPI_SPECS: KpiSpec[] = [
  { id: 'accountOwnership' },
  { id: 'noAccount' },
  { id: 'mobileMoneyAccount' },
  { id: 'digitalPayments', label: 'Digital payments' },
  { id: 'formalSavings' },
  { id: 'formalBorrowing' },
  { id: 'accountOwnership', group: 'women', label: 'Women with an account' },
  { id: 'genderGapAccount' },
]

export interface OverviewModel {
  scope: Scope
  wave: Wave
  waves: Wave[]
  metric: IndicatorDefinition
  kpis: { spec: KpiSpec; kpi: KpiModel }[]
  unbanked: { total: number; economies: number } | null
  distribution: { ranked: Ranked[]; scopeValue: number | null; economies: number }
  regions: { id: string; name: string; slug: string; value: number | null; highlight: boolean }[]
  worldRef: { label: string; value: number } | null
  trend: {
    scope: SeriesPoint[]
    scopeLabel: string
    context: SeriesPoint[] | null
    contextLabel: string | null
  }
  digital: { source: Scope; account: SeriesPoint[]; mobile: SeriesPoint[]; payments: SeriesPoint[] }
  gender: { key: string; label: string; women: number | null; men: number | null; href?: string }[]
  scatter: {
    points: { entity: Entity; x: number; y: number; inScope: boolean }[]
    /** Economies used for r and the fit (in scope, both values present). */
    n: number
    r: number | null
    fit: LinearFit | null
  }
  movers: Mover[]
  insights: Insight[]
}

export function scopeParamValue(scope: Scope, repo: FindexRepository): string {
  if (scope.kind === 'developing') return 'developing'
  if (scope.kind === 'region') return `region:${repo.region(scope.regionId!)?.slug}`
  if (scope.kind === 'income') return `income:${repo.incomeGroup(scope.incomeGroupId!)?.slug}`
  return 'world'
}

/** Converts a ScopeSelector value to URL filter patch (region and income are mutually exclusive). */
export function scopeToFilters(
  v: string,
): Pick<GlobalFilters, 'region' | 'income'> & { region?: string | undefined } {
  if (v === 'developing') return { region: 'developing', income: undefined }
  if (v.startsWith('region:')) return { region: v.slice(7), income: undefined }
  if (v.startsWith('income:')) return { region: undefined, income: v.slice(7) }
  return { region: undefined, income: undefined }
}

export function buildOverview(repo: FindexRepository, filters: GlobalFilters): OverviewModel {
  const wave = filters.year && repo.waves.includes(filters.year) ? filters.year : repo.latestWave
  const scope = resolveScope(repo, filters)
  const metric = repo.indicator(filters.metric ?? DEFAULT_METRIC) ?? repo.indicator(DEFAULT_METRIC)!
  const economies = scopeEconomies(repo, scope)

  const kpis = KPI_SPECS.flatMap((spec) => {
    const kpi = buildKpi(repo, spec.id, scope, wave, spec.group ?? 'all')
    return kpi ? [{ spec, kpi }] : []
  })

  // Distribution across economies in scope
  const cross = repo
    .crossSection(metric.id, wave)
    .filter((c) => economies.some((e) => e.code === c.entity.code))
  const metricSource = scopeSourceFor(repo, metric.id, scope)

  const regions = repo.regions.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    value: repo.value(metric.id, r.aggregateCode, wave),
    highlight: scope.kind === 'region' && scope.regionId === r.id,
  }))
  const worldSource = scopeSourceFor(repo, metric.id, WORLD)
  const worldValue = repo.value(metric.id, worldSource.code, wave)

  const context = scope.kind === 'world' ? null : worldSource
  const digitalSource = scopeSourceFor(repo, 'digitalPayments', scope)

  const genderRows = [
    ...(scope.kind === 'world'
      ? [{ key: 'WLD', label: 'World', code: 'WLD' }]
      : [{ key: scope.code, label: scope.label, code: scope.code }]),
    ...repo.regions
      .filter((r) => !(scope.kind === 'region' && r.id === scope.regionId))
      .map((r) => ({ key: r.id, label: r.name, code: r.aggregateCode, href: `/region/${r.slug}` })),
  ].map((r) => ({
    key: r.key,
    label: r.label,
    women: repo.value('accountOwnership', r.code, wave, 'women'),
    men: repo.value('accountOwnership', r.code, wave, 'men'),
    href: 'href' in r ? r.href : undefined,
  }))

  const scatterPts = repo
    .economies()
    .map((e) => ({
      entity: e,
      x: repo.value('mobileMoneyAccount', e.code, wave),
      y: repo.value('accountOwnership', e.code, wave),
      inScope: scope.kind === 'world' || economies.some((s) => s.code === e.code),
    }))
    .filter(
      (p): p is { entity: Entity; x: number; y: number; inScope: boolean } =>
        p.x !== null && p.y !== null,
    )
  const fitPts = scatterPts.filter((p) => p.inScope).map((p) => ({ x: p.x, y: p.y }))

  const moverMetric =
    metric.unit === '%' && metric.higherIsBetter !== false ? metric.id : 'accountOwnership'

  return {
    scope,
    wave,
    waves: repo.waves,
    metric,
    kpis,
    unbanked: unbankedAdults(
      repo,
      economies.map((e) => e.code),
      wave,
    ),
    distribution: {
      ranked: rank(cross),
      scopeValue: repo.value(metric.id, metricSource.code, wave),
      economies: economies.length,
    },
    regions,
    worldRef:
      worldValue !== null
        ? {
            label: `${worldSource.label}: ${worldValue.toFixed(1)}${metric.unit === 'pp' ? ' pp' : '%'}`,
            value: worldValue,
          }
        : null,
    trend: {
      scope: repo.series(metric.id, metricSource.code),
      scopeLabel: metricSource.label,
      context: context ? repo.series(metric.id, context.code) : null,
      contextLabel: context?.label ?? null,
    },
    digital: {
      source: digitalSource,
      account: repo.series('accountOwnership', digitalSource.code),
      mobile: repo.series('mobileMoneyAccount', digitalSource.code),
      payments: repo.series('digitalPayments', digitalSource.code),
    },
    gender: genderRows,
    scatter: {
      points: scatterPts,
      n: fitPts.length,
      r: fitPts.length >= MIN_CORRELATION_N ? pearson(fitPts) : null,
      fit: fitPts.length >= MIN_CORRELATION_N ? linearRegression(fitPts) : null,
    },
    movers: topMovers(changes(repo, moverMetric, wave, economies), 6, 'up'),
    insights: overviewInsights(repo, scope, wave),
  }
}

export { DEVELOPING, WORLD }
