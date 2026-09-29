/**
 * Global filter state lives in the URL query string so every analytical view is shareable:
 *   /country/bangladesh?year=2021&metric=accountOwnership
 *
 * This module is pure (no React): it parses untrusted query strings into a validated shape
 * and serializes back, dropping anything malformed instead of throwing.
 */
export interface GlobalFilters {
  year?: number
  region?: string
  income?: string
  metric?: string
  country?: string
}

export type FilterKey = keyof GlobalFilters

export const FILTER_KEYS: readonly FilterKey[] = ['year', 'region', 'income', 'metric', 'country']

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const INDICATOR_ID = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/
const ISO3 = /^[A-Z]{3}$/

const validators: { [K in FilterKey]-?: (raw: string) => GlobalFilters[K] | undefined } = {
  year: (raw) => {
    if (!/^\d{4}$/.test(raw)) return undefined
    const y = Number(raw)
    return y >= 2000 && y <= 2100 ? y : undefined
  },
  region: (raw) => (SLUG.test(raw) ? raw : undefined),
  income: (raw) => (SLUG.test(raw) ? raw : undefined),
  metric: (raw) => (INDICATOR_ID.test(raw) ? raw : undefined),
  country: (raw) => (ISO3.test(raw.toUpperCase()) ? raw.toUpperCase() : undefined),
}

export function parseFilters(params: URLSearchParams): GlobalFilters {
  const out: GlobalFilters = {}
  for (const key of FILTER_KEYS) {
    const raw = params.get(key)
    if (raw === null || raw === '') continue
    const value = validators[key](raw.trim())
    if (value !== undefined) (out as Record<FilterKey, unknown>)[key] = value
  }
  return out
}

/**
 * Applies a partial update to existing params. `undefined`/`null` removes a key.
 * Non-filter params (e.g. a page's own `tab=`) are preserved.
 */
export function applyFilters(
  params: URLSearchParams,
  patch: { [K in FilterKey]?: GlobalFilters[K] | null },
): URLSearchParams {
  const next = new URLSearchParams(params)
  for (const key of Object.keys(patch) as FilterKey[]) {
    const value = patch[key]
    if (value === undefined || value === null || value === '') next.delete(key)
    else next.set(key, String(value))
  }
  // Stable key order keeps shared links tidy and cache-friendly.
  next.sort()
  return next
}

export function filtersToQuery(filters: GlobalFilters): string {
  const qs = applyFilters(new URLSearchParams(), filters).toString()
  return qs ? `?${qs}` : ''
}
