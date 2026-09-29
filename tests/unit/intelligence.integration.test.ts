import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FindexRepository } from '@/data/repository/FindexRepository'
import {
  buildIndex,
  parseWeights,
  PRESETS,
  serializeWeights,
} from '@/features/composite-index/index.logic'
import { buildFocus, focusLede } from '@/features/country-focus/focus.logic'
import { buildDigital } from '@/features/digital/digital.logic'
import { buildMicrofinance } from '@/features/microfinance/microfinance.logic'
import { buildStory } from '@/features/story/story.logic'
import { CATEGORY_META, runInsightEngine } from '@/lib/insights/engine'

describe('index weights', () => {
  it('parses, validates and serialises weights', () => {
    expect(parseWeights('3,1,1,1,1,1').access).toBe(3)
    expect(parseWeights('9,1,1,1,1,1')).toEqual(PRESETS[0]!.weights)
    expect(parseWeights('0,0,0,0,0,0')).toEqual(PRESETS[0]!.weights)
    expect(parseWeights('bad')).toEqual(PRESETS[0]!.weights)
    expect(serializeWeights(PRESETS[1]!.weights)).toBe('3,1,1,1,1,1')
  })
})

const DIR = resolve(import.meta.dirname, '../../public/data/processed')
const built = existsSync(resolve(DIR, 'meta.json'))

describe.skipIf(!built)('intelligence features on real data', async () => {
  const read = (f: string) => JSON.parse(readFileSync(resolve(DIR, f.split('?')[0]!), 'utf8'))
  const repo = FindexRepository.fromData(read('meta.json'), [read('core.json')], async (p) =>
    read(p),
  )
  await repo.ensureGroups()

  it('runs the insight engine into a ranked, evidenced, de-duplicated feed', () => {
    const feed = runInsightEngine({ repo, wave: repo.latestWave, groupsReady: true })
    expect(feed.length).toBeGreaterThan(10)
    expect(new Set(feed.map((i) => i.key)).size).toBe(feed.length)
    for (let k = 1; k < feed.length; k++)
      expect(feed[k]!.score).toBeLessThanOrEqual(feed[k - 1]!.score)
    for (const i of feed) {
      expect(i.evidence.length).toBeGreaterThan(0)
      expect(CATEGORY_META[i.category]).toBeDefined()
      expect(i.title).not.toMatch(/NaN|undefined|null/)
    }
    // No economy should show a structural (not-collected) 0% in resilience findings.
    const res = feed.find((i) => i.id === 'emergency')
    if (res) expect(res.title).not.toMatch(/\(0\.0%\)/)
  })

  it('derives mobile-money-only adults exactly as account minus FI account', () => {
    const m = buildDigital(repo)
    for (const p of m.pathways)
      if (p.account !== null && p.fi !== null)
        expect(p.mobileOnly).toBeCloseTo(Math.max(0, p.account - p.fi), 2)
    expect(m.leaders[0]!.value).toBeGreaterThanOrEqual(m.leaders.at(-1)!.value)
    expect(m.kpis.find((k) => k.indicator.id === 'digitalPayments')!.value.fallback).toBe(true)
  })

  it('builds the microfinance lens with group comparisons', () => {
    const m = buildMicrofinance(repo, { country: 'BGD' })
    const acc = m.equity.find((r) => r.indicator.id === 'accountOwnership')!
    expect(acc.all).toBe(43.28)
    expect(acc.women).toBe(repo.value('accountOwnership', 'BGD', 2024, 'women'))
    expect(acc.poorest).toBe(repo.value('accountOwnership', 'BGD', 2024, 'poorest40'))
    expect(m.barriers.every((b) => b.indicator.id.startsWith('barrier'))).toBe(true)
  })

  it('writes a country focus from the same template for any economy', () => {
    for (const code of ['BGD', 'KEN', 'BRA']) {
      const e = repo.entity(code)!
      const f = buildFocus(repo, e, true)
      expect(focusLede(f)).toMatch(new RegExp(e.shortName))
      expect(f.journey.narrative.length).toBeGreaterThan(0)
      expect(f.peers.every((p) => p.entity.regionId === e.regionId)).toBe(true)
    }
    const bgd = buildFocus(repo, repo.entity('BGD')!, true)
    expect(bgd.outlook.unstable).toBe(true)
    expect(bgd.changes.falls.find((c) => c.indicator.id === 'accountOwnership')?.delta).toBe(-9.53)
  })

  it('builds a story whose steps all have data', () => {
    const steps = buildStory(repo, true)
    expect(steps.map((s) => s.id)).toEqual([
      'progress',
      'excluded',
      'gender',
      'gaps',
      'digital',
      'saving',
      'outlook',
    ])
    expect(steps[0]!.body[0]).toMatch(/78\.7%/)
    expect(buildStory(repo, false).some((s) => s.id === 'gaps')).toBe(false)
  })

  it('scores the experimental index only where every dimension exists', () => {
    const m = buildIndex(repo)
    expect(m.rows.length).toBeGreaterThan(50)
    for (const r of m.rows) {
      expect(r.score).toBeGreaterThanOrEqual(0)
      expect(r.score).toBeLessThanOrEqual(100)
      expect(r.rankRange[0]).toBeLessThanOrEqual(r.rank)
      expect(r.rankRange[1]).toBeGreaterThanOrEqual(r.rank)
    }
    const hic = m.rows.filter((r) => r.entity.incomeGroupId === 'HIC').length
    expect(hic).toBeLessThan(10)
    const accessOnly = buildIndex(repo, {
      weights: { access: 1, usage: 0, saving: 0, credit: 0, resilience: 0, equality: 0 },
    })
    const top = accessOnly.rows[0]!
    expect(top.dims.access!.score).toBe(100)
  })
})
