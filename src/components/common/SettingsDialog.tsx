import { Monitor, Moon, Sun } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useThemeStore, type ThemePreference } from '@/store/theme'
import { useUIStore } from '@/store/ui'

function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

export function SettingsDialog() {
  const open = useUIStore((s) => s.settingsOpen)
  const setOpen = useUIStore((s) => s.setSettingsOpen)
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const preference = useThemeStore((s) => s.preference)
  const setPreference = useThemeStore((s) => s.setPreference)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Preferences are saved in this browser only.</DialogDescription>
        </DialogHeader>
        <div className="divide-y">
          <Row label="Appearance">
            <ToggleGroup
              type="single"
              value={preference}
              onValueChange={(v) => v && setPreference(v as ThemePreference)}
              aria-label="Theme"
            >
              <ToggleGroupItem value="light">
                <Sun /> Light
              </ToggleGroupItem>
              <ToggleGroupItem value="dark">
                <Moon /> Dark
              </ToggleGroupItem>
              <ToggleGroupItem value="system">
                <Monitor /> System
              </ToggleGroupItem>
            </ToggleGroup>
          </Row>
          <Row label="Sidebar" hint="Desktop only">
            <ToggleGroup
              type="single"
              value={collapsed ? 'compact' : 'full'}
              onValueChange={(v) => v && (v === 'compact') !== collapsed && toggleSidebar()}
              aria-label="Sidebar width"
            >
              <ToggleGroupItem value="full">Full</ToggleGroupItem>
              <ToggleGroupItem value="compact">Icons only</ToggleGroupItem>
            </ToggleGroup>
          </Row>
        </div>
      </DialogContent>
    </Dialog>
  )
}
