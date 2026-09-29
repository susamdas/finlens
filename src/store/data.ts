import { create } from 'zustand'
import { createRepository, type FindexRepository } from '@/data/repository'

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface DataState {
  status: Status
  repo: FindexRepository | null
  error: string | null
  /** Bumps when lazily loaded data arrives so subscribers recompute. */
  revision: number
  load: () => Promise<void>
  /** Loads extra groups / series, then notifies subscribers. */
  ensure: (opts: { groups?: boolean; indicators?: string[] }) => Promise<void>
}

export const useDataStore = create<DataState>()((set, get) => ({
  status: 'idle',
  repo: null,
  error: null,
  revision: 0,
  load: async () => {
    if (get().status === 'loading' || get().status === 'ready') return
    set({ status: 'loading', error: null })
    try {
      const repo = await createRepository()
      set({ status: 'ready', repo })
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) })
    }
  },
  ensure: async ({ groups, indicators }) => {
    const repo = get().repo
    if (!repo) return
    await Promise.all([
      groups ? repo.ensureGroups() : null,
      indicators?.length ? repo.ensureIndicators(indicators) : null,
    ])
    set((s) => ({ revision: s.revision + 1 }))
  },
}))
