import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { Link2, Moon, PanelLeft, Settings, Sun } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { ROUTES, ROUTE_GROUP_LABELS } from '@/config/routes'
import { useHotkey, modKeyLabel } from '@/hooks/useHotkey'
import { useReferenceData } from '@/hooks/useReferenceData'
import { useResolvedTheme } from '@/hooks/useTheme'
import { useThemeStore } from '@/store/theme'
import { useUIStore } from '@/store/ui'
import { NavIcon } from './nav-icons'
import { searchFilter } from '@/lib/query/search'

/** Pages that can be opened directly (no required params). */
const SEARCHABLE_PAGES = ROUTES.filter((r) => !r.path.includes(':') && r.id !== 'home')

/**
 * Global search (⌘K / Ctrl+K, or "/"). Pages and actions today; countries, regions and
 * indicators are added from the dataset in Phase 4.
 */
export function CommandPalette() {
  const open = useUIStore((s) => s.commandOpen)
  const setOpen = useUIStore((s) => s.setCommandOpen)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const setPreference = useThemeStore((s) => s.setPreference)
  const theme = useResolvedTheme()
  const { countries, regions, indicators, status } = useReferenceData()
  const navigate = useNavigate()

  const toggle = useCallback(() => setOpen(!useUIStore.getState().commandOpen), [setOpen])
  const openIt = useCallback(() => setOpen(true), [setOpen])
  useHotkey('k', toggle, { mod: true })
  useHotkey('/', openIt)

  const run = (fn: () => void) => {
    setOpen(false)
    fn()
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} filter={searchFilter}>
      <CommandInput placeholder="Search pages, countries, regions, indicators…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        {countries.length > 0 && (
          <CommandGroup heading="Countries">
            {countries.map((c) => (
              <CommandItem
                key={c.code}
                value={`${c.name} ${c.code} ${c.region ?? ''}`}
                onSelect={() => run(() => navigate(`/country/${c.slug}`))}
              >
                <NavIcon name="Flag" aria-hidden />
                {c.name}
                {c.region && <CommandShortcut>{c.region}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {regions.length > 0 && (
          <CommandGroup heading="Regions">
            {regions.map((r) => (
              <CommandItem
                key={r.id}
                value={`${r.name} region`}
                onSelect={() => run(() => navigate(`/region/${r.slug}`))}
              >
                <NavIcon name="Map" aria-hidden />
                {r.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {indicators.length > 0 && (
          <CommandGroup heading="Indicators">
            {indicators.map((i) => (
              <CommandItem
                key={i.id}
                value={`${i.label} indicator`}
                onSelect={() => run(() => navigate(`/map?metric=${i.id}`))}
              >
                <NavIcon name="Globe2" aria-hidden />
                {i.label}
                <CommandShortcut className="tracking-normal">Map</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Pages">
          {SEARCHABLE_PAGES.map((r) => {
            return (
              <CommandItem
                key={r.id}
                value={`${r.label} ${r.description} ${('keywords' in r ? r.keywords : []).join(' ')}`}
                onSelect={() => run(() => navigate(r.path))}
              >
                <NavIcon name={r.icon} aria-hidden />
                <span className="flex-1 truncate">{r.label}</span>
                <CommandShortcut className="tracking-normal">
                  {ROUTE_GROUP_LABELS[r.group]}
                </CommandShortcut>
              </CommandItem>
            )
          })}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem
            value="toggle theme dark light mode"
            onSelect={() => run(() => setPreference(theme === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
            Switch to {theme === 'dark' ? 'light' : 'dark'} mode
          </CommandItem>
          <CommandItem
            value="copy shareable link url"
            onSelect={() => run(() => void navigator.clipboard?.writeText(window.location.href))}
          >
            <Link2 aria-hidden />
            Copy link to this view
          </CommandItem>
          <CommandItem value="toggle sidebar collapse" onSelect={() => run(toggleSidebar)}>
            <PanelLeft aria-hidden />
            Toggle sidebar
          </CommandItem>
          <CommandItem
            value="settings preferences"
            onSelect={() => run(() => setSettingsOpen(true))}
          >
            <Settings aria-hidden />
            Settings
          </CommandItem>
        </CommandGroup>
      </CommandList>
      <div className="flex items-center justify-between border-t px-4 py-2 text-[11.5px] text-muted-foreground">
        <span>
          {status === 'ready'
            ? 'Countries, regions and indicators included'
            : 'Countries & indicators become searchable once the dataset is loaded'}
        </span>
        <span className="hidden sm:inline">
          <kbd className="rounded border bg-muted px-1 font-sans">{modKeyLabel} K</kbd> to toggle
        </span>
      </div>
    </CommandDialog>
  )
}
