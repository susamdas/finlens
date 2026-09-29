import { FindexRepository } from '@/data/repository/FindexRepository'
import { CORE, GROUPS, META } from './fixtures/dataset'

const repo = () =>
  FindexRepository.fromData(META, [CORE], async <T>(path: string) => {
    if (path.startsWith('core-groups.json')) return GROUPS as T
    throw new Error(`unexpected ${path}`)
  })

describe('FindexRepository', () => {
  it('returns published values and null for gaps — never zero', () => {
    const r = repo()
    expect(r.value('accountOwnership', 'AAA', 2024)).toBe(43.3)
    expect(r.value('accountOwnership', 'AAA', 2014)).toBeNull()
    expect(r.value('unknownIndicator', 'AAA', 2024)).toBeNull()
  })

  it('keeps missing waves in series', () => {
    expect(
      repo()
        .series('accountOwnership', 'AAA')
        .map((p) => p.value),
    ).toEqual([30, null, 50, 52.8, 43.3])
  })

  it('finds latest and previous available waves', () => {
    const r = repo()
    expect(r.latest('accountOwnership', 'AAA')).toEqual({ wave: 2024, value: 43.3 })
    expect(r.previous('accountOwnership', 'AAA', 2017)).toEqual({ wave: 2011, value: 30 }) // skips missing 2014
  })

  it('computes derived indicators from published inputs', () => {
    const r = repo()
    expect(r.value('noAccount', 'AAA', 2024)).toBe(56.7)
    expect(r.value('genderGapAccount', 'AAA', 2024)).toBe(9.5)
    expect(r.value('genderGapAccount', 'AAA', 2021)).toBeNull() // no sex breakdown that wave
    expect(r.adultsWithoutAccount('AAA', 2024)).toBe(567)
  })

  it('loads other population groups on demand', async () => {
    const r = repo()
    expect(r.value('incomeGapAccount', 'AAA', 2024)).toBeNull()
    expect(r.isLoaded('incomeGapAccount')).toBe(false)
    await r.ensureGroups()
    expect(r.value('incomeGapAccount', 'AAA', 2024)).toBe(16.75)
    expect(r.isLoaded('incomeGapAccount')).toBe(true)
  })

  it('uses published aggregates as benchmarks', () => {
    const b = repo().benchmarks('accountOwnership', 'AAA', 2024)
    expect(b.region).toEqual({ code: 'SAS', name: 'South Asia', value: 77.6 })
    expect(b.incomeGroup?.value).toBe(70)
    expect(b.world?.value).toBe(79)
  })

  it('builds cross-sections of economies only by default', () => {
    const cs = repo().crossSection('accountOwnership', 2024)
    expect(cs.map((c) => c.entity.code)).toEqual(['AAA'])
  })

  it('resolves slugs, survey years and queries', () => {
    const r = repo()
    expect(r.entityBySlug('alpha')?.code).toBe('AAA')
    expect(r.entityBySlug('south-asia')).toBeUndefined()
    expect(r.surveyYear('AAA', 2021)).toBe(2022)
    expect(r.query({ indicatorIds: ['accountOwnership'], codes: ['AAA'] })).toHaveLength(4)
  })
})
