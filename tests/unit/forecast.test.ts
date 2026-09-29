import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FindexRepository } from '@/data/repository/FindexRepository'
import { buildForecast, observationsFor } from '@/features/forecast/forecast.logic'
import { forecastSeries, MODELS, tCritical } from '@/lib/forecast'

const line = [2011, 2014, 2017, 2021, 2024].map((year, i) => ({ year, value: 20 + 10 * i }))

describe('forecast models', () => {
  it('uses Student-t critical values', () => {
    expect(tCritical(3, 0.8)).toBeCloseTo(1.638)
    expect(tCritical(1, 0.95)).toBeCloseTo(12.706)
    expect(tCritical(99, 0.8)).toBeCloseTo(1.372)
  })

  it('withholds projections with fewer than 3 surveys', () => {
    const f = forecastSeries(line.slice(0, 2), { bounded: true, years: [2030] })
    expect(f.enough).toBe(false)
    expect(f.models.every((m) => !m.available)).toBe(true)
    expect(f.recommended).toBeNull()
  })

  it('keeps shares within 0–100% and flags capping', () => {
    const steep = [2011, 2014, 2017].map((year, i) => ({ year, value: 60 + 15 * i }))
    const f = forecastSeries(steep, { bounded: true, years: [2030] })
    const lin = f.models.find((m) => m.model.id === 'linear')!
    expect(lin.projections[0]!.value).toBe(100)
    expect(lin.projections[0]!.capped).toBe(true)
    const logi = f.models.find((m) => m.model.id === 'logistic')!
    expect(logi.projections[0]!.value).toBeLessThan(100)
    expect(logi.projections[0]!.high).toBeLessThanOrEqual(100)
  })

  it('intervals contain the projection and widen with the horizon', () => {
    const noisy = line.map((p, i) => ({ ...p, value: p.value + (i % 2 ? 2 : -2) }))
    const f = forecastSeries(noisy, { bounded: true, years: [2027, 2030] })
    for (const m of f.models.filter((x) => x.available)) {
      const [a, b] = m.projections
      expect(a!.low).toBeLessThanOrEqual(a!.value)
      expect(a!.high).toBeGreaterThanOrEqual(a!.value)
      // Linear ranges widen in value terms; the S-curve widens in log-odds and can narrow near 100%.
      if (m.model.id !== 'logistic') expect(b!.high - b!.low).toBeGreaterThan(a!.high - a!.low)
    }
  })

  it('back-tests on the latest survey and recommends the closest model', () => {
    const f = forecastSeries(line, { bounded: false, years: [2030] })
    const lin = f.models.find((m) => m.model.id === 'linear')!
    expect(lin.backtest!.year).toBe(2024)
    expect(Math.abs(lin.backtest!.error)).toBeLessThan(3)
    expect(f.models.find((m) => m.model.id === 'logistic')!.available).toBe(false)
    expect(['linear', 'recent']).toContain(f.recommended)
    expect(f.unstable).toBe(false)
  })

  it('flags a series whose latest survey breaks the pattern', () => {
    const broken = [...line.slice(0, 4), { year: 2024, value: 20 }]
    expect(forecastSeries(broken, { bounded: true, years: [2030] }).unstable).toBe(true)
  })

  it('exposes three documented models', () => {
    expect(MODELS.map((m) => m.id)).toEqual(['logistic', 'linear', 'recent'])
    for (const m of MODELS) expect(m.description.length).toBeGreaterThan(40)
  })
})

const DIR = resolve(import.meta.dirname, '../../public/data/processed')
const built = existsSync(resolve(DIR, 'meta.json'))

describe.skipIf(!built)('forecasts on real data', () => {
  const read = (f: string) => JSON.parse(readFileSync(resolve(DIR, f.split('?')[0]!), 'utf8'))
  const repo = FindexRepository.fromData(read('meta.json'), [read('core.json')], async (p) =>
    read(p),
  )

  it('projects the world aggregate from published values only', () => {
    const v = buildForecast(repo)
    expect(v.target.code).toBe('WLD')
    expect(v.forecast.observations.at(-1)).toEqual({ year: 2024, value: 78.74 })
    expect(v.selected!.projections.map((p) => p.year)).toEqual([2027, 2030])
    const p = v.selected!.projections[1]!
    expect(p.value).toBeGreaterThan(78.74)
    expect(p.value).toBeLessThanOrEqual(100)
  })

  it('places economies at their actual survey year', () => {
    const code = Object.keys(repo.meta.surveyYears)[0]!
    const obs = observationsFor(repo, 'accountOwnership', code, true)
    expect(obs.some((o) => o.year === 2022)).toBe(true)
    const v = buildForecast(repo, { country: code })
    expect(v.remapped).toContainEqual({ wave: 2021, year: 2022 })
  })

  it('flags Bangladesh 2024 as breaking from its earlier pattern', () => {
    const v = buildForecast(repo, { country: 'BGD' })
    expect(v.forecast.unstable).toBe(true)
  })

  it('honours a manual model choice and ignores unknown ones', () => {
    expect(buildForecast(repo, { model: 'linear' }).selected!.model.id).toBe('linear')
    const v = buildForecast(repo, { model: 'magic' })
    expect(v.selected!.model.id).toBe(v.forecast.recommended)
  })
})
