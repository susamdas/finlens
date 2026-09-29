import { FindexRepository } from '@/data/repository/FindexRepository'
import { buildMapModel, economyDetail, resolveMapMetric } from '@/features/map/map.logic'
import { CORE, META } from './fixtures/dataset'

describe('map model', () => {
  const repo = FindexRepository.fromData(META, [CORE])
  it('builds values, ranks and regional averages for a wave', () => {
    const m = buildMapModel(repo, 'accountOwnership', 2024)
    expect(m.values).toEqual({ AAA: 43.3 })
    expect(m.rankOf.AAA).toBe(1)
    expect(m.regionAverage.SAS?.value).toBe(77.6)
    expect(m.missing).toHaveLength(0)
  })
  it('supports sex-disaggregated metrics and falls back to the default', () => {
    expect(buildMapModel(repo, 'accountWomen', 2024).values).toEqual({ AAA: 38.6 })
    expect(resolveMapMetric(repo, 'nonsense').id).toBe('accountOwnership')
  })
  it('lists economies without a value as missing, never zero', () => {
    const m = buildMapModel(repo, 'accountOwnership', 2014)
    expect(m.values).toEqual({})
    expect(m.missing.map((e) => e.code)).toEqual(['AAA'])
  })
  it('provides tooltip rows from dataset values', () => {
    const d = economyDetail(repo, 'AAA', 2024)!
    expect(d.rows[0]).toEqual({ label: 'Account ownership', value: 43.3 })
    expect(d.rows[1]?.value).toBeNull()
  })
})
