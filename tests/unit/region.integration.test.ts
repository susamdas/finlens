import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FindexRepository } from '@/data/repository/FindexRepository'
import { buildRegionModel, regionsTable } from '@/features/regions/region.logic'
import { regionInsights } from '@/lib/insights/region'

const DIR = resolve(import.meta.dirname, '../../public/data/processed')
const built = existsSync(resolve(DIR, 'meta.json'))

describe.skipIf(!built)('regional analysis on real data', () => {
  const read = (f: string) => JSON.parse(readFileSync(resolve(DIR, f.split('?')[0]!), 'utf8'))
  const repo = FindexRepository.fromData(read('meta.json'), [read('core.json')], async (p) =>
    read(p),
  )
  const sas = repo.region('south-asia')!

  it('uses the published regional aggregate for KPIs', () => {
    const m = buildRegionModel(repo, sas)
    expect(m.kpis[0]).toMatchObject({ value: 77.57, world: 78.74 })
    expect(m.economies.map((e) => e.code)).toContain('BGD')
  })

  it('ranks member economies and compares with the region', () => {
    const m = buildRegionModel(repo, sas)
    expect(m.ranking[0]?.entity.code).toBe('IND')
    const bgd = m.ranking.find((r) => r.entity.code === 'BGD')!
    expect(bgd.vsRegion).toBe(Math.round((43.28 - 77.57) * 100) / 100)
    expect(bgd.delta).toBe(-9.53)
  })

  it('computes spread from member values only', () => {
    const acc = buildRegionModel(repo, sas).spread.find(
      (s) => s.indicator.id === 'accountOwnership',
    )!
    expect(acc.min?.value).toBeLessThan(acc.max!.value)
    expect(acc.points.every((p) => p.entity.regionId === 'SAS')).toBe(true)
  })

  it('falls back to developing economies for usage benchmarks', () => {
    const m = buildRegionModel(repo, sas)
    const dig = m.kpis.find((k) => k.indicator.id === 'digitalPayments')!
    expect(dig.worldLabel).toBe('Developing economies')
    expect(dig.world).toBe(62.08)
  })

  it('produces a table and insights', () => {
    expect(regionsTable(repo, 2024)).toHaveLength(7)
    const ins = regionInsights(repo, sas, 2024, buildRegionModel(repo, sas).spread)
    expect(ins[0]?.title).toContain('77.6%')
  })
})
