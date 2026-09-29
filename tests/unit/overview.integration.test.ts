import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FindexRepository } from '@/data/repository/FindexRepository'
import { buildOverview, scopeParamValue, scopeToFilters } from '@/features/overview/overview.logic'
import type { GlobalFilters } from '@/lib/url'

const DIR = resolve(import.meta.dirname, '../../public/data/processed')
const built = existsSync(resolve(DIR, 'meta.json'))

describe.skipIf(!built)('global overview on real data', () => {
  const read = (f: string) => JSON.parse(readFileSync(resolve(DIR, f.split('?')[0]!), 'utf8'))
  const repo = FindexRepository.fromData(read('meta.json'), [read('core.json')], async (p) =>
    read(p),
  )
  const filters = (f: Partial<GlobalFilters>) => f as GlobalFilters

  it('defaults to the World, the latest wave and account ownership', () => {
    const m = buildOverview(repo, filters({}))
    expect(m.scope.kind).toBe('world')
    expect(m.wave).toBe(2024)
    expect(m.metric.id).toBe('accountOwnership')
    // Findex 2025: World account ownership 2024 = 78.74 %
    expect(m.kpis[0]?.kpi.value).toBe(78.74)
    expect(m.worldRef?.value).toBe(78.74)
    expect(m.regions).toHaveLength(repo.regions.length)
  })

  it('sums unbanked adults over economies (World has no population figure)', () => {
    const m = buildOverview(repo, filters({}))
    expect(m.unbanked?.economies).toBeGreaterThan(100)
    expect(m.unbanked?.total).toBeGreaterThan(0)
  })

  it('reports r and a fit only with enough economies, and never invents points', () => {
    const m = buildOverview(repo, filters({}))
    expect(m.scatter.n).toBeGreaterThanOrEqual(10)
    expect(m.scatter.r).not.toBeNull()
    for (const p of m.scatter.points) {
      expect(repo.value('accountOwnership', p.entity.code, 2024)).toBe(p.y)
      expect(repo.value('mobileMoneyAccount', p.entity.code, 2024)).toBe(p.x)
    }
  })

  it('narrows to a region and adds the world as context', () => {
    const m = buildOverview(repo, filters({ region: 'south-asia' }))
    expect(m.scope.kind).toBe('region')
    expect(m.trend.contextLabel).not.toBeNull()
    expect(m.regions.find((r) => r.highlight)?.slug).toBe('south-asia')
    expect(m.distribution.ranked.every((r) => r.entity.regionId === 'SAS')).toBe(true)
    expect(scopeParamValue(m.scope, repo)).toBe('region:south-asia')
  })

  it('honours the year filter and ignores a wave that does not exist', () => {
    expect(buildOverview(repo, filters({ year: 2017 })).wave).toBe(2017)
    expect(buildOverview(repo, filters({ year: 2019 })).wave).toBe(2024)
  })

  it('keeps region and income group mutually exclusive in the URL', () => {
    expect(scopeToFilters('region:south-asia')).toEqual({
      region: 'south-asia',
      income: undefined,
    })
    expect(scopeToFilters('income:low-income')).toEqual({
      region: undefined,
      income: 'low-income',
    })
    expect(scopeToFilters('world')).toEqual({ region: undefined, income: undefined })
  })
})
