import { useMemo } from 'react'
import { useDataset } from './useDataset'

/** Reference data for global selectors and search, derived from the loaded dataset. */
export interface CountryOption {
  code: string // ISO3
  name: string
  slug: string
  region?: string
}

export interface ReferenceData {
  status: 'not-loaded' | 'loading' | 'ready' | 'error'
  countries: CountryOption[]
  years: number[]
  regions: { id: string; slug: string; name: string }[]
  indicators: { id: string; label: string; category: string }[]
}

const EMPTY = { countries: [], years: [], regions: [], indicators: [] }

export function useReferenceData(): ReferenceData {
  const { status, repo } = useDataset()
  return useMemo(() => {
    if (!repo)
      return {
        status: status === 'error' ? 'error' : status === 'idle' ? 'not-loaded' : 'loading',
        ...EMPTY,
      }
    const regionName = new Map(repo.regions.map((r) => [r.id, r.name]))
    return {
      status: 'ready',
      countries: repo
        .economies()
        .map((e) => ({
          code: e.code,
          name: e.shortName,
          slug: e.slug,
          region: e.regionId ? regionName.get(e.regionId) : undefined,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      years: repo.waves,
      regions: repo.regions.map((r) => ({ id: r.id, slug: r.slug, name: r.name })),
      indicators: repo
        .indicators({ core: true })
        .map((i) => ({ id: i.id, label: i.shortLabel, category: i.category })),
    }
  }, [repo, status])
}
