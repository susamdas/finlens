import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FindexRepository } from '@/data/repository/FindexRepository'
import { overviewInsights } from '@/lib/insights/overview'
import { resolveScope, scopeValue, WORLD } from '@/lib/analytics/scope'
import { buildKpi } from '@/lib/analytics/kpi'

const DIR = resolve(import.meta.dirname, '../../public/data/processed')
const built = existsSync(resolve(DIR, 'meta.json'))

describe.skipIf(!built)('overview analytics on real data', () => {
  const read = (f: string) => JSON.parse(readFileSync(resolve(DIR, f.split('?')[0]!), 'utf8'))
  const repo = FindexRepository.fromData(read('meta.json'), [read('core.json')], async (p) =>
    read(p),
  )

  it('generates data-backed insights for the world and a region', () => {
    const world = overviewInsights(repo, WORLD, 2024)
    const sas = overviewInsights(repo, resolveScope(repo, { region: 'south-asia' }), 2024)
    if (process.env.SHOW)
      console.log([...world, ...sas].map((i) => `${i.id}: ${i.title} [${i.evidence}]`).join('\n'))
    expect(world.find((i) => i.id === 'account-change')?.title).toContain('78.7%')
    expect(world.find((i) => i.id === 'account-change')?.title).toContain('2021 and 2024')
    expect(sas.find((i) => i.id === 'account-change')?.title).toContain('77.6%')
    expect(world.length).toBeGreaterThan(4)
  })

  it('falls back to developing economies for world usage indicators — flagged', () => {
    const v = scopeValue(repo, 'digitalPayments', WORLD, 2024)
    expect(v.fallback).toBe(true)
    expect(v.source.code).toBe('LMY')
    expect(v.value).toBe(62.08)
    const k = buildKpi(repo, 'accountOwnership', WORLD, 2024)!
    expect(k.fallback).toBe(false)
    expect(k.delta).toBe(4.91)
  })
})
