import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FindexRepository } from '@/data/repository/FindexRepository'
import {
  axisDomain,
  buildCorrelation,
  correlationMatrix,
  slopeSentence,
} from '@/features/correlation/correlation.logic'
import { MIN_CORRELATION_N, pearson, ranks, spearman } from '@/lib/analytics/stats'

describe('rank statistics', () => {
  it('averages tied ranks', () => {
    expect(ranks([10, 20, 20, 5])).toEqual([2, 3.5, 3.5, 1])
  })
  it('is 1 for any monotonic relationship', () => {
    const pts = [1, 2, 3, 4, 5, 6].map((x) => ({ x, y: x ** 3 }))
    expect(spearman(pts)).toBeCloseTo(1)
    expect(pearson(pts)!).toBeLessThan(1)
  })
  it('keeps shares on 0–100 and pp ranges around zero', () => {
    expect(axisDomain('%', [3, 97])).toEqual([0, 100])
    expect(axisDomain('pp', [-4.4, 33.8])).toEqual([-10, 40])
  })
})

const DIR = resolve(import.meta.dirname, '../../public/data/processed')
const built = existsSync(resolve(DIR, 'meta.json'))

describe.skipIf(!built)('correlation explorer on real data', () => {
  const read = (f: string) => JSON.parse(readFileSync(resolve(DIR, f.split('?')[0]!), 'utf8'))
  const repo = FindexRepository.fromData(read('meta.json'), [read('core.json')], async (p) =>
    read(p),
  )

  it('uses only economies with both values and reports r, rho and a fit', () => {
    const m = buildCorrelation(repo, { x: 'mobileMoneyAccount', y: 'accountOwnership' })
    expect(m.n).toBeGreaterThanOrEqual(MIN_CORRELATION_N)
    for (const p of m.points) {
      expect(p.x).toBe(repo.value('mobileMoneyAccount', p.entity.code, m.wave))
      expect(p.y).toBe(repo.value('accountOwnership', p.entity.code, m.wave))
    }
    expect(m.n + m.excluded).toBe(repo.economies().length)
    expect(m.r).not.toBeNull()
    expect(m.rho).not.toBeNull()
    expect(m.fit!.n).toBe(m.n)
    expect(m.above[0]!.residual).toBeGreaterThan(0)
    expect(m.below[0]!.residual).toBeLessThan(0)
  })

  it('withholds results for small samples and identical axes', () => {
    const small = buildCorrelation(repo, {
      x: 'mobileMoneyAccount',
      y: 'accountOwnership',
      region: 'south-asia',
    })
    expect(small.n).toBeLessThan(MIN_CORRELATION_N)
    expect(small.r).toBeNull()
    expect(slopeSentence(small)).toBeNull()
    const same = buildCorrelation(repo, { x: 'accountOwnership', y: 'accountOwnership' })
    expect(same.r).toBeNull()
  })

  it('gives a symmetric matrix with a unit diagonal', () => {
    const { indicators, cells } = correlationMatrix(repo, 2024)
    expect(cells).toHaveLength(indicators.length)
    for (let i = 0; i < cells.length; i++) {
      expect(cells[i]![i]!.r).toBe(1)
      for (let j = 0; j < cells.length; j++) {
        const a = cells[i]![j]!.r
        const b = cells[j]![i]!.r
        if (a === null) expect(b).toBeNull()
        else expect(a).toBeCloseTo(b!, 10)
      }
    }
  })

  it('tracks the same pair across waves', () => {
    const m = buildCorrelation(repo, { x: 'debitCard', y: 'accountOwnership' })
    expect(m.overTime.map((o) => o.wave)).toEqual(repo.waves)
    expect(m.overTime.filter((o) => o.r !== null).length).toBeGreaterThan(2)
  })
})
