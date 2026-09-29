import { Link } from 'react-router'
import { PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react'
import { Logo } from '@/components/common/Logo'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useUIStore } from '@/store/ui'
import { SidebarNav } from './SidebarNav'
import { cn } from '@/lib/utils'

/** Desktop sidebar (≥ lg). Collapses to an icon rail. */
export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggle = useUIStore((s) => s.toggleSidebar)

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex',
        collapsed ? 'w-[68px]' : 'w-64',
      )}
    >
      <div className={cn('flex h-16 items-center', collapsed ? 'justify-center' : 'px-5')}>
        <Link
          to="/"
          aria-label="FinLens home"
          className="rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          <Logo compact={collapsed} />
        </Link>
      </div>
      <ScrollArea className="flex-1">
        <div className={cn('py-2', collapsed ? 'px-2.5' : 'px-3')}>
          <SidebarNav collapsed={collapsed} />
        </div>
      </ScrollArea>
      <div
        className={cn('border-t border-sidebar-border p-2', collapsed ? 'flex justify-center' : '')}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={toggle}
          className={cn('text-muted-foreground', !collapsed && 'w-full justify-start')}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          {!collapsed && 'Collapse'}
        </Button>
      </div>
    </aside>
  )
}

/** Mobile / tablet drawer (< lg). */
export function MobileNav() {
  const open = useUIStore((s) => s.mobileNavOpen)
  const setOpen = useUIStore((s) => s.setMobileNavOpen)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="w-[85%] max-w-72 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SheetDescription className="sr-only">FinLens sections</SheetDescription>
        <div className="flex h-16 items-center px-5">
          <Link to="/" onClick={() => setOpen(false)} aria-label="FinLens home">
            <Logo />
          </Link>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-3 py-2">
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
        </ScrollArea>
        <div className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => {
              setOpen(false)
              setSettingsOpen(true)
            }}
          >
            <Settings /> Settings
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
