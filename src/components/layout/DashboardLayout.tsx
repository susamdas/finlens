import { Suspense, useEffect, useRef, useState } from 'react'
import { Outlet, ScrollRestoration, useLocation, useNavigation } from 'react-router'
import { LoadingSkeleton } from '@/components/common/states'
import { SettingsDialog } from '@/components/common/SettingsDialog'
import { Toaster } from '@/components/common/Toaster'
import { ExportRegistryProvider } from '@/components/export/ExportRegistry'
import { PrintHeader } from './PrintHeader'
import { useCurrentRoute } from '@/hooks/useCurrentRoute'
import { useDataset } from '@/hooks/useDataset'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CommandPalette } from './CommandPalette'
import { MobileNav, Sidebar } from './Sidebar'
import { TopNavigation } from './TopNavigation'

const APP_NAME = 'FinLens'

function PageFallback() {
  return (
    <div className="space-y-6">
      <LoadingSkeleton variant="text" rows={2} className="max-w-md" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-5">
            <LoadingSkeleton variant="kpi" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border bg-card p-5">
        <LoadingSkeleton variant="chart" />
      </div>
    </div>
  )
}

/** Thin top bar while a lazy route chunk or loader is pending. */
function NavigationProgress() {
  const navigation = useNavigation()
  if (navigation.state === 'idle') return null
  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-primary/15"
    >
      <div
        className="h-full w-1/3 animate-[shimmer_1.1s_ease-in-out_infinite] bg-primary"
        style={{ backgroundSize: '200% 100%' }}
      />
    </div>
  )
}

/**
 * Keeps document.title in sync, announces the new page to screen readers,
 * and moves focus to the page heading after client-side navigation.
 */
function useRouteA11y() {
  const route = useCurrentRoute()
  const { pathname } = useLocation()
  const first = useRef(true)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    const title =
      route && route.id !== 'home'
        ? `${route.label} · ${APP_NAME}`
        : `${APP_NAME} — Financial Inclusion Intelligence`
    document.title = title
    if (first.current) {
      first.current = false
      return
    }
    const id = window.setTimeout(() => {
      setAnnouncement(route?.label ?? 'Page loaded')
      const heading = document.getElementById('page-title')
      ;(heading ?? document.getElementById('main'))?.focus({ preventScroll: true })
    }, 50)
    return () => window.clearTimeout(id)
  }, [pathname, route])

  return announcement
}

/** App-wide notice if the dataset fails to load; pages render their own loading states. */
function DataStatusBanner() {
  const { status, error, retry } = useDataset()
  if (status !== 'error') return null
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 border-b border-negative/20 bg-negative-soft px-4 py-2.5 text-sm sm:px-6 lg:px-8"
    >
      <AlertTriangle className="size-4 text-negative" aria-hidden />
      <span className="font-medium">The Global Findex dataset could not be loaded.</span>
      {error && <span className="text-muted-foreground">{error}</span>}
      <Button size="sm" variant="outline" className="ml-auto" onClick={() => void retry()}>
        <RotateCw /> Retry
      </Button>
    </div>
  )
}

export function DashboardLayout() {
  const announcement = useRouteA11y()

  return (
    <ExportRegistryProvider>
      <div className="flex min-h-dvh bg-background">
        <a
          href="#main"
          className="sr-only z-[70] rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <NavigationProgress />
        <Sidebar />
        <MobileNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopNavigation />
          <DataStatusBanner />
          <main id="main" tabIndex={-1} className="flex-1 outline-none">
            <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
              <PrintHeader />
              <Suspense fallback={<PageFallback />}>
                <Outlet />
              </Suspense>
            </div>
          </main>
          <Toaster />
          <footer className="border-t px-4 py-5 text-xs text-muted-foreground sm:px-6 lg:px-8 print:hidden">
            <div className="mx-auto flex max-w-[1440px] flex-col gap-1 sm:flex-row sm:justify-between">
              <span>
                Data: World Bank Global Findex Database. FinLens does not alter source values.
              </span>
              <span>
                Forecasts and the composite index are FinLens-derived and not official World Bank
                figures.
              </span>
              <span>© sk_das</span>
            </div>
          </footer>
        </div>
        <CommandPalette />
        <SettingsDialog />
        <ScrollRestoration />
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </div>
      </div>
    </ExportRegistryProvider>
  )
}
