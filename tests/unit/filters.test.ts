import { applyFilters, filtersToQuery, parseFilters } from '@/lib/url'

describe('URL filters', () => {
  it('parses valid values and drops malformed ones', () => {
    const f = parseFilters(
      new URLSearchParams(
        'year=2021&region=south-asia&metric=accountOwnership&country=bgd&income=<script>',
      ),
    )
    expect(f).toEqual({
      year: 2021,
      region: 'south-asia',
      metric: 'accountOwnership',
      country: 'BGD',
    })
  })

  it('rejects out-of-range years', () => {
    expect(parseFilters(new URLSearchParams('year=1850')).year).toBeUndefined()
    expect(parseFilters(new URLSearchParams('year=20211')).year).toBeUndefined()
  })

  it('merges patches, removes nulls and keeps unrelated params', () => {
    const next = applyFilters(new URLSearchParams('tab=trend&year=2017&region=south-asia'), {
      year: 2021,
      region: null,
    })
    expect(next.toString()).toBe('tab=trend&year=2021')
  })

  it('serializes to a stable query string', () => {
    expect(filtersToQuery({ year: 2021, metric: 'accountOwnership' })).toBe(
      '?metric=accountOwnership&year=2021',
    )
    expect(filtersToQuery({})).toBe('')
  })
})

import { searchFilter } from '@/lib/query/search'

describe('command palette search', () => {
  it('matches word prefixes only', () => {
    expect(searchFilter('Inclusion Gaps Disparities by gender', 'gender')).toBeGreaterThan(0)
    expect(searchFilter('Regions Regional averages', 'gender')).toBe(0)
    expect(searchFilter('Correlation Explorer', 'corr exp')).toBeGreaterThan(0)
  })
  it('ranks label matches above description matches', () => {
    expect(searchFilter('Trends How indicators changed', 'trends')).toBeGreaterThan(
      searchFilter('Forecast Trend extrapolation trends', 'trends'),
    )
  })
})
