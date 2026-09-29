import { env } from '@/config/env'
import { FindexRepository, type JsonFetcher } from './FindexRepository'

export { FindexRepository } from './FindexRepository'
export type { CrossSectionOptions, JsonFetcher, ObservationQuery } from './FindexRepository'

const DATA_BASE = `${import.meta.env.BASE_URL}data/processed/`

/** Static JSON under /public/data/processed (default deployment). */
export const staticFetcher: JsonFetcher = async <T>(path: string): Promise<T> => {
  const res = await fetch(DATA_BASE + path, {
    cache: path === 'meta.json' ? 'no-cache' : 'default',
  })
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`)
  return (await res.json()) as T
}

/** Future REST backend: same file contract served by an API. */
export const apiFetcher: JsonFetcher = async <T>(path: string): Promise<T> => {
  const res = await fetch(`${env.apiBaseUrl.replace(/\/$/, '')}/${path}`)
  if (!res.ok) throw new Error(`API error ${res.status} for ${path}`)
  return (await res.json()) as T
}

export function createRepository(): Promise<FindexRepository> {
  return FindexRepository.load(env.dataSource === 'api' ? apiFetcher : staticFetcher)
}
