import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FindexRepository } from '@/data/repository/FindexRepository'
import { buildProfile, demographics, benchmarkMatrix } from '@/features/countries/profile.logic'
import { countryInsights } from '@/lib/insights/country'
import { countryRows, filterRows, sortRows } from '@/features/countries/countries.logic'

const DIR = resolve(import.meta.dirname, '../../public/data/processed')
const built = existsSync(resolve(DIR, 'meta.json'))

describe.skipIf(!built)('country profile on real data (Bangladesh)', () => {
  const read = (f: string) => JSON.parse(readFileSync(resolve(DIR, f.split('?')[0]!), 'utf8'))
  const repo = FindexRepository.fromData(read('meta.json'), [read('core.json')], async (p) =>
    read(p),
  )
  const bgd = repo.entity('BGD')!

  it('defaults to the latest wave and the regional benchmark', () => {
    const p = buildProfile(repo, bgd)
    expect(p.wave).toBe(2024)
    expect(p.benchmark).toMatchObject({ code: 'SAS', name: 'South Asia' })
    const acc = p.kpis.find((k) => k.indicator.id === 'accountOwnership')!
    expect(acc.value).toBe(43.28)
    expect(acc.delta).toBe(-9.53)
    expect(acc.benchmark).toBe(77.57)
    expect(p.scorecard.find((r) => r.indicator.id === 'accountOwnership')?.status).toBe('below')
  })

  it('classifies neutral-direction indicators without judgement', () => {
    const p = buildProfile(repo, bgd)
    const b = p.scorecard.find((r) => r.indicator.id === 'borrowedAny')!
    expect(['higher', 'lower', 'near', 'missing']).toContain(b.status)
    expect(p.strengths.every((r) => r.indicator.higherIsBetter !== null)).toBe(true)
  })

  it('switches benchmark and wave', () => {
    const p = buildProfile(repo, bgd, { wave: 2017, benchmark: 'world' })
    expect(p.benchmark.code).toBe('WLD')
    expect(p.kpis[0]?.value).toBe(50.05)
    expect(benchmarkMatrix(repo, p, ['accountOwnership'])[0]?.marks.map((m) => m.kind)).toEqual([
      'region',
      'income',
      'world',
    ])
  })

  it('computes demographic gaps after loading groups', async () => {
    await repo.ensureGroups()
    const rows = demographics(repo, 'BGD', 2024)
    const sex = rows.find((r) => r.breakdown === 'sex')!
    expect(sex.gap).toBe(
      Math.round(
        (repo.value('accountOwnership', 'BGD', 2024, 'men')! -
          repo.value('accountOwnership', 'BGD', 2024, 'women')!) *
          100,
      ) / 100,
    )
    expect(rows.find((r) => r.breakdown === 'urbanicity')?.previousGap).toBeNull() // only 2024 published
  })

  it('writes insights from source values only', () => {
    const ins = countryInsights(repo, bgd, 2024)
    if (process.env.SHOW) console.log(ins.map((i) => i.title).join('\n'))
    expect(ins[0]?.title).toContain('43.3%')
    expect(ins.find((i) => i.id === 'vs-benchmark')?.title).toContain('trails')
  })

  it('lists, filters and sorts countries with nulls last', () => {
    const rows = countryRows(repo)
    expect(rows).toHaveLength(162)
    const sas = filterRows(rows, '', 'SAS')
    expect(sas.map((r) => r.entity.code)).toContain('BGD')
    const sorted = sortRows(rows, 'mobileMoney', 'desc')
    expect(sorted[sorted.length - 1]?.mobileMoney).toBeNull()
  })
})
