import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FindexRepository } from '@/data/repository/FindexRepository'
import {
  assignSlots,
  buildCompare,
  MAX_COMPARE,
  parseCountries,
  suggestPeers,
} from '@/features/compare/compare.logic'
import { buildRankings, rankValues } from '@/features/rankings/rankings.logic'
import { compareSummary } from '@/lib/insights/compare'
import type { Entity } from '@/data/types'

describe('colour slots', () => {
  it('keeps existing slots and fills the lowest free one', () => {
    const a = assignSlots(['BGD', 'IND', 'PAK'], {})
    expect(a).toEqual({ BGD: 0, IND: 1, PAK: 2 })
    const b = assignSlots(['BGD', 'PAK', 'NPL'], a)
    expect(b).toEqual({ BGD: 0, PAK: 2, NPL: 1 })
  })
})

describe('rank ordering', () => {
  const e = (code: string) => ({ code, shortName: code }) as Entity
  it('uses competition ranking with ties', () => {
    const r = rankValues(
      [
        { entity: e('A'), value: 10 },
        { entity: e('B'), value: 30 },
        { entity: e('C'), value: 30 },
        { entity: e('D'), value: 5 },
      ],
      'desc',
    )
    expect(r.map((x) => [x.entity.code, x.rank])).toEqual([
      ['B', 1],
      ['C', 1],
      ['A', 3],
      ['D', 4],
    ])
    expect(rankValues(r, 'asc')[0]!.entity.code).toBe('D')
  })
})

const DIR = resolve(import.meta.dirname, '../../public/data/processed')
const built = existsSync(resolve(DIR, 'meta.json'))

describe.skipIf(!built)('comparison and rankings on real data', () => {
  const read = (f: string) => JSON.parse(readFileSync(resolve(DIR, f.split('?')[0]!), 'utf8'))
  const repo = FindexRepository.fromData(read('meta.json'), [read('core.json')], async (p) =>
    read(p),
  )
  const SA = ['BGD', 'IND', 'PAK', 'NPL', 'LKA']

  it('parses the countries param: known economies, unique, max 5', () => {
    expect(parseCountries(repo, 'bgd,IND,xxx,BGD,WLD,PAK,NPL,LKA,AFG')).toEqual(SA)
    expect(parseCountries(repo, 'BGD,IND,PAK,NPL,LKA,AFG')).toHaveLength(MAX_COMPARE)
  })

  it('suggests regional peers starting with the economy itself', () => {
    const p = suggestPeers(repo, 'BGD')
    expect(p[0]).toBe('BGD')
    expect(p).toContain('IND')
    expect(p.every((c) => repo.entity(c)?.regionId === repo.entity('BGD')?.regionId)).toBe(true)
  })

  it('builds cells from published values and never fakes radar zeros', () => {
    const m = buildCompare(repo, SA, 2024)
    expect(m.cells.accountOwnership!.BGD!.value).toBe(43.28)
    expect(m.cells.accountOwnership!.BGD!.delta).toBe(-9.53)
    for (const axis of m.radarAxes)
      for (const c of SA) expect(m.cells[axis.key]![c]!.value).not.toBeNull()
    expect(m.leaders.accountOwnership).toEqual({ best: 'IND', worst: 'PAK' })
    expect(m.leaders.formalBorrowing).toEqual({ best: null, worst: null })
    // World usage aggregates are not published → developing-economies fallback is flagged.
    expect(m.worldSource.accountOwnership).toBe('WLD')
    expect(m.worldSource.digitalPayments).toBe('LMY')
  })

  it('leaves an economy without data in the wave off the radar instead of dropping axes', () => {
    const m = buildCompare(repo, ['KEN', 'UGA', 'TZA', 'RWA', 'ETH'], 2024)
    expect(m.radarOmitted.map((e) => e.code)).toEqual(['RWA'])
    expect(m.radarAxes.length).toBeGreaterThanOrEqual(3)
  })

  it('writes a summary grounded in the model', () => {
    const m = buildCompare(repo, SA, 2024)
    const s = compareSummary(m)
    expect(s.sentences.length).toBeGreaterThan(0)
    const text = s.sentences.join(' ')
    expect(text).toMatch(/India has the highest account ownership \(89\.0%\)/)
    expect(text).toMatch(/widest in Pakistan \(30\.4 percentage points\)/)
    expect(text).toMatch(/narrowest in India \(0\.4 percentage points, reversed\)/)
    expect(text).toMatch(/Bangladesh declined/)
  })

  it('ranks economies on one indicator with regional difference', () => {
    const r = buildRankings(repo, { metric: 'accountOwnership', wave: 2024 })
    expect(r.rows[0]!.rank).toBe(1)
    for (let i = 1; i < r.rows.length; i++)
      expect(r.rows[i]!.value).toBeLessThanOrEqual(r.rows[i - 1]!.value)
    const bgd = r.rows.find((x) => x.entity.code === 'BGD')!
    expect(bgd.regionalDiff).toBe(Math.round((43.28 - 77.57) * 100) / 100)
    expect(r.rows.length + r.missing.length).toBe(repo.economies().length)
  })

  it('filters rankings by region', () => {
    const sas = repo.region('south-asia')!
    const r = buildRankings(repo, { metric: 'accountOwnership', wave: 2024, regionId: sas.id })
    expect(r.rows.every((x) => x.entity.regionId === sas.id)).toBe(true)
    expect(r.rows[0]!.entity.code).toBe('IND')
  })
})
