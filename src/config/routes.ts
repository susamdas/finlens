/**
 * Single source of truth for navigable sections.
 * Consumed by the router, sidebar, command palette, page headers and document titles.
 * Icons are referenced by name so this file stays UI-free (resolved in components/layout/nav-icons).
 */
export type RouteGroup = 'explore' | 'analyze' | 'intelligence' | 'data'

export interface RouteDef {
  id: string
  path: string
  label: string
  /** One-line purpose, shown in page headers and search results. */
  description: string
  /** Icon name, resolved in the UI layer. */
  icon: string
  group: RouteGroup
  /** Shown in the sidebar. Detail routes (e.g. a single country) are searchable but not listed. */
  inSidebar: boolean
  /** Roadmap phase that delivers the page; used by the "planned" placeholder. */
  phase: number
  /** Extra terms for the command palette. */
  keywords?: string[]
}

export const ROUTES = [
  {
    id: 'home',
    path: '/',
    label: 'Home',
    description: 'See financial inclusion through a smarter lens.',
    icon: 'Sparkles',
    group: 'explore',
    inSidebar: false,
    phase: 5,
  },
  {
    id: 'overview',
    path: '/overview',
    label: 'Overview',
    description:
      'Explore how people around the world access, use, save, borrow, and interact with financial services.',
    icon: 'LayoutDashboard',
    group: 'explore',
    inSidebar: true,
    phase: 5,
    keywords: ['dashboard', 'kpi', 'global', 'executive'],
  },
  {
    id: 'map',
    path: '/map',
    label: 'Global Map',
    description: 'Compare financial inclusion indicators across every surveyed economy.',
    icon: 'Globe2',
    group: 'explore',
    inSidebar: true,
    phase: 6,
    keywords: ['choropleth', 'world'],
  },
  {
    id: 'countries',
    path: '/countries',
    label: 'Countries',
    description: 'Browse every economy covered by the Global Findex survey.',
    icon: 'Flag',
    group: 'explore',
    inSidebar: true,
    phase: 7,
  },
  {
    id: 'country',
    path: '/country/:slug',
    label: 'Country Profile',
    description: 'Financial inclusion profile, benchmarks, strengths and gaps for one economy.',
    icon: 'Flag',
    group: 'explore',
    inSidebar: false,
    phase: 7,
  },
  {
    id: 'regions',
    path: '/regions',
    label: 'Regions',
    description: 'Regional averages, rankings and spread across countries.',
    icon: 'Map',
    group: 'explore',
    inSidebar: true,
    phase: 8,
  },
  {
    id: 'region',
    path: '/region/:slug',
    label: 'Region Deep Dive',
    description: 'How the countries of one region compare with each other and the world.',
    icon: 'Map',
    group: 'explore',
    inSidebar: false,
    phase: 8,
  },
  {
    id: 'compare',
    path: '/compare',
    label: 'Compare',
    description: 'Put up to five economies side by side.',
    icon: 'GitCompareArrows',
    group: 'analyze',
    inSidebar: true,
    phase: 9,
    keywords: ['benchmark', 'peers'],
  },
  {
    id: 'gaps',
    path: '/gaps',
    label: 'Inclusion Gaps',
    description: 'Disparities by gender, income, location, age, education and employment.',
    icon: 'Scale',
    group: 'analyze',
    inSidebar: true,
    phase: 10,
    keywords: ['gender gap', 'rich poor', 'rural urban', 'women'],
  },
  {
    id: 'digital',
    path: '/digital',
    label: 'Digital Finance',
    description: 'Mobile money, digital payments and card use around the world.',
    icon: 'Smartphone',
    group: 'analyze',
    inSidebar: true,
    phase: 11,
    keywords: ['mobile money', 'digital payments', 'fintech'],
  },
  {
    id: 'correlation',
    path: '/correlation',
    label: 'Correlation Explorer',
    description: 'Test how two indicators move together across countries.',
    icon: 'ScatterChart',
    group: 'analyze',
    inSidebar: true,
    phase: 11,
    keywords: ['scatter', 'relationship', 'pearson', 'regression'],
  },
  {
    id: 'trends',
    path: '/trends',
    label: 'Trends',
    description: 'How indicators changed across survey waves.',
    icon: 'TrendingUp',
    group: 'analyze',
    inSidebar: true,
    phase: 12,
    keywords: ['history', 'change over time'],
  },
  {
    id: 'forecast',
    path: '/forecast',
    label: 'Forecast',
    description:
      'Statistical projections from historical patterns — not official World Bank forecasts.',
    icon: 'LineChart',
    group: 'analyze',
    inSidebar: true,
    phase: 13,
    keywords: ['projection', 'prediction'],
  },
  {
    id: 'rankings',
    path: '/rankings',
    label: 'Rankings',
    description: 'Rank economies on a single indicator, with change and regional difference.',
    icon: 'ListOrdered',
    group: 'analyze',
    inSidebar: true,
    phase: 9,
    keywords: ['top', 'bottom', 'leaderboard'],
  },
  {
    id: 'insights',
    path: '/insights',
    label: 'Insights',
    description: 'Automatically generated findings from the Findex data, each with its evidence.',
    icon: 'Lightbulb',
    group: 'intelligence',
    inSidebar: true,
    phase: 14,
    keywords: ['findings', 'highlights', 'key facts'],
  },
  {
    id: 'index',
    path: '/index-lab',
    label: 'Inclusion Index',
    description: 'Experimental FinLens Inclusion Index with transparent, adjustable weights.',
    icon: 'FlaskConical',
    group: 'intelligence',
    inSidebar: true,
    phase: 14,
    keywords: ['composite', 'score', 'experimental'],
  },
  {
    id: 'microfinance',
    path: '/microfinance',
    label: 'Microfinance Lens',
    description:
      'Savings, credit, digital services and women’s inclusion through a microfinance lens.',
    icon: 'HandCoins',
    group: 'intelligence',
    inSidebar: true,
    phase: 14,
    keywords: ['savings', 'credit', 'women', 'underserved', 'poor'],
  },
  {
    id: 'focus',
    path: '/focus/:slug',
    label: 'Country Focus',
    description: 'An in-depth story for one country against its region and peers.',
    icon: 'Target',
    group: 'intelligence',
    inSidebar: false,
    phase: 14,
    keywords: ['bangladesh', 'deep dive'],
  },
  {
    id: 'story',
    path: '/story',
    label: 'Data Story',
    description: 'A guided tour of the key findings in global financial inclusion.',
    icon: 'BookOpen',
    group: 'intelligence',
    inSidebar: true,
    phase: 14,
    keywords: ['presentation', 'narrative', 'tour'],
  },
  {
    id: 'analyst',
    path: '/analyst',
    label: 'AI Analyst',
    description: 'Ask questions in plain language; answers use only dataset values.',
    icon: 'Bot',
    group: 'intelligence',
    inSidebar: true,
    phase: 15,
    keywords: ['ask', 'question', 'chat', 'ai'],
  },
  {
    id: 'explorer',
    path: '/explorer',
    label: 'Data Explorer',
    description: 'Search, filter, sort and export the underlying data.',
    icon: 'Table2',
    group: 'data',
    inSidebar: true,
    phase: 16,
    keywords: ['table', 'export', 'csv', 'download'],
  },
  {
    id: 'about',
    path: '/about',
    label: 'About the Data',
    description: 'Source, indicator definitions, coverage, limitations and methodology.',
    icon: 'Info',
    group: 'data',
    inSidebar: true,
    phase: 4,
    keywords: ['methodology', 'source', 'findex', 'definitions'],
  },
  {
    id: 'design',
    path: '/design',
    label: 'Design System',
    description: 'Tokens, components and chart conventions used across FinLens.',
    icon: 'Palette',
    group: 'data',
    inSidebar: false,
    phase: 2,
    keywords: ['style guide', 'tokens', 'components'],
  },
] as const satisfies readonly RouteDef[]

