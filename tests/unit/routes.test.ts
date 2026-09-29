import { ROUTES, buildPath } from '@/config/routes'

describe('route registry', () => {
  it('has unique ids and paths', () => {
    expect(new Set(ROUTES.map((r) => r.id)).size).toBe(ROUTES.length)
    expect(new Set(ROUTES.map((r) => r.path)).size).toBe(ROUTES.length)
  })

  it('builds parameterised paths', () => {
    expect(buildPath('country', { slug: 'bangladesh' })).toBe('/country/bangladesh')
    expect(buildPath('overview')).toBe('/overview')
  })

  it('throws when a required param is missing', () => {
    expect(() => buildPath('country')).toThrow(/slug/)
  })
})
