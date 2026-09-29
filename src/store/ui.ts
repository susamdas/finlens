import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  /** Desktop sidebar collapsed to icons (persisted). */
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  /** Mobile navigation drawer (not persisted). */
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void
  /** Global search / command palette (not persisted). */
  commandOpen: boolean
  setCommandOpen: (open: boolean) => void
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      mobileNavOpen: false,
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
      commandOpen: false,
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      settingsOpen: false,
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
    }),
    {
      name: 'finlens-ui',
      version: 1,
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }),
    },
  ),
)
