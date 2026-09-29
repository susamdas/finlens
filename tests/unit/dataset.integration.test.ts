/**
 * Golden checks against the real processed Findex files (skipped when they haven't been built).
 * Expected values were read directly from GlobalFindexDatabase2025.xlsx.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FindexRepository } from '@/data/repository/FindexRepository'

const DIR = resolve(import.meta.dirname, '../../public/data/processed')
const built = existsSync(resolve(DIR, 'meta.json'))

describe.skipIf(!built)('processed Findex dataset', () => {
  const read = (f: string) => JSON.parse(readFileSync(resolve(DIR, f.split('?')[0]!), 'utf8'))
  const repo = FindexRepository.fromData(read('meta.json'), [read('core.json')], async (p) =>
    read(p),
  )

  it('has the expected shape', () => {
    expect(repo.waves).toEqual([2011, 2014, 2017, 2021, 2024])
    expect(repo.economies().length).toBeGreaterThan(150)
    expect(repo.entity('BGD')?.regionId).toBe('SAS')
  })

  it('matches source values for Bangladesh and South Asia', () => {
    expect(repo.value('accountOwnership', 'BGD', 2011)).toBe(31.74)
    expect(repo.value('accountOwnership', 'BGD', 2021)).toBe(52.81)
    expect(repo.value('accountOwnership', 'BGD', 2024)).toBe(43.28)
    expect(repo.value('mobileMoneyAccount', 'BGD', 2017)).toBe(21.25)
    expect(repo.value('mobileMoneyAccount', 'BGD', 2011)).toBeNull()
    expect(repo.value('accountOwnership', 'SAS', 2024)).toBe(77.57)
  })

  it('places 2022 fieldwork in the 2021 wave', () => {
    expect(repo.surveyYear('VNM', 2021)).toBe(2022)
    expect(repo.value('accountOwnership', 'VNM', 2021)).not.toBeNull()
  })

  it('loads catalogue series on demand', async () => {
    await repo.ensureIndicators(['fx_fin11a'])
    expect(repo.isLoaded('fx_fin11a')).toBe(true)
  })
})