export type RouteId = (typeof ROUTES)[number]['id']
export type AppRoute = (typeof ROUTES)[number]

export const ROUTE_GROUP_LABELS: Record<RouteGroup, string> = {
  explore: 'Explore',
  analyze: 'Analyze',
  intelligence: 'Intelligence',
  data: 'Data',
}

export const ROUTE_GROUP_ORDER: readonly RouteGroup[] = [
  'explore',
  'analyze',
  'intelligence',
  'data',
]

export function getRoute(id: RouteId): AppRoute {
  const def = ROUTES.find((r) => r.id === id)
  if (!def) throw new Error(`Unknown route: ${id}`)
  return def
}

/** Build a concrete URL for a route, filling `:param` segments. */
export function buildPath(id: RouteId, params: Record<string, string> = {}): string {
  return getRoute(id).path.replace(/:(\w+)/g, (_, key: string) => {
    const value = params[key]
    if (value === undefined) throw new Error(`Missing param "${key}" for route ${id}`)
    return encodeURIComponent(value)
  })
}

export const SIDEBAR_ROUTES = ROUTE_GROUP_ORDER.map((group) => ({
  group,
  label: ROUTE_GROUP_LABELS[group],
  routes: ROUTES.filter((r) => r.group === group && r.inSidebar),
}))
