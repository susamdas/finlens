import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { applyFilters, parseFilters, type FilterKey, type GlobalFilters } from '@/lib/url'

/**
 * Read/write the global filters (year, region, income group, metric, country) from the URL.
 * Updates replace the history entry so filter tweaks don't flood the back button.
 */
export function useFilters() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(params), [params])

  const setFilters = useCallback(
    (patch: { [K in FilterKey]?: GlobalFilters[K] | null }) => {
      setParams((prev) => applyFilters(prev, patch), { replace: true, preventScrollReset: true })
    },
    [setParams],
  )

  return { filters, setFilters }
}
