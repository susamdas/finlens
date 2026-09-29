import { useMatches } from 'react-router'
import { getRoute, type AppRoute, type RouteId } from '@/config/routes'

export interface RouteHandle {
  routeId: RouteId
}

/** The deepest matched route that carries a FinLens route id. */
export function useCurrentRoute(): AppRoute | undefined {
  const matches = useMatches()
  for (let i = matches.length - 1; i >= 0; i--) {
    const handle = matches[i]?.handle as RouteHandle | undefined
    if (handle?.routeId) return getRoute(handle.routeId)
  }
  return undefined
}
