import { Link } from 'react-router'
import { Menu, Search, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LogoMark } from '@/components/common/Logo'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { ExportMenu } from '@/components/common/ExportMenu'
import { CountrySelector } from '@/components/common/CountrySelector'
import { YearSelector } from '@/components/common/YearSelector'
import { useFilters } from '@/hooks/useFilters'
import { modKeyLabel } from '@/hooks/useHotkey'
import { useReferenceData } from '@/hooks/useReferenceData'
import { useUIStore } from '@/store/ui'

const NOT_LOADED = 'Available once the Global Findex dataset is loaded'

export function TopNavigation() {
  const setMobileNavOpen = useUIStore((s) => s.setMobileNavOpen)
  const setCommandOpen = useUIStore((s) => s.setCommandOpen)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const { filters, setFilters } = useFilters()
  const { countries, years, status } = useReferenceData()
  const latest = years[years.length - 1]
  const reason =
    status === 'error'
      ? 'The dataset failed to load'
      : status === 'ready'
        ? undefined
        : 'Loading the Global Findex dataset…'

  return (
    <header className="glass sticky top-0 z-40 border-b print:hidden">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 lg:hidden"
          aria-label="Open navigation"
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu />
        </Button>
        <Link to="/" aria-label="FinLens home" className="rounded-lg lg:hidden">
          <LogoMark />
        </Link>

        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground shadow-card transition-colors outline-none hover:border-input hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 sm:max-w-md"
          aria-label="Search FinLens"
          aria-keyshortcuts="Control+K Meta+K"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="truncate">
            <span className="sm:hidden">Search</span>
            <span className="hidden sm:inline">Search countries, regions, indicators…</span>
          </span>
          <kbd className="ml-auto hidden rounded border bg-muted px-1.5 py-0.5 font-sans text-[11px] font-medium md:inline">
            {modKeyLabel} K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <CountrySelector
            className="hidden xl:inline-flex"
            options={countries}
            value={filters.country}
            onChange={(country) => setFilters({ country })}
            disabledReason={reason ?? NOT_LOADED}
          />
          <YearSelector
            className="hidden md:flex"
            years={years}
            value={filters.year ?? latest}
            onChange={(year) => setFilters({ year: year === latest ? null : year })}
            disabledReason={reason ?? NOT_LOADED}
          />
          <span className="hidden sm:contents">
            <ExportMenu />
          </span>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
            className="hidden sm:inline-flex"
          >
            <Settings />
          </Button>
        </div>
      </div>
    </header>
  )
}
