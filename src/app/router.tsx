import { createBrowserRouter, type RouteObject } from 'react-router'
import { ROUTES, type RouteId } from '@/config/routes'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { RouteError } from '@/features/system/RouteError'
import type { RouteHandle } from '@/hooks/useCurrentRoute'

type PageModule = { default: React.ComponentType }
type PageLoader = () => Promise<PageModule>

const planned: PageLoader = () => import('@/features/planned/PlannedPage')

/**
 * Route id → lazily loaded page. Each page is its own chunk. Routes without a built page
 * fall back to the "planned" placeholder; replace entries here as phases land.
 */
export const PAGES: Partial<Record<RouteId, PageLoader>> = {
  design: () => import('@/features/design-system/DesignSystemPage'),
  about: () => import('@/features/about/AboutDataPage'),
  overview: () => import('@/features/overview/OverviewPage'),
  home: () => import('@/features/home/HomePage'),
  map: () => import('@/features/map/MapPage'),
  countries: () => import('@/features/countries/CountriesPage'),
  country: () => import('@/features/countries/CountryProfilePage'),
  regions: () => import('@/features/regions/RegionsPage'),
  region: () => import('@/features/regions/RegionPage'),
  compare: () => import('@/features/compare/ComparePage'),
  rankings: () => import('@/features/rankings/RankingsPage'),
  gaps: () => import('@/features/gaps/GapsPage'),
  correlation: () => import('@/features/correlation/CorrelationPage'),
  trends: () => import('@/features/trends/TrendsPage'),
  forecast: () => import('@/features/forecast/ForecastPage'),
  insights: () => import('@/features/insights/InsightsPage'),
  digital: () => import('@/features/digital/DigitalPage'),
  microfinance: () => import('@/features/microfinance/MicrofinancePage'),
  focus: () => import('@/features/country-focus/CountryFocusPage'),
  story: () => import('@/features/story/StoryPage'),
  index: () => import('@/features/composite-index/IndexPage'),
  analyst: () => import('@/features/analyst/AnalystPage'),
  explorer: () => import('@/features/explorer/ExplorerPage'),
}

function toRoute(id: RouteId, path: string): RouteObject {
  const load = PAGES[id] ?? planned
  const handle: RouteHandle = { routeId: id }
  const lazy = async () => ({ Component: (await load()).default })
  return path === '/' ? { index: true, handle, lazy } : { path: path.slice(1), handle, lazy }
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <DashboardLayout />,
    errorElement: <RouteError />,
    children: [
      {
        errorElement: <RouteError />,
        children: [
          ...ROUTES.map((r) => toRoute(r.id, r.path)),
          {
            path: '*',
            lazy: async () => ({
              Component: (await import('@/features/system/NotFoundPage')).default,
            }),
          },
        ],
      },
    ],
  },
]

// Honours `vite build --base=/sub/path/` so the app can be hosted below the site root.
export const router = createBrowserRouter(routes, {
  basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/',
})
