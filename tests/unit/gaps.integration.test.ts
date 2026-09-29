import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FindexRepository } from '@/data/repository/FindexRepository'
import { buildGapModel, sortGapRows, trendOf } from '@/features/gaps/gaps.logic'
import { gapInsights } from '@/lib/insights/gaps'

describe('gap trend classification', () => {
  it('compares absolute size with a 1 pp stable band', () => {
    expect(trendOf(5, 10)).toBe('narrowed')
    expect(trendOf(-12, 8)).toBe('widened')
    expect(trendOf(4.5, 5)).toBe('stable')
  })
})

const DIR = resolve(import.meta.dirname, '../../public/data/processed')
const built = existsSync(resolve(DIR, 'meta.json'))

describe.skipIf(!built)('gap analysis on real data', async () => {
  const read = (f: string) => JSON.parse(readFileSync(resolve(DIR, f.split('?')[0]!), 'utf8'))
  const repo = FindexRepository.fromData(read('meta.json'), [read('core.json')], async (p) =>
    read(p),
  )
  await repo.ensureGroups()

  it('uses the published world aggregate for the headline gap', () => {
    const m = buildGapModel(repo, { breakdown: 'income' })
    expect(m.headline.source.code).toBe('WLD')
    expect(m.headline).toMatchObject({ a: 72.36, b: 82.99, gap: 10.63 })
    expect(m.labels.a).toMatch(/poorest/i)
    expect(m.allBreakdowns).toHaveLength(repo.breakdowns.length)
  })

  it('falls back to developing economies where no world group figure exists', () => {
    const m = buildGapModel(repo, { breakdown: 'income', metric: 'digitalPayments' })
    expect(m.headline.source.code).toBe('LMY')
    expect(m.headline.fallback).toBe(true)
    expect(m.headline.gap).toBe(Math.round((68.89 - 51.81) * 100) / 100)
  })

  it('computes economy gaps only where both groups are published', () => {
    const m = buildGapModel(repo, { breakdown: 'sex', region: 'south-asia' })
    const bgd = m.rows.find((r) => r.entity.code === 'BGD')!
    expect(bgd.gap).toBe(20.16)
    for (const r of m.rows) if (r.a === null || r.b === null) expect(r.gap).toBeNull()
    expect(m.stats.measured).toBe(m.rows.filter((r) => r.gap !== null).length)
    const sorted = sortGapRows(m.rows, 'gap', 'desc')
    expect(sorted[0]!.gap).toBeGreaterThanOrEqual(sorted[1]!.gap ?? -Infinity)
    expect(sorted.at(-1)!.gap === null || m.rows.every((r) => r.gap !== null)).toBe(true)
  })

  it('reports the rural–urban breakdown only where it is published', () => {
    const m = buildGapModel(repo, { breakdown: 'urbanicity', wave: 2021 })
    expect(m.headline.gap).toBeNull()
    expect(m.availableWaves).toEqual([2024])
  })

  it('generates evidence-backed insights and labels associations', () => {
    const m = buildGapModel(repo, { breakdown: 'sex' })
    const ins = gapInsights(m)
    expect(ins[0]!.id).toBe('gap-headline')
    for (const i of ins) expect(i.evidence.length).toBeGreaterThan(0)
    const assoc = ins.find((i) => i.id === 'gap-association')
    if (assoc) expect(assoc.detail).toMatch(/not show that one causes/)
  })
})
