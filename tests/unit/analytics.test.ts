import {
  correlationStrength,
  describeCorrelation,
  linearRegression,
  pearson,
} from '@/lib/analytics/stats'
import { rank, changes, topMovers } from '@/lib/analytics/movers'
import { resolveScope, scopeValue, WORLD } from '@/lib/analytics/scope'
import { buildKpi } from '@/lib/analytics/kpi'
import { FindexRepository } from '@/data/repository/FindexRepository'
import { CORE, META } from './fixtures/dataset'

describe('stats', () => {
  it('computes Pearson r and OLS', () => {
    const pts = [
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 6 },
      { x: 4, y: 8 },
    ]
    expect(pearson(pts)).toBeCloseTo(1)
    const fit = linearRegression(pts)!
    expect(fit.slope).toBeCloseTo(2)
    expect(fit.intercept).toBeCloseTo(0)
    expect(fit.r2).toBeCloseTo(1)
    expect(
      pearson([
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ]),
    ).toBeNull() // too few
    expect(
      pearson([
        { x: 1, y: 1 },
        { x: 1, y: 2 },
        { x: 1, y: 3 },
      ]),
    ).toBeNull() // no variance
  })
  it('describes strength without implying causation', () => {
    expect(correlationStrength(0.72)).toBe('strong')
    expect(describeCorrelation(-0.45)).toBe('Moderate negative association')
    expect(describeCorrelation(0.1)).toBe('Little or no linear association')
  })
})

describe('ranking and movers', () => {
  const e = (code: string) => ({ ...META.entities[0]!, code, shortName: code })
  it('uses competition ranking for ties', () => {
    const r = rank([
      { entity: e('A'), value: 50 },
      { entity: e('B'), value: 70 },
      { entity: e('C'), value: 50 },
    ])
    expect(r.map((x) => [x.entity.code, x.rank])).toEqual([
      ['B', 1],
      ['A', 2],
      ['C', 2],
    ])
  })
  it('computes change vs previous available wave', () => {
    const repo = FindexRepository.fromData(META, [CORE])
    const m = changes(repo, 'accountOwnership', 2024, repo.economies())
    expect(m[0]).toMatchObject({ delta: -9.5, previous: { wave: 2021, value: 52.8 } })
    expect(topMovers(m, 1, 'down')[0]!.entity.code).toBe('AAA')
  })
})

describe('scope & KPIs', () => {
  const repo = FindexRepository.fromData(META, [CORE])
  it('resolves scopes from filters', () => {
    expect(resolveScope(repo, {}).code).toBe('WLD')
    expect(resolveScope(repo, { region: 'south-asia' }).code).toBe('SAS')
    expect(resolveScope(repo, { income: 'lower-middle-income' }).code).toBe('LMC')
    expect(resolveScope(repo, { region: 'nowhere' }).code).toBe('WLD')
  })
  it('reports world values without fallback when published', () => {
    expect(scopeValue(repo, 'accountOwnership', WORLD, 2024)).toMatchObject({
      value: 79,
      fallback: false,
    })
  })
  it('builds a KPI with delta and series up to the wave', () => {
    const k = buildKpi(
      repo,
      'accountOwnership',
      resolveScope(repo, { region: 'south-asia' }),
      2024,
    )!
    expect(k.value).toBe(77.6)
    expect(k.previous).toBeNull()
    expect(k.delta).toBeNull()
  })
})

import { buildScale } from '@/lib/analytics/choropleth'
describe('choropleth scales', () => {
  it('uses round class widths for percentages', () => {
    const s = buildScale([3, 40, 99.9], { unit: '%', higherIsBetter: true })
    expect(s.domain).toEqual([0, 100])
    expect(s.thresholds[0]).toBe(15)
    expect(s.classOf(99.9)).toBe(s.colors.length - 1)
    expect(buildScale([2, 65], { unit: '%', higherIsBetter: true }).thresholds).toEqual([
      10, 20, 30, 40, 50, 60, 70,
    ])
    expect(s.colorFor(null)).toBeNull()
  })
  it('centres gaps on zero with the warm side for "worse"', () => {
    const s = buildScale([-3, 12], { unit: 'pp', higherIsBetter: false })
    expect(s.domain).toEqual([-15, 15])
    expect(s.colorFor(12)).toBe('var(--div-n3)')
    expect(s.colorFor(0)).toBe('var(--div-0)')
  })
})

import { compareChanges } from '@/lib/insights/text'
describe('compareChanges wording', () => {
  it('handles every sign combination', () => {
    expect(compareChanges(5, 2, 'X')).toBe('grew faster than X')
    expect(compareChanges(1, 2, 'X')).toBe('grew more slowly than X')
    expect(compareChanges(-8.2, -9.5, 'X')).toBe('declined less than X')
    expect(compareChanges(-3, -1, 'X')).toBe('declined more than X')
    expect(compareChanges(2, -1, 'X')).toBe('rose while X fell')
  })
})
