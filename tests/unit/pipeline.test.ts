// @ts-expect-error — plain ESM module without type declarations
import * as N from '../../scripts/lib/normalize.mjs'

describe('pipeline normalization', () => {
  it('converts fractions to percentages without inventing values', () => {
    expect(N.toPercent(0.528061)).toBe(52.81)
    expect(N.toPercent(0)).toBe(0)
    expect(N.toPercent(1)).toBe(100)
    expect(N.toPercent(null)).toBeNull()
    expect(N.toPercent('')).toBeNull()
    expect(() => N.toPercent(1.2)).toThrow(RangeError)
    expect(() => N.toPercent(-0.1)).toThrow(RangeError)
  })

  it('assigns 2022 fieldwork to the 2021 wave', () => {
    expect(N.WAVE_OF_SURVEY_YEAR[2022]).toBe(2021)
    expect(N.WAVE_OF_SURVEY_YEAR[2024]).toBe(2024)
    expect(N.WAVE_OF_SURVEY_YEAR[2019]).toBeUndefined()
  })

  it('parses indicator names and denominators', () => {
    expect(N.parseIndicatorName('Account (%, age 15+)')).toEqual({
      label: 'Account',
      unitLabel: '%, age 15+',
      denominator: 'adults age 15+',
    })
    expect(
      N.parseIndicatorName(
        'No account because of insufficient funds (% without an account, age 15+)',
      ),
    ).toMatchObject({
      label: 'No account because of insufficient funds',
      denominator: 'without an account',
    })
    expect(
      N.parseIndicatorName(
        'Used a mobile phone or the internet to check account balance(%, age 15+)',
      ).label,
    ).toBe('Used a mobile phone or the internet to check account balance')
  })

  it('builds stable slugs and ids', () => {
    expect(N.slugify("Côte d'Ivoire")).toBe('cote-divoire')
    expect(N.slugify('Bosnia & Herzegovina')).toBe('bosnia-and-herzegovina')
    expect(N.catalogueId('fin11a.s')).toBe('fx_fin11a_s')
  })

  it('maps every demographic group', () => {
    expect(Object.values(N.GROUP_MAP)).toHaveLength(13)
    for (const b of N.BREAKDOWNS) {
      expect(N.GROUP_LABELS[b.advantaged]).toBeTruthy()
      expect(N.GROUP_LABELS[b.disadvantaged]).toBeTruthy()
    }
  })
})

describe('not-collected zeros (Findex 2025, high-income economies)', () => {
  const ent = new Map([
    ['USA', { incomeGroupId: 'HIC' }],
    ['DEU', { incomeGroupId: 'HIC' }],
    ['FRA', { incomeGroupId: 'HIC' }],
    ['JPN', { incomeGroupId: 'HIC' }],
    ['SWE', { incomeGroupId: 'HIC' }],
    ['SAU', { incomeGroupId: 'HIC' }],
    ['KEN', { incomeGroupId: 'LMC' }],
  ])
  const row = (code: string, wave: number, a: number | null, b: number | null) => ({
    code,
    wave,
    group: 'all',
    values: [a, b],
  })
  it('nulls block zeros in 2024 high-income rows only, keeping real values', () => {
    const recs = [
      ...['USA', 'DEU', 'FRA', 'JPN', 'SWE'].map((c) => row(c, 2024, 0, 0)),
      row('SAU', 2024, 41.2, 3.1),
      row('KEN', 2024, 0, 10),
      row('USA', 2021, 0, 5),
      row('HIC', 2024, 0, null),
    ]
    const out = N.removeNotCollectedZeros(recs, ent, ['a', 'b'])
    expect(out).toEqual({ a: 6, b: 5 })
    expect(recs[0]!.values).toEqual([null, null])
    expect(recs[5]!.values).toEqual([41.2, 3.1])
    expect(recs[6]!.values).toEqual([0, 10])
    expect(recs[7]!.values).toEqual([0, 5])
    expect(recs[8]!.values).toEqual([null, null])
  })
})

describe('structural zeros', () => {
  it('nulls complementary pairs that are both 0 and aggregates with no economy values', () => {
    const ent = new Map([
      ['RUS', { kind: 'economy' }],
      ['KEN', { kind: 'economy' }],
      ['SSA', { kind: 'region' }],
    ])
    const recs = [
      { code: 'RUS', wave: 2024, group: 'all', values: [0, 0, null] },
      { code: 'KEN', wave: 2024, group: 'all', values: [96.6, 3.4, null] },
      { code: 'SSA', wave: 2024, group: 'all', values: [80, 20, 0] },
    ]
    const out = N.removeStructuralZeros(recs, ent, ['fin24aP', 'fin24aN', 'fin17b'])
    expect(recs[0]!.values).toEqual([null, null, null])
    expect(recs[1]!.values).toEqual([96.6, 3.4, null])
    expect(recs[2]!.values).toEqual([80, 20, null])
    expect(out).toEqual({ complements: { fin24aP: 1, fin24aN: 1 }, aggregates: { fin17b: 1 } })
  })
})
