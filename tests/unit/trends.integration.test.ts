import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FindexRepository } from '@/data/repository/FindexRepository'
import { buildTrends, quantile } from '@/features/trends/trends.logic'
import { trendInsights } from '@/lib/insights/trends'

describe('quantiles', () => {
  it('interpolates linearly between order statistics', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(quantile([10, 20, 30, 40, 50], 0.25)).toBe(20)
    expect(quantile([7], 0.9)).toBe(7)
    expect(quantile([], 0.5)).toBeNull()
  })
})

const DIR = resolve(import.meta.dirname, '../../public/data/processed')
const built = existsSync(resolve(DIR, 'meta.json'))

describe.skipIf(!built)('trend analytics on real data', () => {
  const read = (f: string) => JSON.parse(readFileSync(resolve(DIR, f.split('?')[0]!), 'utf8'))
  const repo = FindexRepository.fromData(read('meta.json'), [read('core.json')], async (p) =>
    read(p),
  )

  it('uses published aggregates for the headline and the full period by default', () => {
    const m = buildTrends(repo)
    expect(m.from).toBe(2011)
    expect(m.to).toBe(2024)
    const a = repo.value('accountOwnership', 'WLD', 2011)!
    expect(m.headline).toMatchObject({ from: a, to: 78.74 })
    expect(m.headline.delta).toBe(Math.round((78.74 - a) * 100) / 100)
    expect(m.headline.perYear).toBeCloseTo((78.74 - a) / 13, 2)
  })

  it('compares the same economy in both waves only', () => {
    const m = buildTrends(repo, { from: 2021, to: 2024 })
    for (const c of m.changes) {
      expect(repo.value('accountOwnership', c.entity.code, 2021)).toBe(c.from)
      expect(repo.value('accountOwnership', c.entity.code, 2024)).toBe(c.to)
    }
    const bgd = m.changes.find((c) => c.entity.code === 'BGD')!
    expect(bgd.delta).toBe(-9.53)
    expect(m.counts.up + m.counts.down + m.counts.flat).toBe(m.counts.compared)
    expect(m.improvers.every((c) => c.delta >= 1)).toBe(true)
    expect(m.decliners.every((c) => c.delta <= -1)).toBe(true)
  })

  it('uses actual survey years for per-year rates', () => {
    const m = buildTrends(repo, { from: 2021, to: 2024 })
    const remapped = Object.keys(repo.meta.surveyYears)[0]!
    const c = m.changes.find((x) => x.entity.code === remapped)
    if (c) expect(c.years).toBe(2)
  })

  it('falls back to a valid period and labels the developing-economies fallback', () => {
    const m = buildTrends(repo, { metric: 'digitalPayments', from: 2024, to: 2011 })
    expect(m.from).toBeLessThan(m.to)
    expect(m.source.code).toBe('LMY')
    expect(m.fallback).toBe(true)
  })

  it('builds a period table and grounded insights', () => {
    const m = buildTrends(repo)
    expect(m.periods.pairs).toHaveLength(repo.waves.length - 1)
    expect(m.periods.rows.filter((r) => r.selected)).toHaveLength(1)
    const ins = trendInsights(m)
    expect(ins[0]!.id).toBe('trend-headline')
    expect(ins[0]!.title).toMatch(/78\.7%/)
  })
})
