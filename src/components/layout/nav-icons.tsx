import {
  BookOpen,
  Bot,
  Circle,
  Flag,
  FlaskConical,
  GitCompareArrows,
  Globe2,
  HandCoins,
  Info,
  LayoutDashboard,
  Lightbulb,
  LineChart,
  ListOrdered,
  Map,
  Palette,
  Scale,
  ScatterChart,
  Smartphone,
  Sparkles,
  Table2,
  Target,
  TrendingUp,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react'
import { createElement } from 'react'

/** Explicit map keeps icons tree-shaken (no dynamic lucide imports). */
const ICONS: Record<string, LucideIcon> = {
  BookOpen,
  Bot,
  Flag,
  FlaskConical,
  GitCompareArrows,
  Globe2,
  HandCoins,
  Info,
  LayoutDashboard,
  Lightbulb,
  LineChart,
  ListOrdered,
  Map,
  Palette,
  Scale,
  ScatterChart,
  Smartphone,
  Sparkles,
  Table2,
  Target,
  TrendingUp,
}

/** Renders a navigation icon by registry name (see config/routes.ts). */
export function NavIcon({ name, ...props }: LucideProps & { name: string }) {
  return createElement(ICONS[name] ?? Circle, props)
}
