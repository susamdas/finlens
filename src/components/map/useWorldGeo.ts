import { useEffect, useState } from 'react'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'

export interface CountryProps {
  name: string | null
  iso3: string | null
}

type Geo = FeatureCollection<Geometry, CountryProps>

let cache: Promise<Geo> | null = null

function loadGeo(): Promise<Geo> {
  cache ??= fetch(`${import.meta.env.BASE_URL}geo/world.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`Map data failed to load (${r.status})`)
      return r.json() as Promise<Topology<{ countries: GeometryCollection<CountryProps> }>>
    })
    .then((topo) => feature(topo, topo.objects.countries) as Geo)
    .catch((e: unknown) => {
      cache = null // allow retry on next mount
      throw e
    })
  return cache
}

/** Natural Earth country shapes (ids = ISO3), fetched once and shared by every map. */
export function useWorldGeo(): {
  status: 'loading' | 'ready' | 'error'
  data: Geo | null
  error: string | null
} {
  const [state, setState] = useState<{
    status: 'loading' | 'ready' | 'error'
    data: Geo | null
    error: string | null
  }>({
    status: 'loading',
    data: null,
    error: null,
  })
  useEffect(() => {
    let alive = true
    loadGeo()
      .then((data) => alive && setState({ status: 'ready', data, error: null }))
      .catch(
        (e: unknown) =>
          alive &&
          setState({
            status: 'error',
            data: null,
            error: e instanceof Error ? e.message : String(e),
          }),
      )
    return () => {
      alive = false
    }
  }, [])
  return state
}
