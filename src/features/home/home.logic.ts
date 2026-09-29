import type { FindexRepository } from '@/data/repository'
import type { SeriesPoint, Wave } from '@/data/types'
import { buildKpi, unbankedAdults, type KpiModel } from '@/lib/analytics/kpi'
import { changes, topMovers, type Mover } from '@/lib/analytics/movers'
import { DEVELOPING, WORLD } from '@/lib/analytics/scope'

export interface HomeModel {
  wave: Wave
  firstWave: Wave
  worldAccount: KpiModel | null
  worldAccountFirst: number | null
  worldSeries: SeriesPoint[]
  developingMobile: KpiModel | null
  unbanked: { total: number; economies: number } | null
  surveyed: number
  economies: number
  regions: {
    id: string
    name: string
    slug: string
    value: number | null
    series: SeriesPoint[]
    excludesHighIncome: boolean
  }[]
  movers: Mover[]
}

export function buildHome(repo: FindexRepository): HomeModel {
  const wave = repo.latestWave
  const firstWave = repo.waves[0]!
  return {
    wave,
    firstWave,
    worldAccount: buildKpi(repo, 'accountOwnership', WORLD, wave),
    worldAccountFirst: repo.value('accountOwnership', WORLD.code, firstWave),
    worldSeries: repo.series('accountOwnership', WORLD.code),
    developingMobile: buildKpi(repo, 'mobileMoneyAccount', DEVELOPING, wave),
    unbanked: unbankedAdults(
      repo,
      repo.economies().map((e) => e.code),
      wave,
    ),
    surveyed: repo.meta.coverage[String(wave)] ?? 0,
    economies: repo.economies().length,
    regions: repo.regions.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      value: repo.value('accountOwnership', r.aggregateCode, wave),
      series: repo.series('accountOwnership', r.aggregateCode),
      excludesHighIncome: r.excludesHighIncome,
    })),
    movers: topMovers(changes(repo, 'accountOwnership', wave, repo.economies()), 4, 'up'),
  }
}
